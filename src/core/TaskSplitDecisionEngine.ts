/**
 * Task Split Decision Engine - Evaluates when to split tasks based on context usage
 * Issue #51: Enhanced Agent Context Reporting
 */

import debug from 'debug';
import type {
  ContextUsageData,
  TaskSplitRecommendation,
  EnhancedProgressUpdate
} from '../types/context-types.js';

const log = debug('agent-comm:core:task-split-decision');

/**
 * Configuration for task splitting decisions
 */
export interface TaskSplitConfig {
  /** Minimum context usage to consider splitting (default: 75%) */
  minUsageForSplit: number;

  /** Maximum estimated context for remaining work (default: 20%) */
  maxRemainingContext: number;

  /** Minimum number of pending items to justify split (default: 3) */
  minPendingItems: number;

  /** Enable aggressive splitting at high usage (default: true) */
  aggressiveSplitEnabled: boolean;

  /** Threshold for aggressive splitting (default: 90%) */
  aggressiveSplitThreshold: number;
}

const DEFAULT_CONFIG: TaskSplitConfig = {
  minUsageForSplit: 75,
  maxRemainingContext: 20,
  minPendingItems: 3,
  aggressiveSplitEnabled: true,
  aggressiveSplitThreshold: 90
};

/**
 * Makes intelligent decisions about when to split tasks based on context usage
 */
export class TaskSplitDecisionEngine {
  private config: TaskSplitConfig;

  constructor(config?: Partial<TaskSplitConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };

