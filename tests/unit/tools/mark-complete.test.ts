/**
 * Unit tests for mark-complete tool
 * Focuses on basic completion functionality without verification gates
 */

import { markComplete } from '../../../src/tools/mark-complete.js';
import { ServerConfig } from '../../../src/types.js';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';

// Mock TaskContextManager constructor
jest.mock('../../../src/core/TaskContextManager.js', () => ({
  TaskContextManager: jest.fn()
}));

const MockedTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;

// Mock TaskContextManager instance
const mockTaskContextManager = {
  markComplete: jest.fn()
} as unknown as TaskContextManager;

// Mock ConnectionManager and EventLogger
const mockConnectionManager = {
  register: jest.fn(),
  getConnection: jest.fn(),
  updateActivity: jest.fn()
} as any;

const mockEventLogger = {
  log: jest.fn(),
  logOperation: jest.fn()
} as any;

// Mock config
const mockConfig: ServerConfig = {
  commDir: '/test/comm',
  archiveDir: '/test/archive',
  logDir: '/test/logs',
  connectionManager: mockConnectionManager,
  eventLogger: mockEventLogger,
  enableArchiving: true
};

describe('Mark Complete Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the TaskContextManager constructor to return our mock instance
    MockedTaskContextManager.mockImplementation(() => mockTaskContextManager);
    
    (mockTaskContextManager.markComplete as jest.Mock).mockResolvedValue({
      success: true,
      status: 'DONE',
      summary: 'Task completed',
      completedAt: new Date(),
      isError: false
    });
  });

  describe('successful operations', () => {
    it('should mark task as DONE with valid inputs', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully with all requirements met'
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.message).toContain('DONE');
      expect(result.taskId).toMatch(/^mark-complete-\d+-[a-z0-9]+$/);
      expect(mockTaskContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        'Task completed successfully with all requirements met',
        expect.objectContaining({
          agent: 'test-agent',
          id: expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/)
        })
      );
    });

    it('should mark task as ERROR with valid inputs', async () => {
      const args = {
        agent: 'test-agent',
        status: 'ERROR',
        summary: 'Task failed due to unexpected system error encountered'
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.message).toContain('ERROR');
      expect(mockTaskContextManager.markComplete).toHaveBeenCalledWith(
        'ERROR',
        'Task failed due to unexpected system error encountered',
        expect.objectContaining({
          agent: 'test-agent',
          id: expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/)
        })
      );
    });

    it('should handle long summaries', async () => {
      const longSummary = 'This is a very long summary that describes in detail all the work that was completed, including multiple steps, challenges faced, and solutions implemented successfully';
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: longSummary
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        longSummary,
        expect.objectContaining({
          agent: 'test-agent',
          id: expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/)
        })
      );
    });

    it('should handle agent names with special characters', async () => {
      const args = {
        agent: 'test-agent-123_special',
        status: 'DONE',
        summary: 'Completed task with special agent name successfully'
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        'Completed task with special agent name successfully',
        expect.objectContaining({
          agent: 'test-agent-123_special',
          id: expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/)
        })
      );
    });

    it('should trim whitespace from summary', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: '  Task completed successfully with whitespace  '
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        'Task completed successfully with whitespace',
        expect.objectContaining({
          agent: 'test-agent',
          id: expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/)
        })
      );
    });

    it('should generate unique connection IDs for concurrent operations', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      const result1 = await markComplete(mockConfig, args);
      const result2 = await markComplete(mockConfig, args);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      const calls = (mockTaskContextManager.markComplete as jest.Mock).mock.calls;
      expect(calls[0][2].id).not.toBe(calls[1][2].id); // Different connection IDs
    });
  });

  describe('input validation failures', () => {
    it('should reject invalid status values', async () => {
      const args = {
        agent: 'test-agent',
        status: 'INVALID' as any,
        summary: 'Task completed successfully'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Status must be either "DONE" or "ERROR"');
    });

    it('should reject empty status', async () => {
      const args = {
        agent: 'test-agent',
        status: '' as any,
        summary: 'Task completed successfully'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('status must be a non-empty string');
    });

    it('should reject short summaries', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'short'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Summary must be at least 10 characters long');
    });

    it('should reject whitespace-only summaries', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: '   '
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('summary must be a non-empty string');
    });

    it('should reject missing agent', async () => {
      const args = {
        status: 'DONE' as const,
        summary: 'Task completed successfully'
      } as any;

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
    });

    it('should handle null values for required fields', async () => {
      const args = {
        agent: null,
        status: 'DONE' as const,
        summary: 'Task completed successfully'
      } as any;

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
    });

    it('should handle non-string types for required fields', async () => {
      const args = {
        agent: 123,
        status: 'DONE' as const,
        summary: 'Task completed successfully'
      } as any;

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
    });
  });

  describe('configuration handling', () => {
    it('should use provided configuration', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markComplete).toHaveBeenCalled();
    });

    it('should create TaskContextManager with provided config', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      const result = await markComplete(mockConfig, args);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('TaskContextManager error propagation', () => {
    it('should propagate file system errors from TaskContextManager', async () => {
      (mockTaskContextManager.markComplete as jest.Mock)
        .mockRejectedValue(new Error('File system error: Permission denied'));

      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Failed to mark task complete: File system error: Permission denied');
    });

    it('should propagate permission errors from TaskContextManager', async () => {
      (mockTaskContextManager.markComplete as jest.Mock)
        .mockRejectedValue(new Error('Permission denied'));

      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Failed to mark task complete: Permission denied');
    });

    it('should propagate custom TaskContextManager errors', async () => {
      (mockTaskContextManager.markComplete as jest.Mock)
        .mockRejectedValue(new Error('Custom error from TaskContextManager'));

      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Failed to mark task complete: Custom error from TaskContextManager');
    });
  });

  describe('edge cases', () => {
    it('should handle exactly 10 character summary (boundary case)', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: '1234567890' // Exactly 10 characters
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        '1234567890',
        expect.objectContaining({
          agent: 'test-agent',
          id: expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/)
        })
      );
    });

    it('should reject 9 character summary (just under boundary)', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: '123456789' // Only 9 characters
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Summary must be at least 10 characters long');
    });

    it('should handle case sensitivity in status values', async () => {
      const args = {
        agent: 'test-agent',
        status: 'done' as any, // lowercase instead of uppercase
        summary: 'Task completed successfully'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Status must be either "DONE" or "ERROR"');
    });

    it('should handle mixed case status values', async () => {
      const args = {
        agent: 'test-agent',
        status: 'Done' as any, // Mixed case
        summary: 'Task completed successfully'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Status must be either "DONE" or "ERROR"');
    });
  });

  describe('reconciliation mode support', () => {
    it('should complete task without reconciliation parameters', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      // Simplified version doesn't use reconciliation parameters
    });

    it('should handle complex task completion', async () => {
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Complex task completed with multiple steps and thorough validation'
      };

      const result = await markComplete(mockConfig, args);

      expect(result.success).toBe(true);
      expect(mockTaskContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        'Complex task completed with multiple steps and thorough validation',
        expect.objectContaining({
          agent: 'test-agent'
        })
      );
    });
  });
});