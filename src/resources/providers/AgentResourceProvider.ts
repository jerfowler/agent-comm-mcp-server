/**
 * AgentResourceProvider
 * Provides agent status and information resources via agent:// URIs
 * Following MCP 2025-06-18 specification
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { 
  ResourceProvider, 
  ResourceContent, 
  ResourceMetadata 
} from './ResourceProvider.js';
import { ConnectionManager } from '../../core/ConnectionManager.js';
import { TaskContextManager } from '../../core/TaskContextManager.js';
import { EventLogger } from '../../logging/EventLogger.js';
import { AgentCommError, ServerConfig } from '../../types.js';
import { getAllAgents, getAgentTasks } from '../../utils/task-manager.js';

/**
 * Configuration for AgentResourceProvider
 */
export interface AgentResourceProviderConfig {
  connectionManager: ConnectionManager;
  taskContextManager: TaskContextManager;
  eventLogger: EventLogger;
}

/**
 * AgentResourceProvider exposes agent status and information as resources
 * URI format: agent://[agent-name]/status
 */
export class AgentResourceProvider implements ResourceProvider {
  constructor(private config: AgentResourceProviderConfig) {}

  /**
   * Get the URI scheme this provider handles
   */
  getScheme(): string {
    return 'agent';
  }

  /**
   * List all agent status resources
   */
  async listResources(): Promise<Resource[]> {
    try {
      const resources: Resource[] = [];
      // Create a full ServerConfig by extending the provider's config
      const serverConfig: ServerConfig = {
        commDir: process.env['AGENT_COMM_DIR'] || './comm',
        archiveDir: process.env['AGENT_COMM_ARCHIVE_DIR'] || './comm/.archive',
        logDir: process.env['AGENT_COMM_LOG_DIR'] || './comm/.logs',
        enableArchiving: process.env['AGENT_COMM_DISABLE_ARCHIVE'] !== 'true',
        connectionManager: this.config.connectionManager,
        eventLogger: this.config.eventLogger
      };
      const agentData = await getAllAgents(serverConfig);
      const agents = agentData.map(a => a.name);

      for (const agent of agents) {
        resources.push({
          uri: `agent://${agent}/status`,
          name: `${agent} Status`,
          mimeType: 'application/json',
          description: `Current status and activity for ${agent}`
        });
      }

      return resources;
    } catch (error) {
      await this.config.eventLogger.logOperation('error', 'system', {
        operation: 'list_agent_resources',
        error: 'Failed to list agent resources',
        originalError: error
      });
      return [];
    }
  }

  /**
   * Read agent status content
   */
  async readResource(uri: string): Promise<ResourceContent> {
    // Only handle status resources
    if (!uri.includes('/status')) {
      throw new AgentCommError(
        'AgentResourceProvider only handles status resources',
        'INVALID_PARAMS',
        { uri }
      );
    }

    const agent = this.parseAgentUri(uri);
    const status = await this.getAgentStatus(agent);

    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(status, null, 2)
    };
  }

  /**
   * Check if this provider can handle a given URI
   */
  canHandle(uri: string): boolean {
    return uri.startsWith('agent://') && uri.includes('/status');
  }

  /**
   * Get metadata for an agent resource
   */
  async getResourceMetadata(uri: string): Promise<ResourceMetadata> {
    const agent = this.parseAgentUri(uri);
    
    return {
      uri,
      name: `${agent} Status`,
      mimeType: 'application/json',
      description: `Current status and activity for ${agent}`,
      lastModified: new Date().toISOString(),
      dynamic: true,
      agent
    };
  }

  /**
   * Get agent status information
   */
  private async getAgentStatus(agent: string): Promise<any> {
    try {
      // Get connection status - for now just return basic info
      const connectionStatus = { connected: false, lastActivity: null };

      // Get task statistics using task-manager utility
      const serverConfig: ServerConfig = {
        commDir: process.env['AGENT_COMM_DIR'] || './comm',
        archiveDir: process.env['AGENT_COMM_ARCHIVE_DIR'] || './comm/.archive',
        logDir: process.env['AGENT_COMM_LOG_DIR'] || './comm/.logs',
        enableArchiving: process.env['AGENT_COMM_DISABLE_ARCHIVE'] !== 'true',
        connectionManager: this.config.connectionManager,
        eventLogger: this.config.eventLogger
      };
      const tasks = await getAgentTasks(serverConfig, agent);
      
      // Calculate task statistics based on flags (tasks don't have a status field)
      const taskStats = {
        total: tasks.length,
        pending: tasks.filter((t: any) => t.hasInit || t.hasPlan).length,
        completed: tasks.filter((t: any) => t.hasDone).length,
        error: tasks.filter((t: any) => t.hasError).length
      };

      // Get current active task (tasks with PLAN.md but not DONE/ERROR)
      const activeTasks = tasks.filter((t: any) => t.hasPlan && !t.hasDone && !t.hasError);
      const activeTask = activeTasks.length > 0 ? activeTasks[0] : null;

      return {
        agent,
        connected: connectionStatus.connected,
        lastActivity: connectionStatus.lastActivity || null,
        activeTask: activeTask ? activeTask.name : null,
        taskStatistics: taskStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      await this.config.eventLogger.logOperation('error', 'system', {
        operation: 'get_agent_status',
        error: 'Failed to get agent status',
        agent,
        originalError: error
      });
      throw new AgentCommError(
        'Failed to retrieve agent status',
        'INTERNAL_ERROR',
        { agent, originalError: error }
      );
    }
  }

  /**
   * Parse agent name from URI
   */
  private parseAgentUri(uri: string): string {
    // Expected format: agent://[agent]/status
    const match = uri.match(/^agent:\/\/([^/]+)\/status$/);
    
    if (!match) {
      throw new AgentCommError(
        'Invalid agent status URI',
        'INVALID_PARAMS',
        { uri, expectedFormat: 'agent://[agent]/status' }
      );
    }

    return match[1];
  }
}