/**
 * Read task tool for the Agent Communication MCP Server
 */

import * as path from 'path';
import { ServerConfig, ReadTaskResponse } from '../types.js';
import { readFile, getStats, parseTaskMetadata } from '../utils/file-system.js';
import { validateRequiredString, validateTaskFileType } from '../utils/validation.js';
import debug from 'debug';


const log = debug('agent-comm:tools:readtask');
/**
 * Read a task file by type (init, plan, done, error)
 */
export async function readTask(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<ReadTaskResponse> {
  log('readTask called with args: %O', { config, args });

  let agent: string;
  let task: string;
  let fileType: string;

  try {
    agent = validateRequiredString(args['agent'], 'agent');
    task = validateRequiredString(args['task'], 'task');
    fileType = validateTaskFileType(args['file']);
  } catch (error) {
    // Log validation errors with ErrorLogger
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'validation',
        operation: 'read_task',
        agent: args['agent'] as string || 'unknown',
        taskId: args['task'] as string,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'ValidationError',
          code: undefined
        },
        context: {
          tool: 'read-task',
          parameters: {
            agent: args['agent'],
            task: args['task'],
            file: args['file']
          }
        },
        severity: 'medium'
      });
    }
    throw error;
  }

  const fileName = `${fileType}.md`;
  const filePath = path.join(config.commDir, agent, task, fileName);

  try {
    const content = await readFile(filePath);
    const stats = await getStats(filePath);
    const metadata = parseTaskMetadata(content);

    return {
      content,
      lastModified: stats.mtime,
      ...(metadata && { metadata })
    };
  } catch (error) {
    // Log file read errors with ErrorLogger
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'read_task',
        agent,
        taskId: task,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Error',
          code: error instanceof Error && 'code' in error ? String((error as Error & { code?: unknown }).code) : undefined
        },
        context: {
          tool: 'read-task',
          parameters: { agent, task, file: fileType }
        },
        severity: 'medium'
      });
    }

    // Re-throw the error
    throw error;
  }
}