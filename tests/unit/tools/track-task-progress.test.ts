/**
 * track_task_progress Tool Tests (TDD Phase 2)  
 * Test-Driven Development for real-time progress monitoring
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import * as os from 'os';
import { testUtils } from '../../utils/testUtils.js';

// This import should FAIL initially until we implement the tool
import { trackTaskProgress } from '../../../src/tools/track-task-progress.js';

describe('track_task_progress Tool (TDD)', () => {
  let config: any;
  let tempDir: string;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'track-progress-test-'));
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
    it('should track progress for task with completed steps', async () => {
      // Setup: Create task with partially completed plan
      const taskDir = path.join(testDir, 'progress-tracking-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(
        path.join(taskDir, 'INIT.md'),
        testUtils.sampleTaskContent
      );
      
      const planContent = `# Implementation Plan
## Detailed Steps
1. [✓ COMPLETE] Initialize project structure
2. [✓ COMPLETE] Set up configuration
3. [→ IN PROGRESS] Implement core functionality
4. [PENDING] Write documentation
5. [PENDING] Run tests`;
      
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const result = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'progress-tracking-task'
      });

      expect(result.taskId).toBe('progress-tracking-task');
      expect(result.status).toBe('in_progress');
      expect(result.progress.total_steps).toBe(5);
      expect(result.progress.completed_steps).toBe(2);
      expect(result.progress.percentage).toBe(40); // 2/5 = 40%
      expect(result.progress.current_step).toBe('Implement core functionality');
      expect(result.last_updated).toBeDefined();
    });

    it('should track progress for completed task', async () => {
      // Setup: Create fully completed task
      const taskDir = path.join(testDir, 'completed-progress-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Plan\n1. [✓ COMPLETE] Step 1\n2. [✓ COMPLETE] Step 2\n3. [✓ COMPLETE] Step 3'
      );
      await fs.writeFile(
        path.join(taskDir, 'DONE.md'),
        '# Task Complete\nAll steps completed successfully.'
      );

      const result = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'completed-progress-task'
      });

      expect(result.status).toBe('completed');
      expect(result.progress.total_steps).toBe(3);
      expect(result.progress.completed_steps).toBe(3);
      expect(result.progress.percentage).toBe(100);
      expect(result.progress.current_step).toBeUndefined();
    });

    it('should track progress for task with error', async () => {
      // Setup: Create task with error
      const taskDir = path.join(testDir, 'error-progress-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Plan\n1. [✓ COMPLETE] Step 1\n2. [→ IN PROGRESS] Step 2\n3. [PENDING] Step 3'
      );
      await fs.writeFile(
        path.join(taskDir, 'ERROR.md'),
        '# Task Error\nFailed during step 2.'
      );

      const result = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'error-progress-task'
      });

      expect(result.status).toBe('error');
      expect(result.progress.total_steps).toBe(3);
      expect(result.progress.completed_steps).toBe(1);
      expect(result.progress.percentage).toBe(33); // 1/3 ≈ 33%
      expect(result.progress.current_step).toBe('Step 2'); // Where it failed
    });

    it('should track progress for pending task without plan', async () => {
      // Setup: Create task with only INIT
      const taskDir = path.join(testDir, 'pending-progress-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);

      const result = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'pending-progress-task'
      });

      expect(result.status).toBe('pending');
      expect(result.progress.total_steps).toBe(0);
      expect(result.progress.completed_steps).toBe(0);
      expect(result.progress.percentage).toBe(0);
      expect(result.progress.current_step).toBeUndefined();
    });

    it('should handle task with plan but no progress markers', async () => {
      // Setup: Create task with unmarked plan
      const taskDir = path.join(testDir, 'unmarked-plan-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(taskDir, 'PLAN.md'),
        '# Simple Plan\n\nJust text without progress markers.\nSome implementation notes here.'
      );

      const result = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'unmarked-plan-task'
      });

      expect(result.status).toBe('in_progress');
      expect(result.progress.total_steps).toBe(0);
      expect(result.progress.completed_steps).toBe(0);
      expect(result.progress.percentage).toBe(0);
      expect(result.progress.current_step).toBeUndefined();
    });

    it('should correctly calculate progress percentage with various step counts', async () => {
      // Test case 1: Single step
      const singleStepDir = path.join(testDir, 'single-step-task');
      await fs.ensureDir(singleStepDir);
      
      await fs.writeFile(path.join(singleStepDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(singleStepDir, 'PLAN.md'),
        '# Plan\n1. [→ IN PROGRESS] Only step'
      );

      const singleResult = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'single-step-task'
      });

      expect(singleResult.progress.total_steps).toBe(1);
      expect(singleResult.progress.completed_steps).toBe(0);
      expect(singleResult.progress.percentage).toBe(0);

      // Test case 2: Large number of steps
      const manyStepsDir = path.join(testDir, 'many-steps-task');
      await fs.ensureDir(manyStepsDir);
      
      await fs.writeFile(path.join(manyStepsDir, 'INIT.md'), testUtils.sampleTaskContent);
      await fs.writeFile(
        path.join(manyStepsDir, 'PLAN.md'),
        `# Plan
1. [✓ COMPLETE] Step 1
2. [✓ COMPLETE] Step 2
3. [✓ COMPLETE] Step 3
4. [✓ COMPLETE] Step 4
5. [✓ COMPLETE] Step 5
6. [✓ COMPLETE] Step 6
7. [→ IN PROGRESS] Step 7
8. [PENDING] Step 8
9. [PENDING] Step 9
10. [PENDING] Step 10`
      );

      const manyResult = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'many-steps-task'
      });

      expect(manyResult.progress.total_steps).toBe(10);
      expect(manyResult.progress.completed_steps).toBe(6);
      expect(manyResult.progress.percentage).toBe(60); // 6/10 = 60%
      expect(manyResult.progress.current_step).toBe('Step 7');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent task', async () => {
      const result = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'non-existent-task'
      });

      expect(result.status).toBe('pending');
      expect(result.progress.total_steps).toBe(0);
      expect(result.progress.completed_steps).toBe(0);
      expect(result.progress.percentage).toBe(0);
      expect(result.last_updated).toBeDefined();
    });

    it('should validate required parameters', async () => {
      await expect(
        trackTaskProgress(config, {
          // Missing agent and task_id
        } as any)
      ).rejects.toThrow();

      await expect(
        trackTaskProgress(config, {
          agent: 'test-agent'
          // Missing task_id
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('Type Interface Compliance', () => {
    it('should return TrackTaskProgressResult interface', async () => {
      // Setup: Create basic task
      const taskDir = path.join(testDir, 'interface-test-task');
      await fs.ensureDir(taskDir);
      
      await fs.writeFile(path.join(taskDir, 'INIT.md'), testUtils.sampleTaskContent);

      const result = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'interface-test-task'
      });

      // Verify result matches expected interface
      expect(typeof result.taskId).toBe('string');
      expect(['pending', 'in_progress', 'completed', 'error']).toContain(result.status);
      
      expect(typeof result.progress).toBe('object');
      expect(typeof result.progress.total_steps).toBe('number');
      expect(typeof result.progress.completed_steps).toBe('number');
      expect(typeof result.progress.percentage).toBe('number');
      
      expect(typeof result.last_updated).toBe('string');
      
      // Validate progress values are sensible
      expect(result.progress.total_steps).toBeGreaterThanOrEqual(0);
      expect(result.progress.completed_steps).toBeGreaterThanOrEqual(0);
      expect(result.progress.completed_steps).toBeLessThanOrEqual(result.progress.total_steps);
      expect(result.progress.percentage).toBeGreaterThanOrEqual(0);
      expect(result.progress.percentage).toBeLessThanOrEqual(100);
    });
  });
});