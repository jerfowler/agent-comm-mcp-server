/**
 * Integration tests for the MCP server
 */

import * as fs from '../../src/utils/fs-extra-safe.js';
import * as path from 'path';
import * as os from 'os';
// jest utilities if needed

// Import tools for direct testing
import { checkTasks } from '../../src/tools/check-tasks.js';
import { readTask } from '../../src/tools/read-task.js';
import { writeTask } from '../../src/tools/write-task.js';
import { createTaskTool } from '../../src/tools/create-task.js';
import { listAgents } from '../../src/tools/list-agents.js';
import { archiveTasksTool } from '../../src/tools/archive-tasks.js';
import { restoreTasksTool } from '../../src/tools/restore-tasks.js';

import { ServerConfig } from '../../src/types.js';
import { sampleTaskFiles } from '../fixtures/sample-tasks.js';

describe('MCP Server Integration Tests', () => {
  let tempDir: string;
  let config: ServerConfig;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-comm-test-'));
    
    config = testUtils.createMockConfig({
      commDir: path.join(tempDir, 'comm'),
      archiveDir: path.join(tempDir, 'comm', '.archive'),
      enableArchiving: true
    });

    // Ensure directories exist
    await fs.ensureDir(config.commDir);
    await fs.ensureDir(config.archiveDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('Complete Task Lifecycle', () => {
    const agentName = 'senior-frontend-engineer';
    const taskName = 'implement-login';

    it('should handle complete task workflow', async () => {
      // Step 1: Delegate task (creates directory structure directly)
      const delegateResult = await createTaskTool(config, {
        agent: agentName,
        taskName: taskName,
        content: sampleTaskFiles.newTask
      });
      expect(delegateResult.success).toBe(true);
      expect(delegateResult.taskId).toMatch(/-implement-login$/);
      
      // Use taskId directly (no filename exposure)
      const taskDir = delegateResult.taskId;

      // Step 2: Check tasks - should show new task (initialized but no plan yet)
      const checkResult1 = await checkTasks(config, { agent: agentName });
      expect(checkResult1.tasks).toHaveLength(1);
      expect(checkResult1.tasks[0].status).toBe('new'); // Task initialized but no plan yet
      expect(checkResult1.tasks[0].taskId).toBe(taskDir);
      expect(checkResult1.newCount).toBe(1); // Task has INIT.md but no PLAN.md yet
      expect(checkResult1.activeCount).toBe(0); // No tasks in progress yet

      // Step 3: Read INIT file
      const readResult = await readTask(config, {
        agent: agentName,
        task: taskDir,
        file: 'INIT'
      });
      expect(readResult.content).toContain('Implement Login Form');
      expect(readResult.metadata?.agent).toBe('senior-frontend-engineer');

      // Step 4: Write PLAN file
      const planContent = sampleTaskFiles.planTask;
      const writeResult1 = await writeTask(config, {
        agent: agentName,
        task: taskDir,
        file: 'PLAN',
        content: planContent
      });
      expect(writeResult1.success).toBe(true);

      // Step 5: Check tasks - should show task with plan
      const checkResult3 = await checkTasks(config, { agent: agentName });
      expect(checkResult3.tasks[0].status).toBe('in_progress');

      // Step 6: Write DONE file
      const doneContent = sampleTaskFiles.doneTask;
      const writeResult2 = await writeTask(config, {
        agent: agentName,
        task: taskDir,
        file: 'DONE',
        content: doneContent
      });
      expect(writeResult2.success).toBe(true);

      // Step 9: Check tasks - should show completed task
      const checkResult4 = await checkTasks(config, { agent: agentName });
      expect(checkResult4.tasks[0].status).toBe('completed');

      // Step 10: List agents - should show agent with 1 task
      const agentsResult = await listAgents(config);
      expect(agentsResult.agents).toHaveLength(1);
      expect(agentsResult.agents[0].name).toBe(agentName);
      expect(agentsResult.agents[0].taskCount).toBe(1);
      expect(agentsResult.agents[0].completedCount).toBe(1);
    });
  });

  describe('Task Delegation', () => {
    it('should delegate task between agents', async () => {
      const sourceAgent = 'senior-frontend-engineer';
      const targetAgent = 'senior-backend-engineer';

      // Delegate task
      const delegateResult = await createTaskTool(config, {
        agent: targetAgent,
        taskName: 'create-api-endpoint',
        content: '# Task: Create User API\\n\\n## Requirements\\n- POST /api/users',
        sourceAgent: sourceAgent
      });

      expect(delegateResult.success).toBe(true);
      expect(delegateResult.targetAgent).toBe(targetAgent);
      expect(delegateResult.taskId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-create-api-endpoint$/);

      // Check target agent has the task
      const checkResult = await checkTasks(config, { agent: targetAgent });
      expect(checkResult.tasks).toHaveLength(1);
      expect(checkResult.tasks[0].status).toBe('new'); // Task initialized but no plan yet
      expect(checkResult.newCount).toBe(1);

      // Verify task content includes metadata by reading INIT file
      const taskDir = checkResult.tasks[0].taskId;
      const readResult = await readTask(config, {
        agent: targetAgent,
        task: taskDir,
        file: 'INIT'
      });
      expect(readResult.content).toContain('Agent: senior-backend-engineer');
      expect(readResult.content).toContain('Source: senior-frontend-engineer');
    });
  });

  describe('Archive and Restore', () => {
    beforeEach(async () => {
      // Set up test data: create multiple tasks for different agents
      const agents = ['agent1', 'agent2'];
      
      for (const agent of agents) {
        const agentDir = path.join(config.commDir, agent);
        await fs.ensureDir(agentDir);

        // Create completed task
        const completedTaskDir = path.join(agentDir, 'completed-task');
        await fs.ensureDir(completedTaskDir);
        await fs.writeFile(path.join(completedTaskDir, 'INIT.md'), sampleTaskFiles.sampleTask);
        await fs.writeFile(path.join(completedTaskDir, 'PLAN.md'), sampleTaskFiles.planTask);
        await fs.writeFile(path.join(completedTaskDir, 'DONE.md'), sampleTaskFiles.doneTask);

        // Create pending task
        const pendingTaskDir = path.join(agentDir, 'pending-task');
        await fs.ensureDir(pendingTaskDir);
        await fs.writeFile(path.join(pendingTaskDir, 'INIT.md'), sampleTaskFiles.sampleTask);
        await fs.writeFile(path.join(pendingTaskDir, 'PLAN.md'), sampleTaskFiles.planTask);

        // Create error task
        const errorTaskDir = path.join(agentDir, 'error-task');
        await fs.ensureDir(errorTaskDir);
        await fs.writeFile(path.join(errorTaskDir, 'INIT.md'), sampleTaskFiles.sampleTask);
        await fs.writeFile(path.join(errorTaskDir, 'ERROR.md'), sampleTaskFiles.errorTask);
      }
    });

    it('should archive completed tasks only', async () => {
      const archiveResult = await archiveTasksTool(config, { mode: 'completed' });
      
      expect(archiveResult.archived).not.toBeNull();
      expect(archiveResult.archived!.completed).toBe(2); // 1 per agent
      expect(archiveResult.archived!.pending).toBe(0);
      expect(archiveResult.archived!.total).toBe(2);
      expect(archiveResult.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);

      // Verify tasks are moved
      for (const agent of ['agent1', 'agent2']) {
        const completedTaskPath = path.join(config.commDir, agent, 'completed-task');
        const pendingTaskPath = path.join(config.commDir, agent, 'pending-task');
        const errorTaskPath = path.join(config.commDir, agent, 'error-task');

        expect(await fs.pathExists(completedTaskPath)).toBe(false); // Archived
        expect(await fs.pathExists(pendingTaskPath)).toBe(true);    // Not archived
        expect(await fs.pathExists(errorTaskPath)).toBe(true);      // Not archived
      }

      // Verify archive structure
      const archivePath = path.join(config.archiveDir, archiveResult.timestamp, 'completed');
      expect(await fs.pathExists(archivePath)).toBe(true);
      
      for (const agent of ['agent1', 'agent2']) {
        const archivedTaskPath = path.join(archivePath, agent, 'completed-task');
        expect(await fs.pathExists(archivedTaskPath)).toBe(true);
      }
    });

    it('should archive all tasks', async () => {
      const archiveResult = await archiveTasksTool(config, { mode: 'all' });
      
      expect(archiveResult.archived).not.toBeNull();
      expect(archiveResult.archived!.completed).toBe(2);
      expect(archiveResult.archived!.pending).toBe(4); // pending + error tasks
      expect(archiveResult.archived!.total).toBe(6);

      // Verify all tasks are moved
      for (const agent of ['agent1', 'agent2']) {
        const agentTasks = await checkTasks(config, { agent });
        expect(agentTasks.totalCount).toBe(0);
      }
    });

    it('should archive by specific agent', async () => {
      const archiveResult = await archiveTasksTool(config, {
        mode: 'by-agent',
        agent: 'agent1'
      });
      
      expect(archiveResult.archived).not.toBeNull();
      expect(archiveResult.archived!.total).toBe(3); // All tasks for agent1

      // Verify only agent1 tasks are archived
      const agent1Tasks = await checkTasks(config, { agent: 'agent1' });
      const agent2Tasks = await checkTasks(config, { agent: 'agent2' });
      
      expect(agent1Tasks.totalCount).toBe(0);
      expect(agent2Tasks.totalCount).toBe(3);
    });

    it('should perform dry run without archiving', async () => {
      const archiveResult = await archiveTasksTool(config, {
        mode: 'completed',
        dryRun: true
      });
      
      expect(archiveResult.archived).not.toBeNull();
      expect(archiveResult.archived!.completed).toBe(2);
      expect(archiveResult.archived!.total).toBe(2);

      // Verify no tasks were actually moved
      for (const agent of ['agent1', 'agent2']) {
        const completedTaskPath = path.join(config.commDir, agent, 'completed-task');
        expect(await fs.pathExists(completedTaskPath)).toBe(true); // Still exists
      }
    });

    it('should restore archived tasks', async () => {
      // First archive tasks
      const archiveResult = await archiveTasksTool(config, { mode: 'all' });
      
      // Then restore them
      const restoreResult = await restoreTasksTool(config, {
        timestamp: archiveResult.timestamp
      });
      
      expect(restoreResult.restored.completed).toBe(2);
      expect(restoreResult.restored.pending).toBe(4);
      expect(restoreResult.restored.total).toBe(6);

      // Verify tasks are restored
      for (const agent of ['agent1', 'agent2']) {
        const agentTasks = await checkTasks(config, { agent });
        expect(agentTasks.totalCount).toBe(3);
      }
    });

    it('should restore specific agent tasks', async () => {
      // First archive all tasks
      const archiveResult = await archiveTasksTool(config, { mode: 'all' });
      
      // Restore only agent1 tasks
      const restoreResult = await restoreTasksTool(config, {
        timestamp: archiveResult.timestamp,
        agent: 'agent1'
      });
      
      expect(restoreResult.restored.total).toBe(3);

      // Verify only agent1 tasks are restored
      const agent1Tasks = await checkTasks(config, { agent: 'agent1' });
      const agent2Tasks = await checkTasks(config, { agent: 'agent2' });
      
      expect(agent1Tasks.totalCount).toBe(3);
      expect(agent2Tasks.totalCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent agent gracefully', async () => {
      const result = await checkTasks(config, { agent: 'non-existent-agent' });
      expect(result.tasks).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('should throw error for non-existent task file', async () => {
      await expect(readTask(config, {
        agent: 'test-agent',
        task: 'non-existent-task',
        file: 'INIT'
      })).rejects.toThrow('File not found');
    });


    it('should throw error for invalid archive timestamp', async () => {
      await expect(restoreTasksTool(config, {
        timestamp: 'invalid-timestamp'
      })).rejects.toThrow('Invalid timestamp format');
    });

    it('should throw error for non-existent archive', async () => {
      await expect(restoreTasksTool(config, {
        timestamp: '2025-01-01T00-00-00'
      })).rejects.toThrow('Archive not found');
    });
  });

  describe('Multiple Agents Management', () => {
    beforeEach(async () => {
      // Create test data for multiple agents
      const agents = [
        { name: 'senior-frontend-engineer', tasks: 3 },
        { name: 'senior-backend-engineer', tasks: 2 },
        { name: 'qa-engineer', tasks: 1 }
      ];

      for (const { name, tasks } of agents) {
        const agentDir = path.join(config.commDir, name);
        await fs.ensureDir(agentDir);

        for (let i = 0; i < tasks; i++) {
          const taskDir = path.join(agentDir, `task-${i + 1}`);
          await fs.ensureDir(taskDir);
          await fs.writeFile(path.join(taskDir, 'INIT.md'), sampleTaskFiles.sampleTask);
          
          if (i === 0) {
            // First task is completed
            await fs.writeFile(path.join(taskDir, 'DONE.md'), sampleTaskFiles.doneTask);
          } else if (i === tasks - 1) {
            // Last task has error
            await fs.writeFile(path.join(taskDir, 'ERROR.md'), sampleTaskFiles.errorTask);
          } else {
            // Middle tasks are pending
            await fs.writeFile(path.join(taskDir, 'PLAN.md'), sampleTaskFiles.planTask);
          }
        }
      }
    });

    it('should list all agents with correct statistics', async () => {
      const result = await listAgents(config);
      
      expect(result.agents).toHaveLength(3);
      expect(result.totalAgents).toBe(3);
      expect(result.totalTasks).toBe(6);

      // Check individual agent stats
      const frontendAgent = result.agents.find(a => a.name === 'senior-frontend-engineer');
      expect(frontendAgent?.taskCount).toBe(3);
      expect(frontendAgent?.completedCount).toBe(1);
      expect(frontendAgent?.pendingCount).toBe(1);
      expect(frontendAgent?.errorCount).toBe(1);

      const backendAgent = result.agents.find(a => a.name === 'senior-backend-engineer');
      expect(backendAgent?.taskCount).toBe(2);
      expect(backendAgent?.completedCount).toBe(1);
      expect(backendAgent?.errorCount).toBe(1);

      const qaAgent = result.agents.find(a => a.name === 'qa-engineer');
      expect(qaAgent?.taskCount).toBe(1);
      expect(qaAgent?.completedCount).toBe(1);
    });

    it('should handle task checks for multiple agents', async () => {
      const frontendTasks = await checkTasks(config, { agent: 'senior-frontend-engineer' });
      expect(frontendTasks.totalCount).toBe(3);
      expect(frontendTasks.activeCount).toBe(1); // Only in_progress tasks (task-2 with PLAN.md)

      const backendTasks = await checkTasks(config, { agent: 'senior-backend-engineer' });
      expect(backendTasks.totalCount).toBe(2);
      expect(backendTasks.activeCount).toBe(0); // No in_progress tasks (only completed and error)

      const qaTasks = await checkTasks(config, { agent: 'qa-engineer' });
      expect(qaTasks.totalCount).toBe(1);
      expect(qaTasks.activeCount).toBe(0); // completed
    });
  });
});