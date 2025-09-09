/**
 * Test suite for flexible multi-task workflow support
 * Issue #25: Enable agents to work on multiple tasks simultaneously in any order
 * 
 * Requirements:
 * 1. Create multiple tasks before submitting any plans
 * 2. Submit plans to any task in any order
 * 3. Report progress on different tasks interchangeably
 * 4. Complete tasks in any sequence
 * 5. Switch current task context explicitly
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';
import { ConnectionManager, Connection } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import os from 'os';

describe('Multi-Task Workflow Support', () => {
  let contextManager: TaskContextManager;
  let connectionManager: ConnectionManager;
  let eventLogger: EventLogger;
  let testDir: string;
  let mockConnection: Connection;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-task-test-'));
    const commDir = path.join(testDir, 'comm');
    await fs.ensureDir(commDir);
    
    // Mock connection for session tracking
    mockConnection = {
      id: 'test-multi-task-123',
      agent: 'senior-backend-engineer',
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
    await fs.remove(testDir);
    jest.clearAllMocks();
  });

  describe('Multi-Task Creation', () => {
    it('should allow creating multiple tasks before submitting any plans', async () => {
      // Create three tasks in sequence
      const taskIds = ['task-alpha-001', 'task-beta-002', 'task-gamma-003'];
      
      for (const taskId of taskIds) {
        const agentDir = path.join(testDir, 'comm', mockConnection.agent);
        const taskDir = path.join(agentDir, taskId);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: ${taskId}\n## Objective\nTest task ${taskId}\n## Requirements\n- Requirement 1`
        );
      }
      
      // Verify all tasks are accessible
      const tasks = await contextManager.checkAssignedTasks(mockConnection);
      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.taskId)).toEqual(expect.arrayContaining(taskIds));
      
      // Verify each task has 'new' status (no plan submitted yet)
      for (const task of tasks) {
        expect(task.status).toBe('new');
      }
    });
    
    it('should maintain separate state for each task', async () => {
      // Create two tasks with different states
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      
      // Task 1: Has a plan
      const task1Dir = path.join(agentDir, 'task-001');
      await fs.ensureDir(task1Dir);
      await fs.writeFile(
        path.join(task1Dir, 'INIT.md'),
        '# Task: Task One\n## Objective\nFirst task'
      );
      await fs.writeFile(
        path.join(task1Dir, 'PLAN.md'),
        '# Implementation Plan\n- [ ] **Step 1**\n- [ ] **Step 2**'
      );
      
      // Task 2: New task without plan
      const task2Dir = path.join(agentDir, 'task-002');
      await fs.ensureDir(task2Dir);
      await fs.writeFile(
        path.join(task2Dir, 'INIT.md'),
        '# Task: Task Two\n## Objective\nSecond task'
      );
      
      // Verify states are independent
      const tasks = await contextManager.checkAssignedTasks(mockConnection);
      const task1 = tasks.find(t => t.taskId === 'task-001');
      const task2 = tasks.find(t => t.taskId === 'task-002');
      
      expect(task1?.status).toBe('in_progress');
      expect(task2?.status).toBe('new');
    });
  });

  describe('Any-Order Operations', () => {
    beforeEach(async () => {
      // Setup three tasks for testing
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      
      for (const taskId of ['task-A', 'task-B', 'task-C']) {
        const taskDir = path.join(agentDir, taskId);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: ${taskId}\n## Objective\nTest ${taskId}\n## Requirements\n- Test`
        );
      }
    });
    
    it('should submit plans to any task in any order', async () => {
      // Submit plan to task-B first (not A)
      const planB = '# Implementation Plan for Task B\n\n## Overview\nThis plan covers task B implementation.\n\n## Steps\n- [ ] **Step B1** - Initial setup and configuration\n- [ ] **Step B2** - Core implementation work';
      const connectionB = { ...mockConnection, metadata: { taskId: 'task-B' } };
      const resultB = await contextManager.submitPlan(planB, connectionB);
      expect(resultB.success).toBe(true);
      expect(resultB.stepsIdentified).toBe(2);
      
      // Submit plan to task-C
      const planC = '# Implementation Plan for Task C\n\n## Overview\nThis plan covers task C implementation.\n\n## Steps\n- [ ] **Step C1** - Complete implementation';
      const connectionC = { ...mockConnection, metadata: { taskId: 'task-C' } };
      const resultC = await contextManager.submitPlan(planC, connectionC);
      expect(resultC.success).toBe(true);
      expect(resultC.stepsIdentified).toBe(1);
      
      // Finally submit plan to task-A
      const planA = '# Implementation Plan for Task A\n\n## Overview\nThis plan covers task A implementation.\n\n## Steps\n- [ ] **Step A1** - First step\n- [ ] **Step A2** - Second step\n- [ ] **Step A3** - Third step';
      const connectionA = { ...mockConnection, metadata: { taskId: 'task-A' } };
      const resultA = await contextManager.submitPlan(planA, connectionA);
      expect(resultA.success).toBe(true);
      expect(resultA.stepsIdentified).toBe(3);
      
      // Verify all plans were saved correctly
      const planBContent = await fs.readFile(path.join(testDir, 'comm', mockConnection.agent, 'task-B', 'PLAN.md'), 'utf8');
      expect(planBContent).toContain('Step B1');
      
      const planCContent = await fs.readFile(path.join(testDir, 'comm', mockConnection.agent, 'task-C', 'PLAN.md'), 'utf8');
      expect(planCContent).toContain('Step C1');
      
      const planAContent = await fs.readFile(path.join(testDir, 'comm', mockConnection.agent, 'task-A', 'PLAN.md'), 'utf8');
      expect(planAContent).toContain('Step A1');
    });
    
    it('should report progress on different tasks interchangeably', async () => {
      // Submit plans to all tasks first
      for (const taskId of ['task-A', 'task-B', 'task-C']) {
        const plan = `# Implementation Plan for ${taskId}\n\n## Overview\nThis is the implementation plan for ${taskId}.\n\n## Steps\n- [ ] **Step 1** - First implementation step\n- [ ] **Step 2** - Second implementation step`;
        const connection = { ...mockConnection, metadata: { taskId } };
        await contextManager.submitPlan(plan, connection);
      }
      
      // Report progress on task-B first
      const updateB1 = await contextManager.reportProgress(
        [{ step: 1, status: 'IN_PROGRESS', description: 'Working on B' }],
        { ...mockConnection, metadata: { taskId: 'task-B' } }
      );
      expect(updateB1.success).toBe(true);
      
      // Report progress on task-A
      const updateA1 = await contextManager.reportProgress(
        [{ step: 1, status: 'COMPLETE', description: 'Completed A step 1' }],
        { ...mockConnection, metadata: { taskId: 'task-A' } }
      );
      expect(updateA1.success).toBe(true);
      
      // Report more progress on task-B
      const updateB2 = await contextManager.reportProgress(
        [{ step: 1, status: 'COMPLETE', description: 'Completed B step 1' }],
        { ...mockConnection, metadata: { taskId: 'task-B' } }
      );
      expect(updateB2.success).toBe(true);
      
      // Report progress on task-C
      const updateC1 = await contextManager.reportProgress(
        [{ step: 1, status: 'IN_PROGRESS', description: 'Working on C' }],
        { ...mockConnection, metadata: { taskId: 'task-C' } }
      );
      expect(updateC1.success).toBe(true);
      
      // Verify progress is tracked independently
      expect(updateA1.summary.completed).toBe(1);
      expect(updateB2.summary.completed).toBe(1);
      expect(updateC1.summary.inProgress).toBe(1);
    });
    
    it('should complete tasks in any sequence', async () => {
      // Submit plans to all tasks
      for (const taskId of ['task-A', 'task-B', 'task-C']) {
        const plan = `# Implementation Plan for ${taskId}\n\n## Overview\nThis is the implementation plan for ${taskId}.\n\n## Steps\n- [x] **Step 1** - First step completed\n- [x] **Step 2** - Second step completed`;
        const connection = { ...mockConnection, metadata: { taskId } };
        await contextManager.submitPlan(plan, connection);
      }
      
      // Complete task-C first
      const completeC = await contextManager.markComplete(
        'DONE',
        '# Task C Completed\nSuccessfully completed task C',
        { ...mockConnection, metadata: { taskId: 'task-C' } }
      );
      expect(completeC.success).toBe(true);
      expect(completeC.status).toBe('DONE');
      
      // Complete task-A
      const completeA = await contextManager.markComplete(
        'DONE',
        '# Task A Completed\nSuccessfully completed task A',
        { ...mockConnection, metadata: { taskId: 'task-A' } }
      );
      expect(completeA.success).toBe(true);
      expect(completeA.status).toBe('DONE');
      
      // Complete task-B with error
      const completeB = await contextManager.markComplete(
        'ERROR',
        '# Task B Error\nFailed to complete task B\n## Recommendations\n- Retry with different approach',
        { ...mockConnection, metadata: { taskId: 'task-B' } }
      );
      expect(completeB.success).toBe(true);
      expect(completeB.status).toBe('ERROR');
      expect(completeB.isError).toBe(true);
      
      // Verify completion files
      const doneC = await fs.pathExists(path.join(testDir, 'comm', mockConnection.agent, 'task-C', 'DONE.md'));
      const doneA = await fs.pathExists(path.join(testDir, 'comm', mockConnection.agent, 'task-A', 'DONE.md'));
      const errorB = await fs.pathExists(path.join(testDir, 'comm', mockConnection.agent, 'task-B', 'ERROR.md'));
      
      expect(doneC).toBe(true);
      expect(doneA).toBe(true);
      expect(errorB).toBe(true);
    });
  });

  describe('Task Switching', () => {
    beforeEach(async () => {
      // Setup multiple tasks
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      
      for (const taskId of ['switch-task-1', 'switch-task-2', 'switch-task-3']) {
        const taskDir = path.join(agentDir, taskId);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: ${taskId}\n## Objective\nSwitch test ${taskId}`
        );
      }
    });
    
    it('should support explicit current task setting', async () => {
      // Set current task to switch-task-2
      const success = await contextManager.setCurrentTask('switch-task-2', mockConnection);
      expect(success).toBe(true);
      
      // Get current task
      const currentTask = contextManager.getCurrentTask(mockConnection);
      expect(currentTask).toBe('switch-task-2');
      
      // Operations without taskId should use current task
      const plan = '# Current Task Implementation Plan\n\n## Overview\nThis plan should go to the current task.\n\n## Steps\n- [ ] **Step 1** - First implementation step';
      const result = await contextManager.submitPlan(plan, mockConnection);
      expect(result.success).toBe(true);
      
      // Verify plan was saved to current task
      const planPath = path.join(testDir, 'comm', mockConnection.agent, 'switch-task-2', 'PLAN.md');
      const planExists = await fs.pathExists(planPath);
      expect(planExists).toBe(true);
    });
    
    it('should maintain current task across operations', async () => {
      // Set current task
      await contextManager.setCurrentTask('switch-task-1', mockConnection);
      
      // Submit plan (should go to current task)
      await contextManager.submitPlan('# Implementation Plan\n\n## Overview\nThis plan tests current task persistence.\n\n## Steps\n- [ ] **Step 1** - First implementation step', mockConnection);
      
      // Report progress (should apply to current task)
      const progress = await contextManager.reportProgress(
        [{ step: 1, status: 'IN_PROGRESS', description: 'Working' }],
        mockConnection
      );
      expect(progress.success).toBe(true);
      
      // Switch to different task
      await contextManager.setCurrentTask('switch-task-3', mockConnection);
      
      // Submit plan to new current task
      await contextManager.submitPlan('# Different Implementation Plan\n\n## Overview\nThis is a different plan for a different task.\n\n## Steps\n- [ ] **Different Step** - A different implementation step', mockConnection);
      
      // Verify plans are in correct tasks
      const plan1 = await fs.readFile(
        path.join(testDir, 'comm', mockConnection.agent, 'switch-task-1', 'PLAN.md'),
        'utf8'
      );
      expect(plan1).toContain('Step 1');
      
      const plan3 = await fs.readFile(
        path.join(testDir, 'comm', mockConnection.agent, 'switch-task-3', 'PLAN.md'),
        'utf8'
      );
      expect(plan3).toContain('Different Step');
    });
    
    it('should allow switching back to previous tasks', async () => {
      // Work on task 1
      await contextManager.setCurrentTask('switch-task-1', mockConnection);
      await contextManager.submitPlan('# Implementation Plan 1\n\n## Overview\nThis is the plan for task 1.\n\n## Steps\n- [ ] **Task 1 Step** - Implementation step for task 1', mockConnection);
      
      // Switch to task 2
      await contextManager.setCurrentTask('switch-task-2', mockConnection);
      await contextManager.submitPlan('# Implementation Plan 2\n\n## Overview\nThis is the plan for task 2.\n\n## Steps\n- [ ] **Task 2 Step** - Implementation step for task 2', mockConnection);
      
      // Switch back to task 1
      await contextManager.setCurrentTask('switch-task-1', mockConnection);
      const currentTask = contextManager.getCurrentTask(mockConnection);
      expect(currentTask).toBe('switch-task-1');
      
      // Continue working on task 1
      const progress = await contextManager.reportProgress(
        [{ step: 1, status: 'COMPLETE', description: 'Finished task 1 step' }],
        mockConnection
      );
      expect(progress.success).toBe(true);
      
      // Verify progress was applied to task 1
      const plan1 = await fs.readFile(
        path.join(testDir, 'comm', mockConnection.agent, 'switch-task-1', 'PLAN.md'),
        'utf8'
      );
      expect(plan1).toContain('[x]'); // Checkbox should be checked
    });
  });

  describe('Multi-Task State Management', () => {
    it('should track multiple active tasks per agent', async () => {
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      
      // Create tasks in different states
      const task1Dir = path.join(agentDir, 'state-task-1');
      await fs.ensureDir(task1Dir);
      await fs.writeFile(path.join(task1Dir, 'INIT.md'), '# Task 1');
      
      const task2Dir = path.join(agentDir, 'state-task-2');
      await fs.ensureDir(task2Dir);
      await fs.writeFile(path.join(task2Dir, 'INIT.md'), '# Task 2');
      await fs.writeFile(path.join(task2Dir, 'PLAN.md'), '# Plan 2');
      
      const task3Dir = path.join(agentDir, 'state-task-3');
      await fs.ensureDir(task3Dir);
      await fs.writeFile(path.join(task3Dir, 'INIT.md'), '# Task 3');
      await fs.writeFile(path.join(task3Dir, 'PLAN.md'), '# Plan 3');
      await fs.writeFile(path.join(task3Dir, 'DONE.md'), '# Done 3');
      
      // Get multi-task state
      const multiTaskState = await contextManager.getMultiTaskState(mockConnection);
      
      expect(multiTaskState).toBeDefined();
      expect(multiTaskState.agent).toBe(mockConnection.agent);
      expect(multiTaskState.tasks).toHaveLength(3);
      expect(multiTaskState.activeTasks).toHaveLength(1); // Only task-2 is active (has plan, no completion)
      expect(multiTaskState.currentTask).toBeNull(); // No current task set yet
      
      // Verify task states
      const task1State = multiTaskState.tasks.find(t => t.taskId === 'state-task-1');
      expect(task1State?.status).toBe('new');
      
      const task2State = multiTaskState.tasks.find(t => t.taskId === 'state-task-2');
      expect(task2State?.status).toBe('in_progress');
      
      const task3State = multiTaskState.tasks.find(t => t.taskId === 'state-task-3');
      expect(task3State?.status).toBe('completed');
    });
    
    it('should persist current task selection across connections', async () => {
      // Create the task first
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      const taskDir = path.join(agentDir, 'switch-task-1');
      await fs.ensureDir(taskDir);
      await fs.writeFile(path.join(taskDir, 'INIT.md'), '# Switch Task 1');
      
      // Set current task
      await contextManager.setCurrentTask('switch-task-1', mockConnection);
      
      // Create new connection (simulating reconnect)
      const newConnection: Connection = {
        id: 'new-connection-456',
        agent: mockConnection.agent,
        startTime: new Date(),
        metadata: {}
      };
      connectionManager.register(newConnection);
      
      // Current task should persist for the agent
      const currentTask = contextManager.getCurrentTask(newConnection);
      expect(currentTask).toBe('switch-task-1');
    });
  });

  describe('Validation and Error Handling', () => {
    it('should prevent operations on non-existent tasks when taskId is specified', async () => {
      const connection = { ...mockConnection, metadata: { taskId: 'non-existent-task' } };
      
      await expect(contextManager.submitPlan('# Implementation Plan\n\n## Overview\nThis plan should fail because the task does not exist.\n\n## Steps\n- [ ] **Step 1** - This should not be saved', connection))
        .rejects.toThrow('not found');
    });
    
    it('should prevent cross-task contamination', async () => {
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      
      // Create two tasks
      for (const taskId of ['isolated-1', 'isolated-2']) {
        const taskDir = path.join(agentDir, taskId);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: ${taskId}`
        );
        await fs.writeFile(
          path.join(taskDir, 'PLAN.md'),
          `# Plan ${taskId}\n- [ ] **Step for ${taskId}**`
        );
      }
      
      // Set current task to isolated-1
      await contextManager.setCurrentTask('isolated-1', mockConnection);
      
      // Report progress (should only affect isolated-1)
      await contextManager.reportProgress(
        [{ step: 1, status: 'COMPLETE', description: 'Done' }],
        mockConnection
      );
      
      // Check that isolated-1 was updated
      const plan1 = await fs.readFile(
        path.join(agentDir, 'isolated-1', 'PLAN.md'),
        'utf8'
      );
      expect(plan1).toContain('[x]');
      
      // Check that isolated-2 was NOT updated
      const plan2 = await fs.readFile(
        path.join(agentDir, 'isolated-2', 'PLAN.md'),
        'utf8'
      );
      expect(plan2).toContain('[ ]');
      expect(plan2).not.toContain('[x]');
    });
    
    it('should handle rapid task switching correctly', async () => {
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      
      // Create tasks
      for (const taskId of ['rapid-1', 'rapid-2', 'rapid-3']) {
        const taskDir = path.join(agentDir, taskId);
        await fs.ensureDir(taskDir);
        await fs.writeFile(path.join(taskDir, 'INIT.md'), `# ${taskId}`);
      }
      
      // Rapidly switch between tasks
      await contextManager.setCurrentTask('rapid-1', mockConnection);
      await contextManager.setCurrentTask('rapid-2', mockConnection);
      await contextManager.setCurrentTask('rapid-3', mockConnection);
      await contextManager.setCurrentTask('rapid-1', mockConnection);
      
      // Current task should be the last one set
      const currentTask = contextManager.getCurrentTask(mockConnection);
      expect(currentTask).toBe('rapid-1');
      
      // Submit plan should go to current task
      await contextManager.submitPlan('# Rapid Task Implementation Plan\n\n## Overview\nThis plan tests rapid task switching.\n\n## Steps\n- [ ] **Step 1** - Testing rapid switching', mockConnection);
      
      const planExists = await fs.pathExists(
        path.join(agentDir, 'rapid-1', 'PLAN.md')
      );
      expect(planExists).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility with single-task workflow', async () => {
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      
      // Create a single task (traditional workflow)
      const taskDir = path.join(agentDir, 'legacy-task');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        '# Legacy Task\n## Objective\nTest backward compatibility'
      );
      
      // Operations without taskId should work (use most recent task)
      const plan = '# Legacy Implementation Plan\n\n## Overview\nThis plan tests backward compatibility with single-task workflow.\n\n## Steps\n- [ ] **Legacy Step** - Legacy implementation step';
      const planResult = await contextManager.submitPlan(plan, mockConnection);
      expect(planResult.success).toBe(true);
      
      // Progress without taskId should work
      const progressResult = await contextManager.reportProgress(
        [{ step: 1, status: 'IN_PROGRESS', description: 'Working on legacy' }],
        mockConnection
      );
      expect(progressResult.success).toBe(true);
      
      // Complete without taskId should work
      const completeResult = await contextManager.markComplete(
        'DONE',
        '# Legacy Complete',
        mockConnection
      );
      expect(completeResult.success).toBe(true);
      
      // Verify all operations affected the single task
      const planExists = await fs.pathExists(path.join(taskDir, 'PLAN.md'));
      const doneExists = await fs.pathExists(path.join(taskDir, 'DONE.md'));
      
      expect(planExists).toBe(true);
      expect(doneExists).toBe(true);
    });
    
    it('should handle mixed workflows (some with taskId, some without)', async () => {
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      
      // Create first task
      const task1Dir = path.join(agentDir, 'mixed-1');
      await fs.ensureDir(task1Dir);
      await fs.writeFile(path.join(task1Dir, 'INIT.md'), '# mixed-1');
      
      // Wait a bit then create second task to ensure it's more recent
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const task2Dir = path.join(agentDir, 'mixed-2');
      await fs.ensureDir(task2Dir);
      await fs.writeFile(path.join(task2Dir, 'INIT.md'), '# mixed-2');
      
      // Operation with explicit taskId
      const explicitResult = await contextManager.submitPlan(
        '# Explicit Implementation Plan\n\n## Overview\nThis plan has an explicit taskId.\n\n## Steps\n- [ ] **Step 1** - Explicit task step',
        { ...mockConnection, metadata: { taskId: 'mixed-1' } }
      );
      expect(explicitResult.success).toBe(true);
      
      // Check which task would be used without taskId  
      const tasks = await contextManager.checkAssignedTasks(mockConnection);
      const taskDates = [];
      for (const task of tasks) {
        const taskPath = path.join(agentDir, task.taskId);
        const stat = await fs.stat(taskPath);
        taskDates.push({ taskId: task.taskId, mtime: stat.mtime });
      }
      // Sort by modification time to find most recent
      taskDates.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // The most recent should be mixed-2 (or possibly mixed-1 if it was modified by the plan)
      // Since mixed-1 just had a plan written to it, it might now be the most recent
      // So let's set current task explicitly for this test
      await contextManager.setCurrentTask('mixed-2', mockConnection);
      
      // Operation without taskId (should now use current task = mixed-2)
      const implicitResult = await contextManager.submitPlan(
        '# Implicit Implementation Plan\n\n## Overview\nThis plan has no explicit taskId.\n\n## Steps\n- [ ] **Step 1** - Implicit task step',
        mockConnection
      );
      expect(implicitResult.success).toBe(true);
      
      // Verify correct task targeting
      const plan1Path = path.join(agentDir, 'mixed-1', 'PLAN.md');
      const plan2Path = path.join(agentDir, 'mixed-2', 'PLAN.md');
      
      // Check that plans exist
      expect(await fs.pathExists(plan1Path)).toBe(true);
      expect(await fs.pathExists(plan2Path)).toBe(true);
      
      const plan1 = await fs.readFile(plan1Path, 'utf8');
      const plan2 = await fs.readFile(plan2Path, 'utf8');
      
      expect(plan1).toContain('Explicit Implementation Plan');
      expect(plan2).toContain('Implicit Implementation Plan');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle many tasks efficiently', async () => {
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      const taskCount = 20;
      
      // Create many tasks
      const startCreate = Date.now();
      for (let i = 0; i < taskCount; i++) {
        const taskDir = path.join(agentDir, `perf-task-${i.toString().padStart(3, '0')}`);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task ${i}\n## Objective\nPerformance test task ${i}`
        );
      }
      const createTime = Date.now() - startCreate;
      
      // Check all tasks
      const startCheck = Date.now();
      const tasks = await contextManager.checkAssignedTasks(mockConnection);
      const checkTime = Date.now() - startCheck;
      
      expect(tasks).toHaveLength(taskCount);
      
      // Performance assertions (reasonable times for 20 tasks)
      expect(createTime).toBeLessThan(1000); // Creating 20 tasks < 1 second
      expect(checkTime).toBeLessThan(100); // Checking 20 tasks < 100ms
      
      // Test rapid task switching
      const startSwitch = Date.now();
      for (let i = 0; i < 10; i++) {
        const taskId = `perf-task-${(i % taskCount).toString().padStart(3, '0')}`;
        await contextManager.setCurrentTask(taskId, mockConnection);
      }
      const switchTime = Date.now() - startSwitch;
      
      expect(switchTime).toBeLessThan(100); // 10 switches < 100ms
    });
    
    it('should maintain performance with multiple agents working on multiple tasks', async () => {
      // Create multiple agents with multiple tasks each
      const agents = ['frontend-dev', 'backend-dev', 'qa-engineer'];
      const tasksPerAgent = 5;
      
      for (const agent of agents) {
        const agentConnection: Connection = {
          id: `conn-${agent}`,
          agent,
          startTime: new Date(),
          metadata: {}
        };
        connectionManager.register(agentConnection);
        
        const agentDir = path.join(testDir, 'comm', agent);
        for (let i = 0; i < tasksPerAgent; i++) {
          const taskDir = path.join(agentDir, `task-${i}`);
          await fs.ensureDir(taskDir);
          await fs.writeFile(path.join(taskDir, 'INIT.md'), `# Task ${i} for ${agent}`);
        }
      }
      
      // Each agent checks their tasks
      const connections: Connection[] = [];
      for (const agent of agents) {
        const conn = { 
          id: `conn-${agent}`, 
          agent, 
          startTime: new Date(), 
          metadata: {} 
        };
        connections.push(conn);
      }
      
      const checkPromises = connections.map(conn => 
        contextManager.checkAssignedTasks(conn)
      );
      
      const results = await Promise.all(checkPromises);
      
      // Verify each agent sees only their tasks
      for (const [index, tasks] of results.entries()) {
        expect(tasks).toHaveLength(tasksPerAgent);
        // All tasks should belong to the correct agent
        const agent = agents[index];
        const agentConn = connections[index];
        for (const task of tasks) {
          const taskContext = await contextManager.getTaskContext(task.taskId, agentConn);
          expect(taskContext.currentAgent).toBe(agent);
        }
      }
    });
  });
});