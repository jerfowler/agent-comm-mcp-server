/**
 * Feature test for Issue #23: Add taskId parameter support to task management tools
 * Tests the optional taskId parameter across submit_plan, report_progress, and mark_complete tools
 */

import { ConnectionManager, Connection } from '../../../src/core/ConnectionManager.js';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { submitPlan } from '../../../src/tools/submit-plan.js';
import { reportProgress } from '../../../src/tools/report-progress.js';
import { markComplete } from '../../../src/tools/mark-complete.js';
import { ServerConfig } from '../../../src/types.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import * as fileSystem from '../../../src/utils/file-system.js';
import * as path from 'path';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js');
jest.mock('../../../src/utils/file-system.js');
jest.mock('../../../src/logging/EventLogger.js');
jest.mock('../../../src/utils/lock-manager.js', () => ({
  LockManager: jest.fn().mockImplementation(() => ({
    checkLock: jest.fn().mockResolvedValue({ isLocked: false, isStale: false }),
    acquireLock: jest.fn().mockResolvedValue({ acquired: true, lockId: 'test-lock-id' }),
    releaseLock: jest.fn().mockResolvedValue(true)
  }))
}));
jest.mock('../../../src/core/agent-work-verifier.js', () => ({
  verifyAgentWork: jest.fn().mockResolvedValue({
    confidence: 90,
    warnings: [],
    evidence: {
      filesModified: 5,
      testsRun: true,
      mcpProgress: true,
      timeSpent: 1800
    },
    recommendation: 'Work verified successfully'
  }),
  DEFAULT_CONFIDENCE_THRESHOLD: 75
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;

describe('TaskId Parameter Support (Issue #23)', () => {
  let config: ServerConfig;
  let connectionManager: ConnectionManager;
  let eventLogger: EventLogger;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocked fs
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFs.readdir.mockResolvedValue(['task-2024-01-01-task1', 'task-2024-01-02-task2']);
    mockedFs.stat.mockImplementation((taskPath: string) => {
      const taskName = path.basename(taskPath);
      const mtime = taskName.includes('task2') 
        ? new Date('2024-01-02T10:00:00.000Z')
        : new Date('2024-01-01T10:00:00.000Z');
      return Promise.resolve({
        isDirectory: () => true,
        mtime
      } as fs.Stats);
    });
    mockedFs.readFile.mockResolvedValue('- [ ] **Step 1**: Test step\n  - Action: Do something\n- [ ] **Step 2**: Second step\n  - Action: Do second thing\n- [ ] **Step 3**: Third step\n  - Action: Do third thing');
    mockedFs.writeFile.mockResolvedValue(undefined);
    
    // Mock file-system module functions
    mockedFileSystem.listDirectory.mockResolvedValue(['task-2024-01-01-task1', 'task-2024-01-02-task2']);
    mockedFileSystem.pathExists.mockResolvedValue(true);
    mockedFileSystem.readFile.mockResolvedValue('- [ ] **Step 1**: Test step\n  - Action: Do something\n- [ ] **Step 2**: Second step\n  - Action: Do second thing\n- [ ] **Step 3**: Third step\n  - Action: Do third thing');
    
    connectionManager = new ConnectionManager();
    eventLogger = {
      logOperation: jest.fn().mockResolvedValue(undefined),
      waitForWriteQueueEmpty: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    } as unknown as EventLogger;
    
    config = {
      commDir: './test-comm',
      connectionManager,
      eventLogger,
      archiveDir: './test-archive',
      logDir: './test-logs',
      enableArchiving: false
    };
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Connection Interface', () => {
    it('should support optional taskId in Connection metadata', () => {
      const connection: Connection = {
        id: 'test-conn-1',
        agent: 'test-agent',
        startTime: new Date(),
        metadata: {
          operation: 'submit-plan',
          taskId: 'task-2024-01-01-specific' // NEW: taskId in metadata
        }
      };
      
      connectionManager.register(connection);
      const retrieved = connectionManager.getConnection('test-conn-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.metadata['taskId']).toBe('task-2024-01-01-specific');
    });

    it('should maintain backward compatibility without taskId', () => {
      const connection: Connection = {
        id: 'test-conn-2',
        agent: 'test-agent',
        startTime: new Date(),
        metadata: {
          operation: 'submit-plan'
          // No taskId - should work as before
        }
      };
      
      connectionManager.register(connection);
      const retrieved = connectionManager.getConnection('test-conn-2');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.metadata['taskId']).toBeUndefined();
    });
  });

  describe('submit-plan tool with taskId', () => {
    it('should accept optional taskId parameter', async () => {
      const args = {
        agent: 'test-agent',
        content: '# Plan\n\n- [ ] **Step 1**: Test step\n  - Action: Do something\n  - Expected: Success\n  - Error: Handle failure',
        taskId: 'task-2024-01-01-specific', // NEW: taskId parameter
        stepCount: 1  // 1 checkbox in the plan
      };

      const result = await submitPlan(config, args);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Plan submitted successfully');
      
      // Verify writeFile was called with the specific task path
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-01-specific'),
        expect.any(String)
      );
    });

    it('should work without taskId (backward compatibility)', async () => {
      const args = {
        agent: 'test-agent',
        content: '# Plan\n\n- [ ] **Step 1**: Test step\n  - Action: Do something\n  - Expected: Success\n  - Error: Handle failure',
        // No taskId - should use most recent task
        stepCount: 1  // 1 checkbox in the plan
      };

      const result = await submitPlan(config, args);
      
      expect(result.success).toBe(true);
      expect(result.message).toBe('Plan submitted successfully');
      
      // Should default to most recent task (task2)
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-02-task2'),
        expect.any(String)
      );
    });

    it('should validate taskId exists', async () => {
      mockedFs.pathExists.mockImplementation((p: string) => {
        // Task doesn't exist
        if (p.includes('non-existent-task')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
      
      const args = {
        agent: 'test-agent',
        content: '# Plan\n\n- [ ] **Step 1**: Test step\n  - Action: Do something\n  - Expected: Success\n  - Error: Handle failure',
        taskId: 'non-existent-task',
        stepCount: 1  // 1 checkbox in the plan
      };

      await expect(submitPlan(config, args)).rejects.toThrow("Task 'non-existent-task' not found for agent 'test-agent'");
    });

    it('should handle empty taskId as no taskId', async () => {
      const args = {
        agent: 'test-agent',
        content: '# Plan\n\n- [ ] **Step 1**: Test step\n  - Action: Do something\n  - Expected: Success\n  - Error: Handle failure',
        taskId: '', // Empty string should be treated as no taskId
        stepCount: 1  // 1 checkbox in the plan
      };

      const result = await submitPlan(config, args);
      
      expect(result.success).toBe(true);
      // Should use most recent task
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-02-task2'),
        expect.any(String)
      );
    });
  });

  describe('report-progress tool with taskId', () => {
    it('should accept optional taskId parameter', async () => {
      const args = {
        agent: 'test-agent',
        updates: [{
          step: 1,
          status: 'COMPLETE',
          description: 'Step 1 completed'
        }],
        taskId: 'task-2024-01-01-specific' // NEW: taskId parameter
      };
      
      const result = await reportProgress(config, args);
      
      expect(result.success).toBe(true);
      expect(result.updatedSteps).toBe(1);
      
      // Verify the specific task was updated
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-01-specific'),
        'utf8'
      );
    });

    it('should work without taskId (backward compatibility)', async () => {
      const args = {
        agent: 'test-agent',
        updates: [{
          step: 1,
          status: 'IN_PROGRESS',
          description: 'Working on step 1'
        }]
        // No taskId - should use active task
      };
      
      const result = await reportProgress(config, args);
      
      expect(result.success).toBe(true);
      expect(result.updatedSteps).toBe(1);
    });

    it('should validate taskId when provided', async () => {
      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p.includes('invalid-task')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
      
      const args = {
        agent: 'test-agent',
        updates: [{
          step: 1,
          status: 'COMPLETE',
          description: 'Step completed'
        }],
        taskId: 'invalid-task'
      };
      
      await expect(reportProgress(config, args)).rejects.toThrow("Task 'invalid-task' not found for agent 'test-agent'.");
    });

    it('should handle multiple updates with specific taskId', async () => {
      const args = {
        agent: 'test-agent',
        updates: [
          {
            step: 1,
            status: 'COMPLETE',
            description: 'Step 1 done',
            timeSpent: 30
          },
          {
            step: 2,
            status: 'IN_PROGRESS',
            description: 'Working on step 2',
            estimatedTimeRemaining: 45
          },
          {
            step: 3,
            status: 'PENDING',
            description: 'Step 3 waiting'
          }
        ],
        taskId: 'task-2024-01-01-specific'
      };
      
      const result = await reportProgress(config, args);
      
      expect(result.success).toBe(true);
      expect(result.updatedSteps).toBe(3);
      expect(result.summary.completed).toBe(1);
      expect(result.summary.inProgress).toBe(1);
      expect(result.summary.pending).toBe(1);
      expect(result.timeTracking).toEqual({
        totalTimeSpent: 30,
        estimatedRemaining: 45
      });
    });
  });

  describe('mark-complete tool with taskId', () => {
    it('should accept optional taskId parameter', async () => {
      // Mock the plan with all items checked to avoid reconciliation issues
      mockedFileSystem.readFile.mockResolvedValue('- [x] **Step 1**: Test step\n  - Action: Done');
      
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully with all requirements met',
        taskId: 'task-2024-01-01-specific', // NEW: taskId parameter
        reconciliation_mode: 'auto_complete' // Add reconciliation to handle any unchecked items
      };
      
      const result = await markComplete(config, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
      
      // Verify the specific task was marked complete
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-01-specific'),
        expect.any(String)
      );
    });

    it('should work without taskId (backward compatibility)', async () => {
      // Mock the plan with all items checked to avoid reconciliation issues
      mockedFileSystem.readFile.mockResolvedValue('- [x] **Step 1**: Test step\n  - Action: Done');
      
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed successfully with all requirements met',
        reconciliation_mode: 'auto_complete' // Add reconciliation to handle any unchecked items
        // No taskId - should use active task
      };
      
      const result = await markComplete(config, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });

    it('should validate taskId exists before marking complete', async () => {
      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p.includes('missing-task')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
      
      mockedFileSystem.pathExists.mockImplementation((p: string) => {
        if (p.includes('missing-task')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
      
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed',
        taskId: 'missing-task',
        reconciliation_mode: 'auto_complete'
      };
      
      // The TaskContextManager should throw when taskId is not found
      await expect(markComplete(config, args)).rejects.toThrow("Task 'missing-task' not found for agent 'test-agent'.");
    });

    it('should handle ERROR status with specific taskId', async () => {
      const args = {
        agent: 'test-agent',
        status: 'ERROR',
        summary: 'Task failed due to unexpected error in step 3',
        taskId: 'task-2024-01-02-task2'
      };
      
      const result = await markComplete(config, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('ERROR');
      expect(result.isError).toBe(true);
      
      // Should write ERROR.md to specific task
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-02-task2'),
        expect.stringContaining('Task failed')
      );
    });

    it('should support reconciliation with specific taskId', async () => {
      // Mock plan content with unchecked items
      mockedFs.readFile.mockResolvedValue(`# Plan
- [x] **Step 1**: Completed step
  - Action: Done
- [ ] **Step 2**: Unchecked step
  - Action: Not done yet
- [ ] **Step 3**: Another unchecked
  - Action: Also not done`);
      
      const args = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completed with variance',
        taskId: 'task-2024-01-01-specific',
        reconciliation_mode: 'reconcile',
        reconciliation_explanations: {
          'Step 2': 'Determined to be unnecessary after analysis',
          'Step 3': 'Covered by automated testing'
        }
      };
      
      const result = await markComplete(config, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
      expect(result.summary).toContain('Variance Report');
      expect(result.summary).toContain('Completed via alternative approach');
    });
  });

  describe('TaskContextManager with taskId', () => {
    it('should pass taskId through connection to submitPlan', async () => {
      const contextManager = new TaskContextManager({
        commDir: config.commDir,
        connectionManager: config.connectionManager,
        eventLogger: config.eventLogger
      });
      
      const connection: Connection = {
        id: 'test-conn',
        agent: 'test-agent',
        startTime: new Date(),
        metadata: {
          operation: 'submit-plan',
          taskId: 'task-2024-01-01-specific'
        }
      };
      
      const content = '# Plan\n\n- [ ] **Step 1**: Test\n  - Action: Test action';
      const result = await contextManager.submitPlan(content, connection);
      
      expect(result.success).toBe(true);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-01-specific'),
        content
      );
    });

    it('should pass taskId through connection to reportProgress', async () => {
      const contextManager = new TaskContextManager({
        commDir: config.commDir,
        connectionManager: config.connectionManager,
        eventLogger: config.eventLogger
      });
      
      const connection: Connection = {
        id: 'test-conn',
        agent: 'test-agent',
        startTime: new Date(),
        metadata: {
          operation: 'report-progress',
          taskId: 'task-2024-01-02-task2'
        }
      };
      
      const updates = [{
        step: 1,
        status: 'COMPLETE' as const,
        description: 'Completed'
      }];
      
      const result = await contextManager.reportProgress(updates, connection);
      
      expect(result.success).toBe(true);
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-02-task2'),
        'utf8'
      );
    });

    it('should pass taskId through connection to markComplete', async () => {
      const contextManager = new TaskContextManager({
        commDir: config.commDir,
        connectionManager: config.connectionManager,
        eventLogger: config.eventLogger
      });
      
      const connection: Connection = {
        id: 'test-conn',
        agent: 'test-agent',
        startTime: new Date(),
        metadata: {
          operation: 'mark-complete',
          taskId: 'task-2024-01-01-specific'
        }
      };
      
      const result = await contextManager.markComplete('DONE', 'Task completed', connection);
      
      expect(result.success).toBe(true);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-01-specific'),
        expect.any(String)
      );
    });
  });

  describe('Error handling', () => {
    it('should provide clear error message for non-existent taskId', async () => {
      // Mock fs to return true for agent dir but false for specific task
      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p.includes('task-that-does-not-exist')) return Promise.resolve(false);
        if (p.includes('test-agent')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      
      const args = {
        agent: 'test-agent',
        content: '# Plan\n\n- [ ] **Step 1**: Test step with sufficient content\n  - Action: Test action with detailed description\n  - Expected: Detailed expected outcome',
        taskId: 'task-that-does-not-exist',
        stepCount: 1  // 1 checkbox in the plan
      };

      await expect(submitPlan(config, args))
        .rejects
        .toThrow("Task 'task-that-does-not-exist' not found for agent 'test-agent'.");
    });

    it('should handle taskId with special characters', async () => {
      const specialTaskId = 'task-2024-01-01-test_with-special.chars';
      
      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p.includes(specialTaskId)) return Promise.resolve(true);
        if (p.includes('test-agent')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      
      const args = {
        agent: 'test-agent',
        content: '# Plan\n\n- [ ] **Step 1**: Test step with sufficient content\n  - Action: Test action with detailed description\n  - Expected: Detailed expected outcome',
        taskId: specialTaskId,
        stepCount: 1  // 1 checkbox in the plan
      };

      const result = await submitPlan(config, args);
      
      expect(result.success).toBe(true);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(specialTaskId),
        expect.any(String)
      );
    });

    it('should reject invalid taskId format', async () => {
      // Mock fs to return false for path traversal attempts
      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p.includes('../../../etc/passwd')) return Promise.resolve(false);
        if (p.includes('test-agent')) return Promise.resolve(true);
        return Promise.resolve(false);
      });
      
      const args = {
        agent: 'test-agent',
        content: '# Plan\n\n- [ ] **Step 1**: Test step with sufficient content\n  - Action: Test action with detailed description\n  - Expected: Detailed expected outcome',
        taskId: '../../../etc/passwd', // Path traversal attempt
        stepCount: 1  // 1 checkbox in the plan
      };

      await expect(submitPlan(config, args))
        .rejects
        .toThrow("Task '../../../etc/passwd' not found for agent 'test-agent'.");
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow with specific taskId', async () => {
      const taskId = 'task-2024-01-01-integration';
      
      // Step 1: Submit plan with taskId
      const planArgs = {
        agent: 'test-agent',
        content: '# Integration Test Plan\n\n- [ ] **Step 1**: Initialize\n  - Action: Setup\n- [ ] **Step 2**: Process\n  - Action: Execute\n- [ ] **Step 3**: Finalize\n  - Action: Complete',
        taskId,
        stepCount: 3  // 3 checkboxes in the plan
      };

      const planResult = await submitPlan(config, planArgs);
      expect(planResult.success).toBe(true);
      
      // Step 2: Report progress with same taskId
      const progressArgs = {
        agent: 'test-agent',
        updates: [
          { step: 1, status: 'COMPLETE', description: 'Setup done' },
          { step: 2, status: 'IN_PROGRESS', description: 'Processing' }
        ],
        taskId
      };
      
      const progressResult = await reportProgress(config, progressArgs);
      expect(progressResult.success).toBe(true);
      expect(progressResult.summary.completed).toBe(1);
      
      // Step 3: Mark complete with same taskId
      // Mock the plan with all items checked for successful completion
      mockedFileSystem.readFile.mockResolvedValue('- [x] **Step 1**: Initialize\n- [x] **Step 2**: Process\n- [x] **Step 3**: Finalize');
      
      const completeArgs = {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Integration test completed successfully',
        taskId,
        reconciliation_mode: 'auto_complete'
      };
      
      const completeResult = await markComplete(config, completeArgs);
      expect(completeResult.success).toBe(true);
      expect(completeResult.status).toBe('DONE');
    });

    it('should handle multiple agents working on different tasks', async () => {
      // Agent 1 works on task1
      const agent1Args = {
        agent: 'frontend-engineer',
        content: '# Frontend Task\n\n- [ ] **UI Updates**: Update components\n  - Action: Refactor',
        taskId: 'task-2024-01-01-frontend',
        stepCount: 1  // 1 checkbox in the plan
      };

      // Agent 2 works on task2
      const agent2Args = {
        agent: 'backend-engineer',
        content: '# Backend Task\n\n- [ ] **API Updates**: Update endpoints\n  - Action: Implement',
        taskId: 'task-2024-01-02-backend',
        stepCount: 1  // 1 checkbox in the plan
      };
      
      // Both agents submit plans to different tasks
      const [result1, result2] = await Promise.all([
        submitPlan(config, agent1Args),
        submitPlan(config, agent2Args)
      ]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // Verify different tasks were updated
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-01-frontend'),
        expect.any(String)
      );
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('task-2024-01-02-backend'),
        expect.any(String)
      );
    });

    it('should allow switching between tasks with taskId', async () => {
      const agent = 'versatile-agent';
      
      // Work on task1
      await submitPlan(config, {
        agent,
        content: '# Task 1\n\n- [ ] **Step A**: Do A\n  - Action: Execute A',
        taskId: 'task-2024-01-01-first',
        stepCount: 1  // 1 checkbox in the plan
      });

      // Switch to task2
      await submitPlan(config, {
        agent,
        content: '# Task 2\n\n- [ ] **Step B**: Do B\n  - Action: Execute B',
        taskId: 'task-2024-01-02-second',
        stepCount: 1  // 1 checkbox in the plan
      });
      
      // Go back to task1
      await reportProgress(config, {
        agent,
        updates: [{ step: 1, status: 'COMPLETE', description: 'Step A done' }],
        taskId: 'task-2024-01-01-first'
      });
      
      // Complete task2
      await markComplete(config, {
        agent,
        status: 'DONE',
        summary: 'Task 2 completed',
        taskId: 'task-2024-01-02-second',
        reconciliation_mode: 'auto_complete'
      });
      
      // All operations should succeed
      expect(mockedFs.writeFile).toHaveBeenCalledTimes(4);
    });
  });
});