/**
 * get_full_lifecycle Tool
 * 
 * Diagnostic tool that provides complete visibility into task lifecycle
 * Returns comprehensive lifecycle information including progress analysis
 */

import * as fileSystem from '../utils/file-system.js';
import path from 'path';
import { validateRequiredString } from '../utils/validation.js';
import { GetFullLifecycleArgs, GetFullLifecycleResult, ServerConfig, ProgressMarkers } from '../types.js';
import debug from 'debug';


const log = debug('agent-comm:tools:getfulllifecycle');
export async function getFullLifecycle(
  config: ServerConfig,
  args: GetFullLifecycleArgs
): Promise<GetFullLifecycleResult> {
  log('getFullLifecycle called with args: %O', { config, args });

  try {
    // Validate parameters
    validateRequiredString(args.agent, 'agent');
    validateRequiredString(args.taskId, 'taskId');
  } catch (error) {
    // Log validation errors
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'validation',
        operation: 'get_full_lifecycle',
        agent: args.agent ?? undefined,
        taskId: args.taskId ?? undefined,
        error: {
          message: (error as Error).message,
          name: 'ValidationError',
          code: undefined
        },
        context: {
          tool: 'get_full_lifecycle',
          parameters: {
            agent: args.agent ?? undefined,
            taskId: args.taskId ?? undefined,
            include_progress: args.include_progress
          }
        },
        severity: 'low'
      });
    }
    throw error;
  }

  // Set defaults
  const includeProgress = args.include_progress !== false; // Default: true

  const taskPath = path.join(config.commDir, args.agent, args.taskId);
  
  // Initialize result structure
  const result: GetFullLifecycleResult = {
    taskId: args.taskId,
    agent: args.agent,
    lifecycle: {
      init: { exists: false },
      plan: { exists: false },
      outcome: { type: 'pending' }
    },
    summary: {
      final_status: 'error'
    }
  };

  // Check if task directory exists
  if (!await fileSystem.pathExists(taskPath)) {
    // Log task not found error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'get_full_lifecycle',
        agent: args.agent,
        taskId: args.taskId,
        error: {
          message: `Task not found: ${args.taskId}`,
          name: 'TaskNotFoundError',
          code: undefined
        },
        context: {
          tool: 'get_full_lifecycle',
          parameters: {
            agent: args.agent,
            taskId: args.taskId,
            include_progress: includeProgress
          }
        },
        severity: 'low'
      });
    }
    return result;
  }

  let initTime: Date | undefined;
  let completionTime: Date | undefined;

  try {
    // Check INIT.md file
    const initPath = path.join(taskPath, 'INIT.md');
    if (await fileSystem.pathExists(initPath)) {
      result.lifecycle.init.exists = true;
      result.lifecycle.init.content = await fileSystem.readFile(initPath);
      const stats = await fileSystem.getStats(initPath);
      result.lifecycle.init.created_at = stats.mtime.toISOString();
      initTime = stats.mtime;
      result.summary.final_status = 'new';
    }
  } catch (error) {
    // Log file read error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'get_full_lifecycle',
        agent: args.agent,
        taskId: args.taskId,
        error: {
          message: (error as Error).message,
          name: (error as Error).name || 'Error',
          code: (error as Error & { code?: string })?.code
        },
        context: {
          tool: 'get_full_lifecycle',
          parameters: {
            agent: args.agent,
            taskId: args.taskId,
            file: 'INIT.md'
          }
        },
        severity: 'low'
      });
    }
    throw error;
  }

  try {
    // Check PLAN.md file
    const planPath = path.join(taskPath, 'PLAN.md');
    if (await fileSystem.pathExists(planPath)) {
      result.lifecycle.plan.exists = true;
      result.lifecycle.plan.content = await fileSystem.readFile(planPath);
      const stats = await fileSystem.getStats(planPath);
      result.lifecycle.plan.last_updated = stats.mtime.toISOString();
      result.summary.final_status = 'in_progress';

      // Parse progress markers if requested
      if (includeProgress) {
        try {
          result.lifecycle.plan.progress_markers = parseProgressMarkers(
            result.lifecycle.plan.content
          );
        } catch (parseError) {
          // Log parsing warning but continue
          if (config.errorLogger) {
            await config.errorLogger.logError({
              timestamp: new Date(),
              source: 'tool_execution',
              operation: 'get_full_lifecycle',
              agent: args.agent,
              taskId: args.taskId,
              error: {
                message: `Progress marker parsing warning: ${(parseError as Error).message}`,
                name: 'ProgressParsingWarning',
                code: undefined
              },
              context: {
                tool: 'get_full_lifecycle',
                parameters: {
                  file: 'PLAN.md'
                }
              },
              severity: 'low'
            });
          }
          // Continue with empty progress markers
          result.lifecycle.plan.progress_markers = {
            completed: [],
            pending: []
          };
        }
      }
    }
  } catch (error) {
    // Log file read error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'get_full_lifecycle',
        agent: args.agent,
        taskId: args.taskId,
        error: {
          message: (error as Error).message,
          name: (error as Error).name || 'Error',
          code: (error as Error & { code?: string })?.code
        },
        context: {
          tool: 'get_full_lifecycle',
          parameters: {
            agent: args.agent,
            taskId: args.taskId,
            file: 'PLAN.md'
          }
        },
        severity: 'low'
      });
    }
    throw error;
  }

  try {
    // Check for completion files (done or error)
    const donePath = path.join(taskPath, 'DONE.md');
    const errorPath = path.join(taskPath, 'ERROR.md');

    if (await fileSystem.pathExists(donePath)) {
      result.lifecycle.outcome.type = 'done';
      result.lifecycle.outcome.content = await fileSystem.readFile(donePath);
      const stats = await fileSystem.getStats(donePath);
      result.lifecycle.outcome.completed_at = stats.mtime.toISOString();
      completionTime = stats.mtime;
      result.summary.final_status = 'completed';
    } else if (await fileSystem.pathExists(errorPath)) {
      result.lifecycle.outcome.type = 'error';
      result.lifecycle.outcome.content = await fileSystem.readFile(errorPath);
      const stats = await fileSystem.getStats(errorPath);
      result.lifecycle.outcome.completed_at = stats.mtime.toISOString();
      completionTime = stats.mtime;
      result.summary.final_status = 'error';
    }
  } catch (error) {
    // Log file read error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'get_full_lifecycle',
        agent: args.agent,
        taskId: args.taskId,
        error: {
          message: (error as Error).message,
          name: (error as Error).name || 'Error',
          code: (error as Error & { code?: string })?.code
        },
        context: {
          tool: 'get_full_lifecycle',
          parameters: {
            agent: args.agent,
            taskId: args.taskId,
            file: 'DONE.md/ERROR.md'
          }
        },
        severity: 'low'
      });
    }
    throw error;
  }

  // Calculate summary metrics
  if (initTime && completionTime) {
    result.summary.duration_seconds = (completionTime.getTime() - initTime.getTime()) / 1000;
  }

  // Calculate progress percentage
  if (result.lifecycle.plan.progress_markers) {
    const markers = result.lifecycle.plan.progress_markers;
    const totalSteps = markers.completed.length + markers.pending.length + (markers.in_progress ? 1 : 0);
    
    if (totalSteps > 0) {
      result.summary.progress_percentage = Math.round((markers.completed.length / totalSteps) * 100);
    } else if (result.lifecycle.outcome.type === 'done') {
      result.summary.progress_percentage = 100;
    } else {
      result.summary.progress_percentage = 0;
    }
  } else {
    // Fallback progress calculation
    if (result.lifecycle.outcome.type === 'done') {
      result.summary.progress_percentage = 100;
    } else if (result.lifecycle.plan.exists) {
      result.summary.progress_percentage = 50; // Has plan but not completed
    } else if (result.lifecycle.init.exists) {
      result.summary.progress_percentage = 0; // Only initialized
    } else {
      result.summary.progress_percentage = 0;
    }
  }

  return result;
}

