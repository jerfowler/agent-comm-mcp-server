/**
 * TaskResourceProvider
 * Exposes agent tasks as MCP resources via agent:// URIs
 * Following MCP 2025-06-18 specification
 */

import debug from 'debug';
import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import {
  ResourceProvider,
  ResourceContent,
  ResourceMetadata
} from './ResourceProvider.js';

const log = debug('agent-comm:resources:providers:taskresourceprovider');
import { TaskContextManager } from '../../core/TaskContextManager.js';
import { EventLogger } from '../../logging/EventLogger.js';
import { AgentCommError } from '../../types.js';

/**
 * Configuration for TaskResourceProvider
 */
export interface TaskResourceProviderConfig {
  taskContextManager: TaskContextManager;
  eventLogger: EventLogger;
}

/**
 * TaskResourceProvider exposes agent tasks as resources
 * URI format: agent://[agent-name]/tasks/[task-id]
 */
export class TaskResourceProvider implements ResourceProvider {
  constructor(private config: TaskResourceProviderConfig) {}

  /**
   * Get the URI scheme this provider handles
   */
  getScheme(): string {
    return 'agent';
  }

  /**
   * List all task resources across all agents
   */
  async listResources(options?: {
    cursor?: string;
    limit?: number;
    filter?: string;
  }): Promise<Resource[]> {
    log('listResources called');
    try {
      const resources: Resource[] = [];
      // Get all agents from comm directory
      const fs = await import('../../utils/fs-extra-safe.js');
      const path = await import('path');
      const commDir = process.env['AGENT_COMM_DIR'] || './comm';
      
      let agents: string[] = [];
      if (await fs.pathExists(commDir)) {
        const entries = await fs.readdir(commDir);
        agents = entries.filter(entry => !entry.startsWith('.'));
      }

      for (const agent of agents) {
        const agentDir = path.join(commDir, agent);
        const taskDirs = await fs.readdir(agentDir);
        
        for (const taskId of taskDirs) {
          const taskPath = path.join(agentDir, taskId);
          const stat = await fs.stat(taskPath);
          if (!stat.isDirectory()) continue;
          
          // Determine task status by checking which files exist
          let status = 'INIT';
          if (await fs.pathExists(path.join(taskPath, 'ERROR.md'))) {
            status = 'ERROR';
          } else if (await fs.pathExists(path.join(taskPath, 'DONE.md'))) {
            status = 'DONE';
          } else if (await fs.pathExists(path.join(taskPath, 'PLAN.md'))) {
            status = 'PLAN';
          }
          
          const taskName = this.extractTaskName(taskId);
          const resource: Resource = {
            uri: `agent://${agent}/tasks/${taskId}`,
            name: `Task: ${taskName} (${status})`,
            mimeType: 'application/json',
            description: `Task for ${agent} - Status: ${status}`
          };
          
          resources.push(resource);
        }
      }

      // Apply filter if provided
      if (options?.filter) {
        const filterStr = options.filter;
        return resources.filter(r => 
          r.uri.includes(filterStr) ||
          r.name.includes(filterStr) ||
          (r.description?.includes(filterStr) ?? false)
        );
      }

      return resources;
    } catch (error) {
      await this.config.eventLogger.logOperation('error', 'system', {
        operation: 'list_task_resources',
        error: 'Failed to list task resources',
        originalError: error
      });
      throw new AgentCommError(
        'Failed to list task resources',
        'INTERNAL_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Read task content for a specific URI
   */
  async readResource(uri: string): Promise<ResourceContent> {
    try {
      const { agent, taskId } = this.parseTaskUri(uri);
      
      // Get task context - create a synthetic connection for resource access
      const connection = {
        id: `resource-${Date.now()}`,
        agent,
        startTime: new Date(),
        metadata: {}
      };
      const taskContext = await this.config.taskContextManager.getTaskContext(taskId, connection);
      
      if (!taskContext) {
        throw new AgentCommError(
          'Task not found',
          'RESOURCE_NOT_FOUND',
          { uri, agent, taskId }
        );
      }

      // Return task content as JSON
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(taskContext, null, 2)
      };
    } catch (error) {
      if (error instanceof AgentCommError) {
        await this.config.eventLogger.logOperation('error', 'system', {
          operation: 'read_task_resource',
          error: error.message,
          uri,
          code: error.code,
          details: error.details
        });
        throw error;
      }
      
      await this.config.eventLogger.logOperation('error', 'system', {
        operation: 'read_task_resource',
        error: 'Failed to read task resource',
        uri,
        originalError: error
      });
      throw new AgentCommError(
        'Failed to read task resource',
        'INTERNAL_ERROR',
        { uri, originalError: error }
      );
    }
  }

  /**
   * Check if this provider can handle a given URI
   */
  canHandle(uri: string): boolean {
    return uri.startsWith('agent://') && uri.includes('/tasks/');
  }

  /**
   * Get metadata for a task resource
   */
  async getResourceMetadata(uri: string): Promise<ResourceMetadata> {
    const { agent, taskId } = this.parseTaskUri(uri);
    // Create a synthetic connection for resource access
    const connection = {
      id: `resource-${Date.now()}`,
      agent,
      startTime: new Date(),
      metadata: {}
    };
    const taskContext = await this.config.taskContextManager.getTaskContext(taskId, connection);
    
    if (!taskContext) {
      throw new AgentCommError(
        'Task not found',
        'RESOURCE_NOT_FOUND',
        { uri, agent, taskId }
      );
    }

    const taskName = this.extractTaskName(taskId);
    
    return {
      uri,
      name: `Task: ${taskName}`,
      mimeType: 'application/json',
      description: `Task for ${agent}`,
      size: JSON.stringify(taskContext).length,
      lastModified: new Date().toISOString()
    };
  }

  /**
   * Search for task resources
   */
  async searchResources(query: string): Promise<Resource[]> {
    const allResources = await this.listResources();
    const lowerQuery = query.toLowerCase();
    
    return allResources.filter(resource => 
      resource.uri.toLowerCase().includes(lowerQuery) ||
      resource.name.toLowerCase().includes(lowerQuery) ||
      resource.description?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Parse task URI to extract agent and task ID
   */
  private parseTaskUri(uri: string): { agent: string; taskId: string } {
    // Expected format: agent://[agent]/tasks/[taskId]
    const match = uri.match(/^agent:\/\/([^/]+)\/tasks\/(.+)$/);
    
    if (!match) {
      throw new AgentCommError(
        'Invalid task resource URI',
        'INVALID_PARAMS',
        { uri, expectedFormat: 'agent://[agent]/tasks/[taskId]' }
      );
    }

    return {
      agent: match[1],
      taskId: match[2]
    };
  }

  /**
   * Extract readable task name from task ID
   */
  private extractTaskName(taskId: string): string {
    // Remove timestamp prefix if present (format: YYYY-MM-DDTHH-mm-ss-task-name)
    const match = taskId.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)$/);
    if (match) {
      return match[1];
    }
    return taskId;
  }
}