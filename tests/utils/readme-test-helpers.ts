/**
 * Test utilities for README examples validation
 * Simulates what Claude would do when interpreting natural language prompts
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { testUtils } from './testUtils.js';
import { createTask } from '../../src/tools/create-task.js';
import { trackTaskProgress } from '../../src/tools/track-task-progress.js';
import { getFullLifecycle } from '../../src/tools/get-full-lifecycle.js';
import { archiveTasksTool } from '../../src/tools/archive-tasks.js';

export interface PromptScenario {
  name: string;
  prompt: string;
  expectedTool: string;
  expectedParams: Record<string, any>;
  expectedResponse: Record<string, any>;
}

export interface TaskScenarioContext {
  config: any;
  tempDir: string;
  commDir: string;
  agents: string[];
}

export const readmeTestHelpers = {
  /**
   * Create test context for README scenarios
   */
  async createTaskScenarioContext(): Promise<TaskScenarioContext> {
    const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'temp-readme-test-'));
    const commDir = path.join(tempDir, 'comm');
    await fs.ensureDir(commDir);

    const config = testUtils.createMockConfig({
      commDir,
      archiveDir: path.join(commDir, '.archive'),
      logDir: path.join(commDir, '.logs'),
      enableArchiving: true
    });

    return {
      config,
      tempDir,
      commDir,
      agents: ['senior-frontend-engineer', 'senior-backend-engineer', 'qa-test-automation-engineer']
    };
  },

  /**
   * Clean up test context
   */
  async cleanupTaskScenarioContext(context: TaskScenarioContext): Promise<void> {
    await fs.remove(context.tempDir);
  },

  /**
   * Simulate "Delegate a Task" prompt
   */
  async simulateDelegateTaskPrompt(
    context: TaskScenarioContext,
    agent: string = 'senior-frontend-engineer',
    taskContent: string = 'Implement a responsive dashboard component with real-time data updates and dark mode support'
  ) {
    // Simulate what Claude would do: use create_task or delegate_task
    const result = await createTask(context.config, {
      agent,
      taskName: 'implement-dashboard-component',
      content: `# Task: Dashboard Implementation\n\n## Requirements\n${taskContent}\n\n## Additional Notes\nInclude proper TypeScript interfaces and comprehensive tests.`,
      taskType: 'delegation'
    });

    return result;
  },

  /**
   * Simulate "Monitor Task Progress" prompt
   */
  async simulateMonitorProgressPrompt(
    context: TaskScenarioContext,
    agent: string = 'senior-frontend-engineer'
  ) {
    // First find tasks for the agent
    const agentDir = path.join(context.commDir, agent);
    if (!await fs.pathExists(agentDir)) {
      throw new Error(`No tasks found for agent: ${agent}`);
    }

    const taskDirs = await fs.readdir(agentDir);
    if (taskDirs.length === 0) {
      throw new Error(`No tasks found for agent: ${agent}`);
    }

    const taskId = taskDirs[0]; // Use first task found
    
    // Simulate what Claude would do: use track_task_progress
    const result = await trackTaskProgress(context.config, {
      agent,
      taskId: taskId
    });

    return result;
  },

  /**
   * Simulate "Get Complete Task Analysis" prompt
   */
  async simulateLifecycleAnalysisPrompt(
    context: TaskScenarioContext,
    agent: string = 'senior-frontend-engineer'
  ) {
    // Find existing task
    const agentDir = path.join(context.commDir, agent);
    if (!await fs.pathExists(agentDir)) {
      throw new Error(`No tasks found for agent: ${agent}`);
    }

    const taskDirs = await fs.readdir(agentDir);
    if (taskDirs.length === 0) {
      throw new Error(`No tasks found for agent: ${agent}`);
    }

    const taskId = taskDirs[0];
    
    // Simulate what Claude would do: use get_full_lifecycle
    const result = await getFullLifecycle(context.config, {
      agent,
      taskId: taskId
    });

    return result;
  },

  /**
   * Simulate "Create Multiple Parallel Tasks" prompt
   */
  async simulateParallelTasksPrompt(context: TaskScenarioContext) {
    const tasks = [
      {
        agent: 'senior-backend-engineer',
        taskName: 'user-management-api',
        content: '# Task: REST API Endpoints\n\n## Requirements\nDesign and implement REST API endpoints for user management'
      },
      {
        agent: 'senior-frontend-engineer', 
        taskName: 'user-management-ui',
        content: '# Task: UI Components\n\n## Requirements\nBuild user interface components for the user management system'
      },
      {
        agent: 'qa-test-automation-engineer',
        taskName: 'user-management-tests',
        content: '# Task: Test Suite\n\n## Requirements\nCreate comprehensive test suite for user management features'
      }
    ];

    // Simulate what Claude would do: create multiple tasks in parallel
    const results = await Promise.all(
      tasks.map(task => 
        createTask(context.config, {
          agent: task.agent,
          taskName: task.taskName,
          content: task.content,
          taskType: 'delegation'
        })
      )
    );

    return results;
  },

  /**
   * Simulate "Archive Completed Work" prompt
   */
  async simulateArchiveTasksPrompt(context: TaskScenarioContext) {
    // Simulate what Claude would do: use archive_tasks
    const result = await archiveTasksTool(context.config, {
      mode: 'completed'
    });

    // Transform ArchiveResult into the expected test format
    const archiveCount = result.archived?.total || 0;
    return {
      success: true,
      archived: archiveCount,
      message: `Archived ${archiveCount} tasks${result.archivePath ? ' to ' + result.archivePath : ''}`
    };
  },

  /**
   * Validate tool response format matches README expectations
   */
  validateToolResponse(response: any, expectedFields: string[]): boolean {
    for (const field of expectedFields) {
      if (!(field in response)) {
        return false;
      }
    }
    return true;
  },

  /**
   * Assert complete task lifecycle exists
   */
  async assertTaskLifecycle(
    context: TaskScenarioContext,
    agent: string,
    taskId: string
  ): Promise<void> {
    const taskDir = path.join(context.commDir, agent, taskId);
    
    // Check task directory exists
    if (!await fs.pathExists(taskDir)) {
      throw new Error(`Task directory not found: ${taskDir}`);
    }

    // Check INIT.md exists (created during task creation)
    const initFile = path.join(taskDir, 'INIT.md');
    if (!await fs.pathExists(initFile)) {
      throw new Error(`INIT.md not found in task: ${taskId}`);
    }

    // Validate INIT.md has proper content structure
    const initContent = await fs.readFile(initFile, 'utf-8');
    if (!initContent.includes('# Task:') || !initContent.includes('## Requirements')) {
      throw new Error(`INIT.md does not have expected structure in task: ${taskId}`);
    }
  },

  /**
   * Get README prompt scenarios for testing
   */
  getReadmePromptScenarios(): PromptScenario[] {
    return [
      {
        name: 'Delegate Task',
        prompt: 'Using the agent-comm MCP server, delegate this task to senior-frontend-engineer',
        expectedTool: 'create_task',
        expectedParams: {
          agent: 'senior-frontend-engineer',
          taskType: 'delegation'
        },
        expectedResponse: {
          success: true,
          taskId: 'string',
          tracking: 'object'
        }
      },
      {
        name: 'Monitor Progress', 
        prompt: 'Using the MCP agent-comm tools, check the progress of the dashboard task',
        expectedTool: 'track_task_progress',
        expectedParams: {
          agent: 'string',
          task_id: 'string'
        },
        expectedResponse: {
          status: 'string',
          progress: 'object'
        }
      },
      {
        name: 'Lifecycle Analysis',
        prompt: 'Use the agent-comm MCP server to show me the complete lifecycle analysis',
        expectedTool: 'get_full_lifecycle', 
        expectedParams: {
          agent: 'string',
          task_id: 'string'
        },
        expectedResponse: {
          lifecycle: 'object',
          summary: 'object'
        }
      },
      {
        name: 'Parallel Tasks',
        prompt: 'Using the agent-comm MCP tools, create these tasks in parallel',
        expectedTool: 'create_task',
        expectedParams: {
          agent: 'string',
          taskType: 'delegation'
        },
        expectedResponse: {
          success: true,
          taskId: 'string'
        }
      },
      {
        name: 'Archive Tasks',
        prompt: 'Use the agent-comm MCP server to archive all completed agent communication tasks',
        expectedTool: 'archive_tasks',
        expectedParams: {
          mode: 'completed'
        },
        expectedResponse: {
          success: true,
          archived: 'number'
        }
      }
    ];
  }
};