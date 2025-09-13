/**
 * ResourceManager
 * Core resource management system for MCP server
 * Following MCP 2025-06-18 specification
 */

import type { 
  ListResourcesResult, 
  ReadResourceResult,
  Resource 
} from '@modelcontextprotocol/sdk/types.js';
import { TaskContextManager } from '../core/TaskContextManager.js';
import { ConnectionManager } from '../core/ConnectionManager.js';
import { EventLogger } from '../logging/EventLogger.js';
import { AgentCommError } from '../types.js';
import { 
  ResourceProvider, 
  ResourceMetadata 
} from './providers/ResourceProvider.js';
import { TaskResourceProvider } from './providers/TaskResourceProvider.js';
import { ServerResourceProvider } from './providers/ServerResourceProvider.js';
import { AgentResourceProvider } from './providers/AgentResourceProvider.js';

/**
 * Configuration for ResourceManager
 */
export interface ResourceManagerConfig {
  taskContextManager: TaskContextManager;
  eventLogger: EventLogger;
  connectionManager: ConnectionManager;
  pageSize?: number;
}

/**
 * Cursor state for pagination
 */
interface CursorState {
  offset: number;
  scheme?: string;
}

/**
 * ResourceManager handles all resource operations for the MCP server
 * Manages multiple resource providers and coordinates resource access
 */
export class ResourceManager {
  private providers: ResourceProvider[] = [];
  private readonly pageSize: number;

  constructor(private config: ResourceManagerConfig) {
    this.pageSize = config.pageSize ?? 20;
    this.initializeDefaultProviders();
  }

  /**
   * Initialize built-in resource providers
   */
  private initializeDefaultProviders(): void {
    // Register TaskResourceProvider for agent://[agent]/tasks/[taskId] URIs
    const taskProvider = new TaskResourceProvider({
      taskContextManager: this.config.taskContextManager,
      eventLogger: this.config.eventLogger
    });
    this.registerProvider(taskProvider);

    // Register ServerResourceProvider for server:// URIs
    const serverProvider = new ServerResourceProvider({
      eventLogger: this.config.eventLogger
    });
    this.registerProvider(serverProvider);

    // Register AgentResourceProvider for agent://[agent]/status URIs
    const agentProvider = new AgentResourceProvider({
      connectionManager: this.config.connectionManager,
      taskContextManager: this.config.taskContextManager,
      eventLogger: this.config.eventLogger
    });
    this.registerProvider(agentProvider);
  }

  /**
   * Register a custom resource provider
   */
  registerProvider(provider: ResourceProvider): void {
    const scheme = provider.getScheme();
    this.providers.push(provider);
    this.config.eventLogger.logOperation('register_provider', 'system', {
      scheme,
      timestamp: new Date().toISOString()
    }).catch(() => {
      // Non-critical logging error
    });
  }

  /**
   * List all available resources with pagination
   */
  async listResources(options?: { cursor?: string }): Promise<ListResourcesResult> {
    try {
      const cursor = this.decodeCursor(options?.cursor);
      const allResources: Resource[] = [];

      // Collect resources from all providers
      for (const provider of this.providers) {
        try {
          const resources = await provider.listResources({
            limit: this.pageSize * 2 // Get extra for pagination
          });
          allResources.push(...resources);
        } catch (error) {
          // Log but don't fail if one provider has issues
          const scheme = provider.getScheme();
          await this.config.eventLogger.logOperation('provider_error', 'system', {
            provider: scheme,
            error: `Provider ${scheme} failed to list resources`,
            details: error
          });
        }
      }

      // Add server resources
      allResources.push(...this.getServerResources());

      // Apply pagination
      const start = cursor.offset;
      const end = start + this.pageSize;
      const paginatedResources = allResources.slice(start, end);
      
      const result: ListResourcesResult = {
        resources: paginatedResources
      };

      // Add next cursor if there are more resources
      if (end < allResources.length) {
        result.nextCursor = this.encodeCursor({ offset: end });
      }

      await this.config.eventLogger.logOperation('list_resources', 'system', {
        count: paginatedResources.length,
        totalAvailable: allResources.length,
        cursor: options?.cursor
      });

      return result;
    } catch (error) {
      await this.config.eventLogger.logOperation('error', 'system', {
        operation: 'list_resources',
        error: 'Failed to list resources',
        details: error
      });
      throw new AgentCommError(
        'Failed to list resources',
        'INTERNAL_ERROR',
        { originalError: error as Error }
      );
    }
  }

  /**
   * Read a specific resource by URI
   */
  async readResource(uri: string): Promise<ReadResourceResult> {
    try {
      // Parse URI scheme
      const scheme = this.parseUriScheme(uri);
      
      // Handle built-in server resources directly (bypass provider)
      if (scheme === 'server') {
        return this.readServerResource(uri);
      }

      // Find a provider that can handle this URI
      for (const provider of this.providers) {
        if (provider.canHandle(uri)) {
          const content = await provider.readResource(uri);
          await this.config.eventLogger.logOperation('read_resource', 'system', {
            uri,
            mimeType: content.mimeType
          });
          
          // Ensure we return the correct shape based on content type
          if (content.text !== undefined) {
            return {
              contents: [{
                uri: content.uri,
                text: content.text,
                mimeType: content.mimeType
              }]
            };
          } else if (content.blob !== undefined) {
            return {
              contents: [{
                uri: content.uri,
                blob: content.blob,
                mimeType: content.mimeType
              }]
            };
          } else {
            // Fallback if neither text nor blob is provided
            return {
              contents: [{
                uri: content.uri,
                text: '',
                mimeType: content.mimeType
              }]
            };
          }
        }
      }
      
      // No provider could handle this URI
      throw new AgentCommError(
        'Resource not found',
        'RESOURCE_NOT_FOUND',
        { uri }
      );
    } catch (error) {
      if (error instanceof AgentCommError) {
        throw error;
      }
      
      await this.config.eventLogger.logOperation('error', 'system', {
        operation: 'read_resource',
        error: 'Resource not found',
        uri
      });
      throw new AgentCommError(
        'Resource not found',
        'RESOURCE_NOT_FOUND',
        { uri, originalError: error as Error }
      );
    }
  }

