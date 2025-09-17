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
});