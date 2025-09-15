/**
 * Handoff Context Generator - Creates comprehensive handoff summaries for task transitions
 * Issue #51: Enhanced Agent Context Reporting
 */

import debug from 'debug';
import type {
  HandoffContext,
  EnhancedProgressUpdate,
  ContextUsageData
} from '../types/context-types.js';

const log = debug('agent-comm:core:handoff-context');

/**
 * Information about the current task for handoff generation
 */
export interface TaskInfo {
  /** Task identifier */
  taskId: string;

  /** Original task description */
  taskDescription: string;

  /** Agent currently working on task */
  currentAgent: string;

  /** Target agent for handoff (if known) */
  targetAgent?: string;

  /** Task creation timestamp */
  startedAt: Date;

  /** Current timestamp */
  currentTime?: Date;
}

/**
 * Work item with completion status
 */
export interface WorkItem {
  /** Description of the work item */
  description: string;

  /** Whether the item is complete */
  completed: boolean;

  /** Any notes or output from the item */
  notes?: string;

  /** If blocked, the reason */
  blockedReason?: string;
}

/**
 * Key decision made during task execution
 */
export interface KeyDecision {
  /** What was decided */
  decision: string;

  /** Why it was decided */
  rationale: string;

  /** When it was decided */
  timestamp?: Date;

  /** Impact on the task */
  impact?: string;
}

/**
 * Generates comprehensive handoff context for task transitions
 */
export class HandoffContextGenerator {
  /**
   * Generate a complete handoff context for task transition
   */
  generateHandoffContext(
    taskInfo: TaskInfo,
    workItems: WorkItem[],
    keyDecisions: KeyDecision[],
    dependencies: string[],
    contextUsage?: ContextUsageData,
    progressSteps?: EnhancedProgressUpdate[]
  ): HandoffContext {
    const criticalContext = this.extractCriticalContext(
      taskInfo,
      workItems,
      keyDecisions,
      dependencies
    );

    const completedWork = this.summarizeCompletedWork(workItems, progressSteps);
    const nextSteps = this.identifyNextSteps(workItems, progressSteps, dependencies);
    const decisionsMap = this.formatKeyDecisions(keyDecisions);

    const estimatedContinuation = this.estimateContinuationContext(
      workItems,
      progressSteps,
      contextUsage
    );

    const handoff: HandoffContext = {
      criticalContext,
      completedWork,
      nextSteps,
      keyDecisions: decisionsMap,
      dependencies,
      estimatedContinuationContext: estimatedContinuation
    };

    log('Generated handoff context for task:', taskInfo.taskId);
    return handoff;
  }

  /**
   * Extract critical context that must be preserved
   */
  private extractCriticalContext(
    taskInfo: TaskInfo,
    workItems: WorkItem[],
    keyDecisions: KeyDecision[],
    dependencies: string[]
  ): string[] {
    const critical: string[] = [];

    // Task identity and purpose
    critical.push(`Task: ${taskInfo.taskId} - ${taskInfo.taskDescription}`);
    critical.push(`Started by: ${taskInfo.currentAgent} at ${taskInfo.startedAt.toISOString()}`);

    // Blocked items are critical
    const blockedItems = workItems.filter(w => w.blockedReason);
    if (blockedItems.length > 0) {
      critical.push(`BLOCKED: ${blockedItems.length} items blocked`);
      blockedItems.forEach(item => {
        critical.push(`- ${item.description}: ${item.blockedReason}`);
      });
    }

    // Critical decisions
    const criticalDecisions = keyDecisions.filter(d =>
      d.impact?.toLowerCase().includes('critical') ||
      d.decision.toLowerCase().includes('critical')
    );
    if (criticalDecisions.length > 0) {
      critical.push('Critical decisions made:');
      criticalDecisions.forEach(d => {
        critical.push(`- ${d.decision}`);
      });
    }

    // Unresolved dependencies
    if (dependencies.length > 0) {
      critical.push(`Dependencies: ${dependencies.join(', ')}`);
    }

    // Work in progress
    const inProgress = workItems.filter(w => !w.completed && !w.blockedReason);
    if (inProgress.length > 0) {
      critical.push(`In Progress: ${inProgress[0].description}`);
    }

    return critical;
  }

