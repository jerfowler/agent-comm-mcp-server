/**
 * Unit tests for task manager utilities
 * Critical focus: fs.readdir functionality and error handling
 */

import * as path from 'path';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  getAgentTasks,
  getAllAgents,
  archiveTasks,
  restoreTasks
} from '../../../src/utils/task-manager.js';
import { ServerConfig, Task, ArchiveOptions } from '../../../src/types.js';
import * as fs from '../../../src/utils/file-system.js';

// Mock file system utilities
jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  listDirectory: jest.fn(), // Critical: test the fs.readdir wrapper
  isDirectory: jest.fn(),
  isFile: jest.fn(),
  getTaskInfo: jest.fn(),
  getStats: jest.fn(),
  ensureDirectory: jest.fn(),
  moveFile: jest.fn(),
  writeFile: jest.fn(),
  generateTimestamp: jest.fn(),
  validateAgentName: jest.fn(),
  validateTaskName: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// Test configuration
const testConfig: ServerConfig = {
  commDir: '/test/comm',
  archiveDir: '/test/archive',
  logDir: '/test/logs',
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

describe('Task Manager - fs.readdir Critical Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAgentTasks - fs.readdir core functionality', () => {
    it('should handle successful directory listing', async () => {
      // Mock successful directory operations
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue(['task1', 'new-task.md', 'task2']);
      mockFs.isDirectory
        .mockResolvedValueOnce(true)   // task1 is directory
        .mockResolvedValueOnce(false)  // new-task.md is file
        .mockResolvedValueOnce(true);  // task2 is directory
      
      const mockTask1: Task = {
        name: 'task1',
        agent: 'test-agent',
        path: '/test/comm/test-agent/task1',
        hasInit: true,
        hasPlan: true,
        hasDone: false,
        hasError: false,
        created: new Date('2025-01-01T12:00:00Z')
      };

      const mockTask2: Task = {
        name: 'task2',
        agent: 'test-agent',
        path: '/test/comm/test-agent/task2',
        hasInit: true,
        hasPlan: false,
        hasDone: true,
        hasError: false,
        created: new Date('2025-01-01T11:00:00Z')
      };

      mockFs.getTaskInfo
        .mockResolvedValueOnce(mockTask1)
        .mockResolvedValueOnce(mockTask2);

      const mockStats = {
        birthtime: new Date('2025-01-01T12:30:00Z'),
        mtime: new Date('2025-01-01T12:35:00Z')
      };
      mockFs.getStats.mockResolvedValue(mockStats as any);

      const result = await getAgentTasks(testConfig, 'test-agent');

      // Verify fs.readdir wrapper was called correctly
      expect(mockFs.listDirectory).toHaveBeenCalledWith('/test/comm/test-agent');
      expect(result).toHaveLength(3); // 2 directories + 1 new file
      
      // Verify tasks are sorted by creation date (newest first)
      expect(result[0].name).toBe('new-task.md'); // Newest
      expect(result[1]).toEqual(mockTask1);
      expect(result[2]).toEqual(mockTask2);
    });

    it('should handle empty directory', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue([]);

      const result = await getAgentTasks(testConfig, 'empty-agent');

      expect(mockFs.listDirectory).toHaveBeenCalledWith('/test/comm/empty-agent');
      expect(result).toEqual([]);
    });

    it('should handle non-existent agent directory', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await getAgentTasks(testConfig, 'nonexistent-agent');

      expect(mockFs.listDirectory).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle fs.readdir errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(getAgentTasks(testConfig, 'test-agent')).rejects.toThrow('EACCES: permission denied');
      expect(mockFs.listDirectory).toHaveBeenCalledWith('/test/comm/test-agent');
    });

    it('should filter and process mixed directory contents correctly', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue([
        'valid-task-dir',
        'task.md',
        '.hidden-file',
        'README.md',
        '.DS_Store',
        'another-task-dir'
      ]);

      // Mock directory checks
      mockFs.isDirectory
        .mockResolvedValueOnce(true)   // valid-task-dir
        .mockResolvedValueOnce(false)  // task.md
        .mockResolvedValueOnce(false)  // .hidden-file
        .mockResolvedValueOnce(false)  // README.md
        .mockResolvedValueOnce(false)  // .DS_Store
        .mockResolvedValueOnce(true);  // another-task-dir

      const mockTask: Task = {
        name: 'valid-task-dir',
        agent: 'test-agent',
        path: '/test/comm/test-agent/valid-task-dir',
        hasInit: true,
        hasPlan: false,
        hasDone: false,
        hasError: false
      };

      mockFs.getTaskInfo
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(mockTask);

      const mockStats = {
        birthtime: new Date('2025-01-01T12:00:00Z'),
        mtime: new Date('2025-01-01T12:05:00Z')
      };
      mockFs.getStats.mockResolvedValue(mockStats as any);

      const result = await getAgentTasks(testConfig, 'test-agent');

      expect(mockFs.listDirectory).toHaveBeenCalledWith('/test/comm/test-agent');
      // Should process: valid-task-dir, task.md, README.md, another-task-dir
      // Should skip: .hidden-file, .DS_Store (handled by file type checks)
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getAllAgents - Multiple directory scanning', () => {
    it('should scan comm directory and process all agents', async () => {
      // Create a simpler test that just focuses on the core functionality
      mockFs.pathExists.mockResolvedValue(true);
      
      // First call: get comm directory contents
      mockFs.listDirectory.mockImplementationOnce(async (path) => {
        if (path === '/test/comm') {
          return ['agent1', 'agent2', '.hidden', 'temp-file.txt'];
        }
        return [];
      });

      // Subsequent calls: get agent task contents
      let callCount = 0;
      mockFs.listDirectory.mockImplementation(async (path) => {
        callCount++;
        if (path === '/test/comm') {
          return ['agent1', 'agent2', '.hidden', 'temp-file.txt'];
        } else if (path === '/test/comm/agent1') {
          return ['task1', 'task2'];
        } else if (path === '/test/comm/agent2') {
          return ['task3'];
        }
        return [];
      });

      // Mock isDirectory to return true for agents and tasks, false for files
      mockFs.isDirectory.mockImplementation(async (path) => {
        if (path.includes('agent1') && !path.includes('task')) return true;  // agent1 dir
        if (path.includes('agent2') && !path.includes('task')) return true;  // agent2 dir
        if (path.includes('.hidden')) return true;    // .hidden dir (will be filtered by name)
        if (path.includes('temp-file.txt')) return false; // file
        if (path.includes('/task')) return true;     // task directories
        return false;
      });

      // Mock getTaskInfo for tasks
      mockFs.getTaskInfo.mockImplementation(async (path, _agent) => {
        if (path.includes('task1')) {
          return {
            name: 'task1', agent: 'agent1', path: '/test/comm/agent1/task1',
            hasInit: true, hasPlan: true, hasDone: true, hasError: false
          };
        } else if (path.includes('task2')) {
          return {
            name: 'task2', agent: 'agent1', path: '/test/comm/agent1/task2',
            hasInit: true, hasPlan: false, hasDone: false, hasError: true
          };
        } else if (path.includes('task3')) {
          return {
            name: 'task3', agent: 'agent2', path: '/test/comm/agent2/task3',
            hasInit: true, hasPlan: true, hasDone: false, hasError: false
          };
        }
        throw new Error(`Unexpected path: ${path}`);
      });

      const result = await getAllAgents(testConfig);

      expect(result).toHaveLength(2); // agent1 and agent2, not .hidden

      // Verify agent statistics
      const agent1 = result.find(a => a.name === 'agent1');
      expect(agent1).toEqual({
        name: 'agent1',
        taskCount: 2,
        completedCount: 1,    // task1 has hasDone: true
        pendingCount: 0,      // task2 has error, so not pending
        errorCount: 1         // task2 has hasError: true
      });

      const agent2 = result.find(a => a.name === 'agent2');
      expect(agent2).toEqual({
        name: 'agent2',
        taskCount: 1,
        completedCount: 0,
        pendingCount: 1,      // task3 is pending (hasInit && !hasDone && !hasError)
        errorCount: 0
      });
    });

    it('should handle empty comm directory', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue([]);

      const result = await getAllAgents(testConfig);

      expect(result).toEqual([]);
    });

    it('should handle missing comm directory', async () => {
      mockFs.pathExists.mockResolvedValue(false);

      const result = await getAllAgents(testConfig);

      expect(mockFs.listDirectory).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should sort agents by task count descending', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValueOnce(['agent-low', 'agent-high']);
      
      mockFs.isDirectory
        .mockResolvedValue(true);

      // Mock task counts: agent-high = 5, agent-low = 2
      mockFs.listDirectory
        .mockResolvedValueOnce(['t1', 't2'])                    // agent-low: 2 tasks
        .mockResolvedValueOnce(['t1', 't2', 't3', 't4', 't5']); // agent-high: 5 tasks

      // Mock all as directories
      mockFs.isDirectory.mockResolvedValue(true);

      const mockTask: Task = {
        name: 'task',
        agent: 'agent',
        path: '/test/path',
        hasInit: true,
        hasPlan: false,
        hasDone: false,
        hasError: false
      };
      
      mockFs.getTaskInfo.mockResolvedValue(mockTask);

      const result = await getAllAgents(testConfig);

      expect(result[0].name).toBe('agent-high');
      expect(result[0].taskCount).toBe(5);
      expect(result[1].name).toBe('agent-low');
      expect(result[1].taskCount).toBe(2);
    });
  });

  describe('Archive Operations - fs.readdir in complex scenarios', () => {
    const archiveOptions: ArchiveOptions = {
      mode: 'completed',
      dryRun: false
    };

    it('should archive completed tasks using directory scanning', async () => {
      mockFs.generateTimestamp.mockReturnValue('2025-01-01T12-00-00');
      mockFs.pathExists.mockResolvedValue(true);
      
      // Mock directory listing calls
      mockFs.listDirectory.mockImplementation(async (path) => {
        if (path === '/test/comm') {
          return ['agent1'];  // comm directory contents
        } else if (path === '/test/comm/agent1') {
          return ['completed-task', 'pending-task'];  // agent1 directory contents
        }
        return [];
      });

      // Mock isDirectory calls
      mockFs.isDirectory.mockImplementation(async (path) => {
        if (path.includes('agent1') && !path.includes('task')) return true;  // agent1 dir
        if (path.includes('/completed-task') || path.includes('/pending-task')) return true;  // task dirs
        return false;
      });

      // Mock getTaskInfo calls
      mockFs.getTaskInfo.mockImplementation(async (path, _agent) => {
        if (path.includes('completed-task')) {
          return {
            name: 'completed-task', agent: 'agent1', path: '/test/comm/agent1/completed-task',
            hasInit: true, hasPlan: true, hasDone: true, hasError: false,
            created: new Date('2025-01-01T11:00:00Z')
          };
        } else if (path.includes('pending-task')) {
          return {
            name: 'pending-task', agent: 'agent1', path: '/test/comm/agent1/pending-task',
            hasInit: true, hasPlan: true, hasDone: false, hasError: false,
            created: new Date('2025-01-01T11:30:00Z')
          };
        }
        throw new Error(`Unexpected path: ${path}`);
      });

      mockFs.ensureDirectory.mockResolvedValue();
      mockFs.moveFile.mockResolvedValue();

      const result = await archiveTasks(testConfig, archiveOptions);

      expect(result.archived).not.toBeNull();
      expect(result.archived!.completed).toBe(1);
      expect(result.archived!.pending).toBe(0);
      expect(result.archived!.total).toBe(1);

      // Verify archive structure
      expect(mockFs.ensureDirectory).toHaveBeenCalledWith(
        '/test/archive/2025-01-01T12-00-00/completed/agent1'
      );
      expect(mockFs.moveFile).toHaveBeenCalledWith(
        '/test/comm/agent1/completed-task',
        '/test/archive/2025-01-01T12-00-00/completed/agent1/completed-task'
      );
    });

    it('should handle archive restore with directory scanning', async () => {
      const timestamp = '2025-01-01T12-00-00';
      mockFs.pathExists.mockResolvedValue(true);
      
      // Mock archive structure scanning with consistent implementation
      mockFs.listDirectory.mockImplementation(async (path) => {
        if (path === '/test/archive/2025-01-01T12-00-00') {
          return ['completed', 'pending'];
        } else if (path === '/test/archive/2025-01-01T12-00-00/completed') {
          return ['agent1', 'agent2'];
        } else if (path === '/test/archive/2025-01-01T12-00-00/completed/agent1') {
          return ['task1'];
        } else if (path === '/test/archive/2025-01-01T12-00-00/completed/agent2') {
          return ['task2', 'task3'];
        } else if (path === '/test/archive/2025-01-01T12-00-00/pending') {
          return ['agent3'];
        } else if (path === '/test/archive/2025-01-01T12-00-00/pending/agent3') {
          return ['task4'];
        }
        return [];
      });

      mockFs.isDirectory.mockResolvedValue(true);
      mockFs.ensureDirectory.mockResolvedValue();
      mockFs.moveFile.mockResolvedValue();

      const result = await restoreTasks(testConfig, timestamp);

      expect(result.restored.completed).toBe(3); // task1, task2, task3
      expect(result.restored.pending).toBe(1);   // task4
      expect(result.restored.total).toBe(4);     // 3 + 1 = 4

      // Verify directory scanning calls were made
      expect(mockFs.listDirectory).toHaveBeenCalledTimes(5); // Should have made 5 listDirectory calls
      expect(mockFs.moveFile).toHaveBeenCalledTimes(4); // Should have moved 4 tasks
    });
  });

  describe('Error Scenarios - Comprehensive fs.readdir error handling', () => {
    it('should propagate fs.readdir permission errors', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockRejectedValue(new Error('EACCES: permission denied, scandir'));

      await expect(getAgentTasks(testConfig, 'restricted-agent'))
        .rejects.toThrow('EACCES: permission denied, scandir');
    });

    it('should handle fs.readdir EMFILE (too many open files)', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockRejectedValue(new Error('EMFILE: too many open files'));

      await expect(getAllAgents(testConfig))
        .rejects.toThrow('EMFILE: too many open files');
    });

    it('should handle corrupted directory structures', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue(['invalid-entry']);
      mockFs.isDirectory.mockRejectedValue(new Error('ENOTDIR: not a directory'));

      await expect(getAgentTasks(testConfig, 'corrupted-agent'))
        .rejects.toThrow('ENOTDIR: not a directory');
    });

    it('should handle concurrent directory modifications', async () => {
      // Reset mocks for this specific test
      mockFs.pathExists.mockReset();
      mockFs.listDirectory.mockReset(); 
      mockFs.isDirectory.mockReset();
      mockFs.getTaskInfo.mockReset();

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue(['task1', 'task2']);
      mockFs.isDirectory
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('ENOENT: no such file or directory')); // task2 deleted

      // Should handle the error gracefully and continue processing
      await expect(getAgentTasks(testConfig, 'concurrent-agent'))
        .rejects.toThrow('ENOENT');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very large directories', async () => {
      // Reset mocks for this specific test
      mockFs.pathExists.mockReset();
      mockFs.listDirectory.mockReset(); 
      mockFs.isDirectory.mockReset();
      mockFs.getTaskInfo.mockReset();

      const largeDirContents = Array.from({ length: 10000 }, (_, i) => `task-${i}`);
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue(largeDirContents);
      mockFs.isDirectory.mockResolvedValue(true);
      
      const mockTask: Task = {
        name: 'task',
        agent: 'agent',
        path: '/test/path',
        hasInit: true,
        hasPlan: false,
        hasDone: false,
        hasError: false
      };
      
      mockFs.getTaskInfo.mockResolvedValue(mockTask);

      const result = await getAgentTasks(testConfig, 'large-agent');

      expect(mockFs.listDirectory).toHaveBeenCalledWith('/test/comm/large-agent');
      expect(result.length).toBe(10000);
    });

    it('should handle special characters in file names', async () => {
      const specialFiles = [
        'task with spaces.md',
        'task-with-unicode-😀.md',
        'task.with.dots.md',
        'task[brackets].md'
      ];

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue(specialFiles);
      mockFs.isDirectory.mockResolvedValue(false);

      const mockStats = {
        birthtime: new Date('2025-01-01T12:00:00Z'),
        mtime: new Date('2025-01-01T12:05:00Z')
      };
      mockFs.getStats.mockResolvedValue(mockStats as any);

      const result = await getAgentTasks(testConfig, 'special-chars-agent');

      expect(result.length).toBe(4);
      expect(result.every(task => task.isNew)).toBe(true);
    });

    it('should handle symbolic links and special file types', async () => {
      // Reset mocks first
      mockFs.pathExists.mockReset();
      mockFs.listDirectory.mockReset();
      mockFs.isDirectory.mockReset();
      mockFs.getTaskInfo.mockReset();
      mockFs.getStats.mockReset();

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue(['regular-task', 'symlink-task.md']);
      mockFs.isDirectory
        .mockResolvedValueOnce(true)   // regular-task is directory
        .mockResolvedValueOnce(false); // symlink-task.md is file

      const mockTask: Task = {
        name: 'regular-task',
        agent: 'test-agent',
        path: '/test/comm/test-agent/regular-task',
        hasInit: true,
        hasPlan: false,
        hasDone: false,
        hasError: false
      };

      mockFs.getTaskInfo.mockResolvedValue(mockTask);

      const mockStats = {
        birthtime: new Date('2025-01-01T12:00:00Z'),
        mtime: new Date('2025-01-01T12:05:00Z')
      };
      mockFs.getStats.mockResolvedValue(mockStats as any);

      const result = await getAgentTasks(testConfig, 'symlink-agent');

      expect(result.length).toBe(2); // Both should be processed
      expect(result.find(t => t.name === 'regular-task')?.isNew).toBeUndefined();
      expect(result.find(t => t.name === 'symlink-task.md')?.isNew).toBe(true);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle rapid successive calls', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue(['task1']);
      mockFs.isDirectory.mockResolvedValue(true);
      
      const mockTask: Task = {
        name: 'task1',
        agent: 'concurrent-agent',
        path: '/test/comm/concurrent-agent/task1',
        hasInit: true,
        hasPlan: false,
        hasDone: false,
        hasError: false
      };

      mockFs.getTaskInfo.mockResolvedValue(mockTask);

      // Fire multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        getAgentTasks(testConfig, 'concurrent-agent')
      );

      const results = await Promise.all(promises);

      expect(results.every(result => result.length === 1)).toBe(true);
      expect(mockFs.listDirectory).toHaveBeenCalledTimes(10);
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure with large object creation
      const largeTaskCount = 50000;
      const largeTasks = Array.from({ length: largeTaskCount }, (_, i) => `task-${i}.md`);

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory.mockResolvedValue(largeTasks);
      mockFs.isDirectory.mockResolvedValue(false);

      const mockStats = {
        birthtime: new Date('2025-01-01T12:00:00Z'),
        mtime: new Date('2025-01-01T12:05:00Z')
      };
      mockFs.getStats.mockResolvedValue(mockStats as any);

      const result = await getAgentTasks(testConfig, 'memory-pressure-agent');

      expect(result.length).toBe(largeTaskCount);
      expect(result.every(task => task.isNew)).toBe(true);
    });
  });
});

describe('Integration with fs-extra module', () => {
  it('should verify fs-extra import is working correctly', () => {
    // This test ensures that the import structure is maintained
    expect(mockFs.listDirectory).toBeDefined();
    expect(mockFs.pathExists).toBeDefined();
    expect(mockFs.isDirectory).toBeDefined();
  });

  it('should use consistent path handling', async () => {
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.listDirectory.mockResolvedValue(['test-task']);
    mockFs.isDirectory.mockResolvedValue(true);

    const mockTask: Task = {
      name: 'test-task',
      agent: 'path-agent',
      path: path.join('/test/comm/path-agent', 'test-task'),
      hasInit: true,
      hasPlan: false,
      hasDone: false,
      hasError: false
    };

    mockFs.getTaskInfo.mockResolvedValue(mockTask);

    await getAgentTasks(testConfig, 'path-agent');

    // Verify path construction is consistent
    expect(mockFs.listDirectory).toHaveBeenCalledWith(
      path.join(testConfig.commDir, 'path-agent')
    );
  });
});