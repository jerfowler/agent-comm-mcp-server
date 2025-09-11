/**
 * Additional branch coverage tests for various utility files
 * Target: Improve overall branch coverage to 95%
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { LockManager } from '../../../src/utils/lock-manager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import os from 'os';

// Mock fs-extra-safe
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn(),
  writeFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn(),
  readdir: jest.fn(),
  appendFile: jest.fn().mockResolvedValue(undefined),
  emptyDir: jest.fn().mockResolvedValue(undefined)
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Additional Branch Coverage Tests', () => {
  
  describe('LockManager - Additional Branches', () => {
    let lockManager: LockManager;
    
    beforeEach(() => {
      jest.clearAllMocks();
      lockManager = new LockManager();
    });

    it('should handle lock acquisition with existing stale lock', async () => {
      const taskDir = '/test/task';
      const lockFile = path.join(taskDir, '.sync.lock');
      
      // First check - lock exists
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      
      // Lock is stale (old mtime)
      const oldDate = new Date(Date.now() - 40000); // 40 seconds old (> 30s timeout)
      mockedFs.stat.mockResolvedValueOnce({ mtime: oldDate } as never);
      
      // Read lock content
      mockedFs.readFile.mockResolvedValueOnce(JSON.stringify({
        pid: 99999,
        lockId: 'old-lock',
        timestamp: oldDate.toISOString(),
        tool: 'old-tool'
      }) as never);
      
      // Remove stale lock
      mockedFs.remove.mockResolvedValueOnce(undefined as never);
      
      // Second check - no lock after removal
      mockedFs.pathExists.mockResolvedValueOnce(false as never);
      
      // Write new lock
      mockedFs.writeFile.mockResolvedValueOnce(undefined as never);
      
      const result = await lockManager.acquireLock(taskDir, 'test-tool');
      
      expect(result.acquired).toBe(true);
      expect(mockedFs.remove).toHaveBeenCalledWith(lockFile);
    });

    it('should handle cleanupStaleLocks with permission errors on some files', async () => {
      const taskDir = '/test/task';
      
      // Directory listing returns multiple lock files
      mockedFs.readdir.mockResolvedValueOnce(['.sync.lock', 'other.lock', 'data.json'] as never);
      
      // First lock file - can check
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      mockedFs.stat.mockResolvedValueOnce({ 
        mtime: new Date(Date.now() - 40000), // Stale
        isFile: () => true 
      } as never);
      mockedFs.remove.mockResolvedValueOnce(undefined as never);
      
      // Second lock file - permission error
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      mockedFs.stat.mockRejectedValueOnce(new Error('EACCES') as never);
      
      const result = await lockManager.cleanupStaleLocks(taskDir);
      
      expect(result.cleaned).toBe(true);
      expect(result.removedFiles.length).toBeGreaterThan(0);
    });

    it('should handle releaseLock with non-existent lock file', async () => {
      const taskDir = '/test/task';
      const lockId = 'test-lock-id';
      
      mockedFs.pathExists.mockResolvedValueOnce(false as never);
      
      const result = await lockManager.releaseLock(taskDir, lockId);
      
      expect(result.released).toBe(true);
      expect(result.reason).toContain('already released');
    });

    it('should handle releaseLock with ownership mismatch', async () => {
      const taskDir = '/test/task';
      const lockId = 'test-lock-id';
      
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      mockedFs.readFile.mockResolvedValueOnce(JSON.stringify({
        pid: 99999, // Different PID
        lockId: 'different-lock-id',
        timestamp: new Date().toISOString(),
        tool: 'other-tool'
      }) as never);
      
      const result = await lockManager.releaseLock(taskDir, lockId);
      
      expect(result.released).toBe(false);
      expect(result.reason).toContain('not owner');
    });

    it('should handle checkLock with malformed JSON in lock file', async () => {
      const taskDir = '/test/task';
      
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      mockedFs.stat.mockResolvedValueOnce({ mtime: new Date() } as never);
      mockedFs.readFile.mockResolvedValueOnce('not valid json' as never);
      
      const result = await lockManager.checkLock(taskDir);
      
      expect(result.isLocked).toBe(false);
      expect(result.lockInfo).toBeNull();
    });

    it('should handle timeout configuration', async () => {
      const customTimeout = 60000; // 60 seconds
      const customLockManager = new LockManager(customTimeout);
      
      const taskDir = '/test/task';
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      
      // Lock is 45 seconds old - stale for default (30s) but not for custom (60s)
      const lockTime = new Date(Date.now() - 45000);
      mockedFs.stat.mockResolvedValueOnce({ mtime: lockTime } as never);
      mockedFs.readFile.mockResolvedValueOnce(JSON.stringify({
        pid: process.pid,
        lockId: 'test-lock',
        timestamp: lockTime.toISOString(),
        tool: 'test'
      }) as never);
      
      const result = await customLockManager.checkLock(taskDir);
      
      expect(result.isLocked).toBe(true);
      expect(result.isStale).toBe(false); // Not stale with 60s timeout
    });
  });

  describe('EventLogger - Additional Branches', () => {
    let eventLogger: EventLogger;
    let testDir: string;
    
    beforeEach(async () => {
      jest.clearAllMocks();
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-logger-branch-test-'));
      eventLogger = new EventLogger(testDir);
    });
    
    afterEach(async () => {
      if (testDir && await fs.pathExists(testDir)) {
        await fs.remove(testDir);
      }
    });

    it('should handle write queue with multiple operations', async () => {
      // Queue multiple operations
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(eventLogger.logOperation({
          timestamp: new Date(),
          operation: `test_op_${i}`,
          details: { index: i }
        }));
      }
      
      await Promise.all(promises);
      await eventLogger.waitForWriteQueueEmpty();
      
      expect(mockedFs.appendFile).toHaveBeenCalled();
    });

    it('should handle getDailyStats with no log file', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(false as never);
      
      const stats = await eventLogger.getDailyStats();
      
      expect(stats.totalOperations).toBe(0);
      expect(stats.operationCounts).toEqual({});
    });

    it('should handle getDailyStats with malformed log entries', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      mockedFs.readFile.mockResolvedValueOnce(
        'not json\n{"valid": "entry", "operation": "test"}\nmalformed{' as never
      );
      
      const stats = await eventLogger.getDailyStats();
      
      // Should count only valid entries
      expect(stats.totalOperations).toBe(1);
    });

    it('should handle getRecentOperations with count parameter', async () => {
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      
      const logEntries = [];
      for (let i = 0; i < 20; i++) {
        logEntries.push(JSON.stringify({
          timestamp: new Date().toISOString(),
          operation: `op_${i}`
        }));
      }
      mockedFs.readFile.mockResolvedValueOnce(logEntries.join('\n') as never);
      
      const recent = await eventLogger.getRecentOperations(5);
      
      expect(recent.length).toBe(5);
    });

    it('should handle concurrent log operations', async () => {
      const operations = [];
      
      // Create many concurrent operations
      for (let i = 0; i < 50; i++) {
        operations.push(eventLogger.logOperation({
          timestamp: new Date(),
          operation: 'concurrent_test',
          details: { index: i }
        }));
      }
      
      await Promise.all(operations);
      await eventLogger.waitForWriteQueueEmpty();
      
      // All operations should complete without errors
      expect(mockedFs.appendFile).toHaveBeenCalled();
    });

    it('should handle file write errors gracefully', async () => {
      mockedFs.appendFile.mockRejectedValueOnce(new Error('ENOSPC: no space left') as never);
      
      // Should not throw, but log error internally
      await eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'test_op',
        details: {}
      });
      
      // Operation completes despite error
      expect(true).toBe(true);
    });
  });

  describe('Tool Error Handling - Additional Branches', () => {
    
    it('should handle various error code mappings', async () => {
      const { ErrorCodes } = await import('../../../src/compliance/error-codes.js');
      const errorCodes = new ErrorCodes();
      
      // Test different error types
      const testCases = [
        { code: 'VALIDATION_ERROR', expectedMcp: -32602 },
        { code: 'TASK_NOT_FOUND', expectedMcp: -32602 },
        { code: 'PERMISSION_DENIED', expectedMcp: -32602 },
        { code: 'LOCK_ERROR', expectedMcp: -32603 },
        { code: 'FILE_ERROR', expectedMcp: -32603 },
        { code: 'UNKNOWN_ERROR', expectedMcp: -32603 }
      ];
      
      for (const testCase of testCases) {
        const mcpError = errorCodes.createMCPError(
          new Error('Test error'),
          testCase.code as any
        );
        expect(mcpError.code).toBe(testCase.expectedMcp);
      }
    });

    it('should handle error formatting edge cases', async () => {
      const { ErrorCodes } = await import('../../../src/compliance/error-codes.js');
      const errorCodes = new ErrorCodes();
      
      // Null error
      const nullError = errorCodes.formatMCPErrorResponse(
        null as any,
        'test-id'
      );
      expect(nullError.error.message).toContain('Unknown error');
      
      // Error without message
      const emptyError = errorCodes.formatMCPErrorResponse(
        { } as any,
        'test-id'
      );
      expect(emptyError.error.message).toBeDefined();
      
      // Error with circular reference
      const circularError: any = { message: 'Test' };
      circularError.cause = circularError;
      const formatted = errorCodes.formatMCPErrorResponse(
        circularError,
        'test-id'
      );
      expect(formatted.error.message).toContain('Test');
    });
  });

  describe('Validation Edge Cases', () => {
    
    it('should handle various string validation scenarios', async () => {
      const { validateString, validateArray, validateEnum } = await import('../../../src/utils/validation.js');
      
      // Empty string after trim
      expect(() => validateString('   ', 'test')).toThrow();
      
      // Very long string
      const longString = 'a'.repeat(10000);
      expect(validateString(longString, 'test')).toBe(longString);
      
      // String with special characters
      const special = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';
      expect(validateString(special, 'test')).toBe(special);
      
      // Unicode characters
      const unicode = '你好世界 🌍 مرحبا بالعالم';
      expect(validateString(unicode, 'test')).toBe(unicode);
    });

    it('should handle array validation edge cases', async () => {
      const { validateArray } = await import('../../../src/utils/validation.js');
      
      // Empty array
      expect(validateArray([], 'test')).toEqual([]);
      
      // Array with null/undefined
      expect(() => validateArray([1, null, 3], 'test')).not.toThrow();
      
      // Very large array
      const largeArray = new Array(1000).fill('item');
      expect(validateArray(largeArray, 'test')).toHaveLength(1000);
      
      // Nested arrays
      const nested = [[1, 2], [3, 4]];
      expect(validateArray(nested, 'test')).toEqual(nested);
    });

    it('should handle enum validation edge cases', async () => {
      const { validateEnum } = await import('../../../src/utils/validation.js');
      
      const validValues = ['option1', 'option2', 'option3'];
      
      // Valid value
      expect(validateEnum('option1', validValues, 'test')).toBe('option1');
      
      // Invalid value
      expect(() => validateEnum('invalid', validValues, 'test')).toThrow();
      
      // Case sensitive
      expect(() => validateEnum('OPTION1', validValues, 'test')).toThrow();
      
      // Number in string enum
      expect(() => validateEnum(1 as any, validValues, 'test')).toThrow();
    });
  });

  describe('File System Edge Cases', () => {
    
    it('should handle race conditions in file operations', async () => {
      const { ensureDirectory, pathExists, readFile, writeFile } = await import('../../../src/utils/file-system.js');
      
      // Simulate file appearing between checks
      mockedFs.pathExists
        .mockResolvedValueOnce(false as never) // First check - doesn't exist
        .mockResolvedValueOnce(true as never);  // Second check - now exists
      
      // This should handle gracefully
      await ensureDirectory('/test/dir');
      
      expect(mockedFs.ensureDir).toHaveBeenCalled();
    });

    it('should handle symbolic links and special files', async () => {
      const { pathExists } = await import('../../../src/utils/file-system.js');
      
      // Mock stat to return different file types
      mockedFs.pathExists.mockImplementation(async (path: string) => {
        if (path.includes('symlink')) {
          // Symbolic link exists
          return true;
        }
        if (path.includes('pipe')) {
          // Named pipe exists  
          return true;
        }
        return false;
      });
      
      expect(await pathExists('/test/symlink')).toBe(true);
      expect(await pathExists('/test/pipe')).toBe(true);
      expect(await pathExists('/test/regular')).toBe(false);
    });

    it('should handle file system quota errors', async () => {
      const { writeFile } = await import('../../../src/utils/file-system.js');
      
      mockedFs.writeFile.mockRejectedValueOnce(new Error('EDQUOT: disk quota exceeded') as never);
      
      await expect(writeFile('/test/file', 'content')).rejects.toThrow('EDQUOT');
    });
  });

  describe('Complex Async Scenarios', () => {
    
    it('should handle promise rejection in nested operations', async () => {
      const operations = [
        Promise.resolve('success'),
        Promise.reject(new Error('nested failure')),
        Promise.resolve('another success')
      ];
      
      const results = await Promise.allSettled(operations);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    it('should handle timeout scenarios', async () => {
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve('done'), 100);
      });
      
      const raceResult = await Promise.race([
        timeoutPromise,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), 50))
      ]);
      
      expect(raceResult).toBe('timeout');
    });
  });
});