/**
 * Integration tests for tool coordination using lock manager
 * Tests concurrent usage of sync-todo-checkboxes and report-progress tools
 */

import { jest } from '@jest/globals';
import { syncTodoCheckboxes } from '../../src/tools/sync-todo-checkboxes.js';
import { reportProgress } from '../../src/tools/report-progress.js';
import * as fs from '../../src/utils/fs-extra-safe.js';
import * as path from 'path';
import { ServerConfig } from '../../src/types.js';
import type { ConnectionManager } from '../../src/core/ConnectionManager.js';
import type { EventLogger } from '../../src/logging/EventLogger.js';

// Mock fs-extra with factory function - proper TypeScript pattern
jest.mock('../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  remove: jest.fn(),
  ensureDir: jest.fn()
}));

// Import fs-extra after mocking to get the mocked functions
const mockFs = fs as unknown as jest.Mocked<{
  pathExists: jest.MockedFunction<(path: string) => Promise<boolean>>;
  readFile: jest.MockedFunction<(path: string, encoding?: string) => Promise<string>>;
  writeFile: jest.MockedFunction<(path: string, data: string) => Promise<void>>;
  readdir: jest.MockedFunction<(path: string) => Promise<string[]>>;
  stat: jest.MockedFunction<(path: string) => Promise<{ isDirectory: () => boolean; mtime?: Date }>>;
  remove: jest.MockedFunction<(path: string) => Promise<void>>;
  ensureDir: jest.MockedFunction<(path: string) => Promise<void>>;
}>;

// Helper function to create complete ServerConfig for tests
function createMockServerConfig(): ServerConfig {
  return {
    commDir: '/test/comm',
    archiveDir: '/test/archive',
    logDir: '/test/logs',
    enableArchiving: false,
    connectionManager: {
      register: jest.fn(),
      getConnection: jest.fn().mockReturnValue({
        id: 'test-connection-id',
        agent: 'test-agent',
        timestamp: Date.now(),
        lastActivity: Date.now(),
        metadata: {}
      }),
      updateActivity: jest.fn(),
      getActiveConnections: jest.fn(),
      unregister: jest.fn(),
      getConnectionsByAgent: jest.fn(),
      cleanupStaleConnections: jest.fn(),
      getStatistics: jest.fn(),
      getConnectionCount: jest.fn(),
      hasConnection: jest.fn()
    } as unknown as ConnectionManager,
    eventLogger: {
      logOperation: jest.fn(),
      logError: jest.fn(),
      getOperationStatistics: jest.fn()
    } as unknown as EventLogger
  };
}

