/**
 * Context Threshold Detector - Monitors context usage and generates alerts
 * Issue #51: Enhanced Agent Context Reporting
 */

import debug from 'debug';
import type {
  ContextUsageData,
  ContextThresholds,
  ContextAlert
} from '../types/context-types.js';
import { AlertSeverity } from '../types/context-types.js';

const log = debug('agent-comm:core:context-threshold');

/**
 * Default threshold configuration
 */
const DEFAULT_THRESHOLDS: ContextThresholds = {
  warningThreshold: 70,
  criticalThreshold: 85,
  emergencyThreshold: 95
};

/**
 * Monitors context usage and generates alerts when thresholds are exceeded
 */
export class ContextThresholdDetector {
  private thresholds: ContextThresholds;
  private lastAlert: ContextAlert | null = null;
  private alertHistory: ContextAlert[] = [];

  constructor(thresholds?: Partial<ContextThresholds>) {
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...thresholds
    };

    log('ContextThresholdDetector initialized with thresholds:', this.thresholds);
  }

  /**
   * Check context usage and generate alerts if thresholds are exceeded
   */
  checkUsage(usage: ContextUsageData): ContextAlert | null {
    const percentage = usage.percentageUsed;

    // Determine severity based on thresholds
    let severity: AlertSeverity;
    let thresholdExceeded: number;
    let recommendation: string;

    if (percentage >= this.thresholds.emergencyThreshold) {
      severity = AlertSeverity.EMERGENCY;
      thresholdExceeded = this.thresholds.emergencyThreshold;
      recommendation = 'IMMEDIATE ACTION REQUIRED: Split task or complete critical items only. Context overflow imminent.';
    } else if (percentage >= this.thresholds.criticalThreshold) {
      severity = AlertSeverity.CRITICAL;
      thresholdExceeded = this.thresholds.criticalThreshold;
      recommendation = 'Consider task splitting soon. Prioritize remaining work and prepare handoff context.';
    } else if (percentage >= this.thresholds.warningThreshold) {
      severity = AlertSeverity.WARNING;
      thresholdExceeded = this.thresholds.warningThreshold;
      recommendation = 'Monitor context usage closely. Start planning for potential task split if needed.';
    } else {
      // No alert needed
      log(`Context usage at ${percentage}% - within safe limits`);
      return null;
    }

    // Create alert
    const alert: ContextAlert = {
      severity,
      currentUsage: percentage,
      thresholdExceeded,
      recommendation,
      timestamp: new Date().toISOString()
    };

    // Check if we should emit this alert (avoid duplicate alerts)
    if (this.shouldEmitAlert(alert)) {
      log(`Alert generated: ${severity} - ${percentage}% usage exceeds ${thresholdExceeded}% threshold`);
      this.lastAlert = alert;
      this.alertHistory.push(alert);
      return alert;
    }

    return null;
  }

  /**
   * Determine if an alert should be emitted based on history
   */
  private shouldEmitAlert(alert: ContextAlert): boolean {
    // Always emit emergency alerts
    if (alert.severity === AlertSeverity.EMERGENCY) {
      return true;
    }

    // Check if we've already alerted at this level recently
    if (this.lastAlert) {
      // Don't re-alert at the same severity unless usage increased significantly (5%)
      if (this.lastAlert.severity === alert.severity) {
        const usageIncrease = alert.currentUsage - this.lastAlert.currentUsage;
        return usageIncrease >= 5;
      }

      // Always alert if severity increased
      if (this.getSeverityLevel(alert.severity) > this.getSeverityLevel(this.lastAlert.severity)) {
        return true;
      }
    }

    // First alert at this level
    return true;
  }

  /**
   * Get numeric severity level for comparison
   */
  private getSeverityLevel(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.INFO:
        return 1;
      case AlertSeverity.WARNING:
        return 2;
      case AlertSeverity.CRITICAL:
        return 3;
      case AlertSeverity.EMERGENCY:
        return 4;
      default:
        return 0;
    }
  }

  /**
   * Get recommendations based on current usage
   */
  getRecommendations(usage: ContextUsageData): string[] {
    const recommendations: string[] = [];
    const percentage = usage.percentageUsed;

    if (percentage >= this.thresholds.emergencyThreshold) {
      recommendations.push('🚨 EMERGENCY: Context overflow imminent!');
      recommendations.push('• Complete only the most critical tasks');
      recommendations.push('• Create immediate handoff summary');
      recommendations.push('• Split task NOW to preserve work');
    } else if (percentage >= this.thresholds.criticalThreshold) {
      recommendations.push('⚠️ CRITICAL: High context usage detected');
      recommendations.push('• Prioritize remaining work items');
      recommendations.push('• Prepare comprehensive handoff notes');
      recommendations.push('• Consider splitting complex remaining tasks');
    } else if (percentage >= this.thresholds.warningThreshold) {
      recommendations.push('📊 WARNING: Context usage approaching limits');
      recommendations.push('• Monitor usage trend closely');
      recommendations.push('• Start documenting key decisions');
      recommendations.push('• Plan for potential task division');
    } else if (percentage >= 50) {
      recommendations.push('ℹ️ INFO: Context usage at healthy levels');
      recommendations.push('• Continue normal operations');
      recommendations.push('• Maintain awareness of usage trend');
    }

    // Add trend-based recommendations
    if (usage.trend === 'INCREASING' && percentage >= 60) {
      recommendations.push('📈 Usage trend is increasing - plan accordingly');
    } else if (usage.trend === 'STABLE' && percentage >= 70) {
      recommendations.push('➡️ Usage stable but high - optimize if possible');
    }

    return recommendations;
  }

  /**
   * Calculate time until threshold based on usage trend
   */
  estimateTimeToThreshold(
    usage: ContextUsageData,
    tokensPerMinute: number
  ): { threshold: string; minutesRemaining: number } | null {
    if (usage.trend !== 'INCREASING' || tokensPerMinute <= 0) {
      return null;
    }

    const remainingTokens = usage.estimatedRemaining;
    const minutesToEmergency = remainingTokens / tokensPerMinute;

    // Calculate which threshold will be hit first
    const currentPercentage = usage.percentageUsed;

    if (currentPercentage < this.thresholds.warningThreshold) {
      const tokensToWarning = (this.thresholds.warningThreshold - currentPercentage) / 100 * usage.maxTokens;
      return {
        threshold: 'warning',
        minutesRemaining: Math.round(tokensToWarning / tokensPerMinute)
      };
    } else if (currentPercentage < this.thresholds.criticalThreshold) {
      const tokensToCritical = (this.thresholds.criticalThreshold - currentPercentage) / 100 * usage.maxTokens;
      return {
        threshold: 'critical',
        minutesRemaining: Math.round(tokensToCritical / tokensPerMinute)
      };
    } else if (currentPercentage < this.thresholds.emergencyThreshold) {
      const tokensToEmergency = (this.thresholds.emergencyThreshold - currentPercentage) / 100 * usage.maxTokens;
      return {
        threshold: 'emergency',
        minutesRemaining: Math.round(tokensToEmergency / tokensPerMinute)
      };
    }

    return {
      threshold: 'overflow',
      minutesRemaining: Math.round(minutesToEmergency)
    };
  }

  /**
   * Get current threshold configuration
   */
  getThresholds(): ContextThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update threshold configuration
   */
  updateThresholds(thresholds: Partial<ContextThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };
    log('Thresholds updated:', this.thresholds);
  }

  /**
   * Get alert history
   */
  getAlertHistory(): ContextAlert[] {
    return [...this.alertHistory];
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory = [];
    this.lastAlert = null;
    log('Alert history cleared');
  }
}