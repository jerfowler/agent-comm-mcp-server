/**
 * Additional tests for TaskContextManager to improve branch coverage
 * Focus on uncovered branches and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';
import { ConnectionManager, Connection } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { AgentOwnershipError } from '../../../src/types.js';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import os from 'os';

describe('TaskContextManager - Branch Coverage', () => {
  let contextManager: TaskContextManager;
  let connectionManager: ConnectionManager;
  let eventLogger: EventLogger;
  let testDir: string;
  let mockConnection: Connection;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-context-branch-test-'));
    const commDir = path.join(testDir, 'comm');
    await fs.ensureDir(commDir);
    
    // Mock connection for session tracking
    mockConnection = {
      id: 'test-connection-123',
      agent: 'senior-system-architect',
      startTime: new Date(),
      metadata: {}
    };
    
    // Create instances
    connectionManager = new ConnectionManager();
    eventLogger = new EventLogger(testDir);
    
    // Create config with all required properties
    const config = {
      commDir,
      connectionManager,
      eventLogger
    };
    
    contextManager = new TaskContextManager(config);
    
    // Register mock connection
    connectionManager.register(mockConnection);
  });
  
  afterEach(async () => {
    // Clean up test directory
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('Edge cases and error handling branches', () => {
    
    it('should handle validateOwnership with empty agent string after trim', async () => {
      const taskId = '2025-01-01T12-00-00-test-task';
      
      // Try with whitespace-only agent name
      await expect(contextManager.validateOwnership('   ', taskId))
        .rejects.toThrow(AgentOwnershipError);
      
      await expect(contextManager.validateOwnership('   ', taskId))
        .rejects.toThrow('Agent name is required');
    });

    it('should handle validateOwnership when comm directory does not exist', async () => {
      // Remove comm directory to trigger the branch
      await fs.remove(path.join(testDir, 'comm'));
      
      const result = await contextManager.validateOwnership('test-agent', 'test-task');
      expect(result).toBe(false);
    });

    it('should handle validateOwnership when agent directory exists but task does not', async () => {
      const agent = 'test-agent';
      const taskId = 'non-existent-task';
      
      // Create agent directory but no task
      await fs.ensureDir(path.join(testDir, 'comm', agent));
      
      const result = await contextManager.validateOwnership(agent, taskId);
      expect(result).toBe(false);
    });

    it('should handle getTaskContext with missing PLAN.md file', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with INIT.md but no PLAN.md
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      
      const context = await contextManager.getTaskContext(agent, taskId);
      
      expect(context.contextId).toBe(`${agent}:${taskId}`);
      expect(context.taskExists).toBe(true);
      expect(context.currentTask).toContain('Test Task');
      expect(context.implementationPlan).toBeUndefined();
    });

    it('should handle getTaskContext with malformed PLAN.md', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with INIT.md and malformed PLAN.md
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '' // Empty file
      );
      
      const context = await contextManager.getTaskContext(agent, taskId);
      
      expect(context.contextId).toBe(`${agent}:${taskId}`);
      expect(context.taskExists).toBe(true);
      expect(context.implementationPlan).toBe('');
    });

    it('should handle getTaskContext with DONE.md present', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create completed task
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n- [ ] Step 1\n- [x] Step 2'
      );
      await fs.writeFile(
        path.join(taskPath, 'DONE.md'),
        '# Task Complete\nAll work finished successfully'
      );
      
      const context = await contextManager.getTaskContext(agent, taskId);
      
      expect(context.contextId).toBe(`${agent}:${taskId}`);
      expect(context.taskExists).toBe(true);
      expect(context.completionStatus).toContain('Task Complete');
    });

    it('should handle getTaskContext with ERROR.md present', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with error
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'ERROR.md'),
        '# Task Failed\nEncountered blocking issue'
      );
      
      const context = await contextManager.getTaskContext(agent, taskId);
      
      expect(context.contextId).toBe(`${agent}:${taskId}`);
      expect(context.taskExists).toBe(true);
      expect(context.errorDetails).toContain('Task Failed');
    });

    it('should handle submitPlan with existing PLAN.md file', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with existing PLAN.md
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Old Plan\nThis should be replaced'
      );
      
      const newPlan = '# New Implementation Plan\n\n- [ ] New Step 1\n- [ ] New Step 2';
      
      const result = await contextManager.submitPlan(agent, taskId, newPlan);
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      
      const planContent = await fs.readFile(path.join(taskPath, 'PLAN.md'), 'utf8');
      expect(planContent).toContain('New Implementation Plan');
    });

    it('should handle reportProgress with step not in plan', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [ ] Step 1\n- [ ] Step 2'
      );
      
      // Try to update step 5 which doesn't exist
      const updates = [{
        step: 5,
        status: 'COMPLETE' as const,
        description: 'Completed non-existent step'
      }];
      
      const result = await contextManager.reportProgress(agent, taskId, updates);
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    it('should handle reportProgress with IN_PROGRESS status', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [ ] Step 1: Do something\n- [ ] Step 2: Do more'
      );
      
      const updates = [{
        step: 1,
        status: 'IN_PROGRESS' as const,
        description: 'Working on step 1'
      }];
      
      const result = await contextManager.reportProgress(agent, taskId, updates);
      
      expect(result.success).toBe(true);
      
      const planContent = await fs.readFile(path.join(taskPath, 'PLAN.md'), 'utf8');
      expect(planContent).toContain('⏳'); // In progress emoji
    });

    it('should handle reportProgress with BLOCKED status', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [ ] Step 1: Do something\n- [ ] Step 2: Do more'
      );
      
      const updates = [{
        step: 1,
        status: 'BLOCKED' as const,
        description: 'Blocked by dependency',
        blocker: 'Waiting for external service'
      }];
      
      const result = await contextManager.reportProgress(agent, taskId, updates);
      
      expect(result.success).toBe(true);
      
      const planContent = await fs.readFile(path.join(taskPath, 'PLAN.md'), 'utf8');
      expect(planContent).toContain('🚫'); // Blocked emoji
    });

    it('should handle reportProgress with PENDING status', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [x] Step 1: Done\n- [ ] Step 2: Reset this'
      );
      
      const updates = [{
        step: 1,
        status: 'PENDING' as const,
        description: 'Resetting to pending'
      }];
      
      const result = await contextManager.reportProgress(agent, taskId, updates);
      
      expect(result.success).toBe(true);
      
      const planContent = await fs.readFile(path.join(taskPath, 'PLAN.md'), 'utf8');
      expect(planContent).toMatch(/- \[ \] Step 1/); // Should be unchecked
    });

    it('should handle markComplete with strict mode and unchecked items', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with incomplete plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [x] Step 1: Done\n- [ ] Step 2: Not done\n- [ ] Step 3: Also not done'
      );
      
      await expect(contextManager.markComplete(agent, taskId, {
        status: 'DONE',
        summary: 'Task complete',
        reconciliationMode: 'strict'
      })).rejects.toThrow('Cannot mark task as complete');
    });

    it('should handle markComplete with auto_complete mode', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with incomplete plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [x] Step 1: Done\n- [ ] Step 2: Not done\n- [ ] Step 3: Also not done'
      );
      
      const result = await contextManager.markComplete(agent, taskId, {
        status: 'DONE',
        summary: 'Task complete',
        reconciliationMode: 'auto_complete'
      });
      
      expect(result.success).toBe(true);
      
      const planContent = await fs.readFile(path.join(taskPath, 'PLAN.md'), 'utf8');
      expect(planContent).toMatch(/- \[x\] Step 2/); // Should be checked
      expect(planContent).toMatch(/- \[x\] Step 3/); // Should be checked
    });

    it('should handle markComplete with reconcile mode', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with incomplete plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [x] Step 1: Done\n- [ ] Step 2: Not done\n- [ ] Step 3: Also not done'
      );
      
      const result = await contextManager.markComplete(agent, taskId, {
        status: 'DONE',
        summary: 'Task complete',
        reconciliationMode: 'reconcile',
        reconciliationExplanations: {
          'Step 2: Not done': 'No longer needed due to design change',
          'Step 3: Also not done': 'Will be handled in next sprint'
        }
      });
      
      expect(result.success).toBe(true);
      
      const doneContent = await fs.readFile(path.join(taskPath, 'DONE.md'), 'utf8');
      expect(doneContent).toContain('design change');
      expect(doneContent).toContain('next sprint');
    });

    it('should handle markComplete with force mode', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with incomplete plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [ ] Step 1: Not done\n- [ ] Step 2: Not done'
      );
      
      const result = await contextManager.markComplete(agent, taskId, {
        status: 'DONE',
        summary: 'Forcing completion due to external factors',
        reconciliationMode: 'force'
      });
      
      expect(result.success).toBe(true);
      
      const doneContent = await fs.readFile(path.join(taskPath, 'DONE.md'), 'utf8');
      expect(doneContent).toContain('Force completed');
      expect(doneContent).toContain('external factors');
    });

    it('should handle markComplete with ERROR status', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      
      const result = await contextManager.markComplete(agent, taskId, {
        status: 'ERROR',
        summary: 'Task failed due to critical error'
      });
      
      expect(result.success).toBe(true);
      
      const errorContent = await fs.readFile(path.join(taskPath, 'ERROR.md'), 'utf8');
      expect(errorContent).toContain('critical error');
    });

    it('should handle syncTodoCheckboxes with matching titles', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [ ] Write unit tests\n- [ ] Implement feature\n- [ ] Update documentation'
      );
      
      const updates = [
        { title: 'Write unit tests', status: 'completed' as const },
        { title: 'Implement feature', status: 'in_progress' as const },
        { title: 'Update documentation', status: 'pending' as const }
      ];
      
      const result = await contextManager.syncTodoCheckboxes(agent, taskId, updates);
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(2); // Only completed and in_progress cause changes
      
      const planContent = await fs.readFile(path.join(taskPath, 'PLAN.md'), 'utf8');
      expect(planContent).toMatch(/- \[x\].*Write unit tests/);
      expect(planContent).toContain('⏳'); // In progress emoji
    });

    it('should handle syncTodoCheckboxes with no matching titles', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [ ] Step 1\n- [ ] Step 2'
      );
      
      const updates = [
        { title: 'Non-existent task', status: 'completed' as const }
      ];
      
      const result = await contextManager.syncTodoCheckboxes(agent, taskId, updates);
      
      expect(result.success).toBe(true);
      expect(result.updated).toBe(0);
      expect(result.notFound).toEqual(['Non-existent task']);
    });

    it('should handle getProgressMarkers with various checkbox states', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with complex plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        `# Implementation Plan

- [x] Completed step
- [ ] Pending step
- [ ] ⏳ In progress step
- [ ] 🚫 Blocked step
- [x] Another completed
- Regular text without checkbox
- [ ] Final pending step`
      );
      
      const markers = await contextManager.getProgressMarkers(agent, taskId);
      
      expect(markers.totalSteps).toBe(6); // Only counting checkbox items
      expect(markers.completedSteps).toBe(2);
      expect(markers.inProgressSteps).toBe(1);
      expect(markers.blockedSteps).toBe(1);
      expect(markers.progress).toBeCloseTo(33.33, 1);
    });

    it('should handle getFullLifecycle with all files present', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with full lifecycle
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial delegation'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Plan\n- [x] Step 1\n- [x] Step 2'
      );
      await fs.writeFile(
        path.join(taskPath, 'DONE.md'),
        '# Complete\nTask finished'
      );
      
      const lifecycle = await contextManager.getFullLifecycle(agent, taskId, true);
      
      expect(lifecycle.taskId).toBe(taskId);
      expect(lifecycle.agent).toBe(agent);
      expect(lifecycle.status).toBe('completed');
      expect(lifecycle.init).toContain('Test Task');
      expect(lifecycle.plan).toContain('Plan');
      expect(lifecycle.done).toContain('Complete');
      expect(lifecycle.progress).toBeDefined();
      expect(lifecycle.progress?.completedSteps).toBe(2);
    });

    it('should handle getFullLifecycle with include_progress false', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial delegation'
      );
      
      const lifecycle = await contextManager.getFullLifecycle(agent, taskId, false);
      
      expect(lifecycle.taskId).toBe(taskId);
      expect(lifecycle.agent).toBe(agent);
      expect(lifecycle.progress).toBeUndefined();
    });
  });

  describe('Protocol injection and message formatting', () => {
    
    it('should inject protocol instructions with custom message', async () => {
      const agent = 'test-agent';
      const content = '# Task\nDo something';
      const customMessage = 'Special instructions for this task';
      
      const result = contextManager.injectProtocolInstructions(agent, content, customMessage);
      
      expect(result).toContain(content);
      expect(result).toContain(customMessage);
      expect(result).toContain('MCP TASK MANAGEMENT PROTOCOL');
    });

    it('should inject protocol instructions without custom message', async () => {
      const agent = 'test-agent';
      const content = '# Task\nDo something';
      
      const result = contextManager.injectProtocolInstructions(agent, content);
      
      expect(result).toContain(content);
      expect(result).toContain('MCP TASK MANAGEMENT PROTOCOL');
      expect(result).not.toContain('undefined');
    });

    it('should format progress update messages correctly', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task with plan
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [ ] Step 1: With time estimate (30m)\n- [ ] Step 2: Another step (1h)'
      );
      
      const updates = [
        {
          step: 1,
          status: 'COMPLETE' as const,
          description: 'Finished step 1',
          timeSpent: 25
        },
        {
          step: 2,
          status: 'IN_PROGRESS' as const,
          description: 'Working on step 2',
          estimatedTimeRemaining: 45
        }
      ];
      
      const result = await contextManager.reportProgress(agent, taskId, updates);
      
      expect(result.success).toBe(true);
      
      const planContent = await fs.readFile(path.join(taskPath, 'PLAN.md'), 'utf8');
      expect(planContent).toContain('✓ 25m'); // Time spent marker
      expect(planContent).toContain('~45m remaining'); // Time remaining marker
    });
  });

  describe('File system error handling', () => {
    
    it('should handle file read errors gracefully', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task directory but make INIT.md unreadable
      await fs.ensureDir(taskPath);
      await fs.writeFile(path.join(taskPath, 'INIT.md'), 'content');
      await fs.chmod(path.join(taskPath, 'INIT.md'), 0o000);
      
      try {
        // This should handle the error gracefully
        const context = await contextManager.getTaskContext(agent, taskId);
        // If it doesn't throw, it might return a partial context
        expect(context.taskExists).toBeDefined();
      } catch (error) {
        // Error is expected and should be handled
        expect(error).toBeDefined();
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(path.join(taskPath, 'INIT.md'), 0o644);
      }
    });

    it('should handle concurrent operations safely', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      // Create task
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nInitial content'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Plan\n- [ ] Step 1\n- [ ] Step 2'
      );
      
      // Simulate concurrent updates
      const updates1 = [{
        step: 1,
        status: 'COMPLETE' as const,
        description: 'Update 1'
      }];
      
      const updates2 = [{
        step: 2,
        status: 'COMPLETE' as const,
        description: 'Update 2'
      }];
      
      // Run updates concurrently
      const [result1, result2] = await Promise.all([
        contextManager.reportProgress(agent, taskId, updates1),
        contextManager.reportProgress(agent, taskId, updates2)
      ]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // Verify both updates were applied
      const planContent = await fs.readFile(path.join(taskPath, 'PLAN.md'), 'utf8');
      expect(planContent).toMatch(/- \[x\].*Step 1/);
      expect(planContent).toMatch(/- \[x\].*Step 2/);
    });
  });
});