/**
 * Tests for ErrorLogger integration in sync-todo-checkboxes tool
 * Testing HIGH severity errors that can cause state inconsistency
 */

import { syncTodoCheckboxes } from '../../../src/tools/sync-todo-checkboxes.js';
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

describe('sync-todo-checkboxes ErrorLogger Integration', () => {
  let mockConfig: ServerConfig;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;
  let mockLockManager: jest.Mocked<LockManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock LockManager
    mockLockManager = {
      checkLock: jest.fn().mockResolvedValue({ isLocked: false }),
      acquireLock: jest.fn().mockResolvedValue({ acquired: true }),
      releaseLock: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<LockManager>;

    // Mock LockManager constructor
    (LockManager as jest.MockedClass<typeof LockManager>).mockImplementation(() => mockLockManager);

    // Setup mock ErrorLogger
    mockErrorLogger = {
      logError: jest.fn().mockResolvedValue(undefined),
      waitForWriteQueueEmpty: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<ErrorLogger>;

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

    // Setup file system mocks with valid PLAN.md
    mockedFs.pathExists.mockImplementation((path: string) => {
      // Agent directory exists
      if (path === '/test/comm/test-agent') return Promise.resolve(true);
      // Task directory exists when taskId is provided
      if (path === '/test/comm/test-agent/test-task-123') return Promise.resolve(true);
      // PLAN.md exists
      if (path.includes('PLAN.md')) return Promise.resolve(true);
      // DONE.md and ERROR.md don't exist (task is active)
      if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
      // Lock file doesn't exist
      if (path.includes('.lock')) return Promise.resolve(false);
      return Promise.resolve(true);
    });
    mockedFs.readFile.mockImplementation((path: string) => {
      if (path.includes('PLAN.md')) {
        return Promise.resolve('# Plan\n- [ ] **Step 1**: Initialize\n- [ ] **Step 2**: Implement\n- [ ] **Step 3**: Test');
      }
      return Promise.resolve('');
    });
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.readdir.mockResolvedValue(['test-task-123'] as unknown as string[]);
    mockedFs.stat.mockResolvedValue({
      isDirectory: () => true,
      mode: 0o040000
    } as unknown as any);
  });

  describe('Fuzzy Matching Failures', () => {
    it('should log fuzzy matching failures with similarity scores', async () => {
      // Setup: Todo items that don't match any checkboxes well enough
      const todoUpdates = [
        {
          title: 'Completely different task name that will not match',
          status: 'completed' as const
        },
        {
          title: 'Another unmatched todo item',
          status: 'in_progress' as const
        }
      ];

      // Execute: Try to sync with non-matching todos
      await syncTodoCheckboxes(mockConfig, {
        agent: 'test-agent',
        taskId: 'test-task-123',
        todoUpdates
      });

      // Verify: ErrorLogger captured fuzzy matching failures
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'tool_execution',
        operation: 'sync_todo_checkboxes',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: expect.stringContaining('fuzzy match'),
          name: 'FuzzyMatchError',
          code: undefined
        },
        context: {
          tool: 'sync_todo_checkboxes',
          parameters: {
            todoTitle: 'Completely different task name that will not match',
            bestMatch: expect.any(String),
            similarity: expect.any(Number),
            threshold: 0.6
          }
        },
        severity: 'high'
      });
    });
  });

  describe('PLAN.md Corruption During Update', () => {
    it('should log PLAN.md corruption with HIGH severity', async () => {
      // Setup: PLAN.md becomes corrupted during read/write cycle
      let readCount = 0;
      mockedFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          readCount++;
          // First read: normal PLAN.md
          if (readCount === 1) {
            return Promise.resolve('# Plan\n- [ ] **Step 1**: Valid\n- [ ] **Step 2**: Valid');
          }
          // Second read (after write, for verification): corrupted content
          if (readCount === 2) {
            return Promise.resolve('[CORRUPTED DATA]\n00110101010');
          }
          return Promise.resolve('# Plan\n- [ ] **Step 1**: Valid\n- [ ] **Step 2**: Valid');
        }
        return Promise.resolve('');
      });

      const todoUpdates = [{
        title: 'Step 1',  // Match the checkbox title exactly
        status: 'completed' as const
      }];

      // Execute: Try to sync which will encounter corruption on verify
      await expect(syncTodoCheckboxes(mockConfig, {
        agent: 'test-agent',
        taskId: 'test-task-123',
        todoUpdates
      })).rejects.toThrow('PLAN.md became corrupted during sync operation');

      // Verify: ErrorLogger captured corruption
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'validation',
        operation: 'sync_todo_checkboxes',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: expect.stringContaining('corrupt'),
          name: 'PlanCorruptionError',
          code: undefined
        },
        context: {
          tool: 'sync_todo_checkboxes',
          parameters: {
            corruption: true,
            planContentLength: expect.any(Number)
          }
        },
        severity: 'high'
      });
    });
  });

  describe('Sync Conflicts Between TodoWrite and Checkboxes', () => {
    it('should log sync conflicts with conflict details', async () => {
      // Setup: Conflicting states between todo and checkbox
      mockedFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          // Checkbox already marked as complete
          return Promise.resolve('# Plan\n- [x] **Step 1**: Already done\n- [ ] **Step 2**: Pending');
        }
        return Promise.resolve('');
      });

      const todoUpdates = [{
        title: 'Step 1',  // Match the checkbox title (without the description)
        status: 'pending' as const // Trying to mark as pending when it's complete
      }];

      // Execute: Try to sync conflicting states
      await syncTodoCheckboxes(mockConfig, {
        agent: 'test-agent',
        taskId: 'test-task-123',
        todoUpdates
      });

      // Verify: ErrorLogger captured sync conflict
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'tool_execution',
        operation: 'sync_todo_checkboxes',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: 'Sync conflict between TodoWrite and PLAN.md checkboxes',
          name: 'SyncConflictError',
          code: undefined
        },
        context: {
          tool: 'sync_todo_checkboxes',
          parameters: {
            conflict: 'checkbox_mismatch',
            todoTitle: 'Step 1',  // Match what we're actually sending
            todoStatus: 'pending',
            checkboxStatus: 'completed'
          }
        },
        severity: 'high'
      });
    });
  });

  describe('Partial Update Failures', () => {
    it('should log partial update failures with rollback info', async () => {
      // Setup: Write will fail on first attempt
      mockedFs.writeFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          const error = new Error('Write failed mid-update');
          (error as NodeJS.ErrnoException).code = 'EIO';
          return Promise.reject(error);
        }
        return Promise.resolve(undefined);
      });

      const todoUpdates = [
        { title: 'Step 1', status: 'completed' as const },
        { title: 'Step 2', status: 'in_progress' as const },
        { title: 'Step 3', status: 'pending' as const }
      ];

      // Execute: Try to sync multiple updates (will fail on write)
      await expect(syncTodoCheckboxes(mockConfig, {
        agent: 'test-agent',
        taskId: 'test-task-123',
        todoUpdates
      })).rejects.toThrow('Write failed mid-update');

      // Verify: ErrorLogger captured partial update failure
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'runtime',
        operation: 'sync_todo_checkboxes',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: 'Write failed mid-update',
          name: 'Error',
          code: 'EIO'
        },
        context: {
          tool: 'sync_todo_checkboxes',
          parameters: {
            partialUpdate: true,
            updatesAttempted: 3,
            updatesCompleted: expect.any(Number),
            rollbackNeeded: true
          }
        },
        severity: 'high'
      });
    });
  });
});