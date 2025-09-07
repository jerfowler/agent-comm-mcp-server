/**
 * Unit tests for mark-complete tool
 * Focuses on basic completion functionality without verification gates
 */

import { markComplete, MarkCompleteArgs } from '../../../src/tools/mark-complete.js';
import { ServerConfig } from '../../../src/types.js';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';

// Mock TaskContextManager
const mockTaskContextManager = {
  markTaskComplete: jest.fn()
} as unknown as TaskContextManager;

// Mock config
const mockConfig: ServerConfig = {
  commDir: '/test/comm',
  archiveDir: '/test/archive',
  logDir: '/test/logs'
};

describe('Mark Complete Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockTaskContextManager.markTaskComplete as jest.Mock).mockResolvedValue({
      taskId: 'test-task-123',
      status: 'completed',
      timestamp: new Date().toISOString()
    });
  });

  describe('successful operations', () => {
    it('should mark task as DONE with valid inputs', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully with all requirements met'
      };

      const result = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result.success).toBe(true);
      expect(result.message).toContain('DONE');
      expect(result.taskId).toBe('test-task-123');
      expect(mockTaskContextManager.markTaskComplete).toHaveBeenCalledWith(
        'test-agent',
        expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/),
        'DONE',
        'Task completed successfully with all requirements met'
      );
    });

    it('should mark task as ERROR with valid inputs', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'ERROR',
        summary: 'Task failed due to unexpected system error encountered'
      };

      const result = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result.success).toBe(true);
      expect(result.message).toContain('ERROR');
      expect(mockTaskContextManager.markTaskComplete).toHaveBeenCalledWith(
        'test-agent',
        expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/),
        'ERROR',
        'Task failed due to unexpected system error encountered'
      );
    });

    it('should handle long summaries', async () => {
      const longSummary = 'This is a very long summary that describes in detail all the work that was completed, including multiple steps, challenges faced, and solutions implemented successfully';
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: longSummary
      };

      const result = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markTaskComplete).toHaveBeenCalledWith(
        'test-agent',
        expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/),
        'DONE',
        longSummary
      );
    });

    it('should handle agent names with special characters', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent-123_special',
        status: 'DONE',
        summary: 'Completed task with special agent name successfully'
      };

      const result = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markTaskComplete).toHaveBeenCalledWith(
        'test-agent-123_special',
        expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/),
        'DONE',
        'Completed task with special agent name successfully'
      );
    });

    it('should trim whitespace from summary', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: '  Task completed successfully with whitespace  '
      };

      const result = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markTaskComplete).toHaveBeenCalledWith(
        'test-agent',
        expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/),
        'DONE',
        'Task completed successfully with whitespace'
      );
    });

    it('should generate unique connection IDs for concurrent operations', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      const result1 = await markComplete(args, mockConfig, mockTaskContextManager);
      const result2 = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      const calls = (mockTaskContextManager.markTaskComplete as jest.Mock).mock.calls;
      expect(calls[0][1]).not.toBe(calls[1][1]); // Different connection IDs
    });
  });

  describe('input validation failures', () => {
    it('should reject invalid status values', async () => {
      const args = {
        agent: 'test-agent',
        status: 'INVALID' as any,
        summary: 'Task completed successfully'
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('Status must be either "DONE" or "ERROR"');
    });

    it('should reject empty status', async () => {
      const args = {
        agent: 'test-agent',
        status: '' as any,
        summary: 'Task completed successfully'
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('status is required and cannot be empty');
    });

    it('should reject short summaries', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'short'
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('Summary must be at least 10 characters long');
    });

    it('should reject whitespace-only summaries', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: '   '
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('summary is required and cannot be empty');
    });

    it('should reject missing agent', async () => {
      const args = {
        status: 'DONE' as const,
        summary: 'Task completed successfully'
      } as any;

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('agent is required and cannot be empty');
    });

    it('should handle null values for required fields', async () => {
      const args = {
        agent: null,
        status: 'DONE' as const,
        summary: 'Task completed successfully'
      } as any;

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('agent is required and cannot be empty');
    });

    it('should handle non-string types for required fields', async () => {
      const args = {
        agent: 123,
        status: 'DONE' as const,
        summary: 'Task completed successfully'
      } as any;

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('agent is required and cannot be empty');
    });
  });

  describe('configuration handling', () => {
    it('should use default configuration when not provided', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      // Create a new mock manager for this test
      const tempMockManager = {
        markTaskComplete: jest.fn().mockResolvedValue({
          taskId: 'test-task-456',
          status: 'completed',
          timestamp: new Date().toISOString()
        })
      } as unknown as TaskContextManager;

      const result = await markComplete(args, undefined, tempMockManager);

      expect(result.success).toBe(true);
      expect(tempMockManager.markTaskComplete).toHaveBeenCalled();
    });

    it('should create TaskContextManager when not provided', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      // This test verifies that the function doesn't throw when manager is not provided
      // The actual TaskContextManager creation is mocked at the module level
      await expect(markComplete(args, mockConfig)).resolves.toBeDefined();
    });
  });

  describe('TaskContextManager error propagation', () => {
    it('should propagate file system errors from TaskContextManager', async () => {
      (mockTaskContextManager.markTaskComplete as jest.Mock)
        .mockRejectedValue(new Error('File system error: Permission denied'));

      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('Failed to mark task complete: File system error: Permission denied');
    });

    it('should propagate permission errors from TaskContextManager', async () => {
      (mockTaskContextManager.markTaskComplete as jest.Mock)
        .mockRejectedValue(new Error('Permission denied'));

      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('Failed to mark task complete: Permission denied');
    });

    it('should propagate custom TaskContextManager errors', async () => {
      (mockTaskContextManager.markTaskComplete as jest.Mock)
        .mockRejectedValue(new Error('Custom error from TaskContextManager'));

      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('Failed to mark task complete: Custom error from TaskContextManager');
    });
  });

  describe('edge cases', () => {
    it('should handle exactly 10 character summary (boundary case)', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: '1234567890' // Exactly 10 characters
      };

      const result = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markTaskComplete).toHaveBeenCalledWith(
        'test-agent',
        expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/),
        'DONE',
        '1234567890'
      );
    });

    it('should reject 9 character summary (just under boundary)', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: '123456789' // Only 9 characters
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('Summary must be at least 10 characters long');
    });

    it('should handle case sensitivity in status values', async () => {
      const args = {
        agent: 'test-agent',
        status: 'done' as any, // lowercase instead of uppercase
        summary: 'Task completed successfully'
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('Status must be either "DONE" or "ERROR"');
    });

    it('should handle mixed case status values', async () => {
      const args = {
        agent: 'test-agent',
        status: 'Done' as any, // Mixed case
        summary: 'Task completed successfully'
      };

      await expect(markComplete(args, mockConfig, mockTaskContextManager))
        .rejects.toThrow('Status must be either "DONE" or "ERROR"');
    });
  });

  describe('reconciliation mode support', () => {
    it('should accept reconciliation_mode parameter', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed with reconciliation mode specified',
        reconciliation_mode: 'auto_complete'
      };

      const result = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result.success).toBe(true);
      // The reconciliation mode is accepted but not processed in this simplified version
    });

    it('should accept reconciliation_explanations parameter', async () => {
      const args: MarkCompleteArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed with explanations provided',
        reconciliation_explanations: {
          'item1': 'This was completed in a different way',
          'item2': 'This was not applicable to current context'
        }
      };

      const result = await markComplete(args, mockConfig, mockTaskContextManager);

      expect(result.success).toBe(true);
      // The explanations are accepted but not processed in this simplified version
    });
  });
});