    log('TaskSplitDecisionEngine initialized with config:', this.config);
  }

  /**
   * Evaluate whether a task should be split based on context and progress
   */
  evaluateSplit(
    contextUsage: ContextUsageData,
    pendingSteps?: EnhancedProgressUpdate[],
    estimatedTokensPerStep?: number
  ): TaskSplitRecommendation {
    const percentage = contextUsage.percentageUsed;

    // Check for aggressive split conditions
    if (this.config.aggressiveSplitEnabled && percentage >= this.config.aggressiveSplitThreshold) {
      return this.recommendAggressiveSplit(contextUsage, pendingSteps);
    }

    // Below minimum threshold - no split needed
    if (percentage < this.config.minUsageForSplit) {
      return {
        shouldSplit: false,
        reason: `Context usage at ${percentage}% is below split threshold of ${this.config.minUsageForSplit}%`
      };
    }

    // Check if there's enough work to justify splitting
    const pendingCount = pendingSteps?.filter(s => s.status === 'PENDING').length ?? 0;
    if (pendingCount < this.config.minPendingItems) {
      return {
        shouldSplit: false,
        reason: `Only ${pendingCount} pending items - below minimum of ${this.config.minPendingItems} for split`
      };
    }

    // Estimate if remaining work can fit in available context
    if (estimatedTokensPerStep && pendingSteps) {
      const estimatedNeeded = this.estimateContextForSteps(pendingSteps, estimatedTokensPerStep);
      const availableTokens = contextUsage.estimatedRemaining;

      if (estimatedNeeded > availableTokens) {
        return this.recommendSplitBasedOnEstimate(
          contextUsage,
          pendingSteps,
          estimatedNeeded,
          availableTokens
        );
      }
    }

    // Check trend - if rapidly increasing, recommend split
    if (contextUsage.trend === 'INCREASING' && percentage >= 80) {
      return {
        shouldSplit: true,
        reason: 'Context usage is rapidly increasing and already at high levels',
        suggestedSplitPoint: this.suggestSplitPoint(pendingSteps),
        priorityItems: this.identifyPriorityItems(pendingSteps)
      };
    }

    // Default: No split needed yet
    return {
      shouldSplit: false,
      reason: 'Context usage is manageable for remaining work'
    };
  }

  /**
   * Recommend aggressive split when context is critical
   */
  private recommendAggressiveSplit(
    contextUsage: ContextUsageData,
    pendingSteps?: EnhancedProgressUpdate[]
  ): TaskSplitRecommendation {
    const criticalItems = this.identifyCriticalItems(pendingSteps);

    return {
      shouldSplit: true,
      reason: `CRITICAL: Context at ${contextUsage.percentageUsed}% - immediate split required to prevent overflow`,
      suggestedSplitPoint: 'Complete current item only',
      estimatedRemainingContext: contextUsage.estimatedRemaining,
      priorityItems: criticalItems.length > 0 ? criticalItems : ['Save current state', 'Create handoff summary']
    };
  }

  /**
   * Recommend split based on context estimates
   */
  private recommendSplitBasedOnEstimate(
    _contextUsage: ContextUsageData,
    pendingSteps: EnhancedProgressUpdate[],
    estimatedNeeded: number,
    availableTokens: number
  ): TaskSplitRecommendation {
    const deficit = estimatedNeeded - availableTokens;
    const stepsToDefer = Math.ceil(deficit / (estimatedNeeded / pendingSteps.length));

    return {
      shouldSplit: true,
      reason: `Estimated ${estimatedNeeded} tokens needed but only ${availableTokens} available`,
      suggestedSplitPoint: `Complete next ${pendingSteps.length - stepsToDefer} items`,
      estimatedRemainingContext: estimatedNeeded,
      priorityItems: this.identifyPriorityItems(pendingSteps)
    };
  }

  /**
   * Estimate context needed for remaining steps
   */
  private estimateContextForSteps(
    steps: EnhancedProgressUpdate[],
    tokensPerStep: number
  ): number {
    const pendingSteps = steps.filter(s => s.status === 'PENDING' || s.status === 'IN_PROGRESS');
    const baseEstimate = pendingSteps.length * tokensPerStep;

    // Add overhead for complex steps
    const complexityMultiplier = this.calculateComplexityMultiplier(pendingSteps);
    return Math.round(baseEstimate * complexityMultiplier);
  }

  /**
   * Calculate complexity multiplier based on step descriptions
   */
  private calculateComplexityMultiplier(steps: EnhancedProgressUpdate[]): number {
    let multiplier = 1.0;

    for (const step of steps) {
      const desc = step.description.toLowerCase();

      // Complex operations need more context
      if (desc.includes('test') || desc.includes('validate')) {
        multiplier += 0.2;
      }
      if (desc.includes('integrate') || desc.includes('migration')) {
        multiplier += 0.3;
      }
      if (desc.includes('refactor') || desc.includes('optimize')) {
        multiplier += 0.25;
      }
      if (desc.includes('debug') || desc.includes('fix')) {
        multiplier += 0.15;
      }
    }

    return Math.min(multiplier, 2.0); // Cap at 2x
  }

  /**
   * Suggest where to split the task
   */
  private suggestSplitPoint(steps?: EnhancedProgressUpdate[]): string {
    if (!steps || steps.length === 0) {
      return 'After current work item';
    }

    const pendingSteps = steps.filter(s => s.status === 'PENDING');
    if (pendingSteps.length === 0) {
      return 'Complete current in-progress items';
    }

    // Find natural breakpoint (e.g., after tests, before deployment)
    for (const step of pendingSteps) {
      const desc = step.description.toLowerCase();
      if (desc.includes('test') || desc.includes('validate') || desc.includes('verify')) {
        return `After step: "${step.description}"`;
      }
    }

    // Default to halfway point
    const midpoint = Math.floor(pendingSteps.length / 2);
    return `After completing next ${midpoint} pending items`;
  }

  /**
   * Identify priority items that must be completed
   */
  private identifyPriorityItems(steps?: EnhancedProgressUpdate[]): string[] {
    if (!steps || steps.length === 0) {
      return ['Complete current work', 'Document progress', 'Create handoff notes'];
    }

    const priorities: string[] = [];
    const inProgress = steps.filter(s => s.status === 'IN_PROGRESS');
    const pending = steps.filter(s => s.status === 'PENDING');

    // In-progress items are always priority
    inProgress.forEach(step => {
      priorities.push(step.description);
    });

    // Look for critical pending items
    for (const step of pending) {
      const desc = step.description.toLowerCase();
      if (desc.includes('critical') || desc.includes('required') || desc.includes('must')) {
        priorities.push(step.description);
      }
      if (priorities.length >= 5) break; // Limit to 5 priority items
    }

    // If no priorities found, take first few pending
    if (priorities.length === 0 && pending.length > 0) {
      priorities.push(...pending.slice(0, 3).map(s => s.description));
    }

    return priorities;
  }

  /**
   * Identify critical items for emergency splits
   */
  private identifyCriticalItems(steps?: EnhancedProgressUpdate[]): string[] {
    if (!steps || steps.length === 0) {
      return [];
    }

    const critical: string[] = [];

    // Only in-progress and critical pending items
    for (const step of steps) {
      if (step.status === 'IN_PROGRESS') {
        critical.push(step.description);
      } else if (step.status === 'PENDING') {
        const desc = step.description.toLowerCase();
        if (desc.includes('save') || desc.includes('commit') || desc.includes('critical')) {
          critical.push(step.description);
        }
      }

      if (critical.length >= 3) break; // Max 3 for emergency
    }

    return critical;
  }

  /**
   * Calculate split urgency score (0-100)
   */
  calculateSplitUrgency(
    contextUsage: ContextUsageData,
    pendingSteps?: EnhancedProgressUpdate[]
  ): number {
    let urgency = 0;

    // Base urgency on usage percentage
    if (contextUsage.percentageUsed >= 95) {
      urgency = 100;
    } else if (contextUsage.percentageUsed >= 90) {
      urgency = 80;
    } else if (contextUsage.percentageUsed >= 85) {
      urgency = 60;
    } else if (contextUsage.percentageUsed >= 80) {
      urgency = 40;
    } else if (contextUsage.percentageUsed >= 75) {
      urgency = 20;
    }

    // Increase urgency based on trend
    if (contextUsage.trend === 'INCREASING') {
      urgency = Math.min(100, urgency + 20);
    }

    // Increase urgency if many pending items
    if (pendingSteps) {
      const pendingCount = pendingSteps.filter(s => s.status === 'PENDING').length;
      if (pendingCount > 10) {
        urgency = Math.min(100, urgency + 15);
      } else if (pendingCount > 5) {
        urgency = Math.min(100, urgency + 10);
      }
    }

    return urgency;
  }

  /**
   * Get configuration
   */
  getConfig(): TaskSplitConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TaskSplitConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    log('Configuration updated:', this.config);
  }
}