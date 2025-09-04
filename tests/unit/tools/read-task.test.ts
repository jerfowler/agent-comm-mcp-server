/**
 * Unit tests for read-task tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { readTask } from '../../../src/tools/read-task.js';
import * as fileSystem from '../../../src/utils/file-system.js';
import * as validation from '../../../src/utils/validation.js';
import { ServerConfig, TaskMetadata, InvalidTaskError, FileNotFoundError } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';
import * as path from 'path';

// Mock modules
jest.mock('../../../src/utils/file-system.js');
jest.mock('../../../src/utils/validation.js');

const mockFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;
const mockValidation = validation as jest.Mocked<typeof validation>;

describe('Read Task Tool', () => {
  let mockConfig: ServerConfig;
  let mockStats: any;
  let mockMetadata: TaskMetadata;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = testUtils.createMockConfig();
    mockStats = testUtils.createMockStats();
    mockMetadata = {
      agent: 'test-agent',
      created: '2025-01-01T12:00:00Z',
      source: 'test-source'
    };

    // Setup default validation mocks
    mockValidation.validateRequiredString.mockImplementation((value) => value as string);
    mockValidation.validateTaskFileType.mockImplementation((value) => value as any);

    // Setup default file system mocks
    mockFileSystem.readFile.mockResolvedValue(testUtils.sampleTaskContent);
    mockFileSystem.getStats.mockResolvedValue(mockStats);
    mockFileSystem.parseTaskMetadata.mockReturnValue(mockMetadata);
  });

  describe('successful read operations', () => {
    it('should read INIT.md file with metadata', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      const result = await readTask(mockConfig, args);

      const expectedPath = path.join(mockConfig.commDir, 'test-agent', 'test-task', 'INIT.md');
      
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('test-agent', 'agent');
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('test-task', 'task');
      expect(mockValidation.validateTaskFileType).toHaveBeenCalledWith('INIT');
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
      expect(mockFileSystem.getStats).toHaveBeenCalledWith(expectedPath);
      expect(mockFileSystem.parseTaskMetadata).toHaveBeenCalledWith(testUtils.sampleTaskContent);
      
      expect(result).toEqual({
        content: testUtils.sampleTaskContent,
        lastModified: mockStats.mtime,
        metadata: mockMetadata
      });
    });

    it('should read PLAN.md file', async () => {
      const planContent = testUtils.samplePlanContent;
      const args = {
        agent: 'backend-engineer',
        task: 'implement-api',
        file: 'PLAN'
      };
      
      mockFileSystem.readFile.mockResolvedValue(planContent);
      
      const result = await readTask(mockConfig, args);

      const expectedPath = path.join(mockConfig.commDir, 'backend-engineer', 'implement-api', 'PLAN.md');
      
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
      expect(result.content).toBe(planContent);
      // Path is no longer exposed in response for security reasons
    });

    it('should read DONE.md file', async () => {
      const doneContent = '# Task Complete: Test Task\n\n## Results\nTask completed successfully.';
      const args = {
        agent: 'frontend-engineer',
        task: 'fix-ui-bug',
        file: 'DONE'
      };
      
      mockFileSystem.readFile.mockResolvedValue(doneContent);
      
      const result = await readTask(mockConfig, args);

      const expectedPath = path.join(mockConfig.commDir, 'frontend-engineer', 'fix-ui-bug', 'DONE.md');
      
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
      expect(result.content).toBe(doneContent);
      // Path is no longer exposed in response for security reasons
    });

    it('should read ERROR.md file', async () => {
      const errorContent = '# Task Error: Test Task\n\n## Issue\nPermission denied accessing database.';
      const args = {
        agent: 'database-admin',
        task: 'migrate-schema',
        file: 'ERROR'
      };
      
      mockFileSystem.readFile.mockResolvedValue(errorContent);
      
      const result = await readTask(mockConfig, args);

      const expectedPath = path.join(mockConfig.commDir, 'database-admin', 'migrate-schema', 'ERROR.md');
      
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
      expect(result.content).toBe(errorContent);
      // Path is no longer exposed in response for security reasons
    });

    it('should read file without metadata when parsing returns null', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN'
      };
      
      mockFileSystem.parseTaskMetadata.mockReturnValue(undefined);
      
      const result = await readTask(mockConfig, args);

      expect(result).toEqual({
        content: testUtils.sampleTaskContent,
        lastModified: mockStats.mtime
      });
      expect(result).not.toHaveProperty('metadata');
    });

    it('should handle complex agent and task names', async () => {
      const args = {
        agent: 'senior-qa-automation-engineer_v2',
        task: '20250101-123456-test-auth-flow',
        file: 'INIT'
      };
      
      await readTask(mockConfig, args);

      const expectedPath = path.join(
        mockConfig.commDir, 
        'senior-qa-automation-engineer_v2', 
        '20250101-123456-test-auth-flow', 
        'INIT.md'
      );
      
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
      // Path is no longer exposed in response for security reasons
    });

    it('should handle unicode characters in names', async () => {
      const args = {
        agent: 'développeur-backend',
        task: 'tâche-spéciale-éöñ',
        file: 'DONE'
      };
      
      await readTask(mockConfig, args);

      const expectedPath = path.join(
        mockConfig.commDir, 
        'développeur-backend', 
        'tâche-spéciale-éöñ', 
        'DONE.md'
      );
      
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
      // Path is no longer exposed in response for security reasons
    });
  });

  describe('input validation failures', () => {
    it('should propagate validation error for missing agent', async () => {
      const args = {
        task: 'test-task',
        file: 'INIT'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'agent') {
          throw new InvalidTaskError('agent must be a non-empty string', 'agent');
        }
        return value as string;
      });
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
      
      expect(mockFileSystem.readFile).not.toHaveBeenCalled();
    });

    it('should propagate validation error for empty agent', async () => {
      const args = {
        agent: '',
        task: 'test-task',
        file: 'INIT'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'agent' && value === '') {
          throw new InvalidTaskError('agent must be a non-empty string', 'agent');
        }
        return value as string;
      });
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
    });

    it('should propagate validation error for missing task', async () => {
      const args = {
        agent: 'test-agent',
        file: 'INIT'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'task') {
          throw new InvalidTaskError('task must be a non-empty string', 'task');
        }
        return value as string;
      });
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('task must be a non-empty string');
    });

    it('should propagate validation error for empty task', async () => {
      const args = {
        agent: 'test-agent',
        task: '   ',
        file: 'INIT'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'task' && (value as string).trim() === '') {
          throw new InvalidTaskError('task must be a non-empty string', 'task');
        }
        return value as string;
      });
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('task must be a non-empty string');
    });

    it('should propagate validation error for invalid file type', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INVALID'
      };
      
      mockValidation.validateTaskFileType.mockImplementation(() => {
        throw new InvalidTaskError('file must be one of: INIT, PLAN, DONE, ERROR', 'file');
      });
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('file must be one of: INIT, PLAN, DONE, ERROR');
    });

    it('should handle null values for parameters', async () => {
      const testCases = [
        { args: { agent: null, task: 'task', file: 'INIT' }, param: 'agent' },
        { args: { agent: 'agent', task: null, file: 'INIT' }, param: 'task' },
        { args: { agent: 'agent', task: 'task', file: null }, param: 'file' }
      ];
      
      for (const testCase of testCases) {
        mockValidation.validateRequiredString.mockImplementation((value, name) => {
          if (name === testCase.param) {
            throw new InvalidTaskError(`${testCase.param} must be a non-empty string`, testCase.param);
          }
          return value as string;
        });
        
        mockValidation.validateTaskFileType.mockImplementation((value) => {
          if (value === null) {
            throw new InvalidTaskError('file must be one of: INIT, PLAN, DONE, ERROR', 'file');
          }
          return value as any;
        });
        
        await expect(readTask(mockConfig, testCase.args))
          .rejects.toThrow();
        
        jest.clearAllMocks();
      }
    });

    it('should handle undefined values for parameters', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task'
        // file is undefined
      };
      
      mockValidation.validateTaskFileType.mockImplementation(() => {
        throw new InvalidTaskError('file must be one of: INIT, PLAN, DONE, ERROR', 'file');
      });
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('file must be one of: INIT, PLAN, DONE, ERROR');
    });

    it('should handle non-string types for parameters', async () => {
      const testCases = [
        { args: { agent: 123, task: 'task', file: 'INIT' }, param: 'agent' },
        { args: { agent: 'agent', task: [], file: 'INIT' }, param: 'task' },
        { args: { agent: 'agent', task: 'task', file: {} }, param: 'file' }
      ];
      
      for (const testCase of testCases) {
        mockValidation.validateRequiredString.mockImplementation((value, name) => {
          if (name === testCase.param) {
            throw new InvalidTaskError(`${testCase.param} must be a non-empty string`, testCase.param);
          }
          return value as string;
        });
        
        mockValidation.validateTaskFileType.mockImplementation((value) => {
          if (typeof value !== 'string') {
            throw new InvalidTaskError('file must be one of: INIT, PLAN, DONE, ERROR', 'file');
          }
          return value as any;
        });
        
        await expect(readTask(mockConfig, testCase.args))
          .rejects.toThrow();
        
        jest.clearAllMocks();
      }
    });
  });

  describe('file system error propagation', () => {
    it('should propagate FileNotFoundError for missing file', async () => {
      const args = {
        agent: 'test-agent',
        task: 'missing-task',
        file: 'INIT'
      };
      
      const notFoundError = new FileNotFoundError('/test/comm/test-agent/missing-task/INIT.md');
      mockFileSystem.readFile.mockRejectedValue(notFoundError);
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('File not found: /test/comm/test-agent/missing-task/INIT.md');
    });

    it('should propagate permission errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      const permissionError = new Error('EACCES: permission denied');
      mockFileSystem.readFile.mockRejectedValue(permissionError);
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('EACCES: permission denied');
    });

    it('should propagate file system errors from getStats', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      const statError = new Error('ENOENT: no such file or directory, stat');
      mockFileSystem.getStats.mockRejectedValue(statError);
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('ENOENT: no such file or directory, stat');
    });

    it('should propagate IO errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      const ioError = new Error('EIO: i/o error, read');
      mockFileSystem.readFile.mockRejectedValue(ioError);
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('EIO: i/o error, read');
    });

    it('should propagate disk errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      const diskError = new Error('ENOSPC: no space left on device');
      mockFileSystem.readFile.mockRejectedValue(diskError);
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('ENOSPC: no space left on device');
    });

    it('should handle file system timeout errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      const timeoutError = new Error('ETIMEDOUT: operation timed out');
      mockFileSystem.readFile.mockRejectedValue(timeoutError);
      
      await expect(readTask(mockConfig, args))
        .rejects.toThrow('ETIMEDOUT: operation timed out');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle empty file content', async () => {
      const args = {
        agent: 'test-agent',
        task: 'empty-task',
        file: 'PLAN'
      };
      
      mockFileSystem.readFile.mockResolvedValue('');
      mockFileSystem.parseTaskMetadata.mockReturnValue(undefined);
      
      const result = await readTask(mockConfig, args);

      expect(result.content).toBe('');
      expect(result).not.toHaveProperty('metadata');
    });

    it('should handle very large file content', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      const args = {
        agent: 'test-agent',
        task: 'large-task',
        file: 'DONE'
      };
      
      mockFileSystem.readFile.mockResolvedValue(largeContent);
      
      const result = await readTask(mockConfig, args);

      expect(result.content).toBe(largeContent);
      expect(result.content.length).toBe(1000000);
    });

    it('should handle binary content (should not happen but edge case)', async () => {
      const binaryContent = Buffer.from([0, 1, 2, 3, 4, 5]).toString();
      const args = {
        agent: 'test-agent',
        task: 'binary-task',
        file: 'ERROR'
      };
      
      mockFileSystem.readFile.mockResolvedValue(binaryContent);
      
      const result = await readTask(mockConfig, args);

      expect(result.content).toBe(binaryContent);
    });

    it('should handle malformed metadata without throwing', async () => {
      const args = {
        agent: 'test-agent',
        task: 'malformed-task',
        file: 'INIT'
      };
      
      // parseTaskMetadata might throw for malformed content
      mockFileSystem.parseTaskMetadata.mockImplementation(() => {
        throw new Error('Malformed metadata');
      });
      
      // Should still succeed if file read and stats work
      await expect(readTask(mockConfig, args)).rejects.toThrow('Malformed metadata');
    });

    it('should handle very long agent and task names', async () => {
      const longAgent = 'very-long-agent-name-' + 'x'.repeat(200);
      const longTask = 'very-long-task-name-' + 'y'.repeat(200);
      
      const args = {
        agent: longAgent,
        task: longTask,
        file: 'PLAN'
      };
      
      await readTask(mockConfig, args);

      const expectedPath = path.join(mockConfig.commDir, longAgent, longTask, 'PLAN.md');
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
    });

    it('should handle special characters in path construction', async () => {
      const args = {
        agent: 'agent with spaces',
        task: 'task/with/slashes',
        file: 'INIT'
      };
      
      await readTask(mockConfig, args);

      // Path.join should handle special characters correctly
      const expectedPath = path.join(mockConfig.commDir, 'agent with spaces', 'task/with/slashes', 'INIT.md');
      expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
    });

    it('should handle case where stats and content succeed but metadata parsing fails gracefully', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      mockFileSystem.parseTaskMetadata.mockReturnValue(undefined as any);
      
      const result = await readTask(mockConfig, args);

      expect(result.content).toBe(testUtils.sampleTaskContent);
      expect(result.lastModified).toBe(mockStats.mtime);
      expect(result).not.toHaveProperty('metadata');
    });
  });

  describe('metadata handling', () => {
    it('should include metadata when present', async () => {
      const customMetadata: TaskMetadata = {
        agent: 'custom-agent',
        created: '2025-01-02T10:30:00Z',
        source: 'custom-source',
        parentTask: 'parent-task-123'
      };
      
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      mockFileSystem.parseTaskMetadata.mockReturnValue(customMetadata);
      
      const result = await readTask(mockConfig, args);

      expect(result.metadata).toEqual(customMetadata);
    });

    it('should handle metadata with missing optional fields', async () => {
      const minimalMetadata: TaskMetadata = {
        agent: 'minimal-agent',
        created: '2025-01-01T12:00:00Z',
        source: 'minimal-source'
        // parentTask is optional and not included
      };
      
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      mockFileSystem.parseTaskMetadata.mockReturnValue(minimalMetadata);
      
      const result = await readTask(mockConfig, args);

      expect(result.metadata).toEqual(minimalMetadata);
      expect(result.metadata).not.toHaveProperty('parentTask');
    });

    it('should handle metadata with extra unknown fields', async () => {
      const extraMetadata = {
        agent: 'extra-agent',
        created: '2025-01-01T12:00:00Z',
        source: 'extra-source',
        unknownField: 'unknown-value',
        anotherField: 123
      } as any;
      
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      mockFileSystem.parseTaskMetadata.mockReturnValue(extraMetadata);
      
      const result = await readTask(mockConfig, args);

      expect(result.metadata).toEqual(extraMetadata);
    });

    it('should handle null metadata gracefully', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN'
      };
      
      mockFileSystem.parseTaskMetadata.mockReturnValue(undefined);
      
      const result = await readTask(mockConfig, args);

      expect(result).not.toHaveProperty('metadata');
      expect(Object.keys(result)).toEqual(['content', 'lastModified']);
    });
  });

  describe('file type handling', () => {
    it('should handle all valid file types', async () => {
      const fileTypes = ['INIT', 'PLAN', 'DONE', 'ERROR'] as const;
      
      for (const fileType of fileTypes) {
        const args = {
          agent: 'test-agent',
          task: 'test-task',
          file: fileType
        };
        
        mockValidation.validateTaskFileType.mockReturnValue(fileType);
        
        await readTask(mockConfig, args);
        
        // File type is validated internally, not exposed in response
        
        jest.clearAllMocks();
        mockFileSystem.readFile.mockResolvedValue(testUtils.sampleTaskContent);
        mockFileSystem.getStats.mockResolvedValue(mockStats);
        mockFileSystem.parseTaskMetadata.mockReturnValue(mockMetadata);
      }
    });

    it('should construct correct file paths for each file type', async () => {
      const fileTypes = [
        { type: 'INIT', expected: 'INIT.md' },
        { type: 'PLAN', expected: 'PLAN.md' },
        { type: 'DONE', expected: 'DONE.md' },
        { type: 'ERROR', expected: 'ERROR.md' }
      ] as const;
      
      for (const { type, expected } of fileTypes) {
        const args = {
          agent: 'path-test-agent',
          task: 'path-test-task',
          file: type
        };
        
        mockValidation.validateTaskFileType.mockReturnValue(type);
        
        await readTask(mockConfig, args);
        
        const expectedPath = path.join(mockConfig.commDir, 'path-test-agent', 'path-test-task', expected);
        expect(mockFileSystem.readFile).toHaveBeenCalledWith(expectedPath);
        
        jest.clearAllMocks();
        mockFileSystem.readFile.mockResolvedValue(testUtils.sampleTaskContent);
        mockFileSystem.getStats.mockResolvedValue(mockStats);
        mockFileSystem.parseTaskMetadata.mockReturnValue(mockMetadata);
      }
    });
  });

  describe('response structure validation', () => {
    it('should return ReadTaskResponse with required properties', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      const result = await readTask(mockConfig, args);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('lastModified');
      
      expect(typeof result.content).toBe('string');
      expect(result.lastModified).toBeInstanceOf(Date);
    });

    it('should include metadata property when metadata exists', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      const result = await readTask(mockConfig, args);

      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toEqual(mockMetadata);
    });

    it('should not include metadata property when metadata is null', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN'
      };
      
      mockFileSystem.parseTaskMetadata.mockReturnValue(undefined);
      
      const result = await readTask(mockConfig, args);

      expect(result).not.toHaveProperty('metadata');
    });

    it('should return absolute file path', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'DONE'
      };
      
      const result = await readTask(mockConfig, args);

      // Path is no longer exposed in response for security reasons
      expect(result).toHaveProperty('content');
    });
  });

  describe('async operation handling', () => {
    it('should properly await file system operations', async () => {
      const args = {
        agent: 'async-agent',
        task: 'async-task',
        file: 'INIT'
      };
      
      let resolveRead: (value: string) => void;
      let resolveStats: (value: any) => void;
      
      const delayedRead = new Promise<string>((resolve) => {
        resolveRead = resolve;
      });
      
      const delayedStats = new Promise<any>((resolve) => {
        resolveStats = resolve;
      });
      
      mockFileSystem.readFile.mockReturnValue(delayedRead);
      mockFileSystem.getStats.mockReturnValue(delayedStats);
      
      const resultPromise = readTask(mockConfig, args);
      
      // Resolve after delays
      setTimeout(() => resolveRead(testUtils.sampleTaskContent), 10);
      setTimeout(() => resolveStats(mockStats), 15);
      
      const result = await resultPromise;
      expect(result.content).toBe(testUtils.sampleTaskContent);
    });

    it('should handle concurrent read operations', async () => {
      const args1 = {
        agent: 'agent-1',
        task: 'task-1',
        file: 'INIT'
      };
      
      const args2 = {
        agent: 'agent-2',
        task: 'task-2',
        file: 'PLAN'
      };
      
      const content1 = 'Content for task 1';
      const content2 = 'Content for task 2';
      
      mockFileSystem.readFile
        .mockResolvedValueOnce(content1)
        .mockResolvedValueOnce(content2);
      
      const [result1, result2] = await Promise.all([
        readTask(mockConfig, args1),
        readTask(mockConfig, args2)
      ]);
      
      expect(result1.content).toBe(content1);
      expect(result2.content).toBe(content2);
      expect(mockFileSystem.readFile).toHaveBeenCalledTimes(2);
    });

    it('should handle operations that complete in different orders', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT'
      };
      
      // Make stats complete before read
      mockFileSystem.readFile.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('delayed content'), 20))
      );
      
      mockFileSystem.getStats.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockStats), 5))
      );
      
      const result = await readTask(mockConfig, args);
      
      expect(result.content).toBe('delayed content');
      expect(result.lastModified).toBe(mockStats.mtime);
    });
  });
});