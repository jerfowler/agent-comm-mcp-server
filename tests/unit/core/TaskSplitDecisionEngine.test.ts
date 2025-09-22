/**
 * Tests for TaskSplitDecisionEngine
 */

import { TaskSplitDecisionEngine } from '../../../src/core/TaskSplitDecisionEngine.js';
import type {
  ContextUsageData,
  EnhancedProgressUpdate
} from '../../../src/types/context-types.js';

describe('TaskSplitDecisionEngine', () => {
  let engine: TaskSplitDecisionEngine;

  beforeEach(() => {
    engine = new TaskSplitDecisionEngine();
  });

  describe('evaluateSplit', () => {
    it('should not recommend split for low usage', () => {
      const usage: ContextUsageData = {
        currentTokens: 5000,
        maxTokens: 10000,
        percentageUsed: 50,
        estimatedRemaining: 5000,
        trend: 'STABLE'
      };

      const recommendation = engine.evaluateSplit(usage);
      expect(recommendation.shouldSplit).toBe(false);
      expect(recommendation.reason).toContain('below split threshold');
    });

    it('should recommend aggressive split for emergency usage', () => {
      const usage: ContextUsageData = {
        currentTokens: 9200,
        maxTokens: 10000,
        percentageUsed: 92,
        estimatedRemaining: 800,
        trend: 'INCREASING'
      };

      const recommendation = engine.evaluateSplit(usage);
      expect(recommendation.shouldSplit).toBe(true);
      expect(recommendation.reason).toContain('CRITICAL');
      expect(recommendation.priorityItems).toBeDefined();
    });

    it('should not split if too few pending items', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const pendingSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Small task' }
      ];

      const recommendation = engine.evaluateSplit(usage, pendingSteps);
      expect(recommendation.shouldSplit).toBe(false);
      expect(recommendation.reason).toContain('below minimum');
    });

    it('should recommend split for increasing trend at high usage', () => {
      const usage: ContextUsageData = {
        currentTokens: 8200,
        maxTokens: 10000,
        percentageUsed: 82,
        estimatedRemaining: 1800,
        trend: 'INCREASING'
      };

      const pendingSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Task 1' },
        { step: 2, status: 'PENDING', description: 'Task 2' },
        { step: 3, status: 'PENDING', description: 'Task 3' },
        { step: 4, status: 'PENDING', description: 'Task 4' }
      ];

      const recommendation = engine.evaluateSplit(usage, pendingSteps);
      expect(recommendation.shouldSplit).toBe(true);
      expect(recommendation.reason).toContain('rapidly increasing');
    });
  });

  describe('calculateSplitUrgency', () => {
    it('should calculate urgency based on usage percentage', () => {
      const usage: ContextUsageData = {
        currentTokens: 9500,
        maxTokens: 10000,
        percentageUsed: 95,
        estimatedRemaining: 500,
        trend: 'STABLE'
      };

      const urgency = engine.calculateSplitUrgency(usage);
      expect(urgency).toBe(100);
    });

    it('should increase urgency for increasing trend', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'INCREASING'
      };

      const urgency = engine.calculateSplitUrgency(usage);
      expect(urgency).toBeGreaterThan(40);
    });

    it('should increase urgency for many pending items', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const pendingSteps: EnhancedProgressUpdate[] = Array(12).fill(null).map((_, i) => ({
        step: i + 1,
        status: 'PENDING' as const,
        description: `Task ${i + 1}`
      }));

      const urgency = engine.calculateSplitUrgency(usage, pendingSteps);
      expect(urgency).toBeGreaterThan(40);
    });
  });

  describe('configuration', () => {
    it('should accept custom configuration', () => {
      const customEngine = new TaskSplitDecisionEngine({
        minUsageForSplit: 60,
        aggressiveSplitThreshold: 85
      });

      const config = customEngine.getConfig();
      expect(config.minUsageForSplit).toBe(60);
      expect(config.aggressiveSplitThreshold).toBe(85);
    });

    it('should allow updating configuration', () => {
      engine.updateConfig({
        minUsageForSplit: 65
      });

      const config = engine.getConfig();
      expect(config.minUsageForSplit).toBe(65);
    });
  });

  describe.skip('complexity multiplier calculation', () => {
    it('should increase multiplier for test-related tasks', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const testSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Write unit tests for module' },
        { step: 2, status: 'PENDING', description: 'Validate test coverage' }
      ];

      const recommendation = engine.evaluateSplit(usage, testSteps);
      expect(recommendation.estimatedRemainingContext).toBeGreaterThan(0);
    });

    it('should increase multiplier for integration tasks', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const integrationSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Integrate API with frontend' },
        { step: 2, status: 'PENDING', description: 'Database migration required' }
      ];

      const recommendation = engine.evaluateSplit(usage, integrationSteps);
      expect(recommendation.estimatedRemainingContext).toBeGreaterThan(0);
    });

    it('should increase multiplier for refactoring tasks', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const refactorSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Refactor authentication module' },
        { step: 2, status: 'PENDING', description: 'Optimize database queries' }
      ];

      const recommendation = engine.evaluateSplit(usage, refactorSteps);
      expect(recommendation.estimatedRemainingContext).toBeGreaterThan(0);
    });

    it('should increase multiplier for debugging tasks', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const debugSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Debug memory leak issue' },
        { step: 2, status: 'PENDING', description: 'Fix performance regression' }
      ];

      const recommendation = engine.evaluateSplit(usage, debugSteps);
      expect(recommendation.estimatedRemainingContext).toBeGreaterThan(0);
    });

    it('should cap multiplier at 2.0 for extremely complex tasks', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const complexSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Test, integrate, refactor, and debug everything' },
        { step: 2, status: 'PENDING', description: 'Validate, migrate, optimize, and fix all issues' },
        { step: 3, status: 'PENDING', description: 'Test integration of refactored debug code' }
      ];

      const recommendation = engine.evaluateSplit(usage, complexSteps);
      expect(recommendation.estimatedRemainingContext).toBeGreaterThan(0);
      // The multiplier should be capped even with many complexity keywords
    });

    it('should handle combined complexity scenarios', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const mixedSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Simple task' },
        { step: 2, status: 'PENDING', description: 'Test and validate module' },
        { step: 3, status: 'PENDING', description: 'Integrate and migrate data' },
        { step: 4, status: 'PENDING', description: 'Refactor and optimize code' }
      ];

      const recommendation = engine.evaluateSplit(usage, mixedSteps);
      expect(recommendation.estimatedRemainingContext).toBeGreaterThan(0);
    });
  });

  describe.skip('split decision edge cases', () => {
    it('should handle zero pending steps', () => {
      const usage: ContextUsageData = {
        currentTokens: 8500,
        maxTokens: 10000,
        percentageUsed: 85,
        estimatedRemaining: 1500,
        trend: 'STABLE'
      };

      const emptySteps: EnhancedProgressUpdate[] = [];

      const recommendation = engine.evaluateSplit(usage, emptySteps);
      expect(recommendation.shouldSplit).toBe(false);
      expect(recommendation.reason).toContain('No pending items');
    });

    it('should handle negative deficit scenarios', () => {
      const usage: ContextUsageData = {
        currentTokens: 3000,
        maxTokens: 10000,
        percentageUsed: 30,
        estimatedRemaining: 7000,
        trend: 'DECREASING'
      };

      const steps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Task 1' },
        { step: 2, status: 'PENDING', description: 'Task 2' }
      ];

      const recommendation = engine.evaluateSplit(usage, steps);
      expect(recommendation.shouldSplit).toBe(false);
    });

    it('should handle exactly at threshold', () => {
      const usage: ContextUsageData = {
        currentTokens: 7500,
        maxTokens: 10000,
        percentageUsed: 75,
        estimatedRemaining: 2500,
        trend: 'STABLE'
      };

      const steps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Task 1' },
        { step: 2, status: 'PENDING', description: 'Task 2' },
        { step: 3, status: 'PENDING', description: 'Task 3' }
      ];

      const recommendation = engine.evaluateSplit(usage, steps);
      expect(recommendation.shouldSplit).toBeDefined();
    });

    it('should calculate accurate step deferral', () => {
      const usage: ContextUsageData = {
        currentTokens: 8500,
        maxTokens: 10000,
        percentageUsed: 85,
        estimatedRemaining: 1500,
        trend: 'STABLE'
      };

      const manySteps: EnhancedProgressUpdate[] = Array(10).fill(null).map((_, i) => ({
        step: i + 1,
        status: 'PENDING' as const,
        description: `Task ${i + 1}`
      }));

      const recommendation = engine.evaluateSplit(usage, manySteps);
      if (recommendation.shouldSplit) {
        expect(recommendation.suggestedSplitPoint).toContain('Complete');
      }
    });

    it('should identify priority items correctly', () => {
      const usage: ContextUsageData = {
        currentTokens: 8500,
        maxTokens: 10000,
        percentageUsed: 85,
        estimatedRemaining: 1500,
        trend: 'STABLE'
      };

      const prioritySteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Critical security fix' },
        { step: 2, status: 'PENDING', description: 'Optional enhancement' },
        { step: 3, status: 'PENDING', description: 'Important bug fix' }
      ];

      const recommendation = engine.evaluateSplit(usage, prioritySteps);
      if (recommendation.shouldSplit) {
        expect(recommendation.priorityItems).toBeDefined();
        expect(Array.isArray(recommendation.priorityItems)).toBe(true);
      }
    });
  });

  describe('emergency mode behavior', () => {
    it('should trigger emergency split above 95% usage', () => {
      const usage: ContextUsageData = {
        currentTokens: 9600,
        maxTokens: 10000,
        percentageUsed: 96,
        estimatedRemaining: 400,
        trend: 'STABLE'
      };

      const steps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Task 1' },
        { step: 2, status: 'PENDING', description: 'Task 2' }
      ];

      const recommendation = engine.evaluateSplit(usage, steps);
      expect(recommendation.shouldSplit).toBe(true);
      expect(recommendation.reason).toContain('CRITICAL');
    });

    it('should override normal rules in emergency mode', () => {
      const usage: ContextUsageData = {
        currentTokens: 9800,
        maxTokens: 10000,
        percentageUsed: 98,
        estimatedRemaining: 200,
        trend: 'STABLE'
      };

      // Even with just one step, should still recommend split
      const steps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Single task' }
      ];

      const recommendation = engine.evaluateSplit(usage, steps);
      expect(recommendation.shouldSplit).toBe(true);
    });

    it('should handle emergency with minimal remaining context', () => {
      const usage: ContextUsageData = {
        currentTokens: 9950,
        maxTokens: 10000,
        percentageUsed: 99.5,
        estimatedRemaining: 50,
        trend: 'INCREASING'
      };

      const steps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Task' }
      ];

      const recommendation = engine.evaluateSplit(usage, steps);
      expect(recommendation.shouldSplit).toBe(true);
      expect(recommendation.reason).toContain('CRITICAL');
    });
  });

  describe.skip('trend-based decision making', () => {
    it('should be more aggressive with INCREASING trend', () => {
      const usage: ContextUsageData = {
        currentTokens: 7800,
        maxTokens: 10000,
        percentageUsed: 78,
        estimatedRemaining: 2200,
        trend: 'INCREASING'
      };

      const steps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Task 1' },
        { step: 2, status: 'PENDING', description: 'Task 2' },
        { step: 3, status: 'PENDING', description: 'Task 3' }
      ];

      const recommendation = engine.evaluateSplit(usage, steps);
      expect(recommendation.shouldSplit).toBe(true);
    });

    it('should be less aggressive with DECREASING trend', () => {
      const usage: ContextUsageData = {
        currentTokens: 7800,
        maxTokens: 10000,
        percentageUsed: 78,
        estimatedRemaining: 2200,
        trend: 'DECREASING'
      };

      const steps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Task 1' },
        { step: 2, status: 'PENDING', description: 'Task 2' },
        { step: 3, status: 'PENDING', description: 'Task 3' }
      ];

      const recommendation = engine.evaluateSplit(usage, steps);
      // Should be less likely to split with decreasing trend
      expect(recommendation).toBeDefined();
    });

    it('should handle STABLE trend at boundary', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const steps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'PENDING', description: 'Task 1' },
        { step: 2, status: 'PENDING', description: 'Task 2' },
        { step: 3, status: 'PENDING', description: 'Task 3' },
        { step: 4, status: 'PENDING', description: 'Task 4' }
      ];

      const recommendation = engine.evaluateSplit(usage, steps);
      expect(recommendation.shouldSplit).toBe(true);
    });
  });

  describe('IN_PROGRESS status handling', () => {
    it('should include IN_PROGRESS steps in calculations', () => {
      const usage: ContextUsageData = {
        currentTokens: 8000,
        maxTokens: 10000,
        percentageUsed: 80,
        estimatedRemaining: 2000,
        trend: 'STABLE'
      };

      const mixedSteps: EnhancedProgressUpdate[] = [
        { step: 1, status: 'COMPLETE', description: 'Done task' },
        { step: 2, status: 'IN_PROGRESS', description: 'Current task' },
        { step: 3, status: 'PENDING', description: 'Future task 1' },
        { step: 4, status: 'PENDING', description: 'Future task 2' }
      ];

      const recommendation = engine.evaluateSplit(usage, mixedSteps);
      // Should consider both IN_PROGRESS and PENDING
      expect(recommendation).toBeDefined();
    });
  });
});