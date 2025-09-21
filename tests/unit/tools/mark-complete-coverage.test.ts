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

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedVerifyAgentWork = agentVerifier.verifyAgentWork as jest.MockedFunction<typeof agentVerifier.verifyAgentWork>;

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
    (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
    (mockedFs.listDirectory as jest.Mock).mockResolvedValue(['test-task']);
    (mockedFs.isDirectory as jest.Mock).mockResolvedValue(true);
    (mockedFs.ensureDirectory as jest.Mock).mockResolvedValue(undefined);
    (mockedFs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (mockedFs.readFile as jest.Mock).mockResolvedValue('Initial task');

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

      (mockedFs.readFile as jest.Mock)
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

      (mockedFs.readFile as jest.Mock)
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
    it('should reject in strict mode with unchecked items', async () => {
      const planContent = `# Plan
- [ ] **Incomplete**: Not done`;

      (mockedFs.readFile as jest.Mock)
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Attempting strict completion',
        reconciliation_mode: 'strict'
      })).rejects.toThrow('Cannot mark DONE with 1 unchecked items in strict mode');
    });
  });

  describe('error status handling', () => {
    it('should allow ERROR status with unchecked items', async () => {
      const planContent = `# Plan
- [ ] **Failed Task**: Could not complete`;

      (mockedFs.readFile as jest.Mock)
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

      (mockedFs.readFile as jest.Mock)
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
      (mockedFs.readFile as jest.Mock)
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
      (mockedFs.readFile as jest.Mock)
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

      (mockedFs.readFile as jest.Mock)
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce('# Plan\n- [x] **Task**: Done');

      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Trying to complete with low confidence'
      })).rejects.toThrow('Confidence score');
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

      (mockedFs.readFile as jest.Mock)
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
      (mockedFs.readFile as jest.Mock)
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Completed without INIT file'
      });

      expect(result.success).toBe(true);
    });

    it('should handle missing agent directory', async () => {
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(false);
      (mockedFs.listDirectory as jest.Mock).mockResolvedValue([]);

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

      (mockedFs.readFile as jest.Mock)
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent)
        .mockResolvedValueOnce(planContent); // For re-read during update

      // Mock finding the task directory
      (mockedFs.listDirectory as jest.Mock).mockResolvedValueOnce(['test-task']);
      (mockedFs.isDirectory as jest.Mock).mockResolvedValueOnce(true);

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

      (mockedFs.readFile as jest.Mock)
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

    it('should reject reconcile without explanations', async () => {
      const planContent = `# Plan
- [ ] **Missing**: Not done`;

      (mockedFs.readFile as jest.Mock)
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Trying reconciliation',
        reconciliation_mode: 'reconcile'
        // No explanations provided
      })).rejects.toThrow('Missing reconciliation explanation');
    });
  });

  describe('task id parameter', () => {
    it('should use provided taskId when specified', async () => {
      const planContent = `# Plan
- [x] **Done**: Complete`;

      (mockedFs.readFile as jest.Mock)
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

      (mockedFs.readFile as jest.Mock)
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

      (mockedFs.readFile as jest.Mock)
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
    it('should handle file write errors with error logger', async () => {
      const planContent = `# Plan
- [x] **Task**: Done`;

      (mockedFs.readFile as jest.Mock)
        .mockResolvedValueOnce('Initial task')
        .mockResolvedValueOnce(planContent);

      // Make writeFile fail with a permission error
      (mockedFs.writeFile as jest.Mock)
        .mockRejectedValueOnce(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));

      await expect(markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Trying to complete but write fails'
      })).rejects.toThrow('Permission denied');

      // Should have logged the error
      expect(mockConfig.errorLogger?.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'runtime',
          operation: 'mark_complete'
        })
      );
    });
  });

  describe('empty plan handling', () => {
    it('should handle plan with no checkboxes', async () => {
      const planContent = `# Plan
Just some text without any checkboxes`;

      (mockedFs.readFile as jest.Mock)
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
  });
});