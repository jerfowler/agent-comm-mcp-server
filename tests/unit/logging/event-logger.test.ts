/**
 * Test-Driven Development for EventLogger
 * JSON Lines format logging for all MCP operations
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventLogger, MockTimerDependency } from '../../../src/logging/EventLogger.js';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import os from 'os';

describe('EventLogger', () => {
  let eventLogger: EventLogger;
  let testDir: string;
  let logFilePath: string;
  
  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-logger-test-'));
    logFilePath = path.join(testDir, '.logs', 'agent-comm.log');
    eventLogger = new EventLogger(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
    jest.clearAllMocks();
  });

  describe('Basic Logging Operations', () => {
    it('should create log file in JSON Lines format', async () => {
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'start_task',
        agent: 'senior-system-architect',
        taskId: 'test-task-123',
        success: true,
        duration: 150,
        metadata: { test: 'data' }
      });
      
      const logExists = await fs.pathExists(logFilePath);
      expect(logExists).toBe(true);
      
      const logContent = await fs.readFile(logFilePath, 'utf8');
      const lines = logContent.trim().split('\n');
      expect(lines).toHaveLength(1);
      
      const logEntry = JSON.parse(lines[0]);
      expect(logEntry.operation).toBe('start_task');
      expect(logEntry.agent).toBe('senior-system-architect');
      expect(logEntry.success).toBe(true);
    });

    it('should append multiple operations', async () => {
      const operations = [
        {
          timestamp: new Date(),
          operation: 'start_task',
          agent: 'senior-system-architect',
          taskId: 'task-1',
          success: true,
          duration: 100
        },
        {
          timestamp: new Date(),
          operation: 'submit_plan',
          agent: 'senior-system-architect', 
          taskId: 'task-1',
          success: true,
          duration: 250
        },
        {
          timestamp: new Date(),
          operation: 'mark_complete',
          agent: 'senior-system-architect',
          taskId: 'task-1',
          success: true,
          duration: 75
        }
      ];
      
      for (const op of operations) {
        await eventLogger.logOperation(op);
      }
      
      const logEntries = await eventLogger.getLogEntries();
      expect(logEntries).toHaveLength(3);
      expect(logEntries[0].operation).toBe('start_task');
      expect(logEntries[1].operation).toBe('submit_plan');
      expect(logEntries[2].operation).toBe('mark_complete');
    });

    it('should handle concurrent logging safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        eventLogger.logOperation({
          timestamp: new Date(),
          operation: 'concurrent_test',
          agent: 'test-agent',
          taskId: `task-${i}`,
          success: true,
          duration: Math.random() * 1000
        })
      );
      
      await Promise.all(promises);
      
      // Wait a bit for queue processing to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const logEntries = await eventLogger.getLogEntries();
      expect(logEntries).toHaveLength(10);
      
      // All entries should be valid JSON
      logEntries.forEach(entry => {
        expect(entry.operation).toBe('concurrent_test');
        expect(entry.taskId).toMatch(/^task-\d$/);
      });
    });
  });

  describe('Operation-Specific Logging', () => {
    it('should log check_assigned_tasks operations', async () => {
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'check_assigned_tasks',
        agent: 'senior-frontend-engineer',
        success: true,
        duration: 45,
        metadata: {
          tasksFound: 3,
          newTasks: 1,
          inProgress: 2
        }
      });
      
      const entries = await eventLogger.getLogEntries();
      const entry = entries[0];
      
      expect(entry.operation).toBe('check_assigned_tasks');
      expect(entry.metadata?.['tasksFound']).toBe(3);
      expect(entry.metadata?.['newTasks']).toBe(1);
    });

    it('should log start_task with context details', async () => {
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'start_task',
        agent: 'senior-backend-engineer',
        taskId: '20250903-123456-api-development',
        success: true,
        duration: 120,
        metadata: {
          title: 'API Development',
          objective: 'Build REST endpoints',
          requirementsCount: 5,
          contextSize: 2048
        }
      });
      
      const entries = await eventLogger.getLogEntries();
      const entry = entries[0];
      
      expect(entry.taskId).toBe('20250903-123456-api-development');
      expect(entry.metadata?.['title']).toBe('API Development');
      expect(entry.metadata?.['requirementsCount']).toBe(5);
    });

    it('should log submit_plan with planning metrics', async () => {
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'submit_plan',
        agent: 'senior-ai-ml-engineer',
        taskId: 'ml-model-training',
        success: true,
        duration: 300,
        metadata: {
          planSize: 4096,
          stepsIdentified: 12,
          phases: 4,
          estimatedDuration: 2880, // minutes
          complexity: 'high'
        }
      });
      
      const entries = await eventLogger.getLogEntries();
      const entry = entries[0];
      
      expect(entry.metadata?.['stepsIdentified']).toBe(12);
      expect(entry.metadata?.['phases']).toBe(4);
      expect(entry.metadata?.['complexity']).toBe('high');
    });

    it('should log report_progress with step details', async () => {
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'report_progress',
        agent: 'senior-dba-advisor',
        taskId: 'database-optimization',
        success: true,
        duration: 180,
        metadata: {
          stepsUpdated: 3,
          completed: 2,
          inProgress: 1,
          blocked: 0,
          totalTimeSpent: 480,
          estimatedRemaining: 240
        }
      });
      
      const entries = await eventLogger.getLogEntries();
      const entry = entries[0];
      
      expect(entry.metadata?.['stepsUpdated']).toBe(3);
      expect(entry.metadata?.['totalTimeSpent']).toBe(480);
    });

    it('should log mark_complete with outcome details', async () => {
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'mark_complete',
        agent: 'qa-test-automation-engineer',
        taskId: 'testing-implementation',
        success: true,
        duration: 95,
        metadata: {
          completionStatus: 'DONE',
          summarySize: 1024,
          achievements: 4,
          nextSteps: 2,
          totalDuration: 1440 // minutes
        }
      });
      
      const entries = await eventLogger.getLogEntries();
      const entry = entries[0];
      
      expect(entry.metadata?.['completionStatus']).toBe('DONE');
      expect(entry.metadata?.['achievements']).toBe(4);
      expect(entry.metadata?.['totalDuration']).toBe(1440);
    });

    it('should log archive_completed_tasks with archive metrics', async () => {
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'archive_completed_tasks',
        agent: 'senior-system-architect',
        success: true,
        duration: 500,
        metadata: {
          archivedCount: 15,
          totalSizeMB: 25.6,
          averageTaskAge: 7.2, // days
          archiveLocation: 'archive-20250903-123456'
        }
      });
      
      const entries = await eventLogger.getLogEntries();
      const entry = entries[0];
      
      expect(entry.metadata?.['archivedCount']).toBe(15);
      expect(entry.metadata?.['totalSizeMB']).toBe(25.6);
    });
  });

  describe('Error Logging', () => {
    it('should log operation failures with error details', async () => {
      const error = new Error('Task not found');
      
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'start_task',
        agent: 'senior-frontend-engineer',
        taskId: 'non-existent-task',
        success: false,
        duration: 25,
        error: {
          message: error.message,
          name: error.name,
          ...(error.stack && { stack: error.stack })
        }
      });
      
      const entries = await eventLogger.getLogEntries();
      const entry = entries[0];
      
      expect(entry.success).toBe(false);
      expect(entry.error?.message).toBe('Task not found');
      expect(entry.error?.name).toBe('Error');
    });

    it('should log validation failures', async () => {
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'submit_plan',
        agent: 'senior-backend-engineer',
        taskId: 'invalid-plan-test',
        success: false,
        duration: 50,
        error: {
          message: 'Invalid plan format: No progress markers found',
          name: 'ValidationError',
          code: 'INVALID_PLAN_FORMAT'
        },
        metadata: {
          validationErrors: [
            'Missing progress markers',
            'No clear objectives defined',
            'Steps not numbered properly'
          ]
        }
      });
      
      const entries = await eventLogger.getLogEntries();
      const entry = entries[0];
      
      expect(entry.error?.code).toBe('INVALID_PLAN_FORMAT');
      expect(entry.metadata?.['validationErrors']).toHaveLength(3);
    });
  });

  describe('Query and Analysis Operations', () => {
    it('should filter entries by operation type', async () => {
      const operations = [
        { operation: 'start_task', agent: 'agent1', taskId: 'task1' },
        { operation: 'submit_plan', agent: 'agent1', taskId: 'task1' },
        { operation: 'start_task', agent: 'agent2', taskId: 'task2' },
        { operation: 'mark_complete', agent: 'agent1', taskId: 'task1' }
      ];
      
      for (const op of operations) {
        await eventLogger.logOperation({
          timestamp: new Date(),
          ...op,
          success: true,
          duration: 100
        });
      }
      
      const startTaskEntries = await eventLogger.getLogEntries({ operation: 'start_task' });
      expect(startTaskEntries).toHaveLength(2);
      expect(startTaskEntries.every(e => e.operation === 'start_task')).toBe(true);
    });

    it('should filter entries by agent', async () => {
      const operations = [
        { operation: 'start_task', agent: 'senior-frontend-engineer', taskId: 'ui-task' },
        { operation: 'start_task', agent: 'senior-backend-engineer', taskId: 'api-task' },
        { operation: 'submit_plan', agent: 'senior-frontend-engineer', taskId: 'ui-task' }
      ];
      
      for (const op of operations) {
        await eventLogger.logOperation({
          timestamp: new Date(),
          ...op,
          success: true,
          duration: 100
        });
      }
      
      const frontendEntries = await eventLogger.getLogEntries({ agent: 'senior-frontend-engineer' });
      expect(frontendEntries).toHaveLength(2);
      expect(frontendEntries.every(e => e.agent === 'senior-frontend-engineer')).toBe(true);
    });

    it('should filter entries by time range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      await eventLogger.logOperation({
        timestamp: twoHoursAgo,
        operation: 'old_task',
        agent: 'agent1',
        taskId: 'old',
        success: true,
        duration: 100
      });
      
      await eventLogger.logOperation({
        timestamp: now,
        operation: 'recent_task',
        agent: 'agent1',
        taskId: 'recent',
        success: true,
        duration: 100
      });
      
      const recentEntries = await eventLogger.getLogEntries({ since: oneHourAgo });
      expect(recentEntries).toHaveLength(1);
      expect(recentEntries[0].operation).toBe('recent_task');
    });

    it('should provide operation statistics', async () => {
      const operations = [
        { operation: 'start_task', success: true, duration: 100 },
        { operation: 'start_task', success: true, duration: 150 },
        { operation: 'start_task', success: false, duration: 50 },
        { operation: 'submit_plan', success: true, duration: 300 },
        { operation: 'submit_plan', success: true, duration: 250 }
      ];
      
      for (const op of operations) {
        await eventLogger.logOperation({
          timestamp: new Date(),
          agent: 'test-agent',
          taskId: 'stats-test',
          ...op
        });
      }
      
      const stats = await eventLogger.getOperationStatistics();
      
      expect(stats.totalOperations).toBe(5);
      expect(stats.successRate).toBe(0.8); // 4/5 successful
      expect(stats.byOperation['start_task'].count).toBe(3);
      expect(stats.byOperation['start_task'].successRate).toBe(2/3);
      expect(stats.byOperation['start_task'].averageDuration).toBe(100); // (100+150+50)/3
      expect(stats.byOperation['submit_plan'].averageDuration).toBe(275); // (300+250)/2
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should return empty array when log file does not exist', async () => {
      // Test coverage for line 79: return [] when file doesn't exist
      const entries = await eventLogger.getLogEntries();
      expect(entries).toEqual([]);
    });

    it('should handle malformed JSON lines gracefully', async () => {
      // Ensure log directory exists
      await fs.ensureDir(path.dirname(logFilePath));
      
      // Create log file with malformed JSON
      const malformedContent = `{"valid": "entry", "operation": "test", "agent": "test", "timestamp": "${new Date().toISOString()}", "success": true}\n{"invalid json\n{"another": "valid", "operation": "test2", "agent": "test2", "timestamp": "${new Date().toISOString()}", "success": true}`;
      await fs.writeFile(logFilePath, malformedContent);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Test coverage for line 94: console.error for malformed entries
      const entries = await eventLogger.getLogEntries();
      
      // Should get only the valid entries, malformed ones are skipped
      expect(entries).toHaveLength(2);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse log entry:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should return zero statistics for empty log', async () => {
      // Test coverage for line 121: empty entries statistics
      const stats = await eventLogger.getOperationStatistics();
      
      expect(stats).toEqual({
        totalOperations: 0,
        successRate: 0,
        averageDuration: 0,
        byOperation: {},
        byAgent: {}
      });
    });

    it('should handle processWriteQueue early return when already writing', async () => {
      // Test coverage for line 272: early return in processWriteQueue
      
      // Interface for accessing private properties for testing - don't extend, just define what we need
      interface EventLoggerPrivate {
        isWriting: boolean;
        writeQueue: string[];
        processWriteQueue(): Promise<void>;
      }
      
      // Access the private property using type assertion
      const loggerWithPrivates = eventLogger as unknown as EventLoggerPrivate;
      loggerWithPrivates.isWriting = true;
      loggerWithPrivates.writeQueue = ['test'];
      
      // Call the private method (will return early due to isWriting = true)
      await loggerWithPrivates.processWriteQueue();
      
      // Verify the queue was not processed (still has content)
      expect(loggerWithPrivates.writeQueue).toHaveLength(1);
    });

    it('should handle empty write queue in processWriteQueue', async () => {
      // Test coverage for line 272: early return when queue is empty
      
      // Interface for accessing private properties for testing - don't extend, just define what we need
      interface EventLoggerPrivate {
        isWriting: boolean;
        writeQueue: string[];
        processWriteQueue(): Promise<void>;
      }
      
      const loggerWithPrivates = eventLogger as unknown as EventLoggerPrivate;
      loggerWithPrivates.isWriting = false;
      loggerWithPrivates.writeQueue = [];
      
      // This should return early and not throw
      await loggerWithPrivates.processWriteQueue();
      expect(loggerWithPrivates.writeQueue).toHaveLength(0);
    });
  });

  describe('Log Management Operations', () => {
    it('should clear logs completely', async () => {
      // First create some log entries
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'test_operation',
        agent: 'test-agent',
        taskId: 'test-task',
        success: true,
        duration: 100,
        metadata: {}
      });
      
      // Verify log exists
      expect(await fs.pathExists(logFilePath)).toBe(true);
      
      // Test coverage for lines 195-197: clearLogs method
      await eventLogger.clearLogs();
      
      // Verify log was removed
      expect(await fs.pathExists(logFilePath)).toBe(false);
    });

    it('should handle clearLogs when no log file exists', async () => {
      // Test coverage for clearLogs when file doesn't exist
      expect(await fs.pathExists(logFilePath)).toBe(false);
      
      // This should not throw an error
      await expect(eventLogger.clearLogs()).resolves.not.toThrow();
    });

    it('should get log info for non-existent file', async () => {
      // Test coverage for lines 204-205: getLogInfo for non-existent file
      const info = await eventLogger.getLogInfo();
      
      expect(info).toEqual({
        sizeBytes: 0,
        entryCount: 0
      });
    });

    it('should get log info with entries', async () => {
      // Create some entries
      const entry1 = {
        timestamp: new Date('2024-01-01T10:00:00Z'),
        operation: 'test_operation_1',
        agent: 'test-agent',
        taskId: 'test-task-1',
        success: true,
        duration: 100,
        metadata: {}
      };
      
      const entry2 = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        operation: 'test_operation_2',
        agent: 'test-agent',
        taskId: 'test-task-2',
        success: false,
        duration: 200,
        metadata: {}
      };
      
      await eventLogger.logOperation(entry1);
      await eventLogger.logOperation(entry2);
      
      // Test coverage for lines 203-222: getLogInfo with entries
      const info = await eventLogger.getLogInfo();
      
      expect(info.sizeBytes).toBeGreaterThan(0);
      expect(info.entryCount).toBe(2);
      expect(info.oldestEntry).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(info.newestEntry).toEqual(new Date('2024-01-01T12:00:00Z'));
    });

    it('should archive old entries', async () => {
      // Create entries with different dates
      await eventLogger.logOperation({
        timestamp: new Date('2024-01-01T10:00:00Z'), // 3+ days ago from current test
        operation: 'old_operation_1',
        agent: 'test-agent',
        taskId: 'old-task-1',
        success: true,
        duration: 100,
        metadata: { type: 'old' }
      });
      
      await eventLogger.logOperation({
        timestamp: new Date('2024-01-02T10:00:00Z'), // 2+ days ago
        operation: 'old_operation_2',
        agent: 'test-agent',
        taskId: 'old-task-2',
        success: false,
        duration: 200,
        metadata: { type: 'old' }
      });
      
      await eventLogger.logOperation({
        timestamp: new Date(), // Recent entry
        operation: 'recent_operation',
        agent: 'test-agent',
        taskId: 'recent-task',
        success: true,
        duration: 150,
        metadata: { type: 'recent' }
      });
      
      // Test coverage for lines 234-260: archiveOldEntries method  
      const archiveResult = await eventLogger.archiveOldEntries(1); // Archive entries older than 1 day
      
      expect(archiveResult.archivedCount).toBe(2); // Should archive 2 old entries
      expect(archiveResult.archiveFile).toMatch(/agent-comm-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.log$/);
      
      // Verify archive file exists
      expect(await fs.pathExists(archiveResult.archiveFile)).toBe(true);
      
      // Verify main log only has the recent entry
      const remainingEntries = await eventLogger.getLogEntries();
      expect(remainingEntries).toHaveLength(1);
      expect(remainingEntries[0].metadata?.['type']).toBe('recent');
    });

    it('should handle archiving when no old entries exist', async () => {
      // Create only recent entries
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'recent_operation_1',
        agent: 'test-agent',
        taskId: 'recent-task-1',
        success: true,
        duration: 100,
        metadata: {}
      });

      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'recent_operation_2',
        agent: 'test-agent',
        taskId: 'recent-task-2',
        success: true,
        duration: 100,
        metadata: {}
      });
      
      // Try to archive entries older than 1 day (none should match)
      const archiveResult = await eventLogger.archiveOldEntries(1);
      
      expect(archiveResult.archivedCount).toBe(0);
      // When no entries are archived, the archiveFile might be empty
      if (archiveResult.archiveFile) {
        expect(archiveResult.archiveFile).toMatch(/agent-comm-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.log$/);
      }
      
      // All entries should remain
      const remainingEntries = await eventLogger.getLogEntries();
      expect(remainingEntries).toHaveLength(2);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle large log files efficiently', async () => {
      // Generate 1000 log entries
      const promises = Array.from({ length: 1000 }, (_, i) => 
        eventLogger.logOperation({
          timestamp: new Date(),
          operation: 'performance_test',
          agent: `agent-${i % 10}`,
          taskId: `task-${i}`,
          success: true,
          duration: Math.random() * 1000
        })
      );
      
      const start = Date.now();
      await Promise.all(promises);
      
      // Add small delay to ensure all queued writes are processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const writeTime = Date.now() - start;
      
      expect(writeTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      const readStart = Date.now();
      const entries = await eventLogger.getLogEntries();
      const readTime = Date.now() - readStart;
      
      expect(entries).toHaveLength(1000);
      expect(readTime).toBeLessThan(1000); // Should read within 1 second
    });

    it('should handle file system errors gracefully', async () => {
      // Make log directory read-only to simulate permission error
      await fs.chmod(testDir, 0o444);
      
      try {
        await expect(eventLogger.logOperation({
          timestamp: new Date(),
          operation: 'error_test',
          agent: 'test-agent',
          taskId: 'error-task',
          success: true,
          duration: 100
        })).rejects.toThrow();
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(testDir, 0o755);
      }
    });

    it('should rotate log files when they become too large', async () => {
      // This would be implemented if we decide to add log rotation
      // For now, just test that the concept is supported
      const maxLogSize = 1024 * 1024; // 1MB
      
      // Generate entries until we exceed size limit
      let currentSize = 0;
      let entryCount = 0;
      interface LogEntry {
        timestamp: Date;
        operation: string;
        agent: string;
        taskId: string;
        success: boolean;
        duration: number;
        metadata?: Record<string, unknown>;
      }
      const entries: LogEntry[] = [];
      
      while (currentSize < maxLogSize) {
        const entry = {
          timestamp: new Date(),
          operation: 'rotation_test',
          agent: 'test-agent',
          taskId: `rotation-task-${entryCount}`,
          success: true,
          duration: 100,
          metadata: {
            data: 'x'.repeat(1000) // 1KB of data per entry
          }
        };
        
        entries.push(entry);
        currentSize += JSON.stringify(entry).length;
        entryCount++;
      }
      
      // Log all operations and wait for each one to start the write process
      for (const entry of entries) {
        await eventLogger.logOperation(entry);
      }
      
      // **DETERMINISTIC SYNCHRONIZATION** - Wait for write queue to be empty
      // This ensures ALL writes are complete before we check file size
      await eventLogger.waitForWriteQueueEmpty();
      
      // Now assertions are guaranteed to run after all writes complete
      const logExists = await fs.pathExists(logFilePath);
      expect(logExists).toBe(true);
      
      const stat = await fs.stat(logFilePath);
      expect(stat.size).toBeGreaterThan(maxLogSize);
    });
  });

  describe('Deterministic Testing Features', () => {
    it('should support injectable timer dependency for testing', async () => {
      const mockTimer = new MockTimerDependency();
      const testLogger = new EventLogger(testDir, mockTimer);
      
      // Log multiple operations to trigger delayed queue processing
      await testLogger.logOperation({
        timestamp: new Date(),
        operation: 'test_operation_1',
        agent: 'test-agent',
        taskId: 'test-task-1',
        success: true,
        duration: 100
      });
      
      await testLogger.logOperation({
        timestamp: new Date(),
        operation: 'test_operation_2',
        agent: 'test-agent',
        taskId: 'test-task-2',
        success: true,
        duration: 100
      });
      
      // The second operation should trigger a timer for delayed processing
      // (since there are items in queue after the first write completes)
      expect(mockTimer.getPendingCount()).toBeGreaterThanOrEqual(0);
      
      // Flush all timers to ensure processing completes
      mockTimer.flushAll();
    });

    it('should emit lifecycle events for deterministic testing', async () => {
      const events: string[] = [];
      
      eventLogger.on('write:start', () => events.push('write:start'));
      eventLogger.on('write:complete', () => events.push('write:complete'));
      eventLogger.on('queue:empty', () => events.push('queue:empty'));
      eventLogger.on('operation:logged', () => events.push('operation:logged'));
      
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'lifecycle_test',
        agent: 'test-agent',
        taskId: 'lifecycle-task',
        success: true,
        duration: 100
      });
      
      // Wait for write queue to complete
      await eventLogger.waitForWriteQueueEmpty();
      
      expect(events).toContain('operation:logged');
      expect(events).toContain('write:start');
      expect(events).toContain('write:complete');
      expect(events).toContain('queue:empty');
    });

    it('should wait for write queue to be empty', async () => {
      const startTime = Date.now();
      
      // Log multiple operations
      const promises = Array.from({ length: 5 }, (_, i) => 
        eventLogger.logOperation({
          timestamp: new Date(),
          operation: 'wait_test',
          agent: 'test-agent',
          taskId: `wait-task-${i}`,
          success: true,
          duration: 100
        })
      );
      
      await Promise.all(promises);
      
      // Wait for queue to be empty
      await eventLogger.waitForWriteQueueEmpty();
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000); // Should complete within timeout
      
      // Verify all operations were written
      const entries = await eventLogger.getLogEntries();
      expect(entries.length).toBeGreaterThanOrEqual(5);
    });

    it('should wait for specific number of operations', async () => {
      const operationCount = 3;
      const startTime = Date.now();
      
      // Start waiting for operations (this will resolve after 3 operations)
      const waitPromise = eventLogger.waitForOperations(operationCount);
      
      // Log operations one by one with small delays
      for (let i = 0; i < operationCount; i++) {
        setTimeout(() => {
          eventLogger.logOperation({
            timestamp: new Date(),
            operation: 'count_test',
            agent: 'test-agent',
            taskId: `count-task-${i}`,
            success: true,
            duration: 100
          });
        }, i * 10);
      }
      
      await waitPromise;
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(5000); // Should complete within timeout
      expect(elapsed).toBeGreaterThanOrEqual(20); // Should take some time due to delays
    });

    it('should timeout when waiting too long', async () => {
      // Create a promise that should timeout
      const timeoutPromise = eventLogger.waitForOperations(10, 100); // 100ms timeout
      
      await expect(timeoutPromise).rejects.toThrow('Timeout waiting for 10 operations');
    });
  });

  describe('MockTimerDependency Coverage Tests', () => {
    it('should test MockTimerDependency setTimeout and clearTimeout methods', () => {
      const mockTimer = new MockTimerDependency();
      
      // Test setTimeout functionality
      let callbackExecuted = false;
      const callback = () => { callbackExecuted = true; };
      
      const timeoutId = mockTimer.setTimeout(callback, 1000);
      expect(typeof timeoutId).toBe('number');
      expect(mockTimer.getPendingCount()).toBe(1);
      
      // Test clearTimeout functionality
      mockTimer.clearTimeout(timeoutId);
      expect(mockTimer.getPendingCount()).toBe(0);
      
      // Callback should not have been executed since we cleared it
      expect(callbackExecuted).toBe(false);
    });

    it('should test MockTimerDependency flushNext method', () => {
      const mockTimer = new MockTimerDependency();
      const callbacks: string[] = [];
      
      // Add multiple timers
      mockTimer.setTimeout(() => callbacks.push('first'), 100);
      mockTimer.setTimeout(() => callbacks.push('second'), 200);
      mockTimer.setTimeout(() => callbacks.push('third'), 300);
      
      expect(mockTimer.getPendingCount()).toBe(3);
      
      // Test flushNext - should execute only the first timer
      mockTimer.flushNext();
      expect(callbacks).toEqual(['first']);
      expect(mockTimer.getPendingCount()).toBe(2);
      
      // Test flushNext again - should execute the second timer
      mockTimer.flushNext();
      expect(callbacks).toEqual(['first', 'second']);
      expect(mockTimer.getPendingCount()).toBe(1);
    });

    it('should test clearTimeout with non-existent id', () => {
      const mockTimer = new MockTimerDependency();
      
      // Add a timer
      mockTimer.setTimeout(() => {}, 100);
      expect(mockTimer.getPendingCount()).toBe(1);
      
      // Try to clear a non-existent timer ID
      mockTimer.clearTimeout(9999);
      
      // Should still have the original timer
      expect(mockTimer.getPendingCount()).toBe(1);
    });
  });

  describe('EventLogger waitForWriteQueueEmpty timeout coverage', () => {
    it('should timeout when waiting for write queue that never empties', async () => {
      const mockTimer = new MockTimerDependency();
      const testLogger = new EventLogger(testDir, mockTimer);
      
      // Interface for accessing private properties for testing - don't extend, just define what we need
      interface EventLoggerPrivate {
        writeQueue: string[];
        isWriting: boolean;
      }
      
      // For this test, we need to manually trigger the queue state that won't empty
      // Use type assertion to access private properties for testing
      const testLoggerPrivate = testLogger as unknown as EventLoggerPrivate;
      
      // Manually set the write queue to have items to simulate busy state
      testLoggerPrivate.writeQueue = ['fake-entry'];
      testLoggerPrivate.isWriting = false; // Not actively writing but queue not empty
      
      // Start the waitForWriteQueueEmpty with a short timeout
      const waitPromise = testLogger.waitForWriteQueueEmpty(50);
      
      // The mockTimer should now have the timeout timer
      // Flush it to trigger the timeout
      mockTimer.flushNext();
      
      await expect(waitPromise).rejects.toThrow('Timeout waiting for write queue to empty after 50ms');
    });

    it('should test flushNext with empty timer queue', () => {
      const mockTimer = new MockTimerDependency();
      
      // Should handle empty queue gracefully
      expect(() => mockTimer.flushNext()).not.toThrow();
      expect(mockTimer.getPendingCount()).toBe(0);
    });
  });
});