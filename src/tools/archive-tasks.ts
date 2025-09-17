/**
 * Archive tasks tool for the Agent Communication MCP Server
 */

import debug from 'debug';
import { ServerConfig, ArchiveResult, ArchiveOptions } from '../types.js';
import { archiveTasks } from '../utils/task-manager.js';
import {
  validateArchiveMode,
  validateOptionalString,
  validateNumber,
  validateBoolean
} from '../utils/validation.js';

const log = debug('agent-comm:tools:archive-tasks');

/**
 * Archive tasks (clear comms functionality)
 */
export async function archiveTasksTool(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<ArchiveResult> {
  log('archiveTasksTool called with args: %O', { config, args });

  try {
    const mode = validateArchiveMode(args['mode'] || 'completed');
    const agent = validateOptionalString(args['agent'], 'agent');
    const dryRun = validateBoolean(args['dryRun'], 'dryRun', false);

    let olderThan: number | undefined;
    if (args['olderThan'] !== undefined) {
      olderThan = validateNumber(args['olderThan'], 'olderThan', 1);
    }

    // Validate mode-specific parameters
    if (mode === 'by-agent' && !agent) {
      const error = new Error('Agent name is required for by-agent mode');
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'validation',
          operation: 'archive_tasks',
          agent: agent ?? 'unknown',
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack
          },
          context: {
            tool: 'archive-tasks',
            parameters: {
              mode,
              agent
            }
          },
          severity: 'high'
        });
      }
      throw error;
    }

    if (mode === 'by-date' && olderThan === undefined) {
      const error = new Error('olderThan parameter is required for by-date mode');
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'validation',
          operation: 'archive_tasks',
          agent: agent ?? 'unknown',
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack
          },
          context: {
            tool: 'archive-tasks',
            parameters: {
              mode,
              olderThan
            }
          },
          severity: 'high'
        });
      }
      throw error;
    }

    const options: ArchiveOptions = {
      mode,
      dryRun,
      ...(agent && { agent }),
      ...(olderThan && { olderThan })
    };

    log('Executing archive with options: %O', options);
    const result = await archiveTasks(config, options);
    log('Archive completed successfully: %O', result);

    return result;
  } catch (error) {
    // Log validation errors that bubble up from validation functions
    if (config.errorLogger && error instanceof Error) {
      // Determine error source and context
      const isValidationError = error.message.includes('archive mode') ||
                               error.message.includes('must be') ||
                               error.message.includes('is required');

      const isTaskManagerError = !isValidationError && !error.message.includes('is required for');

      if (isValidationError || isTaskManagerError) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: isValidationError ? 'validation' : 'tool_execution',
          operation: 'archive_tasks',
          agent: args['agent'] as string ?? 'unknown',
          error: {
            message: error.message,
            name: error.name || 'Error',
            stack: error.stack
          },
          context: {
            tool: 'archive-tasks',
            parameters: {
              mode: args['mode'] ?? 'completed',
              dryRun: args['dryRun'] ?? false,
              agent: args['agent'],
              olderThan: args['olderThan']
            }
          },
          severity: 'high'
        });
      }
    }

    throw error;
  }
}