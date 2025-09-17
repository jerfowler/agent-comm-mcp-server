/**
 * Submit plan tool - Plan submission without file exposure
 * Accepts plan content and handles file creation internally
 * Enhanced with optional context reporting (Issue #51)
 * Enhanced with stepCount parameter for efficient validation (Issue #60)
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager, PlanSubmissionResult } from '../core/TaskContextManager.js';
import { validateRequiredString, validateRequiredConfig } from '../utils/validation.js';
import { AgentCommError } from '../types.js';
import { ErrorLogEntry } from '../logging/ErrorLogger.js';
import type { AgentContextData, ContextEstimate } from '../types/context-types.js';
import { parsePlanCheckboxes, validateStepCount } from '../utils/plan-parser.js';
import { PlanMetadata } from '../types/plan-metadata.js';
import * as fs from '../utils/fs-extra-safe.js';
import path from 'path';
import debug from 'debug';

const log = debug('agent-comm:tools:submit-plan');
interface PlanValidationResult {
  valid: boolean;
  checkboxCount: number;
  errors: string[];
}

/**
 * Validate plan format according to checkbox requirements
 */
function validatePlanFormat(content: string): PlanValidationResult {
  const errors: string[] = [];
  
  // Check for checkbox format: - [ ] **Title**: Description
  const checkboxRegex = /^- \[ \] \*\*[^:]+\*\*:/gm;
  const checkboxes = content.match(checkboxRegex) ?? [];
  
  // Require at least one checkbox
  if (checkboxes.length === 0) {
    errors.push('Plan must include at least ONE trackable item with checkbox format. Example: - [ ] **Task Name**: Description');
  }
  
  // Check for forbidden status markers
  const statusMarkerRegex = /\[(PENDING|COMPLETE|IN_PROGRESS|TODO|DONE|BLOCKED)\]/gi;
  const statusMarkers = content.match(statusMarkerRegex);
  
  if (statusMarkers && statusMarkers.length > 0) {
    errors.push(`Use checkbox format only. Remove these status markers: ${statusMarkers.join(', ')}. Replace with - [ ] or - [x]`);
  }
  
  // Validate each checkbox has detail points
  if (checkboxes.length > 0) {
    const lines = content.split('\n');
    checkboxes.forEach((checkbox) => {
      const checkboxLineIndex = lines.findIndex(l => l.includes(checkbox));
      if (checkboxLineIndex >= 0) {
        const nextLines = lines.slice(checkboxLineIndex + 1, checkboxLineIndex + 6);
        const hasDetails = nextLines.some(l => l.trim().startsWith('-') && !l.trim().startsWith('- [ ]'));
        
        if (!hasDetails) {
          const checkboxTitle = checkbox.match(/\*\*([^:]+)\*\*/)?.[1] ?? 'Unknown';
          errors.push(`Checkbox "${checkboxTitle}" missing required detail points. Each checkbox must have 2-5 detail bullets.`);
        }
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    checkboxCount: checkboxes.length,
    errors
  };
}

/**
 * Submit plan content without exposing file creation
 */
export async function submitPlan(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<PlanSubmissionResult> {
  log('submitPlan called with args: %O', { config, args });
  // Validate configuration has required components
  validateRequiredConfig(config);

  const content = validateRequiredString(args['content'], 'content');
  const agent = validateRequiredString(args['agent'], 'agent');
  const taskId = args['taskId'] as string | undefined; // Optional taskId parameter
  const stepCount = args['stepCount'] as number | undefined; // Optional stepCount parameter (Issue #60)

  // Optional context parameters (Issue #51)
  const agentContext = args['agentContext'] as AgentContextData | undefined;
  const contextEstimate = args['contextEstimate'] as ContextEstimate | undefined;
  
  // Validate plan format before submission
  const validation = validatePlanFormat(content);

  if (!validation.valid) {
    const errorMessage = [
      'Plan format validation failed:',
      ...validation.errors,
      '',
      'Required format:',
      '- [ ] **Step Title**: Brief description',
      '  - Action: Specific command or task',
      '  - Expected: Success criteria',
      '  - Error: Handling approach if fails',
      '',
      'Example:',
      '- [ ] **Test Discovery**: Identify all test configurations',
      '  - Run: `pnpm list --filter "*" --depth 0`',
      '  - Expected: List of all test files and configurations',
      '  - Error: If no tests found, document as critical issue'
    ].join('\n');

    // Log validation error before throwing
    if (config.errorLogger) {
      // Extract any status markers if they exist
      const statusMarkerRegex = /\[(PENDING|COMPLETE|IN_PROGRESS|TODO|DONE|BLOCKED)\]/gi;
      const statusMarkers = content.match(statusMarkerRegex);

      const errorEntry: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'validation',
        operation: 'submit_plan',
        agent,
        ...(taskId && { taskId }),
        error: {
          message: errorMessage,
          name: 'PlanFormatError'
        },
        context: {
          tool: 'submit_plan',
          ...(statusMarkers && { invalidMarkers: statusMarkers }),
          parameters: {
            agent,
            contentLength: content.length,
            checkboxCount: validation.checkboxCount,
            errors: validation.errors
          }
        },
        severity: 'medium'
      };
      await config.errorLogger.logError(errorEntry);
    }

    throw new AgentCommError(errorMessage, 'PLAN_FORMAT_INVALID');
  }

  // Validate stepCount if provided (Issue #60)
  if (stepCount !== undefined) {
    const startTime = Date.now();
    const checkboxes = parsePlanCheckboxes(content);
    const actualCount = checkboxes.length;
    const validationTime = Date.now() - startTime;

    log('Step count validation: expected=%d, actual=%d, time=%dms', stepCount, actualCount, validationTime);

    if (validationTime > 10) {
      log('PERFORMANCE WARNING: Step validation took %dms (>10ms threshold)', validationTime);
    }

    if (!validateStepCount(stepCount, actualCount)) {
      const errorMessage = `Step count mismatch: expected ${stepCount}, actual ${actualCount}`;

      if (config.errorLogger) {
        const errorEntry: ErrorLogEntry = {
          timestamp: new Date(),
          source: 'validation',
          operation: 'submit_plan',
          agent,
          error: {
            message: errorMessage,
            name: 'StepCountMismatchError',
            code: 'STEP_COUNT_MISMATCH'
          },
          context: {
            tool: 'submit-plan',
            parameters: {
              expectedStepCount: stepCount,
              actualStepCount: actualCount,
              planContent: content.substring(0, 500)
            }
          },
          severity: 'medium'
        };
        await config.errorLogger.logError(errorEntry);
      }

      throw new AgentCommError(errorMessage, 'STEP_COUNT_MISMATCH');
    }
  }

  // Create connection for the agent with optional taskId
  const connection = {
    id: `submit-plan-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    agent,
    startTime: new Date(),
    metadata: { 
      operation: 'submit-plan', 
      contentSize: content.length,
      checkboxCount: validation.checkboxCount,
      ...(taskId && { taskId }) // Include taskId if provided
    }
  };
  
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  // Log context information if provided (Issue #51)
  if (agentContext) {
    log('Agent context provided:', {
      identity: agentContext.identity.agentName,
      specialization: agentContext.identity.specialization,
      tools: agentContext.currentCapabilities.availableTools.length,
      priorities: agentContext.workingContext.currentPriorities
    });
  }

  if (contextEstimate) {
    log('Context estimate provided:', {
      tokensRequired: contextEstimate.estimatedTokensRequired,
      confidence: contextEstimate.confidenceLevel,
      criticalSections: contextEstimate.criticalSections.length
    });
  }

  const result = await contextManager.submitPlan(content, connection);

  // Create PLAN.metadata.json after successful submission (Issue #60)
  try {
    const startTime = Date.now();

    // Calculate actual step count if not provided
    const actualStepCount = stepCount ?? parsePlanCheckboxes(content).length;

    // Get the task path from context manager or use default
    const taskPath = path.join(config.commDir, agent, taskId ?? 'current-task');

    // Create metadata object
    const metadata: PlanMetadata = {
      stepCount: actualStepCount,
      agent,
      ...(taskId && { taskId }),
      createdAt: new Date().toISOString(),
      checkboxPattern: 'markdown',
      version: '2.0.0'
    };

    // Write metadata file
    const metadataPath = path.join(taskPath, 'PLAN.metadata.json');
    await fs.ensureDir(taskPath);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    const metadataTime = Date.now() - startTime;
    log('Created PLAN.metadata.json with stepCount=%d in %dms', actualStepCount, metadataTime);

    if (metadataTime > 10) {
      log('PERFORMANCE WARNING: Metadata creation took %dms (>10ms threshold)', metadataTime);
    }
  } catch (error) {
    // Log error but don't fail the submission - metadata is optimization
    log('Failed to create PLAN.metadata.json: %s', (error as Error).message);
  }

  return result;
}