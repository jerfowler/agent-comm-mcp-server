/**
 * Integration tests for README example scenarios
 * Tests that each README prompt example works as intended
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readmeTestHelpers, TaskScenarioContext } from '../utils/readme-test-helpers.js';

describe('README Example Scenarios', () => {
  let context: TaskScenarioContext;

  beforeEach(async () => {
    context = await readmeTestHelpers.createTaskScenarioContext();
  });

  afterEach(async () => {
    await readmeTestHelpers.cleanupTaskScenarioContext(context);
  });

  describe('Delegate Task Example', () => {
    it('should delegate task with MCP server reference', async () => {
      // Simulates: "Using the agent-comm MCP server, delegate this task to senior-frontend-engineer"
      const result = await readmeTestHelpers.simulateDelegateTaskPrompt(
        context,
        'senior-frontend-engineer',
        'Implement a responsive dashboard component with real-time data updates and dark mode support'
      );

      // Verify expected response structure
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(typeof result.taskId).toBe('string');
      expect(result.tracking).toBeDefined();
      expect(result.tracking.progress_command).toContain('track_task_progress');
      expect(result.tracking.lifecycle_command).toContain('get_full_lifecycle');

      // Verify task was created with proper lifecycle structure
      await readmeTestHelpers.assertTaskLifecycle(
        context,
        'senior-frontend-engineer',
        result.taskId
      );
    });

    it('should handle task name and content correctly', async () => {
      const customContent = 'Create advanced React components with TypeScript';
      const result = await readmeTestHelpers.simulateDelegateTaskPrompt(
        context,
        'senior-frontend-engineer',
        customContent
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toMatch(/^2025-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/); // Timestamp format
      expect(result.taskId).toContain('implement-dashboard-component');
    });

    it('should support different agent types', async () => {
      const result = await readmeTestHelpers.simulateDelegateTaskPrompt(
        context,
        'senior-backend-engineer',
        'Build scalable API endpoints'
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      
      // Verify task was created for correct agent
      await readmeTestHelpers.assertTaskLifecycle(
        context,
        'senior-backend-engineer',
        result.taskId
      );
    });
  });

  describe('Monitor Progress Example', () => {
    beforeEach(async () => {
      // Create a task first to monitor
      await readmeTestHelpers.simulateDelegateTaskPrompt(
        context,
        'senior-frontend-engineer'
      );
    });

    it('should track task progress for existing task', async () => {
      // Simulates: "Using the MCP agent-comm tools, check the progress of the dashboard task"
      const result = await readmeTestHelpers.simulateMonitorProgressPrompt(
        context,
        'senior-frontend-engineer'
      );

      // Verify expected response structure from README example
      expect(result.status).toBeDefined();
      expect(['pending', 'in_progress', 'completed', 'error']).toContain(result.status);
      
      if (result.progress) {
        expect(result.progress).toHaveProperty('percentage');
        expect(result.progress).toHaveProperty('completed_steps');
        expect(result.progress).toHaveProperty('total_steps');
      }
    });

    it('should return meaningful progress information', async () => {
      const result = await readmeTestHelpers.simulateMonitorProgressPrompt(
        context,
        'senior-frontend-engineer'
      );

      // Validate response matches documented format
      expect(readmeTestHelpers.validateToolResponse(result, ['status'])).toBe(true);
      
      if (result.progress) {
        expect(readmeTestHelpers.validateToolResponse(
          result.progress, 
          ['percentage', 'completed_steps', 'total_steps']
        )).toBe(true);
      }
    });

    it('should handle non-existent tasks gracefully', async () => {
      // Test monitoring progress for agent with no tasks
      await expect(
        readmeTestHelpers.simulateMonitorProgressPrompt(context, 'non-existent-agent')
      ).rejects.toThrow('No tasks found for agent');
    });
  });

  describe('Lifecycle Analysis Example', () => {
    beforeEach(async () => {
      // Create a task first to analyze
      await readmeTestHelpers.simulateDelegateTaskPrompt(
        context,
        'senior-frontend-engineer'
      );
    });

    it('should provide complete task lifecycle', async () => {
      // Simulates: "Use the agent-comm MCP server to show me the complete lifecycle analysis"
      const result = await readmeTestHelpers.simulateLifecycleAnalysisPrompt(
        context,
        'senior-frontend-engineer'
      );

      // Verify expected response structure from README
      expect(result.lifecycle).toBeDefined();
      expect(result.summary).toBeDefined();
      
      // Verify lifecycle contains expected phases
      expect(result.lifecycle.init).toBeDefined();
      expect(result.lifecycle.init.exists).toBe(true);
      
      // Summary should contain key metrics
      expect(result.summary.final_status).toBeDefined();
      expect(result.summary.progress_percentage).toBeDefined();
    });

    it('should include init, plan, and outcome information', async () => {
      const result = await readmeTestHelpers.simulateLifecycleAnalysisPrompt(
        context,
        'senior-frontend-engineer'
      );

      // Validate complete lifecycle structure
      expect(result.lifecycle.init).toHaveProperty('exists');
      expect(result.lifecycle.init).toHaveProperty('content');
      
      // Summary should provide actionable information
      expect(result.summary).toHaveProperty('final_status');
      expect(result.summary).toHaveProperty('progress_percentage');
    });

    it('should handle different task states', async () => {
      const result = await readmeTestHelpers.simulateLifecycleAnalysisPrompt(
        context,
        'senior-frontend-engineer'
      );

      // Should work for tasks in various states
      expect(['new', 'in_progress', 'completed', 'error']).toContain(result.summary.final_status);
    });
  });

  describe('Parallel Tasks Example', () => {
    it('should create multiple tasks without blocking', async () => {
      const startTime = Date.now();
      
      // Simulates: "Using the agent-comm MCP tools, create these tasks in parallel"
      const results = await readmeTestHelpers.simulateParallelTasksPrompt(context);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify all tasks were created
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      });

      // Should execute in parallel (much faster than sequential)
      // If tasks were sequential, it would take much longer
      expect(executionTime).toBeLessThan(5000); // 5 seconds max for parallel execution
    });

    it('should assign to different agents correctly', async () => {
      const results = await readmeTestHelpers.simulateParallelTasksPrompt(context);

      // Verify tasks were created for correct agents
      const expectedAgents = ['senior-backend-engineer', 'senior-frontend-engineer', 'qa-test-automation-engineer'];
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const expectedAgent = expectedAgents[i];
        
        expect(result.success).toBe(true);
        
        // Verify task exists in correct agent directory
        await readmeTestHelpers.assertTaskLifecycle(
          context,
          expectedAgent,
          result.taskId
        );
      }
    });

    it('should handle duplicate prevention', async () => {
      // Create initial tasks
      const firstRun = await readmeTestHelpers.simulateParallelTasksPrompt(context);
      
      // Try to create same tasks again (should use duplicate prevention)
      const secondRun = await readmeTestHelpers.simulateParallelTasksPrompt(context);
      
      expect(firstRun).toHaveLength(3);
      expect(secondRun).toHaveLength(3);
      
      // All should succeed (duplicate prevention should return existing tasks)
      secondRun.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Archive Tasks Example', () => {
    beforeEach(async () => {
      // Create some tasks to archive
      await readmeTestHelpers.simulateParallelTasksPrompt(context);
    });

    it('should archive completed tasks', async () => {
      // Simulates: "Use the agent-comm MCP server to archive all completed agent communication tasks"
      const result = await readmeTestHelpers.simulateArchiveTasksPrompt(context);

      // Verify expected response structure
      expect(result.success).toBe(true);
      expect(typeof result.archived).toBe('number');
      expect(result.message).toBeDefined();
    });

    it('should preserve task structure during archiving', async () => {
      const archiveResult = await readmeTestHelpers.simulateArchiveTasksPrompt(context);

      expect(archiveResult.success).toBe(true);
      
      // Archive operation should complete without errors
      expect(archiveResult.message).toContain('archive');
    });

    it('should handle empty task directory', async () => {
      // Clear all tasks first
      await readmeTestHelpers.cleanupTaskScenarioContext(context);
      context = await readmeTestHelpers.createTaskScenarioContext();

      const result = await readmeTestHelpers.simulateArchiveTasksPrompt(context);

      // Should handle no tasks gracefully
      expect(result.success).toBe(true);
      expect(result.archived).toBe(0);
    });
  });

  describe('Prompt Scenario Validation', () => {
    it('should validate all README prompt scenarios', () => {
      const scenarios = readmeTestHelpers.getReadmePromptScenarios();

      expect(scenarios).toHaveLength(5);
      
      scenarios.forEach(scenario => {
        expect(scenario.name).toBeDefined();
        expect(scenario.prompt).toBeDefined();
        expect(scenario.expectedTool).toBeDefined();
        expect(scenario.expectedParams).toBeDefined();
        expect(scenario.expectedResponse).toBeDefined();
        
        // All prompts should reference MCP
        expect(scenario.prompt.toLowerCase()).toMatch(/mcp|agent-comm/);
      });
    });

    it('should have consistent prompt formatting', () => {
      const scenarios = readmeTestHelpers.getReadmePromptScenarios();

      scenarios.forEach(scenario => {
        // Each prompt should start with "Using" or "Use" for consistency
        expect(scenario.prompt).toMatch(/^(Using|Use) (the )?(MCP )?agent-comm/);
      });
    });
  });
});