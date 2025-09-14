/**
 * ErrorLogger - Enhanced error tracking and analysis for MCP Server
 * Captures, categorizes, and analyzes all system errors for improvement
 */

import { EventLogger, TimerDependency, LogEntry } from './EventLogger.js';
import * as fs from '../utils/fs-extra-safe.js';
import path from 'path';
import debug from 'debug';

const log = debug('agent-comm:logging:error');

export interface ErrorLogEntry {
  timestamp: Date;
  source: 'mcp_server' | 'tool_execution' | 'runtime' | 'validation' | 'network';
  operation: string;
  agent: string;
  taskId?: string;
  error: {
    message: string;
    name: string;
    code?: string | number | undefined;
    stack?: string | undefined;
  };
  context: {
    tool?: string;
    parameters?: Record<string, unknown>;
    responseCode?: number;
    retryCount?: number;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorsBySource: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  commonPatterns: {
    pattern: string;
    frequency: number;
    lastOccurrence: Date;
  }[];
  agentErrorRates: Record<string, {
    totalErrors: number;
    errorRate: number;
    mostCommonErrors: string[];
  }>;
}

export class ErrorLogger extends EventLogger {
  private errorLogPath: string;

  constructor(baseDir: string, timerDependency?: TimerDependency) {
    super(baseDir, timerDependency);
    this.errorLogPath = path.join(this.getLogDirectory(), 'error.log');
    log('ErrorLogger initialized with error log: %s', this.errorLogPath);
  }

  /**
   * Get the error log file path
   */
  getErrorLogPath(): string {
    return this.errorLogPath;
  }

  /**
   * Log an error entry to both error.log and agent-comm.log
   */
  async logError(entry: ErrorLogEntry): Promise<void> {
    log('Logging error: %s - %s', entry.operation, entry.error.message);

    // Ensure log directory exists
    await fs.ensureDir(this.getLogDirectory());

    // Write to error.log
    const errorLine = JSON.stringify(entry) + '\n';
    await fs.appendFile(this.errorLogPath, errorLine);

    // Build LogEntry with proper optional handling for exactOptionalPropertyTypes
    const logEntry: LogEntry = {
      timestamp: entry.timestamp,
      operation: `error:${entry.operation}`,
      agent: entry.agent,
      success: false,
      duration: 0,
      error: {
        message: entry.error.message,
        name: entry.error.name,
        ...(entry.error.stack !== undefined ? { stack: entry.error.stack } : {}),
        ...(entry.error.code !== undefined ? {
          code: typeof entry.error.code === 'number' ? String(entry.error.code) : entry.error.code
        } : {})
      },
      metadata: {
        ...entry.metadata,
        source: entry.source,
        severity: entry.severity,
        context: entry.context
      },
      ...(entry.taskId !== undefined ? { taskId: entry.taskId } : {})
    };

    await this.logOperation(logEntry);
  }

