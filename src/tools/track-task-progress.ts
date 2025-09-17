/**
 * track_task_progress Tool
 *
 * Real-time progress monitoring tool that provides current task status
 * and detailed progress metrics based on plan step completion
 * Enhanced with stepCount metadata usage (Issue #60)
 */

import { pathExists, readFile } from '../utils/file-system.js';
import * as fs from '../utils/fs-extra-safe.js';
import { stat } from '../utils/fs-extra-safe.js';
import path from 'path';
import { validateRequiredString } from '../utils/validation.js';
import { TrackTaskProgressArgs, TrackTaskProgressResult, ServerConfig } from '../types.js';
import { parsePlanCheckboxes } from '../utils/plan-parser.js';
import { PlanMetadata } from '../types/plan-metadata.js';
import debug from 'debug';

const log = debug('agent-comm:tools:track-task-progress');
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
      const startTime = Date.now();
      const planContent = await readFile(planPath);

      // Try to use metadata for total step count (Issue #60)
      const metadataPath = path.join(taskPath, 'PLAN.metadata.json');
      let stepCountFromMetadata: number | undefined;
      let metadataSource: 'metadata' | 'parsing' = 'parsing';

      if (await pathExists(metadataPath)) {
        try {
          const metadata = await fs.readJSON(metadataPath) as PlanMetadata;
          stepCountFromMetadata = metadata.stepCount;
          metadataSource = 'metadata';
          log('Using cached stepCount from metadata: %d', stepCountFromMetadata);
        } catch (error) {
          log('Failed to read metadata, falling back to plan parsing: %s', (error as Error).message);
        }
      }

      const progressInfo = await parseProgressFromPlan(planContent, config, args.agent, args.taskId, stepCountFromMetadata);

      const validationTime = Date.now() - startTime;
      log('Progress tracking completed in %dms', validationTime);

      if (validationTime > 10) {
        log('PERFORMANCE WARNING: Progress tracking took %dms (>10ms threshold)', validationTime);
      }

      result.progress = {
        total_steps: progressInfo.totalSteps,
        completed_steps: progressInfo.completedSteps,
        percentage: progressInfo.percentage,
        ...(progressInfo.currentStep && { current_step: progressInfo.currentStep }),
        ...(progressInfo.inProgressSteps !== undefined && { in_progress_steps: progressInfo.inProgressSteps }),
        ...(progressInfo.pendingSteps !== undefined && { pending_steps: progressInfo.pendingSteps })
      };

      // Add metadata info to response
      if (metadataSource === 'metadata') {
        // Metadata info is already included in log output
      }

      // Add performance metrics if significant
      if (validationTime < 10) {
        // Performance metrics are already included in log output
      }

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
  inProgressSteps?: number;
  pendingSteps?: number;
}

async function parseProgressFromPlan(
  planContent: string,
  config: ServerConfig,
  agent: string,
  taskId: string,
  stepCountFromMetadata?: number
): Promise<ProgressInfo> {
  // Use metadata stepCount if available for efficiency (Issue #60)
  if (stepCountFromMetadata !== undefined) {
    log('Using stepCount from metadata for total: %d', stepCountFromMetadata);

    // Still need to parse to count completed/in-progress/pending
    const checkboxes = parsePlanCheckboxes(planContent);

    // Check for malformed checkboxes even when using metadata (maintain warning behavior)
    const lines = planContent.split('\n');
    for (const line of lines) {
      if (line.match(/^\s*-\s*\[.+\]/) && !line.match(/^\s*-\s*\[( +|x)\]\s+/)) {
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

    let completedSteps = 0;
    let inProgressSteps = 0;
    let pendingSteps = 0;
    let currentStep: string | undefined;

    for (const checkbox of checkboxes) {
      if (checkbox.checked) {
        completedSteps++;
      } else {
        // Check for in-progress marker (~)
        const line = planContent.split('\n')[checkbox.line - 1];
        if (line?.match(/^\s*-\s*\[~\]/)) {
          inProgressSteps++;
          currentStep = checkbox.content;
        } else {
          pendingSteps++;
        }
      }
    }

    const percentage = stepCountFromMetadata > 0
      ? Math.round((completedSteps / stepCountFromMetadata) * 100)
      : 0;

    return {
      totalSteps: stepCountFromMetadata,
      completedSteps,
      inProgressSteps,
      pendingSteps,
      percentage,
      ...(currentStep && { currentStep })
    };
  }

  // Fall back to line-by-line parsing if no metadata
  const lines = planContent.split('\n');
  let totalSteps = 0;
  let completedSteps = 0;
  let inProgressSteps = 0;
  let pendingSteps = 0;
  let currentStep: string | undefined;

  for (const line of lines) {
    // Match checkbox patterns (standard markdown checkboxes)
    const checkedMatch = line.match(/^\s*-\s*\[x\]\s+(.+)$/i);
    const uncheckedMatch = line.match(/^\s*-\s*\[\s*\]\s+(.+)$/);
    const inProgressCheckbox = line.match(/^\s*-\s*\[~\]\s+(.+)$/);

    // Also match progress marker patterns for backward compatibility
    const completeMatch = line.match(/^\d+\.\s*\[✓\s*COMPLETE\]\s*(.+)$/);
    const inProgressMatch = line.match(/^\d+\.\s*\[→\s*IN PROGRESS\]\s*(.+)$/);
    const pendingMatch = line.match(/^\d+\.\s*\[(?:PENDING|BLOCKED)\]\s*(.+)$/);

    if (checkedMatch || completeMatch) {
      totalSteps++;
      completedSteps++;
    } else if (inProgressCheckbox || inProgressMatch) {
      totalSteps++;
      inProgressSteps++;
      currentStep = (inProgressCheckbox?.[1] || inProgressMatch?.[1])?.trim();
    } else if (uncheckedMatch || pendingMatch) {
      totalSteps++;
      pendingSteps++;
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
    inProgressSteps,
    pendingSteps,
    percentage,
    ...(currentStep && { currentStep })
  };
}