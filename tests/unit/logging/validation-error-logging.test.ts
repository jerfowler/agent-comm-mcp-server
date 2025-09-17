/**
 * TDD Tests for Bug #4: Validation Error Logging
 *
 * These tests verify that validation errors are properly logged
 * to the ErrorLogger system for observability and debugging.
 *
 * RED Phase: These tests should FAIL initially because the tools
 * don't currently call ErrorLogger on validation failures.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import * as os from 'os';
import { ErrorLogger, ErrorLogEntry } from '../../../src/logging/ErrorLogger.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { testUtils } from '../../utils/testUtils.js';
import { ServerConfig } from '../../../src/types.js';

// Import tools that need error logging
import { createTask } from '../../../src/tools/create-task.js';
import { reportProgress } from '../../../src/tools/report-progress.js';
import { submitPlan } from '../../../src/tools/submit-plan.js';

describe('Validation Error Logging (Bug #4 TDD)', () => {
  let tempDir: string;
  let config: ServerConfig;
  let errorLogger: ErrorLogger;
  let eventLogger: EventLogger;
  let logErrorSpy: jest.SpiedFunction<typeof errorLogger.logError>;

  beforeEach(async () => {
    // Create temp directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validation-error-test-'));
    const commDir = path.join(tempDir, 'comm');
    const logDir = path.join(tempDir, 'comm', '.logs');

    await fs.ensureDir(commDir);
    await fs.ensureDir(logDir);

    // Create real ErrorLogger and EventLogger instances
    errorLogger = new ErrorLogger(logDir);
    eventLogger = new EventLogger(logDir);

    // Spy on the logError method to verify it's called
    logErrorSpy = jest.spyOn(errorLogger, 'logError');

    // Create config with ErrorLogger
    config = testUtils.createMockConfig({
      commDir,
      archiveDir: path.join(commDir, '.archive'),
      logDir,
      errorLogger,  // Add ErrorLogger to config
      eventLogger
    });
  });

  afterEach(async () => {
    // Clean up
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
    jest.clearAllMocks();
  });

  describe('create-task validation errors', () => {
    it('should log error when agent name is empty', async () => {
      // Act: Try to create task with empty agent name
      try {
        await createTask(config, {
          agent: '',  // Invalid: empty string
          taskName: 'test-task'
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert: ErrorLogger should have been called
      expect(logErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
        source: 'validation',
        operation: 'create_task',
        agent: '',
        error: expect.objectContaining({
          message: expect.stringContaining('agent')
        }),
        severity: 'high'
      }));
    });

    it('should log error when taskName is missing', async () => {
      // Act: Try to create task without taskName
      try {
        await createTask(config, {
          agent: 'test-agent',
          taskName: ''  // Invalid: empty string
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert: ErrorLogger should have been called
      expect(logErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
        source: 'validation',
        operation: 'create_task',
        agent: 'test-agent',
        error: expect.objectContaining({
          message: expect.stringContaining('taskName')
        }),
        severity: 'high'
      }));
    });

    it('should write validation errors to error.log file', async () => {
      // Act: Trigger validation error
      try {
        await createTask(config, {
          agent: '',
          taskName: 'test'
        });
      } catch (error) {
        // Expected to throw
      }

      // Wait for async writes to complete
      await eventLogger.waitForWriteQueueEmpty();

      // Assert: Check error.log file exists and contains the error
      const errorLogPath = errorLogger.getErrorLogPath();
      expect(await fs.pathExists(errorLogPath)).toBe(true);

      const errorLogContent = await fs.readFile(errorLogPath, 'utf8');
      expect(errorLogContent).toContain('"source":"validation"');
      expect(errorLogContent).toContain('"operation":"create_task"');
    });
  });

  describe('report-progress validation errors', () => {
    it('should log error when updates is not an array', async () => {
      // Act: Try to report progress with invalid updates
      try {
        await reportProgress(config, {
          agent: 'test-agent',
          updates: 'not-an-array'  // Invalid: should be array
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert: ErrorLogger should have been called
      expect(logErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
        source: 'validation',
        operation: 'report_progress',
        agent: 'test-agent',
        error: expect.objectContaining({
          message: expect.stringContaining('array')
        }),
        severity: 'medium'
      }));
    });

    it('should log error when step is not a number', async () => {
      // Act: Try to report progress with invalid step
      try {
        await reportProgress(config, {
          agent: 'test-agent',
          updates: [{
            step: 'not-a-number',  // Invalid: should be number
            status: 'COMPLETE',
            description: 'Test step'
          }]
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert: ErrorLogger should have been called
      expect(logErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
        source: 'validation',
        operation: 'report_progress',
        agent: 'test-agent',
        error: expect.objectContaining({
          message: expect.stringContaining('step must be a number')
        }),
        context: expect.objectContaining({
          tool: 'report_progress',
          parameters: expect.objectContaining({
            invalidStep: 'not-a-number'
          })
        }),
        severity: 'medium'
      }));
    });

    it('should log error when status is invalid', async () => {
      // Act: Try to report progress with invalid status
      try {
        await reportProgress(config, {
          agent: 'test-agent',
          updates: [{
            step: 1,
            status: 'INVALID_STATUS',  // Invalid status
            description: 'Test step'
          }]
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert: ErrorLogger should have been called
      expect(logErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
        source: 'validation',
        operation: 'report_progress',
        agent: 'test-agent',
        error: expect.objectContaining({
          message: expect.stringContaining('status')
        }),
        severity: 'medium'
      }));
    });
  });

  describe('submit-plan validation errors', () => {
    it('should log error when plan has no checkboxes', async () => {
      // Act: Try to submit plan without checkboxes
      try {
        await submitPlan(config, {
          agent: 'test-agent',
          content: 'This is a plan without any checkboxes',  // Invalid: no checkboxes
          stepCount: 0  // No checkboxes, expecting error
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert: ErrorLogger should have been called
      expect(logErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
        source: 'validation',
        operation: 'submit_plan',
        agent: 'test-agent',
        error: expect.objectContaining({
          message: expect.stringContaining('checkbox')
        }),
        severity: 'medium'
      }));
    });

    it('should log error when plan uses forbidden status markers', async () => {
      // Act: Try to submit plan with status markers
      try {
        await submitPlan(config, {
          agent: 'test-agent',
          content: '1. [PENDING] Task one\n2. [COMPLETE] Task two',  // Invalid format
          stepCount: 0  // No valid checkboxes, expecting error
        });
      } catch (error) {
        // Expected to throw
      }

      // Assert: ErrorLogger should have been called
      expect(logErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
        source: 'validation',
        operation: 'submit_plan',
        agent: 'test-agent',
        error: expect.objectContaining({
          message: expect.stringContaining('status markers')
        }),
        context: expect.objectContaining({
          tool: 'submit_plan',
          invalidMarkers: expect.arrayContaining(['[PENDING]', '[COMPLETE]'])
        }),
        severity: 'medium'
      }));
    });
  });

  describe('Error log persistence and structure', () => {
    it('should write errors in JSON Lines format', async () => {
      // Act: Trigger multiple validation errors
      try {
        await createTask(config, { agent: '', taskName: 'test1' });
      } catch {}

      try {
        await reportProgress(config, { agent: 'test', updates: 'invalid' });
      } catch {}

      // Wait for writes
      await eventLogger.waitForWriteQueueEmpty();

      // Assert: Check file format
      const errorLogPath = errorLogger.getErrorLogPath();
      const content = await fs.readFile(errorLogPath, 'utf8');
      const lines = content.trim().split('\n');

      // Each line should be valid JSON
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('source');
        expect(parsed).toHaveProperty('operation');
        expect(parsed).toHaveProperty('error');
      }
    });

    it('should include full error context in logs', async () => {
      // Act: Trigger a validation error with context
      try {
        await reportProgress(config, {
          agent: 'test-agent',
          taskId: 'test-task-123',
          updates: [{
            step: 999,  // Will be invalid when step validation is added
            status: 'INVALID',
            description: 'Test'
          }]
        });
      } catch {}

      // Wait for writes
      await eventLogger.waitForWriteQueueEmpty();

      // Assert: Check log contains full context
      const errorLogPath = errorLogger.getErrorLogPath();
      const content = await fs.readFile(errorLogPath, 'utf8');
      const errorEntry = JSON.parse(content.trim().split('\n')[0]);

      expect(errorEntry).toMatchObject({
        source: 'validation',
        operation: 'report_progress',
        agent: 'test-agent',
        taskId: 'test-task-123',
        context: {
          tool: 'report_progress',
          parameters: expect.any(Object)
        }
      });
    });
  });

  describe('Integration with EventLogger', () => {
    it('should log to error.log file', async () => {
      // Act: Trigger validation error
      try {
        await createTask(config, {
          agent: 'test-agent',
          taskName: ''
        });
      } catch {}

      // Wait for writes
      await eventLogger.waitForWriteQueueEmpty();

      // Assert: ErrorLogger should be called
      expect(logErrorSpy).toHaveBeenCalled();

      // Check error log file exists
      const errorLogPath = errorLogger.getErrorLogPath();
      expect(await fs.pathExists(errorLogPath)).toBe(true);

      // Verify error was written to the file
      const errorLogContent = await fs.readFile(errorLogPath, 'utf-8');
      const lines = errorLogContent.trim().split('\n');
      expect(lines.length).toBeGreaterThan(0);

      // Parse the last error entry
      const lastError = JSON.parse(lines[lines.length - 1]) as ErrorLogEntry;
      expect(lastError).toMatchObject({
        source: 'validation',
        operation: 'create_task'
      });
    });
  });
});