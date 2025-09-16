/**
 * Restore tasks tool for the Agent Communication MCP Server
 */

import { ServerConfig, RestoreResult } from '../types.js';
import { restoreTasks } from '../utils/task-manager.js';
import { validateRequiredString, validateOptionalString } from '../utils/validation.js';
import debug from 'debug';

const log = debug('agent-comm:tools:restore-tasks');

/**
 * Restore tasks from archive
 */
export async function restoreTasksTool(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<RestoreResult> {
  log('restoreTasksTool called with args: %O', { config, args });

  try {
    const timestamp = validateRequiredString(args['timestamp'], 'timestamp');

    // Validate timestamp format (basic check) before processing other params
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(timestamp)) {
      const error = new Error('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'validation',
          operation: 'restore_tasks',
          agent: 'unknown',
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack
          },
          context: {
            tool: 'restore-tasks',
            parameters: {
              timestamp: args['timestamp']
            }
          },
          severity: 'high'
        });
      }
      throw error;
    }

    const agent = validateOptionalString(args['agent'], 'agent');
    const taskName = validateOptionalString(args['taskName'], 'taskName');

    log('Executing restore with timestamp: %s, agent: %s, taskName: %s', timestamp, agent, taskName);
    const result = await restoreTasks(config, timestamp, agent, taskName);
    log('Restore completed successfully: %O', result);

    return result;
  } catch (error) {
    // Log different types of errors with appropriate severity
    if (config.errorLogger && error instanceof Error) {
      // Don't double-log timestamp validation errors
      if (!error.message.includes('Invalid timestamp format')) {
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        let source: 'validation' | 'tool_execution' | 'runtime' | 'network' | 'mcp_server' = 'tool_execution';

        // Determine severity and source based on error type
        if (error.message.includes('ENOENT') || error.message.includes('not found')) {
          severity = 'medium'; // Archive not found is common
          source = 'tool_execution';
        } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
          severity = 'high'; // Permission errors are more serious
          source = 'tool_execution';
        } else if (error.message.includes('must be')) {
          severity = 'medium'; // Validation errors
          source = 'validation';
        } else if (error.message.includes('conflict') || error.message.includes('exists')) {
          severity = 'medium'; // Restore conflicts
          source = 'tool_execution';
        }

        await config.errorLogger.logError({
          timestamp: new Date(),
          source,
          operation: 'restore_tasks',
          agent: args['agent'] as string ?? 'unknown',
          error: {
            message: error.message,
            name: error.name || 'Error',
            stack: error.stack
          },
          context: {
            tool: 'restore-tasks',
            parameters: {
              timestamp: args['timestamp'],
              agent: args['agent'],
              taskName: args['taskName']
            }
          },
          severity
        });
      }
    }

    throw error;
  }
}