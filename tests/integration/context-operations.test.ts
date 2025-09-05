/**
 * Comprehensive test suite for MCP Server context-based operations
 * Tests the new context-based API that abstracts file system operations
 * 
 * Key Features:
 * - File system abstraction (no exposed paths)
 * - Auto-context injection for delegated tasks
 * - JSON Lines logging with metadata
 * - Session management via ConnectionManager
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { tmpdir } from 'os';

// Import context-based tools
import { checkTasks } from '../../src/tools/check-tasks.js';
import { createTaskTool } from '../../src/tools/create-task.js';

// Import types
import { ServerConfig } from '../../src/types.js';
import { testUtils } from '../utils/testUtils.js';

describe('MCP Server Context-Based Operations', () => {
  let testDir: string;
  let commDir: string;
  let config: ServerConfig;

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'v13-context-test-'));
    commDir = path.join(testDir, 'comm');
    
    config = testUtils.createMockConfig({
      commDir: commDir,
      enableArchiving: true,
      archiveDir: path.join(commDir, '.archive')
    });
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  beforeEach(async () => {
    await fs.remove(commDir);
    await fs.ensureDir(commDir);
  });

  describe('1. Context-Based Format Support', () => {
    it('should always use context format in checkTasks', async () => {
      const agent = 'test-agent';
      
      // Create test tasks first
      const agentDir = path.join(commDir, agent);
      await fs.ensureDir(agentDir);
      
      // Create a task directory with INIT.md
      const taskDir = path.join(agentDir, 'test-task-001');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        `# Task: Test Context Task\n## Metadata\n- Agent: ${agent}\n- Created: 2025-01-01T12:00:00Z\n\n## Objective\nTest context-based operations`
      );
      
      // Test context format (always used)
      const result = await checkTasks(config, { agent });
      
      expect(result).toHaveProperty('message');
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]).toHaveProperty('taskId');
      expect(result.tasks[0]).toHaveProperty('title');
      expect(result.tasks[0]).toHaveProperty('status');
      expect(result.tasks[0]).not.toHaveProperty('path'); // Should be abstracted
      expect(result.tasks[0]).not.toHaveProperty('name'); // legacy format
    });

    it('should handle task discovery correctly', async () => {
      const agent = 'test-agent';
      
      // Create test task structure
      const agentDir = path.join(commDir, agent);
      await fs.ensureDir(agentDir);
      
      // Create task with PLAN.md (should be in_progress)
      const taskDir = path.join(agentDir, 'active-task');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        `# Task: Active Task\n## Objective\nTest active task detection`
      );
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        `# Plan: Active Task\n1. [→ IN PROGRESS] Working on first step\n2. [PENDING] Next step`
      );
      
      const result = await checkTasks(config, { agent });
      
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].status).toBe('in_progress');
      expect(result.activeCount).toBe(1);
      expect(result.newCount).toBe(0);
    });
  });

  describe('2. Auto-Context Injection', () => {
    it('should always inject protocol context and return filename only', async () => {
      const targetAgent = 'frontend-engineer';
      const taskName = 'implement-dashboard';
      const originalContent = '# Dashboard Task\n\nImplement user dashboard';
      
      // Always uses context format with auto-injection
      const result = await createTaskTool(config, {
        targetAgent,
        taskName,
        content: originalContent
      });
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('path'); // Context format doesn't expose paths
      expect(result.taskId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-implement-dashboard$/);
      
      // Verify content was enhanced with protocol instructions
      const agentDir = path.join(commDir, targetAgent);
      const taskDirs = await fs.readdir(agentDir);
      expect(taskDirs).toHaveLength(1);
      
      // Read the INIT.md file from the task directory
      const taskContent = await fs.readFile(
        path.join(agentDir, taskDirs[0], 'INIT.md'), 
        'utf8'
      );
      
      // Content should contain the original text plus protocol instructions
      expect(taskContent).toContain('Dashboard Task');
      expect(taskContent).toContain('Implement user dashboard');
      expect(taskContent).toContain('MCP Protocol Instructions');
      expect(taskContent).toContain('check_assigned_tasks()');
      expect(taskContent).toContain('Never reference file paths');
    });

    it('should provide helpful context information in delegated tasks', async () => {
      const targetAgent = 'backend-engineer';
      const taskName = 'implement-api';
      const originalContent = '# API Task\n\nImplement REST API endpoints';
      
      const result = await createTaskTool(config, {
        targetAgent,
        taskName,
        content: originalContent
      });
      
      expect(result.success).toBe(true);
      expect(result.message).toBe(`Task successfully delegated to ${targetAgent}`);
      
      // Verify protocol instructions were added
      const agentDir = path.join(commDir, targetAgent);
      const taskDirs = await fs.readdir(agentDir);
      expect(taskDirs).toHaveLength(1);
      
      // Read the INIT.md file from the task directory
      const taskContent = await fs.readFile(
        path.join(agentDir, taskDirs[0], 'INIT.md'), 
        'utf8'
      );
      
      // Content should contain the original text plus protocol instructions (always injected)
      expect(taskContent).toContain('API Task'); 
      expect(taskContent).toContain('Implement REST API endpoints');
      expect(taskContent).toContain('MCP Protocol Instructions');
      expect(taskContent).toContain('Todo System for Task Tracking');
    });
  });

  describe('3. File System Abstraction', () => {
    it('should never expose file paths in context-based responses', async () => {
      const agent = 'security-analyst';
      
      // Create complex task structure
      const agentDir = path.join(commDir, agent);
      await fs.ensureDir(agentDir);
      
      // Create multiple task directories
      for (let i = 0; i < 3; i++) {
        const taskDir = path.join(agentDir, `security-task-${i}`);
        await fs.ensureDir(taskDir);
        
        await fs.writeFile(
          path.join(taskDir, 'INIT.md'),
          `# Task: Security Analysis ${i}\n## Objective\nAnalyze security vulnerabilities`
        );
        
        if (i > 0) {
          await fs.writeFile(
            path.join(taskDir, 'PLAN.md'),
            `# Plan\n1. [PENDING] Step 1\n2. [→ IN PROGRESS] Step 2`
          );
        }
        
        if (i === 2) {
          await fs.writeFile(
            path.join(taskDir, 'DONE.md'),
            `# Completed\nSecurity analysis complete`
          );
        }
      }
      
      // Test context format
      const result = await checkTasks(config, { 
        agent 
      });
      
      expect(result.tasks).toHaveLength(3);
      
      // Verify no file paths anywhere in response
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('/comm/');
      expect(resultStr).not.toContain('INIT.md');
      expect(resultStr).not.toContain('PLAN.md');
      expect(resultStr).not.toContain('DONE.md');
      expect(resultStr).not.toContain(testDir);
      
      // Verify task IDs and titles are present
      result.tasks.forEach(task => {
        expect(task.taskId).toMatch(/^security-task-\d$/);
        expect(task.title).toContain('Security Analysis');
        expect(['new', 'in_progress', 'completed', 'error']).toContain(task.status);
      });
    });

    it('should provide meaningful task context without exposing internals', async () => {
      const agent = 'ai-ml-engineer';
      const taskDir = path.join(commDir, agent, 'ml-model-training');
      
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        `# Task: ML Model Training
## Metadata
- Agent: ${agent}
- Created: 2025-01-01T12:00:00Z

## Objective
Train and deploy machine learning model for user behavior prediction

## Requirements
- TensorFlow 2.x framework
- GPU acceleration support
- Model accuracy >95%
- Real-time inference capability`
      );
      
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        `# Implementation Plan
## Steps
1. [✓ COMPLETE] Data preprocessing and feature engineering
2. [→ IN PROGRESS] Model architecture design and hyperparameter tuning
3. [PENDING] Model training with validation
4. [PENDING] Model deployment and API integration
5. [PENDING] Performance monitoring setup`
      );
      
      const result = await checkTasks(config, { 
        agent 
      });
      
      expect(result.tasks).toHaveLength(1);
      const task = result.tasks[0];
      
      expect(task.taskId).toBe('ml-model-training');
      expect(task.title).toBe('ML Model Training');
      expect(task.status).toBe('in_progress');
      expect(task.progress).toBeDefined();
      expect(task.progress!.completed).toBe(1);
      expect(task.progress!.inProgress).toBe(1);
      expect(task.progress!.pending).toBe(3);
    });
  });

  describe('4. Component Integration', () => {
    it('should integrate with ConnectionManager and EventLogger', async () => {
      const agent = 'devops-engineer';
      
      // Verify config has required components
      expect(config.connectionManager).toBeDefined();
      expect(config.eventLogger).toBeDefined();
      
      // Verify components have expected methods
      expect(typeof config.eventLogger.logOperation).toBe('function');
      expect(typeof config.eventLogger.getOperationStatistics).toBe('function');
      expect(typeof config.connectionManager.getConnectionCount).toBe('function');
      
      // Perform operations that should call the logger
      await checkTasks(config, { agent });
      await createTaskTool(config, {
        agent: agent,
        taskName: 'deploy-infrastructure',
        content: '# Deployment Task\nDeploy to production environment',
        format: 'context'
      });
      
      // Verify logger functionality by checking operation statistics
      const stats = await config.eventLogger.getOperationStatistics();
      expect(stats).toBeDefined();
      
      // Check connection manager functionality
      expect(config.connectionManager.getConnectionCount()).toBeDefined();
    });

    it('should handle errors gracefully with logging', async () => {
      const invalidConfig = {
        commDir: '/nonexistent/directory',
        archiveDir: '/nonexistent/archive',
        logDir: '/nonexistent/logs',
        enableArchiving: false,
        connectionManager: config.connectionManager,
        eventLogger: config.eventLogger
      };
      
      // This should handle errors gracefully
      const result = await checkTasks(invalidConfig, { 
        agent: 'test-agent' 
      });
      
      expect(result.tasks).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.message).toContain('No tasks currently assigned');
    });
  });

  describe('5. Context-Based Task Discovery', () => {
    it('should find tasks only from structured directories', async () => {
      const agent = 'product-manager';
      
      // Create task structures that follow context-based format
      const agentDir = path.join(commDir, agent);
      await fs.ensureDir(agentDir);
      
      // Create new task (directory with INIT.md but no PLAN.md)
      const newTaskDir = path.join(agentDir, 'feature-planning');
      await fs.ensureDir(newTaskDir);
      await fs.writeFile(
        path.join(newTaskDir, 'INIT.md'),
        `# Task: Feature Planning\n## Objective\nPlan product features for Q1`
      );
      
      // Create active task (directory with INIT.md and PLAN.md but no DONE.md) 
      const activeTaskDir = path.join(agentDir, 'market-analysis');
      await fs.ensureDir(activeTaskDir);
      await fs.writeFile(
        path.join(activeTaskDir, 'INIT.md'),
        `# Task: Market Analysis\n## Objective\nAnalyze market trends`
      );
      await fs.writeFile(
        path.join(activeTaskDir, 'PLAN.md'),
        `# Plan\n1. [→ IN PROGRESS] Research competitors`
      );
      
      // Files directly in agent directory should be ignored  
      await fs.writeFile(
        path.join(agentDir, 'ignored-file.md'),
        `# This should be ignored\nNot a structured task`
      );
      
      const result = await checkTasks(config, { agent });
      
      expect(result.tasks).toHaveLength(2);
      expect(result.newCount).toBe(1); // feature-planning task (no PLAN.md)
      expect(result.activeCount).toBe(1); // market-analysis task (has PLAN.md)
      
      // Verify context format structure (TaskSummary objects)
      result.tasks.forEach(task => {
        expect(task).toHaveProperty('taskId');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('status');
        expect(['new', 'in_progress', 'completed', 'error']).toContain(task.status);
        
        // Progress is optional
        if (task.progress) {
          expect(task.progress).toHaveProperty('completed');
          expect(task.progress).toHaveProperty('inProgress');
          expect(task.progress).toHaveProperty('pending');
        }
      });
      
      // Test delegation (always uses context format)
      const delegateResult = await createTaskTool(config, {
        agent: agent,
        taskName: 'competitor-analysis',
        content: '# Competitor Analysis\nAnalyze key competitors'
      });
      
      expect(delegateResult).not.toHaveProperty('path'); // Context format doesn't expose paths
      expect(delegateResult).toHaveProperty('filename'); // Only exposes filename
      expect(delegateResult).toHaveProperty('message');
      expect(delegateResult).toHaveProperty('taskCreated');
      expect(delegateResult.success).toBe(true);
    });

    it('should allow explicit opt-in to context features', async () => {
      const agent = 'ux-designer';
      
      // Create initialized task for context format (requires task directory with INIT.md)
      const agentDir = path.join(commDir, agent);
      await fs.ensureDir(agentDir);
      
      const taskDir = path.join(agentDir, 'ui-mockup-design');
      await fs.ensureDir(taskDir);
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        `# Task: UI Mockup Design\n## Objective\nCreate user interface mockups`
      );
      
      // Test context format (explicit opt-in)
      const v13Result = await checkTasks(config, { 
        agent 
      });
      
      expect(v13Result).toHaveProperty('message');
      expect(v13Result.tasks).toHaveLength(1);
      
      // Verify context format structure
      const task = v13Result.tasks[0];
      expect(task).toHaveProperty('taskId');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('status');
      expect(task).not.toHaveProperty('name');
      expect(task).not.toHaveProperty('path');
      expect(task).not.toHaveProperty('isNew');
    });
  });

  describe('6. Performance and Reliability', () => {
    it('should handle large numbers of tasks efficiently in context format', async () => {
      const agent = 'qa-engineer';
      const agentDir = path.join(commDir, agent);
      await fs.ensureDir(agentDir);
      
      // Create 50 tasks
      const taskCreationPromises = [];
      for (let i = 0; i < 50; i++) {
        const taskPromise = (async () => {
          const taskDir = path.join(agentDir, `test-case-${i.toString().padStart(3, '0')}`);
          await fs.ensureDir(taskDir);
          await fs.writeFile(
            path.join(taskDir, 'INIT.md'),
            `# Task: Test Case ${i}\n## Objective\nExecute automated test case ${i}`
          );
          
          // Add progress for some tasks
          if (i % 3 === 0) {
            await fs.writeFile(
              path.join(taskDir, 'PLAN.md'),
              `# Plan\n1. [✓ COMPLETE] Setup test environment\n2. [→ IN PROGRESS] Execute tests`
            );
          }
          
          // Complete some tasks
          if (i % 7 === 0) {
            await fs.writeFile(
              path.join(taskDir, 'DONE.md'),
              `# Test Complete\nAll test cases passed`
            );
          }
        })();
        taskCreationPromises.push(taskPromise);
      }
      
      await Promise.all(taskCreationPromises);
      
      // Test context format performance
      const startTime = Date.now();
      const result = await checkTasks(config, { 
        agent 
      });
      const duration = Date.now() - startTime;
      
      expect(result.tasks).toHaveLength(50);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      // Verify no file paths exposed
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('/comm/');
      expect(resultStr).not.toContain('.md');
      
      // Verify correct status distribution
      const statuses = result.tasks.map(t => t.status);
      expect(statuses.filter(s => s === 'completed').length).toBeGreaterThan(0);
      expect(statuses.filter(s => s === 'in_progress').length).toBeGreaterThan(0);
      expect(statuses.filter(s => s === 'new').length).toBeGreaterThan(0);
    });
  });
});