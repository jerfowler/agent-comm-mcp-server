/**
 * EventLogger - Comprehensive JSON Lines logging for MCP Server
 * Logs all operations with detailed metadata for analysis and debugging
 */

import * as fs from '../utils/fs-extra-safe.js';
import path from 'path';
import { EventEmitter } from 'events';

// Timer dependency injection for deterministic testing
export interface TimerDependency {
  setTimeout(fn: () => void, delay: number): number;
  clearTimeout(handle: number): void;
}

export class DefaultTimerDependency implements TimerDependency {
  setTimeout(fn: () => void, delay: number): number {
    return global.setTimeout(fn, delay) as unknown as number;
  }
  
  clearTimeout(handle: number): void {
    global.clearTimeout(handle as unknown as NodeJS.Timeout);
  }
}

export class MockTimerDependency implements TimerDependency {
  private pendingTimers: { fn: () => void; delay: number; id: number }[] = [];
  private nextId = 0;

  setTimeout(fn: () => void, delay: number): number {
    const id = this.nextId++;
    this.pendingTimers.push({ fn, delay, id });
    return id;
  }

  clearTimeout(handle: number): void {
    const index = this.pendingTimers.findIndex(timer => timer.id === handle);
    if (index !== -1) {
      this.pendingTimers.splice(index, 1);
    }
  }

  // Test control methods
  flushAll(): void {
    const timers = [...this.pendingTimers];
    this.pendingTimers = [];
    timers.forEach(timer => { timer.fn(); });
  }

  flushNext(): void {
    const timer = this.pendingTimers.shift();
    if (timer) {
      timer.fn();
    }
  }

  getPendingCount(): number {
    return this.pendingTimers.length;
  }
}

