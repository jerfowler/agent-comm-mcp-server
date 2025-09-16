/**
 * track_task_progress Tool
 * 
 * Real-time progress monitoring tool that provides current task status
 * and detailed progress metrics based on plan step completion
 */

import { pathExists, readFile } from '../utils/file-system.js';
import { stat } from '../utils/fs-extra-safe.js';
import path from 'path';
import { validateRequiredString } from '../utils/validation.js';
import { TrackTaskProgressArgs, TrackTaskProgressResult, ServerConfig } from '../types.js';
import debug from 'debug';


const log = debug('agent-comm:tools:tracktaskprogress');
export async function trackTaskProgress(
  config: ServerConfig,
  args: TrackTaskProgressArgs
): Promise<TrackTaskProgressResult> {
  log('trackTaskProgress called with args: %O', { config, args });

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
        operation: 'track_task_progress',
        agent: args.agent ?? undefined,
        taskId: args.taskId ?? undefined,
        error: {
          message: (error as Error).message,
          name: 'ValidationError',
          code: undefined
        },
        context: {
          tool: 'track_task_progress',
          parameters: {
            agent: args.agent ?? undefined,
            taskId: args.taskId ?? undefined
          }
        },
        severity: 'low'
      });
    }
    throw error;
  }

  const taskPath = path.join(config.commDir, args.agent, args.taskId);
  
  // Initialize result structure
  const result: TrackTaskProgressResult = {
    taskId: args.taskId,
    status: 'pending',
    progress: {
      total_steps: 0,
      completed_steps: 0,
      percentage: 0
    },
    last_updated: new Date().toISOString()
  };

  // Check if task directory exists
  if (!await pathExists(taskPath)) {
    // Log task not found error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'track_task_progress',
        agent: args.agent,
        taskId: args.taskId,
        error: {
          message: `Task not found: ${args.taskId}`,
          name: 'TaskNotFoundError',
          code: undefined
        },
        context: {
          tool: 'track_task_progress',
          parameters: {
            agent: args.agent,
            taskId: args.taskId
          }
        },
        severity: 'low'
      });
    }
    return result;
  }

  // Define file paths
  const donePath = path.join(taskPath, 'DONE.md');
  const errorPath = path.join(taskPath, 'ERROR.md');
  const planPath = path.join(taskPath, 'PLAN.md');

  try {
    // Check completion status first

    if (await pathExists(donePath)) {
      result.status = 'completed';
      const stats = await stat(donePath);
      result.last_updated = stats.mtime.toISOString();
    } else if (await pathExists(errorPath)) {
      result.status = 'error';
      const stats = await stat(errorPath);
      result.last_updated = stats.mtime.toISOString();
    } else if (await pathExists(planPath)) {
      result.status = 'in_progress';
      const stats = await stat(planPath);
      result.last_updated = stats.mtime.toISOString();
    } else {
      // Only INIT file exists or task just created
      const initPath = path.join(taskPath, 'INIT.md');
      if (await pathExists(initPath)) {
        const stats = await stat(initPath);
        result.last_updated = stats.mtime.toISOString();
      }
    }
  } catch (error) {
    // Log stat operation error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'track_task_progress',
        agent: args.agent,
        taskId: args.taskId,
        error: {
          message: (error as Error).message,
          name: (error as Error).name || 'Error',
          code: (error as Error & { code?: string })?.code
        },
        context: {
          tool: 'track_task_progress',
          parameters: {
            agent: args.agent,
            taskId: args.taskId
          }
        },
        severity: 'low'
      });
    }
    throw error;
  }

  // Parse progress from PLAN.md if it exists
  if (await pathExists(planPath)) {
    try {
      const planContent = await readFile(planPath);
      const progressInfo = await parseProgressFromPlan(planContent, config, args.agent, args.taskId);

      result.progress = {
        total_steps: progressInfo.totalSteps,
        completed_steps: progressInfo.completedSteps,
        percentage: progressInfo.percentage,
        ...(progressInfo.currentStep && { current_step: progressInfo.currentStep })
      };

      // If no checkboxes found, log warning
      if (progressInfo.totalSteps === 0) {
        if (config.errorLogger) {
          await config.errorLogger.logError({
            timestamp: new Date(),
            source: 'tool_execution',
            operation: 'track_task_progress',
            agent: args.agent,
            taskId: args.taskId,
            error: {
              message: 'No checkboxes found in PLAN.md',
              name: 'NoProgressMarkersWarning',
              code: undefined
            },
            context: {
              tool: 'track_task_progress',
              parameters: {
                file: 'PLAN.md'
              }
            },
            severity: 'low'
          });
        }
      }
    } catch (error) {
      // Log read error
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'runtime',
          operation: 'track_task_progress',
          agent: args.agent,
          taskId: args.taskId,
          error: {
            message: (error as Error).message,
            name: (error as Error).name || 'Error',
            code: (error as Error & { code?: string })?.code
          },
          context: {
            tool: 'track_task_progress',
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
  } else {
    // PLAN.md not found
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'track_task_progress',
        agent: args.agent,
        taskId: args.taskId,
        error: {
          message: 'PLAN.md not found',
          name: 'PlanNotFoundError',
          code: undefined
        },
        context: {
          tool: 'track_task_progress',
          parameters: {
            agent: args.agent,
            taskId: args.taskId
          }
        },
        severity: 'low'
      });
    }
  }

  return result;
}

interface ProgressInfo {
  totalSteps: number;
  completedSteps: number;
  percentage: number;
  currentStep?: string;
}

async function parseProgressFromPlan(
  planContent: string,
  config: ServerConfig,
  agent: string,
  taskId: string
): Promise<ProgressInfo> {
  const lines = planContent.split('\n');
  let totalSteps = 0;
  let completedSteps = 0;
  let currentStep: string | undefined;

  for (const line of lines) {
    // Match checkbox patterns (standard markdown checkboxes)
    const checkedMatch = line.match(/^\s*-\s*\[x\]\s+(.+)$/i);
    const uncheckedMatch = line.match(/^\s*-\s*\[\s*\]\s+(.+)$/);

    // Also match progress marker patterns for backward compatibility
    const completeMatch = line.match(/^\d+\.\s*\[✓\s*COMPLETE\]\s*(.+)$/);
    const inProgressMatch = line.match(/^\d+\.\s*\[→\s*IN PROGRESS\]\s*(.+)$/);
    const pendingMatch = line.match(/^\d+\.\s*\[(?:PENDING|BLOCKED)\]\s*(.+)$/);

    if (checkedMatch || completeMatch) {
      totalSteps++;
      completedSteps++;
    } else if (uncheckedMatch || pendingMatch) {
      totalSteps++;
    } else if (inProgressMatch) {
      totalSteps++;
      currentStep = inProgressMatch[1].trim();
    } else if (line.match(/^\s*-\s*\[.+\]/)) {
      // Found a malformed checkbox - log warning
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'tool_execution',
          operation: 'track_task_progress',
          agent,
          taskId,
          error: {
            message: `Malformed checkbox: ${line.trim()}`,
            name: 'CheckboxParsingWarning',
            code: undefined
          },
          context: {
            tool: 'track_task_progress',
            parameters: {
              malformedLine: line.trim()
            }
          },
          severity: 'low'
        });
      }
    }
  }

  // Calculate percentage
  let percentage = 0;
  if (totalSteps > 0) {
    percentage = Math.round((completedSteps / totalSteps) * 100);
  }

  return {
    totalSteps,
    completedSteps,
    percentage,
    ...(currentStep && { currentStep })
  };
}