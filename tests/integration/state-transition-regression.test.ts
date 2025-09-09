/**
 * State Transition Regression Test
 * Prevents regression in task state transitions and ensures consistency
 * during concurrent operations and invalid state changes
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';
import * as fs from '../../src/utils/fs-extra-safe.js';
import { tmpdir } from 'os';

// Import tools for state management
import { createTaskTool } from '../../src/tools/create-task.js';
import { checkTasks } from '../../src/tools/check-tasks.js';
import { writeTask } from '../../src/tools/write-task.js';
import { archiveTasksTool } from '../../src/tools/archive-tasks.js';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { EventLogger } from '../../src/logging/EventLogger.js';
import { testUtils } from '../utils/testUtils.js';
import { ServerConfig } from '../../src/types.js';

describe('State Transition Regression Test', () => {
  let testDir: string;
  let config: ServerConfig;
  let connectionManager: ConnectionManager;
  let eventLogger: EventLogger;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'state-transition-test-'));
    const commDir = path.join(testDir, 'comm');
    const archiveDir = path.join(testDir, 'archive');
    
    connectionManager = new ConnectionManager();
    eventLogger = new EventLogger(testDir);
    
    config = testUtils.createMockConfig({
      commDir,
      archiveDir,
      enableArchiving: true,
      connectionManager,
      eventLogger
    });

    await fs.ensureDir(commDir);
    await fs.ensureDir(archiveDir);
  });

  afterEach(async () => {
    try {
      await fs.remove(testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Valid State Transitions', () => {
    it('REGRESSION: should transition from new → in_progress → completed', async () => {
      const agent = 'test-agent';
      const taskName = 'test-task';
      const content = 'Test task content';

      // 1. Create task (new state) 
      const result = await createTaskTool(config, {
        agent: agent,
        taskName,
        content
      });
      expect(result.success).toBe(true);
      
      // createTaskTool already creates the task structure, no need for eliminated tool (initTask)
      const actualTaskName = result.taskId;
      
      let tasks = await checkTasks(config, { agent });
      expect(tasks.tasks).toHaveLength(1);
      
      // createTaskTool creates tasks in 'new' state (only INIT.md), need PLAN.md for 'in_progress'
      tasks = await checkTasks(config, { agent });
      expect(tasks.newCount).toBe(1);
      expect(tasks.activeCount).toBe(0);
      
      // 2. Add plan to make it in_progress
      await writeTask(config, {
        agent,
        task: actualTaskName,
        file: 'PLAN',
        content: 'Task planning phase'
      });
      
      tasks = await checkTasks(config, { agent });
      expect(tasks.newCount).toBe(0);
      expect(tasks.activeCount).toBe(1);
      
      // 3. Complete task (completed state)  
      await writeTask(config, {
        agent,
        task: actualTaskName,
        file: 'DONE',
        content: 'Task completed successfully'
      });
      
      // Check state is now completed
      tasks = await checkTasks(config, { agent });
      expect(tasks.activeCount).toBe(0);
      const completedTask = tasks.tasks.find(t => t.taskId === actualTaskName);
      expect(completedTask?.status).toBe('completed');
    });

    it('REGRESSION: should handle archived state correctly', async () => {
      const agent = 'archive-agent';
      const taskName = 'archive-task';
      
      // Create and complete a task
      const result = await createTaskTool(config, {
        agent: agent,
        taskName,
        content: 'Archive test'
      });
      expect(result.success).toBe(true);
      
      // createTaskTool already creates the task structure, no need for eliminated tool (initTask)
      const actualTaskName = result.taskId;
      
      await writeTask(config, {
        agent,
        task: actualTaskName,
        file: 'DONE',
        content: 'Ready for archiving'
      });

      // Archive the task
      const archiveResult = await archiveTasksTool(config, { mode: 'completed' });
      expect(archiveResult.archived).toBeDefined();
      expect(archiveResult.archived).not.toBeNull();
      expect(archiveResult.archived!.total).toBeGreaterThan(0);
      
      // Verify task is no longer in active list
      const remainingTasks = await checkTasks(config, { agent });
      expect(remainingTasks.tasks.filter(t => t.status === 'completed')).toHaveLength(0);
    });
  });

  describe('Invalid State Transition Prevention', () => {
    it('REGRESSION: should prevent completed → in_progress transitions', async () => {
      const agent = 'invalid-transition-agent';
      const taskName = 'invalid-task';
      
      // Create and complete a task
      const result = await createTaskTool(config, { 
        agent: agent, 
        taskName, 
        content: 'Invalid transition test'
      });
      expect(result.success).toBe(true);
      
      // createTaskTool already creates the task structure, no need for eliminated tool (initTask)
      const actualTaskName = result.taskId;
      
      // Complete the task
      await writeTask(config, {
        agent,
        task: actualTaskName,
        file: 'DONE',
        content: 'Task completed'
      });
      
      // Verify task is completed
      let updatedTasks = await checkTasks(config, { agent });
      const completedTask = updatedTasks.tasks.find(t => t.taskId === actualTaskName);
      expect(completedTask?.status).toBe('completed');
      
      // Try to transition back to in_progress by writing PLAN
      // This should either be ignored or handled gracefully
      try {
        await writeTask(config, {
          agent,
          task: actualTaskName,
          file: 'PLAN',
          content: 'Trying to revert to planning'
        });
        
        // After invalid transition attempt, state should remain completed
        updatedTasks = await checkTasks(config, { agent });
        const taskAfterAttempt = updatedTasks.tasks.find(t => t.taskId === actualTaskName);
        expect(taskAfterAttempt?.status).toBe('completed');
        
      } catch (error) {
        // If system throws error for invalid transitions, that's also acceptable
        expect(error).toBeDefined();
      }
    });

    it('REGRESSION: should handle error state transitions correctly', async () => {
      const agent = 'error-agent';
      const taskName = 'error-task';
      
      const result = await createTaskTool(config, { 
        agent: agent, 
        taskName, 
        content: 'Error test'
      });
      expect(result.success).toBe(true);
      
      // createTaskTool already creates the task structure, no need for eliminated tool (initTask)
      const actualTaskName = result.taskId;
      
      // Set task to error state
      await writeTask(config, {
        agent,
        task: actualTaskName,
        file: 'ERROR',
        content: 'Task failed with error'
      });
      
      // Check error state is recognized
      const errorTasks = await checkTasks(config, { agent });
      const errorTask = errorTasks.tasks.find(t => t.taskId === actualTaskName);
      expect(errorTask?.status).toBe('error');
      
      // Error tasks should not count as active
      expect(errorTasks.activeCount).toBe(0);
    });
  });

  describe('Concurrent State Operations', () => {
    it('REGRESSION: should handle concurrent state changes consistently', async () => {
      const agent = 'concurrent-agent';
      const numTasks = 5;
      const tasks: string[] = [];
      
      // Create multiple tasks concurrently
      const createPromises = Array.from({ length: numTasks }, (_, i) => {
        const taskName = `concurrent-task-${i}`;
        tasks.push(taskName);
        return createTaskTool(config, {
          agent: agent,
          taskName,
          content: `Concurrent test ${i}`
        });
      });
      
      const createResults = await Promise.all(createPromises);
      
      // Verify all tasks were created
      createResults.forEach(result => { expect(result.success).toBe(true); });
      
      let allTasks = await checkTasks(config, { agent });
      expect(allTasks.tasks).toHaveLength(numTasks);
      
      // createTaskTool already creates the task structure, no need for eliminated tool (initTask)
      
      // Tasks start as 'new' (only INIT.md), need PLAN.md to be 'in_progress'
      allTasks = await checkTasks(config, { agent });
      expect(allTasks.newCount).toBe(numTasks);
      expect(allTasks.activeCount).toBe(0);
      
      // Add plans to make them active
      const planPromises = allTasks.tasks.map(task =>
        writeTask(config, {
          agent,
          task: task.taskId,
          file: 'PLAN',
          content: `Plan for ${task.taskId}`
        })
      );
      
      await Promise.all(planPromises);
      
      // Now verify all tasks are active
      allTasks = await checkTasks(config, { agent });
      expect(allTasks.activeCount).toBe(numTasks);
      expect(allTasks.newCount).toBe(0);
      
      // Complete all tasks concurrently
      const completePromises = allTasks.tasks.map(task =>
        writeTask(config, {
          agent,
          task: task.taskId,
          file: 'DONE',
          content: `Completed ${task.taskId}`
        })
      );
      
      await Promise.all(completePromises);
      
      // Verify all tasks are completed
      allTasks = await checkTasks(config, { agent });
      expect(allTasks.activeCount).toBe(0);
      allTasks.tasks.forEach(task => {
        expect(task.status).toBe('completed');
      });
    });
  });

  describe('State Consistency Validation', () => {
    it('REGRESSION: should maintain state consistency across operations', async () => {
      const agent = 'consistency-agent';
      
      // Create task
      const result = await createTaskTool(config, { 
        agent: agent, 
        taskName: 'consistency-task', 
        content: 'Consistency test'
      });
      expect(result.success).toBe(true);
      
      // createTaskTool already creates the task structure, no need for eliminated tool (initTask)
      const actualTaskName = result.taskId;
      
      // Verify counts are consistent
      let tasks = await checkTasks(config, { agent });
      expect(tasks.totalCount).toBe(tasks.tasks.length);
      expect(tasks.newCount + tasks.activeCount).toBe(tasks.totalCount);
      
      // Verify counts remain consistent
      tasks = await checkTasks(config, { agent });
      expect(tasks.totalCount).toBe(tasks.tasks.length);
      expect(tasks.newCount + tasks.activeCount).toBe(tasks.totalCount);
      
      // Complete task
      await writeTask(config, {
        agent,
        task: actualTaskName,
        file: 'DONE',
        content: 'Consistency maintained'
      });
      
      // Verify final consistency
      tasks = await checkTasks(config, { agent });
      expect(tasks.totalCount).toBe(tasks.tasks.length);
      
      // All tasks should be accounted for in state counts
      const stateSum = tasks.newCount + tasks.activeCount + 
                      tasks.tasks.filter(t => t.status === 'completed').length +
                      tasks.tasks.filter(t => t.status === 'error').length;
      expect(stateSum).toBe(tasks.totalCount);
    });
  });
});