/**
 * Report progress tool - Progress updates without file exposure
 * Updates progress markers without exposing file operations
 * Enhanced with context status tracking (Issue #51)
 * Enhanced with stepCount metadata usage (Issue #60)
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager, ProgressUpdate, ProgressReportResult } from '../core/TaskContextManager.js';
import { validateRequiredString, validateRequiredConfig } from '../utils/validation.js';
import { ErrorLogEntry } from '../logging/ErrorLogger.js';
import type { ContextStatus, CapabilityChanges } from '../types/context-types.js';
import { parsePlanCheckboxes } from '../utils/plan-parser.js';
import { PlanMetadata } from '../types/plan-metadata.js';
import * as fs from '../utils/fs-extra-safe.js';
import path from 'path';
import debug from 'debug';

const log = debug('agent-comm:tools:report-progress');
/**
 * Report progress updates without file exposure
 */
export async function reportProgress(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<ProgressReportResult> {
  log('reportProgress called with args: %O', { config, args });

  // Validate agent parameter first for proper error logging order
  let agent: string;
  try {
    agent = validateRequiredString(args['agent'], 'agent');
  } catch (error) {
    // Log validation error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'validation',
        operation: 'report_progress',
        agent: args['agent'] as string ?? undefined,
        error: {
          message: (error as Error).message,
          name: 'ValidationError',
          code: undefined
        },
        context: {
          tool: 'report_progress',
          parameters: {
            agent: args['agent'] ?? undefined
          }
        },
        severity: 'high'
      });
    }
    throw error;
  }

  // Validate configuration has required components
  validateRequiredConfig(config);
  const updatesArray = args['updates'];
  const taskId = args['taskId'] as string | undefined; // Optional taskId parameter

  // Optional context tracking (Issue #51)
  const contextStatus = args['contextStatus'] as ContextStatus | undefined;
  const capabilityChanges = args['capabilityChanges'] as CapabilityChanges | undefined;

  // Validate context status if provided
  if (contextStatus) {
    // Validate currentUsage is non-negative
    if (typeof contextStatus.currentUsage === 'number' && contextStatus.currentUsage < 0) {
      const error = new Error(`Context status validation failed: currentUsage cannot be negative, got ${contextStatus.currentUsage}`);
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'validation',
          operation: 'report_progress',
          agent,
          ...(taskId && { taskId }),
          error: {
            message: error.message,
            name: 'ValidationError',
            code: undefined
          },
          context: {
            tool: 'report_progress',
            parameters: {
              operation: 'context_validation',
              currentUsage: contextStatus.currentUsage,
              estimatedRemaining: contextStatus.estimatedRemaining,
              trend: contextStatus.trend
            }
          },
          severity: 'high'
        });
      }
      throw error;
    }

    // Validate trend is a valid value
    if (contextStatus.trend && !['INCREASING', 'DECREASING', 'STABLE'].includes(contextStatus.trend)) {
      const error = new Error(`Context status validation failed: trend must be one of INCREASING, DECREASING, STABLE, got ${contextStatus.trend}`);
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'validation',
          operation: 'report_progress',
          agent,
          ...(taskId && { taskId }),
          error: {
            message: error.message,
            name: 'ValidationError',
            code: undefined
          },
          context: {
            tool: 'report_progress',
            parameters: {
              operation: 'context_validation',
              invalidTrend: contextStatus.trend,
              validTrends: ['INCREASING', 'DECREASING', 'STABLE']
            }
          },
          severity: 'high'
        });
      }
      throw error;
    }
  }
  
  if (!Array.isArray(updatesArray)) {
    const error = new Error('Progress updates must be an array');
    // Log validation error
    if (config.errorLogger) {
      const errorEntry: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'validation',
        operation: 'report_progress',
        agent,
        ...(taskId && { taskId }),
        error: {
          message: error.message,
          name: error.name
        },
        context: {
          tool: 'report_progress',
          parameters: { agent, updates: updatesArray }
        },
        severity: 'medium'
      };
      await config.errorLogger.logError(errorEntry);
    }
    throw error;
  }

  // Allow empty updates array but log it for debugging
  if (updatesArray.length === 0) {
    log('Empty updates array provided - allowing for backward compatibility');
  }

  // Validate and convert updates
  const updates: ProgressUpdate[] = [];
  for (let index = 0; index < updatesArray.length; index++) {
    const update = updatesArray[index] as unknown;
    if (typeof update !== 'object' || update === null) {
      const error = new Error(`Update at index ${index} must be an object`);
      // Log validation error
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'validation',
          operation: 'report_progress',
          agent,
          ...(taskId && { taskId }),
          error: {
            message: error.message,
            name: 'ValidationError',
            code: undefined
          },
          context: {
            tool: 'report_progress',
            parameters: {
              agent,
              updateIndex: index,
              updateValue: update
            }
          },
          severity: 'high'
        });
      }
      throw error;
    }

    const updateObj = update as Record<string, unknown>;
    
    const step = updateObj['step'];
    const status = updateObj['status'];
    const description = updateObj['description'];
    const timeSpent = updateObj['timeSpent'];
    const estimatedTimeRemaining = updateObj['estimatedTimeRemaining'];
    const blocker = updateObj['blocker'];

    if (typeof step !== 'number') {
      const error = new Error(`Update at index ${index}: step must be a number`);
      // Log validation error
      if (config.errorLogger) {
        const errorEntry: ErrorLogEntry = {
          timestamp: new Date(),
          source: 'validation',
          operation: 'report_progress',
          agent,
          ...(taskId && { taskId }),
          error: {
            message: error.message,
            name: error.name
          },
          context: {
            tool: 'report_progress',
            parameters: { agent, invalidStep: step, updateIndex: index }
          },
          severity: 'medium'
        };
        await config.errorLogger.logError(errorEntry);
      }
      throw error;
    }

    // Log unusual step numbers but don't block (for resilience)
    if (step <= 0) {
      log('Warning: Unusual step number detected: %d at index %d', step, index);
      // Log unusual condition for analysis but don't block
      if (config.errorLogger) {
        const errorEntry: ErrorLogEntry = {
          timestamp: new Date(),
          source: 'validation',
          operation: 'report_progress',
          agent,
          ...(taskId && { taskId }),
          error: {
            message: `Unusual step number detected: ${step} at index ${index}`,
            name: 'ValidationWarning'
          },
          context: {
            tool: 'report_progress',
            parameters: { unusualStep: step, updateIndex: index }
          },
          severity: 'medium' // Not blocking, just unusual
        };
        await config.errorLogger.logError(errorEntry);
      }
      // Continue processing - don't throw
    }

    // Log extremely large step numbers but don't block (for resilience)
    if (step > 100) {
      log('Warning: Extremely large step number detected: %d at index %d', step, index);
      // Log unusual condition for analysis but don't block
      if (config.errorLogger) {
        const errorEntry: ErrorLogEntry = {
          timestamp: new Date(),
          source: 'validation',
          operation: 'report_progress',
          agent,
          ...(taskId && { taskId }),
          error: {
            message: `Extremely large step number detected: ${step} at index ${index}`,
            name: 'ValidationWarning'
          },
          context: {
            tool: 'report_progress',
            parameters: { unusualStep: step, typicalMax: 100, updateIndex: index }
          },
          severity: 'medium' // Not blocking, just unusual
        };
        await config.errorLogger.logError(errorEntry);
      }
      // Continue processing - don't throw
    }
    
    if (typeof status !== 'string' || !['COMPLETE', 'IN_PROGRESS', 'PENDING', 'BLOCKED'].includes(status)) {
      const error = new Error(`Update at index ${index}: status must be one of COMPLETE, IN_PROGRESS, PENDING, BLOCKED`);
      // Log validation error
      if (config.errorLogger) {
        const errorEntry: ErrorLogEntry = {
          timestamp: new Date(),
          source: 'validation',
          operation: 'report_progress',
          agent,
          ...(taskId && { taskId }),
          error: {
            message: error.message,
            name: error.name
          },
          context: {
            tool: 'report_progress',
            parameters: { agent, invalidStatus: status, updateIndex: index }
          },
          severity: 'medium'
        };
        await config.errorLogger.logError(errorEntry);
      }
      throw error;
    }
    
    if (typeof description !== 'string' || description.trim() === '') {
      const error = new Error(`Update at index ${index}: description must be a non-empty string`);
      // Log validation error
      if (config.errorLogger) {
        const errorEntry: ErrorLogEntry = {
          timestamp: new Date(),
          source: 'validation',
          operation: 'report_progress',
          agent,
          ...(taskId && { taskId }),
          error: {
            message: error.message,
            name: error.name
          },
          context: {
            tool: 'report_progress',
            parameters: { agent, invalidDescription: description, updateIndex: index }
          },
          severity: 'medium'
        };
        await config.errorLogger.logError(errorEntry);
      }
      throw error;
    }
    
    updates.push({
      step,
      status: status as 'COMPLETE' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED',
      description: description.trim(),
      ...(typeof timeSpent === 'number' && { timeSpent }),
      ...(typeof estimatedTimeRemaining === 'number' && { estimatedTimeRemaining }),
      ...(typeof blocker === 'string' && blocker.trim() && { blocker: blocker.trim() })
    });
  }

  // Validate step numbers against stepCount if metadata exists (Issue #60)
  try {
    const startTime = Date.now();
    const taskPath = path.join(config.commDir, agent, taskId ?? 'current-task');
    const metadataPath = path.join(taskPath, 'PLAN.metadata.json');

    let stepCount: number | undefined;

    // Try to read metadata first for performance
    if (await fs.pathExists(metadataPath)) {
      try {
        const metadata = await fs.readJSON(metadataPath) as PlanMetadata;
        stepCount = metadata.stepCount;
        log('Using cached stepCount from metadata: %d', stepCount);
      } catch (error) {
        log('Failed to read metadata, falling back to plan parsing: %s', (error as Error).message);
      }
    }

    // Fall back to parsing PLAN.md if no metadata
    if (stepCount === undefined) {
      const planPath = path.join(taskPath, 'PLAN.md');
      if (await fs.pathExists(planPath)) {
        const planContent = await fs.readFile(planPath, 'utf8');
        const checkboxes = parsePlanCheckboxes(planContent);
        stepCount = checkboxes.length;
        log('Parsed stepCount from PLAN.md: %d', stepCount);
      }
    }

    const validationTime = Date.now() - startTime;
    log('Step validation completed in %dms', validationTime);

    if (validationTime > 10) {
      log('PERFORMANCE WARNING: Step validation took %dms (>10ms threshold)', validationTime);
    }

    // Validate all step numbers are within range
    if (stepCount !== undefined) {
      for (const update of updates) {
        if (update.step > stepCount) {
          const errorMessage = `Step ${update.step} is out of range (max: ${stepCount})`;

          if (config.errorLogger) {
            const errorEntry: ErrorLogEntry = {
              timestamp: new Date(),
              source: 'validation',
              operation: 'report_progress',
              agent,
              ...(taskId && { taskId }),
              error: {
                message: errorMessage,
                name: 'StepOutOfRangeWarning',
                code: 'STEP_OUT_OF_RANGE'
              },
              context: {
                tool: 'report_progress',
                parameters: {
                  invalidStep: update.step,
                  maxStep: stepCount
                }
              },
              severity: 'medium'
            };
            await config.errorLogger.logError(errorEntry);
          }

          // Log warning but continue processing (permissive handling)
          log('Warning: %s', errorMessage);
        }
      }
    }
  } catch (error) {
    // Log error but only fail if it's a validation error
    if ((error as Error).message.includes('out of range')) {
      throw error;
    }
    log('Non-critical error during step validation: %s', (error as Error).message);
  }

  // Create connection for the agent with optional taskId
  const connection = {
    id: `report-progress-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    agent,
    startTime: new Date(),
    metadata: { 
      operation: 'report-progress', 
      updatesCount: updates.length,
      ...(taskId && { taskId }) // Include taskId if provided
    }
  };
  
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  // Log context status if provided (Issue #51)
  if (contextStatus) {
    log('Context status reported:', {
      usage: contextStatus.currentUsage,
      trend: contextStatus.trend,
      remaining: contextStatus.estimatedRemaining
    });

    // Could trigger alerts if usage is high
    if (contextStatus.currentUsage > 85) {
      log('WARNING: High context usage detected:', contextStatus.currentUsage);
    }
  }

  if (capabilityChanges) {
    log('Capability changes reported:', {
      limitations: capabilityChanges.discoveredLimitations?.length ?? 0,
      adaptations: capabilityChanges.adaptations?.length ?? 0
    });
  }

  try {
    return await contextManager.reportProgress(updates, connection);
  } catch (error) {
    // Log specific error scenarios that can occur during progress reporting
    if (config.errorLogger) {
      const errorEntry: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'runtime',
        operation: 'report_progress',
        agent,
        ...(taskId && { taskId }),
        error: {
          message: (error as Error).message,
          name: (error as Error).name || 'Error',
          code: (error as NodeJS.ErrnoException)?.code
        },
        context: {
          tool: 'report_progress',
          parameters: {
            updatesCount: updates.length,
            ...(contextStatus && { contextStatus }),
            ...(capabilityChanges && { capabilityChanges })
          }
        },
        severity: 'high'
      };

      // Categorize specific error types for better error analysis
      const errorMessage = (error as Error).message.toLowerCase();

      if (errorMessage.includes('plan.md not found')) {
        errorEntry.source = 'runtime';
        errorEntry.context.parameters = {
          ...errorEntry.context.parameters,
          operation: 'plan_file_check',
          fileType: 'PLAN.md'
        };
      } else if (errorMessage.includes('permission denied')) {
        errorEntry.source = 'runtime';
        errorEntry.context.parameters = {
          ...errorEntry.context.parameters,
          operation: 'file_access',
          permissions: true
        };
      } else if (errorMessage.includes('disk full') || errorMessage.includes('no space')) {
        errorEntry.source = 'tool_execution';
        errorEntry.context.parameters = {
          ...errorEntry.context.parameters,
          operation: 'file_write',
          diskSpace: true
        };
      } else if (errorMessage.includes('invalid step number')) {
        errorEntry.source = 'validation';
        const stepMatch = errorMessage.match(/invalid step number:?\s*(\d+|-?\d+)/);
        if (stepMatch) {
          errorEntry.context.parameters = {
            ...errorEntry.context.parameters,
            invalidStep: parseInt(stepMatch[1]),
            maxSteps: updates.length
          };
        }
      } else if (errorMessage.includes('malformed') || errorMessage.includes('checkbox')) {
        errorEntry.source = 'validation';
        errorEntry.context.parameters = {
          ...errorEntry.context.parameters,
          operation: 'checkbox_parsing',
          malformedContent: true
        };
      } else if (errorMessage.includes('context status') || errorMessage.includes('invalid context')) {
        errorEntry.source = 'validation';
        errorEntry.context.parameters = {
          ...errorEntry.context.parameters,
          operation: 'context_validation',
          contextStatus: contextStatus
        };
      }

      await config.errorLogger.logError(errorEntry);
    }

    throw error;
  }
}