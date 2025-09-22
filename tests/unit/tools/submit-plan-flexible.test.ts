/**
 * Tests for flexible plan validation in submit-plan tool
 * Testing relaxed validation requirements for Issue #74
 */

import { jest } from '@jest/globals';
import { submitPlan } from '../../../src/tools/submit-plan.js';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import type { ServerConfig } from '../../../src/types.js';

// Mock modules
jest.mock('../../../src/core/TaskContextManager.js');
jest.mock('../../../src/utils/fs-extra-safe.js');

const MockedTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('submit-plan flexible validation', () => {
  let mockConfig: ServerConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock file system
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockImplementation((path: string) => {
      if (path.includes('INIT.md')) {
        return Promise.resolve('# Task\nTest task content');
      }
      if (path.includes('PLAN.md')) {
        return Promise.resolve('# Plan\n- [ ] Existing task');
      }
      return Promise.resolve('');
    });
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.ensureDir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);

    // Mock TaskContextManager constructor to return our mock instance
    const mockInstance = {
      submitPlan: jest.fn().mockImplementation((args: unknown) => {
        // Cast args to the expected type
        const content = typeof args === 'string' ? args : (args as { content?: string })?.content ?? '';

        // Count checkboxes in the content
        const checkboxRegex = /^[\s]*-\s*\[[\s\w~]*\]/gm;
        const checkboxes = content.match(checkboxRegex) ?? [];

        return Promise.resolve({
          success: true,
          message: 'Plan submitted successfully',
          stepsIdentified: checkboxes.length,
          phases: 1,
          initialProgress: {
            completed: 0,
            inProgress: 0,
            pending: checkboxes.length,
            blocked: 0
          },
          progressMarkers: {
            completed: [],
            pending: checkboxes
          }
        } as never);
      })
    };

    (MockedTaskContextManager as unknown as jest.Mock).mockImplementation(() => mockInstance);

    mockConfig = {
      commDir: './comm',
      archiveDir: './comm/.archive',
      logDir: './comm/.logs',
      enableArchiving: false,
      connectionManager: {
        register: jest.fn(),
        getConnection: jest.fn(),
        updateActivity: jest.fn(),
        getActiveConnections: jest.fn(),
        unregister: jest.fn(),
        getConnectionsByAgent: jest.fn(),
        cleanupStaleConnections: jest.fn(),
        getStatistics: jest.fn(),
        getConnectionCount: jest.fn(),
        hasConnection: jest.fn()
      } as unknown as ConnectionManager,
      eventLogger: {
        logOperation: jest.fn(),
        logError: jest.fn(),
        getOperationStatistics: jest.fn(),
        flush: jest.fn(),
        waitForWriteQueueEmpty: jest.fn()
      } as unknown as EventLogger
    };
  });

  describe('flexible bullet point requirements', () => {
    it('should accept plans with 0 bullet points', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Simple Plan

No bullet points here, just a description of what needs to be done.

- [ ] **Task 1**: Do something
  - Action: Execute command
  - Expected: Success
  - Error: Handle failure`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
      expect(result.stepsIdentified).toBeGreaterThan(0);
    });

    it('should accept plans with only 1 bullet point', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Minimal Plan

• Single bullet point here

- [ ] **Task 1**: Do something
  - Action: Execute command
  - Expected: Success
  - Error: Handle failure`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
      expect(result.stepsIdentified).toBeGreaterThan(0);
    });

    it('should accept plans with 10 bullet points', async () => {
      const bulletPoints = Array.from({ length: 10 }, (_, i) => `• Point ${i + 1}`).join('\n');
      const args = {
        agent: 'test-agent',
        content: `# Plan with Many Points

${bulletPoints}

- [ ] **Task 1**: Do something
  - Action: Execute command
  - Expected: Success
  - Error: Handle failure`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
      expect(result.stepsIdentified).toBeGreaterThan(0);
    });
  });

  describe('flexible keyword requirements', () => {
    it('should accept plans without "Implementation" keyword', async () => {
      const args = {
        agent: 'test-agent',
        content: `# My Plan

Just a simple plan description.

- [ ] **Task 1**: Do something
  - Action: Execute command
  - Expected: Success
  - Error: Handle failure`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
    });

    it('should accept plans without "Tasks" keyword', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Plan

## Steps to Complete

- [ ] **Step 1**: First step
  - Action: Do this
  - Expected: Works
  - Error: Fix it`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
    });

    it('should accept plans without any traditional keywords', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Quick Fix

- [ ] **Fix**: Apply the fix
  - Action: Run command
  - Expected: Fixed
  - Error: Debug`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
    });
  });

  describe('minimal checkbox formats', () => {
    it('should accept simple checkbox without bold title', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Plan

- [ ] Simple task without bold
- [ ] Another simple task
- [ ] Third task`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
      expect(result.stepsIdentified).toBe(3);
    });

    it('should accept checkbox with just task name', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Plan

- [ ] Task
- [ ] Another`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
      expect(result.stepsIdentified).toBe(2);
    });

    it('should accept mixed checkbox formats', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Plan

- [ ] Simple task
- [ ] **Bold Task**: With description
  - Action: Do something
  - Expected: Works
- [ ] Another simple one`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
      expect(result.stepsIdentified).toBe(3);
    });
  });

  describe('validation mode configuration', () => {
    it('should default to relaxed mode', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Minimal Plan
- [ ] Task`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
    });

    it('should respect AGENT_COMM_VALIDATION_MODE environment variable', async () => {
      process.env['AGENT_COMM_VALIDATION_MODE'] = 'strict';

      // In strict mode, a minimal plan without proper format should fail
      const minimalArgs = {
        agent: 'test-agent',
        content: `# Minimal Plan
- [ ] Task`
      };

      // This should reject in strict mode due to missing bold title and detail bullets
      await expect(submitPlan(mockConfig, minimalArgs)).rejects.toThrow();

      // But a properly formatted plan should work even in strict mode
      const properArgs = {
        agent: 'test-agent',
        content: `# Proper Plan

- [ ] **Task 1**: Do something
  - Action: Execute command
  - Expected: Success`
      };

      const result = await submitPlan(mockConfig, properArgs);
      expect(result.success).toBe(true);

      delete process.env['AGENT_COMM_VALIDATION_MODE'];
    });

    it('should support validation_mode in args', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Minimal Plan
- [ ] Task`,
        validation_mode: 'relaxed'
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty plan gracefully', async () => {
      const args = {
        agent: 'test-agent',
        content: ''
      };

      await expect(submitPlan(mockConfig, args)).rejects.toThrow();
    });

    it('should require at least one checkbox', async () => {
      const args = {
        agent: 'test-agent',
        content: `# Plan without checkboxes

Just some text without any checkboxes.`
      };

      await expect(submitPlan(mockConfig, args)).rejects.toThrow();
    });

    it('should handle very long plans', async () => {
      const checkboxes = Array.from({ length: 100 }, (_, i) => `- [ ] Task ${i + 1}`).join('\n');
      const args = {
        agent: 'test-agent',
        content: `# Large Plan\n\n${checkboxes}`
      };

      const result = await submitPlan(mockConfig, args);
      expect(result.success).toBe(true);
      expect(result.stepsIdentified).toBe(100);
    });
  });
});
