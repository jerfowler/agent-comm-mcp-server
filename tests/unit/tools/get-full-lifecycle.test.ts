/**
 * get_full_lifecycle Tool Tests (TDD Phase 2)
 * Test-Driven Development for complete task lifecycle visibility
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import * as os from 'os';
import { testUtils } from '../../utils/testUtils.js';

// This import should FAIL initially until we implement the tool
import { getFullLifecycle } from '../../../src/tools/get-full-lifecycle.js';
import { ServerConfig } from '../../../src/types.js';

describe('get_full_lifecycle Tool (TDD)', () => {
  let config: ServerConfig;
  let tempDir: string;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'get-lifecycle-test-'));
    testDir = path.join(tempDir, 'comm', 'test-agent');
    
    config = testUtils.createMockConfig({
      commDir: path.join(tempDir, 'comm'),
      archiveDir: path.join(tempDir, 'comm', '.archive'),
      enableArchiving: true
    });
    
    // Ensure directories exist
    await fs.ensureDir(config.commDir);
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    // Clean up test files
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('TDD RED: Write failing tests first', () => {
    it('should return complete lifecycle for fully completed task', async () => {
      // Setup: Create task with full lifecycle
      const taskDir = path.join(testDir, 'completed-lifecycle-task');
      await fs.ensureDir(taskDir);
      
      const initTime = new Date('2025-01-01T10:00:00Z');
      const planTime = new Date('2025-01-01T10:05:00Z');
      const doneTime = new Date('2025-01-01T10:30:00Z');
      
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        testUtils.sampleTaskContent
      );
      
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Implementation Plan\n1. [✓ COMPLETE] Step 1\n2. [✓ COMPLETE] Step 2\n3. [✓ COMPLETE] Step 3'
      );
      
      await fs.writeFile(
        path.join(taskDir, 'DONE.md'),
        '# Task Complete\nAll objectives achieved successfully.'
      );
      
      // Set file times to simulate progression
      await fs.utimes(path.join(taskDir, 'INIT.md'), initTime, initTime);
      await fs.utimes(path.join(taskDir, 'PLAN.md'), planTime, planTime);
      await fs.utimes(path.join(taskDir, 'DONE.md'), doneTime, doneTime);

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'completed-lifecycle-task',  // Changed to camelCase
        include_progress: true
      });

      // Verify complete lifecycle structure
      expect(result.taskId).toBe('completed-lifecycle-task');  // Changed to camelCase
      expect(result.agent).toBe('test-agent');
      
      expect(result.lifecycle.init.exists).toBe(true);
      expect(result.lifecycle.init.content).toContain('test-agent');
      expect(result.lifecycle.init.created_at).toBeDefined();
      
      expect(result.lifecycle.plan.exists).toBe(true);
      expect(result.lifecycle.plan.content).toContain('Implementation Plan');
      expect(result.lifecycle.plan.progress_markers).toBeDefined();
      expect(result.lifecycle.plan.progress_markers?.completed).toHaveLength(3);
      expect(result.lifecycle.plan.progress_markers?.pending).toHaveLength(0);
      expect(result.lifecycle.plan.last_updated).toBeDefined();
      
      expect(result.lifecycle.outcome.type).toBe('done');
      expect(result.lifecycle.outcome.content).toContain('All objectives achieved');
      expect(result.lifecycle.outcome.completed_at).toBeDefined();
      
      expect(result.summary.duration_seconds).toBeGreaterThan(0);
      expect(result.summary.progress_percentage).toBe(100);
      expect(result.summary.final_status).toBe('completed');
    });

    it('should return lifecycle for task with error outcome', async () => {
      // Setup: Create task with error
      const taskDir = path.join(testDir, 'error-lifecycle-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        testUtils.sampleTaskContent
      );
      
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Implementation Plan\n1. [✓ COMPLETE] Step 1\n2. [→ IN PROGRESS] Step 2\n3. [PENDING] Step 3'
      );
      
      await fs.writeFile(
        path.join(taskDir, 'ERROR.md'),
        '# Task Error\nFailed during step 2 execution.'
      );

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'error-lifecycle-task'  // Changed to camelCase
      });

      expect(result.lifecycle.outcome.type).toBe('error');
      expect(result.lifecycle.outcome.content).toContain('Failed during step 2');
      expect(result.summary.progress_percentage).toBeLessThan(100);
      expect(result.summary.final_status).toBe('error');
    });

    it('should return lifecycle for pending task without completion', async () => {
      // Setup: Create task without completion
      const taskDir = path.join(testDir, 'pending-lifecycle-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        testUtils.sampleTaskContent
      );
      
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Implementation Plan\n1. [✓ COMPLETE] Step 1\n2. [→ IN PROGRESS] Step 2\n3. [PENDING] Step 3'
      );

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'pending-lifecycle-task',  // Changed to camelCase
        include_progress: true
      });

      expect(result.lifecycle.outcome.type).toBe('pending');
      expect(result.lifecycle.outcome.content).toBeUndefined();
      expect(result.summary.progress_percentage).toBeLessThan(100);
      expect(result.summary.final_status).toBe('in_progress');
      expect(result.summary.duration_seconds).toBeUndefined();
    });

    it('should handle task with only INIT file', async () => {
      // Setup: Create minimal task
      const taskDir = path.join(testDir, 'init-only-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        testUtils.sampleTaskContent
      );

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'init-only-task'  // Changed to camelCase
      });

      expect(result.lifecycle.init.exists).toBe(true);
      expect(result.lifecycle.plan.exists).toBe(false);
      expect(result.lifecycle.outcome.type).toBe('pending');
      expect(result.summary.progress_percentage).toBe(0);
      expect(result.summary.final_status).toBe('new');
    });

    it('should exclude progress when include_progress is false', async () => {
      // Setup: Create task with plan
      const taskDir = path.join(testDir, 'no-progress-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Plan\n1. [✓ COMPLETE] Step 1\n2. [→ IN PROGRESS] Step 2'
      );

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'no-progress-task',  // Changed to camelCase
        include_progress: false
      });

      expect(result.lifecycle.plan.exists).toBe(true);
      expect(result.lifecycle.plan.content).toContain('# Plan');
      expect(result.lifecycle.plan.progress_markers).toBeUndefined();
    });

    it('should default include_progress to true', async () => {
      // Setup: Create task with plan
      const taskDir = path.join(testDir, 'default-progress-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Plan\n1. [✓ COMPLETE] Step 1'
      );

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'default-progress-task'  // Changed to camelCase
        // include_progress omitted - should default to true
      });

      expect(result.lifecycle.plan.progress_markers).toBeDefined();
      expect(result.lifecycle.plan.progress_markers?.completed).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent task directory', async () => {
      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'non-existent-task'  // Changed to camelCase
      });

      expect(result.lifecycle.init.exists).toBe(false);
      expect(result.lifecycle.plan.exists).toBe(false);
      expect(result.lifecycle.outcome.type).toBe('pending');
      expect(result.summary.final_status).toBe('error');
    });

    it('should validate required parameters', async () => {
      await expect(
        getFullLifecycle(config, {
          // Missing agent and task_id
        } as any)
      ).rejects.toThrow();

      await expect(
        getFullLifecycle(config, {
          agent: 'test-agent'
          // Missing task_id
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('Progress Marker Parsing', () => {
    it('should correctly parse various progress marker formats', async () => {
      // Setup: Create task with mixed progress markers
      const taskDir = path.join(testDir, 'progress-markers-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        `# Plan
1. [✓ COMPLETE] First step completed
2. [→ IN PROGRESS] Currently working on this
3. [PENDING] Waiting to start
4. [✓ COMPLETE] Another completed step
5. [BLOCKED] Blocked by external dependency`
      );

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'progress-markers-task'  // Changed to camelCase
      });

      const markers = result.lifecycle.plan.progress_markers!;
      expect(markers.completed).toEqual([
        'First step completed',
        'Another completed step'
      ]);
      expect(markers.in_progress).toBe('Currently working on this');
      expect(markers.pending).toEqual([
        'Waiting to start',
        'Blocked by external dependency'
      ]);
    });

    it('should handle plan with no progress markers', async () => {
      const taskDir = path.join(testDir, 'no-markers-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Simple Plan\nJust some text without markers'
      );

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'no-markers-task'  // Changed to camelCase
      });

      const markers = result.lifecycle.plan.progress_markers!;
      expect(markers.completed).toHaveLength(0);
      expect(markers.in_progress).toBeUndefined();
      expect(markers.pending).toHaveLength(0);
    });
  });

  describe('Type Interface Compliance', () => {
    it('should return GetFullLifecycleResult interface', async () => {
      // Setup: Create basic task
      const taskDir = path.join(testDir, 'interface-test-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);

      const result = await getFullLifecycle(config, {
        agent: 'test-agent',
        taskId: 'interface-test-task'  // Changed to camelCase
      });

      // Verify result matches expected interface
      expect(typeof result.taskId).toBe('string');
      expect(typeof result.agent).toBe('string');
      
      expect(typeof result.lifecycle).toBe('object');
      expect(typeof result.lifecycle.init.exists).toBe('boolean');
      expect(typeof result.lifecycle.plan.exists).toBe('boolean');
      expect(['done', 'error', 'pending']).toContain(result.lifecycle.outcome.type);
      
      expect(typeof result.summary).toBe('object');
      expect(typeof result.summary.final_status).toBe('string');
    });
  });
});