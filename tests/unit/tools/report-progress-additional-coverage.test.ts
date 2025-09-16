/**
 * Additional tests for report-progress tool to improve coverage
 * Specifically targeting uncovered error categorization branches
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { ServerConfig } from '../../../src/types.js';
import { reportProgress } from '../../../src/tools/report-progress.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import type { ErrorLogEntry } from '../../../src/logging/ErrorLogger.js';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  remove: jest.fn()
}));

jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));

import * as fs from '../../../src/utils/fs-extra-safe.js';
import * as fileSystem from '../../../src/utils/file-system.js';

describe('report-progress Additional Coverage', () => {
  let mockConfig: ServerConfig;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;
  let loggedErrors: ErrorLogEntry[];

  beforeEach(() => {
    jest.clearAllMocks();
    loggedErrors = [];

    // Create mock ErrorLogger
    mockErrorLogger = {
      logError: jest.fn(async (entry: ErrorLogEntry) => {
        loggedErrors.push(entry);
      }),
      initialize: jest.fn(),
      close: jest.fn(),
      getLogPath: jest.fn(() => './comm/.logs/error.log')
    } as unknown as jest.Mocked<ErrorLogger>;

    // Create mock config
    mockConfig = {
      commDir: './comm',
      errorLogger: mockErrorLogger,
      eventLogger: {
        logOperation: jest.fn(),
        waitForWriteQueueEmpty: jest.fn()
      },
      connectionManager: {
        trackAgentConnection: jest.fn(),
        getActiveAgents: jest.fn(() => []),
        getAgentSessions: jest.fn(() => ({})),
        setCurrentTask: jest.fn(),
        getCurrentTask: jest.fn().mockReturnValue('test-task-123')
      }
    } as unknown as ServerConfig;

    // Setup default mocks
    const mockedFs = fs as jest.Mocked<typeof fs>;
    const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;

    // Mock basic file system operations
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFs.readdir.mockResolvedValue(['test-agent'] as any);
    mockedFs.stat.mockResolvedValue({ isDirectory: () => true, mtime: new Date() } as any);
    mockedFs.readFile.mockResolvedValue('# Plan\n- [ ] Step 1\n- [ ] Step 2');
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.ensureDir.mockResolvedValue(undefined);
    mockedFs.remove.mockResolvedValue(undefined);

    // Mock file-system module similarly
    mockedFileSystem.pathExists.mockResolvedValue(true);
    mockedFileSystem.readFile.mockResolvedValue('# Plan\n- [ ] Step 1\n- [ ] Step 2');
    mockedFileSystem.writeFile.mockResolvedValue(undefined);
  });

  describe('Error Categorization Coverage', () => {
    it('should log permission denied errors but continue', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      // Make PLAN.md read fail with permission error - tool should continue
      mockedFs.readFile.mockRejectedValueOnce(new Error('EACCES: permission denied, open PLAN.md'));

      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            { step: 1, status: 'COMPLETE', description: 'Test step' }
          ]
        }
      );

      // Tool should succeed despite the error
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should categorize disk full errors correctly', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      // Make PLAN.md write fail with disk full error
      mockedFs.writeFile.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

      await expect(
        reportProgress(
          mockConfig,
          {
            agent: 'test-agent',
            updates: [
              { step: 1, status: 'COMPLETE', description: 'Test step' }
            ]
          }
        )
      ).rejects.toThrow();

      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          context: expect.objectContaining({
            parameters: expect.objectContaining({
              operation: 'file_write',
              diskSpace: true
            })
          })
        })
      );
    });

    it('should log unusual step numbers but continue', async () => {
      // Negative step numbers are now logged but not blocked
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.readFile.mockResolvedValueOnce('# Plan\n- [ ] Step 1\n- [ ] Step 2');

      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            { step: -5, status: 'COMPLETE', description: 'Invalid negative step' }
          ]
        }
      );

      // Tool should succeed
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);

      // Error logger should log the unusual condition
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          error: expect.objectContaining({
            name: 'ValidationWarning'
          }),
          context: expect.objectContaining({
            parameters: expect.objectContaining({
              unusualStep: -5
            })
          })
        })
      );
    });

    it('should handle malformed checkbox content gracefully', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      // Return malformed checkbox content - tool should continue
      mockedFs.readFile.mockResolvedValueOnce('# Plan\n- [malformed checkbox\n- [ ] Step 2');

      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            { step: 1, status: 'COMPLETE', description: 'Test step' }
          ]
        }
      );

      // Tool should succeed
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should handle context status validation errors', async () => {
      await expect(
        reportProgress(
          mockConfig,
          {
            agent: 'test-agent',
            updates: [
              { step: 1, status: 'COMPLETE', description: 'Test step' }
            ],
            contextStatus: {
              currentUsage: -100, // Invalid negative usage
              estimatedRemaining: 500,
              trend: 'INVALID_TREND' as any // Invalid trend value
            }
          }
        )
      ).rejects.toThrow();

      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          context: expect.objectContaining({
            parameters: expect.objectContaining({
              operation: 'context_validation'
            })
          })
        })
      );
    });

    it('should handle generic read errors gracefully', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      // Generic error on PLAN.md read - tool should continue
      mockedFs.readFile.mockRejectedValueOnce(new Error('Unknown generic error occurred'));

      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            { step: 1, status: 'COMPLETE', description: 'Test step' }
          ]
        }
      );

      // Tool should succeed
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should handle updates with blocked status', async () => {
      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            {
              step: 1,
              status: 'BLOCKED',
              description: 'Blocked step',
              blocker: 'Waiting for external API'
            }
          ]
        }
      );

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('updatedSteps');
      expect(result.updatedSteps).toBe(1);
    });

    it('should handle capability changes in updates', async () => {
      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            { step: 1, status: 'COMPLETE', description: 'Test step' }
          ],
          capabilityChanges: {
            discoveredLimitations: ['Cannot process large files'],
            adaptations: ['Using streaming approach'],
            toolEffectiveness: { 'file-processor': 0.8 }
          }
        }
      );

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(mockConfig.eventLogger?.logOperation).toHaveBeenCalled();
    });

    it('should handle updates with time tracking', async () => {
      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            {
              step: 1,
              status: 'IN_PROGRESS',
              description: 'Working on step',
              timeSpent: 30,
              estimatedTimeRemaining: 60
            }
          ]
        }
      );

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('updatedSteps');
    });

    it('should allow empty updates array for backward compatibility', async () => {
      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: []
        }
      );

      // Tool should succeed with empty updates
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result.updatedSteps).toBe(0);
    });
  });

  describe('Edge Cases and Fallbacks', () => {
    it('should handle PLAN.md not found gracefully', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      // Make PLAN.md not exist
      mockedFs.pathExists.mockImplementation(async (path: string) => {
        if (path.includes('PLAN.md')) return false;
        return true;
      });

      // Tool should continue without PLAN.md
      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            { step: 1, status: 'COMPLETE', description: 'Test step' }
          ]
        }
      );

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('summary');
      expect(result.summary).toMatchObject({
        completed: expect.any(Number),
        inProgress: expect.any(Number)
      });
    });

    it('should handle malformed PLAN.md content gracefully', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;

      // Return non-checkbox content
      mockedFs.readFile.mockResolvedValueOnce('Just plain text without any checkboxes');

      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            { step: 1, status: 'COMPLETE', description: 'Test step' }
          ]
        }
      );

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('summary');
      expect(result.summary).toMatchObject({
        completed: expect.any(Number),
        inProgress: expect.any(Number)
      });
    });

    it('should log very large step numbers but continue', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.readFile.mockResolvedValueOnce('# Plan\n- [ ] Step 1\n- [ ] Step 2');

      const result = await reportProgress(
        mockConfig,
        {
          agent: 'test-agent',
          updates: [
            { step: 101, status: 'COMPLETE', description: 'Step exceeding typical max' }
          ]
        }
      );

      // Tool should succeed
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);

      // Error logger should log the unusual condition
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          error: expect.objectContaining({
            name: 'ValidationWarning'
          }),
          context: expect.objectContaining({
            parameters: expect.objectContaining({
              unusualStep: 101,
              typicalMax: 100
            })
          })
        })
      );
    });
  });
});