describe('Tool Coordination Integration (TDD)', () => {
  const mockConfig = createMockServerConfig();
  const testAgent = 'test-agent';
  const testTaskDir = '2025-09-05T07-49-48-test-task';
  const testAgentPath = path.join(mockConfig.commDir, testAgent);
  const testTaskPath = path.join(testAgentPath, testTaskDir);
  const testPlanPath = path.join(testTaskPath, 'PLAN.md');
  const testProgressPath = path.join(testTaskPath, 'PROGRESS.md');
  const testLockPath = path.join(testTaskPath, '.sync.lock');

  const samplePlanContent = `# Test Task Plan

## Phase 1: Setup

- [ ] **Setup Environment**: Configure development environment
  - Action: Install dependencies and setup workspace
  - Expected: All tools installed correctly

- [ ] **Create Database**: Setup PostgreSQL database
  - Action: Run database creation scripts
  - Expected: Database accessible and seeded

- [x] **Implement Authentication**: Add user authentication system
  - Action: Integrate Auth0 with secure tokens
  - Expected: Users can login and logout securely
`;

  const sampleProgressContent = `# Task Progress

## Status
- Started: 2025-09-05T07:49:48Z
- Last Updated: 2025-09-05T08:30:00Z

## Progress Log
Step 1: Setup Environment - IN_PROGRESS
Step 2: Create Database - PENDING
Step 3: Implement Authentication - COMPLETE
`;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks for successful scenarios
    mockFs.pathExists.mockImplementation((filePath: string) => {
      if (filePath === testAgentPath) return Promise.resolve(true);
      if (filePath === testPlanPath) return Promise.resolve(true);
      if (filePath === testProgressPath) return Promise.resolve(true);
      if (filePath === testLockPath) return Promise.resolve(false); // No lock by default
      if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return Promise.resolve(false);
      return Promise.resolve(false);
    });
    
    mockFs.readdir.mockResolvedValue([testTaskDir]);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true });
    mockFs.readFile.mockImplementation((filePath: string) => {
      if (filePath === testPlanPath) return Promise.resolve(samplePlanContent);
      if (filePath === testProgressPath) return Promise.resolve(sampleProgressContent);
      if (filePath.endsWith('PLAN.md')) return Promise.resolve(samplePlanContent); // Support any task's PLAN.md
      return Promise.resolve('');
    });
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  describe('Lock-based Coordination', () => {
    it('should prevent sync-todo-checkboxes from running while report-progress has lock', async () => {
      // Mock active lock by report-progress
      mockFs.pathExists.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) return Promise.resolve(true);
        if (filePath === testAgentPath) return Promise.resolve(true);
        if (filePath === testPlanPath) return Promise.resolve(true);
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      mockFs.stat.mockResolvedValue({ 
        isDirectory: () => true, 
        mtime: new Date()
      }); // Fresh lock
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) {
          return Promise.resolve(JSON.stringify({
            tool: 'report-progress',
            pid: 12345,
            timestamp: Date.now(),
            lockId: 'progress-lock-id'
          }));
        }
        if (filePath === testPlanPath) return Promise.resolve(samplePlanContent);
        return Promise.resolve('');
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow('Task is currently locked');
    });

    it('should prevent report-progress from running while sync-todo-checkboxes has lock', async () => {
      // Mock active lock by sync-todo-checkboxes
      mockFs.pathExists.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) return Promise.resolve(true);
        if (filePath === testAgentPath) return Promise.resolve(true);
        if (filePath === testTaskPath) return Promise.resolve(true);
        if (filePath === testPlanPath) return Promise.resolve(true);
        if (filePath === testProgressPath) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFs.stat.mockResolvedValue({ 
        isDirectory: () => true, 
        mtime: new Date()
      }); // Fresh lock
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) {
          return Promise.resolve(JSON.stringify({
            tool: 'sync-todo-checkboxes',
            pid: 12345,
            timestamp: Date.now(),
            lockId: 'sync-lock-id'
          }));
        }
        if (filePath === testPlanPath) return Promise.resolve(samplePlanContent);
        if (filePath === testProgressPath) return Promise.resolve(sampleProgressContent);
        return Promise.resolve('');
      });

      const progressArgs = {
        agent: testAgent,
        updates: [{
          step: 1,
          status: 'COMPLETE' as const,
          description: 'Environment setup completed'
        }]
      };

      await expect(reportProgress(mockConfig, progressArgs))
        .rejects.toThrow('Task is currently locked');
    });

    it('should allow tools to run sequentially when locks are properly released', async () => {
      // First operation: sync-todo-checkboxes creates and releases lock
      let lockExists = false;
      
      mockFs.pathExists.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) return Promise.resolve(lockExists);
        if (filePath === testAgentPath) return Promise.resolve(true);
        if (filePath === testTaskPath) return Promise.resolve(true);
        if (filePath === testPlanPath) return Promise.resolve(true);
        if (filePath === testProgressPath) return Promise.resolve(true);
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      mockFs.writeFile.mockImplementation((filePath: string, _content: string) => {
        if (filePath === testLockPath) {
          lockExists = true;
        }
        // Simulate successful write
        return Promise.resolve();
      });

      mockFs.remove.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) {
          lockExists = false;
        }
        return Promise.resolve();
      });

      // First: sync-todo-checkboxes should succeed
      const syncArgs = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const syncResult = await syncTodoCheckboxes(mockConfig, syncArgs);
      expect(syncResult.success).toBe(true);

      // Second: report-progress should succeed after sync released lock
      const progressArgs = {
        agent: testAgent,
        updates: [{
          step: 1,
          status: 'COMPLETE' as const,
          description: 'Environment setup completed'
        }]
      };

      const progressResult = await reportProgress(mockConfig, progressArgs);
      expect(progressResult.success).toBe(true);
    });

    it('should cleanup stale locks and allow operations to proceed', async () => {
      const staleTime = new Date(Date.now() - 35000); // 35 seconds ago (stale)

      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === testTaskPath) {
          // Return files in the task directory, including the lock file
          return ['PLAN.md', '.sync.lock'] as never;
        }
        // Default behavior for other directories
        return [testTaskDir] as never;
      });
      
      mockFs.pathExists.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) return Promise.resolve(true); // Stale lock exists
        if (filePath === testAgentPath) return Promise.resolve(true);
        if (filePath === testPlanPath) return Promise.resolve(true);
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      mockFs.stat.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) {
          return { 
            isDirectory: () => false, 
            mtime: staleTime,  // Lock file is stale
            mode: 0o100644 // Regular file mode
          } as never;
        }
        // Task directory and other files have current time
        return { 
          isDirectory: () => true, 
          mtime: new Date(),
          mode: 0o040755 // Directory mode
        } as never;
      });
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) {
          return Promise.resolve(JSON.stringify({
            tool: 'report-progress',
            pid: 99999, // Different process that's likely dead
            timestamp: Date.now() - 35000,
            lockId: 'stale-lock-id'
          }));
        }
        if (filePath === testPlanPath) return Promise.resolve(samplePlanContent);
        return Promise.resolve('');
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(mockFs.remove).toHaveBeenCalledWith(testLockPath); // Should cleanup stale lock
    });

    it('should handle lock timeout gracefully', async () => {
      // Mock a lock that never gets released
      mockFs.pathExists.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) return Promise.resolve(true);
        if (filePath === testAgentPath) return Promise.resolve(true);
        if (filePath === testPlanPath) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFs.stat.mockResolvedValue({ 
        isDirectory: () => true, 
        mtime: new Date(),
        mode: 0o040755 // Directory mode
      } as never); // Fresh lock
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) {
          return Promise.resolve(JSON.stringify({
            tool: 'report-progress',
            pid: 12345,
            timestamp: Date.now(),
            lockId: 'persistent-lock-id'
          }));
        }
        if (filePath === testPlanPath) return Promise.resolve(samplePlanContent);
        return Promise.resolve('');
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      // Should fail quickly rather than hanging
      const startTime = Date.now();
      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow('Task is currently locked');
      const endTime = Date.now();

      // Should fail quickly (within reasonable time)
      expect(endTime - startTime).toBeLessThan(5000); // Less than 5 seconds
    });
  });

  describe('Concurrent Tool Usage Scenarios', () => {
    it('should handle rapid successive calls to same tool', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [
          { title: 'Setup Environment', status: 'in_progress' },
          { title: 'Create Database', status: 'pending' }
        ]
      };

      // Fire multiple calls rapidly
      const promises = [
        syncTodoCheckboxes(mockConfig, args),
        syncTodoCheckboxes(mockConfig, args),
        syncTodoCheckboxes(mockConfig, args)
      ];

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);

      // Some may fail due to locking
      const failedResults = results.filter(r => r.status === 'rejected');
      if (failedResults.length > 0) {
        failedResults.forEach(result => {
          const error = result.reason as Error;
          expect(error.message).toContain('locked');
        });
      }
    });

    it('should maintain data consistency during concurrent operations', async () => {
      // Test that concurrent operations don't corrupt the PLAN.md file
      let planContent = samplePlanContent;
      
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === testPlanPath) return Promise.resolve(planContent);
        if (filePath === testProgressPath) return Promise.resolve(sampleProgressContent);
        return Promise.resolve('');
      });

      mockFs.writeFile.mockImplementation((filePath: string, content: string) => {
        if (filePath === testPlanPath) {
          planContent = content; // Update our mock content
        }
        return Promise.resolve();
      });

      // Simulate concurrent updates
      const syncArgs1 = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const syncArgs2 = {
        agent: testAgent,
        todoUpdates: [{ title: 'Create Database', status: 'in_progress' }]
      };

      // Run operations
      try {
        await syncTodoCheckboxes(mockConfig, syncArgs1);
        await syncTodoCheckboxes(mockConfig, syncArgs2);
      } catch (error) {
        // Some operations might fail due to locking, which is expected
        expect((error as Error).message).toContain('locked');
      }

      // Verify the final plan content is valid (not corrupted)
      expect(planContent).toMatch(/^# Test Task Plan/);
      expect(planContent).toMatch(/- \[[ x~]\] \*\*.*\*\*/); // Valid checkbox format
    });

    it('should provide clear error messages for lock conflicts', async () => {
      mockFs.pathExists.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) return Promise.resolve(true);
        if (filePath === testAgentPath) return Promise.resolve(true);
        if (filePath === testPlanPath) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFs.stat.mockResolvedValue({ 
        isDirectory: () => true, 
        mtime: new Date(),
        mode: 0o040755 // Directory mode
      } as never);
      mockFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === testLockPath) {
          return Promise.resolve(JSON.stringify({
            tool: 'report-progress',
            pid: 12345,
            timestamp: Date.now(),
            lockId: 'other-tool-lock'
          }));
        }
        if (filePath === testPlanPath) return Promise.resolve(samplePlanContent);
        return Promise.resolve('');
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      try {
        await syncTodoCheckboxes(mockConfig, args);
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toContain('locked by report-progress');
        expect((error as Error).message).toContain('12345'); // Should include PID
        expect((error as Error).message).toContain('other-tool-lock'); // Should include lock ID
      }
    });
  });

  describe('Performance Under Lock Contention', () => {
    it('should handle multiple tasks with separate locks efficiently', async () => {
      const testTask1 = '2025-09-05T07-49-48-test-task-1';
      const testTask2 = '2025-09-05T08-30-15-test-task-2';
      
      mockFs.readdir.mockResolvedValue([testTask1, testTask2]);
      
      mockFs.pathExists.mockImplementation((filePath: string) => {
        if (filePath === testAgentPath) return Promise.resolve(true);
        if (filePath.includes(testTask1) && !filePath.endsWith('.sync.lock') && !filePath.endsWith('DONE.md') && !filePath.endsWith('ERROR.md')) return Promise.resolve(true);
        if (filePath.includes(testTask2) && !filePath.endsWith('.sync.lock') && !filePath.endsWith('DONE.md') && !filePath.endsWith('ERROR.md')) return Promise.resolve(true);
        if (filePath.includes('PLAN.md')) return Promise.resolve(true);
        if (filePath.endsWith('.sync.lock')) return Promise.resolve(false); // No locks
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      // Both tasks should be able to run simultaneously (different directories)
      const syncArgs1 = {
        agent: testAgent,
        taskId: testTask1,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const syncArgs2 = {
        agent: testAgent,
        taskId: testTask2,
        todoUpdates: [{ title: 'Setup Environment', status: 'in_progress' }]
      };

      const startTime = Date.now();
      const results = await Promise.all([
        syncTodoCheckboxes(mockConfig, syncArgs1),
        syncTodoCheckboxes(mockConfig, syncArgs2)
      ]);
      const endTime = Date.now();

      // Both should succeed
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      // Should complete quickly (no lock contention)
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should handle lock cleanup efficiently', async () => {
      // Create multiple stale locks
      const staleLocks = ['.sync.lock', '.progress.lock', '.other.lock'];
      const staleTime = new Date(Date.now() - 35000);

      mockFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === testAgentPath) {
          // Return task directories
          return [testTaskDir] as never;
        } else if (dirPath === testTaskPath) {
          // Return lock files and plan file in the task directory
          return ['PLAN.md', ...staleLocks] as never;
        }
        return [] as never;
      });
      
      mockFs.pathExists.mockImplementation((filePath: string) => {
        if (filePath === testAgentPath) return Promise.resolve(true);
        if (filePath === testTaskPath) return Promise.resolve(true);
        if (filePath === testPlanPath) return Promise.resolve(true);
        if (filePath.endsWith('.lock')) return Promise.resolve(true); // All lock files exist
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(false);
      });
      
      mockFs.stat.mockImplementation((filePath: string) => {
        if (filePath.endsWith('.lock')) {
          return { 
            isDirectory: () => false, 
            mtime: staleTime,  // All lock files are stale
            mode: 0o100644 // Regular file mode
          } as never;
        }
        // Task directory and other files
        return { 
          isDirectory: () => true, 
          mtime: new Date(),
          mode: 0o040755 // Directory mode
        } as never;
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const startTime = Date.now();
      const result = await syncTodoCheckboxes(mockConfig, args);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      
      // Should cleanup stale locks (at least the relevant .sync.lock)
      expect(mockFs.remove).toHaveBeenCalled();
      expect(mockFs.remove).toHaveBeenCalledWith(expect.stringContaining('.sync.lock'));
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(3000);
    });
  });
});