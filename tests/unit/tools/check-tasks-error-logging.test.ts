/**
 * Tests for ErrorLogger integration in check-tasks tool
 * Following strict TDD methodology - RED phase
 * Testing MEDIUM severity error logging for query failures
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ServerConfig } from '../../../src/types.js';
import { checkTasks } from '../../../src/tools/check-tasks.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import type { ErrorLogEntry } from '../../../src/logging/ErrorLogger.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn()
}));

jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  listDirectory: jest.fn(),
  isDirectory: jest.fn(),
  readFile: jest.fn(),
  validateAgentName: jest.fn()  // Add this mock
}));

jest.mock('../../../src/core/TaskContextManager.js');

// Import mocked modules
import * as fs from '../../../src/utils/fs-extra-safe.js';
import * as fileSystem from '../../../src/utils/file-system.js';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';

const mockedFs = fs as jest.MockedObject<typeof fs>;
const mockedFileSystem = fileSystem as jest.MockedObject<typeof fileSystem>;

describe('check-tasks ErrorLogger Integration', () => {
  let mockConfig: ServerConfig;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;
  let mockEventLogger: jest.Mocked<EventLogger>;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let loggedErrors: ErrorLogEntry[];

  beforeEach(() => {
    jest.clearAllMocks();
    loggedErrors = [];

    // Create mock ErrorLogger
    mockErrorLogger = {
      logError: jest.fn(async (entry: ErrorLogEntry) => {
        loggedErrors.push(entry);
      }),
      getRecentErrors: jest.fn(),
      clearErrors: jest.fn(),
      getErrorStats: jest.fn()
    } as unknown as jest.Mocked<ErrorLogger>;

    // Create mock EventLogger
    mockEventLogger = {
      logOperation: jest.fn(),
      logWorkflowStep: jest.fn(),
      waitForWriteQueueEmpty: jest.fn().mockImplementation(() => Promise.resolve()),
      waitForOperations: jest.fn().mockImplementation(() => Promise.resolve()),
      close: jest.fn()
    } as unknown as jest.Mocked<EventLogger>;

    // Create mock ConnectionManager
    mockConnectionManager = {
      trackConnection: jest.fn(),
      getConnection: jest.fn(),
      getActiveConnections: jest.fn().mockReturnValue([]),
      cleanup: jest.fn()
    } as unknown as jest.Mocked<ConnectionManager>;

    mockConfig = {
      commDir: './test-comm',
      archiveDir: './test-comm/.archive',
      logDir: './test-comm/.logs',
      enableArchiving: true,
      connectionManager: mockConnectionManager,
      eventLogger: mockEventLogger,
      errorLogger: mockErrorLogger
    };

    // Set up default successful responses
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFileSystem.pathExists.mockResolvedValue(true);
    mockedFileSystem.listDirectory.mockResolvedValue([]);
    mockedFileSystem.isDirectory.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Scenario 1: Agent directory not found', () => {
    it('should log error when agent directory does not exist', async () => {
      // Arrange
      const agent = 'test-agent';

      // Mock TaskContextManager to throw agent directory not found error
      const mockCheckAssignedTasks = jest.fn().mockImplementation(() =>
        Promise.reject(new Error('Agent directory not found: test-agent'))
      );

      jest.mocked(TaskContextManager).mockImplementation(() => ({
        checkAssignedTasks: mockCheckAssignedTasks
      }) as any);

      // Act
      const result = await checkTasks(mockConfig, { agent });

      // Assert
      expect(result).toEqual({
        tasks: [],
        totalCount: 0,
        newCount: 0,
        activeCount: 0,
        message: 'No tasks found for agent: test-agent'
      });

      // Verify ErrorLogger was called with correct parameters
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'check_tasks',
          agent: 'test-agent',
          error: expect.objectContaining({
            message: expect.stringContaining('Agent directory not found')
          }),
          context: expect.objectContaining({
            tool: 'check-tasks',
            parameters: { agent: 'test-agent' }
          }),
          severity: 'medium'
        })
      );
    });
  });

  describe('Error Scenario 2: File system read errors', () => {
    it('should log error when directory read fails', async () => {
      // Arrange
      const agent = 'test-agent';
      const readError = new Error('Permission denied');

      // Mock TaskContextManager to throw permission error
      const mockCheckAssignedTasks = jest.fn().mockImplementation(() => Promise.reject(readError));

      jest.mocked(TaskContextManager).mockImplementation(() => ({
        checkAssignedTasks: mockCheckAssignedTasks
      }) as any);

      // Act
      await expect(checkTasks(mockConfig, { agent })).rejects.toThrow('Permission denied');

      // Assert - Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'check_tasks',
          agent: 'test-agent',
          error: expect.objectContaining({
            message: 'Permission denied',
            name: 'Error'
          }),
          context: expect.objectContaining({
            tool: 'check-tasks',
            parameters: { agent: 'test-agent' }
          }),
          severity: 'medium'
        })
      );
    });
  });

  describe('Error Scenario 3: Task parsing failures', () => {
    it('should log error when INIT.md parsing fails', async () => {
      // Arrange
      const agent = 'test-agent';

      // Mock TaskContextManager to throw parsing error
      const parseError = new Error('Failed to parse task content: Invalid JSON');
      const mockCheckAssignedTasks = jest.fn().mockImplementation(() => Promise.reject(parseError));

      jest.mocked(TaskContextManager).mockImplementation(() => ({
        checkAssignedTasks: mockCheckAssignedTasks
      }) as any);

      // Act
      const result = await checkTasks(mockConfig, { agent });

      // Assert - Should handle gracefully and log error
      expect(result.tasks).toEqual([]);
      expect(result.message).toBe('Unable to parse tasks for agent: test-agent');
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'check_tasks',
          agent: 'test-agent',
          error: expect.objectContaining({
            message: expect.stringContaining('parse')
          }),
          context: expect.objectContaining({
            tool: 'check-tasks',
            parameters: { agent: 'test-agent' }
          }),
          severity: 'medium'
        })
      );
    });
  });

  describe('Error Scenario 4: Status determination errors', () => {
    it('should log error when unable to determine task status', async () => {
      // Arrange
      const agent = 'test-agent';

      // Mock TaskContextManager to throw status determination error
      const statusError = new Error('Unable to read status file');
      const mockCheckAssignedTasks = jest.fn().mockImplementation(() => Promise.reject(statusError));

      jest.mocked(TaskContextManager).mockImplementation(() => ({
        checkAssignedTasks: mockCheckAssignedTasks
      }) as any);

      // Act & Assert - Should throw since not a handled error type
      await expect(checkTasks(mockConfig, { agent })).rejects.toThrow('Unable to read status file');

      // Verify error was logged
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'check_tasks',
          agent: 'test-agent',
          error: expect.objectContaining({
            message: 'Unable to read status file'
          }),
          severity: 'medium'
        })
      );
    });
  });

  describe('Successful operation', () => {
    it('should not log errors when operation succeeds', async () => {
      // Arrange
      const agent = 'test-agent';

      // Mock TaskContextManager to return successful result
      const mockCheckAssignedTasks = jest.fn().mockImplementation(() => Promise.resolve([
        {
          taskId: 'task-001',
          title: 'Test Task',
          status: 'in_progress',
          progress: {
            completed: 1,
            inProgress: 1,
            pending: 1
          }
        }
      ]));

      jest.mocked(TaskContextManager).mockImplementation(() => ({
        checkAssignedTasks: mockCheckAssignedTasks
      }) as any);

      // Act
      const result = await checkTasks(mockConfig, { agent });

      // Assert
      expect(result.totalCount).toBe(1);
      expect(result.newCount).toBe(0);
      expect(result.activeCount).toBe(1);
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
    });
  });

  describe('ErrorLogger not configured', () => {
    it('should handle missing ErrorLogger gracefully', async () => {
      // Arrange
      const agent = 'test-agent';
      const { errorLogger, ...configWithoutErrorLogger } = mockConfig;
      const testConfig = configWithoutErrorLogger as ServerConfig;

      const readError = new Error('Permission denied');

      // Mock TaskContextManager to throw error
      const mockCheckAssignedTasks = jest.fn().mockImplementation(() => Promise.reject(readError));

      jest.mocked(TaskContextManager).mockImplementation(() => ({
        checkAssignedTasks: mockCheckAssignedTasks
      }) as any);

      // Act & Assert - Should throw error but not crash
      await expect(checkTasks(testConfig, { agent }))
        .rejects.toThrow('Permission denied');

      // No ErrorLogger to call
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
    });
  });
});