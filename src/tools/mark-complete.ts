/**
 * Mark complete tool - Task completion without file path exposure
 * Marks task as complete or error without exposing file operations
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager, CompletionResult } from '../core/TaskContextManager.js';
import { validateRequiredString, validateRequiredConfig } from '../utils/validation.js';
import { verifyAgentWork, DEFAULT_CONFIDENCE_THRESHOLD } from '../core/agent-work-verifier.js';
import * as fs from '../utils/file-system.js';
import * as path from 'path';
import debug from 'debug';


const log = debug('agent-comm:tools:markcomplete');
interface ReconciliationOptions {
  mode?: 'strict' | 'auto_complete' | 'reconcile' | 'force';
  explanations?: Record<string, string> | undefined; // item -> reason for not being checked
}

interface CompletionValidation {
  totalItems: number;
  checkedItems: number;
  uncheckedItems: string[];
  completionPercentage: number;
  hasIncompleteItems: boolean;
}

interface ReconciledCompletion {
  status: 'DONE' | 'ERROR';
  summary: string;
  reconciliation?: {
    applied: boolean;
    mode: string;
    uncheckedItemsCount: number;
  };
}

/**
 * Extract unchecked checkbox items from plan content
 */
function extractUncheckedItems(content: string): string[] {
  const uncheckedRegex = /^- \[ \] \*\*([^:]+)\*\*:/gm;
  const matches = content.match(uncheckedRegex) ?? [];
  return matches.map((match: string) => {
    const titleMatch = match.match(/\*\*([^:]+)\*\*/);
    return titleMatch ? titleMatch[1] : match;
  });
}

/**
 * Validate checkbox format in plan content and detect invalid formats
 */
function validateCheckboxFormats(content: string, config: ServerConfig, agent: string, taskId?: string): void {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and headers
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Only validate lines that contain brackets and appear to be checkbox attempts
    // This includes malformed brackets like [INVALID] but excludes general list items
    const hasCheckboxBrackets = line.includes('[') && line.includes(']');
    const isListItem = line.startsWith('-') && hasCheckboxBrackets;
    if (hasCheckboxBrackets && (isListItem || !line.startsWith('-'))) {
      // This looks like a checkbox attempt, validate format
      const validCheckbox = line.match(/^- \[[x ]\] \*\*[^:]+\*\*:/);

      if (!validCheckbox) {
        // Log parsing error for invalid checkbox format
        if (config.errorLogger) {
          config.errorLogger.logError({
            timestamp: new Date(),
            source: 'validation',
            operation: 'mark_complete',
            agent,
            taskId: taskId ?? 'unknown',
            error: {
              message: `Invalid checkbox format on line ${i + 1}: ${line}`,
              name: 'ParseError',
              code: undefined
            },
            context: {
              tool: 'mark_complete',
              parameters: {
                parseError: 'checkbox_format_invalid',
                planContentLength: content.length,
                invalidLine: line,
                lineNumber: i + 1
              }
            },
            severity: 'critical'
          }).catch(() => {
            // Ignore logging errors to prevent blocking execution
          });
        }

        throw new Error(`Invalid checkbox format on line ${i + 1}: ${line}`);
      }
    }
  }
}

/**
 * Extract checked checkbox items from plan content  
 */
function extractCheckedItems(content: string): string[] {
  const checkedRegex = /^- \[x\] \*\*([^:]+)\*\*:/gmi;
  const matches = content.match(checkedRegex) ?? [];
  return matches.map((match: string) => {
    const titleMatch = match.match(/\*\*([^:]+)\*\*/);
    return titleMatch ? titleMatch[1] : match;
  });
}

/**
 * Validate task completion against plan checkboxes
 */
