/**
 * Get task context tool - Context retrieval without file exposure
 * Returns pure context for specified or current task
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager, TaskContext } from '../core/TaskContextManager.js';
import { validateOptionalString, validateRequiredConfig } from '../utils/validation.js';
import debug from 'debug';

const log = debug('agent-comm:tools:get-task-context');

/**
 * Get task context without exposing file operations
 */
export async function getTaskContext(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<TaskContext> {
  log('getTaskContext called with args: %O', { config, args });

  try {
    // Validate configuration has required components
    validateRequiredConfig(config);

    const taskId = validateOptionalString(args['taskId'], 'taskId') ?? '';
    const agent = validateOptionalString(args['agent'], 'agent');

    // Require explicit agent specification - no default fallback
    if (!agent || agent.trim() === '') {
      const error = new Error("Agent name is required. Please specify the agent performing this operation.");
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'validation',
          operation: 'get_task_context',
          agent: 'unknown',
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack
          },
          context: {
            tool: 'get-task-context',
            parameters: {
              taskId: args['taskId'],
              agent: args['agent']
            }
          },
          severity: 'medium'
        });
      }
      throw error;
    }

    // Create connection for the agent
    const connection = {
      id: `get-context-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agent,
      startTime: new Date(),
      metadata: { operation: 'get-task-context', taskId }
    };

    const contextManager = new TaskContextManager({
      commDir: config.commDir,
      connectionManager: config.connectionManager,
      eventLogger: config.eventLogger
    });

    log('Retrieving task context for taskId: %s, agent: %s', taskId, agent);
    const result = await contextManager.getTaskContext(taskId, connection);
    log('Task context retrieved successfully');

    return result;
  } catch (error) {
    // Log context retrieval errors
    if (config.errorLogger && error instanceof Error && !error.message.includes('Agent name is required')) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let source: 'validation' | 'tool_execution' | 'runtime' | 'network' | 'mcp_server' = 'tool_execution';

      // Determine severity based on error type
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        severity = 'low'; // Task not found is common, low severity
        source = 'tool_execution';
      } else if (error.message.includes('parse') || error.message.includes('assembly') || error.message.includes('Failed to')) {
        severity = 'high'; // Context assembly errors are more serious
        source = 'tool_execution';
      } else if (error.message.includes('Configuration missing') || error.message.includes('required components')) {
        severity = 'high'; // Configuration errors
        source = 'validation';
      }

      await config.errorLogger.logError({
        timestamp: new Date(),
        source,
        operation: 'get_task_context',
        agent: args['agent'] as string ?? 'unknown',
        error: {
          message: error.message,
          name: error.name || 'Error',
          stack: error.stack
        },
        context: {
          tool: 'get-task-context',
          parameters: {
            taskId: args['taskId'],
            agent: args['agent']
          }
        },
        severity
      });
    }

    throw error;
  }
}