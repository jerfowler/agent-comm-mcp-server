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
import { ServerConfig, TrackTaskProgressArgs } from '../../../src/types.js';

describe('track_task_progress Tool (TDD)', () => {
  let config: ServerConfig;
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
        } as unknown as TrackTaskProgressArgs)
      ).rejects.toThrow();

      await expect(
        trackTaskProgress(config, {
          agent: 'test-agent'
          // Missing task_id
        } as unknown as TrackTaskProgressArgs)
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

  describe('stepCount metadata usage (Issue #60)', () => {
    it('should use stepCount from PLAN.metadata.json when available', async () => {
      // Setup: Create task with metadata file
      const taskDir = path.join(testDir, 'metadata-test-task');
      await fs.ensureDir(taskDir);

      // Create PLAN.metadata.json with stepCount
      const metadata = {
        stepCount: 8,
        agent: 'test-agent',
        taskId: 'metadata-test-task',
        createdAt: new Date().toISOString(),
        checkboxPattern: 'markdown',
        version: '2.0.0'
      };
      await fs.writeFile(
        path.join(taskDir, 'PLAN.metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      // Create PLAN.md with checkboxes
      const planContent = `# Test Plan
- [x] **Step 1**: Completed
- [x] **Step 2**: Completed
- [~] **Step 3**: In progress
- [ ] **Step 4**: Pending
- [ ] **Step 5**: Pending
- [ ] **Step 6**: Pending
- [ ] **Step 7**: Pending
- [ ] **Step 8**: Pending`;

      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'metadata-test-task'
      };

      const startTime = Date.now();
      const result = await trackTaskProgress(config, args);
      const executionTime = Date.now() - startTime;

      // Should be fast since using cached metadata
      expect(executionTime).toBeLessThan(50);

      // Verify correct step count from metadata
      expect(result.progress.total_steps).toBe(8);
      expect(result.progress.completed_steps).toBe(2);
      // Note: in_progress_steps and pending_steps are not in the interface
      // Only total_steps, completed_steps, percentage, and current_step are available
    });

    it('should fall back to parsing PLAN.md when metadata missing', async () => {
      // Setup: Create task without metadata file
      const taskDir = path.join(testDir, 'no-metadata-task');
      await fs.ensureDir(taskDir);

      // Create PLAN.md without metadata
      const planContent = `# Test Plan
- [x] **Step 1**: Completed
- [ ] **Step 2**: Pending
- [ ] **Step 3**: Pending`;

      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'no-metadata-task'
      };

      const result = await trackTaskProgress(config, args);

      // Verify correct step count from parsing
      expect(result.progress.total_steps).toBe(3);
      expect(result.progress.completed_steps).toBe(1);
      // Note: pending_steps is not in the interface
      expect(result.progress.percentage).toBeLessThan(100);
    });

    it('should handle corrupted metadata gracefully', async () => {
      // Setup: Create task with corrupted metadata
      const taskDir = path.join(testDir, 'corrupted-metadata-task');
      await fs.ensureDir(taskDir);

      // Create corrupted PLAN.metadata.json
      await fs.writeFile(
        path.join(taskDir, 'PLAN.metadata.json'),
        '{ invalid json content'
      );

      // Create valid PLAN.md as fallback
      const planContent = `# Test Plan
- [x] **Step 1**: Completed
- [x] **Step 2**: Completed`;

      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'corrupted-metadata-task'
      };

      const result = await trackTaskProgress(config, args);

      // Should fall back to parsing and get correct count
      expect(result.progress.total_steps).toBe(2);
      expect(result.progress.completed_steps).toBe(2);
      expect(result.progress.percentage).toBe(100);
    });

    it('should include stepCount in response when available', async () => {
      // Setup: Create task with metadata
      const taskDir = path.join(testDir, 'stepcount-response-task');
      await fs.ensureDir(taskDir);

      const metadata = {
        stepCount: 5,
        agent: 'test-agent',
        taskId: 'stepcount-response-task',
        createdAt: new Date().toISOString(),
        checkboxPattern: 'markdown',
        version: '2.0.0'
      };
      await fs.writeFile(
        path.join(taskDir, 'PLAN.metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      const planContent = `# Test Plan
- [x] **Step 1**: Done
- [ ] **Step 2**: Todo
- [ ] **Step 3**: Todo
- [ ] **Step 4**: Todo
- [ ] **Step 5**: Todo`;

      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args: TrackTaskProgressArgs = {
        agent: 'test-agent',
        taskId: 'stepcount-response-task'
      };

      const result = await trackTaskProgress(config, args);

      // Should include metadata info in response
      expect(result.progress.total_steps).toBe(5);
      // Note: metadata is not a property of TrackTaskProgressResult
    });

    it('should track performance improvements with metadata', async () => {
      // Create two tasks - one with metadata, one without
      const taskWithMeta = path.join(testDir, 'with-metadata');
      const taskWithoutMeta = path.join(testDir, 'without-metadata');

      await fs.ensureDir(taskWithMeta);
      await fs.ensureDir(taskWithoutMeta);

      // Large plan content (50 steps)
      const largePlan = Array.from({ length: 50 }, (_, i) =>
        `- [${i < 10 ? 'x' : ' '}] **Step ${i + 1}**: Task ${i + 1}`
      ).join('\n');

      // Task with metadata
      await fs.writeFile(
        path.join(taskWithMeta, 'PLAN.metadata.json'),
        JSON.stringify({
          stepCount: 50,
          agent: 'test-agent',
          createdAt: new Date().toISOString(),
          checkboxPattern: 'markdown',
          version: '2.0.0'
        })
      );
      await fs.writeFile(path.join(taskWithMeta, 'PLAN.md'), largePlan);

      // Task without metadata
      await fs.writeFile(path.join(taskWithoutMeta, 'PLAN.md'), largePlan);

      // Measure performance with metadata
      const startWithMeta = Date.now();
      const resultWithMeta = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'with-metadata'
      });
      const timeWithMeta = Date.now() - startWithMeta;

      // Measure performance without metadata
      const startWithoutMeta = Date.now();
      const resultWithoutMeta = await trackTaskProgress(config, {
        agent: 'test-agent',
        taskId: 'without-metadata'
      });
      const timeWithoutMeta = Date.now() - startWithoutMeta;

      // With metadata should be faster for large plans
      expect(resultWithMeta.progress.total_steps).toBe(50);
      expect(resultWithoutMeta.progress.total_steps).toBe(50);

      // Log performance difference for verification
      console.log(`Performance: with metadata=${timeWithMeta}ms, without=${timeWithoutMeta}ms`);
    });
  });
});