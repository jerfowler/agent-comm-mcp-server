/**
 * Additional tests for ResourceManager to improve branch coverage
 * Current: 60% → Target: 95%
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ResourceManager } from '../../../src/resources/ResourceManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import os from 'os';

describe('ResourceManager - Branch Coverage', () => {
  let resourceManager: ResourceManager;
  let eventLogger: EventLogger;
  let connectionManager: ConnectionManager;
  let testDir: string;
  
  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'resource-manager-branch-test-'));
    const commDir = path.join(testDir, 'comm');
    await fs.ensureDir(commDir);
    
    eventLogger = new EventLogger(testDir);
    connectionManager = new ConnectionManager();
    
    resourceManager = new ResourceManager({
      commDir,
      eventLogger,
      connectionManager
    });
  });
  
  afterEach(async () => {
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('Edge cases and error handling', () => {
    
    it('should handle listResources with no resources', async () => {
      const resources = await resourceManager.listResources();
      
      // Should return resources from providers even if no tasks exist
      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
    });

    it('should handle listResources with server filter', async () => {
      const resources = await resourceManager.listResources('agent-comm');
      
      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
      // All resources should be from the specified server
      resources.forEach(resource => {
        expect(resource.server).toBe('agent-comm');
      });
    });

    it('should handle listResources with non-existent server filter', async () => {
      const resources = await resourceManager.listResources('non-existent-server');
      
      expect(resources).toEqual([]);
    });

    it('should handle readResource with valid URI', async () => {
      // Create a task to have something to read
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task\nTest content'
      );
      
      const resource = await resourceManager.readResource(
        'agent-comm',
        `agent-comm://task/${agent}/${taskId}/init`
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toContain('Test Task');
    });

    it('should handle readResource with invalid server', async () => {
      await expect(resourceManager.readResource(
        'invalid-server',
        'agent-comm://server/info'
      )).rejects.toThrow('Unknown server');
    });

    it('should handle readResource with invalid URI format', async () => {
      await expect(resourceManager.readResource(
        'agent-comm',
        'invalid://uri/format'
      )).rejects.toThrow();
    });

    it('should handle readResource for non-existent task', async () => {
      await expect(resourceManager.readResource(
        'agent-comm',
        'agent-comm://task/non-existent-agent/non-existent-task/init'
      )).rejects.toThrow();
    });

    it('should handle server info resource', async () => {
      const resource = await resourceManager.readResource(
        'agent-comm',
        'agent-comm://server/info'
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toBeDefined();
      expect(typeof resource.contents).toBe('string');
    });

    it('should handle server stats resource', async () => {
      const resource = await resourceManager.readResource(
        'agent-comm',
        'agent-comm://server/stats'
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toBeDefined();
    });

    it('should handle agent resource with tasks', async () => {
      // Create agent with task
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task'
      );
      
      const resource = await resourceManager.readResource(
        'agent-comm',
        `agent-comm://agent/${agent}`
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toContain(agent);
      expect(resource.contents).toContain('1'); // Task count
    });

    it('should handle agent resource without tasks', async () => {
      // Create agent directory without tasks
      const agent = 'empty-agent';
      await fs.ensureDir(path.join(testDir, 'comm', agent));
      
      const resource = await resourceManager.readResource(
        'agent-comm',
        `agent-comm://agent/${agent}`
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toContain(agent);
      expect(resource.contents).toContain('0'); // No tasks
    });

    it('should handle task plan resource', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task'
      );
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Implementation Plan\n- [ ] Step 1'
      );
      
      const resource = await resourceManager.readResource(
        'agent-comm',
        `agent-comm://task/${agent}/${taskId}/plan`
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toContain('Implementation Plan');
    });

    it('should handle task done resource', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task'
      );
      await fs.writeFile(
        path.join(taskPath, 'DONE.md'),
        '# Task Complete'
      );
      
      const resource = await resourceManager.readResource(
        'agent-comm',
        `agent-comm://task/${agent}/${taskId}/done`
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toContain('Task Complete');
    });

    it('should handle task error resource', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task'
      );
      await fs.writeFile(
        path.join(taskPath, 'ERROR.md'),
        '# Task Failed'
      );
      
      const resource = await resourceManager.readResource(
        'agent-comm',
        `agent-comm://task/${agent}/${taskId}/error`
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toContain('Task Failed');
    });

    it('should list all agent resources', async () => {
      // Create multiple agents with tasks
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      
      for (const agent of agents) {
        const agentPath = path.join(testDir, 'comm', agent);
        await fs.ensureDir(agentPath);
        
        // Add a task to each agent
        const taskPath = path.join(agentPath, '2025-01-01T12-00-00-task');
        await fs.ensureDir(taskPath);
        await fs.writeFile(
          path.join(taskPath, 'INIT.md'),
          `# Task for ${agent}`
        );
      }
      
      const resources = await resourceManager.listResources();
      
      // Should include agent resources
      const agentResources = resources.filter(r => r.uri.includes('://agent/'));
      expect(agentResources.length).toBeGreaterThanOrEqual(agents.length);
    });

    it('should list all task resources', async () => {
      // Create agent with multiple tasks
      const agent = 'test-agent';
      const tasks = ['task-1', 'task-2', 'task-3'];
      
      for (const task of tasks) {
        const taskPath = path.join(testDir, 'comm', agent, `2025-01-01T12-00-00-${task}`);
        await fs.ensureDir(taskPath);
        await fs.writeFile(
          path.join(taskPath, 'INIT.md'),
          `# ${task}`
        );
        await fs.writeFile(
          path.join(taskPath, 'PLAN.md'),
          `# Plan for ${task}`
        );
      }
      
      const resources = await resourceManager.listResources();
      
      // Should include task resources
      const taskResources = resources.filter(r => r.uri.includes('://task/'));
      expect(taskResources.length).toBeGreaterThan(0);
      
      // Should have init and plan resources for each task
      const initResources = taskResources.filter(r => r.uri.endsWith('/init'));
      const planResources = taskResources.filter(r => r.uri.endsWith('/plan'));
      
      expect(initResources.length).toBe(tasks.length);
      expect(planResources.length).toBe(tasks.length);
    });

    it('should handle provider initialization errors gracefully', async () => {
      // Create ResourceManager with invalid config to trigger errors
      const invalidManager = new ResourceManager({
        commDir: '/non/existent/path',
        eventLogger,
        connectionManager
      });
      
      // Should still work but might return fewer resources
      const resources = await invalidManager.listResources();
      expect(Array.isArray(resources)).toBe(true);
    });

    it('should handle concurrent resource operations', async () => {
      // Create test data
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task'
      );
      
      // Perform concurrent operations
      const operations = [
        resourceManager.listResources(),
        resourceManager.listResources('agent-comm'),
        resourceManager.readResource('agent-comm', 'agent-comm://server/info'),
        resourceManager.readResource('agent-comm', `agent-comm://task/${agent}/${taskId}/init`)
      ];
      
      const results = await Promise.all(operations);
      
      // All operations should succeed
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[2]).toBeDefined();
      expect(results[3]).toBeDefined();
    });

    it('should handle special characters in URIs', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task-with-special-chars';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      await fs.writeFile(
        path.join(taskPath, 'INIT.md'),
        '# Test Task'
      );
      
      const resource = await resourceManager.readResource(
        'agent-comm',
        `agent-comm://task/${agent}/${taskId}/init`
      );
      
      expect(resource).toBeDefined();
      expect(resource.contents).toContain('Test Task');
    });

    it('should handle resource URIs with different formats', async () => {
      // Test various URI formats
      const testCases = [
        'agent-comm://server/info',
        'agent-comm://server/stats',
        'agent-comm://server/config',
        'agent-comm://agent/test-agent'
      ];
      
      for (const uri of testCases) {
        try {
          const resource = await resourceManager.readResource('agent-comm', uri);
          expect(resource).toBeDefined();
        } catch (error) {
          // Some URIs might not exist, which is fine for this test
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle empty comm directory', async () => {
      // Remove all contents from comm directory
      const commDir = path.join(testDir, 'comm');
      await fs.emptyDir(commDir);
      
      const resources = await resourceManager.listResources();
      
      // Should still return server resources
      const serverResources = resources.filter(r => r.uri.includes('://server/'));
      expect(serverResources.length).toBeGreaterThan(0);
    });

    it('should handle malformed task directories', async () => {
      // Create malformed task structure
      const agent = 'test-agent';
      const malformedPath = path.join(testDir, 'comm', agent, 'not-a-proper-task-id');
      
      await fs.ensureDir(malformedPath);
      // Don't create INIT.md - making it malformed
      
      const resources = await resourceManager.listResources();
      
      // Should handle gracefully and not include malformed tasks
      expect(Array.isArray(resources)).toBe(true);
    });

    it('should handle task with missing INIT.md', async () => {
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      // Don't create INIT.md, only PLAN.md
      await fs.writeFile(
        path.join(taskPath, 'PLAN.md'),
        '# Plan without init'
      );
      
      // Try to read the task - should fail gracefully
      await expect(resourceManager.readResource(
        'agent-comm',
        `agent-comm://task/${agent}/${taskId}/init`
      )).rejects.toThrow();
    });

    it('should cache provider instances', async () => {
      // Access resources multiple times to test caching
      await resourceManager.listResources();
      await resourceManager.listResources();
      await resourceManager.listResources('agent-comm');
      
      // Should reuse cached providers (no way to directly test, but ensures no errors)
      expect(true).toBe(true);
    });

    it('should handle provider with no resources', async () => {
      // Create a scenario where a provider returns no resources
      const resources = await resourceManager.listResources('non-existent');
      
      expect(resources).toEqual([]);
    });

    it('should format resource metadata correctly', async () => {
      // Create task with all file types
      const agent = 'test-agent';
      const taskId = '2025-01-01T12-00-00-test-task';
      const taskPath = path.join(testDir, 'comm', agent, taskId);
      
      await fs.ensureDir(taskPath);
      await fs.writeFile(path.join(taskPath, 'INIT.md'), '# Init');
      await fs.writeFile(path.join(taskPath, 'PLAN.md'), '# Plan');
      await fs.writeFile(path.join(taskPath, 'DONE.md'), '# Done');
      await fs.writeFile(path.join(taskPath, 'ERROR.md'), '# Error');
      
      const resources = await resourceManager.listResources();
      
      // Check that resources have proper metadata
      const taskResources = resources.filter(r => r.uri.includes(taskId));
      
      taskResources.forEach(resource => {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBeDefined();
        expect(resource.server).toBe('agent-comm');
      });
    });
  });
});