  /**
   * Summarize completed work
   */
  private summarizeCompletedWork(
    workItems: WorkItem[],
    progressSteps?: EnhancedProgressUpdate[]
  ): string[] {
    const completed: string[] = [];

    // From work items
    const completedItems = workItems.filter(w => w.completed);
    completedItems.forEach(item => {
      let summary = `✓ ${item.description}`;
      if (item.notes) {
        summary += ` - ${item.notes}`;
      }
      completed.push(summary);
    });

    // From progress steps if available
    if (progressSteps) {
      const completedSteps = progressSteps.filter(s => s.status === 'COMPLETE');
      completedSteps.forEach(step => {
        // Avoid duplicates
        if (!completed.some(c => c.includes(step.description))) {
          completed.push(`✓ ${step.description}`);
        }
      });
    }

    // If nothing completed yet
    if (completed.length === 0) {
      completed.push('Initial setup and analysis completed');
    }

    return completed;
  }

  /**
   * Identify next steps to take
   */
  private identifyNextSteps(
    workItems: WorkItem[],
    progressSteps?: EnhancedProgressUpdate[],
    dependencies?: string[]
  ): string[] {
    const nextSteps: string[] = [];

    // Currently in-progress items
    const inProgress = workItems.filter(w => !w.completed && !w.blockedReason);
    if (inProgress.length > 0) {
      nextSteps.push(`Continue: ${inProgress[0].description}`);
    }

    // Pending items from work items
    const pending = workItems.filter(w => !w.completed && !w.blockedReason);
    pending.slice(inProgress.length > 0 ? 1 : 0, 5).forEach(item => {
      nextSteps.push(`Then: ${item.description}`);
    });

    // From progress steps if available
    if (progressSteps) {
      const pendingSteps = progressSteps.filter(s => s.status === 'PENDING');
      pendingSteps.slice(0, 3).forEach(step => {
        // Avoid duplicates
        if (!nextSteps.some(n => n.includes(step.description))) {
          nextSteps.push(`Todo: ${step.description}`);
        }
      });
    }

    // Handle blocked items
    const blockedItems = workItems.filter(w => w.blockedReason);
    if (blockedItems.length > 0) {
      nextSteps.push('Resolve blockers:');
      blockedItems.forEach(item => {
        nextSteps.push(`- Unblock: ${item.description}`);
      });
    }

    // Dependencies that need resolution
    if (dependencies && dependencies.length > 0) {
      nextSteps.push(`Resolve dependencies: ${dependencies.join(', ')}`);
    }

    return nextSteps;
  }

  /**
   * Format key decisions for handoff
   */
  private formatKeyDecisions(decisions: KeyDecision[]): Record<string, string> {
    const formatted: Record<string, string> = {};

    decisions.forEach((decision, index) => {
      const key = decision.timestamp
        ? `Decision_${decision.timestamp.getTime()}`
        : `Decision_${index + 1}`;

      let value = decision.decision;
      if (decision.rationale) {
        value += ` (Reason: ${decision.rationale})`;
      }
      if (decision.impact) {
        value += ` [Impact: ${decision.impact}]`;
      }

      formatted[key] = value;
    });

    return formatted;
  }

