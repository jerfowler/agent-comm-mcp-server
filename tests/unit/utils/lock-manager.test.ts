/**
 * Unit tests for lock-manager utility - TDD Implementation
 * Comprehensive testing for lock acquisition, release, timeout, and cleanup
 */

import { jest } from '@jest/globals';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import * as path from 'path';
import { LockManager } from '../../../src/utils/lock-manager.js';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('LockManager (TDD)', () => {
  const testBaseDir = '/test/task-dir';
  const lockManager = new LockManager();
  const testLockFile = path.join(testBaseDir, '.sync.lock');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks - no existing locks
    mockedFs.pathExists.mockResolvedValue(false as never);
    mockedFs.writeFile.mockResolvedValue(undefined as never);
    mockedFs.remove.mockResolvedValue(undefined as never);
    mockedFs.readdir.mockResolvedValue([] as never);
    mockedFs.readFile.mockResolvedValue('{}' as never);
    mockedFs.stat.mockResolvedValue({ 
      mtime: new Date() 
    } as never);
  });

  describe('Lock Acquisition', () => {
    it('should successfully acquire lock when no existing lock exists', async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);

      const result = await lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes');

      expect(result.acquired).toBe(true);
      expect(result.lockId).toBeDefined();
      expect(result.lockFile).toBe(testLockFile);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        testLockFile,
        expect.stringContaining('sync-todo-checkboxes')
      );
    });

    it('should include process and timestamp in lock file content', async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);

      await lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes');

      const lockContent = (mockedFs.writeFile as unknown as jest.Mock).mock.calls[0][1] as string;
      const lockData = JSON.parse(lockContent);

      expect(lockData).toMatchObject({
        tool: 'sync-todo-checkboxes',
        pid: expect.any(Number),
        timestamp: expect.any(Number),
        lockId: expect.any(String)
      });
    });

    it('should reject lock acquisition when lock already exists and is fresh', async () => {
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ 
        mtime: new Date() // Fresh lock (current time)
      } as never);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        tool: 'report-progress',
        pid: 12345,
        timestamp: Date.now(),
        lockId: 'existing-lock-id'
      }) as never);

      const result = await lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes');

      expect(result.acquired).toBe(false);
      expect(result.reason).toContain('locked by report-progress');
      expect(result.existingLock).toBeDefined();
      expect(result.existingLock?.tool).toBe('report-progress');
    });

    it('should acquire lock after cleaning up stale lock', async () => {
      const staleTime = new Date(Date.now() - 35000); // 35 seconds ago (stale)
      
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: staleTime } as never);
      // Mock readdir for cleanupStaleLocks to find lock files
      mockedFs.readdir.mockResolvedValue(['.sync.lock'] as never);

      const result = await lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes');

      expect(result.acquired).toBe(true);
      expect(result.lockId).toBeDefined();
      expect(mockedFs.remove).toHaveBeenCalledWith(testLockFile); // Cleanup stale lock
      expect(mockedFs.writeFile).toHaveBeenCalledWith(testLockFile, expect.any(String)); // Create new lock
    });

    it('should handle lock file creation errors gracefully', async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);
      mockedFs.writeFile.mockRejectedValue(new Error('Permission denied') as never);

      await expect(lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes'))
        .rejects.toThrow('Failed to acquire lock');
    });

    it('should validate required parameters', async () => {
      await expect(lockManager.acquireLock('', 'sync-todo-checkboxes'))
        .rejects.toThrow('taskDir is required');

      await expect(lockManager.acquireLock(testBaseDir, ''))
        .rejects.toThrow('toolName is required');
    });

    it('should handle malformed existing lock files', async () => {
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: new Date() } as never);
      mockedFs.readFile.mockResolvedValue('invalid-json' as never);

      // Should clean up malformed lock and acquire new one
      const result = await lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes');

      expect(result.acquired).toBe(true);
      expect(mockedFs.remove).toHaveBeenCalledWith(testLockFile);
    });
  });

  describe('Lock Release', () => {
    it('should successfully release owned lock', async () => {
      // First acquire a lock
      mockedFs.pathExists.mockResolvedValueOnce(false as never);
      const acquireResult = await lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes');

      // Then release it
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        tool: 'sync-todo-checkboxes',
        pid: process.pid,
        timestamp: Date.now(),
        lockId: acquireResult.lockId
      }) as never);

      const result = await lockManager.releaseLock(testBaseDir, acquireResult.lockId!);

      expect(result.released).toBe(true);
      expect(mockedFs.remove).toHaveBeenCalledWith(testLockFile);
    });

    it('should handle release of non-existent lock gracefully', async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);

      const result = await lockManager.releaseLock(testBaseDir, 'non-existent-lock-id');

      expect(result.released).toBe(true);
      expect(result.reason).toContain('no lock file found');
    });

    it('should prevent release of lock owned by different process/tool', async () => {
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        tool: 'report-progress',
        pid: 99999, // Different PID
        timestamp: Date.now(),
        lockId: 'different-lock-id'
      }) as never);

      const result = await lockManager.releaseLock(testBaseDir, 'my-lock-id');

      expect(result.released).toBe(false);
      expect(result.reason).toContain('not owner');
      expect(mockedFs.remove).not.toHaveBeenCalled();
    });


    it('should validate required parameters for release', async () => {
      await expect(lockManager.releaseLock('', 'lock-id'))
        .rejects.toThrow('taskDir is required');

      await expect(lockManager.releaseLock(testBaseDir, ''))
        .rejects.toThrow('lockId is required');
    });
  });

  describe('Lock Status Checking', () => {
    it('should return no lock when no lock file exists', async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);

      const status = await lockManager.checkLock(testBaseDir);

      expect(status.isLocked).toBe(false);
      expect(status.lockInfo).toBeNull();
    });

    it('should return lock info when valid lock exists', async () => {
      const lockData = {
        tool: 'sync-todo-checkboxes',
        pid: 12345,
        timestamp: Date.now(),
        lockId: 'test-lock-id'
      };

      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: new Date() } as never);
      mockedFs.readFile.mockResolvedValue(JSON.stringify(lockData) as never);

      const status = await lockManager.checkLock(testBaseDir);

      expect(status.isLocked).toBe(true);
      expect(status.lockInfo).toMatchObject({
        tool: 'sync-todo-checkboxes',
        pid: 12345,
        lockId: 'test-lock-id'
      });
      expect(status.isStale).toBe(false);
    });

    it('should detect stale locks', async () => {
      const staleTime = new Date(Date.now() - 35000); // 35 seconds ago

      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: staleTime } as never);

      const status = await lockManager.checkLock(testBaseDir);

      expect(status.isLocked).toBe(true);
      expect(status.isStale).toBe(true);
    });

    it('should handle malformed lock files gracefully', async () => {
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: new Date() } as never);
      mockedFs.readFile.mockResolvedValue('invalid-json' as never);

      const status = await lockManager.checkLock(testBaseDir);

      expect(status.isLocked).toBe(false);
      expect(status.lockInfo).toBeNull();
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup stale locks successfully', async () => {
      const staleTime = new Date(Date.now() - 35000);

      // Mock readdir to find lock files
      mockedFs.readdir.mockResolvedValue(['.sync.lock'] as never);
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: staleTime } as never);

      const result = await lockManager.cleanupStaleLocks(testBaseDir);

      expect(result.cleaned).toBe(true);
      expect(result.removedFiles).toContain(testLockFile);
      expect(mockedFs.remove).toHaveBeenCalledWith(testLockFile);
    });

    it('should not cleanup fresh locks', async () => {
      // Mock readdir to find lock files
      mockedFs.readdir.mockResolvedValue(['.sync.lock'] as never);
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: new Date() } as never);

      const result = await lockManager.cleanupStaleLocks(testBaseDir);

      expect(result.cleaned).toBe(false);
      expect(result.removedFiles).toHaveLength(0);
      expect(mockedFs.remove).not.toHaveBeenCalled();
    });

    it('should cleanup multiple stale lock files', async () => {
      const staleLockFiles = ['.sync.lock', '.progress.lock', '.other.lock'];
      const staleTime = new Date(Date.now() - 35000);

      mockedFs.readdir.mockResolvedValue(staleLockFiles as never);
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: staleTime } as never);

      const result = await lockManager.cleanupStaleLocks(testBaseDir);

      expect(result.cleaned).toBe(true);
      expect(result.removedFiles).toHaveLength(3);
      expect(mockedFs.remove).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Access Prevention', () => {
    it('should prevent concurrent lock acquisition for same directory', async () => {
      // Mock a scenario where lock is created between pathExists check and writeFile
      let callCount = 0;
      mockedFs.pathExists.mockImplementation(async () => {
        if (callCount === 0) {
          callCount++;
          return false; // First check: no lock
        }
        return true; // Subsequent checks: lock exists
      });

      mockedFs.writeFile.mockRejectedValueOnce(new Error('EEXIST: file already exists') as never);

      await expect(lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes'))
        .rejects.toThrow('Failed to acquire lock');
    });

    it('should handle race conditions in cleanup', async () => {
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ 
        mtime: new Date(Date.now() - 35000) // Stale
      } as never);
      
      // Mock remove failing due to race condition
      mockedFs.remove.mockRejectedValue(new Error('ENOENT: no such file or directory') as never);

      // Should not throw error, should handle gracefully
      const result = await lockManager.cleanupStaleLocks(testBaseDir);
      
      expect(result.cleaned).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {

    it('should handle permission errors', async () => {
      mockedFs.pathExists.mockResolvedValue(false as never);
      mockedFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied') as never);

      await expect(lockManager.acquireLock(testBaseDir, 'sync-todo-checkboxes'))
        .rejects.toThrow('Failed to acquire lock');
    });

    it('should handle very long tool names', async () => {
      const longToolName = 'a'.repeat(100);
      
      mockedFs.pathExists.mockResolvedValue(false as never);

      const result = await lockManager.acquireLock(testBaseDir, longToolName);

      expect(result.acquired).toBe(true);
      const lockContent = (mockedFs.writeFile as unknown as jest.Mock).mock.calls[0][1] as string;
      const lockData = JSON.parse(lockContent);
      expect(lockData.tool).toBe(longToolName);
    });

    it('should handle special characters in paths', async () => {
      const specialDir = '/test/path with spaces/task-dir';
      const specialLockFile = path.join(specialDir, '.sync.lock');

      mockedFs.pathExists.mockResolvedValue(false as never);

      const result = await lockManager.acquireLock(specialDir, 'sync-todo-checkboxes');

      expect(result.acquired).toBe(true);
      expect(result.lockFile).toBe(specialLockFile);
    });
  });

  describe('Lock Timeout Configuration', () => {
    it('should use configurable timeout value', async () => {
      const customTimeout = 60000; // 1 minute
      const customLockManager = new LockManager(customTimeout);

      const staleTime = new Date(Date.now() - 45000); // 45 seconds ago
      
      mockedFs.pathExists.mockResolvedValue(true as never);
      mockedFs.stat.mockResolvedValue({ mtime: staleTime } as never);

      const status = await customLockManager.checkLock(testBaseDir);

      expect(status.isStale).toBe(false); // Should not be stale with 60s timeout
    });

    it('should default to 30 second timeout', async () => {
      const defaultLockManager = new LockManager();

      const almostStaleTime = new Date(Date.now() - 25000); // 25 seconds ago
      const staleTime = new Date(Date.now() - 35000); // 35 seconds ago

      mockedFs.pathExists.mockResolvedValue(true as never);
      
      // Mock readFile for lock content (needed for checkLock)
      const validLockData = {
        tool: 'test-tool',
        pid: 12345,
        timestamp: Date.now(),
        lockId: 'test-lock-id'
      };
      mockedFs.readFile.mockResolvedValue(JSON.stringify(validLockData) as never);
      
      // Test not stale
      mockedFs.stat.mockResolvedValueOnce({ mtime: almostStaleTime } as never);
      let status = await defaultLockManager.checkLock(testBaseDir);
      expect(status.isStale).toBe(false);

      // Test stale
      mockedFs.stat.mockResolvedValueOnce({ mtime: staleTime } as never);
      status = await defaultLockManager.checkLock(testBaseDir);
      expect(status.isStale).toBe(true);
    });
  });
});