async function validateCompletion(
  config: ServerConfig,
  agent: string,
  taskId?: string
): Promise<CompletionValidation> {
  let planContent = '';  // Declare in function scope for error logging

  try {
    log('validateCompletion called for agent: %s, taskId: %s', agent, taskId);
    // Find the task directory - either specified or active
    const agentDir = path.join(config.commDir, agent);
    log('Checking agent directory: %s', agentDir);
    if (!await fs.pathExists(agentDir)) {
      log('Agent directory does not exist, returning default validation');
      return {
        totalItems: 0,
        checkedItems: 0,
        uncheckedItems: [],
        completionPercentage: 100,
        hasIncompleteItems: false
      };
    }

    let activeTaskDir: string | null = null;

    if (taskId) {
      log('Using specified taskId: %s', taskId);
      // Use specified taskId
      const taskPath = path.join(agentDir, taskId);
      if (await fs.pathExists(taskPath)) {
        activeTaskDir = taskId;
      }
    } else {
      log('Finding active task (no taskId specified)');
      // Find active task (backward compatibility)
      const taskDirs = await fs.listDirectory(agentDir);
      log('Found task directories: %O', taskDirs);
      activeTaskDir = await (async () => {
        for (const dir of taskDirs) {
          const donePath = path.join(agentDir, dir, 'DONE.md');
          const errorPath = path.join(agentDir, dir, 'ERROR.md');
          const doneExists = await fs.pathExists(donePath);
          const errorExists = await fs.pathExists(errorPath);
          log('Checking task %s: done=%s, error=%s', dir, doneExists, errorExists);
          if (!doneExists && !errorExists) {
            log('Found active task: %s', dir);
            return dir;
          }
        }
        log('No active task found');
        return null;
      })();
    }

    if (!activeTaskDir) {
      log('No active task directory found, returning default validation');
      // No active task found
      return {
        totalItems: 0,
        checkedItems: 0,
        uncheckedItems: [],
        completionPercentage: 100,
        hasIncompleteItems: false
      };
    }

    log('Using active task directory: %s', activeTaskDir);
    
    // Read PLAN.md file
    const planPath = path.join(agentDir, activeTaskDir, 'PLAN.md');
    log('Checking PLAN.md at path: %s', planPath);

    if (!await fs.pathExists(planPath)) {
      log('PLAN.md does not exist, returning default validation');
      // No plan file, assume validation passes
      return {
        totalItems: 0,
        checkedItems: 0,
        uncheckedItems: [],
        completionPercentage: 100,
        hasIncompleteItems: false
      };
    }

    log('PLAN.md exists, reading content');
    planContent = await fs.readFile(planPath);
    log('PLAN.md content: %s', planContent);

    // Validate checkbox formats and log errors if malformed
    log('Starting checkbox format validation');
    validateCheckboxFormats(planContent, config, agent, taskId ?? activeTaskDir);

    const uncheckedItems = extractUncheckedItems(planContent);
    const checkedItems = extractCheckedItems(planContent);
    const totalItems = uncheckedItems.length + checkedItems.length;

    return {
      totalItems,
      checkedItems: checkedItems.length,
      uncheckedItems,
      completionPercentage: totalItems > 0 ? (checkedItems.length / totalItems) * 100 : 100,
      hasIncompleteItems: uncheckedItems.length > 0
    };

  } catch (error) {
    // If validation fails, log error and re-throw
    if (config.errorLogger) {
      // Check if this is a checkbox parsing error specifically
      const isParseError = error instanceof Error && error.message.includes('Invalid checkbox format');

      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'validation',
        operation: 'mark_complete',
        agent,
        taskId: taskId ?? 'unknown',
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: isParseError ? 'ParseError' : (error instanceof Error ? error.name : 'ValidationError'),
          code: (error as NodeJS.ErrnoException)?.code
        },
        context: {
          tool: 'mark_complete',
          parameters: isParseError ? {
            parseError: 'checkbox_format_invalid',
            planContentLength: planContent.length
          } : {
            operation: 'validate_completion',
            planPath: 'validation-error'
          }
        },
        severity: 'critical'
      });
    }
    throw error;
  }
}

/**
 * Apply reconciliation logic to completion
 */
