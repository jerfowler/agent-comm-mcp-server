/**
 * Integration tests for flexible multi-task workflow support
 * Tests end-to-end scenarios with multiple tasks and agents
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { EventLogger } from '../../src/logging/EventLogger.js';
import { TaskContextManager } from '../../src/core/TaskContextManager.js';
import fs from '../../src/utils/fs-extra-safe.js';
import path from 'path';
import os from 'os';

describe('Flexible Workflow Integration', () => {
  let testDir: string;
  let commDir: string;
  let connectionManager: ConnectionManager;
  let eventLogger: EventLogger;
  let contextManager: TaskContextManager;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flex-workflow-test-'));
    commDir = path.join(testDir, 'comm');
    const logDir = path.join(testDir, 'logs');

    await fs.ensureDir(commDir);
    await fs.ensureDir(logDir);
    
    // Get access to internal components for testing
    connectionManager = new ConnectionManager();
    eventLogger = new EventLogger(logDir);
    contextManager = new TaskContextManager({
      commDir,
      connectionManager,
      eventLogger
    });
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('Complete Multi-Task Workflow', () => {
    it('should handle complete workflow with multiple tasks across agents', async () => {
      // Simulate multiple agents working on different tasks
      const agents = [
        { name: 'frontend-engineer', tasks: ['ui-redesign', 'performance-optimization'] },
        { name: 'backend-engineer', tasks: ['api-refactor', 'database-migration', 'caching-layer'] },
        { name: 'qa-engineer', tasks: ['test-automation', 'regression-suite'] }
      ];

      // Phase 1: Create all tasks
      for (const agent of agents) {
        const agentDir = path.join(commDir, agent.name);
        await fs.ensureDir(agentDir);
        
        for (const taskName of agent.tasks) {
          const taskDir = path.join(agentDir, taskName);
          await fs.ensureDir(taskDir);
          await fs.writeFile(
            path.join(taskDir, 'INIT.md'),
            `# Task: ${taskName}\n## Objective\nImplement ${taskName}\n## Requirements\n- Complete ${taskName} implementation\n- Ensure quality standards`
          );
        }
      }

      // Phase 2: Submit plans in non-sequential order
      const planSubmissions = [
        { agent: 'backend-engineer', task: 'database-migration', plan: '# Database Migration\n- [ ] **Schema changes**\n- [ ] **Data migration**\n- [ ] **Rollback plan**' },
        { agent: 'frontend-engineer', task: 'ui-redesign', plan: '# UI Redesign\n- [ ] **Wireframes**\n- [ ] **Component implementation**' },
        { agent: 'qa-engineer', task: 'test-automation', plan: '# Test Automation\n- [ ] **Framework setup**\n- [ ] **Test cases**' },
        { agent: 'backend-engineer', task: 'api-refactor', plan: '# API Refactor\n- [ ] **Endpoint design**\n- [ ] **Implementation**' },
        { agent: 'frontend-engineer', task: 'performance-optimization', plan: '# Performance\n- [ ] **Profiling**\n- [ ] **Optimization**' }
      ];

      for (const submission of planSubmissions) {
        const connection = {
          id: `conn-${submission.agent}-${Date.now()}`,
          agent: submission.agent,
          startTime: new Date(),
          metadata: { taskId: submission.task }
        };
        connectionManager.register(connection);
        
        const result = await contextManager.submitPlan(submission.plan, connection);
        expect(result.success).toBe(true);
      }

      // Phase 3: Report progress interchangeably
      const progressReports = [
        { agent: 'backend-engineer', task: 'database-migration', step: 1, status: 'IN_PROGRESS' as const },
        { agent: 'frontend-engineer', task: 'ui-redesign', step: 1, status: 'COMPLETE' as const },
        { agent: 'backend-engineer', task: 'api-refactor', step: 1, status: 'IN_PROGRESS' as const },
        { agent: 'backend-engineer', task: 'database-migration', step: 1, status: 'COMPLETE' as const },
        { agent: 'qa-engineer', task: 'test-automation', step: 1, status: 'COMPLETE' as const },
        { agent: 'frontend-engineer', task: 'ui-redesign', step: 2, status: 'IN_PROGRESS' as const },
        { agent: 'backend-engineer', task: 'database-migration', step: 2, status: 'IN_PROGRESS' as const }
      ];

      for (const report of progressReports) {
        const connectionId = `conn-${report.agent}-progress`;
        let connection = connectionManager.getConnection(connectionId);
        if (!connection) {
          connection = {
            id: connectionId,
            agent: report.agent,
            startTime: new Date(),
            metadata: { taskId: report.task }
          };
          connectionManager.register(connection);
        }
        
        // Update metadata for task targeting
        connection.metadata = { taskId: report.task };
        
        const result = await contextManager.reportProgress(
          [{ step: report.step, status: report.status, description: `${report.status} for ${report.task}` }],
          connection
        );
        expect(result.success).toBe(true);
      }

      // Phase 4: Complete tasks in arbitrary order
      const completions = [
        { agent: 'qa-engineer', task: 'test-automation', status: 'DONE' as const },
        { agent: 'backend-engineer', task: 'database-migration', status: 'DONE' as const },
        { agent: 'frontend-engineer', task: 'ui-redesign', status: 'DONE' as const },
        { agent: 'backend-engineer', task: 'api-refactor', status: 'ERROR' as const }
      ];

      for (const completion of completions) {
        const connectionId = `conn-${completion.agent}-complete`;
        let connection = connectionManager.getConnection(connectionId);
        if (!connection) {
          connection = {
            id: connectionId,
            agent: completion.agent,
            startTime: new Date(),
            metadata: { taskId: completion.task }
          };
          connectionManager.register(connection);
        }
        
        connection.metadata = { taskId: completion.task };
        
        const summary = completion.status === 'DONE'
          ? `# Completed ${completion.task}\nSuccessfully implemented ${completion.task}`
          : `# Error in ${completion.task}\nFailed to complete ${completion.task}`;
        
        const result = await contextManager.markComplete(completion.status, summary, connection);
        expect(result.success).toBe(true);
        expect(result.status).toBe(completion.status);
      }

      // Verify final state
      for (const agent of agents) {
        const connectionId = `verify-${agent.name}`;
        let connection = connectionManager.getConnection(connectionId);
        if (!connection) {
          connection = {
            id: connectionId,
            agent: agent.name,
            startTime: new Date(),
            metadata: {}
          };
          connectionManager.register(connection);
        }
        
        const tasks = await contextManager.checkAssignedTasks(connection);
        
        // Verify all tasks exist
        expect(tasks.map(t => t.taskId).sort()).toEqual(agent.tasks.sort());
        
        // Check completion status
        for (const task of tasks) {
          const completion = completions.find(c => c.agent === agent.name && c.task === task.taskId);
          if (completion) {
            expect(task.status).toBe(completion.status === 'DONE' ? 'completed' : 'error');
          }
        }
      }
    });
  });

  describe('Task Switching Scenarios', () => {
    it('should handle complex task switching patterns', async () => {
      const agent = 'senior-developer';
      const tasks = ['feature-A', 'bugfix-B', 'refactor-C'];
      
      // Create agent connection
      const connection = {
        id: 'switch-test-conn',
        agent,
        startTime: new Date(),
        metadata: {}
      };
      connectionManager.register(connection);
      
      // Create all tasks
      const agentDir = path.join(commDir, agent);
      for (const task of tasks) {
        const taskDir = path.join(agentDir, task);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: ${task}\n## Objective\nWork on ${task}`
        );
      }
      
      // Scenario: Developer switches between tasks based on priorities
      
      // Start with feature-A
      await contextManager.setCurrentTask('feature-A', connection);
      await contextManager.submitPlan('# Feature A\n- [ ] **Design**\n- [ ] **Implement**', connection);
      
      // Urgent bugfix comes in - switch to bugfix-B
      await contextManager.setCurrentTask('bugfix-B', connection);
      await contextManager.submitPlan('# Bugfix B\n- [ ] **Diagnose**\n- [ ] **Fix**', connection);
      await contextManager.reportProgress(
        [{ step: 1, status: 'COMPLETE', description: 'Diagnosed issue' }],
        connection
      );
      
      // Back to feature-A for a quick update
      await contextManager.setCurrentTask('feature-A', connection);
      await contextManager.reportProgress(
        [{ step: 1, status: 'IN_PROGRESS', description: 'Working on design' }],
        connection
      );
      
      // Complete bugfix-B
      await contextManager.setCurrentTask('bugfix-B', connection);
      await contextManager.reportProgress(
        [{ step: 2, status: 'COMPLETE', description: 'Fixed issue' }],
        connection
      );
      await contextManager.markComplete('DONE', '# Bugfix Complete', connection);
      
      // Start refactor-C while feature-A is still in progress
      await contextManager.setCurrentTask('refactor-C', connection);
      await contextManager.submitPlan('# Refactor C\n- [ ] **Analysis**\n- [ ] **Refactor**', connection);
      
      // Verify states
      const taskStates = await contextManager.checkAssignedTasks(connection);
      
      const featureA = taskStates.find(t => t.taskId === 'feature-A');
      expect(featureA?.status).toBe('in_progress');
      
      const bugfixB = taskStates.find(t => t.taskId === 'bugfix-B');
      expect(bugfixB?.status).toBe('completed');
      
      const refactorC = taskStates.find(t => t.taskId === 'refactor-C');
      expect(refactorC?.status).toBe('in_progress');
      
      // Verify current task
      const currentTask = contextManager.getCurrentTask(connection);
      expect(currentTask).toBe('refactor-C');
    });
  });

  describe('Cross-Agent Collaboration', () => {
    it('should support multiple agents working on related tasks', async () => {
      // Scenario: Frontend and backend engineers collaborating on a feature
      const frontendConn = {
        id: 'frontend-conn',
        agent: 'frontend-engineer',
        startTime: new Date(),
        metadata: {}
      };
      
      const backendConn = {
        id: 'backend-conn',
        agent: 'backend-engineer',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(frontendConn);
      connectionManager.register(backendConn);
      
      // Frontend tasks
      const frontendTasks = ['ui-components', 'state-management'];
      const frontendDir = path.join(commDir, 'frontend-engineer');
      
      for (const task of frontendTasks) {
        const taskDir = path.join(frontendDir, task);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: ${task}\n## Objective\nImplement ${task}`
        );
      }
      
      // Backend tasks
      const backendTasks = ['api-endpoints', 'data-models'];
      const backendDir = path.join(commDir, 'backend-engineer');
      
      for (const task of backendTasks) {
        const taskDir = path.join(backendDir, task);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: ${task}\n## Objective\nImplement ${task}`
        );
      }
      
      // Both work simultaneously on different tasks
      await Promise.all([
        // Frontend work
        (async () => {
          await contextManager.setCurrentTask('ui-components', frontendConn);
          await contextManager.submitPlan('# UI Components\n- [ ] **Header**\n- [ ] **Footer**', frontendConn);
          await contextManager.reportProgress(
            [{ step: 1, status: 'IN_PROGRESS', description: 'Building header' }],
            frontendConn
          );
        })(),
        
        // Backend work
        (async () => {
          await contextManager.setCurrentTask('api-endpoints', backendConn);
          await contextManager.submitPlan('# API Endpoints\n- [ ] **GET /users**\n- [ ] **POST /users**', backendConn);
          await contextManager.reportProgress(
            [{ step: 1, status: 'COMPLETE', description: 'GET endpoint done' }],
            backendConn
          );
        })()
      ]);
      
      // Frontend switches to state management
      await contextManager.setCurrentTask('state-management', frontendConn);
      await contextManager.submitPlan('# State Management\n- [ ] **Redux setup**\n- [ ] **Actions**', frontendConn);
      
      // Backend switches to data models
      await contextManager.setCurrentTask('data-models', backendConn);
      await contextManager.submitPlan('# Data Models\n- [ ] **User model**\n- [ ] **Product model**', backendConn);
      
      // Verify each agent has their own tasks and states
      const frontendTaskList = await contextManager.checkAssignedTasks(frontendConn);
      const backendTaskList = await contextManager.checkAssignedTasks(backendConn);
      
      expect(frontendTaskList).toHaveLength(2);
      expect(backendTaskList).toHaveLength(2);
      
      // Verify no cross-contamination
      expect(frontendTaskList.every(t => ['ui-components', 'state-management'].includes(t.taskId))).toBe(true);
      expect(backendTaskList.every(t => ['api-endpoints', 'data-models'].includes(t.taskId))).toBe(true);
      
      // Verify current tasks
      const frontendCurrent = contextManager.getCurrentTask(frontendConn);
      const backendCurrent = contextManager.getCurrentTask(backendConn);
      
      expect(frontendCurrent).toBe('state-management');
      expect(backendCurrent).toBe('data-models');
    });
  });

  describe('Error Recovery', () => {
    it('should handle task switching after errors gracefully', async () => {
      const connection = {
        id: 'error-test-conn',
        agent: 'developer',
        startTime: new Date(),
        metadata: {}
      };
      connectionManager.register(connection);
      
      const agentDir = path.join(commDir, 'developer');
      
      // Create tasks
      for (const task of ['task-good', 'task-bad', 'task-recovery']) {
        const taskDir = path.join(agentDir, task);
        await fs.ensureDir(taskDir);
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: ${task}`
        );
      }
      
      // Work on good task
      await contextManager.setCurrentTask('task-good', connection);
      await contextManager.submitPlan('# Good Plan\n- [ ] **Step 1**', connection);
      
      // Switch to bad task and encounter error
      await contextManager.setCurrentTask('task-bad', connection);
      await contextManager.submitPlan('# Bad Plan\n- [ ] **Problematic step**', connection);
      await contextManager.markComplete('ERROR', '# Error\nSomething went wrong', connection);
      
      // Should be able to switch to recovery task
      await contextManager.setCurrentTask('task-recovery', connection);
      await contextManager.submitPlan('# Recovery Plan\n- [ ] **Fix issues**', connection);
      
      // Can still go back to good task
      await contextManager.setCurrentTask('task-good', connection);
      await contextManager.reportProgress(
        [{ step: 1, status: 'COMPLETE', description: 'Completed step 1' }],
        connection
      );
      await contextManager.markComplete('DONE', '# Success', connection);
      
      // Verify final states
      const tasks = await contextManager.checkAssignedTasks(connection);
      
      const goodTask = tasks.find(t => t.taskId === 'task-good');
      const badTask = tasks.find(t => t.taskId === 'task-bad');
      const recoveryTask = tasks.find(t => t.taskId === 'task-recovery');
      
      expect(goodTask?.status).toBe('completed');
      expect(badTask?.status).toBe('error');
      expect(recoveryTask?.status).toBe('in_progress');
    });
  });

  describe('State Persistence', () => {
    it('should persist multi-task state across server restarts', async () => {
      const agent = 'persistent-agent';
      const connection = {
        id: 'persist-conn',
        agent,
        startTime: new Date(),
        metadata: {}
      };
      connectionManager.register(connection);
      
      const agentDir = path.join(commDir, agent);
      
      // Create and work on multiple tasks
      const tasks = [
        { id: 'persist-1', status: 'completed' },
        { id: 'persist-2', status: 'in_progress' },
        { id: 'persist-3', status: 'new' }
      ];
      
      for (const task of tasks) {
        const taskDir = path.join(agentDir, task.id);
        await fs.ensureDir(taskDir);
        await fs.writeFile(path.join(taskDir, 'INIT.md'), `# ${task.id}`);
        
        if (task.status !== 'new') {
          await fs.writeFile(path.join(taskDir, 'PLAN.md'), `# Plan for ${task.id}`);
        }
        
        if (task.status === 'completed') {
          await fs.writeFile(path.join(taskDir, 'DONE.md'), `# Done ${task.id}`);
        }
      }
      
      // Set current task
      await contextManager.setCurrentTask('persist-2', connection);
      
      // Store current task in a marker file (simulate persistence)
      const currentTaskFile = path.join(agentDir, '.current-task');
      await fs.writeFile(currentTaskFile, 'persist-2');
      
      // Simulate server restart by creating new instances
      const newConnectionManager = new ConnectionManager();
      const newEventLogger = new EventLogger(testDir);
      const newContextManager = new TaskContextManager({
        commDir,
        connectionManager: newConnectionManager,
        eventLogger: newEventLogger
      });
      
      const newConnection = {
        id: 'new-persist-conn',
        agent,
        startTime: new Date(),
        metadata: {}
      };
      newConnectionManager.register(newConnection);
      
      // Check if state is preserved
      const restoredTasks = await newContextManager.checkAssignedTasks(newConnection);
      
      expect(restoredTasks).toHaveLength(3);
      
      const task1 = restoredTasks.find(t => t.taskId === 'persist-1');
      const task2 = restoredTasks.find(t => t.taskId === 'persist-2');
      const task3 = restoredTasks.find(t => t.taskId === 'persist-3');
      
      expect(task1?.status).toBe('completed');
      expect(task2?.status).toBe('in_progress');
      expect(task3?.status).toBe('new');
      
      // Load current task from marker file
      if (await fs.pathExists(currentTaskFile)) {
        const savedCurrentTask = await fs.readFile(currentTaskFile, 'utf8');
        expect(savedCurrentTask).toBe('persist-2');
      }
    });
  });
});