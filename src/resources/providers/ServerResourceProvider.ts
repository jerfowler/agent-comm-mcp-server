/**
 * ServerResourceProvider
 * Provides server information resources via server:// URIs
 * Following MCP 2025-06-18 specification
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { 
  ResourceProvider, 
  ResourceContent, 
  ResourceMetadata 
} from './ResourceProvider.js';
import { EventLogger } from '../../logging/EventLogger.js';
import { AgentCommError } from '../../types.js';
import * as fs from '../../utils/fs-extra-safe.js';
import * as path from 'path';

/**
 * Configuration for ServerResourceProvider
 */
export interface ServerResourceProviderConfig {
  eventLogger: EventLogger;
}

/**
 * Cache for server version to avoid repeated file reads
 */
let versionCache: { version: string; timestamp: number } | null = null;
const VERSION_CACHE_TTL = 60000; // 1 minute

/**
 * ServerResourceProvider exposes server information as resources
 * URI format: server://[resource-name]
 */
export class ServerResourceProvider implements ResourceProvider {
  constructor(private config: ServerResourceProviderConfig) {}

  /**
   * Get the URI scheme this provider handles
   */
  getScheme(): string {
    return 'server';
  }

  /**
   * List all server information resources
   */
  async listResources(): Promise<Resource[]> {
    return [
      {
        uri: 'server://info',
        name: 'Server Information',
        mimeType: 'application/json',
        description: 'Complete server information including version, uptime, and system details'
      },
      {
        uri: 'server://version',
        name: 'Server Version',
        mimeType: 'text/plain',
        description: 'Current server version number'
      },
      {
        uri: 'server://capabilities',
        name: 'Server Capabilities',
        mimeType: 'application/json',
        description: 'Server capabilities and supported MCP features'
      },
      {
        uri: 'server://statistics',
        name: 'Server Statistics',
        mimeType: 'application/json',
        description: 'Runtime statistics and performance metrics'
      },
      {
        uri: 'server://configuration',
        name: 'Server Configuration',
        mimeType: 'application/json',
        description: 'Current server configuration (sanitized)'
      }
    ];
  }

  /**
   * Read server resource content
   */
  async readResource(uri: string): Promise<ResourceContent> {
    const resourceName = uri.replace('server://', '');
    
    switch (resourceName) {
      case 'info':
        return this.getServerInfo(uri);
      
      case 'version':
        return this.getServerVersion(uri);
      
      case 'capabilities':
        return this.getServerCapabilities(uri);
      
      case 'statistics':
        return this.getServerStatistics(uri);
      
      case 'configuration':
        return this.getServerConfiguration(uri);
      
      default:
        throw new AgentCommError(
          `Unknown server resource: ${resourceName}`,
          'RESOURCE_NOT_FOUND',
          { uri }
        );
    }
  }

  /**
   * Check if this provider can handle a given URI
   */
  canHandle(uri: string): boolean {
    return uri.startsWith('server://');
  }

  /**
   * Get metadata for a server resource
   */
  async getResourceMetadata(uri: string): Promise<ResourceMetadata> {
    const resourceName = uri.replace('server://', '');
    const resources = await this.listResources();
    const resource = resources.find(r => r.uri === uri);
    
    if (!resource) {
      throw new AgentCommError(
        'Server resource not found',
        'RESOURCE_NOT_FOUND',
        { uri }
      );
    }

    return {
      uri,
      name: resource.name,
      mimeType: resource.mimeType || 'application/json',
      description: resource.description || '',
      lastModified: new Date().toISOString(),
      static: resourceName === 'version' || resourceName === 'capabilities'
    };
  }

  /**
   * Get complete server information
   */
  private async getServerInfo(uri: string): Promise<ResourceContent> {
    const version = await this.readServerVersion();
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    const info = {
      name: '@jerfowler/agent-comm-mcp-server',
      version,
      description: 'MCP server for AI agent task communication and delegation',
      author: 'Jeremy Fowler',
      license: 'MIT',
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: Math.floor(uptime),
        uptimeFormatted: this.formatUptime(uptime)
      },
      memory: {
        rss: Math.floor(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.floor(memoryUsage.external / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    };

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(info, null, 2)
    };
  }

  /**
   * Get server version
   */
  private async getServerVersion(uri: string): Promise<ResourceContent> {
    const version = await this.readServerVersion();
    
    return {
      uri,
      mimeType: 'text/plain',
      text: version
    };
  }

  /**
   * Get server capabilities
   */
  private async getServerCapabilities(uri: string): Promise<ResourceContent> {
    const capabilities = {
      protocol: {
        version: '2025-06-18',
        features: ['resources', 'tools', 'prompts']
      },
      resources: {
        supported: true,
        features: ['list', 'read', 'pagination', 'search', 'metadata']
      },
      tools: {
        supported: true,
        count: 17,
        categories: ['context-based', 'traditional', 'diagnostic', 'utility']
      },
      prompts: {
        supported: true,
        features: ['basic']
      },
      experimental: {
        sampling: false,
        roots: false,
        completion: false
      }
    };

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(capabilities, null, 2)
    };
  }

  /**
   * Get server statistics
   */
  private async getServerStatistics(uri: string): Promise<ResourceContent> {
    const stats = {
      process: {
        uptime: process.uptime(),
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage()
      },
      system: {
        loadAverage: (process as NodeJS.Process & { loadavg?: () => number[] }).loadavg?.() || [0, 0, 0],
        freemem: (process as NodeJS.Process & { freemem?: () => number }).freemem?.() || 0,
        totalmem: (process as NodeJS.Process & { totalmem?: () => number }).totalmem?.() || 0
      },
      timestamp: new Date().toISOString()
    };

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(stats, null, 2)
    };
  }

  /**
   * Get sanitized server configuration
   */
  private async getServerConfiguration(uri: string): Promise<ResourceContent> {
    const config = {
      environment: process.env['NODE_ENV'] || 'development',
      directories: {
        commDir: process.env['AGENT_COMM_DIR'] || './comm',
        archiveDir: process.env['AGENT_COMM_ARCHIVE_DIR'] || './comm/.archive',
        logDir: process.env['AGENT_COMM_LOG_DIR'] || './comm/.logs'
      },
      features: {
        archiving: process.env['AGENT_COMM_DISABLE_ARCHIVE'] !== 'true',
        hookDebug: process.env['AGENT_COMM_HOOK_DEBUG'] === 'true'
      },
      limits: {
        maxTaskAge: parseInt(process.env['AGENT_COMM_MAX_TASK_AGE'] || '30'),
        autoArchiveDays: parseInt(process.env['AGENT_COMM_AUTO_ARCHIVE_DAYS'] || '7')
      }
    };

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(config, null, 2)
    };
  }

  /**
   * Read server version from package.json with caching
   */
  private async readServerVersion(): Promise<string> {
    // Check cache
    if (versionCache && Date.now() - versionCache.timestamp < VERSION_CACHE_TTL) {
      return versionCache.version;
    }

    try {
      const packageJsonPath = path.resolve(process.cwd(), 'package.json');
      const packageJson = await fs.readJSON(packageJsonPath);
      const version = (packageJson as { version?: string }).version || '0.0.0';
      
      // Update cache
      versionCache = { version, timestamp: Date.now() };
      
      return version;
    } catch (error) {
      await this.config.eventLogger.logOperation('error', 'system', {
        operation: 'read_package_json',
        error: 'Failed to read package.json',
        originalError: error
      });
      return '0.0.0';
    }
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    
    return parts.join(' ');
  }
}