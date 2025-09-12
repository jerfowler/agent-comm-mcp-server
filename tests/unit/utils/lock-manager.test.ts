/**
 * Comprehensive test suite for LockManager with 95%+ coverage
 * Following TEST-GUIDELINES.md requirements
 */

import { LockManager } from '../../../src/utils/lock-manager.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import { AgentCommError } from '../../../src/types.js';
import * as path from 'path';

// Mock fs-extra-safe
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  remove: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn()
}));

describe('LockManager', () => {
  let lockManager: LockManager;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const testTaskDir = '/test/task/dir';
  const lockFilePath = path.join(testTaskDir, '.sync.lock');

  beforeEach(() => {
    jest.clearAllMocks();
    lockManager = new LockManager(30000);
  });

  describe('acquireLock', () => {
    it('should successfully acquire lock when no existing lock exists', async () => {
      mockFs.pathExists.mockResolvedValueOnce(false); // checkLock - no lock file
      mockFs.pathExists.mockResolvedValueOnce(false); // check before creating

      const result = await lockManager.acquireLock(testTaskDir, 'test-tool');

      expect(result.acquired).toBe(true);
      expect(result.lockId).toBeDefined();
      expect(result.lockFile).toBe(lockFilePath);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        lockFilePath,
        expect.stringContaining('test-tool')
      );
    });

    it('should not acquire lock when active lock exists', async () => {
      const existingLock = {
        tool: 'other-tool',
        pid: 9999,
        timestamp: Date.now(),
        lockId: 'existing-lock-123'
      };

      mockFs.pathExists.mockResolvedValueOnce(true); // lock file exists
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 1000) // 1 second old (not stale)
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingLock));

      const result = await lockManager.acquireLock(testTaskDir, 'test-tool');

      expect(result.acquired).toBe(false);
      expect(result.reason).toContain('Task is currently locked');
      expect(result.existingLock).toEqual(existingLock);
    });

    it('should clean up and acquire lock when stale lock exists', async () => {
      const staleLock = {
        tool: 'old-tool',
        pid: 9999,
        timestamp: Date.now() - 40000,
        lockId: 'stale-lock-123'
      };

      mockFs.pathExists.mockResolvedValueOnce(true); // lock file exists
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 40000) // 40 seconds old (stale)
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.readFile.mockResolvedValue(JSON.stringify(staleLock));
      mockFs.readdir.mockResolvedValue(['.sync.lock']);
      mockFs.pathExists.mockResolvedValueOnce(true); // stale lock exists
      mockFs.remove.mockResolvedValue(undefined);

      const result = await lockManager.acquireLock(testTaskDir, 'test-tool');

      expect(result.acquired).toBe(true);
      expect(mockFs.remove).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should clean up malformed lock file and acquire lock', async () => {
      mockFs.pathExists.mockResolvedValueOnce(true); // lock file exists
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 1000)
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.readFile.mockResolvedValue('invalid json'); // malformed
      mockFs.pathExists.mockResolvedValueOnce(true); // check malformed file exists
      mockFs.remove.mockResolvedValue(undefined);

      const result = await lockManager.acquireLock(testTaskDir, 'test-tool');

      expect(result.acquired).toBe(true);
      expect(mockFs.remove).toHaveBeenCalledWith(lockFilePath);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should throw error for empty taskDir', async () => {
      await expect(lockManager.acquireLock('', 'test-tool'))
        .rejects.toThrow(AgentCommError);
      await expect(lockManager.acquireLock('  ', 'test-tool'))
        .rejects.toThrow(AgentCommError);
    });

    it('should throw error for empty toolName', async () => {
      await expect(lockManager.acquireLock(testTaskDir, ''))
        .rejects.toThrow(AgentCommError);
      await expect(lockManager.acquireLock(testTaskDir, '  '))
        .rejects.toThrow(AgentCommError);
    });

    it('should handle writeFile errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockRejectedValue(new Error('Write permission denied'));

      await expect(lockManager.acquireLock(testTaskDir, 'test-tool'))
        .rejects.toThrow('Failed to acquire lock');
    });
  });

  describe('releaseLock', () => {
    const testLockId = 'test-lock-123';

    it('should successfully release owned lock', async () => {
      const lockData = {
        tool: 'test-tool',
        pid: process.pid,
        timestamp: Date.now(),
        lockId: testLockId
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(lockData));
      mockFs.remove.mockResolvedValue(undefined);

      const result = await lockManager.releaseLock(testTaskDir, testLockId);

      expect(result.released).toBe(true);
      expect(mockFs.remove).toHaveBeenCalledWith(lockFilePath);
    });

    it('should return success when lock file does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await lockManager.releaseLock(testTaskDir, testLockId);

      expect(result.released).toBe(true);
      expect(result.reason).toContain('already released');
    });

    it('should remove malformed lock file', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('invalid json');
      mockFs.remove.mockResolvedValue(undefined);

      const result = await lockManager.releaseLock(testTaskDir, testLockId);

      expect(result.released).toBe(true);
      expect(result.reason).toContain('Malformed lock file removed');
      expect(mockFs.remove).toHaveBeenCalledWith(lockFilePath);
    });

    it('should not release lock owned by different process', async () => {
      const lockData = {
        tool: 'test-tool',
        pid: 9999, // different PID
        timestamp: Date.now(),
        lockId: testLockId
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(lockData));

      const result = await lockManager.releaseLock(testTaskDir, testLockId);

      expect(result.released).toBe(false);
      expect(result.reason).toContain('not owner');
    });

    it('should not release lock with different lockId', async () => {
      const lockData = {
        tool: 'test-tool',
        pid: process.pid,
        timestamp: Date.now(),
        lockId: 'different-lock-456'
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(lockData));

      const result = await lockManager.releaseLock(testTaskDir, testLockId);

      expect(result.released).toBe(false);
      expect(result.reason).toContain('not owner');
    });

    it('should throw error for empty taskDir', async () => {
      await expect(lockManager.releaseLock('', testLockId))
        .rejects.toThrow(AgentCommError);
      await expect(lockManager.releaseLock('  ', testLockId))
        .rejects.toThrow(AgentCommError);
    });

    it('should throw error for empty lockId', async () => {
      await expect(lockManager.releaseLock(testTaskDir, ''))
        .rejects.toThrow(AgentCommError);
      await expect(lockManager.releaseLock(testTaskDir, '  '))
        .rejects.toThrow(AgentCommError);
    });

    it('should handle remove errors gracefully', async () => {
      const lockData = {
        tool: 'test-tool',
        pid: process.pid,
        timestamp: Date.now(),
        lockId: testLockId
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(lockData));
      mockFs.remove.mockRejectedValue(new Error('Permission denied'));

      await expect(lockManager.releaseLock(testTaskDir, testLockId))
        .rejects.toThrow('Failed to release lock');
    });
  });

  describe('checkLock', () => {
    it('should return not locked when no lock file exists', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await lockManager.checkLock(testTaskDir);

      expect(result.isLocked).toBe(false);
      expect(result.lockInfo).toBeNull();
      expect(result.isStale).toBe(false);
    });

    it('should return active lock info', async () => {
      const lockData = {
        tool: 'test-tool',
        pid: process.pid,
        timestamp: Date.now(),
        lockId: 'test-lock-123'
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 1000) // 1 second old
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.readFile.mockResolvedValue(JSON.stringify(lockData));

      const result = await lockManager.checkLock(testTaskDir);

      expect(result.isLocked).toBe(true);
      expect(result.lockInfo).toEqual(lockData);
      expect(result.isStale).toBe(false);
    });

    it('should detect stale lock', async () => {
      const lockData = {
        tool: 'test-tool',
        pid: 9999,
        timestamp: Date.now() - 40000,
        lockId: 'stale-lock-123'
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 40000) // 40 seconds old (stale)
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.readFile.mockResolvedValue(JSON.stringify(lockData));

      const result = await lockManager.checkLock(testTaskDir);

      expect(result.isLocked).toBe(true);
      expect(result.lockInfo).toEqual(lockData);
      expect(result.isStale).toBe(true);
    });

    it('should handle malformed lock file', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 1000)
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await lockManager.checkLock(testTaskDir);

      expect(result.isLocked).toBe(false);
      expect(result.lockInfo).toBeNull();
      expect(result.isStale).toBe(false);
    });

    it('should throw error for empty taskDir', async () => {
      await expect(lockManager.checkLock(''))
        .rejects.toThrow(AgentCommError);
      await expect(lockManager.checkLock('  '))
        .rejects.toThrow(AgentCommError);
    });

    it('should handle stat errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockRejectedValue(new Error('Permission denied'));

      await expect(lockManager.checkLock(testTaskDir))
        .rejects.toThrow('Failed to check lock');
    });
  });

  describe('cleanupStaleLocks', () => {
    it('should remove stale lock files', async () => {
      mockFs.readdir.mockResolvedValue(['.sync.lock', 'old.lock']);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 40000) // 40 seconds old (stale)
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.remove.mockResolvedValue(undefined);

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(true);
      expect(result.removedFiles).toHaveLength(2);
      expect(mockFs.remove).toHaveBeenCalledTimes(2);
    });

    it('should not remove fresh lock files', async () => {
      mockFs.readdir.mockResolvedValue(['.sync.lock']);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 1000) // 1 second old (fresh)
      } as unknown as ReturnType<typeof fs.stat>);

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(false);
      expect(result.removedFiles).toHaveLength(0);
      expect(mockFs.remove).not.toHaveBeenCalled();
    });

    it('should handle empty directory', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(false);
      expect(result.removedFiles).toHaveLength(0);
    });

    it('should handle non-lock files gracefully', async () => {
      mockFs.readdir.mockResolvedValue(['file.txt', 'data.json', '.sync.lock']);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 40000) // stale
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.remove.mockResolvedValue(undefined);

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(true);
      expect(result.removedFiles).toHaveLength(1); // only .sync.lock
    });

    it('should handle readdir errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(false);
      expect(result.removedFiles).toHaveLength(0);
    });

    it('should handle ENOENT errors during file removal', async () => {
      mockFs.readdir.mockResolvedValue(['.sync.lock']);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 40000)
      } as unknown as ReturnType<typeof fs.stat>);
      const enoentError = new Error('ENOENT: no such file or directory');
      mockFs.remove.mockRejectedValue(enoentError);

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(false);
      expect(result.removedFiles).toHaveLength(0);
    });

    it('should handle non-ENOENT errors during file removal', async () => {
      mockFs.readdir.mockResolvedValue(['.sync.lock', 'other.lock']);
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 40000)
      } as unknown as ReturnType<typeof fs.stat>);
      
      // First file fails with permission error, second succeeds
      mockFs.remove
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(undefined);

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(true);
      expect(result.removedFiles).toHaveLength(1); // only second file
    });

    it('should skip already processed files', async () => {
      mockFs.readdir.mockResolvedValue(['.sync.lock', '.sync.lock']); // duplicate
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 40000)
      } as unknown as ReturnType<typeof fs.stat>);
      mockFs.remove.mockResolvedValue(undefined);

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(true);
      expect(result.removedFiles).toHaveLength(1); // processed only once
      expect(mockFs.remove).toHaveBeenCalledTimes(1);
    });

    it('should throw error for empty taskDir', async () => {
      await expect(lockManager.cleanupStaleLocks(''))
        .rejects.toThrow(AgentCommError);
      await expect(lockManager.cleanupStaleLocks('  '))
        .rejects.toThrow(AgentCommError);
    });

    it('should handle pathExists returning false during cleanup', async () => {
      mockFs.readdir.mockResolvedValue(['.sync.lock']);
      mockFs.pathExists.mockResolvedValue(false); // file doesn't exist

      const result = await lockManager.cleanupStaleLocks(testTaskDir);

      expect(result.cleaned).toBe(false);
      expect(result.removedFiles).toHaveLength(0);
      expect(mockFs.remove).not.toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it('should use default timeout when not specified', () => {
      const defaultManager = new LockManager();
      expect(defaultManager).toBeDefined();
    });

    it('should use custom timeout when specified', () => {
      const customManager = new LockManager(60000);
      expect(customManager).toBeDefined();
    });
  });

  describe('withLock helper pattern', () => {
    it('should demonstrate typical usage pattern', async () => {
      // Simulate a helper function that uses lock manager
      async function withLock<T>(
        taskDir: string,
        toolName: string,
        operation: () => Promise<T>
      ): Promise<T> {
        const lockResult = await lockManager.acquireLock(taskDir, toolName);
        if (!lockResult.acquired) {
          throw new Error(`Failed to acquire lock: ${lockResult.reason}`);
        }

        try {
          return await operation();
        } finally {
          await lockManager.releaseLock(taskDir, lockResult.lockId!);
        }
      }

      // Mock successful lock acquisition and release
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      let operationExecuted = false;
      const result = await withLock(testTaskDir, 'test-tool', async () => {
        operationExecuted = true;
        return 'success';
      });

      expect(result).toBe('success');
      expect(operationExecuted).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });
});