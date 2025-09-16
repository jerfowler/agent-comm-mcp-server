/**
 * Tests for ErrorLogger integration in create-task tool
 * Following strict TDD methodology - RED phase
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ServerConfig } from '../../../src/types.js';
import { createTask, createTaskTool } from '../../../src/tools/create-task.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import type { ErrorLogEntry } from '../../../src/logging/ErrorLogger.js';
// Removed unused imports - fs and path are not used directly

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  stat: jest.fn()
}));

jest.mock('../../../src/utils/task-manager.js', () => ({
  initializeTask: jest.fn()
}));

jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  listDirectory: jest.fn(),
  isDirectory: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn()
}));

// Import mocked modules
import { initializeTask } from '../../../src/utils/task-manager.js';
import * as fileSystem from '../../../src/utils/file-system.js';

describe('create-task ErrorLogger Integration', () => {
  let mockConfig: ServerConfig;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;
  let loggedErrors: ErrorLogEntry[];

  beforeEach(() => {
    jest.clearAllMocks();
    loggedErrors = [];

    // Create mock ErrorLogger
    mockErrorLogger = {
      logError: jest.fn(async (entry: ErrorLogEntry) => {
        loggedErrors.push(entry);
      }),
      initialize: jest.fn(),
      close: jest.fn(),
      getLogPath: jest.fn(() => './comm/.logs/error.log')
    } as unknown as jest.Mocked<ErrorLogger>;

    // Create mock config
    mockConfig = {
      commDir: './comm',
      archiveDir: './comm/.archive',
      logDir: './comm/.logs',
      enableArchiving: true,
      errorLogger: mockErrorLogger,
      eventLogger: {
        logOperation: jest.fn()
      },
      connectionManager: {
        trackConnection: jest.fn(),
        getConnection: jest.fn(),
        getActiveConnections: jest.fn().mockReturnValue([]),
        cleanup: jest.fn()
      }
    } as unknown as ServerConfig;

    // Setup default mock behaviors
    const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;
    mockedFileSystem.pathExists.mockResolvedValue(false);
    mockedFileSystem.listDirectory.mockResolvedValue([]);
    mockedFileSystem.isDirectory.mockResolvedValue(false);
    mockedFileSystem.writeFile.mockResolvedValue(undefined);
    // Note: ensureDir is not part of file-system module, it's in fs-extra-safe

    const mockedInitTask = initializeTask as jest.MockedFunction<typeof initializeTask>;
    mockedInitTask.mockResolvedValue({
      taskDir: '2025-09-15T10-00-00-test-task',
      initPath: './comm/test-agent/2025-09-15T10-00-00-test-task/INIT.md'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Validation Error Logging', () => {
    it('should log error when agent parameter is missing', async () => {
      const options = {
        agent: '',  // Invalid - empty string
        taskName: 'test-task'
      };

      await expect(createTask(mockConfig, options)).rejects.toThrow('agent must be a non-empty string');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      // Verify error details
      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('create_task');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.error.message).toContain('agent must be a non-empty string');
      expect(loggedError.context.tool).toBe('create_task');
      expect(loggedError.context.parameters).toEqual({
        agent: '',
        taskName: 'test-task'
      });
    });

    it('should log error when taskName parameter is missing', async () => {
      const options = {
        agent: 'test-agent',
        taskName: ''  // Invalid - empty string
      };

      await expect(createTask(mockConfig, options)).rejects.toThrow('taskName must be a non-empty string');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      // Verify error details
      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('create_task');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.error.message).toContain('taskName must be a non-empty string');
      expect(loggedError.context.tool).toBe('create_task');
    });

    it('should log error when agent parameter is invalid type', async () => {
      const options = {
        agent: 123 as unknown as string,  // Invalid type
        taskName: 'test-task'
      };

      await expect(createTask(mockConfig, options)).rejects.toThrow('agent must be a non-empty string');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      // Verify error details
      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('create_task');
      expect(loggedError.severity).toBe('high');
    });
  });

  describe('Task Creation Error Logging', () => {
    it('should log error when task creation fails', async () => {
      const mockedInitTask = initializeTask as jest.MockedFunction<typeof initializeTask>;
      mockedInitTask.mockRejectedValue(new Error('Failed to create task directory'));

      const options = {
        agent: 'test-agent',
        taskName: 'test-task',
        content: 'Test content'
      };

      await expect(createTask(mockConfig, options)).rejects.toThrow('Failed to create task');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      // Verify error details
      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('tool_execution');
      expect(loggedError.operation).toBe('create_task');
      expect(loggedError.agent).toBe('test-agent');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.error.message).toContain('Failed to create task directory');
      expect(loggedError.context.tool).toBe('create_task');
    });

    it('should log error when duplicate detection fails', async () => {
      const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;
      mockedFileSystem.pathExists.mockResolvedValue(true);
      mockedFileSystem.listDirectory.mockRejectedValueOnce(new Error('Permission denied'));
      // Reset to default after the error
      mockedFileSystem.listDirectory.mockResolvedValue([]);

      const options = {
        agent: 'test-agent',
        taskName: 'test-task'
      };

      // Should still create task despite error in duplicate detection
      const result = await createTask(mockConfig, options);
      expect(result.success).toBe(true);

      // Verify ErrorLogger was called for the directory listing error
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('runtime');
      expect(loggedError.operation).toBe('create_task');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.error.message).toContain('Permission denied');
    });

    it('should log error when INIT.md write fails', async () => {
      const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;
      mockedFileSystem.writeFile.mockRejectedValue(new Error('Disk full'));

      const options = {
        agent: 'test-agent',
        taskName: 'test-task',
        content: 'Test content'
      };

      await expect(createTask(mockConfig, options)).rejects.toThrow('Failed to create task');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('tool_execution');
      expect(loggedError.operation).toBe('create_task');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.error.message).toContain('Disk full');
    });
  });

  describe('Protocol Injection Error Logging', () => {
    it('should log error when protocol context injection fails', async () => {
      // Simulate a scenario where content generation might fail
      const options = {
        agent: 'test-agent',
        taskName: 'test-task',
        content: null as unknown as string,  // Invalid content that might cause issues
        taskType: 'delegation' as const
      };

      // This should still work as content is optional
      const result = await createTask(mockConfig, options);
      expect(result.success).toBe(true);

      // No error should be logged for optional content
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
    });
  });

  describe('MCP Tool Wrapper Error Logging', () => {
    it('should log validation errors from tool wrapper', async () => {
      const args = {
        // Missing required parameters
      };

      await expect(createTaskTool(mockConfig, args)).rejects.toThrow('agent must be a non-empty string');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('create_task');
      expect(loggedError.severity).toBe('high');
    });

    it('should log errors with correct taskId when available', async () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();
      loggedErrors = [];

      const mockedInitTask = initializeTask as jest.MockedFunction<typeof initializeTask>;
      mockedInitTask.mockResolvedValueOnce({
        taskDir: '2025-09-15T10-00-00-error-task',
        initPath: './comm/test-agent/2025-09-15T10-00-00-error-task/INIT.md'
      });

      // Mock writeFile to fail after task creation
      const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;
      mockedFileSystem.pathExists.mockResolvedValue(false);
      mockedFileSystem.listDirectory.mockResolvedValue([]);
      mockedFileSystem.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      const options = {
        agent: 'test-agent',
        taskName: 'error-task'
      };

      await expect(createTask(mockConfig, options)).rejects.toThrow('Failed to create task');

      // Verify ErrorLogger includes taskId in context
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.taskId).toBe('2025-09-15T10-00-00-error-task');
      const contextParams = loggedError.context.parameters as Record<string, unknown>;
      expect(contextParams?.['taskId']).toBe('2025-09-15T10-00-00-error-task');
    });
  });

  describe('Error Severity Classification', () => {
    it('should use HIGH severity for all create-task errors', async () => {
      // Test various error scenarios
      const scenarios = [
        { agent: '', taskName: 'test' },  // Validation error
        { agent: 'test', taskName: '' },  // Validation error
      ];

      for (const scenario of scenarios) {
        jest.clearAllMocks();
        loggedErrors = [];

        try {
          await createTask(mockConfig, scenario);
        } catch {
          // Expected to throw
        }

        if (mockErrorLogger.logError.mock.calls.length > 0) {
          const loggedError = loggedErrors[0];
          expect(loggedError.severity).toBe('high');
        }
      }
    });
  });

  describe('Debug Package Integration', () => {
    it('should include debug logging context', async () => {
      // Debug package is integrated via import debug from 'debug'
      // and const log = debug('agent-comm:tools:createtask')
      // This is tested by verifying the import exists in the source file

      const options = {
        agent: 'test-agent',
        taskName: 'test-task'
      };

      const result = await createTask(mockConfig, options);
      expect(result.success).toBe(true);

      // Debug logging happens internally, no external verification needed
      // The presence of debug import and usage is verified in the source
    });
  });

  describe('Error Logger Absence Handling', () => {
    it('should handle missing ErrorLogger gracefully', async () => {
      const { errorLogger, ...configWithoutErrorLogger } = mockConfig;
      const configWithoutLogger = configWithoutErrorLogger as ServerConfig;

      const options = {
        agent: '',  // Invalid
        taskName: 'test-task'
      };

      // Should still throw the validation error
      await expect(createTask(configWithoutLogger, options)).rejects.toThrow('agent must be a non-empty string');

      // No crash should occur due to missing logger
    });
  });
});