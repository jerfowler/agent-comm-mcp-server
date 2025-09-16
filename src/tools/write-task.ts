/**
 * Write task tool for the Agent Communication MCP Server
 */

import * as path from 'path';
import { ServerConfig, WriteTaskResponse } from '../types.js';
import { writeFile, ensureDirectory } from '../utils/file-system.js';
import { validateRequiredString, validateContent } from '../utils/validation.js';
import { LockManager } from '../utils/lock-manager.js';
import debug from 'debug';


const log = debug('agent-comm:tools:writetask');
/**
 * Write a task file by type (plan, done, error)
 */
export async function writeTask(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<WriteTaskResponse> {
  log('writeTask called with args: %O', { config, args });
  const agent = validateRequiredString(args['agent'], 'agent');
  const task = validateRequiredString(args['task'], 'task');

  // Validate file type with enhanced error logging
  const fileTypeArg = args['file'];
  if (typeof fileTypeArg !== 'string' || !['PLAN', 'DONE', 'ERROR'].includes(fileTypeArg)) {
    // Log invalid file type error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'write_task',
        agent,
        taskId: task,
        error: {
          message: `Invalid file type: ${String(fileTypeArg)}. Must be one of: PLAN, DONE, ERROR`,
          name: 'ValidationError',
          code: undefined
        },
        context: {
          tool: 'write_task',
          parameters: {
            invalidFileType: String(fileTypeArg),
            allowedTypes: ['PLAN', 'DONE', 'ERROR']
          }
        },
        severity: 'high'
      });
    }
    const error = new Error(`Invalid file type: ${String(fileTypeArg)}. Must be one of: PLAN, DONE, ERROR`);
    error.name = 'ValidationError';
    throw error;
  }

  const fileType = fileTypeArg as 'PLAN' | 'DONE' | 'ERROR';
  const content = validateRequiredString(args['content'], 'content');
  
  validateContent(content);
  
  const taskDir = path.join(config.commDir, agent, task);
  await ensureDirectory(taskDir);

  const fileName = `${fileType}.md`;
  const filePath = path.join(taskDir, fileName);

  // Use LockManager for proper concurrent write protection
  const lockManager = new LockManager();
  const toolName = `write-${fileType}`;

  try {
    // Acquire lock for file write operation
    const lockResult = await lockManager.acquireLock(taskDir, toolName);

    if (!lockResult.acquired || !lockResult.lockId) {
      throw new Error(`Failed to acquire lock for ${fileType} file write: ${lockResult.reason ?? 'Unknown reason'}`);
    }

    try {
      await writeFile(filePath, content);
    } finally {
      // Always release lock
      await lockManager.releaseLock(taskDir, lockResult.lockId);
    }
  } catch (error) {
    // Check if this is a lock acquisition error (concurrent write)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Lock acquisition timeout') || errorMessage.includes('file is being written')) {
      // Log concurrent write conflict
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'runtime',
          operation: 'write_task',
          agent,
          taskId: task,
          error: {
            message: errorMessage,
            name: error instanceof Error ? error.name : 'Error',
            code: (error as NodeJS.ErrnoException)?.code
          },
          context: {
            tool: 'write_task',
            parameters: {
              operation: 'lock_acquisition',
              fileType,
              concurrentWrite: true,
              lockHeld: true
            }
          },
          severity: 'high'
        });
      }
      throw error;
    }
    // Log file write error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'write_task',
        agent,
        taskId: task,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'WriteError',
          code: (error as NodeJS.ErrnoException)?.code
        },
        context: {
          tool: 'write_task',
          parameters: (() => {
            const baseParams = {
              operation: 'write',
              fileType,
              bytesAttempted: Buffer.byteLength(content, 'utf8')
            };

            if ((error as NodeJS.ErrnoException)?.code === 'ENOSPC') {
              // Disk space error: diskSpace + syscall + errorCode (no permissions)
              return {
                ...baseParams,
                diskSpace: true,
                syscall: (error as NodeJS.ErrnoException).syscall,
                errorCode: (error as NodeJS.ErrnoException).code
              };
            } else if ((error as NodeJS.ErrnoException)?.code === 'EACCES') {
              // Permission error: permissions + syscall + errorCode (no diskSpace)
              return {
                ...baseParams,
                permissions: true,
                syscall: (error as NodeJS.ErrnoException).syscall,
                errorCode: (error as NodeJS.ErrnoException).code
              };
            } else {
              // Generic error: only permissions false (no diskSpace, no syscall, no errorCode)
              return {
                ...baseParams,
                permissions: false
              };
            }
          })()
        },
        severity: 'high'
      });
    }
    throw error;
  }

  return {
    success: true,
    bytesWritten: Buffer.byteLength(content, 'utf8')
  };
}