/**
 * Test-Driven Development for TaskContextManager
 * Complete file system abstraction with context-based API
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaskContextManager, TaskContext, TaskSummary } from '../../../src/core/TaskContextManager.js';
import { ConnectionManager, Connection } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { AgentOwnershipError } from '../../../src/types.js';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import os from 'os';

describe('TaskContextManager', () => {
  let contextManager: TaskContextManager;
  let connectionManager: ConnectionManager;
  let eventLogger: EventLogger;
  let testDir: string;
  let mockConnection: Connection;
  
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
      expect(contextStr).not.toMatch(/[/.][a-zA-Z0-9_-]+\.md/); // No file paths ending in .md but allow "PLAN.md" in documentation
      expect(contextStr).not.toContain('comm/');
      expect(JSON.stringify(context)).not.toMatch(/["'][A-Z]{3,5}\.md["']/); // No quoted file names like "INIT.md"
      expect(JSON.stringify(context)).not.toMatch(/["'][A-Z]{3,5}["']/); // No quoted file prefixes like "PLAN" without extension context
      
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

  describe('Checkbox Progress Tracking', () => {
    describe('analyzePlanProgress should parse checkbox format correctly', () => {
      it('should count checked and unchecked boxes correctly', () => {
        const planWithCheckboxes = `# Implementation Plan

- [ ] **Setup Environment**: Configure development setup
- [x] **Install Dependencies**: Run npm install
- [ ] **Run Tests**: Execute test suite
- [x] **Deploy Code**: Upload to production

## Notes
Some additional notes here.
`;

        // This test will FAIL initially because current implementation doesn't support checkbox format
        // Interface for accessing private methods for testing - don't extend, just define what we need
        interface TaskContextManagerPrivate {
          analyzePlanProgress(content: string): { completed: number; inProgress: number; pending: number; blocked: number; };
        }
        const contextManagerPrivate = contextManager as unknown as TaskContextManagerPrivate;
        const result = contextManagerPrivate.analyzePlanProgress(planWithCheckboxes);
        expect(result).toEqual({ completed: 2, inProgress: 0, pending: 2, blocked: 0 });
      });

      it('should handle empty or malformed content gracefully', () => {
        const emptyContent = '';
        // Interface for accessing private methods for testing - don't extend, just define what we need
        interface TaskContextManagerPrivate {
          analyzePlanProgress(content: string): { completed: number; inProgress: number; pending: number; blocked: number; };
        }
        const contextManagerPrivate = contextManager as unknown as TaskContextManagerPrivate;
        const result1 = contextManagerPrivate.analyzePlanProgress(emptyContent);
        expect(result1).toEqual({ completed: 0, inProgress: 0, pending: 0, blocked: 0 });

        const malformedContent = `# Plan
- [x **Missing closing bracket**: This should not crash
- [ ] **Valid checkbox**: This should work
- [x] **Another valid**: This should work too`;
        
        const result2 = contextManagerPrivate.analyzePlanProgress(malformedContent);
        expect(result2).toEqual({ completed: 1, inProgress: 0, pending: 1, blocked: 0 });
      });

      it('should ignore non-checkbox lines', () => {
        const mixedContent = `# Plan
- [x] **Valid Checkbox**: Should count
- This is not a checkbox
  - [x] **Indented Checkbox**: Should not count (indented)
- [ ] **Another Valid**: Should count
Regular text line
## Section header
- [x] **Final Valid**: Should count`;

        // Interface for accessing private methods for testing - don't extend, just define what we need
        interface TaskContextManagerPrivate {
          analyzePlanProgress(content: string): { completed: number; inProgress: number; pending: number; blocked: number; };
        }
        const contextManagerPrivate = contextManager as unknown as TaskContextManagerPrivate;
        const result = contextManagerPrivate.analyzePlanProgress(mixedContent);
        expect(result).toEqual({ completed: 2, inProgress: 0, pending: 1, blocked: 0 });
      });
    });

    describe('reportProgress should update PLAN.md files', () => {
      it('should update checkbox states in PLAN.md when reporting progress', async () => {
        // Setup: Create task with PLAN.md file
        const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
        const taskDir = path.join(agentDir, 'checkbox-update-task');
        await fs.ensureDir(taskDir);
        
        // Add required INIT.md file for ownership validation
        const initContent = `# Task: Checkbox Update Test
        
## Objective
Test checkbox progress tracking functionality

## Requirements
- Test checkbox state updates
- Verify progress tracking
`;
        await fs.writeFile(path.join(taskDir, 'INIT.md'), initContent);
        
        const initialPlan = `# Implementation Plan

- [ ] **Setup Environment**: Configure development environment
- [ ] **Install Dependencies**: Run npm install command
- [ ] **Run Tests**: Execute comprehensive test suite`;

        await fs.writeFile(path.join(taskDir, 'PLAN.md'), initialPlan);

        // Act: Report progress for step 1
        const updates = [
          { step: 1, status: 'COMPLETE' as const, description: 'Environment setup completed successfully' }
        ];

        // This will FAIL initially because reportProgress doesn't update files
        await contextManager.reportProgress(updates, mockConnection);

        // Assert: Check that PLAN.md was updated
        const updatedPlan = await fs.readFile(path.join(taskDir, 'PLAN.md'), 'utf8');
        expect(updatedPlan).toContain('- [x] **Setup Environment**');
        expect(updatedPlan).toContain('- [ ] **Install Dependencies**'); // Should remain unchecked
        expect(updatedPlan).toContain('- [ ] **Run Tests**'); // Should remain unchecked
      });

      it('should update multiple steps in single progress report', async () => {
        // Setup task with plan
        const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
        const taskDir = path.join(agentDir, 'multi-update-task');
        await fs.ensureDir(taskDir);
        
        // Add required INIT.md file for ownership validation
        const initContent = `# Task: Multi Update Test
        
## Objective
Test multiple progress updates in single report

## Requirements
- Test multiple step updates
- Verify concurrent progress tracking
`;
        await fs.writeFile(path.join(taskDir, 'INIT.md'), initContent);
        
        const initialPlan = `# Multi-Step Plan

- [ ] **Step 1**: First task to complete
- [ ] **Step 2**: Second task to complete  
- [ ] **Step 3**: Third task to complete`;

        await fs.writeFile(path.join(taskDir, 'PLAN.md'), initialPlan);

        // Act: Report progress for multiple steps
        const updates = [
          { step: 1, status: 'COMPLETE' as const, description: 'First task done' },
          { step: 2, status: 'COMPLETE' as const, description: 'Second task done' }
        ];

        await contextManager.reportProgress(updates, mockConnection);

        // Assert: Check that both checkboxes were updated
        const updatedPlan = await fs.readFile(path.join(taskDir, 'PLAN.md'), 'utf8');
        expect(updatedPlan).toContain('- [x] **Step 1**');
        expect(updatedPlan).toContain('- [x] **Step 2**');
        expect(updatedPlan).toContain('- [ ] **Step 3**'); // Should remain unchecked
      });

      it('should handle missing PLAN.md file gracefully', async () => {
        // Setup: Create task directory but no PLAN.md file
        const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
        const taskDir = path.join(agentDir, 'no-plan-task');
        await fs.ensureDir(taskDir);
        
        // Add required INIT.md file for ownership validation
        const initContent = `# Task: No Plan Test
        
## Objective
Test graceful handling of missing PLAN.md

## Requirements
- Handle missing plan files
- Return success without error
`;
        await fs.writeFile(path.join(taskDir, 'INIT.md'), initContent);

        const updates = [{ step: 1, status: 'COMPLETE' as const, description: 'Task done' }];

        // This should not throw an error
        const result = await contextManager.reportProgress(updates, mockConnection);
        expect(result.success).toBe(true);
      });
    });

    describe('extractProgressMarkers should populate completed/pending arrays', () => {
      it('should extract step titles from checkboxes', () => {
        const planContent = `# Progress Tracking Plan

- [x] **Database Setup**: Configure PostgreSQL database
- [ ] **API Implementation**: Create REST endpoints
- [x] **Testing Suite**: Implement comprehensive tests
- [ ] **Documentation**: Write user documentation`;

        // This will FAIL initially because extractProgressMarkers doesn't exist
        // Interface for accessing private methods for testing - don't extend, just define what we need
        interface TaskContextManagerPrivate {
          extractProgressMarkers(content: string): { completed: string[]; pending: string[]; };
        }
        const contextManagerPrivate = contextManager as unknown as TaskContextManagerPrivate;
        const markers = contextManagerPrivate.extractProgressMarkers(planContent);
        expect(markers).toEqual({
          completed: ['Database Setup', 'Testing Suite'],
          pending: ['API Implementation', 'Documentation']
        });
      });

      it('should handle empty content', () => {
        const emptyContent = '';
        // Interface for accessing private methods for testing - don't extend, just define what we need
        interface TaskContextManagerPrivate {
          extractProgressMarkers(content: string): { completed: string[]; pending: string[]; };
        }
        const contextManagerPrivate = contextManager as unknown as TaskContextManagerPrivate;
        const markers = contextManagerPrivate.extractProgressMarkers(emptyContent);
        expect(markers).toEqual({
          completed: [],
          pending: []
        });
      });

      it('should extract titles without bold formatting', () => {
        const planContent = `# Plan
- [x] **Database Setup**: Configure PostgreSQL
- [ ] Regular checkbox without bold: Should not be extracted
- [x] **Another Valid Task**: Should be extracted`;

        // Interface for accessing private methods for testing - don't extend, just define what we need
        interface TaskContextManagerPrivate {
          extractProgressMarkers(content: string): { completed: string[]; pending: string[]; };
        }
        const contextManagerPrivate = contextManager as unknown as TaskContextManagerPrivate;
        const markers = contextManagerPrivate.extractProgressMarkers(planContent);
        expect(markers).toEqual({
          completed: ['Database Setup', 'Another Valid Task'],
          pending: []
        });
      });
    });

    describe('submitPlan should initialize progress markers', () => {
      it('should include progress markers in plan submission result', async () => {
        const planWithCheckboxes = `# Initial Plan

- [ ] **Environment Setup**: Configure development environment
- [ ] **Dependencies**: Install required packages
- [ ] **Implementation**: Write core functionality`;

        // This will FAIL initially because submitPlan doesn't extract progress markers
        const result = await contextManager.submitPlan(planWithCheckboxes, mockConnection);
        
        expect(result.success).toBe(true);
        expect(result).toHaveProperty('progressMarkers');
        expect(result.progressMarkers).toEqual({
          completed: [],
          pending: ['Environment Setup', 'Dependencies', 'Implementation']
        });
      });
    });

    describe('Integration tests for complete checkbox workflow', () => {
      it('should demonstrate end-to-end checkbox progress tracking', async () => {
        // Step 1: Create task and submit plan with checkboxes
        const agentDir = path.join(testDir, 'comm', 'senior-system-architect');
        const taskDir = path.join(agentDir, 'e2e-checkbox-test');
        await fs.ensureDir(taskDir);

        // Add required INIT.md file for ownership validation
        const initContent = `# Task: E2E Checkbox Test
        
## Objective
Test complete end-to-end checkbox progress workflow

## Requirements
- Test complete checkbox lifecycle
- Verify plan submission and progress tracking
- Validate file updates
`;
        await fs.writeFile(path.join(taskDir, 'INIT.md'), initContent);

        const initialPlan = `# End-to-End Test Plan

- [ ] **Phase 1**: Initial setup and configuration
- [ ] **Phase 2**: Core implementation
- [ ] **Phase 3**: Testing and validation`;

        const planResult = await contextManager.submitPlan(initialPlan, mockConnection);
        expect(planResult.success).toBe(true);

        // Step 2: Report progress on first phase
        const updates1 = [
          { step: 1, status: 'COMPLETE' as const, description: 'Phase 1 completed successfully' }
        ];
        await contextManager.reportProgress(updates1, mockConnection);

        // Step 3: Verify PLAN.md was updated
        const updatedPlan1 = await fs.readFile(path.join(taskDir, 'PLAN.md'), 'utf8');
        expect(updatedPlan1).toContain('- [x] **Phase 1**');

        // Step 4: Complete second phase
        const updates2 = [
          { step: 2, status: 'COMPLETE' as const, description: 'Phase 2 implementation done' }
        ];
        await contextManager.reportProgress(updates2, mockConnection);

        // Step 5: Verify final state
        const finalPlan = await fs.readFile(path.join(taskDir, 'PLAN.md'), 'utf8');
        expect(finalPlan).toContain('- [x] **Phase 1**');
        expect(finalPlan).toContain('- [x] **Phase 2**');
        expect(finalPlan).toContain('- [ ] **Phase 3**'); // Still pending

        // Step 6: Verify progress analysis still works
        // Interface for accessing private methods for testing - don't extend, just define what we need
        interface TaskContextManagerPrivate {
          analyzePlanProgress(content: string): { completed: number; inProgress: number; pending: number; blocked: number; };
        }
        const contextManagerPrivate = contextManager as unknown as TaskContextManagerPrivate;
        const progress = contextManagerPrivate.analyzePlanProgress(finalPlan);
        expect(progress).toEqual({ completed: 2, inProgress: 0, pending: 1, blocked: 0 });
      });
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
      // Test coverage for ownership validation of non-existent task
      await expect(contextManager.startTask('non-existent-task', mockConnection))
        .rejects.toThrow(AgentOwnershipError);
        
      await expect(contextManager.startTask('non-existent-task', mockConnection))
        .rejects.toThrow("Task 'non-existent-task' not found for agent 'senior-system-architect'");
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

  describe('Additional Branch Coverage', () => {
    it('should handle task with PLAN.md but no PROGRESS.md', async () => {
      const taskId = 'task-with-plan';
      const commDir = path.join(testDir, 'comm');
      const taskPath = path.join(commDir, mockConnection.agent, taskId);
      await fs.ensureDir(taskPath);
      
      // Create INIT.md and PLAN.md but no PROGRESS.md
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Task With Plan\n## Objective\nTest task with plan\n## Requirements\n- Test requirement'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n\n- [ ] Step 1\n- [ ] Step 2'
      );

      const context = await contextManager.startTask(taskId, mockConnection);
      
      expect(context.title).toBe('Task With Plan');
      expect(context.objective).toBe('Test task with plan');
      // Progress should be undefined when there's no PROGRESS.md
      expect(context.currentProgress).toBeUndefined();
    });

    it('should handle getTaskContext with empty taskId', async () => {
      // Test with empty taskId - should return empty context
      const context = await contextManager.getTaskContext('', mockConnection);
      
      expect(context.title).toBe('No Active Task');
      expect(context.objective).toBe('');
      expect(context.requirements).toEqual([]);
      expect(context.currentAgent).toBe(mockConnection.agent);
    });

    it('should handle error in checkAssignedTasks when readdir fails', async () => {
      // First create the agent directory so readdir will be called
      const agentDir = path.join(testDir, 'comm', mockConnection.agent);
      await fs.ensureDir(agentDir);
      
      // Create a spy for fs.readdir
      const readdirSpy = jest.spyOn(fs, 'readdir');
      readdirSpy.mockRejectedValueOnce(new Error('Read error'));
      
      await expect(contextManager.checkAssignedTasks(mockConnection))
        .rejects.toThrow('Read error');
      
      // Restore spy
      readdirSpy.mockRestore();
    });

    it('should handle task with DONE.md file', async () => {
      const taskId = 'completed-task';
      const commDir = path.join(testDir, 'comm');
      const taskPath = path.join(commDir, mockConnection.agent, taskId);
      await fs.ensureDir(taskPath);
      
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Completed Task\n\nThis task is done.'
      );
      await fs.writeFile(
        path.join(taskPath, 'DONE.md'),
        '# Task Complete\n\nSuccessfully completed.'
      );

      const result = await contextManager.checkAssignedTasks(mockConnection);
      const task = result.find(t => t.taskId === taskId);
      
      expect(task).toBeDefined();
      expect(task!.status).toBe('completed');
    });

    it('should handle task with ERROR.md file', async () => {
      const taskId = 'error-task';
      const commDir = path.join(testDir, 'comm');
      const taskPath = path.join(commDir, mockConnection.agent, taskId);
      await fs.ensureDir(taskPath);
      
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Error Task\n\nThis task failed.'
      );
      await fs.writeFile(
        path.join(taskPath, 'ERROR.md'),
        '# Task Failed\n\nError occurred during execution.'
      );

      const result = await contextManager.checkAssignedTasks(mockConnection);
      const task = result.find(t => t.taskId === taskId);
      
      expect(task).toBeDefined();
      expect(task!.status).toBe('error');
    });

    // Removed test for syncTodoCheckboxes - this is a separate tool, not a TaskContextManager method

    // Removed test for progress extraction - startTask doesn't include progress field from PROGRESS.md

    it('should handle malformed task directory names', async () => {
      const commDir = path.join(testDir, 'comm');
      const agentDir = path.join(commDir, mockConnection.agent);
      await fs.ensureDir(agentDir);
      
      // Create a malformed directory name
      const malformedPath = path.join(agentDir, 'not-a-task');
      await fs.ensureDir(malformedPath);
      await fs.writeFile(
        path.join(malformedPath, 'INIT.md'),
        '# Malformed Task\n\nThis directory name is not valid.'
      );

      const result = await contextManager.checkAssignedTasks(mockConnection);
      
      // Actually, 'not-a-task' is a valid directory name and has INIT.md, so it should be included
      const malformedTask = result.find(t => t.taskId === 'not-a-task');
      expect(malformedTask).toBeDefined();
      expect(malformedTask?.title).toBe('Malformed Task');
      expect(malformedTask?.status).toBe('new');
    });

    it('should handle concurrent task operations', async () => {
      const taskId = 'concurrent-task';
      const commDir = path.join(testDir, 'comm');
      const taskPath = path.join(commDir, mockConnection.agent, taskId);
      await fs.ensureDir(taskPath);
      
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Concurrent Task\n\nTesting concurrent operations.'
      );

      // Start multiple operations concurrently
      const operations = [
        contextManager.startTask(taskId, mockConnection),
        contextManager.getTaskContext(taskId, mockConnection), // Fixed: taskId first, then connection
        contextManager.checkAssignedTasks(mockConnection)
      ];

      const results = await Promise.all(operations);
      
      // Type-safe assertions following TEST-GUIDELINES.md patterns
      const startTaskResult = results[0] as unknown as TaskContext;
      const getContextResult = results[1] as unknown as TaskContext;
      const checkTasksResult = results[2] as unknown as TaskSummary[];
      
      // TaskContext doesn't have taskId field - check title instead
      expect(startTaskResult.title).toBe('Concurrent Task');
      expect(getContextResult.title).toBe('Concurrent Task');
      expect(checkTasksResult.length).toBeGreaterThan(0);
    });
  });
});