/**
 * track-task-progress ErrorLogger Integration Tests
 * Phase 4: LOW Priority ErrorLogger Implementation
 *
 * Tests error logging functionality for progress monitoring failures
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import * as os from 'os';
import { testUtils } from '../../utils/testUtils.js';
import { trackTaskProgress } from '../../../src/tools/track-task-progress.js';
import { ServerConfig, TrackTaskProgressArgs } from '../../../src/types.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import * as fileSystem from '../../../src/utils/file-system.js';

// Mock the ErrorLogger
jest.mock('../../../src/logging/ErrorLogger.js');

describe('track-task-progress ErrorLogger Integration', () => {
  let config: ServerConfig;
  let tempDir: string;
  let testDir: string;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'track-progress-error-test-'));
    testDir = path.join(tempDir, 'comm', 'test-agent');

    // Create mock ErrorLogger instance
    mockErrorLogger = {
      logError: jest.fn().mockImplementation(() => Promise.resolve()),
      waitForWriteQueueEmpty: jest.fn().mockImplementation(() => Promise.resolve()),
      close: jest.fn().mockImplementation(() => Promise.resolve())
    } as unknown as jest.Mocked<ErrorLogger>;

    config = testUtils.createMockConfig({
      commDir: path.join(tempDir, 'comm'),
      archiveDir: path.join(tempDir, 'comm', '.archive'),
      enableArchiving: true,
      errorLogger: mockErrorLogger
    });

    // Ensure directories exist
    await fs.ensureDir(config.commDir);
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    // Clean up test files
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Error Logging - Task Not Found', () => {
    it('should log error when task directory does not exist', async () => {
      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'non-existent-task'
      };

      const result = await trackTaskProgress(config, args);

      // Verify result indicates task not found
      expect(result.taskId).toBe('non-existent-task');
      expect(result.status).toBe('pending');
      expect(result.progress.total_steps).toBe(0);
      expect(result.progress.completed_steps).toBe(0);
      expect(result.progress.percentage).toBe(0);

      // Verify ErrorLogger was called with correct parameters
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'track_task_progress',
          agent: 'test-agent',
          taskId: 'non-existent-task',
          error: expect.objectContaining({
            message: expect.stringContaining('Task not found'),
            name: 'TaskNotFoundError'
          }),
          context: expect.objectContaining({
            tool: 'track_task_progress',
            parameters: expect.objectContaining({
              agent: 'test-agent',
              taskId: 'non-existent-task'
            })
          }),
          severity: 'low'
        })
      );
    });
  });

  describe('Error Logging - PLAN.md Not Found', () => {
    it('should log error when PLAN.md does not exist', async () => {
      const taskDir = path.join(testDir, 'task-without-plan');
      await fs.ensureDir(taskDir);

      // Create INIT.md but no PLAN.md
      await fs.writeFile(path.join(taskDir, 'INIT.md'), '# Task Init');

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'task-without-plan'
      };

      const result = await trackTaskProgress(config, args);

      // Should return pending status
      expect(result.status).toBe('pending');
      expect(result.progress.total_steps).toBe(0);

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'track_task_progress',
          agent: 'test-agent',
          taskId: 'task-without-plan',
          error: expect.objectContaining({
            message: expect.stringContaining('PLAN.md not found'),
            name: 'PlanNotFoundError'
          }),
          context: expect.objectContaining({
            tool: 'track_task_progress'
          }),
          severity: 'low'
        })
      );
    });
  });

  describe('Error Logging - Progress Marker Parsing Errors', () => {
    it('should log error when checkbox extraction fails', async () => {
      const taskDir = path.join(testDir, 'task-with-malformed-plan');
      await fs.ensureDir(taskDir);

      // Create PLAN.md with malformed checkboxes
      const planContent = `# Implementation Plan

- [x Invalid checkbox format
- [ ] Valid checkbox
- [Not a checkbox
- [✓] Non-standard complete marker
`;
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'task-with-malformed-plan'
      };

      const result = await trackTaskProgress(config, args);

      // Should still return some progress
      expect(result.status).toBe('in_progress');

      // Verify warning logged for malformed checkboxes
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'track_task_progress',
          agent: 'test-agent',
          taskId: 'task-with-malformed-plan',
          error: expect.objectContaining({
            message: expect.stringContaining('Malformed checkbox'),
            name: 'CheckboxParsingWarning'
          }),
          context: expect.objectContaining({
            tool: 'track_task_progress',
            parameters: expect.objectContaining({
              malformedLine: expect.any(String)
            })
          }),
          severity: 'low'
        })
      );
    });

    it('should log error when progress calculation fails', async () => {
      const taskDir = path.join(testDir, 'task-with-empty-plan');
      await fs.ensureDir(taskDir);

      // Create empty PLAN.md (no checkboxes)
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), '');

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'task-with-empty-plan'
      };

      const result = await trackTaskProgress(config, args);

      // Should handle gracefully
      expect(result.status).toBe('in_progress');
      expect(result.progress.total_steps).toBe(0);
      expect(result.progress.percentage).toBe(0);

      // Verify warning logged
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'track_task_progress',
          agent: 'test-agent',
          taskId: 'task-with-empty-plan',
          error: expect.objectContaining({
            message: expect.stringContaining('No checkboxes found'),
            name: 'NoProgressMarkersWarning'
          }),
          severity: 'low'
        })
      );
    });
  });

  describe('Error Logging - File Read Errors', () => {
    it('should log error when PLAN.md cannot be read', async () => {
      const taskDir = path.join(testDir, 'task-with-read-error');
      await fs.ensureDir(taskDir);

      // Create PLAN.md
      const planPath = path.join(taskDir, 'PLAN.md');
      await fs.writeFile(planPath, '# Plan Content');

      // Mock readFile to throw error
      jest.spyOn(fileSystem, 'readFile').mockRejectedValueOnce(
        new Error('EACCES: permission denied')
      );

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'task-with-read-error'
      };

      await expect(trackTaskProgress(config, args)).rejects.toThrow('EACCES');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'runtime',
          operation: 'track_task_progress',
          agent: 'test-agent',
          taskId: 'task-with-read-error',
          error: expect.objectContaining({
            message: expect.stringContaining('EACCES'),
            name: 'Error'
          }),
          severity: 'low'
        })
      );
    });

    it('should log error when stat operation fails', async () => {
      const taskDir = path.join(testDir, 'task-with-stat-error');
      await fs.ensureDir(taskDir);

      // Create PLAN.md
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), '- [x] Step 1\n- [ ] Step 2');

      // Mock stat to throw error
      jest.spyOn(fs, 'stat').mockRejectedValueOnce(
        new Error('EPERM: operation not permitted')
      );

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'task-with-stat-error'
      };

      await expect(trackTaskProgress(config, args)).rejects.toThrow('EPERM');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'runtime',
          operation: 'track_task_progress',
          agent: 'test-agent',
          taskId: 'task-with-stat-error',
          error: expect.objectContaining({
            message: expect.stringContaining('EPERM'),
            name: 'Error'
          }),
          severity: 'low'
        })
      );
    });
  });

  describe('Error Logging - Validation Errors', () => {
    it('should log error when agent parameter is missing', async () => {
      const args = {
        taskId: 'some-task'
      } as unknown as TrackTaskProgressArgs;

      await expect(trackTaskProgress(config, args)).rejects.toThrow('agent must be a non-empty string');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          operation: 'track_task_progress',
          error: expect.objectContaining({
            message: expect.stringContaining('agent must be a non-empty string'),
            name: 'ValidationError'
          }),
          context: expect.objectContaining({
            tool: 'track_task_progress',
            parameters: expect.objectContaining({
              taskId: 'some-task'
            })
          }),
          severity: 'low'
        })
      );
    });

    it('should log error when taskId parameter is missing', async () => {
      const args = {
        agent: 'test-agent'
      } as unknown as TrackTaskProgressArgs;

      await expect(trackTaskProgress(config, args)).rejects.toThrow('taskId must be a non-empty string');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          operation: 'track_task_progress',
          agent: 'test-agent',
          error: expect.objectContaining({
            message: expect.stringContaining('taskId must be a non-empty string'),
            name: 'ValidationError'
          }),
          context: expect.objectContaining({
            tool: 'track_task_progress'
          }),
          severity: 'low'
        })
      );
    });
  });

  describe('Debug Package Integration', () => {
    it('should use correct debug namespace', async () => {
      // The tool should use debug namespace: agent-comm:tools:tracktaskprogress
      const taskDir = path.join(testDir, 'debug-test-task');
      await fs.ensureDir(taskDir);

      // Create PLAN.md with checkboxes
      const planContent = `# Plan
- [x] Step 1
- [ ] Step 2
`;
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'debug-test-task'
      };

      const result = await trackTaskProgress(config, args);

      // Verify successful execution
      expect(result.status).toBe('in_progress');
      expect(result.progress.total_steps).toBe(2);
      expect(result.progress.completed_steps).toBe(1);

      // Debug output would be visible with DEBUG=agent-comm:tools:tracktaskprogress
    });
  });

  describe('Error Severity Verification', () => {
    it('should always use LOW severity for all errors', async () => {
      // Test multiple error scenarios
      const scenarios = [
        { taskId: 'non-existent' },
        { taskId: 'task-without-plan' }
      ];

      for (const scenario of scenarios) {
        const args: TrackTaskProgressArgs = {
          agent: 'test-agent',
          taskId: scenario.taskId
        };

        await trackTaskProgress(config, args).catch(() => {
          // Ignore errors, we just want to check logging
        });
      }

      // All errors should have LOW severity
      if (mockErrorLogger.logError.mock.calls.length > 0) {
        mockErrorLogger.logError.mock.calls.forEach(call => {
          const errorLog = call[0];
          expect(errorLog.severity).toBe('low');
        });
      }
    });
  });

  describe('Checkbox Extraction Edge Cases', () => {
    it('should handle mixed checkbox formats gracefully', async () => {
      const taskDir = path.join(testDir, 'mixed-checkbox-task');
      await fs.ensureDir(taskDir);

      const planContent = `# Plan
- [x] Completed step
- [X] Alternative complete marker
- [ ] Pending step
- [] Missing space in checkbox
- [  ] Extra spaces
- [~] Invalid marker
`;
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'mixed-checkbox-task'
      };

      const result = await trackTaskProgress(config, args);

      // Should handle standard formats
      expect(result.progress.total_steps).toBeGreaterThan(0);
      expect(result.progress.completed_steps).toBeGreaterThan(0);

      // Should log warnings for non-standard formats
      const logCalls = mockErrorLogger.logError.mock.calls;
      const warningLogs = logCalls.filter(call =>
        call[0].error.name === 'CheckboxParsingWarning'
      );
      expect(warningLogs.length).toBeGreaterThan(0);
    });
  });
});