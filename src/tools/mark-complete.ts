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
  try {
    // Find the task directory - either specified or active
    const agentDir = path.join(config.commDir, agent);
    if (!await fs.pathExists(agentDir)) {
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
      // Use specified taskId
      const taskPath = path.join(agentDir, taskId);
      if (await fs.pathExists(taskPath)) {
        activeTaskDir = taskId;
      }
    } else {
      // Find active task (backward compatibility)
      const taskDirs = await fs.listDirectory(agentDir);
      activeTaskDir = await (async () => {
        for (const dir of taskDirs) {
          const donePath = path.join(agentDir, dir, 'DONE.md');
          const errorPath = path.join(agentDir, dir, 'ERROR.md');
          const doneExists = await fs.pathExists(donePath);
          const errorExists = await fs.pathExists(errorPath);
          if (!doneExists && !errorExists) {
            return dir;
          }
        }
        return null;
      })();
    }
    
    if (!activeTaskDir) {
      // No active task found
      return {
        totalItems: 0,
        checkedItems: 0,
        uncheckedItems: [],
        completionPercentage: 100,
        hasIncompleteItems: false
      };
    }
    
    // Read PLAN.md file
    const planPath = path.join(agentDir, activeTaskDir, 'PLAN.md');
    
    if (!await fs.pathExists(planPath)) {
      // No plan file, assume validation passes
      return {
        totalItems: 0,
        checkedItems: 0,
        uncheckedItems: [],
        completionPercentage: 100,
        hasIncompleteItems: false
      };
    }
    
    const planContent = await fs.readFile(planPath);
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
    // If validation fails, assume no plan validation needed
    return {
      totalItems: 0,
      checkedItems: 0,
      uncheckedItems: [],
      completionPercentage: 100,
      hasIncompleteItems: false
    };
  }
}

/**
 * Apply reconciliation logic to completion
 */
function reconcileCompletion(
  validation: CompletionValidation,
  status: 'DONE' | 'ERROR',
  summary: string,
  reconciliation?: ReconciliationOptions
): ReconciledCompletion {
  
  if (!validation.hasIncompleteItems) {
    // No unchecked items, proceed normally
    return { status, summary };
  }
  
  const mode = reconciliation?.mode ?? 'strict';
  
  switch (mode) {
    case 'auto_complete':
      // Auto-mark all unchecked as complete
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
  const validation = await validateCompletion(config, agent, taskId);
  
  // Apply reconciliation logic
  const reconciledCompletion = reconcileCompletion(
    validation,
    status as 'DONE' | 'ERROR',
    summary.trim(),
    reconciliation
  );
  
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  return await contextManager.markComplete(
    reconciledCompletion.status, 
    reconciledCompletion.summary, 
    connection
  );
}