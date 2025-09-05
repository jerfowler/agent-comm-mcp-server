/**
 * Focused coverage tests for task-manager.ts uncovered lines
 * Target: Lines 165, 182, 221-227, 270, 330-359
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { tmpdir } from 'os';
import {
  archiveTasks,
  restoreTasks,
  cleanupArchives
} from '../../../src/utils/task-manager.js';
import { ServerConfig, ArchiveOptions } from '../../../src/types.js';

describe('Task Manager Coverage Tests', () => {
  let testDir: string;
  let commDir: string;
  let archiveDir: string;
  let config: ServerConfig;
  let configDisabled: ServerConfig;

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'task-manager-coverage-'));
    commDir = path.join(testDir, 'comm');
    archiveDir = path.join(testDir, 'archive');
    
    config = {
      commDir: commDir,
      archiveDir: archiveDir,
      logDir: path.join(testDir, 'logs'),
      enableArchiving: true,
      connectionManager: {
        register: jest.fn(),
        getConnection: jest.fn(),
        updateActivity: jest.fn(),
        getActiveConnections: jest.fn(),
        unregister: jest.fn(),
        getConnectionsByAgent: jest.fn(),
        cleanupStaleConnections: jest.fn(),
        getStatistics: jest.fn(),
        getConnectionCount: jest.fn(),
        hasConnection: jest.fn()
      } as any,
      eventLogger: {
        logOperation: jest.fn(),
        logError: jest.fn(),
        getOperationStatistics: jest.fn()
      } as any
    };

    configDisabled = {
      ...config,
      enableArchiving: false
    };
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  beforeEach(async () => {
    await fs.remove(commDir);
    await fs.remove(archiveDir);
    await fs.ensureDir(commDir);
    await fs.ensureDir(archiveDir);
  });


  describe('Archive operations with disabled config', () => {
    it('should throw error when archiving is disabled - Line 182', async () => {
      const options: ArchiveOptions = {
        mode: 'completed',
        dryRun: false
      };

      await expect(archiveTasks(configDisabled, options))
        .rejects.toThrow('Archiving is disabled');
    });

    it('should throw error when restore is disabled - Line 270', async () => {
      await expect(restoreTasks(configDisabled, '2025-01-01T12-00-00'))
        .rejects.toThrow('Archiving is disabled');
    });
  });

  describe('Archive by-date mode - Lines 221-227', () => {
    it('should archive tasks older than specified days', async () => {
      // Create test task with old date
      const agentDir = path.join(commDir, 'test-agent');
      const taskDir = path.join(agentDir, 'old-task');
      await fs.ensureDir(taskDir);
      const initPath = path.join(taskDir, 'INIT.md');
      await fs.writeFile(initPath, '# Old Task');
      
      // Set both the task directory and INIT.md file to be 10 days old
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      await fs.utimes(taskDir, oldDate, oldDate);
      await fs.utimes(initPath, oldDate, oldDate);

      const options: ArchiveOptions = {
        mode: 'by-date',
        olderThan: 5, // Archive tasks older than 5 days
        dryRun: false
      };

      const result = await archiveTasks(config, options);
      
      expect(result.archived).not.toBeNull();
      expect(result.archived!.total).toBe(1);
      
      // Verify task was archived
      expect(await fs.pathExists(taskDir)).toBe(false);
      expect(result.archivePath).toBeDefined();
      expect(await fs.pathExists(path.join(result.archivePath!, 'pending', 'test-agent', 'old-task'))).toBe(true);
    });

    it('should not archive recent tasks with by-date mode', async () => {
      // Create test task with recent date
      const agentDir = path.join(commDir, 'test-agent');
      const taskDir = path.join(agentDir, 'recent-task');
      await fs.ensureDir(taskDir);
      await fs.writeFile(path.join(taskDir, 'INIT.md'), '# Recent Task');

      const options: ArchiveOptions = {
        mode: 'by-date',
        olderThan: 10, // Archive tasks older than 10 days
        dryRun: false
      };

      const result = await archiveTasks(config, options);
      
      expect(result.archived).not.toBeNull();
      expect(result.archived!.total).toBe(0);
      
      // Verify task was not archived
      expect(await fs.pathExists(taskDir)).toBe(true);
    });
  });

  describe('Archive modes - Lines 163-170', () => {
    it('should archive all tasks with mode "all"', async () => {
      // Create test tasks for multiple agents
      const agent1Dir = path.join(commDir, 'agent1');
      const agent2Dir = path.join(commDir, 'agent2');
      await fs.ensureDir(path.join(agent1Dir, 'task1'));
      await fs.ensureDir(path.join(agent1Dir, 'task2'));
      await fs.ensureDir(path.join(agent2Dir, 'task3'));
      
      await fs.writeFile(path.join(agent1Dir, 'task1', 'INIT.md'), '# Task 1');
      await fs.writeFile(path.join(agent1Dir, 'task2', 'INIT.md'), '# Task 2');
      await fs.writeFile(path.join(agent1Dir, 'task2', 'DONE.md'), '# Completed');
      await fs.writeFile(path.join(agent2Dir, 'task3', 'INIT.md'), '# Task 3');

      const options: ArchiveOptions = {
        mode: 'all',
        dryRun: false
      };

      const result = await archiveTasks(config, options);
      
      expect(result.archived).not.toBeNull();
      expect(result.archived!.total).toBe(3);
      
      // Verify all tasks were archived regardless of completion status
      expect(await fs.pathExists(path.join(agent1Dir, 'task1'))).toBe(false);
      expect(await fs.pathExists(path.join(agent1Dir, 'task2'))).toBe(false);
      expect(await fs.pathExists(path.join(agent2Dir, 'task3'))).toBe(false);
    });

    it('should archive tasks by specific agent with mode "by-agent"', async () => {
      // Create test tasks for multiple agents
      const agent1Dir = path.join(commDir, 'target-agent');
      const agent2Dir = path.join(commDir, 'other-agent');
      await fs.ensureDir(path.join(agent1Dir, 'task1'));
      await fs.ensureDir(path.join(agent2Dir, 'task2'));
      
      await fs.writeFile(path.join(agent1Dir, 'task1', 'INIT.md'), '# Target Task');
      await fs.writeFile(path.join(agent2Dir, 'task2', 'INIT.md'), '# Other Task');

      const options: ArchiveOptions = {
        mode: 'by-agent',
        agent: 'target-agent',
        dryRun: false
      };

      const result = await archiveTasks(config, options);
      
      expect(result.archived).not.toBeNull();
      expect(result.archived!.total).toBe(1);
      
      // Verify only target agent's task was archived
      expect(await fs.pathExists(path.join(agent1Dir, 'task1'))).toBe(false);
      expect(await fs.pathExists(path.join(agent2Dir, 'task2'))).toBe(true);
    });
  });

  describe('Archive task filtering - Line 151', () => {
    it('should skip new task files during archiving', async () => {
      // Create agent directory and a loose .md file (which gets isNew: true)
      const agentDir = path.join(commDir, 'test-agent');
      await fs.ensureDir(agentDir);
      
      // Create a new task file directly in agent directory (not in a task folder)
      await fs.writeFile(path.join(agentDir, 'new-task.md'), '# New task file');
      
      // Also create a proper task directory to verify it would be processed
      const taskDir = path.join(agentDir, 'proper-task');
      await fs.ensureDir(taskDir);
      await fs.writeFile(path.join(taskDir, 'INIT.md'), '# Proper task');
      await fs.writeFile(path.join(taskDir, 'DONE.md'), '# Completed');

      const options: ArchiveOptions = {
        mode: 'completed',
        dryRun: false
      };

      const result = await archiveTasks(config, options);
      
      // Should archive only the completed proper task, skip the new file
      expect(result.archived).not.toBeNull();
      expect(result.archived!.total).toBe(1);
      expect(await fs.pathExists(path.join(agentDir, 'new-task.md'))).toBe(true); // New file stays
      expect(await fs.pathExists(taskDir)).toBe(false); // Proper task archived
    });
  });

  describe('Restore tasks filtering - Lines 237-248', () => {
    it('should handle missing archive type directories', async () => {
      // Create archive with only completed directory, missing pending
      const timestamp = '2024-01-01T12-00-00';
      const archiveBasePath = path.join(archiveDir, timestamp);
      await fs.ensureDir(path.join(archiveBasePath, 'completed'));
      
      const result = await restoreTasks(config, timestamp);
      
      expect(result.restored.total).toBe(0);
    });

    it('should filter tasks by name during restore', async () => {
      // Create archive with multiple tasks
      const timestamp = '2024-01-02T12-00-00';
      const archiveBasePath = path.join(archiveDir, timestamp);
      const completedPath = path.join(archiveBasePath, 'completed', 'test-agent');
      await fs.ensureDir(completedPath);
      
      // Create tasks with different names
      await fs.ensureDir(path.join(completedPath, 'target-task-123'));
      await fs.ensureDir(path.join(completedPath, 'other-task-456'));
      await fs.writeFile(path.join(completedPath, 'target-task-123', 'INIT.md'), '# Target');
      await fs.writeFile(path.join(completedPath, 'other-task-456', 'INIT.md'), '# Other');

      const result = await restoreTasks(config, timestamp, 'test-agent', 'target-task');
      
      expect(result.restored.total).toBe(1);
      expect(await fs.pathExists(path.join(commDir, 'test-agent', 'target-task-123'))).toBe(true);
      expect(await fs.pathExists(path.join(commDir, 'test-agent', 'other-task-456'))).toBe(false);
    });
  });

  describe('Restore tasks error handling - Line 227', () => {
    it('should throw error when archive timestamp does not exist', async () => {
      const nonExistentTimestamp = '2024-01-01T00-00-00';
      
      await expect(restoreTasks(config, nonExistentTimestamp))
        .rejects.toThrow(`Archive not found: ${nonExistentTimestamp}`);
    });
  });

  describe('cleanupArchives function - Lines 330-359', () => {
    it('should return 0 when archiving is disabled - Line 330-332', async () => {
      const result = await cleanupArchives(configDisabled, 30);
      expect(result).toBe(0);
    });

    it('should return 0 when archive directory does not exist - Line 334-336', async () => {
      await fs.remove(archiveDir);
      
      const result = await cleanupArchives(config, 30);
      expect(result).toBe(0);
    });

    it('should delete old archives and return count - Lines 338-359', async () => {
      // Create old archive directories
      const oldTimestamp1 = '2024-01-01T12-00-00';
      const oldTimestamp2 = '2024-01-02T12-00-00';
      const recentTimestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      await fs.ensureDir(path.join(archiveDir, oldTimestamp1));
      await fs.ensureDir(path.join(archiveDir, oldTimestamp2));
      await fs.ensureDir(path.join(archiveDir, recentTimestamp));
      
      // Add some files to make sure they get deleted
      await fs.writeFile(path.join(archiveDir, oldTimestamp1, 'test.txt'), 'test');
      await fs.writeFile(path.join(archiveDir, oldTimestamp2, 'test.txt'), 'test');
      
      const result = await cleanupArchives(config, 30); // Delete archives older than 30 days
      
      expect(result).toBe(2); // Should delete 2 old archives
      
      // Verify old archives were deleted
      expect(await fs.pathExists(path.join(archiveDir, oldTimestamp1))).toBe(false);
      expect(await fs.pathExists(path.join(archiveDir, oldTimestamp2))).toBe(false);
      
      // Verify recent archive was not deleted
      expect(await fs.pathExists(path.join(archiveDir, recentTimestamp))).toBe(true);
    });

    it('should handle invalid archive names gracefully - Lines 354-356', async () => {
      // Create directories with invalid timestamp names
      await fs.ensureDir(path.join(archiveDir, 'invalid-timestamp'));
      await fs.ensureDir(path.join(archiveDir, 'not-a-date'));
      await fs.ensureDir(path.join(archiveDir, '2024-invalid-format'));
      
      const result = await cleanupArchives(config, 30);
      
      expect(result).toBe(0); // Should not delete any (invalid names are skipped)
      
      // Verify invalid archives still exist
      expect(await fs.pathExists(path.join(archiveDir, 'invalid-timestamp'))).toBe(true);
      expect(await fs.pathExists(path.join(archiveDir, 'not-a-date'))).toBe(true);
      expect(await fs.pathExists(path.join(archiveDir, '2024-invalid-format'))).toBe(true);
    });
  });
});