async function reconcileCompletion(
  validation: CompletionValidation,
  status: 'DONE' | 'ERROR',
  summary: string,
  reconciliation: ReconciliationOptions | undefined,
  config: ServerConfig,
  agent: string,
  taskId?: string
): Promise<ReconciledCompletion> {
  
  if (!validation.hasIncompleteItems) {
    // No unchecked items, proceed normally
    return { status, summary };
  }
  
  const mode = reconciliation?.mode ?? 'strict';
  
  switch (mode) {
    case 'auto_complete': {
      // Auto-mark all unchecked as complete and update PLAN.md
      try {
        // Find the PLAN.md file to update
        const agentDir = path.join(config.commDir, agent);
        let planPath: string | null = null;

        if (taskId) {
          planPath = path.join(agentDir, taskId, 'PLAN.md');
        } else {
          // Find active task directory
          const taskDirs = await fs.listDirectory(agentDir);
          let activeTaskDir = '';

          for (const taskDir of taskDirs) {
            const taskPath = path.join(agentDir, taskDir);
            const stat = await fs.pathExists(taskPath);
            if (stat) {
              // For simplicity, use first available task directory
              // In production, we'd need proper stat implementation
              activeTaskDir = taskDir;
              break;
            }
          }

          if (activeTaskDir) {
            planPath = path.join(agentDir, activeTaskDir, 'PLAN.md');
          }
        }

        // Update PLAN.md if it exists
        if (planPath && await fs.pathExists(planPath)) {
          let planContent = await fs.readFile(planPath);

          // Replace unchecked items with checked
          validation.uncheckedItems.forEach(item => {
            const uncheckedPattern = new RegExp(`^- \\[ \\] \\*\\*${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*:`, 'gm');
            planContent = planContent.replace(uncheckedPattern, `- [x] **${item}**:`);
          });

          await fs.writeFile(planPath, planContent);
        }
      } catch (error) {
        // Log PLAN.md update failure
        if (config.errorLogger) {
          await config.errorLogger.logError({
            timestamp: new Date(),
            source: 'runtime',
            operation: 'mark_complete',
            agent,
            taskId: taskId ?? 'unknown',
            error: {
              message: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.name : 'Error',
              code: (error as NodeJS.ErrnoException)?.code
            },
            context: {
              tool: 'mark_complete',
              parameters: {
                operation: 'plan_update',
                reconciliationMode: 'auto_complete',
                errorCode: (error as NodeJS.ErrnoException)?.code
              }
            },
            severity: 'critical'
          });
        }
        throw error;
      }

      return {
        status: 'DONE',
        summary: `## Auto-Reconciliation Applied
All ${validation.uncheckedItems.length} unchecked items marked as completed.

### Auto-Completed Items:
${validation.uncheckedItems.map(item => `- [x] **${item}**: Auto-marked complete`).join('\n')}

### Original Summary:
${summary}`,
        reconciliation: {
          applied: true,
          mode: 'auto_complete',
          uncheckedItemsCount: validation.uncheckedItems.length
        }
      };
    }
      
    case 'reconcile': {
      // Document variance with explanations
      const explanations = reconciliation?.explanations ?? {};
      return {
        status: status === 'DONE' ? 'DONE' : 'ERROR',
        summary: `## Task Completion with Variance

### Completion Summary
- **Total Planned Items**: ${validation.totalItems}
- **Explicitly Checked**: ${validation.checkedItems}  
- **Reconciled Items**: ${validation.uncheckedItems.length}
- **Completion Rate**: ${Math.round(validation.completionPercentage)}%
- **Final Status**: ${status}

### Variance Report
${validation.uncheckedItems.map(item => {
  const explanation = explanations[item] ?? 'Completed via alternative approach';
  return `- **${item}**: ${explanation}`;
}).join('\n')}

### Original Summary:
${summary}`,
        reconciliation: {
          applied: true,
          mode: 'reconcile',
          uncheckedItemsCount: validation.uncheckedItems.length
        }
      };
    }
      
    case 'force':
      // Accept with strong documentation
      return {
        status,
        summary: `⚠️ FORCED COMPLETION - Unchecked items present

### Warning
${validation.uncheckedItems.length} planned items were not explicitly marked complete.
Agent has force-completed with status: ${status}

### Unchecked Items:
${validation.uncheckedItems.map(item => `- [ ] **${item}**: Not checked`).join('\n')}

### Agent Justification:
${summary}`,
        reconciliation: {
          applied: true,
          mode: 'force',
          uncheckedItemsCount: validation.uncheckedItems.length
        }
      };
      
    case 'strict':
      // Strict mode - reject if unchecked items exist and status is DONE
      if (status === 'DONE') {
        // Log reconciliation rejection with CRITICAL severity
        if (config.errorLogger) {
          await config.errorLogger.logError({
            timestamp: new Date(),
            source: 'validation',
            operation: 'mark_complete',
            agent,
            taskId: taskId ?? 'unknown',
            error: {
              message: `Reconciliation failed: ${validation.uncheckedItems.length} unchecked items in strict mode`,
              name: 'ReconciliationError',
              code: undefined
            },
            context: {
              tool: 'mark_complete',
              parameters: {
                reconciliationMode: 'strict',
                uncheckedItemsCount: validation.uncheckedItems.length,
                attemptedStatus: 'DONE'
              }
            },
            severity: 'critical'
          });
        }
        throw new Error(`Cannot mark DONE with ${validation.uncheckedItems.length} unchecked items. Use reconciliation mode or complete all items first.`);
      }
      return { status, summary };
      
    default:
      return { status, summary };
  }
}

