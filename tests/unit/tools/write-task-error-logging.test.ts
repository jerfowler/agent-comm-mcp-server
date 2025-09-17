/**
 * Tests for ErrorLogger integration in write-task tool
 * Testing HIGH severity errors that can cause data loss
 */

import { writeTask } from '../../../src/tools/write-task.js';
// Removed unused import: fs '../../../src/utils/fs-extra-safe.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import { LockManager } from '../../../src/utils/lock-manager.js';
import type { ServerConfig } from '../../../src/types.js';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js');
jest.mock('../../../src/logging/ErrorLogger.js');
jest.mock('../../../src/utils/lock-manager.js');

import * as fs from '../../../src/utils/fs-extra-safe.js';
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('write-task ErrorLogger Integration', () => {
  let mockConfig: ServerConfig;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;
  let mockLockManager: jest.Mocked<LockManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock ErrorLogger
    mockErrorLogger = {
      logError: jest.fn().mockResolvedValue(undefined),
      waitForWriteQueueEmpty: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<ErrorLogger>;

    // Setup mock LockManager
    mockLockManager = {
      acquireLock: jest.fn().mockResolvedValue({
        acquired: true,
        lockId: 'test-lock-id-123',
        lockFile: '/test/path/.lock'
      }),
      releaseLock: jest.fn().mockResolvedValue({
        released: true,
        lockId: 'test-lock-id-123'
      })
    } as unknown as jest.Mocked<LockManager>;

    // Mock LockManager constructor
    (LockManager as jest.MockedClass<typeof LockManager>).mockImplementation(() => mockLockManager);

    // Setup mock config
    mockConfig = {
      commDir: '/test/comm',
      archiveDir: '/test/comm/.archive',
      logDir: '/test/comm/.logs',
      enableArchiving: true,
      eventLogger: {
        logOperation: jest.fn().mockResolvedValue(undefined),
        waitForWriteQueueEmpty: jest.fn().mockResolvedValue(undefined)
      },
      connectionManager: {
        setCurrentTask: jest.fn(),
        getCurrentTask: jest.fn().mockReturnValue('test-task-123')
      },
      errorLogger: mockErrorLogger
    } as unknown as ServerConfig;

    // Setup file system mocks
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFs.ensureDir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.readdir.mockResolvedValue(['test-task-123'] as unknown as string[]);
  });

  describe('File Write Failures', () => {
    it('should log file write failures with HIGH severity', async () => {
      // Setup: Generic write failure
      const writeError = new Error('Write operation failed');
      mockedFs.writeFile.mockRejectedValue(writeError);

      // Execute: Try to write task file
      await expect(writeTask(mockConfig, {
        agent: 'test-agent',
        task: 'test-task-123',
        file: 'PLAN',
        content: '# Plan\n- [ ] Step 1: Do something'
      })).rejects.toThrow('Write operation failed');

      // Verify: ErrorLogger captured write failure
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'runtime',
        operation: 'write_task',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: 'Write operation failed',
          name: 'Error',
          code: undefined
        },
        context: {
          tool: 'write_task',
          parameters: {
            operation: 'write',
            fileType: 'PLAN',
            bytesAttempted: expect.any(Number),
            permissions: false
          }
        },
        severity: 'high'
      });
    });
  });

  describe('Permission Denied Errors', () => {
    it('should log permission denied with error code', async () => {
      // Setup: Permission denied error
      const permissionError = new Error('Permission denied');
      (permissionError as NodeJS.ErrnoException).code = 'EACCES';
      (permissionError as NodeJS.ErrnoException).syscall = 'open';
      (permissionError as NodeJS.ErrnoException).path = '/test/comm/test-agent/test-task-123/PLAN.md';

      mockedFs.writeFile.mockRejectedValue(permissionError);

      // Execute: Try to write with permission error
      await expect(writeTask(mockConfig, {
        agent: 'test-agent',
        task: 'test-task-123',
        file: 'DONE',
        content: '# Task Completed\nAll work done successfully'
      })).rejects.toThrow('Permission denied');

      // Verify: ErrorLogger captured permission error with code
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'runtime',
        operation: 'write_task',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: 'Permission denied',
          name: 'Error',
          code: 'EACCES'
        },
        context: {
          tool: 'write_task',
          parameters: {
            operation: 'write',
            fileType: 'DONE',
            bytesAttempted: expect.any(Number),
            permissions: true,
            syscall: 'open',
            errorCode: 'EACCES'
          }
        },
        severity: 'high'
      });
    });
  });

  describe('Disk Space Issues', () => {
    it('should log disk space issues', async () => {
      // Setup: No space left on device error
      const diskError = new Error('No space left on device');
      (diskError as NodeJS.ErrnoException).code = 'ENOSPC';
      (diskError as NodeJS.ErrnoException).syscall = 'write';

      mockedFs.writeFile.mockRejectedValue(diskError);

      // Execute: Try to write large content
      const largeContent = '# Large Content\n' + 'x'.repeat(10000);
      await expect(writeTask(mockConfig, {
        agent: 'test-agent',
        task: 'test-task-123',
        file: 'PLAN',
        content: largeContent
      })).rejects.toThrow('No space left on device');

      // Verify: ErrorLogger captured disk space error
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'runtime',
        operation: 'write_task',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: 'No space left on device',
          name: 'Error',
          code: 'ENOSPC'
        },
        context: {
          tool: 'write_task',
          parameters: {
            operation: 'write',
            fileType: 'PLAN',
            bytesAttempted: expect.any(Number),
            diskSpace: true,
            syscall: 'write',
            errorCode: 'ENOSPC'
          }
        },
        severity: 'high'
      });
    });
  });

  describe('Invalid File Type Errors', () => {
    it('should log invalid file type errors', async () => {
      // Execute: Try to write invalid file type
      await expect(writeTask(mockConfig, {
        agent: 'test-agent',
        task: 'test-task-123',
        file: 'INVALID' as any, // Invalid file type
        content: 'Some content'
      })).rejects.toThrow();

      // Verify: ErrorLogger captured invalid file type
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'runtime',
        operation: 'write_task',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: expect.stringContaining('Invalid file type'),
          name: 'ValidationError',
          code: undefined
        },
        context: {
          tool: 'write_task',
          parameters: {
            invalidFileType: 'INVALID',
            allowedTypes: ['PLAN', 'DONE', 'ERROR']
          }
        },
        severity: 'high'
      });
    });
  });

  describe('Concurrent Write Conflicts', () => {
    it('should log concurrent write conflicts', async () => {
      // Setup: Lock is already held (concurrent write in progress)
      mockLockManager.acquireLock.mockRejectedValue(new Error('Lock acquisition timeout - file is being written by another process'));

      // Execute: Try to write while another process has lock
      await expect(writeTask(mockConfig, {
        agent: 'test-agent',
        task: 'test-task-123',
        file: 'PLAN',
        content: '# Updated Plan'
      })).rejects.toThrow('Lock acquisition timeout');

      // Verify: ErrorLogger captured concurrent write conflict
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'runtime',
        operation: 'write_task',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: expect.stringContaining('Lock acquisition timeout'),
          name: 'Error',
          code: undefined
        },
        context: {
          tool: 'write_task',
          parameters: {
            operation: 'lock_acquisition',
            fileType: 'PLAN',
            concurrentWrite: true,
            lockHeld: true
          }
        },
        severity: 'high'
      });
    });
  });
});