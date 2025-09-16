/**
 * List agents tool for the Agent Communication MCP Server
 */

import { ServerConfig, ListAgentsResponse } from '../types.js';
import { getAllAgents } from '../utils/task-manager.js';
import debug from 'debug';


const log = debug('agent-comm:tools:listagents');
/**
 * List all agents with task counts
 */
export async function listAgents(
  config: ServerConfig
): Promise<ListAgentsResponse> {
  log('listAgents called with config');

  try {
    const agents = await getAllAgents(config);

    const totalTasks = agents.reduce((sum, agent) => sum + agent.taskCount, 0);

    return {
      agents,
      totalAgents: agents.length,
      totalTasks
    };
  } catch (error) {
    // Log error if ErrorLogger is configured
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'list_agents',
        agent: 'system',
        error: {
          message: error instanceof Error ? error.message : 'Failed to list agents',
          name: error instanceof Error ? error.name : 'Error',
          code: error instanceof Error && 'code' in error ? String((error as Error & { code?: unknown }).code) : undefined
        },
        context: {
          tool: 'list_agents',
          parameters: {
            operation: 'scan_directories',
            path: config.commDir
          }
        },
        severity: 'low'
      });
    }

    // Re-throw the error to maintain existing behavior
    throw error;
  }
}