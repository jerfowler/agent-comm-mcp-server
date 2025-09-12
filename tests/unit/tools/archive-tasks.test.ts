/**
 * Unit tests for archive-tasks tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { archiveTasksTool } from '../../../src/tools/archive-tasks.js';
import * as taskManager from '../../../src/utils/task-manager.js';
import * as validation from '../../../src/utils/validation.js';
import { ServerConfig, ArchiveResult, InvalidTaskError, ArchiveError } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';

// Mock modules
jest.mock('../../../src/utils/task-manager.js');
jest.mock('../../../src/utils/validation.js');

const mockTaskManager = taskManager as jest.Mocked<typeof taskManager>;
const mockValidation = validation as jest.Mocked<typeof validation>;

describe('Archive Tasks Tool', () => {
  let mockConfig: ServerConfig;
  let mockArchiveResult: ArchiveResult;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = testUtils.createMockConfig();
    mockArchiveResult = {
      archived: {
        completed: 5,
        pending: 2,
        total: 7
      },
      timestamp: testUtils.getTestTimestamp(),
      archivePath: '/test/archive/2025-01-01T12-00-00'
    };

    // Setup default validation mocks
    mockValidation.validateArchiveMode.mockImplementation((value) => value as unknown as "completed" | "all" | "by-agent" | "by-date");
    mockValidation.validateOptionalString.mockImplementation((value) => value as string | undefined);
    mockValidation.validateBoolean.mockImplementation((value, _name, defaultValue) => 
      value !== undefined ? value as boolean : defaultValue as boolean
    );
    mockValidation.validateNumber.mockImplementation((value) => value as number);

    // Setup default task manager mock
    mockTaskManager.archiveTasks.mockResolvedValue(mockArchiveResult);
  });

  describe('successful archive operations', () => {
    it('should archive completed tasks with default parameters', async () => {
      const args = { mode: 'completed' };
      const result = await archiveTasksTool(mockConfig, args);

      expect(mockValidation.validateArchiveMode).toHaveBeenCalledWith('completed');
      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith(undefined, 'agent');
      expect(mockValidation.validateBoolean).toHaveBeenCalledWith(undefined, 'dryRun', false);
      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
      expect(result).toEqual(mockArchiveResult);
    });

    it('should archive all tasks with dry run enabled', async () => {
      const args = { 
        mode: 'all',
        dryRun: true 
      };
      
      mockValidation.validateBoolean.mockReturnValueOnce(true);
      
      const result = await archiveTasksTool(mockConfig, args);

      expect(mockValidation.validateArchiveMode).toHaveBeenCalledWith('all');
      expect(mockValidation.validateBoolean).toHaveBeenCalledWith(true, 'dryRun', false);
      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'all',
        dryRun: true
      });
      expect(result).toEqual(mockArchiveResult);
    });

    it('should archive tasks by agent', async () => {
      const args = {
        mode: 'by-agent',
        agent: 'test-agent',
        dryRun: false
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce('test-agent');
      
      const result = await archiveTasksTool(mockConfig, args);

      expect(mockValidation.validateArchiveMode).toHaveBeenCalledWith('by-agent');
      expect(mockValidation.validateOptionalString).toHaveBeenCalledWith('test-agent', 'agent');
      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'by-agent',
        agent: 'test-agent',
        dryRun: false
      });
      expect(result).toEqual(mockArchiveResult);
    });

    it('should archive tasks by date with olderThan parameter', async () => {
      const args = {
        mode: 'by-date',
        olderThan: 30,
        dryRun: false
      };
      
      mockValidation.validateNumber.mockReturnValueOnce(30);
      
      const result = await archiveTasksTool(mockConfig, args);

      expect(mockValidation.validateArchiveMode).toHaveBeenCalledWith('by-date');
      expect(mockValidation.validateNumber).toHaveBeenCalledWith(30, 'olderThan', 1);
      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'by-date',
        olderThan: 30,
        dryRun: false
      });
      expect(result).toEqual(mockArchiveResult);
    });

    it('should handle all optional parameters when provided', async () => {
      const args = {
        mode: 'by-agent',
        agent: 'multi-agent',
        dryRun: true,
        olderThan: 7
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce('multi-agent');
      mockValidation.validateBoolean.mockReturnValueOnce(true);
      mockValidation.validateNumber.mockReturnValueOnce(7);
      
      const result = await archiveTasksTool(mockConfig, args);

      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'by-agent',
        agent: 'multi-agent',
        dryRun: true,
        olderThan: 7
      });
      expect(result).toEqual(mockArchiveResult);
    });
  });

  describe('input validation failures', () => {
    it('should throw error when agent is required for by-agent mode but not provided', async () => {
      const args = { mode: 'by-agent' };
      
      mockValidation.validateOptionalString.mockReturnValueOnce(undefined);
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('Agent name is required for by-agent mode');
      
      expect(mockTaskManager.archiveTasks).not.toHaveBeenCalled();
    });

    it('should throw error when olderThan is required for by-date mode but not provided', async () => {
      const args = { mode: 'by-date' };
      
      const result = archiveTasksTool(mockConfig, args);
      
      await expect(result).rejects.toThrow('olderThan parameter is required for by-date mode');
      expect(mockTaskManager.archiveTasks).not.toHaveBeenCalled();
    });

    it('should propagate validation errors from validateArchiveMode', async () => {
      const args = { mode: 'invalid-mode' };
      
      mockValidation.validateArchiveMode.mockImplementation(() => {
        throw new InvalidTaskError('Invalid archive mode', 'invalid-mode');
      });
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('Invalid archive mode');
      
      expect(mockTaskManager.archiveTasks).not.toHaveBeenCalled();
    });

    it('should propagate validation errors from validateOptionalString', async () => {
      const args = { 
        mode: 'by-agent',
        agent: 123 // Invalid type
      };
      
      mockValidation.validateOptionalString.mockImplementation(() => {
        throw new InvalidTaskError('agent must be a string', 'agent');
      });
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('agent must be a string');
      
      expect(mockTaskManager.archiveTasks).not.toHaveBeenCalled();
    });

    it('should propagate validation errors from validateBoolean', async () => {
      const args = { 
        mode: 'completed',
        dryRun: 'invalid-boolean'
      };
      
      mockValidation.validateBoolean.mockImplementation(() => {
        throw new InvalidTaskError('dryRun must be a boolean', 'dryRun');
      });
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('dryRun must be a boolean');
      
      expect(mockTaskManager.archiveTasks).not.toHaveBeenCalled();
    });

    it('should propagate validation errors from validateNumber', async () => {
      const args = { 
        mode: 'by-date',
        olderThan: 'invalid-number'
      };
      
      mockValidation.validateNumber.mockImplementation(() => {
        throw new InvalidTaskError('olderThan must be a number', 'olderThan');
      });
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('olderThan must be a number');
      
      expect(mockTaskManager.archiveTasks).not.toHaveBeenCalled();
    });

    it('should handle negative olderThan values through validation', async () => {
      const args = { 
        mode: 'by-date',
        olderThan: -5
      };
      
      mockValidation.validateNumber.mockImplementation(() => {
        throw new InvalidTaskError('olderThan must be at least 1', 'olderThan');
      });
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('olderThan must be at least 1');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle undefined olderThan parameter correctly', async () => {
      const args = { mode: 'completed' };
      
      const result = await archiveTasksTool(mockConfig, args);

      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
      expect(result).toEqual(mockArchiveResult);
    });

    it('should handle empty agent string as undefined', async () => {
      const args = { 
        mode: 'completed',
        agent: ''
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce(undefined);
      
      const result = await archiveTasksTool(mockConfig, args);

      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
      expect(result).toEqual(mockArchiveResult);
    });

    it('should handle null values for optional parameters', async () => {
      const args = { 
        mode: 'completed',
        agent: null,
        dryRun: null
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce(undefined);
      mockValidation.validateBoolean.mockReturnValueOnce(false);
      
      const result = await archiveTasksTool(mockConfig, args);

      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
      expect(result).toEqual(mockArchiveResult);
    });
  });

  describe('task manager error propagation', () => {
    it('should propagate ArchiveError from task manager', async () => {
      const args = { mode: 'completed' };
      const archiveError = new ArchiveError('Failed to create archive directory', 'archive');
      
      mockTaskManager.archiveTasks.mockRejectedValue(archiveError);
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('Failed to create archive directory');
    });

    it('should propagate generic errors from task manager', async () => {
      const args = { mode: 'completed' };
      const genericError = new Error('Disk full');
      
      mockTaskManager.archiveTasks.mockRejectedValue(genericError);
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('Disk full');
    });

    it('should handle task manager timeout errors', async () => {
      const args = { mode: 'all' };
      const timeoutError = new Error('Operation timeout');
      
      mockTaskManager.archiveTasks.mockRejectedValue(timeoutError);
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('Operation timeout');
    });

    it('should handle permission denied errors from task manager', async () => {
      const args = { mode: 'completed' };
      const permissionError = new ArchiveError('Permission denied', 'archive');
      
      mockTaskManager.archiveTasks.mockRejectedValue(permissionError);
      
      await expect(archiveTasksTool(mockConfig, args))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('parameter combinations', () => {
    it('should properly construct options object with minimal parameters', async () => {
      const args = { mode: 'completed' };
      
      await archiveTasksTool(mockConfig, args);

      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
    });

    it('should properly construct options object with all parameters', async () => {
      const args = {
        mode: 'by-agent',
        agent: 'full-test-agent',
        dryRun: true,
        olderThan: 14
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce('full-test-agent');
      mockValidation.validateBoolean.mockReturnValueOnce(true);
      mockValidation.validateNumber.mockReturnValueOnce(14);
      
      await archiveTasksTool(mockConfig, args);

      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'by-agent',
        agent: 'full-test-agent',
        dryRun: true,
        olderThan: 14
      });
    });

    it('should exclude undefined values from options object', async () => {
      const args = { 
        mode: 'completed',
        agent: undefined,
        olderThan: undefined
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce(undefined);
      
      await archiveTasksTool(mockConfig, args);

      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
    });

    it('should handle mode=by-agent with agent provided (else branch coverage)', async () => {
      const args = {
        mode: 'by-agent',
        agent: 'test-agent',
        dryRun: false
      };
      
      mockValidation.validateOptionalString.mockReturnValueOnce('test-agent');
      
      const result = await archiveTasksTool(mockConfig, args);

      // This should pass validation and proceed without throwing
      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'by-agent',
        agent: 'test-agent',
        dryRun: false
      });
      expect(result).toEqual(mockArchiveResult);
    });

    it('should handle mode=by-date with olderThan provided (else branch coverage)', async () => {
      const args = {
        mode: 'by-date',
        olderThan: 7,
        dryRun: false
      };
      
      mockValidation.validateNumber.mockReturnValueOnce(7);
      
      const result = await archiveTasksTool(mockConfig, args);

      // This should pass validation and proceed without throwing
      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'by-date',
        olderThan: 7,
        dryRun: false
      });
      expect(result).toEqual(mockArchiveResult);
    });

    it('should handle case where olderThan is undefined (else branch coverage)', async () => {
      const args = { 
        mode: 'completed'
        // olderThan is not provided, so args['olderThan'] will be undefined
      };
      
      const result = await archiveTasksTool(mockConfig, args);

      // Should not call validateNumber since olderThan is undefined
      expect(mockValidation.validateNumber).not.toHaveBeenCalled();
      expect(mockTaskManager.archiveTasks).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
        // olderThan should not be included in options
      });
      expect(result).toEqual(mockArchiveResult);
    });
  });

  describe('async operation handling', () => {
    it('should properly await task manager operation', async () => {
      const args = { mode: 'completed' };
      let resolvePromise: (value: ArchiveResult) => void;
      
      const delayedPromise = new Promise<ArchiveResult>((resolve) => {
        resolvePromise = resolve;
      });
      
      mockTaskManager.archiveTasks.mockReturnValue(delayedPromise);
      
      const resultPromise = archiveTasksTool(mockConfig, args);
      
      // Resolve after a delay
      setTimeout(() => resolvePromise(mockArchiveResult), 10);
      
      const result = await resultPromise;
      expect(result).toEqual(mockArchiveResult);
    });

    it('should handle concurrent archive operations', async () => {
      const args1 = { mode: 'completed' };
      const args2 = { mode: 'all', dryRun: true };
      
      mockValidation.validateBoolean.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      const [result1, result2] = await Promise.all([
        archiveTasksTool(mockConfig, args1),
        archiveTasksTool(mockConfig, args2)
      ]);
      
      expect(result1).toEqual(mockArchiveResult);
      expect(result2).toEqual(mockArchiveResult);
      expect(mockTaskManager.archiveTasks).toHaveBeenCalledTimes(2);
    });
  });
});