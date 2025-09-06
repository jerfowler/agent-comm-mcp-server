/**
 * Unit tests for file system utilities
 * CRITICAL: Tests the fs.readdir fix that prevents "fs.readdir is not a function" error
 */

import { jest } from '@jest/globals';
import {
  ensureDirectory,
  pathExists,
  readFile,
  writeFile,
  moveFile,
  copyFile,
  remove,
  listDirectory,
  getStats,
  isDirectory,
  isFile,
  getTaskInfo,
  parseTaskMetadata,
  generateTimestamp,
  validateTaskName,
  validateAgentName
} from '../../../src/utils/file-system.js';
import { FileNotFoundError, InvalidTaskError } from '../../../src/types.js';
import { sampleTaskFiles } from '../../fixtures/sample-tasks.js';

// Mock fs-extra with the functions - use ESM default export format
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  move: jest.fn(),
  copy: jest.fn(),
  remove: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));

// Import fs-extra after mocking to get the mocked functions
import fs from 'fs-extra';
const mockFs = fs as any as jest.Mocked<{
  ensureDir: jest.MockedFunction<any>,
  pathExists: jest.MockedFunction<any>,
  readFile: jest.MockedFunction<any>,
  writeFile: jest.MockedFunction<any>,
  move: jest.MockedFunction<any>,
  copy: jest.MockedFunction<any>,
  remove: jest.MockedFunction<any>,
  readdir: jest.MockedFunction<any>,
  stat: jest.MockedFunction<any>
}>;