  /**
   * Get metadata for a resource
   */
  async getResourceMetadata(uri: string): Promise<ResourceMetadata> {
    // Find a provider that can handle this URI
    for (const provider of this.providers) {
      if (provider.canHandle(uri)) {
        if (!provider.getResourceMetadata) {
          // Fallback: read the resource and extract basic metadata
          const content = await provider.readResource(uri);
          return {
            uri,
            name: uri.split('/').pop() ?? uri,
            mimeType: content.mimeType,
            size: content.text?.length ?? content.blob?.length ?? 0,
            lastModified: new Date().toISOString()
          };
        }
        return provider.getResourceMetadata(uri);
      }
    }
    
    throw new AgentCommError(
      'No provider can handle this URI',
      'RESOURCE_NOT_FOUND',
      { uri }
    );
  }

  /**
   * Search resources across all providers
   */
  async searchResources(query: string): Promise<ListResourcesResult> {
    const results: Resource[] = [];

    for (const provider of this.providers) {
      if (provider.searchResources) {
        try {
          const resources = await provider.searchResources(query);
          results.push(...resources);
        } catch (error) {
          // Log but don't fail the entire search
          await this.config.eventLogger.logOperation('error', 'system', {
            operation: 'search_resources',
            error: `Provider search failed`,
            details: error
          });
        }
      } else {
        // Simple filtering for providers without search
        try {
          const resources = await provider.listResources();
          const filtered = resources.filter(r => 
            r.uri.toLowerCase().includes(query.toLowerCase()) ||
            r.name.toLowerCase().includes(query.toLowerCase()) ||
            r.description?.toLowerCase().includes(query.toLowerCase())
          );
          results.push(...filtered);
        } catch (error) {
          // Ignore errors from individual providers
        }
      }
    }

    return { resources: results };
  }

  /**
   * Get built-in server resources
   */
  private getServerResources(): Resource[] {
    return [
      {
        uri: 'server://info',
        name: 'Server Information',
        mimeType: 'application/json',
        description: 'Complete server information and metadata'
      },
      {
        uri: 'server://version',
        name: 'Server Version',
        mimeType: 'text/plain',
        description: 'Current server version'
      },
      {
        uri: 'server://capabilities',
        name: 'Server Capabilities',
        mimeType: 'application/json',
        description: 'Server capabilities and supported features'
      }
    ];
  }

  /**
   * Read server-specific resources
   */
  private async readServerResource(uri: string): Promise<ReadResourceResult> {
    const path = uri.replace('server://', '');
    
    switch (path) {
      case 'info': {
        const info = {
          name: '@jerfowler/agent-comm-mcp-server',
          version: await this.getServerVersion(),
          capabilities: this.getServerCapabilities(),
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform
        };
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(info, null, 2)
          }]
        };
      }
      
      case 'version': {
        const version = await this.getServerVersion();
        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: version
          }]
        };
      }
      
      case 'capabilities': {
        const capabilities = this.getServerCapabilities();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(capabilities, null, 2)
          }]
        };
      }
      
      default:
        throw new AgentCommError(
          `Unknown server resource: ${path}`,
          'RESOURCE_NOT_FOUND',
          { uri }
        );
    }
  }

  /**
   * Get server version from package.json
   */
  private async getServerVersion(): Promise<string> {
    try {
      const fs = await import('../utils/fs-extra-safe.js');
      const content = await fs.readFile('./package.json', 'utf8');
      const packageJson = JSON.parse(content) as { version?: string };
      return packageJson.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Get server capabilities
   */
  private getServerCapabilities(): Record<string, unknown> {
    return {
      resources: {
        listResources: true,
        readResource: true,
        pagination: true,
        search: true
      },
      tools: {
        listTools: true,
        callTool: true
      },
      prompts: {
        listPrompts: true,
        getPrompt: true
      },
      experimental: {
        sampling: false,
        roots: false,
        completion: false
      }
    };
  }

  /**
   * Parse URI scheme
   */
  private parseUriScheme(uri: string): string {
    const match = uri.match(/^([a-z]+):\/\//);
    if (!match) {
      throw new AgentCommError(
        'Invalid resource URI',
        'INVALID_PARAMS',
        { uri }
      );
    }
    return match[1];
  }

  /**
   * Encode cursor for pagination
   */
  private encodeCursor(state: CursorState): string {
    return Buffer.from(JSON.stringify(state)).toString('base64');
  }

  /**
   * Decode cursor from string
   */
  private decodeCursor(cursor?: string): CursorState {
    if (!cursor) {
      return { offset: 0 };
    }
    
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      return JSON.parse(decoded) as CursorState;
    } catch {
      return { offset: 0 };
    }
  }
}