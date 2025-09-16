/**
 * Unit tests for restore-tasks tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { restoreTasksTool } from '../../../src/tools/restore-tasks.js';
import * as taskManager from '../../../src/utils/task-manager.js';
import * as validation from '../../../src/utils/validation.js';
import { ServerConfig, RestoreResult, InvalidTaskError } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';

// Mock modules
jest.mock('../../../src/utils/task-manager.js');
jest.mock('../../../src/utils/validation.js');

const mockTaskManager = taskManager as jest.Mocked<typeof taskManager>;
const mockValidation = validation as jest.Mocked<typeof validation>;

// Mock ErrorLogger
const mockErrorLogger = {
  logError: jest.fn().mockImplementation(() => Promise.resolve())
};

describe('Restore Tasks Tool', () => {
  let mockConfig: ServerConfig;
  let mockRestoreResult: RestoreResult;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      ...testUtils.createMockConfig(),
      errorLogger: mockErrorLogger as any
    };
    mockRestoreResult = {
      restored: {
        completed: 3,
        pending: 2,
        total: 5
      },
      timestamp: '2025-01-01T12-00-00'
    };

    // Setup default validation mocks
    mockValidation.validateRequiredString.mockImplementation((value) => value as string);
    mockValidation.validateOptionalString.mockImplementation((value) => value as string | undefined);

    // Setup default task manager mock
    mockTaskManager.restoreTasks.mockResolvedValue(mockRestoreResult);
  });

  describe('successful restore operations', () => {
    it('should restore tasks with valid timestamp', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('2025-01-01T12-00-00', 'timestamp');
      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith(undefined, 'agent');
      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith(undefined, 'taskName');
      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        undefined, 
        undefined
      );
      
      expect(result).toEqual(mockRestoreResult);
    });

    it('should restore tasks with timestamp and agent filter', async () => {
      const args = {
        timestamp: '2025-01-01T15-30-45',
        agent: 'backend-engineer'
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce('backend-engineer').mockReturnValueOnce(undefined);
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('2025-01-01T15-30-45', 'timestamp');
      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith('backend-engineer', 'agent');
      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T15-30-45', 
        'backend-engineer', 
        undefined
      );
      
      expect(result).toEqual(mockRestoreResult);
    });

    it('should restore tasks with timestamp and taskName filter', async () => {
      const args = {
        timestamp: '2025-01-02T09-15-30',
        taskName: 'implement-api'
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce(undefined).mockReturnValueOnce('implement-api');
      
      await restoreTasksTool(mockConfig, args);

      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith(undefined, 'agent');
      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith('implement-api', 'taskName');
      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-02T09-15-30', 
        undefined, 
        'implement-api'
      );
    });

    it('should restore tasks with all parameters', async () => {
      const args = {
        timestamp: '2025-01-03T14-20-10',
        agent: 'frontend-engineer',
        taskName: 'fix-ui-bug'
      };
      
      mockValidation.validateOptionalString
        .mockReturnValueOnce('frontend-engineer')
        .mockReturnValueOnce('fix-ui-bug');
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-03T14-20-10', 
        'frontend-engineer', 
        'fix-ui-bug'
      );
      
      expect(result).toEqual(mockRestoreResult);
    });

    it('should handle different timestamp formats', async () => {
      const validTimestamps = [
        '2025-01-01T00-00-00',
        '2025-12-31T23-59-59',
        '2025-06-15T12-30-45',
        '2000-01-01T01-01-01',
        '2099-12-31T23-59-59'
      ];
      
      for (const timestamp of validTimestamps) {
        const args = { timestamp };
        
        const result = await restoreTasksTool(mockConfig, args);
        
        expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
          mockConfig, 
          timestamp, 
          undefined, 
          undefined
        );
        expect(result).toEqual(mockRestoreResult);
        
        jest.clearAllMocks();
        mockTaskManager.restoreTasks.mockResolvedValue(mockRestoreResult);
      }
    });

    it('should handle complex agent names', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        agent: 'senior-qa-automation-engineer_v2'
      };
      
      mockValidation.validateOptionalString
        .mockReturnValueOnce('senior-qa-automation-engineer_v2')
        .mockReturnValueOnce(undefined);
      
      await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        'senior-qa-automation-engineer_v2', 
        undefined
      );
    });

    it('should handle complex task names with patterns', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        taskName: '20250101-123456-implement-user-auth'
      };
      
      mockValidation.validateOptionalString
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('20250101-123456-implement-user-auth');
      
      await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        undefined, 
        '20250101-123456-implement-user-auth'
      );
    });
  });

  describe('timestamp validation failures', () => {
    it('should throw error and log for invalid timestamp format - wrong separators', async () => {
      const args = {
        timestamp: '2025/01/01 12:00:00'
      };

      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');

      expect(mockTaskManager.restoreTasks).not.toHaveBeenCalled();
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
          source: 'validation',
          operation: 'restore_tasks',
          agent: 'unknown',
          error: expect.objectContaining({
            message: 'Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss'
          }),
          context: expect.objectContaining({
            tool: 'restore-tasks',
            parameters: expect.objectContaining({
              timestamp: '2025/01/01 12:00:00'
            })
          }),
          severity: 'high'
        })
      );
    });

    it('should throw error for invalid timestamp format - missing components', async () => {
      const invalidTimestamps = [
        '2025-01-01',
        '12-00-00',
        '2025-01-01T',
        'T12-00-00',
        '2025-01',
        '01T12-00-00',
        '2025-01-01T12',
        '2025-01-01T12-00'
      ];
      
      for (const timestamp of invalidTimestamps) {
        const args = { timestamp };
        
        await expect(restoreTasksTool(mockConfig, args))
          .rejects.toThrow('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');
        
        expect(mockTaskManager.restoreTasks).not.toHaveBeenCalled();
        jest.clearAllMocks();
      }
    });

    it('should throw error for invalid timestamp format - wrong length', async () => {
      const args = {
        timestamp: '2025-1-1T1-0-0' // Too short
      };
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');
    });

    it('should throw error for invalid timestamp format - extra characters', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00-extra'
      };
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');
    });

    it('should throw error for invalid timestamp format - wrong characters', async () => {
      const invalidFormats = [
        '2025-01-01T12:00:00', // Colons instead of dashes
        '2025/01/01T12-00-00', // Slashes instead of dashes
        '2025-01-01 12-00-00', // Space instead of T
        '2025-01-01t12-00-00', // Lowercase t
        '25-01-01T12-00-00',   // 2-digit year
        'abcd-01-01T12-00-00', // Non-numeric year
        '2025-ab-01T12-00-00', // Non-numeric month
        '2025-01-abT12-00-00', // Non-numeric day
        '2025-01-01Txy-00-00', // Non-numeric hour
        '2025-01-01T12-xy-00', // Non-numeric minute
        '2025-01-01T12-00-xy'  // Non-numeric second
      ];
      
      for (const timestamp of invalidFormats) {
        const args = { timestamp };
        
        await expect(restoreTasksTool(mockConfig, args))
          .rejects.toThrow('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');
        
        jest.clearAllMocks();
      }
    });

    it('should validate timestamp before other validation', async () => {
      // Invalid timestamp should fail before validation functions are called
      const args = {
        timestamp: 'invalid',
        agent: 'test-agent',
        taskName: 'test-task'
      };
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');
      
      // Validation functions should not be called for optional parameters
      // if timestamp validation fails first
      expect(mockValidation.validateOptionalString).not.toHaveBeenCalled();
    });
  });

  describe('input validation failures', () => {
    it('should propagate validation error for missing timestamp', async () => {
      const args = {
        agent: 'test-agent'
      };
      
      mockValidation.validateRequiredString.mockImplementation(() => {
        throw new InvalidTaskError('timestamp must be a non-empty string', 'timestamp');
      });
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('timestamp must be a non-empty string');
      
      expect(mockTaskManager.restoreTasks).not.toHaveBeenCalled();
    });

    it('should propagate validation error for empty timestamp', async () => {
      const args = {
        timestamp: ''
      };
      
      mockValidation.validateRequiredString.mockImplementation(() => {
        throw new InvalidTaskError('timestamp must be a non-empty string', 'timestamp');
      });
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('timestamp must be a non-empty string');
    });

    it('should propagate validation error for non-string timestamp', async () => {
      const args = {
        timestamp: 123
      };
      
      mockValidation.validateRequiredString.mockImplementation(() => {
        throw new InvalidTaskError('timestamp must be a non-empty string', 'timestamp');
      });
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('timestamp must be a non-empty string');
    });

    it('should propagate validation error for agent parameter', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        agent: 123 // Invalid type
      };
      
      mockValidation.validateOptionalString.mockImplementation((value, name) => {
        if (name === 'agent') {
          throw new InvalidTaskError('agent must be a string', 'agent');
        }
        return value as string | undefined;
      });
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('agent must be a string');
    });

    it('should propagate validation error for taskName parameter', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        taskName: []
      };
      
      mockValidation.validateOptionalString.mockImplementation((value, name) => {
        if (name === 'taskName') {
          throw new InvalidTaskError('taskName must be a string', 'taskName');
        }
        return value as string | undefined;
      });
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('taskName must be a string');
    });

    it('should handle null values for optional parameters', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        agent: null,
        taskName: null
      };
      
      mockValidation.validateOptionalString.mockReturnValue(undefined);
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith(null, 'agent');
      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith(null, 'taskName');
      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        undefined, 
        undefined
      );
      expect(result).toEqual(mockRestoreResult);
    });

    it('should handle undefined values for optional parameters', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
        // agent and taskName are undefined
      };
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith(undefined, 'agent');
      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith(undefined, 'taskName');
      expect(result).toEqual(mockRestoreResult);
    });
  });

  describe('task manager error propagation', () => {
    it('should propagate and log file system errors from task manager', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };

      const fsError = new Error('ENOENT: no such file or directory');
      mockTaskManager.restoreTasks.mockRejectedValue(fsError);

      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('ENOENT: no such file or directory');

      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
          source: 'tool_execution',
          operation: 'restore_tasks',
          agent: 'unknown',
          error: expect.objectContaining({
            message: 'ENOENT: no such file or directory'
          }),
          context: expect.objectContaining({
            tool: 'restore-tasks',
            parameters: expect.objectContaining({
              timestamp: '2025-01-01T12-00-00'
            })
          }),
          severity: 'medium'
        })
      );
    });

    it('should propagate and log permission errors from task manager', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };

      const permissionError = new Error('EACCES: permission denied');
      mockTaskManager.restoreTasks.mockRejectedValue(permissionError);

      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('EACCES: permission denied');

      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Date),
          source: 'tool_execution',
          operation: 'restore_tasks',
          agent: 'unknown',
          error: expect.objectContaining({
            message: 'EACCES: permission denied'
          }),
          context: expect.objectContaining({
            tool: 'restore-tasks',
            parameters: expect.objectContaining({
              timestamp: '2025-01-01T12-00-00'
            })
          }),
          severity: 'high'
        })
      );
    });

    it('should propagate custom InvalidTaskError from task manager', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      const invalidError = new InvalidTaskError('Archive not found for timestamp', 'timestamp');
      mockTaskManager.restoreTasks.mockRejectedValue(invalidError);
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('Archive not found for timestamp');
    });

    it('should propagate disk errors from task manager', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      const diskError = new Error('ENOSPC: no space left on device');
      mockTaskManager.restoreTasks.mockRejectedValue(diskError);
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('ENOSPC: no space left on device');
    });

    it('should propagate timeout errors from task manager', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      const timeoutError = new Error('Operation timeout');
      mockTaskManager.restoreTasks.mockRejectedValue(timeoutError);
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('Operation timeout');
    });

    it('should propagate archive corruption errors', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      const corruptionError = new Error('Archive file is corrupted');
      mockTaskManager.restoreTasks.mockRejectedValue(corruptionError);
      
      await expect(restoreTasksTool(mockConfig, args))
        .rejects.toThrow('Archive file is corrupted');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle empty agent filter (treated as undefined)', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        agent: ''
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        undefined, 
        undefined
      );
      expect(result).toEqual(mockRestoreResult);
    });

    it('should handle empty taskName filter (treated as undefined)', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        taskName: '   '
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce(undefined).mockReturnValueOnce(undefined);
      
      await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        undefined, 
        undefined
      );
    });

    it('should handle unicode characters in agent and task names', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        agent: 'développeur-backend',
        taskName: 'tâche-spéciale-éöñ'
      };
      
      mockValidation.validateOptionalString
        .mockReturnValueOnce('développeur-backend')
        .mockReturnValueOnce('tâche-spéciale-éöñ');
      
      await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        'développeur-backend', 
        'tâche-spéciale-éöñ'
      );
    });

    it('should handle very long agent and task names', async () => {
      const longAgent = 'very-long-agent-name-' + 'x'.repeat(200);
      const longTaskName = 'very-long-task-name-' + 'y'.repeat(200);
      
      const args = {
        timestamp: '2025-01-01T12-00-00',
        agent: longAgent,
        taskName: longTaskName
      };
      
      mockValidation.validateOptionalString
        .mockReturnValueOnce(longAgent)
        .mockReturnValueOnce(longTaskName);
      
      await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        longAgent, 
        longTaskName
      );
    });

    it('should handle edge case timestamp values', async () => {
      const edgeTimestamps = [
        '1970-01-01T00-00-00', // Unix epoch
        '2000-02-29T12-00-00', // Leap year
        '2025-12-31T23-59-59', // End of year
        '2025-01-01T00-00-01', // Start of year + 1 second
        '2099-12-31T23-59-58'  // Far future
      ];
      
      for (const timestamp of edgeTimestamps) {
        const args = { timestamp };
        
        const result = await restoreTasksTool(mockConfig, args);
        expect(result).toEqual(mockRestoreResult);
        
        jest.clearAllMocks();
        mockTaskManager.restoreTasks.mockResolvedValue(mockRestoreResult);
      }
    });

    it('should handle special characters in agent and task names', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00',
        agent: 'agent-with-special_chars.123',
        taskName: 'task(with)various[special]chars{and}dots.md'
      };
      
      mockValidation.validateOptionalString
        .mockReturnValueOnce('agent-with-special_chars.123')
        .mockReturnValueOnce('task(with)various[special]chars{and}dots.md');
      
      await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        'agent-with-special_chars.123', 
        'task(with)various[special]chars{and}dots.md'
      );
    });

    it('should handle trimmed values from validation', async () => {
      const args = {
        timestamp: '  2025-01-01T12-00-00  ',
        agent: '  trimmed-agent  ',
        taskName: '  trimmed-task  '
      };
      
      mockValidation.validateRequiredString.mockReturnValue('2025-01-01T12-00-00');
      mockValidation.validateOptionalString
        .mockReturnValueOnce('trimmed-agent')
        .mockReturnValueOnce('trimmed-task');
      
      await restoreTasksTool(mockConfig, args);

      expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
        mockConfig, 
        '2025-01-01T12-00-00', 
        'trimmed-agent', 
        'trimmed-task'
      );
    });
  });

  describe('timestamp regex validation edge cases', () => {
    it('should validate exact format requirements', async () => {
      // Test the exact regex pattern: /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/
      const validTimestamp = '2025-01-01T12-00-00';
      const args = { timestamp: validTimestamp };
      
      const result = await restoreTasksTool(mockConfig, args);
      expect(result).toEqual(mockRestoreResult);
    });

    it('should reject timestamps with incorrect digit counts', async () => {
      const invalidTimestamps = [
        '25-01-01T12-00-00',    // 2 digits for year
        '2025-1-01T12-00-00',   // 1 digit for month
        '2025-01-1T12-00-00',   // 1 digit for day
        '2025-01-01T1-00-00',   // 1 digit for hour
        '2025-01-01T12-0-00',   // 1 digit for minute
        '2025-01-01T12-00-0',   // 1 digit for second
        '20255-01-01T12-00-00', // 5 digits for year
        '2025-001-01T12-00-00', // 3 digits for month
        '2025-01-001T12-00-00', // 3 digits for day
        '2025-01-01T123-00-00', // 3 digits for hour
        '2025-01-01T12-000-00', // 3 digits for minute
        '2025-01-01T12-00-000'  // 3 digits for second
      ];
      
      for (const timestamp of invalidTimestamps) {
        const args = { timestamp };
        
        await expect(restoreTasksTool(mockConfig, args))
          .rejects.toThrow('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');
        
        jest.clearAllMocks();
      }
    });

    it('should handle boundary values that still match the pattern', async () => {
      // These are valid regex matches but may be invalid dates
      // The tool only validates format, not date validity
      const borderlineValidTimestamps = [
        '0000-00-00T00-00-00',
        '9999-99-99T99-99-99',
        '1234-56-78T90-12-34'
      ];
      
      for (const timestamp of borderlineValidTimestamps) {
        const args = { timestamp };
        
        // Should pass regex validation but may fail in task manager
        await restoreTasksTool(mockConfig, args);
        expect(mockTaskManager.restoreTasks).toHaveBeenCalledWith(
          mockConfig, 
          timestamp, 
          undefined, 
          undefined
        );
        
        jest.clearAllMocks();
        mockTaskManager.restoreTasks.mockResolvedValue(mockRestoreResult);
      }
    });
  });

  describe('response structure validation', () => {
    it('should return RestoreResult with required properties', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(result).toHaveProperty('restored');
      expect(result).toHaveProperty('timestamp');
      
      expect(result.restored).toHaveProperty('completed');
      expect(result.restored).toHaveProperty('pending');
      expect(result.restored).toHaveProperty('total');
      
      expect(typeof result.restored.completed).toBe('number');
      expect(typeof result.restored.pending).toBe('number');
      expect(typeof result.restored.total).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should return result from task manager without modification', async () => {
      const customResult: RestoreResult = {
        restored: {
          completed: 10,
          pending: 5,
          total: 15
        },
        timestamp: '2025-01-02T08-30-15'
      };
      
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      mockTaskManager.restoreTasks.mockResolvedValue(customResult);
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(result).toEqual(customResult);
    });

    it('should handle zero restore counts', async () => {
      const zeroResult: RestoreResult = {
        restored: {
          completed: 0,
          pending: 0,
          total: 0
        },
        timestamp: '2025-01-01T12-00-00'
      };
      
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      mockTaskManager.restoreTasks.mockResolvedValue(zeroResult);
      
      const result = await restoreTasksTool(mockConfig, args);

      expect(result).toEqual(zeroResult);
    });
  });

  describe('async operation handling', () => {
    it('should properly await task manager operation', async () => {
      const args = {
        timestamp: '2025-01-01T12-00-00'
      };
      
      let resolvePromise: (value: RestoreResult) => void;
      
      const delayedPromise = new Promise<RestoreResult>((resolve) => {
        resolvePromise = resolve;
      });
      
      mockTaskManager.restoreTasks.mockReturnValue(delayedPromise);
      
      const resultPromise = restoreTasksTool(mockConfig, args);
      
      // Resolve after a delay
      setTimeout(() => resolvePromise(mockRestoreResult), 10);
      
      const result = await resultPromise;
      expect(result).toEqual(mockRestoreResult);
    });

    it('should handle concurrent restore operations', async () => {
      const args1 = {
        timestamp: '2025-01-01T12-00-00',
        agent: 'agent-1'
      };
      
      const args2 = {
        timestamp: '2025-01-02T12-00-00',
        agent: 'agent-2'
      };
      
      const result1: RestoreResult = {
        restored: { completed: 3, pending: 1, total: 4 },
        timestamp: '2025-01-01T12-00-00'
      };
      
      const result2: RestoreResult = {
        restored: { completed: 2, pending: 3, total: 5 },
        timestamp: '2025-01-02T12-00-00'
      };
      
      mockValidation.validateOptionalString
        .mockReturnValueOnce('agent-1')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('agent-2')
        .mockReturnValueOnce(undefined);
      
      mockTaskManager.restoreTasks
        .mockResolvedValueOnce(result1)
        .mockResolvedValueOnce(result2);
      
      const [response1, response2] = await Promise.all([
        restoreTasksTool(mockConfig, args1),
        restoreTasksTool(mockConfig, args2)
      ]);
      
      expect(response1).toEqual(result1);
      expect(response2).toEqual(result2);
      expect(mockTaskManager.restoreTasks).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure scenarios in concurrent operations', async () => {
      const args1 = { timestamp: '2025-01-01T12-00-00' };
      const args2 = { timestamp: 'invalid-timestamp' };
      
      const results = await Promise.allSettled([
        restoreTasksTool(mockConfig, args1),
        restoreTasksTool(mockConfig, args2)
      ]);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      
      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toEqual(mockRestoreResult);
      }
      
      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toContain('Invalid timestamp format');
      }
    });
  });
});