/**
 * Check tasks tool for the Agent Communication MCP Server
 * Context-based approach: Works with task IDs and content only
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager } from '../core/TaskContextManager.js';
import { validateRequiredString } from '../utils/validation.js';
import { validateAgentName } from '../utils/file-system.js';
import debug from 'debug';


const log = debug('agent-comm:tools:checktasks');
export interface CheckTasksResponse {
  tasks: {
    taskId: string;
    title: string;
    status: 'new' | 'in_progress' | 'completed' | 'error';
    progress?: {
      completed: number;
      inProgress: number;
      pending: number;
    };
  }[];
  totalCount: number;
  newCount: number;
  activeCount: number;
  message: string;
}

/**
 * Check for tasks assigned to an agent
 * Context-based approach - no file paths exposed
 */
export async function checkTasks(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<CheckTasksResponse> {
  log('checkTasks called with args: %O', { config, args });

  let agent: string;
  try {
    agent = validateRequiredString(args['agent'], 'agent');
    validateAgentName(agent);
  } catch (error) {
    // Log validation errors with ErrorLogger
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'validation',
        operation: 'check_tasks',
        agent: args['agent'] as string || 'unknown',
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'ValidationError',
          code: undefined
        },
        context: {
          tool: 'check-tasks',
          parameters: { agent: args['agent'] }
        },
        severity: 'medium'
      });
    }
    throw error;
  }

  // connectionManager and eventLogger are guaranteed by ServerConfig type

  // Create mock connection for the agent
  const connection = {
    id: `check-tasks-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agent,
    startTime: new Date(),
    metadata: { operation: 'check-tasks' }
  };

  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  try {
    const tasks = await contextManager.checkAssignedTasks(connection);

    const newCount = tasks.filter(t => t.status === 'new').length;
    const activeCount = tasks.filter(t => t.status === 'in_progress').length;

    return {
      tasks,
      totalCount: tasks.length,
      newCount,
      activeCount,
      message: tasks.length === 0 ?
        'No tasks currently assigned to this agent. Check with other team members or wait for new task assignments.' :
        `Found ${tasks.length} assigned task${tasks.length === 1 ? '' : 's'}.`
    };
  } catch (error) {
    // Log runtime errors with ErrorLogger
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'check_tasks',
        agent,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Error',
          code: error instanceof Error && 'code' in error ? String((error as Error & { code?: unknown }).code) : undefined
        },
        context: {
          tool: 'check-tasks',
          parameters: { agent }
        },
        severity: 'medium'
      });
    }

    // Handle specific error cases
    if (error instanceof Error) {
      // Check for agent directory not found
      if (error.message.includes('Agent directory not found') ||
          error.message.includes('does not exist')) {
        // Return empty result instead of throwing
        return {
          tasks: [],
          totalCount: 0,
          newCount: 0,
          activeCount: 0,
          message: `No tasks found for agent: ${agent}`
        };
      }

      // Check for task parsing failures
      if (error.message.includes('parse') ||
          error.message.includes('Invalid')) {
        // Log but continue with empty tasks
        log('Task parsing error: %s', error.message);
        return {
          tasks: [],
          totalCount: 0,
          newCount: 0,
          activeCount: 0,
          message: `Unable to parse tasks for agent: ${agent}`
        };
      }
    }

    // Re-throw other errors
    throw error;
  }
}