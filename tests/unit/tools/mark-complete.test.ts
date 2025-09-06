/**
 * Unit tests for mark-complete tool
 * Tests for task completion without file path exposure
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { markComplete } from '../../../src/tools/mark-complete.js';
import * as validation from '../../../src/utils/validation.js';
import { TaskContextManager, CompletionResult } from '../../../src/core/TaskContextManager.js';
import { ServerConfig, InvalidTaskError } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';
import * as agentVerifier from '../../../src/core/agent-work-verifier.js';

// Mock modules
jest.mock('../../../src/utils/validation.js');
jest.mock('../../../src/core/TaskContextManager.js');
jest.mock('../../../src/core/agent-work-verifier.js');

const mockValidation = validation as jest.Mocked<typeof validation>;
const MockTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;
const mockAgentVerifier = agentVerifier as jest.Mocked<typeof agentVerifier>;

describe('Mark Complete Tool', () => {
  let mockConfig: ServerConfig;
  let mockContextManager: jest.Mocked<TaskContextManager>;
  let mockCompletionResult: CompletionResult;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = testUtils.createMockConfig();
    
    // Create mock CompletionResult
    mockCompletionResult = {
      success: true,
      status: 'DONE',
      summary: 'Task completed successfully',
      completedAt: new Date('2025-01-01T12:00:00Z'),
      isError: false,
      recommendations: ['Great job!', 'Consider optimization next time']
    };

    // Setup default validation mocks
    mockValidation.validateRequiredString
      .mockImplementation((value) => value as string);
    
    // Setup agent work verifier mock - return high confidence for tests
    mockAgentVerifier.verifyAgentWork.mockResolvedValue({
      success: true,
      confidence: 100,
      evidence: {
        filesModified: 5,
        testsRun: true,
        mcpProgress: true,
        timeSpent: 30
      },
      warnings: [],
      recommendation: 'Work verified successfully'
    });
    
    // Setup TaskContextManager mock
    mockContextManager = {
      markComplete: jest.fn<() => Promise<CompletionResult>>().mockResolvedValue(mockCompletionResult)
    } as any;
    
    MockTaskContextManager.mockImplementation(() => mockContextManager);
  });

  describe('successful operations', () => {
    it('should mark task as DONE with valid inputs', async () => {
      const args = {
        status: 'DONE',
        summary: 'Task completed successfully with all requirements met',
        agent: 'test-agent'
      };

      const result = await markComplete(mockConfig, args);

      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('DONE', 'status');
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('Task completed successfully with all requirements met', 'summary');
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('test-agent', 'agent');
      
      expect(MockTaskContextManager).toHaveBeenCalledWith({
        commDir: mockConfig.commDir,
        connectionManager: mockConfig.connectionManager,
        eventLogger: mockConfig.eventLogger
      });

      expect(mockContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        'Task completed successfully with all requirements met',
        expect.objectContaining({
          id: expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/),
          agent: 'test-agent',
          startTime: expect.any(Date),
          metadata: {
            operation: 'mark-complete',
            status: 'DONE',
            summarySize: 'Task completed successfully with all requirements met'.length
          }
        })
      );

      expect(result).toBe(mockCompletionResult);
    });

    it('should mark task as ERROR with valid inputs', async () => {
      const args = {
        status: 'ERROR',
        summary: 'Task failed due to missing dependencies and configuration errors',
        agent: 'error-agent'
      };

      const errorResult: CompletionResult = {
        success: false,
        status: 'ERROR',
        summary: 'Task failed due to missing dependencies and configuration errors',
        completedAt: new Date(),
        isError: true,
        recommendations: ['Check dependencies', 'Verify configuration']
      };

      mockContextManager.markComplete.mockResolvedValue(errorResult);

      const result = await markComplete(mockConfig, args);

      expect(mockContextManager.markComplete).toHaveBeenCalledWith(
        'ERROR',
        'Task failed due to missing dependencies and configuration errors',
        expect.objectContaining({
          agent: 'error-agent',
          metadata: expect.objectContaining({
            status: 'ERROR'
          })
        })
      );

      expect(result).toBe(errorResult);
    });

    it('should handle long summaries', async () => {
      const longSummary = 'This is a very detailed summary that explains exactly what was completed in the task. '.repeat(10);
      
      const args = {
        status: 'DONE',
        summary: longSummary,
        agent: 'detailed-agent'
      };

      await markComplete(mockConfig, args);

      expect(mockContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        longSummary.trim(), // The function trims the summary
        expect.objectContaining({
          metadata: expect.objectContaining({
            summarySize: longSummary.length // But metadata uses original length
          })
        })
      );
    });

    it('should handle agent names with special characters', async () => {
      const args = {
        status: 'DONE',
        summary: 'Task completed successfully',
        agent: 'agent-with-special_chars-123'
      };

      await markComplete(mockConfig, args);

      expect(mockContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        'Task completed successfully',
        expect.objectContaining({
          agent: 'agent-with-special_chars-123'
        })
      );
    });

    it('should trim whitespace from summary', async () => {
      const args = {
        status: 'DONE',
        summary: '  Task completed with extra whitespace  ',
        agent: 'trim-agent'
      };

      mockValidation.validateRequiredString
        .mockReturnValueOnce('DONE')
        .mockReturnValueOnce('  Task completed with extra whitespace  ')
        .mockReturnValueOnce('trim-agent');

      await markComplete(mockConfig, args);

      expect(mockContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        'Task completed with extra whitespace', // Should be trimmed
        expect.any(Object)
      );
    });

    it('should generate unique connection IDs for concurrent operations', async () => {
      const args = {
        status: 'DONE',
        summary: 'Concurrent task completion',
        agent: 'concurrent-agent'
      };

      await Promise.all([
        markComplete(mockConfig, args),
        markComplete(mockConfig, args)
      ]);

      const calls = mockContextManager.markComplete.mock.calls;
      expect(calls).toHaveLength(2);
      
      const connection1 = calls[0][2];
      const connection2 = calls[1][2];
      
      expect(connection1.id).not.toBe(connection2.id);
      expect(connection1.id).toMatch(/^mark-complete-\d+-[a-z0-9]+$/);
      expect(connection2.id).toMatch(/^mark-complete-\d+-[a-z0-9]+$/);
    });
  });

  describe('input validation failures', () => {
    it('should reject invalid status values', async () => {
      const args = {
        status: 'INVALID',
        summary: 'Task completed successfully',
        agent: 'test-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Status must be either DONE or ERROR');
      
      expect(MockTaskContextManager).not.toHaveBeenCalled();
    });

    it('should reject empty status', async () => {
      const args = {
        status: '',
        summary: 'Task completed successfully',
        agent: 'test-agent'
      };

      mockValidation.validateRequiredString.mockImplementation((value, field) => {
        if (field === 'status' && value === '') {
          throw new InvalidTaskError('status must be a non-empty string', 'status');
        }
        return value as string;
      });

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('status must be a non-empty string');
      
      expect(MockTaskContextManager).not.toHaveBeenCalled();
    });

    it('should reject short summaries', async () => {
      const args = {
        status: 'DONE',
        summary: 'Short',
        agent: 'test-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Summary must be at least 10 characters long');
      
      expect(MockTaskContextManager).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only summaries', async () => {
      const args = {
        status: 'DONE',
        summary: '   \n\t   ',
        agent: 'test-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Summary must be at least 10 characters long');
    });

    it('should propagate validation errors for missing agent', async () => {
      const args = {
        status: 'DONE',
        summary: 'Task completed successfully'
        // Missing agent
      };

      mockValidation.validateRequiredString.mockImplementation((value, field) => {
        if (field === 'agent' && value === undefined) {
          throw new InvalidTaskError('agent must be a non-empty string', 'agent');
        }
        return value as string;
      });

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
      
      expect(MockTaskContextManager).not.toHaveBeenCalled();
    });

    it('should handle null values for required fields', async () => {
      const args = {
        status: null,
        summary: null,
        agent: null
      };

      mockValidation.validateRequiredString.mockImplementation((value, field) => {
        if (value === null) {
          throw new InvalidTaskError(`${field} must be a non-empty string`, field);
        }
        return value as string;
      });

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('status must be a non-empty string');
    });

    it('should handle non-string types for required fields', async () => {
      const args = {
        status: 123,
        summary: { invalid: 'object' },
        agent: true
      };

      mockValidation.validateRequiredString.mockImplementation((value, field) => {
        if (typeof value !== 'string') {
          throw new InvalidTaskError(`${field} must be a non-empty string`, field);
        }
        return value as string;
      });

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('status must be a non-empty string');
    });
  });

  describe('configuration validation', () => {
    it('should reject missing connectionManager', async () => {
      const invalidConfig = { 
        ...mockConfig, 
        connectionManager: undefined 
      } as any;

      const args = {
        status: 'DONE',
        summary: 'Task completed successfully',
        agent: 'test-agent'
      };

      await expect(markComplete(invalidConfig, args))
        .rejects.toThrow('Configuration missing required components: connectionManager and eventLogger');
    });

    it('should reject missing eventLogger', async () => {
      const invalidConfig = { 
        ...mockConfig, 
        eventLogger: undefined 
      } as any;

      const args = {
        status: 'DONE',
        summary: 'Task completed successfully',
        agent: 'test-agent'
      };

      await expect(markComplete(invalidConfig, args))
        .rejects.toThrow('Configuration missing required components: connectionManager and eventLogger');
    });

    it('should reject missing both connectionManager and eventLogger', async () => {
      const invalidConfig = { 
        ...mockConfig, 
        connectionManager: undefined,
        eventLogger: undefined
      } as any;

      const args = {
        status: 'DONE',
        summary: 'Task completed successfully',
        agent: 'test-agent'
      };

      await expect(markComplete(invalidConfig, args))
        .rejects.toThrow('Configuration missing required components: connectionManager and eventLogger');
    });

    it('should accept valid configuration', async () => {
      const args = {
        status: 'DONE',
        summary: 'Task completed successfully',
        agent: 'test-agent'
      };

      const result = await markComplete(mockConfig, args);

      expect(result).toBe(mockCompletionResult);
      expect(MockTaskContextManager).toHaveBeenCalledWith({
        commDir: mockConfig.commDir,
        connectionManager: mockConfig.connectionManager,
        eventLogger: mockConfig.eventLogger
      });
    });
  });

  describe('TaskContextManager error propagation', () => {
    it('should propagate file system errors from TaskContextManager', async () => {
      const args = {
        status: 'DONE',
        summary: 'Task completed successfully',
        agent: 'test-agent'
      };

      const fsError = new Error('ENOENT: no such file or directory');
      mockContextManager.markComplete.mockRejectedValue(fsError);

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('ENOENT: no such file or directory');
    });

    it('should propagate permission errors from TaskContextManager', async () => {
      const args = {
        status: 'ERROR',
        summary: 'Task failed due to permissions',
        agent: 'perm-agent'
      };

      const permError = new Error('EACCES: permission denied');
      mockContextManager.markComplete.mockRejectedValue(permError);

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('EACCES: permission denied');
    });

    it('should propagate custom TaskContextManager errors', async () => {
      const args = {
        status: 'DONE',
        summary: 'Task completed with issues',
        agent: 'custom-error-agent'
      };

      const customError = new InvalidTaskError('Custom completion error', 'task');
      mockContextManager.markComplete.mockRejectedValue(customError);

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Custom completion error');
    });
  });

  describe('connection object generation', () => {
    it('should generate connection with proper metadata', async () => {
      const args = {
        status: 'ERROR',
        summary: 'Failed with detailed error information',
        agent: 'metadata-agent'
      };

      await markComplete(mockConfig, args);

      const connection = mockContextManager.markComplete.mock.calls[0][2];

      expect(connection).toEqual({
        id: expect.stringMatching(/^mark-complete-\d+-[a-z0-9]+$/),
        agent: 'metadata-agent',
        startTime: expect.any(Date),
        metadata: {
          operation: 'mark-complete',
          status: 'ERROR',
          summarySize: 'Failed with detailed error information'.length
        }
      });

      expect(connection.startTime).toBeInstanceOf(Date);
      expect(connection.startTime.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should generate different timestamps for different operations', async () => {
      const args = {
        status: 'DONE',
        summary: 'First completion operation',
        agent: 'time-agent'
      };

      const time1 = Date.now();
      await markComplete(mockConfig, args);
      const connection1Time = mockContextManager.markComplete.mock.calls[0][2].startTime;

      // Add small delay
      await new Promise(resolve => setTimeout(resolve, 2));

      await markComplete(mockConfig, args);
      const connection2Time = mockContextManager.markComplete.mock.calls[1][2].startTime;

      expect(connection1Time.getTime()).toBeGreaterThanOrEqual(time1);
      expect(connection2Time.getTime()).toBeGreaterThanOrEqual(connection1Time.getTime());
    });
  });

  describe('edge cases', () => {
    it('should handle empty args object', async () => {
      mockValidation.validateRequiredString.mockImplementation((_value, field) => {
        throw new InvalidTaskError(`${field} must be a non-empty string`, field);
      });

      await expect(markComplete(mockConfig, {}))
        .rejects.toThrow('status must be a non-empty string');
    });

    it('should handle case sensitivity in status values', async () => {
      const args = {
        status: 'done', // lowercase
        summary: 'Task completed successfully',
        agent: 'case-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Status must be either DONE or ERROR');
    });

    it('should handle mixed case status values', async () => {
      const args = {
        status: 'Done',
        summary: 'Task completed successfully',
        agent: 'mixed-case-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Status must be either DONE or ERROR');
    });

    it('should handle exactly 10 character summary (boundary case)', async () => {
      const args = {
        status: 'DONE',
        summary: '1234567890', // Exactly 10 characters
        agent: 'boundary-agent'
      };

      const result = await markComplete(mockConfig, args);

      expect(mockContextManager.markComplete).toHaveBeenCalledWith(
        'DONE',
        '1234567890',
        expect.any(Object)
      );
      expect(result).toBe(mockCompletionResult);
    });

    it('should reject 9 character summary (just under boundary)', async () => {
      const args = {
        status: 'DONE',
        summary: '123456789', // 9 characters
        agent: 'under-boundary-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Summary must be at least 10 characters long');
    });
  });

  describe('async operation handling', () => {
    it('should handle delayed TaskContextManager operations', async () => {
      const args = {
        status: 'DONE',
        summary: 'Delayed completion task',
        agent: 'delayed-agent'
      };

      let resolveCompletion: (value: CompletionResult) => void;
      const delayedPromise = new Promise<CompletionResult>((resolve) => {
        resolveCompletion = resolve;
      });
      
      mockContextManager.markComplete.mockReturnValue(delayedPromise);

      const resultPromise = markComplete(mockConfig, args);
      
      // Resolve after delay
      setTimeout(() => resolveCompletion(mockCompletionResult), 10);
      
      const result = await resultPromise;

      expect(result).toBe(mockCompletionResult);
    });

    it('should handle concurrent completion operations', async () => {
      const args1 = {
        status: 'DONE',
        summary: 'First concurrent completion',
        agent: 'concurrent-1'
      };

      const args2 = {
        status: 'ERROR',
        summary: 'Second concurrent completion',
        agent: 'concurrent-2'
      };

      const result1Promise = markComplete(mockConfig, args1);
      const result2Promise = markComplete(mockConfig, args2);

      const [result1, result2] = await Promise.all([result1Promise, result2Promise]);

      expect(result1).toBe(mockCompletionResult);
      expect(result2).toBe(mockCompletionResult);
      expect(MockTaskContextManager).toHaveBeenCalledTimes(2);
      expect(mockContextManager.markComplete).toHaveBeenCalledTimes(2);
    });
  });
});