  /**
   * Analyze error patterns across all logged errors
   */
  async analyzeErrorPatterns(): Promise<ErrorAnalysis> {
    const errors = await this.getAllErrors();

    const analysis: ErrorAnalysis = {
      totalErrors: errors.length,
      errorsBySource: {},
      errorsBySeverity: {},
      commonPatterns: [],
      agentErrorRates: {}
    };

    if (errors.length === 0) {
      return analysis;
    }

    // Count by source
    for (const error of errors) {
      analysis.errorsBySource[error.source] = (analysis.errorsBySource[error.source] ?? 0) + 1;
      analysis.errorsBySeverity[error.severity] = (analysis.errorsBySeverity[error.severity] ?? 0) + 1;
    }

    // Find common patterns
    const patternMap = new Map<string, { count: number; lastOccurrence: Date }>();
    for (const error of errors) {
      const pattern = `${error.error.name}: ${error.error.message}`;
      const existing = patternMap.get(pattern);
      if (existing) {
        existing.count++;
        if (error.timestamp > existing.lastOccurrence) {
          existing.lastOccurrence = error.timestamp;
        }
      } else {
        patternMap.set(pattern, { count: 1, lastOccurrence: error.timestamp });
      }
    }

    // Convert to array and sort by frequency
    analysis.commonPatterns = Array.from(patternMap.entries())
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        lastOccurrence: data.lastOccurrence
      }))
      .sort((a, b) => b.frequency - a.frequency);

    // Calculate agent error rates
    const agentErrors = new Map<string, ErrorLogEntry[]>();
    for (const error of errors) {
      const existing = agentErrors.get(error.agent) ?? [];
      existing.push(error);
      agentErrors.set(error.agent, existing);
    }

    for (const [agent, agentErrorList] of agentErrors.entries()) {
      const errorTypes = new Map<string, number>();
      for (const error of agentErrorList) {
        const type = error.error.name;
        errorTypes.set(type, (errorTypes.get(type) ?? 0) + 1);
      }

      const mostCommon = Array.from(errorTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type]) => type);

      analysis.agentErrorRates[agent] = {
        totalErrors: agentErrorList.length,
        errorRate: agentErrorList.length / errors.length,
        mostCommonErrors: mostCommon
      };
    }

    return analysis;
  }

  /**
   * Get errors for a specific agent
   */
  async getErrorsByAgent(agent: string): Promise<ErrorLogEntry[]> {
    const errors = await this.getAllErrors();
    return errors.filter(e => e.agent === agent);
  }

  /**
   * Get errors by severity level
   */
  async getErrorsBySeverity(severity: string): Promise<ErrorLogEntry[]> {
    const errors = await this.getAllErrors();
    return errors.filter(e => e.severity === severity);
  }

  /**
   * Get errors within a time range
   */
  async getErrorsByTimeRange(start: Date, end: Date): Promise<ErrorLogEntry[]> {
    const errors = await this.getAllErrors();
    return errors.filter(e => {
      const timestamp = new Date(e.timestamp);
      return timestamp >= start && timestamp <= end;
    });
  }

  /**
   * Analyze error patterns across all logged errors
   */
  async analyzeErrors(): Promise<ErrorAnalysis> {
    return this.analyzeErrorPatterns();
  }

  /**
   * Get common error patterns
   */
  async getErrorPatterns(): Promise<{ pattern: string; frequency: number; lastOccurrence: Date }[]> {
    const analysis = await this.analyzeErrorPatterns();
    return analysis.commonPatterns;
  }

  /**
   * Get error rates by agent
   */
  async getAgentErrorRates(): Promise<Record<string, {
    totalErrors: number;
    errorRate: number;
    mostCommonErrors: string[];
  }>> {
    const analysis = await this.analyzeErrorPatterns();
    return analysis.agentErrorRates;
  }

  /**
   * Generate a comprehensive error report
   */
  async generateErrorReport(): Promise<string> {
    const analysis = await this.analyzeErrorPatterns();
    const now = new Date().toISOString();

    let report = `# Error Report\n`;
    report += `Generated: ${now}\n\n`;

    report += `## Summary\n`;
    report += `Total Errors: ${analysis.totalErrors}\n\n`;

    report += `## Errors by Source\n`;
    for (const [source, count] of Object.entries(analysis.errorsBySource)) {
      report += `- ${source}: ${count}\n`;
    }
    report += '\n';

    report += `## Errors by Severity\n`;
    for (const [severity, count] of Object.entries(analysis.errorsBySeverity)) {
      report += `- ${severity}: ${count}\n`;
    }
    report += '\n';

    report += `## Common Patterns\n`;
    for (const pattern of analysis.commonPatterns.slice(0, 10)) {
      report += `- "${pattern.pattern}" (${pattern.frequency} occurrences)\n`;
    }
    report += '\n';

    report += `## Agent Error Rates\n`;
    for (const [agent, stats] of Object.entries(analysis.agentErrorRates)) {
      report += `### ${agent}\n`;
      report += `- Total Errors: ${stats.totalErrors}\n`;
      report += `- Error Rate: ${(stats.errorRate * 100).toFixed(1)}%\n`;
      report += `- Most Common: ${stats.mostCommonErrors.join(', ')}\n\n`;
    }

    return report;
  }

  /**
   * Clear error entries older than specified days
   */
  async clearOldErrors(retentionDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const errors = await this.getAllErrors();

    const recentErrors = errors.filter(e => new Date(e.timestamp) >= cutoffDate);
    const removedCount = errors.length - recentErrors.length;

    if (removedCount > 0) {
      // Write back only recent errors
      const content = recentErrors.map(e => JSON.stringify(e)).join('\n') + (recentErrors.length > 0 ? '\n' : '');
      await fs.writeFile(this.errorLogPath, content);
    }

    return removedCount;
  }

  /**
   * Get all error entries from error.log
   */
  private async getAllErrors(): Promise<ErrorLogEntry[]> {
    if (!(await fs.pathExists(this.errorLogPath))) {
      return [];
    }

    const content = await fs.readFile(this.errorLogPath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const errors: ErrorLogEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ErrorLogEntry;
        entry.timestamp = new Date(entry.timestamp);
        errors.push(entry);
      } catch (error) {
        // Skip malformed lines silently - already logged in EventLogger
        void error;
      }
    }

    return errors;
  }
}