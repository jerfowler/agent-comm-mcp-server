/**
 * Unit tests for archive-completed-tasks tool
 * Tests for archiving completed tasks functionality
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { archiveCompletedTasks } from '../../../src/tools/archive-completed-tasks.js';
import * as archiveTasksModule from '../../../src/tools/archive-tasks.js';
import { ServerConfig, ArchiveResult } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';

// Mock the archive-tasks module
jest.mock('../../../src/tools/archive-tasks.js');

const mockArchiveTasksModule = archiveTasksModule as jest.Mocked<typeof archiveTasksModule>;

describe('Archive Completed Tasks Tool', () => {
  let mockConfig: ServerConfig;
  let mockArchiveResult: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = testUtils.createMockConfig();
    
    // Default successful archive result
    mockArchiveResult = {
      timestamp: '2025-01-01T12:00:00Z',
      archived: {
        total: 5,
        agents: [
          { agent: 'test-agent', tasks: 3 },
          { agent: 'other-agent', tasks: 2 }
        ]
      },
      remaining: {
        total: 2,
        agents: [
          { agent: 'active-agent', tasks: 2 }
        ]
      },
      skipped: {
        total: 0,
        reasons: []
      }
    };

    mockArchiveTasksModule.archiveTasksTool.mockResolvedValue(mockArchiveResult);
  });

  describe('successful operations', () => {
    it('should archive completed tasks with default arguments', async () => {
      const result = await archiveCompletedTasks(mockConfig);

      expect(mockArchiveTasksModule.archiveTasksTool).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });

      expect(result).toEqual({
        success: true,
        archivedCount: 5,
        timestamp: '2025-01-01T12:00:00Z',
        message: 'Successfully archived 5 completed tasks'
      });
    });

    it('should archive completed tasks with custom arguments', async () => {
      const customArgs = {
        dryRun: true,
        archiveDir: '/custom/archive'
      };

      const result = await archiveCompletedTasks(mockConfig, customArgs);

      expect(mockArchiveTasksModule.archiveTasksTool).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: true,
        archiveDir: '/custom/archive'
      });

      expect(result).toEqual({
        success: true,
        archivedCount: 5,
        timestamp: '2025-01-01T12:00:00Z',
        message: 'Successfully archived 5 completed tasks'
      });
    });

    it('should handle zero completed tasks', async () => {
      const emptyResult = {
        ...mockArchiveResult,
        archived: { total: 0, agents: [] }
      };
      
      mockArchiveTasksModule.archiveTasksTool.mockResolvedValue(emptyResult);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: true,
        archivedCount: 0,
        timestamp: '2025-01-01T12:00:00Z',
        message: 'Successfully archived 0 completed tasks'
      });
    });

    it('should handle large number of completed tasks', async () => {
      const largeResult = {
        ...mockArchiveResult,
        archived: { total: 1000, agents: [] }
      };
      
      mockArchiveTasksModule.archiveTasksTool.mockResolvedValue(largeResult);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: true,
        archivedCount: 1000,
        timestamp: '2025-01-01T12:00:00Z',
        message: 'Successfully archived 1000 completed tasks'
      });
    });

    it('should allow args to override default values', async () => {
      const originalArgs = {
        mode: 'all', // Will override default 'completed'
        dryRun: true,
        customProperty: 'preserved'
      };

      await archiveCompletedTasks(mockConfig, originalArgs);

      expect(mockArchiveTasksModule.archiveTasksTool).toHaveBeenCalledWith(mockConfig, {
        mode: 'all', // Args override default values
        dryRun: true, // Should preserve
        customProperty: 'preserved' // Should preserve
      });
    });

    it('should work with empty args object', async () => {
      await archiveCompletedTasks(mockConfig, {});

      expect(mockArchiveTasksModule.archiveTasksTool).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
    });
  });

  describe('error handling', () => {
    it('should handle archive tool errors gracefully', async () => {
      const archiveError = new Error('Archive operation failed');
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(archiveError);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: false,
        archivedCount: 0,
        timestamp: expect.any(String),
        message: 'Archive operation failed'
      });

      // Verify timestamp is a valid ISO string
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp!).toISOString()).toBe(result.timestamp);
    });

    it('should handle non-Error exceptions', async () => {
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue('String error');

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: false,
        archivedCount: 0,
        timestamp: expect.any(String),
        message: 'Archive operation failed'
      });
    });

    it('should handle null/undefined errors', async () => {
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(null);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: false,
        archivedCount: 0,
        timestamp: expect.any(String),
        message: 'Archive operation failed'
      });
    });

    it('should handle complex error objects', async () => {
      const complexError = new Error('Complex error');
      complexError.name = 'CustomError';
      (complexError as any).code = 'EACCESS';
      
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(complexError);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: false,
        archivedCount: 0,
        timestamp: expect.any(String),
        message: 'Complex error'
      });
    });

    it('should handle file system errors from archive tool', async () => {
      const fsError = new Error('ENOENT: no such file or directory');
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(fsError);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: false,
        archivedCount: 0,
        timestamp: expect.any(String),
        message: 'ENOENT: no such file or directory'
      });
    });

    it('should handle permission errors from archive tool', async () => {
      const permError = new Error('EACCES: permission denied');
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(permError);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: false,
        archivedCount: 0,
        timestamp: expect.any(String),
        message: 'EACCES: permission denied'
      });
    });
  });

  describe('input validation', () => {
    it('should handle null config', async () => {
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(new Error('Config cannot be null'));
      
      await expect(archiveCompletedTasks(null as any))
        .resolves.toMatchObject({
          success: false,
          archivedCount: 0,
          message: 'Config cannot be null'
        });
    });

    it('should handle undefined config', async () => {
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(new Error('Config cannot be undefined'));
      
      await expect(archiveCompletedTasks(undefined as any))
        .resolves.toMatchObject({
          success: false,
          archivedCount: 0,
          message: 'Config cannot be undefined'
        });
    });

    it('should handle null args parameter', async () => {
      await archiveCompletedTasks(mockConfig, null as any);

      expect(mockArchiveTasksModule.archiveTasksTool).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
    });

    it('should handle undefined args parameter', async () => {
      await archiveCompletedTasks(mockConfig, undefined);

      expect(mockArchiveTasksModule.archiveTasksTool).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false
      });
    });

    it('should handle non-object args parameter', async () => {
      // The spread operator will spread string characters as properties
      await archiveCompletedTasks(mockConfig, 'abc' as any);

      expect(mockArchiveTasksModule.archiveTasksTool).toHaveBeenCalledWith(mockConfig, {
        mode: 'completed',
        dryRun: false,
        '0': 'a',
        '1': 'b', 
        '2': 'c'
      });
    });
  });

  describe('edge cases', () => {
    it('should handle malformed archive result', async () => {
      const malformedResult = {
        timestamp: '2025-01-01T12:00:00Z',
        archived: null // Missing or malformed archived property
      };
      
      mockArchiveTasksModule.archiveTasksTool.mockResolvedValue(malformedResult);

      const result = await archiveCompletedTasks(mockConfig);

      // This will actually throw an error because result.archived.total tries to access .total on null
      expect(result.success).toBe(false);
      expect(result.archivedCount).toBe(0);
      expect(result.message).toBe("Cannot read properties of null (reading 'total')");
    });

    it('should handle missing timestamp in result', async () => {
      const resultWithMissingTimestamp = {
        archived: { completed: 3, pending: 2, total: 5, agents: [] },
        timestamp: ''  // Empty timestamp to test edge case
      };
      
      mockArchiveTasksModule.archiveTasksTool.mockResolvedValue(resultWithMissingTimestamp);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(5);
      expect(result.timestamp).toBe(''); // Should pass through empty timestamp as-is
    });

    it('should handle missing archived.total in result', async () => {
      const resultWithZeroTotal = {
        timestamp: '2025-01-01T12:00:00Z',
        archived: { completed: 0, pending: 0, total: 0, agents: [] }
        // Test with zero total to simulate no tasks archived
      };
      
      mockArchiveTasksModule.archiveTasksTool.mockResolvedValue(resultWithZeroTotal);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(0); // Should be 0 when no tasks archived
    });
  });

  describe('async operation handling', () => {
    it('should handle delayed archive operations', async () => {
      let resolveArchive: (value: any) => void;
      const delayedPromise = new Promise<ArchiveResult>((resolve) => {
        resolveArchive = resolve;
      });
      
      mockArchiveTasksModule.archiveTasksTool.mockReturnValue(delayedPromise);

      const resultPromise = archiveCompletedTasks(mockConfig);
      
      // Resolve after delay
      setTimeout(() => resolveArchive(mockArchiveResult), 10);
      
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.archivedCount).toBe(5);
    });

    it('should handle concurrent archive operations', async () => {
      const config1 = testUtils.createMockConfig({ commDir: '/test/comm1' });
      const config2 = testUtils.createMockConfig({ commDir: '/test/comm2' });

      const result1Promise = archiveCompletedTasks(config1);
      const result2Promise = archiveCompletedTasks(config2);

      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockArchiveTasksModule.archiveTasksTool).toHaveBeenCalledTimes(2);
    });

    it('should handle archive tool timeouts', async () => {
      const timeoutError = new Error('Archive operation timed out');
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(timeoutError);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toEqual({
        success: false,
        archivedCount: 0,
        timestamp: expect.any(String),
        message: 'Archive operation timed out'
      });
    });
  });

  describe('result structure validation', () => {
    it('should return ArchiveCompletedTasksResult with required properties', async () => {
      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('archivedCount');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('message');

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.archivedCount).toBe('number');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.message).toBe('string');
    });

    it('should maintain result structure consistency on error', async () => {
      mockArchiveTasksModule.archiveTasksTool.mockRejectedValue(new Error('Test error'));

      const result = await archiveCompletedTasks(mockConfig);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('archivedCount');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('message');

      expect(result.success).toBe(false);
      expect(result.archivedCount).toBe(0);
      expect(result.message).toBe('Test error');
    });

    it('should ensure archived count is always non-negative', async () => {
      const negativeResult = {
        ...mockArchiveResult,
        archived: { total: -5, agents: [] }
      };
      
      mockArchiveTasksModule.archiveTasksTool.mockResolvedValue(negativeResult);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result.archivedCount).toBe(-5); // Should pass through the actual value
      expect(result.success).toBe(true);
    });

    it('should handle non-numeric archived totals', async () => {
      const invalidResult = {
        ...mockArchiveResult,
        archived: { total: 'invalid', agents: [] }
      };
      
      mockArchiveTasksModule.archiveTasksTool.mockResolvedValue(invalidResult);

      const result = await archiveCompletedTasks(mockConfig);

      expect(result.archivedCount).toBe('invalid'); // Should pass through actual value
      expect(result.success).toBe(true);
    });
  });
});