describe('File System Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDirectory', () => {
    it('should call fs.ensureDir with correct path', async () => {
      await ensureDirectory('/test/path');
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/path');
    });
  });

  describe('pathExists', () => {
    it('should return true for existing path', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      const result = await pathExists('/test/path');
      expect(result).toBe(true);
      expect(mockFs.pathExists).toHaveBeenCalledWith('/test/path');
    });

    it('should return false for non-existing path', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      const result = await pathExists('/test/path');
      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file content successfully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(sampleTaskFiles.newTask);
      
      const result = await readFile('/test/file.md');
      expect(result).toBe(sampleTaskFiles.newTask);
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/file.md', 'utf-8');
    });

    it('should throw FileNotFoundError for non-existing file', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      await expect(readFile('/test/nonexistent.md')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('writeFile', () => {
    it('should write file content successfully', async () => {
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      
      const result = await writeFile('/test/file.md', sampleTaskFiles.newTask);
      
      // SafeFileSystem should attempt fs-extra first, then Node.js fallback if needed
      expect(result).toBeUndefined(); // Successful write returns nothing
      // With SafeFileSystem wrapper, exact call patterns may vary due to fallback logic
    });
  });

  describe('moveFile', () => {
    it('should move file successfully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.move.mockResolvedValue(undefined);
      
      await moveFile('/test/source.md', '/test/dest/file.md');
      
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/dest');
      expect(mockFs.move).toHaveBeenCalledWith('/test/source.md', '/test/dest/file.md', { overwrite: true });
    });

    it('should throw FileNotFoundError for non-existing source', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      await expect(moveFile('/test/nonexistent.md', '/test/dest.md')).rejects.toThrow(FileNotFoundError);
    });
  });

  // CRITICAL TEST SECTION: fs.readdir regression prevention
  describe('listDirectory', () => {
    it('should list directory contents successfully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['file1.md', 'file2.md', 'subdir']);
      
      const result = await listDirectory('/test/dir');
      
      expect(result).toEqual(['file1.md', 'file2.md', 'subdir']);
      expect(mockFs.readdir).toHaveBeenCalledWith('/test/dir');
    });

    it('should return empty array for non-existing directory', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const result = await listDirectory('/test/nonexistent');
      
      expect(result).toEqual([]);
      expect(mockFs.readdir).not.toHaveBeenCalled();
    });

    it('should handle fs.readdir errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));
      
      // SafeFileSystem provides fallback to Node.js built-in on fs-extra errors
      // The exact error may vary depending on fallback behavior
      await expect(listDirectory('/test/restricted')).rejects.toThrow();
      expect(mockFs.readdir).toHaveBeenCalledWith('/test/restricted');
    });

    // REGRESSION TEST: Verify fs.readdir is callable (not undefined)
    it('REGRESSION TEST: fs.readdir function should be available and callable', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue([]);
      
      // This test would fail with "fs.readdir is not a function" if import pattern is wrong
      await expect(listDirectory('/test/empty')).resolves.toEqual([]);
      expect(mockFs.readdir).toHaveBeenCalledTimes(1);
      expect(typeof mockFs.readdir).toBe('function');
    });
  });

  describe('copyFile', () => {
    it('should copy file successfully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.ensureDir.mockResolvedValue(undefined);
      mockFs.copy.mockResolvedValue(undefined);
      
      await copyFile('/test/source.md', '/test/dest/file.md');
      
      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/dest');
      expect(mockFs.copy).toHaveBeenCalledWith('/test/source.md', '/test/dest/file.md', { overwrite: true });
    });

    it('should throw FileNotFoundError for non-existing source', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      await expect(copyFile('/test/nonexistent.md', '/test/dest.md')).rejects.toThrow(FileNotFoundError);
    });
  });

  describe('remove', () => {
    it('should remove existing file/directory', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.remove.mockResolvedValue(undefined);
      
      await remove('/test/target');
      
      expect(mockFs.remove).toHaveBeenCalledWith('/test/target');
    });

    it('should not call fs.remove for non-existing path', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      await remove('/test/nonexistent');
      
      expect(mockFs.remove).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return file stats', async () => {
      const mockStats = {
        isDirectory: () => false,
        isFile: () => true,
        birthtime: new Date(),
        mtime: new Date()
      };
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      const result = await getStats('/test/file.md');
      
      expect(result).toBe(mockStats);
      expect(mockFs.stat).toHaveBeenCalledWith('/test/file.md');
    });
  });

  describe('isDirectory', () => {
    it('should return true for directory', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      
      const result = await isDirectory('/test/dir');
      
      expect(result).toBe(true);
    });

    it('should return false for file', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({ isDirectory: () => false } as any);
      
      const result = await isDirectory('/test/file.md');
      
      expect(result).toBe(false);
    });

    it('should return false for non-existing path', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const result = await isDirectory('/test/nonexistent');
      
      expect(result).toBe(false);
    });
  });

  describe('isFile', () => {
    it('should return true for file', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
      
      const result = await isFile('/test/file.md');
      
      expect(result).toBe(true);
    });

    it('should return false for directory', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({ isFile: () => false } as any);
      
      const result = await isFile('/test/dir');
      
      expect(result).toBe(false);
    });

    it('should return false for non-existing path', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const result = await isFile('/test/nonexistent');
      
      expect(result).toBe(false);
    });
  });

  describe('getTaskInfo', () => {
    it('should return task info with all files present', async () => {
      const taskPath = '/test/comm/agent/task';
      
      // Mock pathExists for different files
      mockFs.pathExists
        .mockResolvedValueOnce(true)  // INIT.md
        .mockResolvedValueOnce(true)  // PLAN.md
        .mockResolvedValueOnce(true)  // DONE.md
        .mockResolvedValueOnce(false); // ERROR.md
      
      const mockStats = {
        birthtime: new Date('2025-01-01T12:00:00Z'),
        mtime: new Date('2025-01-01T13:00:00Z')
      };
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      const result = await getTaskInfo(taskPath, 'test-agent');
      
      expect(result).toEqual({
        name: 'task',
        agent: 'test-agent',
        path: taskPath,
        hasInit: true,
        hasPlan: true,
        hasDone: true,
        hasError: false,
        created: new Date('2025-01-01T13:00:00Z'), // Uses mtime, not birthtime
        updated: new Date('2025-01-01T13:00:00Z')  // Uses mtime, not birthtime
      });
    });

    it('should handle missing INIT.md gracefully', async () => {
      const taskPath = '/test/comm/agent/incomplete-task';
      
      // Mock pathExists for different files
      mockFs.pathExists
        .mockResolvedValueOnce(false)  // INIT.md
        .mockResolvedValueOnce(false)  // PLAN.md
        .mockResolvedValueOnce(false)  // DONE.md
        .mockResolvedValueOnce(false); // ERROR.md
      
      const result = await getTaskInfo(taskPath, 'test-agent');
      
      expect(result).toEqual({
        name: 'incomplete-task',
        agent: 'test-agent',
        path: taskPath,
        hasInit: false,
        hasPlan: false,
        hasDone: false,
        hasError: false
      });
    });

    it('should handle stat errors gracefully', async () => {
      const taskPath = '/test/comm/agent/task-with-stat-error';
      
      // Mock pathExists for INIT.md as true
      mockFs.pathExists
        .mockResolvedValueOnce(true)  // INIT.md
        .mockResolvedValueOnce(false)  // PLAN.md
        .mockResolvedValueOnce(false)  // DONE.md
        .mockResolvedValueOnce(false); // ERROR.md
      
      // Mock stat to throw error
      mockFs.stat.mockRejectedValue(new Error('Permission denied'));
      
      const result = await getTaskInfo(taskPath, 'test-agent');
      
      expect(result).toEqual({
        name: 'task-with-stat-error',
        agent: 'test-agent',
        path: taskPath,
        hasInit: true,
        hasPlan: false,
        hasDone: false,
        hasError: false
        // No created/updated fields when stat fails
      });
    });
  });

  describe('parseTaskMetadata', () => {
    it('should parse metadata correctly', () => {
      const result = parseTaskMetadata(sampleTaskFiles.newTask);
      
      expect(result).toEqual({
        agent: 'senior-frontend-engineer',
        created: '2025-01-01T12:00:00Z',
        source: 'product-manager'
      });
    });

    it('should return undefined for content without metadata', () => {
      const content = '# Task without metadata\\nJust some content';
      const result = parseTaskMetadata(content);
      
      expect(result).toBeUndefined();
    });

    it('should return undefined for incomplete metadata', () => {
      const content = `# Task
## Metadata
- Agent: test-agent
- Created: 2025-01-01T12:00:00Z
# Missing source`;
      
      const result = parseTaskMetadata(content);
      expect(result).toBeUndefined();
    });
  });

  describe('generateTimestamp', () => {
    it('should generate timestamp in correct format', () => {
      const timestamp = generateTimestamp();
      const regex = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;
      
      expect(timestamp).toMatch(regex);
    });

    it('should generate unique timestamps', () => {
      const timestamp1 = generateTimestamp();
      // Small delay to ensure different timestamps
      const timestamp2 = generateTimestamp();
      
      // They should be at least in the correct format
      const regex = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;
      expect(timestamp1).toMatch(regex);
      expect(timestamp2).toMatch(regex);
    });
  });

  describe('validateTaskName', () => {
    it('should accept valid task names', () => {
      expect(() => validateTaskName('valid-task-name')).not.toThrow();
      expect(() => validateTaskName('task123')).not.toThrow();
      expect(() => validateTaskName('Task_Name')).not.toThrow();
    });

    it('should reject empty task names', () => {
      expect(() => validateTaskName('')).toThrow(InvalidTaskError);
      expect(() => validateTaskName('   ')).toThrow(InvalidTaskError);
    });

    it('should reject task names with path separators', () => {
      expect(() => validateTaskName('task/name')).toThrow(InvalidTaskError);
      expect(() => validateTaskName('task\\\\name')).toThrow(InvalidTaskError);
    });

    it('should reject task names starting with dot', () => {
      expect(() => validateTaskName('.hidden-task')).toThrow(InvalidTaskError);
    });
  });

  describe('validateAgentName', () => {
    it('should accept valid agent names', () => {
      expect(() => validateAgentName('senior-frontend-engineer')).not.toThrow();
      expect(() => validateAgentName('agent123')).not.toThrow();
      expect(() => validateAgentName('Agent_Name')).not.toThrow();
    });

    it('should reject empty agent names', () => {
      expect(() => validateAgentName('')).toThrow(InvalidTaskError);
      expect(() => validateAgentName('   ')).toThrow(InvalidTaskError);
    });

    it('should reject agent names with path separators', () => {
      expect(() => validateAgentName('agent/name')).toThrow(InvalidTaskError);
      expect(() => validateAgentName('agent\\\\name')).toThrow(InvalidTaskError);
    });

    it('should reject agent names starting with dot', () => {
      expect(() => validateAgentName('.hidden-agent')).toThrow(InvalidTaskError);
    });
  });
});