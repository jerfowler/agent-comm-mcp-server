/**
 * Tests for ContextThresholdDetector
 */

import { ContextThresholdDetector } from '../../../src/core/ContextThresholdDetector.js';
import { AlertSeverity } from '../../../src/types/context-types.js';
import type {
  ContextUsageData,
  ContextThresholds
} from '../../../src/types/context-types.js';

describe('ContextThresholdDetector', () => {
  let detector: ContextThresholdDetector;

  beforeEach(() => {
    detector = new ContextThresholdDetector();
  });

  describe('checkUsage', () => {
    it('should return null when usage is below warning threshold', () => {
      const usage: ContextUsageData = {
        currentTokens: 5000,
        maxTokens: 10000,
        percentageUsed: 50,
        estimatedRemaining: 5000,
        trend: 'STABLE'
      };

      const alert = detector.checkUsage(usage);
      expect(alert).toBeNull();
    });

    it('should generate WARNING alert at 70% usage', () => {
      const usage: ContextUsageData = {
        currentTokens: 7000,
        maxTokens: 10000,
        percentageUsed: 70,
        estimatedRemaining: 3000,
        trend: 'INCREASING'
      };

      const alert = detector.checkUsage(usage);
      expect(alert).not.toBeNull();
      expect(alert?.severity).toBe(AlertSeverity.WARNING);
      expect(alert?.thresholdExceeded).toBe(70);
      expect(alert?.recommendation).toContain('Monitor context usage closely');
    });

    it('should generate CRITICAL alert at 85% usage', () => {
      const usage: ContextUsageData = {
        currentTokens: 8500,
        maxTokens: 10000,
        percentageUsed: 85,
        estimatedRemaining: 1500,
        trend: 'INCREASING'
      };

      const alert = detector.checkUsage(usage);
      expect(alert).not.toBeNull();
      expect(alert?.severity).toBe(AlertSeverity.CRITICAL);
      expect(alert?.thresholdExceeded).toBe(85);
      expect(alert?.recommendation).toContain('Consider task splitting soon');
    });

    it('should generate EMERGENCY alert at 95% usage', () => {
      const usage: ContextUsageData = {
        currentTokens: 9500,
        maxTokens: 10000,
        percentageUsed: 95,
        estimatedRemaining: 500,
        trend: 'INCREASING'
      };

      const alert = detector.checkUsage(usage);
      expect(alert).not.toBeNull();
      expect(alert?.severity).toBe(AlertSeverity.EMERGENCY);
      expect(alert?.thresholdExceeded).toBe(95);
      expect(alert?.recommendation).toContain('IMMEDIATE ACTION REQUIRED');
    });

    it('should not duplicate alerts at same severity level', () => {
      const usage: ContextUsageData = {
        currentTokens: 7000,
        maxTokens: 10000,
        percentageUsed: 71,
        estimatedRemaining: 2900,
        trend: 'STABLE'
      };

      // First alert should be generated
      const alert1 = detector.checkUsage(usage);
      expect(alert1).not.toBeNull();

      // Second alert at similar level should not be generated
      usage.percentageUsed = 72;
      const alert2 = detector.checkUsage(usage);
      expect(alert2).toBeNull();

      // Alert should be generated if usage increases significantly (5%)
      usage.percentageUsed = 76;
      const alert3 = detector.checkUsage(usage);
      expect(alert3).not.toBeNull();
    });

    it('should always alert when severity increases', () => {
      // Start with WARNING
      const usage: ContextUsageData = {
        currentTokens: 7000,
        maxTokens: 10000,
        percentageUsed: 70,
        estimatedRemaining: 3000,
        trend: 'INCREASING'
      };

      const alert1 = detector.checkUsage(usage);
      expect(alert1?.severity).toBe(AlertSeverity.WARNING);

      // Increase to CRITICAL
      usage.percentageUsed = 85;
      usage.currentTokens = 8500;
      usage.estimatedRemaining = 1500;

      const alert2 = detector.checkUsage(usage);
      expect(alert2).not.toBeNull();
      expect(alert2?.severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('getRecommendations', () => {
    it('should provide appropriate recommendations for each level', () => {
      // Below warning
      let usage: ContextUsageData = {
        currentTokens: 5000,
        maxTokens: 10000,
        percentageUsed: 50,
        estimatedRemaining: 5000,
        trend: 'STABLE'
      };

      let recommendations = detector.getRecommendations(usage);
      expect(recommendations).toHaveLength(3);
      expect(recommendations[0]).toContain('INFO');

      // Warning level
      usage.percentageUsed = 72;
      recommendations = detector.getRecommendations(usage);
      expect(recommendations.some(r => r.includes('WARNING'))).toBe(true);
      expect(recommendations.some(r => r.includes('Monitor'))).toBe(true);

      // Critical level
      usage.percentageUsed = 87;
      recommendations = detector.getRecommendations(usage);
      expect(recommendations.some(r => r.includes('CRITICAL'))).toBe(true);
      expect(recommendations.some(r => r.includes('Prioritize'))).toBe(true);

      // Emergency level
      usage.percentageUsed = 96;
      recommendations = detector.getRecommendations(usage);
      expect(recommendations.some(r => r.includes('EMERGENCY'))).toBe(true);
      expect(recommendations.some(r => r.includes('Split task NOW'))).toBe(true);
    });

    it('should include trend-based recommendations', () => {
      const usage: ContextUsageData = {
        currentTokens: 6500,
        maxTokens: 10000,
        percentageUsed: 65,
        estimatedRemaining: 3500,
        trend: 'INCREASING'
      };

      const recommendations = detector.getRecommendations(usage);
      expect(recommendations.some(r => r.includes('trend is increasing'))).toBe(true);
    });
  });

  describe('estimateTimeToThreshold', () => {
    it('should estimate time to next threshold', () => {
      const usage: ContextUsageData = {
        currentTokens: 5000,
        maxTokens: 10000,
        percentageUsed: 50,
        estimatedRemaining: 5000,
        trend: 'INCREASING'
      };

      const tokensPerMinute = 100;
      const estimate = detector.estimateTimeToThreshold(usage, tokensPerMinute);

      expect(estimate).not.toBeNull();
      expect(estimate?.threshold).toBe('warning');
      expect(estimate?.minutesRemaining).toBe(20); // (70-50)% of 10000 / 100
    });

    it('should return null for non-increasing trend', () => {
      const usage: ContextUsageData = {
        currentTokens: 5000,
        maxTokens: 10000,
        percentageUsed: 50,
        estimatedRemaining: 5000,
        trend: 'STABLE'
      };

      const estimate = detector.estimateTimeToThreshold(usage, 100);
      expect(estimate).toBeNull();
    });

    it('should estimate time to overflow when above emergency', () => {
      const usage: ContextUsageData = {
        currentTokens: 9600,
        maxTokens: 10000,
        percentageUsed: 96,
        estimatedRemaining: 400,
        trend: 'INCREASING'
      };

      const estimate = detector.estimateTimeToThreshold(usage, 100);
      expect(estimate).not.toBeNull();
      expect(estimate?.threshold).toBe('overflow');
      expect(estimate?.minutesRemaining).toBe(4); // 400 tokens / 100 per minute
    });
  });

  describe('custom thresholds', () => {
    it('should accept custom threshold configuration', () => {
      const customThresholds: ContextThresholds = {
        warningThreshold: 60,
        criticalThreshold: 80,
        emergencyThreshold: 90
      };

      const customDetector = new ContextThresholdDetector(customThresholds);

      const usage: ContextUsageData = {
        currentTokens: 6000,
        maxTokens: 10000,
        percentageUsed: 60,
        estimatedRemaining: 4000,
        trend: 'STABLE'
      };

      const alert = customDetector.checkUsage(usage);
      expect(alert).not.toBeNull();
      expect(alert?.severity).toBe(AlertSeverity.WARNING);
      expect(alert?.thresholdExceeded).toBe(60);
    });

    it('should allow updating thresholds after initialization', () => {
      const usage: ContextUsageData = {
        currentTokens: 6500,
        maxTokens: 10000,
        percentageUsed: 65,
        estimatedRemaining: 3500,
        trend: 'STABLE'
      };

      // Initially no alert at 65%
      let alert = detector.checkUsage(usage);
      expect(alert).toBeNull();

      // Update threshold to trigger at 65%
      detector.updateThresholds({ warningThreshold: 65 });

      // Clear history to allow new alert
      detector.clearHistory();

      alert = detector.checkUsage(usage);
      expect(alert).not.toBeNull();
      expect(alert?.severity).toBe(AlertSeverity.WARNING);
    });
  });

  describe('alert history', () => {
    it('should maintain alert history', () => {
      const usages: ContextUsageData[] = [
        {
          currentTokens: 7000,
          maxTokens: 10000,
          percentageUsed: 70,
          estimatedRemaining: 3000,
          trend: 'INCREASING'
        },
        {
          currentTokens: 8500,
          maxTokens: 10000,
          percentageUsed: 85,
          estimatedRemaining: 1500,
          trend: 'INCREASING'
        }
      ];

      usages.forEach(usage => detector.checkUsage(usage));

      const history = detector.getAlertHistory();
      expect(history).toHaveLength(2);
      expect(history[0].severity).toBe(AlertSeverity.WARNING);
      expect(history[1].severity).toBe(AlertSeverity.CRITICAL);
    });

    it('should clear history when requested', () => {
      const usage: ContextUsageData = {
        currentTokens: 7000,
        maxTokens: 10000,
        percentageUsed: 70,
        estimatedRemaining: 3000,
        trend: 'STABLE'
      };

      detector.checkUsage(usage);
      expect(detector.getAlertHistory()).toHaveLength(1);

      detector.clearHistory();
      expect(detector.getAlertHistory()).toHaveLength(0);
    });
  });
});