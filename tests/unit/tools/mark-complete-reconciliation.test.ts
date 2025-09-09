/**
 * Unit tests for mark-complete tool reconciliation logic
 * Tests for intelligent handling of unchecked plan items
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { markComplete } from '../../../src/tools/mark-complete.js';
import { ServerConfig } from '../../../src/types.js';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import { tmpdir } from 'os';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger, MockTimerDependency } from '../../../src/logging/EventLogger.js';
import * as agentVerifier from '../../../src/core/agent-work-verifier.js';

// Mock the agent work verifier
jest.mock('../../../src/core/agent-work-verifier.js');

const mockAgentVerifier = agentVerifier as jest.Mocked<typeof agentVerifier>;

describe('Mark Complete Reconciliation Logic', () => {
  let mockConfig: ServerConfig;
  let testDir: string;
  let agentDir: string;
  let taskDir: string;

  beforeEach(async () => {
    // Setup agent work verifier mock - return high confidence for tests
    mockAgentVerifier.verifyAgentWork.mockResolvedValue({
      success: true,
      confidence: 100,
      evidence: {
        filesModified: 5,
        testsRun: true,
        mcpProgress: true,
        timeSpent: 30
      },
      warnings: [],
      recommendation: 'Work verified successfully'
    });
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'mark-complete-test-'));
    agentDir = path.join(testDir, 'test-agent');
    taskDir = path.join(agentDir, '2025-09-04T21-00-00-test-task');
    
    await fs.ensureDir(taskDir);
    
    mockConfig = {
      commDir: testDir,
      archiveDir: path.join(testDir, 'archive'),
      logDir: path.join(testDir, 'logs'),
      enableArchiving: true,
      connectionManager: new ConnectionManager(),
      eventLogger: new EventLogger(testDir, new MockTimerDependency())
    };
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(testDir);
  });

  describe('Checkbox Validation', () => {
    it('should detect unchecked items correctly', async () => {
      const planContent = `# Test Plan

- [ ] **Setup Environment**: Configure test environment
  - Action: Install dependencies
  - Expected: All packages installed
  - Error: Check package.json for conflicts

- [x] **Create Database**: Set up test database
  - Action: Run migration scripts
  - Expected: Database schema created
  - Error: Verify database connection

- [ ] **Deploy Application**: Deploy to test environment
  - Action: Build and deploy application
  - Expected: Application running on test server
  - Error: Check deployment logs
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'Task completed',
        agent: 'test-agent'
      };

      // Should fail in strict mode (default) with unchecked items
      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Cannot mark DONE with 2 unchecked items');
    });

    it('should allow completion when all items are checked', async () => {
      const planContent = `# Test Plan

- [x] **Setup Environment**: Configure test environment
  - Action: Install dependencies
  - Expected: All packages installed
  - Error: Check package.json for conflicts

- [x] **Create Database**: Set up test database
  - Action: Run migration scripts
  - Expected: Database schema created
  - Error: Verify database connection

- [x] **Deploy Application**: Deploy to test environment
  - Action: Build and deploy application
  - Expected: Application running on test server
  - Error: Check deployment logs
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'All tasks completed successfully',
        agent: 'test-agent'
      };

      const result = await markComplete(mockConfig, args);
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('Strict Mode (Default)', () => {
    it('should reject DONE status with unchecked items', async () => {
      const planContent = `# Test Plan
- [ ] **Incomplete Task**: Not finished
  - Action: Do something
  - Expected: Success
  - Error: Handle failure
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'Attempting completion with unchecked items',
        agent: 'test-agent',
        reconciliation_mode: 'strict'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Cannot mark DONE with 1 unchecked items');
    });

    it('should allow ERROR status with unchecked items', async () => {
      const planContent = `# Test Plan
- [ ] **Failed Task**: Did not complete
  - Action: Attempt task
  - Expected: Success
  - Error: Task failed
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'ERROR',
        summary: 'Task failed with unchecked items',
        agent: 'test-agent',
        reconciliation_mode: 'strict'
      };

      const result = await markComplete(mockConfig, args);
      expect(result.success).toBe(true); // Operation succeeded
      expect(result.status).toBe('ERROR'); // Task failed
      expect(result.isError).toBe(true);
    });
  });

  describe('Auto-Complete Mode', () => {
    it('should mark all unchecked items as complete', async () => {
      const planContent = `# Test Plan

- [ ] **Setup Task**: Initial setup
  - Action: Configure environment
  - Expected: Environment ready
  - Error: Check configuration

- [x] **Main Task**: Core implementation
  - Action: Implement feature
  - Expected: Feature working
  - Error: Debug issues

- [ ] **Cleanup Task**: Final cleanup
  - Action: Remove temporary files
  - Expected: Clean environment
  - Error: Manual cleanup required
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'All work completed, forgot to check boxes',
        agent: 'test-agent',
        reconciliation_mode: 'auto_complete'
      };

      const result = await markComplete(mockConfig, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
      expect(result.summary).toContain('Auto-Reconciliation Applied');
      expect(result.summary).toContain('2 unchecked items marked as completed');
      expect(result.summary).toContain('Setup Task');
      expect(result.summary).toContain('Cleanup Task');
    });
  });

  describe('Reconcile Mode', () => {
    it('should accept completion with explanations', async () => {
      const planContent = `# Test Plan

- [x] **Core Implementation**: Main feature
  - Action: Implement core feature
  - Expected: Feature working
  - Error: Debug and fix

- [ ] **Performance Testing**: Load testing
  - Action: Run performance tests
  - Expected: Performance acceptable
  - Error: Optimize performance

- [ ] **Documentation**: Write documentation
  - Action: Create user guide
  - Expected: Complete documentation
  - Error: Minimal documentation acceptable
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'Core feature complete, other items deferred',
        agent: 'test-agent',
        reconciliation_mode: 'reconcile',
        reconciliation_explanations: {
          'Performance Testing': 'Performance acceptable in current tests, full load testing scheduled for next sprint',
          'Documentation': 'Code comments sufficient for current release, full documentation in backlog'
        }
      };

      const result = await markComplete(mockConfig, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
      expect(result.summary).toContain('Task Completion with Variance');
      expect(result.summary).toContain('**Total Planned Items**: 3');
      expect(result.summary).toContain('**Explicitly Checked**: 1');
      expect(result.summary).toContain('**Reconciled Items**: 2');
      expect(result.summary).toContain('**Performance Testing**: Performance acceptable in current tests');
      expect(result.summary).toContain('**Documentation**: Code comments sufficient');
    });

    it('should use default explanations for missing items', async () => {
      const planContent = `# Test Plan
- [ ] **Unchecked Task**: Not completed
  - Action: Do something
  - Expected: Success
  - Error: Handle failure
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'Completed differently than planned',
        agent: 'test-agent',
        reconciliation_mode: 'reconcile'
        // No explanations provided
      };

      const result = await markComplete(mockConfig, args);
      
      expect(result.success).toBe(true);
      expect(result.summary).toContain('**Unchecked Task**: Completed via alternative approach');
    });
  });

  describe('Force Mode', () => {
    it('should allow completion despite unchecked items with strong warnings', async () => {
      const planContent = `# Test Plan

- [ ] **Critical Task**: Important task
  - Action: Complete critical work
  - Expected: Critical functionality working
  - Error: System may be unstable

- [ ] **Optional Task**: Nice to have
  - Action: Add optional features
  - Expected: Enhanced functionality
  - Error: Skip if time constraints

- [ ] **Future Task**: Deferred work
  - Action: Plan future enhancements
  - Expected: Roadmap defined
  - Error: Document in backlog
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'Emergency completion - plan changed due to urgent requirements',
        agent: 'test-agent',
        reconciliation_mode: 'force'
      };

      const result = await markComplete(mockConfig, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
      expect(result.summary).toContain('⚠️ FORCED COMPLETION - Unchecked items present');
      expect(result.summary).toContain('3 planned items were not explicitly marked complete');
      expect(result.summary).toContain('**Critical Task**: Not checked');
      expect(result.summary).toContain('**Optional Task**: Not checked');
      expect(result.summary).toContain('**Future Task**: Not checked');
    });

    it('should allow ERROR status with force mode', async () => {
      const planContent = `# Test Plan
- [ ] **Failed Task**: Did not complete
  - Action: Attempt task
  - Expected: Success
  - Error: Task failed
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'ERROR',
        summary: 'Task failed, plan irrelevant',
        agent: 'test-agent',
        reconciliation_mode: 'force'
      };

      const result = await markComplete(mockConfig, args);
      
      expect(result.success).toBe(true); // Operation succeeded
      expect(result.status).toBe('ERROR'); // Task failed
      expect(result.isError).toBe(true);
      expect(result.summary).toContain('⚠️ FORCED COMPLETION');
    });
  });

  describe('No Plan Scenarios', () => {
    it('should handle missing PLAN.md file gracefully', async () => {
      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      // No PLAN.md file

      const args = {
        status: 'DONE',
        summary: 'Task completed without formal plan',
        agent: 'test-agent'
      };

      const result = await markComplete(mockConfig, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });

    it('should handle PLAN.md without checkboxes', async () => {
      const planContent = `# Test Plan

This is a plan without checkboxes.
Just narrative description of what needs to be done.

1. First do this
2. Then do that
3. Finally do the other thing
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'Narrative plan completed',
        agent: 'test-agent'
      };

      const result = await markComplete(mockConfig, args);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid reconciliation mode gracefully', async () => {
      const planContent = `# Test Plan
- [ ] **Test Task**: Unchecked task
  - Action: Do something
  - Expected: Success
  - Error: Handle failure
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), planContent);

      const args = {
        status: 'DONE',
        summary: 'Test with invalid mode',
        agent: 'test-agent',
        reconciliation_mode: 'invalid_mode'
      };

      // Should default to reconcile mode and succeed
      const result = await markComplete(mockConfig, args);
      expect(result.success).toBe(true);
    });

    it('should handle malformed PLAN.md gracefully', async () => {
      const malformedPlan = `# Test Plan

- [ **Missing closing bracket**: This is malformed
- [x] **Valid Item**: This one is correct
  - Action: Do something
  - Expected: Success

- [ ] Missing title after checkbox
`;

      await fs.writeFile(path.join(taskDir, 'INIT.md'), 'Initial task content');
      await fs.writeFile(path.join(taskDir, 'PLAN.md'), malformedPlan);

      const args = {
        status: 'DONE',
        summary: 'Handling malformed plan',
        agent: 'test-agent',
        reconciliation_mode: 'reconcile'
      };

      const result = await markComplete(mockConfig, args);
      expect(result.success).toBe(true);
    });
  });
});