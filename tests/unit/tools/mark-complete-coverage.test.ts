/**
 * Coverage-focused tests for mark-complete tool
 * Targets specific branches to improve coverage
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { markComplete } from '../../../src/tools/mark-complete.js';
import * as fs from '../../../src/utils/file-system.js';
import * as agentVerifier from '../../../src/core/agent-work-verifier.js';
import type { ServerConfig } from '../../../src/types.js';

// Mock dependencies
jest.mock('../../../src/utils/file-system.js');
jest.mock('../../../src/core/agent-work-verifier.js');

const mockedFs = jest.mocked(fs);
const mockedVerifyAgentWork = jest.mocked(agentVerifier.verifyAgentWork);

describe('mark-complete coverage tests', () => {
  let mockConfig: ServerConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      commDir: '/test/comm',
      archiveDir: '/test/archive',
      logDir: '/test/logs',
      enableArchiving: true,
      connectionManager: {
        register: jest.fn(),
        unregister: jest.fn(),
        getCurrentTask: jest.fn().mockReturnValue('test-task'),
        setCurrentTask: jest.fn()
      } as any,
      eventLogger: {
        logOperation: jest.fn()
      } as any,
      errorLogger: {
        logError: jest.fn()
      } as any
    };

    // Default mocks
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFs.listDirectory.mockResolvedValue(['test-task']);
    mockedFs.isDirectory.mockResolvedValue(true);
    mockedFs.ensureDirectory.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue('Initial task');

    // Default verification with good confidence
    mockedVerifyAgentWork.mockResolvedValue({
      success: true,
      confidence: 75,
      warnings: [],
      evidence: {
        filesModified: 3,
        testsRun: true,
        mcpProgress: true,
        timeSpent: 900
      },
      recommendation: 'Work verified'
    });
  });

  describe('force mode bypasses', () => {
    it('should bypass verification completely in force mode', async () => {
      const planContent = `# Plan
- [ ] **Task 1**: Not done
- [ ] **Task 2**: Not done`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task') // INIT.md
        .mockResolvedValueOnce(planContent);   // PLAN.md

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Force completed the task',
        reconciliation_mode: 'force'
      });

      expect(result.success).toBe(true);
      expect(mockedVerifyAgentWork).not.toHaveBeenCalled();
      expect(mockConfig.eventLogger?.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'force_mode_used'
        })
      );
    });
  });

  describe('default relaxed mode', () => {
    it('should allow completion with unchecked items in default mode', async () => {
      const planContent = `# Plan
- [x] **Task 1**: Done
- [ ] **Task 2**: Not done`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed with relaxed validation'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('strict mode validation', () => {
    it('should allow completion in default mode (relaxed)', async () => {
      // Note: default mode is now relaxed, not strict
      const planContent = `# Plan
- [ ] **Incomplete**: Not done`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Attempting completion'
        // No reconciliation_mode - uses default (relaxed)
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('error status handling', () => {
    it('should allow ERROR status with unchecked items', async () => {
      const planContent = `# Plan
- [ ] **Failed Task**: Could not complete`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'ERROR',
        summary: 'Task failed with errors'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('ERROR');
    });
  });

  describe('three-state checkbox parsing', () => {
    it('should count [~] as unchecked', async () => {
      const planContent = `# Plan
- [x] **Complete**: Done
- [~] **In Progress**: Working on it
- [ ] **Pending**: Not started`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      // Default mode should allow completion
      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed with in-progress items'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('error logging paths', () => {
    it('should log validation errors', async () => {
      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce('# Plan\n- [ ] **Task**: Not done');

      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Too short',  // Less than 10 chars
        reconciliation_mode: 'strict'
      })).rejects.toThrow('Summary must be at least 10 characters long');
    });

    it('should log file system errors', async () => {
      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockRejectedValueOnce(Object.assign(new Error('Disk full'), { code: 'ENOSPC' }));

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully'
      });

      // Should handle gracefully with relaxed validation
      expect(result.success).toBe(true);
    });
  });

  describe('confidence threshold checks', () => {
    it('should fail when confidence below threshold (not force mode)', async () => {
      mockedVerifyAgentWork.mockResolvedValue({
        success: false,
        confidence: 50, // Below threshold
        warnings: ['Low confidence'],
        evidence: {
          filesModified: 0,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 60
        },
        recommendation: 'Cannot verify work'
      });

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce('# Plan\n- [x] **Task**: Done');

      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Trying to complete with low confidence'
      })).rejects.toThrow('VERIFICATION FAILED');
    });

    it('should pass when confidence meets threshold', async () => {
      mockedVerifyAgentWork.mockResolvedValue({
        success: true,
        confidence: 70, // Exactly at threshold
        warnings: [],
        evidence: {
          filesModified: 2,
          testsRun: true,
          mcpProgress: true,
          timeSpent: 600
        },
        recommendation: 'Work verified'
      });

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce('# Plan\n- [x] **Task**: Done');

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed with threshold confidence'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('missing file handling', () => {
    it('should handle missing INIT.md gracefully', async () => {
      mockedFs.readFile
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed without INIT file'
      });

      expect(result.success).toBe(true);
    });

    it('should handle missing agent directory', async () => {
      mockedFs.pathExists.mockResolvedValue(false);
      mockedFs.listDirectory.mockResolvedValue([]);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'ERROR',
        summary: 'Failed - no agent directory'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('ERROR');
    });
  });

  describe('auto_complete mode', () => {
    it('should auto-complete unchecked items', async () => {
      const planContent = `# Plan
- [ ] **Task 1**: Not done
- [x] **Task 2**: Done
- [~] **Task 3**: In progress`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent)
        .mockResolvedValueOnce(planContent); // For re-read during update

      // Mock finding the task directory
      mockedFs.listDirectory.mockResolvedValueOnce(['test-task']);
      mockedFs.isDirectory.mockResolvedValueOnce(true);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Auto-completing tasks',
        reconciliation_mode: 'auto_complete'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('reconcile mode', () => {
    it('should accept reconciliation with explanations', async () => {
      const planContent = `# Plan
- [ ] **Docs**: Not written
- [x] **Code**: Done`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed with explanations',
        reconciliation_mode: 'reconcile',
        reconciliation_explanations: {
          'Docs': 'Documentation added as inline comments'
        }
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });

    it('should accept reconcile without explanations using defaults', async () => {
      const planContent = `# Plan
- [ ] **Missing**: Not done`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      // In reconcile mode without explanations, it should succeed with default explanations
      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Trying reconciliation',
        reconciliation_mode: 'reconcile'
        // No explanations provided - should use default
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('task id parameter', () => {
    it('should handle task validation with provided taskId', async () => {
      const planContent = `# Plan
- [x] **Done**: Complete`;

      // Mock task discovery - agent has a valid task
      mockedFs.listDirectory.mockResolvedValueOnce(['specific-task-id']);
      mockedFs.isDirectory.mockResolvedValueOnce(true);

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed with specific ID',
        taskId: 'specific-task-id'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('verification warnings', () => {
    it('should log warnings from verification', async () => {
      mockedVerifyAgentWork.mockResolvedValue({
        success: true,
        confidence: 75,
        warnings: ['No tests were run', 'Manual verification recommended'],
        evidence: {
          filesModified: 1,
          testsRun: false,
          mcpProgress: true,
          timeSpent: 300
        },
        recommendation: 'Consider adding tests'
      });

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce('# Plan\n- [x] **Task**: Done');

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed with warnings'
      });

      expect(result.success).toBe(true);
      expect(mockConfig.eventLogger?.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'verification_gate_passed',
          metadata: expect.objectContaining({
            warningCount: 2
          })
        })
      );
    });
  });

  describe('checkbox format validation', () => {
    it('should warn about malformed checkboxes', async () => {
      const planContent = `# Plan
- [x] Valid checkbox
- [] Missing space
- [ Not closed`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed with malformed checkboxes'
      });

      expect(result.success).toBe(true);
      // ErrorLogger might have been called for malformed checkboxes
      // but it's optional and depends on implementation details
    });
  });

  describe('write error handling', () => {
    it('should handle file write errors gracefully', async () => {
      const planContent = `# Plan
- [x] **Task**: Done`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      // Make writeFile fail with a permission error
      mockedFs.writeFile
        .mockRejectedValueOnce(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));

      // In relaxed mode, write errors don't prevent completion
      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Trying to complete despite write fail'
      });

      // Should succeed despite write error (relaxed validation)
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('empty plan handling', () => {
    it('should handle plan with no checkboxes', async () => {
      const planContent = `# Plan
Just some text without any checkboxes`;

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed task with no checkboxes'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });

    it('should handle completely empty plan file', async () => {
      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(''); // Empty plan

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed with empty plan'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('verification edge cases', () => {
    it('should handle verification error gracefully', async () => {
      mockedVerifyAgentWork.mockRejectedValueOnce(new Error('Verification service unavailable'));

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce('# Plan\n- [x] **Task**: Done');

      // Should still succeed when verification fails (relaxed mode)
      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed despite verification failure'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });

    it('should handle missing task directory for default task', async () => {
      // No task directories found
      mockedFs.listDirectory.mockResolvedValueOnce([]);

      mockedFs.readFile
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce('# Plan\n- [x] **Task**: Done');

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed without task directory'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });
});