export interface LogEntry {
  timestamp: Date;
  operation: string;
  agent: string;
  taskId?: string;
  success: boolean;
  duration: number;
  error?: {
    message: string;
    name: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface LogFilter {
  operation?: string;
  agent?: string;
  taskId?: string;
  success?: boolean;
  since?: Date;
  until?: Date;
}

export interface OperationStats {
  totalOperations: number;
  successRate: number;
  averageDuration: number;
  byOperation: Record<string, {
    count: number;
    successRate: number;
    averageDuration: number;
    failures: number;
  }>;
  byAgent: Record<string, {
    count: number;
    successRate: number;
    averageDuration: number;
  }>;
}

export interface EventLoggerConfig {
  maxLogFileSize?: number;
  maxLogAgeHours?: number;
}

export class EventLogger extends EventEmitter {
  private logDir: string;
  private logFilePath: string;
  private writeQueue: LogEntry[] = [];
  private isWriting = false;
  private timerDependency: TimerDependency;
  constructor(logDir: string, timerDependency?: TimerDependency, _config?: EventLoggerConfig) {
    super();
    
    // Use LOG_DIR environment variable or provided logDir, with fallback to .logs
    const envLogDir = process.env['LOG_DIR'];
    if (envLogDir?.trim()) {
      this.logDir = path.isAbsolute(envLogDir) ? envLogDir : path.resolve(logDir, envLogDir);
    } else {
      // Default to .logs subdirectory if no LOG_DIR specified
      this.logDir = path.join(logDir, '.logs');
    }
    
    this.logFilePath = path.join(this.logDir, 'agent-comm.log');
    this.timerDependency = timerDependency ?? new DefaultTimerDependency();
    // Config is received but not used in current implementation
    // Future: implement log rotation based on maxLogFileSize, maxLogAgeHours
    // Note: ensureLogDir() is called in processWriteQueue() to handle async properly
  }

  /**
   * Get the log directory path
   */
  getLogDirectory(): string {
    return this.logDir;
  }

  /**
   * Log a single operation to JSON Lines format
   */
  async logOperation(entry: LogEntry): Promise<void>
  async logOperation(operation: string, agent: string, data?: Record<string, unknown>): Promise<void>
  async logOperation(entryOrOperation: LogEntry | string, agent?: string, data?: Record<string, unknown>): Promise<void> {
    let entry: LogEntry;
    
    if (typeof entryOrOperation === 'string') {
      // Convenience method signature for tests
      entry = {
        timestamp: new Date(),
        operation: entryOrOperation,
        agent: agent ?? 'unknown',
        success: true,
        duration: 0,
        ...(data && { data })
      };
    } else {
      // Standard LogEntry object
      entry = entryOrOperation;
    }
    
    // Add to write queue for batch processing
    this.writeQueue.push(entry);
    
    // Process queue if not already processing
    if (!this.isWriting) {
      await this.processWriteQueue();
    }
    
    // Emit operation logged event for deterministic testing
    this.emit('operation:logged', entry);
  }

  /**
   * Get log entries with optional filtering
   */
  async getLogEntries(filter?: LogFilter): Promise<LogEntry[]> {
    if (!(await fs.pathExists(this.logFilePath))) {
      return [];
    }

    const content = await fs.readFile(this.logFilePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    let entries: LogEntry[] = [];
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LogEntry;
        entry.timestamp = new Date(entry.timestamp); // Parse timestamp
        entries.push(entry);
      } catch (error) {
        // Skip malformed lines
        // eslint-disable-next-line no-console
        console.error('Failed to parse log entry:', error);
      }
    }

    // Apply filters
    if (filter) {
      entries = entries.filter(entry => {
        if (filter.operation && entry.operation !== filter.operation) return false;
        if (filter.agent && entry.agent !== filter.agent) return false;
        if (filter.taskId && entry.taskId !== filter.taskId) return false;
        if (filter.success !== undefined && entry.success !== filter.success) return false;
        if (filter.since && entry.timestamp < filter.since) return false;
        if (filter.until && entry.timestamp > filter.until) return false;
        return true;
      });
    }

    return entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get operation statistics for analysis
   */
  async getOperationStatistics(filter?: LogFilter): Promise<OperationStats> {
    const entries = await this.getLogEntries(filter);
    
    if (entries.length === 0) {
      return {
        totalOperations: 0,
        successRate: 0,
        averageDuration: 0,
        byOperation: {},
        byAgent: {}
      };
    }

    const totalOperations = entries.length;
    const successfulOperations = entries.filter(e => e.success).length;
    const successRate = successfulOperations / totalOperations;
    const averageDuration = entries.reduce((sum, e) => sum + e.duration, 0) / totalOperations;

    // Group by operation
    const byOperation: Record<string, { count: number; successful: number; totalDuration: number; failures: number }> = {};
    
    for (const entry of entries) {
      if (!byOperation[entry.operation]) {
        byOperation[entry.operation] = { count: 0, successful: 0, totalDuration: 0, failures: 0 };
      }
      
      byOperation[entry.operation].count++;
      byOperation[entry.operation].totalDuration += entry.duration;
      
      if (entry.success) {
        byOperation[entry.operation].successful++;
      } else {
        byOperation[entry.operation].failures++;
      }
    }

    // Group by agent
    const byAgent: Record<string, { count: number; successful: number; totalDuration: number }> = {};
    
    for (const entry of entries) {
      if (!byAgent[entry.agent]) {
        byAgent[entry.agent] = { count: 0, successful: 0, totalDuration: 0 };
      }
      
      byAgent[entry.agent].count++;
      byAgent[entry.agent].totalDuration += entry.duration;
      
      if (entry.success) {
        byAgent[entry.agent].successful++;
      }
    }

    return {
      totalOperations,
      successRate,
      averageDuration,
      byOperation: Object.fromEntries(
        Object.entries(byOperation).map(([op, stats]) => [op, {
          count: stats.count,
          successRate: stats.successful / stats.count,
          averageDuration: stats.totalDuration / stats.count,
          failures: stats.failures
        }])
      ),
      byAgent: Object.fromEntries(
        Object.entries(byAgent).map(([agent, stats]) => [agent, {
          count: stats.count,
          successRate: stats.successful / stats.count,
          averageDuration: stats.totalDuration / stats.count
        }])
      )
    };
  }

  /**
   * Clear all log entries (use with caution)
   */
  async clearLogs(): Promise<void> {
    if (await fs.pathExists(this.logFilePath)) {
      await fs.remove(this.logFilePath);
    }
  }

  /**
   * Get log file size and entry count
   */
  async getLogInfo(): Promise<{ sizeBytes: number; entryCount: number; oldestEntry?: Date; newestEntry?: Date }> {
    if (!(await fs.pathExists(this.logFilePath))) {
      return { sizeBytes: 0, entryCount: 0 };
    }

    const stat = await fs.stat(this.logFilePath);
    const entries = await this.getLogEntries();

    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    if (entries.length > 0) {
      const timestamps = entries.map(e => e.timestamp).sort((a, b) => a.getTime() - b.getTime());
      oldestEntry = timestamps[0];
      newestEntry = timestamps[timestamps.length - 1];
    }

    const result: { sizeBytes: number; entryCount: number; oldestEntry?: Date; newestEntry?: Date } = {
      sizeBytes: stat.size,
      entryCount: entries.length
    };
    
    if (oldestEntry) result.oldestEntry = oldestEntry;
    if (newestEntry) result.newestEntry = newestEntry;
    
    return result;
  }

  /**
   * Archive old log entries (move to separate file)
   */
  async archiveOldEntries(olderThanDays: number): Promise<{ archivedCount: number; archiveFile: string }> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const allEntries = await this.getLogEntries();
    
    const oldEntries = allEntries.filter(entry => entry.timestamp < cutoffDate);
    const recentEntries = allEntries.filter(entry => entry.timestamp >= cutoffDate);

    if (oldEntries.length === 0) {
      return { archivedCount: 0, archiveFile: '' };
    }

    // Create archive file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFile = path.join(this.logDir, `agent-comm-${timestamp}.log`);
    
    // Write old entries to archive
    const archiveContent = oldEntries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
    await fs.writeFile(archiveFile, archiveContent);

    // Write recent entries back to main log file
    const recentContent = recentEntries.map(entry => JSON.stringify(entry)).join('\n') + (recentEntries.length > 0 ? '\n' : '');
    await fs.writeFile(this.logFilePath, recentContent);

    return {
      archivedCount: oldEntries.length,
      archiveFile
    };
  }

  /**
   * Wait for write queue to be empty (for deterministic testing)
   */
  async waitForWriteQueueEmpty(timeoutMs = 5000): Promise<void> {
    if (this.writeQueue.length === 0 && !this.isWriting) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const timeout = this.timerDependency.setTimeout(() => {
        this.off('write:complete', checkEmpty);
        this.off('queue:empty', checkEmpty);
        reject(new Error(`Timeout waiting for write queue to empty after ${timeoutMs}ms`));
      }, timeoutMs);
      
      const checkEmpty = () => {
        if (this.writeQueue.length === 0 && !this.isWriting) {
          this.timerDependency.clearTimeout(timeout);
          this.off('write:complete', checkEmpty);
          this.off('queue:empty', checkEmpty);
          resolve();
        }
      };
      
      this.on('write:complete', checkEmpty);
      this.on('queue:empty', checkEmpty);
      
      // Check immediately in case already empty
      checkEmpty();
    });
  }
  
  /**
   * Wait for specific number of operations to complete (for deterministic testing)
   */
  async waitForOperations(count: number, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      let operationCount = 0;
      
      const timeout = this.timerDependency.setTimeout(() => {
        this.off('operation:logged', onOperationLogged);
        reject(new Error(`Timeout waiting for ${count} operations after ${timeoutMs}ms`));
      }, timeoutMs);
      
      const onOperationLogged = () => {
        operationCount++;
        if (operationCount >= count) {
          this.timerDependency.clearTimeout(timeout);
          this.off('operation:logged', onOperationLogged);
          resolve();
        }
      };
      
      this.on('operation:logged', onOperationLogged);
    });
  }

  // Private methods

  private async ensureLogDir(): Promise<void> {
    const logDir = path.dirname(this.logFilePath);
    await fs.ensureDir(logDir);
  }

  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;
    let entriesToWrite: LogEntry[] = [];

    // Emit write start event for deterministic testing
    this.emit('write:start');

    try {
      // Ensure log directory exists before writing
      await this.ensureLogDir();

      // Get all queued entries and clear queue
      entriesToWrite = [...this.writeQueue];
      this.writeQueue = [];

      // Convert to JSON Lines format
      const lines = entriesToWrite.map(entry => JSON.stringify(entry)).join('\n') + '\n';

      // Append to log file
      await fs.appendFile(this.logFilePath, lines);
    } catch (error) {
      // Re-queue failed entries at the beginning
      this.writeQueue.unshift(...entriesToWrite);
      // eslint-disable-next-line no-console
      console.error('Failed to write log entries:', error);
      throw error;
    } finally {
      this.isWriting = false;

      // Emit write complete event for deterministic testing
      this.emit('write:complete');

      // Emit queue empty event if no more entries
      if (this.writeQueue.length === 0) {
        this.emit('queue:empty');
      }

      // Process any new entries that arrived while writing
      if (this.writeQueue.length > 0) {
        // Use injected timer dependency for better concurrency handling and testability
        this.timerDependency.setTimeout(() => {
          this.processWriteQueue().catch(() => {
            // Silently handle errors in background processing to avoid unhandled events during tests
            // The original processWriteQueue already handles and logs errors appropriately
          });
        }, 0);
      }
    }
  }
}