/**
 * Mark task complete without file path exposure
 */
export async function markComplete(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<CompletionResult> {
  log('markComplete called with args: %O', { config, args });
  // Validate configuration has required components
  validateRequiredConfig(config);
  
  const status = validateRequiredString(args['status'], 'status');
  const summary = validateRequiredString(args['summary'], 'summary');
  const agent = validateRequiredString(args['agent'], 'agent');
  const taskId = args['taskId'] as string | undefined; // Optional taskId parameter
  
  // Parse reconciliation options if provided
  const reconciliationMode = args['reconciliation_mode'] as string | undefined;
  const reconciliationExplanations = args['reconciliation_explanations'] as Record<string, string> | undefined;
  
  const reconciliation: ReconciliationOptions | undefined = reconciliationMode ? {
    mode: reconciliationMode as 'strict' | 'auto_complete' | 'reconcile' | 'force',
    explanations: reconciliationExplanations ?? undefined
  } : undefined;
  
  // Validate status
  if (!['DONE', 'ERROR'].includes(status)) {
    throw new Error('Status must be either DONE or ERROR');
  }
  
  // Validate summary
  if (summary.trim().length < 10) {
    throw new Error('Summary must be at least 10 characters long');
  }
  
  // Create connection for the agent with optional taskId
  const connection = {
    id: `mark-complete-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    agent,
    startTime: new Date(),
    metadata: { 
      operation: 'mark-complete', 
      status, 
      summarySize: summary.length,
      reconciliationMode: reconciliation?.mode,
      ...(taskId && { taskId }) // Include taskId if provided
    }
  };
  
  // **MANDATORY VERIFICATION GATE** - Prevents false success reporting
  // This addresses Issue #11: Agent False Success Reporting
  if (status === 'DONE') {
    try {
      const verificationResult = await verifyAgentWork(config, agent);
      
      // Validate confidence score
      if (typeof verificationResult.confidence !== 'number' || 
          isNaN(verificationResult.confidence)) {
        throw new Error('Invalid verification confidence score returned');
      }
      
      // Block DONE completion if verification confidence is too low
      if (verificationResult.confidence < DEFAULT_CONFIDENCE_THRESHOLD) {
        // Log verification failure with CRITICAL severity
        if (config.errorLogger) {
          await config.errorLogger.logError({
            timestamp: new Date(),
            source: 'validation',
            operation: 'mark_complete',
            agent,
            taskId: taskId ?? 'unknown',
            error: {
              message: `Verification failed: confidence ${verificationResult.confidence}% below threshold ${DEFAULT_CONFIDENCE_THRESHOLD}%`,
              name: 'VerificationError',
              code: undefined
            },
            context: {
              tool: 'mark_complete',
              parameters: {
                verificationConfidence: verificationResult.confidence,
                threshold: DEFAULT_CONFIDENCE_THRESHOLD,
                reconciliationMode: reconciliation?.mode ?? 'strict'
              }
            },
            severity: 'critical'
          });
        }

        const errorDetails = [
          `VERIFICATION FAILED: ${verificationResult.confidence}% confidence (minimum ${DEFAULT_CONFIDENCE_THRESHOLD}% required)`,
          '',
          '⚠️ CRITICAL: Cannot mark task as DONE without sufficient work evidence',
          '',
          'Verification Warnings:',
          ...verificationResult.warnings.map(warning => `  • ${warning}`),
          '',
          'Evidence Summary:',
          `  • Files modified: ${verificationResult.evidence.filesModified}`,
          `  • Tests run: ${verificationResult.evidence.testsRun ? 'Yes' : 'No'}`,
          `  • MCP progress tracking: ${verificationResult.evidence.mcpProgress ? 'Yes' : 'No'}`,
          `  • Time spent: ${Math.round(verificationResult.evidence.timeSpent / 60)} minutes`,
          '',
          'Recommendation:',
          `  ${verificationResult.recommendation}`,
          '',
          'Next Steps:',
          '  1. Use ERROR status if the task genuinely failed',
          '  2. Provide actual work evidence (file changes, progress updates)',
          '  3. Use mcp__agent_comm__report_progress to document real work',
          '  4. Ensure PLAN.md exists with checked items for progress tracking'
        ].join('\n');

        throw new Error(errorDetails);
      }
      
      // Log successful verification for audit trail
      await config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'verification_gate_passed',
        agent,
        success: true,
        duration: 0, // Verification time is negligible for logging purposes
        metadata: {
          confidence: verificationResult.confidence,
          evidenceFilesModified: verificationResult.evidence.filesModified,
          evidenceTestsRun: verificationResult.evidence.testsRun,
          evidenceMcpProgress: verificationResult.evidence.mcpProgress,
          evidenceTimeSpent: verificationResult.evidence.timeSpent,
          warningCount: verificationResult.warnings.length
        }
      });
      
    } catch (verificationError) {
      // Log verification failure for security audit
      await config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'verification_gate_failed',
        agent,
        success: false,
        duration: 0, // Error occurred quickly
        error: {
          message: verificationError instanceof Error ? verificationError.message : String(verificationError),
          name: verificationError instanceof Error ? verificationError.name : 'VerificationError'
        }
      });
      
      // Re-throw to prevent task completion
      throw verificationError;
    }
  }
  
  // Validate completion against plan checkboxes
  log('Starting validation for agent: %s, taskId: %s', agent, taskId);
  const validation = await validateCompletion(config, agent, taskId);
  log('Validation completed: %O', validation);

  // Apply reconciliation logic
  const reconciledCompletion = await reconcileCompletion(
    validation,
    status as 'DONE' | 'ERROR',
    summary.trim(),
    reconciliation,
    config,
    agent,
    taskId
  );
  
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  try {
    return await contextManager.markComplete(
      reconciledCompletion.status,
      reconciledCompletion.summary,
      connection
    );
  } catch (error) {
    // Log file write failures for DONE.md/ERROR.md
    if (config.errorLogger) {
      const isFileError = error instanceof Error &&
        ((error as NodeJS.ErrnoException).code === 'ENOSPC' ||
         (error as NodeJS.ErrnoException).code === 'EACCES' ||
         (error as NodeJS.ErrnoException).code === 'EIO');

      if (isFileError) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'runtime',
          operation: 'mark_complete',
          agent,
          taskId: taskId ?? 'unknown',
          error: {
            message: error.message,
            name: error.name,
            code: (error as NodeJS.ErrnoException).code
          },
          context: {
            tool: 'mark_complete',
            parameters: {
              operation: 'write_completion',
              fileType: reconciledCompletion.status,
              errorCode: (error as NodeJS.ErrnoException).code
            }
          },
          severity: 'critical'
        });
      }
    }
    throw error;
  }
}