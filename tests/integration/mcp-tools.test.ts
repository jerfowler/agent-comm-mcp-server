/**
 * Integration tests for MCP server tools
 * CRITICAL: Tests actual fs.readdir functionality to prevent regression
 */

import * as path from 'path';
import * as fs from '../../src/utils/fs-extra-safe.js';
import { tmpdir } from 'os';

// Import tools directly for integration testing
import { listAgents } from '../../src/tools/list-agents.js';
import { checkTasks } from '../../src/tools/check-tasks.js';
import { createTaskTool } from '../../src/tools/create-task.js';
import { writeTask } from '../../src/tools/write-task.js';
import { readTask } from '../../src/tools/read-task.js';
import { testUtils } from '../utils/testUtils.js';
import { ServerConfig } from '../../src/types.js';

describe('MCP Server Tools Integration', () => {
  let testDir: string;
  let commDir: string;
  let config: ServerConfig;

  beforeAll(async () => {
    // Create temporary directory for tests
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'agent-comm-test-'));
    commDir = path.join(testDir, 'comm');
    
    config = testUtils.createMockConfig({
      commDir: commDir,
      enableArchiving: true,
      archiveDir: path.join(commDir, '.archive')
    });
    
    // Test environment setup completed
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });

  beforeEach(async () => {
    // Clean comm directory before each test
    await fs.remove(commDir);
    await fs.ensureDir(commDir);
  });

  describe('Tool Functionality', () => {
    it('should have all expected tools available', () => {
      expect(listAgents).toBeDefined();
      expect(checkTasks).toBeDefined();
      expect(createTaskTool).toBeDefined();
      expect(writeTask).toBeDefined();
      expect(readTask).toBeDefined();
    });
  });

  describe('File System Operations - fs.readdir regression tests', () => {
    it('CRITICAL: should handle directory listing with fs.readdir', async () => {
      // Create test agent directory structure
      const agentPath = path.join(commDir, 'test-agent');
      const taskPath = path.join(agentPath, 'test-task');
      await fs.ensureDir(taskPath);
      await fs.writeFile(path.join(taskPath, 'INIT.md'), '# Test task');
      
      // This test would fail with "fs.readdir is not a function" if import pattern is wrong
      const response = await listAgents(config);
      
      expect(response.agents).toBeDefined();
      expect(Array.isArray(response.agents)).toBe(true);
      expect(response.agents).toHaveLength(1);
      expect(response.agents[0].name).toBe('test-agent');
      expect(response.agents[0].taskCount).toBe(1);
      expect(response.totalAgents).toBe(1);
      expect(response.totalTasks).toBe(1);
    });

    it('should handle empty directories without errors', async () => {
      const response = await listAgents(config);
      
      expect(response.agents).toBeDefined();
      expect(Array.isArray(response.agents)).toBe(true);
      expect(response.agents).toHaveLength(0);
      expect(response.totalAgents).toBe(0);
      expect(response.totalTasks).toBe(0);
    });

    it('REGRESSION TEST: fs.readdir should work with multiple agents and tasks', async () => {
      // Create multiple agents with tasks
      const agentNames = ['agent-1', 'agent-2', 'agent-3'];
      
      for (const agentName of agentNames) {
        const agentPath = path.join(commDir, agentName);
        await fs.ensureDir(agentPath);
        
        // Create multiple tasks per agent
        for (let i = 1; i <= 3; i++) {
          const taskPath = path.join(agentPath, `task-${i}`);
          await fs.ensureDir(taskPath);
          await fs.writeFile(path.join(taskPath, 'INIT.md'), `# Task ${i}`);
        }
      }
      
      // This exercises fs.readdir extensively
      const response = await listAgents(config);
      
      expect(response.agents).toHaveLength(3);
      expect(response.totalAgents).toBe(3);
      expect(response.totalTasks).toBe(9);
      response.agents.forEach(agent => {
        expect(agent.taskCount).toBe(3);
        expect(agentNames).toContain(agent.name);
      });
    });
  });

  describe('Task Management Workflow', () => {
    const testAgent = 'senior-backend-engineer';
    const testTaskName = 'implement-api-endpoint';

    it('should complete full task lifecycle', async () => {
      // 1. Delegate task
      const delegateResponse = await createTaskTool(config, {
        agent: testAgent,
        taskName: testTaskName,
        content: `# Task: Implement API Endpoint

## Objective
Create REST API endpoint for user management

## Requirements
- POST /api/users
- Input validation
- Error handling`
      });

      expect(delegateResponse.success).toBe(true);
      expect(delegateResponse.taskId).toMatch(/implement-api-endpoint/);

      // 2. Check tasks (task is already initialized)
      const taskResponse = await checkTasks(config, { agent: testAgent });
      expect(taskResponse.tasks).toHaveLength(1);
      expect(taskResponse.tasks[0].taskId).toContain(testTaskName);
      expect(taskResponse.tasks[0].status).toBe('new'); // Has INIT.md but no PLAN.md yet

      // Get the actual task directory name
      const actualTaskName = taskResponse.tasks[0].taskId;

      // 3. Write plan
      const planResponse = await writeTask(config, {
        agent: testAgent,
        task: actualTaskName,
        file: 'PLAN',
        content: `# Implementation Plan

## Steps
1. [PENDING] Create endpoint route
2. [PENDING] Add input validation
3. [PENDING] Implement error handling`
      });

      expect(planResponse.success).toBe(true);
      expect(planResponse.bytesWritten).toBeGreaterThan(0);

      // 5. Complete task
      const doneResponse = await writeTask(config, {
        agent: testAgent,
        task: actualTaskName,
        file: 'DONE',
        content: `# Task Complete

## Results
API endpoint implemented successfully

## Files Created
- /api/routes/users.js
- /api/middleware/validation.js`
      });

      expect(doneResponse.success).toBe(true);
      expect(doneResponse.bytesWritten).toBeGreaterThan(0);
    });

    it('should handle task reading operations', async () => {
      // First create a task structure
      const agentPath = path.join(commDir, testAgent);
      const taskPath = path.join(agentPath, testTaskName);
      await fs.ensureDir(taskPath);
      
      const initContent = `# Task: Test Task
## Metadata
- Agent: ${testAgent}
- Created: 2025-01-01T12:00:00Z
- Source: test

## Objective
Test task for reading operations`;

      await fs.writeFile(path.join(taskPath, 'INIT.md'), initContent);

      const readResponse = await readTask(config, {
        agent: testAgent,
        task: testTaskName,
        file: 'INIT'
      });

      expect(readResponse.content).toContain('Test task for reading operations');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid agent names gracefully', async () => {
      await expect(checkTasks(config, {
        agent: '../invalid-agent'
      })).rejects.toThrow();
    });

    it('should handle non-existent tasks gracefully', async () => {
      await expect(readTask(config, {
        agent: 'test-agent',
        task: 'non-existent-task',
        file: 'INIT'
      })).rejects.toThrow();
    });

    it('should validate task names', async () => {
      await expect(createTaskTool(config, {
        agent: 'test-agent',
        taskName: '../invalid-task-name',
        content: 'Invalid task'
      })).rejects.toThrow();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent operations', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      const tasks = agents.map(agent => 
        createTaskTool(config, {
          agent: agent,
          taskName: `task-for-${agent}`,
          content: `# Task for ${agent}`
        })
      );

      const responses = await Promise.all(tasks);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });

      // Verify all tasks were created
      const agentList = await listAgents(config);
      expect(agentList.agents).toHaveLength(3);
    });

    it('should handle large task content', async () => {
      const largeContent = 'x'.repeat(10000); // 10KB content
      
      const response = await createTaskTool(config, {
        agent: 'test-agent',
        taskName: 'large-task',
        content: `# Large Task\n\n${largeContent}`
      });

      expect(response.success).toBe(true);

      // Get the task directory name (task is already initialized)
      const checkResult = await checkTasks(config, { agent: 'test-agent' });
      expect(checkResult.tasks).toHaveLength(1);
      const actualTaskName = checkResult.tasks[0].taskId;

      // Verify content was written correctly
      const readResponse = await readTask(config, {
        agent: 'test-agent',
        task: actualTaskName,
        file: 'INIT'
      });

      expect(readResponse.content).toContain(largeContent);
    });
  });
});