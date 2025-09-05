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