/**
 * Unit tests for report-progress tool
 * Tests for progress updates without file exposure
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { reportProgress } from '../../../src/tools/report-progress.js';
import * as validation from '../../../src/utils/validation.js';
import { TaskContextManager, ProgressReportResult } from '../../../src/core/TaskContextManager.js';
import { ServerConfig, InvalidTaskError } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';

// Mock modules
jest.mock('../../../src/utils/validation.js');
jest.mock('../../../src/core/TaskContextManager.js');

const mockValidation = validation as jest.Mocked<typeof validation>;
const MockTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;

describe('Report Progress Tool', () => {
  let mockConfig: ServerConfig;
  let mockContextManager: jest.Mocked<TaskContextManager>;
  let mockProgressResult: ProgressReportResult;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = testUtils.createMockConfig();
    
    mockProgressResult = {
      success: true,
      updatedSteps: 3,
      summary: {
        completed: 2,
        inProgress: 1,
        pending: 0,
        blocked: 0
      },
      timeTracking: {
        totalTimeSpent: 120,
        estimatedRemaining: 60
      }
    };

    mockValidation.validateRequiredString.mockImplementation((value) => value as string);
    
    // Setup validateRequiredConfig mock - pass by default
    mockValidation.validateRequiredConfig
      .mockImplementation((config) => {
        if (!config.connectionManager || !config.eventLogger) {
          throw new Error('Configuration missing required components: connectionManager and eventLogger');
        }
      });
    
    mockContextManager = {
      reportProgress: jest.fn<() => Promise<ProgressReportResult>>().mockResolvedValue(mockProgressResult)
    } as unknown as jest.Mocked<TaskContextManager>;
    
    MockTaskContextManager.mockImplementation(() => mockContextManager);
  });

  describe('successful operations', () => {
    it('should report progress with valid updates array', async () => {
      const updates = [
        {
          step: 1,
          status: 'COMPLETE' as const,
          description: 'First step completed',
          timeSpent: 30,
          estimatedTimeRemaining: 90
        },
        {
          step: 2,
          status: 'IN_PROGRESS' as const,
          description: 'Second step in progress',
          timeSpent: 45,
          estimatedTimeRemaining: 60
        },
        {
          step: 3,
          status: 'PENDING' as const,
          description: 'Third step pending',
          estimatedTimeRemaining: 30
        }
      ];

      const args = {
        agent: 'test-agent',
        updates: updates
      };

      const result = await reportProgress(mockConfig, args);

      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('test-agent', 'agent');
      expect(MockTaskContextManager).toHaveBeenCalledWith({
        commDir: mockConfig.commDir,
        connectionManager: mockConfig.connectionManager,
        eventLogger: mockConfig.eventLogger
      });

      expect(mockContextManager.reportProgress).toHaveBeenCalledWith(
        updates,
        expect.objectContaining({
          id: expect.stringMatching(/^report-progress-\d+-[a-z0-9]+$/),
          agent: 'test-agent',
          startTime: expect.any(Date),
          metadata: {
            operation: 'report-progress',
            updatesCount: 3
          }
        })
      );

      expect(result).toBe(mockProgressResult);
    });

    it('should handle updates with all required fields only', async () => {
      const updates = [
        {
          step: 1,
          status: 'COMPLETE',
          description: 'Minimal complete update'
        },
        {
          step: 2,
          status: 'BLOCKED',
          description: 'Blocked step with blocker',
          blocker: 'Waiting for external dependency'
        }
      ];

      const args = {
        agent: 'minimal-agent',
        updates: updates
      };

      const result = await reportProgress(mockConfig, args);

      expect(mockContextManager.reportProgress).toHaveBeenCalledWith(
        [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Minimal complete update'
          },
          {
            step: 2,
            status: 'BLOCKED',
            description: 'Blocked step with blocker',
            blocker: 'Waiting for external dependency'
          }
        ],
        expect.any(Object)
      );

      expect(result).toBe(mockProgressResult);
    });
  });

  describe('input validation failures', () => {
    it('should reject non-array updates', async () => {
      const args = {
        agent: 'test-agent',
        updates: 'not-an-array'
      };

      await expect(reportProgress(mockConfig, args))
        .rejects.toThrow('Progress updates must be an array');
      
      expect(MockTaskContextManager).not.toHaveBeenCalled();
    });

    it('should reject updates with non-object items', async () => {
      const args = {
        agent: 'test-agent',
        updates: ['string-item', 123, true]
      };

      await expect(reportProgress(mockConfig, args))
        .rejects.toThrow('Update at index 0 must be an object');
    });

    it('should reject updates with missing step number', async () => {
      const args = {
        agent: 'test-agent',
        updates: [
          {
            status: 'COMPLETE',
            description: 'Missing step number'
          }
        ]
      };

      await expect(reportProgress(mockConfig, args))
        .rejects.toThrow('Update at index 0: step must be a number');
    });

    it('should reject updates with invalid status', async () => {
      const args = {
        agent: 'test-agent',
        updates: [
          {
            step: 1,
            status: 'INVALID_STATUS',
            description: 'Invalid status value'
          }
        ]
      };

      await expect(reportProgress(mockConfig, args))
        .rejects.toThrow('Update at index 0: status must be one of COMPLETE, IN_PROGRESS, PENDING, BLOCKED');
    });

    it('should reject updates with missing description', async () => {
      const args = {
        agent: 'test-agent',
        updates: [
          {
            step: 1,
            status: 'COMPLETE'
          }
        ]
      };

      await expect(reportProgress(mockConfig, args))
        .rejects.toThrow('Update at index 0: description must be a non-empty string');
    });

    it('should propagate agent validation errors', async () => {
      mockValidation.validateRequiredString.mockImplementation((value, field) => {
        if (field === 'agent') {
          throw new InvalidTaskError('agent must be a non-empty string', 'agent');
        }
        return value as string;
      });

      const args = {
        agent: '',
        updates: [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Valid update'
          }
        ]
      };

      await expect(reportProgress(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
    });
  });

  describe('configuration validation', () => {
    it('should reject missing connectionManager', async () => {
      const invalidConfig = { 
        ...mockConfig, 
        connectionManager: undefined 
      } as unknown as ServerConfig;

      const args = {
        agent: 'test-agent',
        updates: [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Test update'
          }
        ]
      };

      await expect(reportProgress(invalidConfig as ServerConfig, args))
        .rejects.toThrow('Configuration missing required components: connectionManager and eventLogger');
    });

    it('should reject missing eventLogger', async () => {
      const invalidConfig = { 
        ...mockConfig, 
        eventLogger: undefined 
      } as unknown as ServerConfig;

      const args = {
        agent: 'test-agent',
        updates: [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Test update'
          }
        ]
      };

      await expect(reportProgress(invalidConfig as ServerConfig, args))
        .rejects.toThrow('Configuration missing required components: connectionManager and eventLogger');
    });
  });

  describe('TaskContextManager error propagation', () => {
    it('should propagate file system errors from TaskContextManager', async () => {
      const args = {
        agent: 'test-agent',
        updates: [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Test update'
          }
        ]
      };

      const fsError = new Error('ENOENT: no such file or directory');
      mockContextManager.reportProgress.mockRejectedValue(fsError);

      await expect(reportProgress(mockConfig, args))
        .rejects.toThrow('ENOENT: no such file or directory');
    });
  });

  describe('connection object generation', () => {
    it('should generate connection with proper metadata', async () => {
      const args = {
        agent: 'metadata-agent',
        updates: [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'First update'
          },
          {
            step: 2,
            status: 'IN_PROGRESS',
            description: 'Second update'
          }
        ]
      };

      await reportProgress(mockConfig, args);

      const connection = mockContextManager.reportProgress.mock.calls[0][1];

      expect(connection).toEqual({
        id: expect.stringMatching(/^report-progress-\d+-[a-z0-9]+$/),
        agent: 'metadata-agent',
        startTime: expect.any(Date),
        metadata: {
          operation: 'report-progress',
          updatesCount: 2
        }
      });

      expect(connection.startTime).toBeInstanceOf(Date);
      expect(connection.startTime.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should generate unique connection IDs for concurrent operations', async () => {
      const args = {
        agent: 'concurrent-agent',
        updates: [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Concurrent update'
          }
        ]
      };

      const [_result1, _result2] = await Promise.all([
        reportProgress(mockConfig, args),
        reportProgress(mockConfig, args)
      ]);

      const calls = mockContextManager.reportProgress.mock.calls;
      expect(calls).toHaveLength(2);
      
      const connection1 = calls[0][1];
      const connection2 = calls[1][1];
      
      expect(connection1.id).not.toBe(connection2.id);
      expect(connection1.id).toMatch(/^report-progress-\d+-[a-z0-9]+$/);
      expect(connection2.id).toMatch(/^report-progress-\d+-[a-z0-9]+$/);
    });
  });

  describe('edge cases', () => {
    it('should handle empty updates array', async () => {
      const args = {
        agent: 'empty-agent',
        updates: []
      };

      await reportProgress(mockConfig, args);

      expect(mockContextManager.reportProgress).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          metadata: expect.objectContaining({
            updatesCount: 0
          })
        })
      );
    });

    it('should handle negative step numbers', async () => {
      const args = {
        agent: 'negative-agent',
        updates: [
          {
            step: -1,
            status: 'COMPLETE',
            description: 'Negative step number'
          }
        ]
      };

      const result = await reportProgress(mockConfig, args);

      expect(mockContextManager.reportProgress).toHaveBeenCalledWith(
        [
          {
            step: -1,
            status: 'COMPLETE',
            description: 'Negative step number'
          }
        ],
        expect.any(Object)
      );
      expect(result).toBe(mockProgressResult);
    });

    it('should trim whitespace from description and blocker fields', async () => {
      const updates = [
        {
          step: 1,
          status: 'COMPLETE',
          description: '  Step completed with extra spaces  '
        },
        {
          step: 2,
          status: 'BLOCKED',
          description: '  Blocked step  ',
          blocker: '  External dependency issue  '
        }
      ];

      const args = {
        agent: 'trim-agent',
        updates: updates
      };

      await reportProgress(mockConfig, args);

      expect(mockContextManager.reportProgress).toHaveBeenCalledWith(
        [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Step completed with extra spaces'
          },
          {
            step: 2,
            status: 'BLOCKED',
            description: 'Blocked step',
            blocker: 'External dependency issue'
          }
        ],
        expect.any(Object)
      );
    });
  });

  describe('async operation handling', () => {
    it('should handle delayed TaskContextManager operations', async () => {
      const args = {
        agent: 'delayed-agent',
        updates: [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Delayed progress report'
          }
        ]
      };

      let resolveProgress: (value: ProgressReportResult) => void;
      const delayedPromise = new Promise<ProgressReportResult>((resolve) => {
        resolveProgress = resolve;
      });
      
      mockContextManager.reportProgress.mockReturnValue(delayedPromise);

      const resultPromise = reportProgress(mockConfig, args);
      
      // Resolve after delay
      setTimeout(() => resolveProgress(mockProgressResult), 10);
      
      const result = await resultPromise;

      expect(result).toBe(mockProgressResult);
    });
  });
});