/**
 * Test-Driven Development for TaskContextManager
 * Complete file system abstraction with context-based API
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('TaskContextManager', () => {
  let contextManager: TaskContextManager;
  let connectionManager: ConnectionManager;
  let eventLogger: EventLogger;
  let testDir: string;
  let mockConnection: any;
  
  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-context-test-'));
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
    await fs.remove(testDir);
    jest.clearAllMocks();
  });

  describe('Core Abstraction Requirements', () => {
    it('should hide all file paths from responses', async () => {
      // Create a test task first
      const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
      const taskDir = path.join(agentDir, 'task-123');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        '# Task: Test Task\n## Objective\nTest objective\n## Requirements\n- Test requirement'
      );
      
      // Test that no file paths or extensions are exposed
      const taskId = 'task-123';
      const context = await contextManager.getTaskContext(taskId, mockConnection);
      
      // Should not contain actual file paths (but allow function names and documentation)
      const contextStr = JSON.stringify(context);
      expect(contextStr).not.toMatch(/\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/); // No actual file paths like /path/to/file
      expect(contextStr).not.toContain('\\\\'); // No Windows paths
      expect(contextStr).not.toContain('.md');
      expect(contextStr).not.toContain('comm/');
      expect(JSON.stringify(context)).not.toContain('INIT');
      expect(JSON.stringify(context)).not.toContain('PLAN');
      expect(JSON.stringify(context)).not.toContain('DONE');
      expect(JSON.stringify(context)).not.toContain('ERROR');
      
      // Should contain pure context
      expect(context).toHaveProperty('title');
      expect(context).toHaveProperty('objective');
      expect(context).toHaveProperty('requirements');
    });

    it('should auto-inject protocol instructions', async () => {
      // Create a test task first
      const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
      const taskDir = path.join(agentDir, 'test-protocol-task');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        '# Task: Protocol Test\n## Objective\nTest protocol injection'
      );
      
      const taskId = 'test-protocol-task';
      const context = await contextManager.getTaskContext(taskId, mockConnection);
      
      expect(context.protocolInstructions).toContain('MCP Protocol');
      expect(context.protocolInstructions).toContain('check_assigned_tasks');
      expect(context.protocolInstructions).toContain('start_task');
      expect(context.protocolInstructions).toContain('submit_plan');
      expect(context.protocolInstructions).toContain('mark_complete');
    });

    it('should track agent sessions via connections', async () => {
      // Create test tasks for both agents
      const archDir = path.join(testDir, 'comm', 'senior-system-architect');
      const frontendDir = path.join(testDir, 'comm', 'senior-frontend-engineer');
      await fs.ensureDir(archDir);
      await fs.ensureDir(frontendDir);
      
      await fs.writeFile(
        path.join(archDir, 'INIT.md'),
        '# Task: Architecture Task\n## Objective\nArchitecture work'
      );
      await fs.writeFile(
        path.join(frontendDir, 'INIT.md'),
        '# Task: Frontend Task\n## Objective\nFrontend work'
      );
      
      const taskId = 'session-test-task';
      expect(taskId).toBe('session-test-task');
      
      // Different connection = different agent
      const otherConnection = {
        id: 'other-connection-456',
        agent: 'senior-frontend-engineer',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(otherConnection);
      
      // Test with no active tasks - should show agent-specific capabilities
      const context1 = await contextManager.getTaskContext('', mockConnection);
      const context2 = await contextManager.getTaskContext('', otherConnection);
      
      // Context should be tailored to specific agent
      expect(context1.currentAgent).toBe('senior-system-architect');
      expect(context2.currentAgent).toBe('senior-frontend-engineer');
    });

    it('should provide pure context without file operations', async () => {
      // Test with empty taskId (no active task)
      const context = await contextManager.getTaskContext('', mockConnection);
      
      // Should be conceptual, not file-based
      expect(context).toHaveProperty('title');
      expect(context).toHaveProperty('objective');
      expect(context).toHaveProperty('requirements');
      expect(context).toHaveProperty('currentAgent');
      expect(context).toHaveProperty('protocolInstructions');
      
      // Should not expose implementation details
      expect(context).not.toHaveProperty('path');
      expect(context).not.toHaveProperty('files');
      expect(context).not.toHaveProperty('directory');
    });
  });

  describe('Task Lifecycle Management', () => {
    it('should convert file-based tasks to context IDs', async () => {
      // Create a physical task file structure
      const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
      const taskDir = path.join(agentDir, '20250903-123456-implement-feature');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        '# Task: Implement Feature\n## Objective\nBuild new feature'
      );
      
      const assignedTasks = await contextManager.checkAssignedTasks(mockConnection);
      
      // Should return task IDs and titles only
      expect(assignedTasks).toHaveLength(1);
      expect(assignedTasks[0]).toHaveProperty('taskId');
      expect(assignedTasks[0]).toHaveProperty('title');
      expect(assignedTasks[0].title).toBe('Implement Feature');
      
      // Should not expose file paths
      expect(assignedTasks[0]).not.toHaveProperty('path');
      expect(assignedTasks[0]).not.toHaveProperty('directory');
    });

    it('should start task and return pure context', async () => {
      // Create test task
      const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
      const taskDir = path.join(agentDir, '20250903-123456-implement-feature');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        '# Task: Implement Feature\n## Objective\nBuild new feature\n## Requirements\n- Requirement 1\n- Requirement 2'
      );
      
      const taskId = '20250903-123456-implement-feature';
      const context = await contextManager.startTask(taskId, mockConnection);
      
      expect(context).toHaveProperty('title', 'Implement Feature');
      expect(context).toHaveProperty('objective', 'Build new feature');
      expect(context).toHaveProperty('requirements');
      expect(context.requirements).toContain('Requirement 1');
      expect(context.requirements).toContain('Requirement 2');
      expect(context).toHaveProperty('currentAgent', 'senior-system-architect');
      
      // Should not expose actual file paths (but allow function names and documentation)
      const contextStr = JSON.stringify(context);
      expect(contextStr).not.toMatch(/\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/); // No actual file paths
    });
  });

  describe('Plan and Progress Management', () => {
    it('should submit plan content without exposing file creation', async () => {
      const planContent = `# Implementation Plan
## Step 1: Analysis
## Step 2: Development
## Step 3: Testing`;

      const result = await contextManager.submitPlan(planContent, mockConnection);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Plan submitted successfully');
      
      // Should not expose file paths
      expect(result).not.toHaveProperty('path');
      expect(result).not.toHaveProperty('filePath');
    });

    it('should report progress with marker updates', async () => {
      const updates = [
        { step: 1, status: 'COMPLETE' as const, description: 'Analysis completed' },
        { step: 2, status: 'IN_PROGRESS' as const, description: 'Development started' },
        { step: 3, status: 'PENDING' as const, description: 'Testing pending' }
      ];

      const result = await contextManager.reportProgress(updates, mockConnection);
      
      expect(result.success).toBe(true);
      expect(result.updatedSteps).toBe(3);
      
      // Should not expose file operations
      expect(result).not.toHaveProperty('filePath');
    });

    it('should mark task complete without file path exposure', async () => {
      const summary = 'Task completed successfully with all requirements met.';

      const result = await contextManager.markComplete('DONE', summary, mockConnection);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
      expect(result.summary).toBe(summary);
      
      // Should not expose file paths
      expect(result).not.toHaveProperty('path');
      expect(result).not.toHaveProperty('filePath');
    });

    it('should handle error completion', async () => {
      const errorMessage = 'Task failed due to technical constraints.';

      const result = await contextManager.markComplete('ERROR', errorMessage, mockConnection);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('ERROR');
      expect(result.summary).toBe(errorMessage);
    });
  });

  describe('Automatic Logging', () => {
    it('should log all operations to JSON Lines format', async () => {
      // Create a test task first
      const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
      const taskDir = path.join(agentDir, '20250903-123456-implement-feature');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        '# Task: Logging Test\n## Objective\nTest logging functionality'
      );
      
      const taskId = '20250903-123456-implement-feature';
      
      await contextManager.startTask(taskId, mockConnection);
      await contextManager.submitPlan('# Test Plan\n\nThis is a test plan with enough content to pass validation.', mockConnection);
      await contextManager.markComplete('DONE', 'Test complete', mockConnection);
      
      const logEntries = await eventLogger.getLogEntries();
      
      expect(logEntries.length).toBeGreaterThanOrEqual(3);
      
      const startTaskEntry = logEntries.find(entry => entry.operation === 'start_task');
      expect(startTaskEntry).toBeDefined();
      expect(startTaskEntry?.agent).toBe('senior-system-architect');
      expect(startTaskEntry?.taskId).toBe(taskId);
      
      const submitPlanEntry = logEntries.find(entry => entry.operation === 'submit_plan');
      expect(submitPlanEntry).toBeDefined();
      
      const markCompleteEntry = logEntries.find(entry => entry.operation === 'mark_complete');
      expect(markCompleteEntry).toBeDefined();
    });
  });

  describe('Context Injection', () => {
    it('should inject protocol instructions in every context', async () => {
      // Test with empty taskId (no active task)
      const context = await contextManager.getTaskContext('', mockConnection);
      
      expect(context.protocolInstructions).toContain('## MCP Protocol');
      expect(context.protocolInstructions).toContain('check_assigned_tasks()');
      expect(context.protocolInstructions).toContain('start_task(taskId)');
      expect(context.protocolInstructions).toContain('submit_plan(content)');
      expect(context.protocolInstructions).toContain('report_progress(updates)');
      expect(context.protocolInstructions).toContain('mark_complete(status, summary)');
    });

    it('should provide agent-specific context', async () => {
      const frontendConnection = {
        id: 'frontend-connection',
        agent: 'senior-frontend-engineer',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(frontendConnection);
      
      // Test with empty taskId (no active task)
      const context = await contextManager.getTaskContext('', frontendConnection);
      
      expect(context.currentAgent).toBe('senior-frontend-engineer');
      expect(context.agentCapabilities).toContain('React/TypeScript development');
      expect(context.agentCapabilities).toContain('Modern frontend patterns');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle checkAssignedTasks when agent directory does not exist', async () => {
      // Create a connection for an agent with no existing directory
      const noTasksConnection = {
        id: 'no-tasks-connection',
        agent: 'no-tasks-agent',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(noTasksConnection);
      
      // Test coverage for lines 161-170: agent directory doesn't exist
      const tasks = await contextManager.checkAssignedTasks(noTasksConnection);
      
      expect(tasks).toEqual([]);
      
      // Verify logging
      const logEntries = await eventLogger.getLogEntries();
      const checkTasksEntry = logEntries.find(entry => 
        entry.operation === 'check_assigned_tasks' && 
        entry.agent === 'no-tasks-agent' &&
        entry.success === true
      );
      
      expect(checkTasksEntry).toBeDefined();
      expect(checkTasksEntry!.metadata?.['tasksFound']).toBe(0);
    });

    it('should handle startTask with non-existent task file', async () => {
      // Test coverage for line 245: Task not found or not accessible
      await expect(contextManager.startTask('non-existent-task', mockConnection))
        .rejects.toThrow('Task not found or not accessible');
    });

    it('should handle task without PROGRESS.md file', async () => {
      // Test coverage for progress being undefined when no PROGRESS.md exists
      const taskId = 'simple-task';
      const commDir = path.join(testDir, 'comm');
      const taskPath = path.join(commDir, mockConnection.agent, taskId);
      await fs.ensureDir(taskPath);
      
      // Create only INIT.md, no PROGRESS.md
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Simple Task\n\nThis task has no progress file.'
      );

      const result = await contextManager.checkAssignedTasks(mockConnection);
      const task = result.find(t => t.taskId === taskId);
      
      expect(task).toBeDefined();
      expect(task!.title).toBe('Simple Task');
      expect(task!.status).toBe('new');
      // Progress should be undefined when no PROGRESS.md exists
      expect(task!.progress).toBeUndefined();
    });
  });
});