function parseProgressMarkers(planContent: string): ProgressMarkers {
  const markers: ProgressMarkers = {
    completed: [],
    pending: []
  };

  const lines = planContent.split('\n');
  const invalidMarkers: string[] = [];

  for (const line of lines) {
    // Match progress marker patterns
    const completeMatch = line.match(/^\d+\.\s*\[✓\s*COMPLETE\]\s*(.+)$/);
    const inProgressMatch = line.match(/^\d+\.\s*\[→\s*IN PROGRESS\]\s*(.+)$/);
    const pendingMatch = line.match(/^\d+\.\s*\[(?:PENDING|BLOCKED)\]\s*(.+)$/);

    if (completeMatch) {
      markers.completed.push(completeMatch[1].trim());
    } else if (inProgressMatch) {
      markers.in_progress = inProgressMatch[1].trim();
    } else if (pendingMatch) {
      markers.pending.push(pendingMatch[1].trim());
    } else if (line.match(/^\d+\.\s*\[.*\]/)) {
      // Found a marker pattern but it's invalid - collect for warning
      const invalidMarker = line.match(/\[([^\]]*)\]/);
      if (invalidMarker && invalidMarker[1] !== '✓ COMPLETE' &&
          invalidMarker[1] !== '→ IN PROGRESS' &&
          invalidMarker[1] !== 'PENDING' &&
          invalidMarker[1] !== 'BLOCKED') {
        invalidMarkers.push(`[${invalidMarker[1]}]`);
      }
    }
  }

  // If we found invalid markers, throw an error with all of them
  if (invalidMarkers.length > 0) {
    throw new Error(`Invalid progress marker(s) found: ${invalidMarkers.join(', ')}`);
  }

  return markers;
}