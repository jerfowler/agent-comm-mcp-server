/**
 * Tests for ErrorLogger integration in mark-complete tool
 * Testing CRITICAL severity errors that can corrupt task state
 */

import { markComplete } from '../../../src/tools/mark-complete.js';
// Removed unused import: fs '../../../src/utils/fs-extra-safe.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import type { ServerConfig } from '../../../src/types.js';

// Mock dependencies
jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  listDirectory: jest.fn(),
  getStats: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  ensureDirectory: jest.fn()
}));
jest.mock('../../../src/logging/ErrorLogger.js');
jest.mock('../../../src/core/agent-work-verifier.js');
jest.mock('../../../src/core/TaskContextManager.js');

import * as fs from '../../../src/utils/file-system.js';
import { verifyAgentWork } from '../../../src/core/agent-work-verifier.js';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedVerifyAgentWork = verifyAgentWork as jest.MockedFunction<typeof verifyAgentWork>;
const MockedTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;

describe('mark-complete ErrorLogger Integration', () => {
  let mockConfig: ServerConfig;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;

  beforeEach(() => {
    jest.clearAllMocks();

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

    // Setup file system mocks
    (mockedFs.pathExists as jest.Mock).mockImplementation((path: string) => {
      // Agent directory and task directory exist
      if (path.includes('/test/comm/test-agent') && !path.includes('.md')) return Promise.resolve(true);
      if (path.includes('/test/comm/test-agent/test-task-123') && !path.includes('.md')) return Promise.resolve(true);
      // PLAN.md exists for checkbox validation
      if (path.includes('PLAN.md')) return Promise.resolve(true);
      // DONE.md and ERROR.md do NOT exist (task is active)
      if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
      return Promise.resolve(false);
    });
    (mockedFs.ensureDirectory as jest.Mock).mockResolvedValue(undefined);
    (mockedFs.listDirectory as jest.Mock).mockResolvedValue(['test-task-123']); // Return test task directory
    (mockedFs.readFile as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('PLAN.md')) {
        return Promise.resolve('# Plan\n- [x] Step 1: Completed\n- [ ] Step 2: Incomplete');
      }
      return Promise.resolve('');
    });
    (mockedFs.writeFile as jest.Mock).mockResolvedValue(undefined);

    // Setup TaskContextManager mock
    const mockContextManager = {
      markComplete: jest.fn().mockResolvedValue({
        taskId: 'test-task-123',
        status: 'completed',
        summary: 'Task completed successfully'
      })
    };
    MockedTaskContextManager.mockImplementation(() => mockContextManager as any);
  });

  describe('Verification Gate Failures', () => {
    it('should log verification gate failure with CRITICAL severity', async () => {
      // Setup: Low confidence that should trigger verification failure
      // Mock file system to return PLAN.md with unchecked items
      mockedFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve('# Plan\n- [x] **Step 1**: Completed\n- [ ] **Step 2**: Incomplete');
        }
        return Promise.resolve('');
      });

      // Mock verifyAgentWork to return low confidence (below 70% threshold)
      mockedVerifyAgentWork.mockResolvedValue({
        success: false,
        confidence: 30, // Below 70% threshold
        warnings: ['Insufficient evidence of work'],
        evidence: {
          filesModified: 0,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 0
        },
        recommendation: 'Provide more evidence of actual work'
      });

      // Execute: Try to complete with low confidence
      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed',
        taskId: 'test-task-123'
      })).rejects.toThrow();

      // Verify: ErrorLogger was called with correct parameters
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          operation: 'mark_complete',
          agent: 'test-agent',
          taskId: 'test-task-123',
          error: expect.objectContaining({
            message: expect.stringContaining('Verification failed'),
            name: 'VerificationError',
            code: undefined
          }),
          context: expect.objectContaining({
            tool: 'mark_complete',
            parameters: expect.objectContaining({
              verificationConfidence: expect.any(Number),
              threshold: expect.any(Number),
              reconciliationMode: 'strict'
            })
          }),
          severity: 'critical'
        })
      );
    });
  });

  describe('Reconciliation Rejections', () => {
    it('should log reconciliation rejection with context', async () => {
      // Setup: Unchecked items with strict mode
      // Mock file system to return PLAN.md with unchecked items
      mockedFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve('# Plan\n- [ ] **Step 1**: Unchecked\n- [ ] **Step 2**: Also unchecked');
        }
        return Promise.resolve('');
      });

      // Mock verifyAgentWork to pass (high confidence for this test)
      mockedVerifyAgentWork.mockResolvedValue({
        success: true,
        confidence: 90, // Above threshold to pass verification gate
        warnings: [],
        evidence: {
          filesModified: 5,
          testsRun: true,
          mcpProgress: true,
          timeSpent: 1800
        },
        recommendation: 'Work appears legitimate'
      });

      // Execute: Try to complete with strict mode
      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Trying to complete with unchecked items',
        reconciliation_mode: 'strict', // Explicitly strict
        taskId: 'test-task-123'
      })).rejects.toThrow();

      // Verify: ErrorLogger captured reconciliation rejection
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          operation: 'mark_complete',
          agent: 'test-agent',
          taskId: 'test-task-123',
          error: expect.objectContaining({
            message: expect.stringContaining('Reconciliation failed'),
            name: 'ReconciliationError',
            code: undefined
          }),
          context: expect.objectContaining({
            tool: 'mark_complete',
            parameters: expect.objectContaining({
              reconciliationMode: 'strict',
              uncheckedItemsCount: expect.any(Number),
              attemptedStatus: 'DONE'
            })
          }),
          severity: 'critical'
        })
      );
    });
  });

  describe('Checkbox Parsing Errors', () => {
    it('should log checkbox parsing errors', async () => {
      // Setup: Malformed PLAN.md that causes parsing issues
      (mockedFs.readFile as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve('# Plan\n[INVALID CHECKBOX FORMAT]\n- Not a proper checkbox');
        }
        return Promise.resolve('');
      });

      // Mock verifyAgentWork to pass (so we get to checkbox validation)
      mockedVerifyAgentWork.mockResolvedValue({
        success: true,
        confidence: 90, // Above threshold to pass verification gate
        warnings: [],
        evidence: {
          filesModified: 5,
          testsRun: true,
          mcpProgress: true,
          timeSpent: 1800
        },
        recommendation: 'Work appears legitimate'
      });

      // Execute: Try to complete with parse error
      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completing task'
      })).rejects.toThrow();

      // Verify: ErrorLogger captured parsing error (multiple calls expected for multiple invalid lines)
      expect(mockErrorLogger.logError).toHaveBeenCalled();

      // Check that at least one call matches the expected pattern
      const calls = mockErrorLogger.logError.mock.calls;
      const matchingCall = calls.find(call => {
        const logEntry = call[0];
        return logEntry.source === 'validation' &&
               logEntry.operation === 'mark_complete' &&
               logEntry.agent === 'test-agent' &&
               logEntry.error.name === 'ParseError' &&
               logEntry.error.message.includes('Invalid checkbox format') &&
               logEntry.context.tool === 'mark_complete' &&
               logEntry.context.parameters?.['parseError'] === 'checkbox_format_invalid' &&
               logEntry.severity === 'critical';
      });

      expect(matchingCall).toBeDefined();
    });
  });

  describe('PLAN.md Update Failures', () => {
    it('should log PLAN.md update failures', async () => {
      // Setup: File write will fail
      const writeError = new Error('Permission denied');
      (writeError as NodeJS.ErrnoException).code = 'EACCES';

      mockedFs.writeFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.reject(writeError);
        }
        return Promise.resolve(undefined);
      });

      // Mock file system to return PLAN.md for auto_complete test
      mockedFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve('# Plan\n- [ ] **Step 1**: Do something');
        }
        return Promise.resolve('');
      });

      // Execute: Try auto_complete mode which updates PLAN.md
      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Auto-completing',
        reconciliation_mode: 'auto_complete',
        taskId: 'test-task-123'
      })).rejects.toThrow('Permission denied');

      // Verify: ErrorLogger captured the write failure
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'runtime',
        operation: 'mark_complete',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: 'Permission denied',
          name: 'Error',
          code: 'EACCES'
        },
        context: {
          tool: 'mark_complete',
          parameters: {
            operation: 'plan_update',
            reconciliationMode: 'auto_complete',
            errorCode: 'EACCES'
          }
        },
        severity: 'critical'
      });
    });
  });

  describe('DONE.md/ERROR.md Write Failures', () => {
    it('should log file write failures for DONE.md/ERROR.md', async () => {
      // Setup: File write will fail for DONE.md
      const diskError = new Error('No space left on device');
      (diskError as NodeJS.ErrnoException).code = 'ENOSPC';

      mockedFs.writeFile.mockImplementation((path: string) => {
        if (path.includes('DONE.md') || path.includes('ERROR.md')) {
          return Promise.reject(diskError);
        }
        return Promise.resolve(undefined);
      });

      // Mock file system to return completed PLAN.md
      mockedFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve('# Plan\n- [x] **Step 1**: Complete');
        }
        return Promise.resolve('');
      });

      // Mock TaskContextManager to throw the disk error
      const mockContextManager = {
        markComplete: jest.fn().mockRejectedValue(diskError)
      };
      MockedTaskContextManager.mockImplementation(() => mockContextManager as any);

      // Execute: Try to complete (should fail on DONE.md write)
      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully',
        taskId: 'test-task-123'
      })).rejects.toThrow('No space left on device');

      // Verify: ErrorLogger captured the disk space error
      expect(mockErrorLogger.logError).toHaveBeenCalledWith({
        timestamp: expect.any(Date),
        source: 'runtime',
        operation: 'mark_complete',
        agent: 'test-agent',
        taskId: 'test-task-123',
        error: {
          message: 'No space left on device',
          name: 'Error',
          code: 'ENOSPC'
        },
        context: {
          tool: 'mark_complete',
          parameters: {
            operation: 'write_completion',
            fileType: 'DONE',
            errorCode: 'ENOSPC'
          }
        },
        severity: 'critical'
      });
    });
  });
});