  /**
   * Estimate context needed for continuation
   */
  private estimateContinuationContext(
    workItems: WorkItem[],
    progressSteps?: EnhancedProgressUpdate[],
    contextUsage?: ContextUsageData
  ): number {
    // Count remaining work
    const remainingWorkItems = workItems.filter(w => !w.completed).length;
    const remainingSteps = progressSteps?.filter(s => s.status !== 'COMPLETE').length ?? 0;
    const totalRemaining = Math.max(remainingWorkItems, remainingSteps);

    if (totalRemaining === 0) {
      return 0; // Task is complete
    }

    // If we have context usage data, use it for estimation
    if (contextUsage) {
      const completedItems = workItems.filter(w => w.completed).length;
      const completedSteps = progressSteps?.filter(s => s.status === 'COMPLETE').length ?? 0;
      const totalCompleted = Math.max(completedItems, completedSteps, 1);

      // Calculate average tokens per item
      const tokensPerItem = contextUsage.currentTokens / totalCompleted;

      // Estimate for remaining work (with 20% buffer)
      return Math.round(tokensPerItem * totalRemaining * 1.2);
    }

    // Default estimation based on complexity
    const baseEstimate = 1000; // Base tokens per item
    const complexityMultiplier = this.estimateComplexity(workItems);

    return Math.round(baseEstimate * totalRemaining * complexityMultiplier);
  }

  /**
   * Estimate complexity multiplier for remaining work
   */
  private estimateComplexity(workItems: WorkItem[]): number {
    let multiplier = 1.0;

    const remaining = workItems.filter(w => !w.completed);
    remaining.forEach(item => {
      const desc = item.description.toLowerCase();

      // Complex items need more context
      if (desc.includes('refactor') || desc.includes('migrate')) {
        multiplier += 0.3;
      }
      if (desc.includes('test') || desc.includes('validate')) {
        multiplier += 0.2;
      }
      if (desc.includes('integrate') || desc.includes('deploy')) {
        multiplier += 0.25;
      }
      if (item.blockedReason) {
        multiplier += 0.4; // Blocked items are complex to resolve
      }
    });

    return Math.min(multiplier, 2.5); // Cap at 2.5x
  }

  /**
   * Generate a text summary of the handoff context
   */
  generateTextSummary(handoff: HandoffContext): string {
    const lines: string[] = [];

    lines.push('=== TASK HANDOFF CONTEXT ===\n');

    lines.push('CRITICAL INFORMATION:');
    handoff.criticalContext.forEach(item => {
      lines.push(`  ${item}`);
    });
    lines.push('');

    lines.push('COMPLETED WORK:');
    handoff.completedWork.forEach(item => {
      lines.push(`  ${item}`);
    });
    lines.push('');

    lines.push('NEXT STEPS:');
    handoff.nextSteps.forEach(item => {
      lines.push(`  ${item}`);
    });
    lines.push('');

    if (Object.keys(handoff.keyDecisions).length > 0) {
      lines.push('KEY DECISIONS:');
      Object.entries(handoff.keyDecisions).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value}`);
      });
      lines.push('');
    }

    if (handoff.dependencies.length > 0) {
      lines.push('DEPENDENCIES:');
      handoff.dependencies.forEach(dep => {
        lines.push(`  - ${dep}`);
      });
      lines.push('');
    }

    lines.push(`ESTIMATED CONTEXT NEEDED: ${handoff.estimatedContinuationContext} tokens\n`);

    return lines.join('\n');
  }

  /**
   * Validate handoff context completeness
   */
  validateHandoffContext(handoff: HandoffContext): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check critical fields
    if (handoff.criticalContext.length === 0) {
      issues.push('No critical context provided');
    }

    if (handoff.completedWork.length === 0) {
      issues.push('No completed work documented');
    }

    if (handoff.nextSteps.length === 0) {
      issues.push('No next steps identified');
    }

    if (handoff.estimatedContinuationContext < 0) {
      issues.push('Invalid context estimation');
    }

    // Warnings for potentially incomplete handoffs
    if (Object.keys(handoff.keyDecisions).length === 0) {
      issues.push('Warning: No key decisions documented');
    }

    if (handoff.dependencies.length === 0 && handoff.nextSteps.some(s => s.toLowerCase().includes('depend'))) {
      issues.push('Warning: Dependencies mentioned but not listed');
    }

    return {
      valid: issues.length === 0 || issues.every(i => i.startsWith('Warning')),
      issues
    };
  }
}