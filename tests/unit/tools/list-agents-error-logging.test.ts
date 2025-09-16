/**
 * Tests for ErrorLogger integration in list-agents tool
 * Following strict TDD methodology - RED phase
 * Testing LOW severity error logging for directory scan failures
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ServerConfig } from '../../../src/types.js';
import { listAgents } from '../../../src/tools/list-agents.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import type { ErrorLogEntry } from '../../../src/logging/ErrorLogger.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));

jest.mock('../../../src/utils/task-manager.js', () => ({
  getAllAgents: jest.fn()
}));

// Import mocked modules
import { getAllAgents } from '../../../src/utils/task-manager.js';

const mockedGetAllAgents = getAllAgents as jest.MockedFunction<typeof getAllAgents>;

describe('list-agents ErrorLogger Integration', () => {
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
      logOperation: jest.fn(() => Promise.resolve()),
      logWorkflowStep: jest.fn(() => Promise.resolve()),
      waitForWriteQueueEmpty: jest.fn(() => Promise.resolve()),
      waitForOperations: jest.fn(() => Promise.resolve()),
      close: jest.fn(() => Promise.resolve())
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

    // Set up default successful response
    mockedGetAllAgents.mockResolvedValue([
      { name: 'agent1', taskCount: 2, completedCount: 1, pendingCount: 1, errorCount: 0 },
      { name: 'agent2', taskCount: 3, completedCount: 1, pendingCount: 2, errorCount: 0 }
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Error Logging', () => {
    it('should log directory scan failures with LOW severity', async () => {
      // Arrange - Create permission error
      const permissionError = new Error('Permission denied');
      (permissionError as Error & { code?: string }).code = 'EACCES';
      mockedGetAllAgents.mockRejectedValue(permissionError);

      // Act & Assert - Should throw the error
      await expect(listAgents(mockConfig)).rejects.toThrow('Permission denied');

      // Assert - Should log error with LOW severity
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(loggedErrors).toHaveLength(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('runtime');
      expect(loggedError.operation).toBe('list_agents');
      expect(loggedError.agent).toBe('system');
      expect(loggedError.error.message).toBe('Permission denied');
      expect(loggedError.error.code).toBe('EACCES');
      expect(loggedError.severity).toBe('low');
      expect(loggedError.context?.tool).toBe('list_agents');
      expect(loggedError.context?.parameters).toEqual({
        operation: 'scan_directories',
        path: mockConfig.commDir
      });
    });

    it('should log file not found errors with LOW severity', async () => {
      // Arrange - Create ENOENT error
      const notFoundError = new Error('Directory not found');
      (notFoundError as Error & { code?: string }).code = 'ENOENT';
      mockedGetAllAgents.mockRejectedValue(notFoundError);

      // Act & Assert - Should throw the error
      await expect(listAgents(mockConfig)).rejects.toThrow('Directory not found');

      // Assert - Should log error with LOW severity
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(loggedErrors).toHaveLength(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('runtime');
      expect(loggedError.operation).toBe('list_agents');
      expect(loggedError.agent).toBe('system');
      expect(loggedError.error.message).toBe('Directory not found');
      expect(loggedError.error.code).toBe('ENOENT');
      expect(loggedError.severity).toBe('low');
    });

    it('should log generic errors with LOW severity', async () => {
      // Arrange - Create generic error without code
      const genericError = new Error('Unexpected error occurred');
      mockedGetAllAgents.mockRejectedValue(genericError);

      // Act & Assert - Should throw the error
      await expect(listAgents(mockConfig)).rejects.toThrow('Unexpected error occurred');

      // Assert - Should log error with LOW severity
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(loggedErrors).toHaveLength(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('runtime');
      expect(loggedError.operation).toBe('list_agents');
      expect(loggedError.agent).toBe('system');
      expect(loggedError.error.message).toBe('Unexpected error occurred');
      expect(loggedError.error.code).toBeUndefined();
      expect(loggedError.severity).toBe('low');
    });

    it('should handle non-Error objects with LOW severity', async () => {
      // Arrange - Reject with string instead of Error
      mockedGetAllAgents.mockRejectedValue('String error message');

      // Act & Assert - Should throw
      await expect(listAgents(mockConfig)).rejects.toBe('String error message');

      // Assert - Should log with generic message
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(loggedErrors).toHaveLength(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('runtime');
      expect(loggedError.operation).toBe('list_agents');
      expect(loggedError.agent).toBe('system');
      expect(loggedError.error.message).toBe('Failed to list agents');
      expect(loggedError.error.name).toBe('Error');
      expect(loggedError.error.code).toBeUndefined();
      expect(loggedError.severity).toBe('low');
    });

    it('should not log errors when ErrorLogger is not configured', async () => {
      // Arrange - Remove ErrorLogger from config
      const configWithoutLogger = { ...mockConfig };
      delete configWithoutLogger.errorLogger;

      const error = new Error('Test error');
      mockedGetAllAgents.mockRejectedValue(error);

      // Act & Assert - Should still throw the error
      await expect(listAgents(configWithoutLogger)).rejects.toThrow('Test error');

      // Assert - Should not attempt to log
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
    });

    it('should not interfere with successful operations', async () => {
      // Arrange - Already set up with successful mock

      // Act
      const result = await listAgents(mockConfig);

      // Assert - Should return correct result
      expect(result).toEqual({
        agents: [
          { name: 'agent1', taskCount: 2, completedCount: 1, pendingCount: 1, errorCount: 0 },
          { name: 'agent2', taskCount: 3, completedCount: 1, pendingCount: 2, errorCount: 0 }
        ],
        totalAgents: 2,
        totalTasks: 5
      });

      // Assert - Should not log any errors
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
      expect(loggedErrors).toHaveLength(0);
    });
  });

  describe('Error Details', () => {
    it('should include timestamp in error log', async () => {
      // Arrange
      const error = new Error('Test error');
      mockedGetAllAgents.mockRejectedValue(error);

      // Act
      await expect(listAgents(mockConfig)).rejects.toThrow('Test error');

      // Assert
      expect(loggedErrors).toHaveLength(1);
      expect(loggedErrors[0].timestamp).toBeInstanceOf(Date);
    });

    it('should preserve error name property', async () => {
      // Arrange - Create custom error
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const customError = new CustomError('Custom error message');
      mockedGetAllAgents.mockRejectedValue(customError);

      // Act
      await expect(listAgents(mockConfig)).rejects.toThrow('Custom error message');

      // Assert
      expect(loggedErrors).toHaveLength(1);
      expect(loggedErrors[0].error.name).toBe('CustomError');
    });
  });
});