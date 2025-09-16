/**
 * Tests for ErrorLogger integration in read-task tool
 * Following strict TDD methodology - RED phase
 * Testing MEDIUM severity error logging for file read failures
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ServerConfig } from '../../../src/types.js';
import { readTask } from '../../../src/tools/read-task.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import type { ErrorLogEntry } from '../../../src/logging/ErrorLogger.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn()
}));

jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  getStats: jest.fn(),
  parseTaskMetadata: jest.fn(),
  validateAgentName: jest.fn(),
  validateTaskName: jest.fn()
}));

jest.mock('../../../src/utils/validation.js', () => ({
  validateRequiredString: (jest.requireActual('../../../src/utils/validation.js') as any).validateRequiredString,
  validateTaskFileType: (jest.requireActual('../../../src/utils/validation.js') as any).validateTaskFileType
}));

// Import mocked modules
// Removed unused import: fs '../../../src/utils/fs-extra-safe.js';
import * as fileSystem from '../../../src/utils/file-system.js';

// Remove unused mockedFs
const mockedFileSystem = fileSystem as jest.MockedObject<typeof fileSystem>;

describe('read-task ErrorLogger Integration', () => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Scenario 1: File not found errors', () => {
    it('should log error when task file does not exist', async () => {
      // Arrange
      const agent = 'test-agent';
      const task = 'test-task';
      const file = 'INIT';

      // Mock file not found error
      const fileNotFoundError = Object.assign(
        new Error('File not found: INIT.md'),
        { code: 'ENOENT' }
      );
      mockedFileSystem.readFile.mockRejectedValue(fileNotFoundError);

      // Act & Assert
      await expect(readTask(mockConfig, { agent, task, file }))
        .rejects.toThrow('File not found');

      // Verify ErrorLogger was called with correct parameters
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'read_task',
          agent: 'test-agent',
          taskId: 'test-task',
          error: expect.objectContaining({
            message: expect.stringContaining('File not found'),
            code: 'ENOENT'
          }),
          context: expect.objectContaining({
            tool: 'read-task',
            parameters: { agent: 'test-agent', task: 'test-task', file: 'INIT' }
          }),
          severity: 'medium'
        })
      );
    });
  });

  describe('Error Scenario 2: Permission denied errors', () => {
    it('should log error when file access is denied', async () => {
      // Arrange
      const agent = 'test-agent';
      const task = 'test-task';
      const file = 'PLAN';

      // Mock permission denied error
      const permissionError = Object.assign(
        new Error('Permission denied'),
        { code: 'EACCES' }
      );
      mockedFileSystem.readFile.mockRejectedValue(permissionError);

      // Act & Assert
      await expect(readTask(mockConfig, { agent, task, file }))
        .rejects.toThrow('Permission denied');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'read_task',
          agent: 'test-agent',
          taskId: 'test-task',
          error: expect.objectContaining({
            message: 'Permission denied',
            code: 'EACCES'
          }),
          context: expect.objectContaining({
            tool: 'read-task',
            parameters: { agent: 'test-agent', task: 'test-task', file: 'PLAN' }
          }),
          severity: 'medium'
        })
      );
    });
  });

  describe('Error Scenario 3: File corruption errors', () => {
    it('should log error when file content is corrupted', async () => {
      // Arrange
      const agent = 'test-agent';
      const task = 'test-task';
      const file = 'DONE';

      // Mock successful read but getStats fails
      mockedFileSystem.readFile.mockResolvedValue('# Done\n\nTask completed.');
      const corruptionError = new Error('File content corrupted or unreadable');
      mockedFileSystem.getStats.mockRejectedValue(corruptionError);

      // Act & Assert
      await expect(readTask(mockConfig, { agent, task, file }))
        .rejects.toThrow('File content corrupted');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'read_task',
          agent: 'test-agent',
          taskId: 'test-task',
          error: expect.objectContaining({
            message: expect.stringContaining('corrupted')
          }),
          context: expect.objectContaining({
            tool: 'read-task',
            parameters: { agent: 'test-agent', task: 'test-task', file: 'DONE' }
          }),
          severity: 'medium'
        })
      );
    });
  });

  describe('Error Scenario 4: Invalid file type errors', () => {
    it('should log error when invalid file type is requested', async () => {
      // Arrange
      const agent = 'test-agent';
      const task = 'test-task';
      const file = 'INVALID';

      // Validation will fail for invalid file type
      // Act & Assert
      await expect(readTask(mockConfig, { agent, task, file }))
        .rejects.toThrow();

      // Verify ErrorLogger was called for validation error
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          operation: 'read_task',
          agent: 'test-agent',
          error: expect.objectContaining({
            message: expect.stringContaining('file')
          }),
          context: expect.objectContaining({
            tool: 'read-task',
            parameters: { agent: 'test-agent', task: 'test-task', file: 'INVALID' }
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
      const task = 'test-task';
      const file = 'INIT';
      const content = '# Test Task\n\nThis is test content.';
      const mockStats = { mtime: new Date() } as any;

      // Mock successful operation
      mockedFileSystem.readFile.mockResolvedValue(content);
      mockedFileSystem.getStats.mockResolvedValue(mockStats);
      mockedFileSystem.parseTaskMetadata.mockReturnValue(undefined);

      // Act
      const result = await readTask(mockConfig, { agent, task, file });

      // Assert
      expect(result).toEqual({
        content,
        lastModified: mockStats.mtime
      });
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
    });
  });

  describe('ErrorLogger not configured', () => {
    it('should handle missing ErrorLogger gracefully', async () => {
      // Arrange
      const agent = 'test-agent';
      const task = 'test-task';
      const file = 'PLAN';
      const { errorLogger, ...configWithoutErrorLogger } = mockConfig;
      const testConfig = configWithoutErrorLogger as ServerConfig;

      const readError = Object.assign(
        new Error('File not found'),
        { code: 'ENOENT' }
      );
      mockedFileSystem.readFile.mockRejectedValue(readError);

      // Act & Assert - Should throw error but not crash
      await expect(readTask(testConfig, { agent, task, file }))
        .rejects.toThrow('File not found');

      // No ErrorLogger to call
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
    });
  });
});