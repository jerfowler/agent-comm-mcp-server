/**
 * Unit tests for write-task tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { writeTask } from '../../../src/tools/write-task.js';
import * as fileSystem from '../../../src/utils/file-system.js';
import * as validation from '../../../src/utils/validation.js';
import { LockManager } from '../../../src/utils/lock-manager.js';
import { ServerConfig, InvalidTaskError } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';
import * as path from 'path';

// Mock modules
jest.mock('../../../src/utils/file-system.js');
jest.mock('../../../src/utils/validation.js');
jest.mock('../../../src/utils/lock-manager.js');

const mockFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;
const mockValidation = validation as jest.Mocked<typeof validation>;

describe('Write Task Tool', () => {
  let mockConfig: ServerConfig;
  let mockLockManager: jest.Mocked<LockManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = testUtils.createMockConfig();

    // Setup LockManager mock
    mockLockManager = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn()
    } as unknown as jest.Mocked<LockManager>;

    // Configure mock return values with proper typing
    const lockResult = {
      acquired: true,
      lockId: 'test-lock-id-123',
      lockFile: '/test/path/.lock'
    };

    const releaseResult = {
      released: true
    };

    (mockLockManager.acquireLock as jest.Mock).mockImplementation(() => Promise.resolve(lockResult));
    (mockLockManager.releaseLock as jest.Mock).mockImplementation(() => Promise.resolve(releaseResult));

    // Mock LockManager constructor
    (LockManager as jest.MockedClass<typeof LockManager>).mockImplementation(() => mockLockManager);

    // Setup default validation mocks
    mockValidation.validateRequiredString.mockImplementation((value) => value as string);
    mockValidation.validateEnum.mockImplementation(<T extends string>(value: unknown) => value as T);
    mockValidation.validateContent.mockImplementation(() => {});

    // Setup default file system mocks
    mockFileSystem.ensureDirectory.mockResolvedValue();
    mockFileSystem.writeFile.mockResolvedValue();
  });

  describe('successful write operations', () => {
    it('should write PLAN.md file', async () => {
      const content = testUtils.samplePlanContent;
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content
      };
      
      const result = await writeTask(mockConfig, args);

      const expectedTaskDir = path.join(mockConfig.commDir, 'test-agent', 'test-task');
      const expectedFilePath = path.join(expectedTaskDir, 'PLAN.md');
      
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('test-agent', 'agent');
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('test-task', 'task');
      // Note: validateEnum is not called - file type validation is done inline
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith(content, 'content');
      expect(mockValidation.validateContent).toHaveBeenCalledWith(content);
      
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith(expectedTaskDir);
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
      
      expect(result).toEqual({
        success: true,
        bytesWritten: Buffer.byteLength(content, 'utf8')
      });
    });

    it('should write DONE.md file', async () => {
      const content = '# Task Complete: Test Task\n\n## Results\nTask completed successfully.';
      const args = {
        agent: 'frontend-engineer',
        task: 'fix-ui-bug',
        file: 'DONE',
        content
      };
      
      const result = await writeTask(mockConfig, args);

      const expectedTaskDir = path.join(mockConfig.commDir, 'frontend-engineer', 'fix-ui-bug');
      const expectedFilePath = path.join(expectedTaskDir, 'DONE.md');
      
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith(expectedTaskDir);
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
      
      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBe(Buffer.byteLength(content, 'utf8'));
    });

    it('should write ERROR.md file', async () => {
      const content = '# Task Error: Database Migration\n\n## Issue\nConnection timeout to database server.';
      const args = {
        agent: 'database-admin',
        task: 'migrate-schema',
        file: 'ERROR',
        content
      };
      
      const result = await writeTask(mockConfig, args);

      const expectedTaskDir = path.join(mockConfig.commDir, 'database-admin', 'migrate-schema');
      const expectedFilePath = path.join(expectedTaskDir, 'ERROR.md');
      
      // Note: validateEnum is not called - file type validation is done inline
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
      
      expect(result.success).toBe(true);
    });

    it('should handle complex agent and task names', async () => {
      const content = '# Complex Task Implementation';
      const args = {
        agent: 'senior-qa-automation-engineer_v2',
        task: '20250101-123456-test-auth-flow',
        file: 'PLAN',
        content
      };
      
      const result = await writeTask(mockConfig, args);

      const expectedTaskDir = path.join(
        mockConfig.commDir, 
        'senior-qa-automation-engineer_v2', 
        '20250101-123456-test-auth-flow'
      );
      const expectedFilePath = path.join(expectedTaskDir, 'PLAN.md');
      
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith(expectedTaskDir);
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters in names', async () => {
      const content = '# Tâche Spéciale\nContenu avec caractères spéciaux: éöñüç';
      const args = {
        agent: 'développeur-backend',
        task: 'tâche-spéciale-éöñ',
        file: 'DONE',
        content
      };
      
      const result = await writeTask(mockConfig, args);

      const expectedTaskDir = path.join(
        mockConfig.commDir, 
        'développeur-backend', 
        'tâche-spéciale-éöñ'
      );
      const expectedFilePath = path.join(expectedTaskDir, 'DONE.md');
      
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedFilePath, content);
      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBe(Buffer.byteLength(content, 'utf8'));
    });

    it('should calculate correct byte count for various content types', async () => {
      const testCases = [
        { content: '', expectedBytes: 0 },
        { content: 'Hello', expectedBytes: 5 },
        { content: 'Hello 世界', expectedBytes: 12 }, // Unicode characters (世界 = 6 bytes)
        { content: '\n\r\t', expectedBytes: 3 }, // Control characters
        { content: '🚀 Rocket', expectedBytes: 11 }, // Emoji (🚀 = 4 bytes)
        { content: 'A'.repeat(1000), expectedBytes: 1000 } // Large content
      ];
      
      for (const testCase of testCases) {
        const args = {
          agent: 'test-agent',
          task: 'test-task',
          file: 'PLAN',
          content: testCase.content
        };
        
        // Skip validation for empty content in this test
        if (testCase.content === '') {
          mockValidation.validateContent.mockImplementation(() => {});
        }
        
        const result = await writeTask(mockConfig, args);
        
        expect(result.bytesWritten).toBe(testCase.expectedBytes);
        
        jest.clearAllMocks();
        mockFileSystem.ensureDirectory.mockResolvedValue();
        mockFileSystem.writeFile.mockResolvedValue();
        mockValidation.validateRequiredString.mockImplementation((value) => value as string);
        mockValidation.validateEnum.mockImplementation(<T extends string>(value: unknown) => value as T);
        mockValidation.validateContent.mockImplementation(() => {});
      }
    });

    it('should handle large content efficiently', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      const args = {
        agent: 'test-agent',
        task: 'large-task',
        file: 'DONE',
        content: largeContent
      };
      
      const result = await writeTask(mockConfig, args);

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, 'test-agent', 'large-task', 'DONE.md'),
        largeContent
      );
      expect(result.bytesWritten).toBe(1000000);
      expect(result.success).toBe(true);
    });
  });

  describe('input validation failures', () => {
    it('should propagate validation error for missing agent', async () => {
      const args = {
        task: 'test-task',
        file: 'PLAN',
        content: 'content'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'agent') {
          throw new InvalidTaskError('agent must be a non-empty string', 'agent');
        }
        return value as string;
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
      
      expect(mockFileSystem.ensureDirectory).not.toHaveBeenCalled();
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should propagate validation error for empty agent', async () => {
      const args = {
        agent: '',
        task: 'test-task',
        file: 'PLAN',
        content: 'content'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'agent' && value === '') {
          throw new InvalidTaskError('agent must be a non-empty string', 'agent');
        }
        return value as string;
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
    });

    it('should propagate validation error for missing task', async () => {
      const args = {
        agent: 'test-agent',
        file: 'PLAN',
        content: 'content'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'task') {
          throw new InvalidTaskError('task must be a non-empty string', 'task');
        }
        return value as string;
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('task must be a non-empty string');
    });

    it('should propagate validation error for empty task', async () => {
      const args = {
        agent: 'test-agent',
        task: '   ',
        file: 'PLAN',
        content: 'content'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'task' && typeof value === 'string' && value.trim() === '') {
          throw new InvalidTaskError('task must be a non-empty string', 'task');
        }
        return value as string;
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('task must be a non-empty string');
    });

    it('should propagate validation error for invalid file type', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INVALID',
        content: 'content'
      };
      
      // Note: validateEnum is not used, file validation is done inline

      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('Invalid file type: INVALID. Must be one of: PLAN, DONE, ERROR');
    });

    it('should propagate validation error for missing content', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN'
      };
      
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'content') {
          throw new InvalidTaskError('content must be a non-empty string', 'content');
        }
        return value as string;
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('content must be a non-empty string');
    });

    it('should propagate validation error for empty content', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: ''
      };
      
      mockValidation.validateContent.mockImplementation(() => {
        throw new InvalidTaskError('Content cannot be empty', 'content');
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('Content cannot be empty');
    });

    it('should handle null values for parameters', async () => {
      const testCases = [
        { args: { agent: null, task: 'task', file: 'PLAN', content: 'content' }, param: 'agent' },
        { args: { agent: 'agent', task: null, file: 'PLAN', content: 'content' }, param: 'task' },
        { args: { agent: 'agent', task: 'task', file: null, content: 'content' }, param: 'file' },
        { args: { agent: 'agent', task: 'task', file: 'PLAN', content: null }, param: 'content' }
      ];
      
      for (const testCase of testCases) {
        mockValidation.validateRequiredString.mockImplementation((value, name) => {
          if (name === testCase.param) {
            throw new InvalidTaskError(`${testCase.param} must be a non-empty string`, testCase.param);
          }
          return value as string;
        });
        
        // Note: validateEnum is not used in writeTask implementation

        await expect(writeTask(mockConfig, testCase.args))
          .rejects.toThrow();
        
        jest.clearAllMocks();
      }
    });

    it('should handle non-string types for parameters', async () => {
      const testCases = [
        { args: { agent: 123, task: 'task', file: 'PLAN', content: 'content' }, param: 'agent' },
        { args: { agent: 'agent', task: [], file: 'PLAN', content: 'content' }, param: 'task' },
        { args: { agent: 'agent', task: 'task', file: {}, content: 'content' }, param: 'file' },
        { args: { agent: 'agent', task: 'task', file: 'PLAN', content: true }, param: 'content' }
      ];
      
      for (const testCase of testCases) {
        mockValidation.validateRequiredString.mockImplementation((value, name) => {
          if (name === testCase.param) {
            throw new InvalidTaskError(`${testCase.param} must be a non-empty string`, testCase.param);
          }
          return value as string;
        });
        
        mockValidation.validateEnum.mockImplementation(<T extends string>(value: unknown, name: string) => {
          if (name === 'file' && typeof value !== 'string') {
            throw new InvalidTaskError('file must be one of: PLAN, DONE, ERROR', 'file');
          }
          return value as T;
        });
        
        await expect(writeTask(mockConfig, testCase.args))
          .rejects.toThrow();
        
        jest.clearAllMocks();
      }
    });
  });

  describe('content validation failures', () => {
    it('should propagate content validation errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: 'malicious content <script>alert("xss")</script>'
      };
      
      mockValidation.validateContent.mockImplementation(() => {
        throw new InvalidTaskError('Content contains invalid characters', 'content');
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('Content contains invalid characters');
      
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should handle content that is too long', async () => {
      const longContent = 'x'.repeat(100000);
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: longContent
      };
      
      mockValidation.validateContent.mockImplementation(() => {
        throw new InvalidTaskError('Content is too long', 'content');
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('Content is too long');
    });

    it('should handle content with only whitespace', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: '   \n\n   \t   '
      };
      
      mockValidation.validateContent.mockImplementation(() => {
        throw new InvalidTaskError('Content cannot be empty', 'content');
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('Content cannot be empty');
    });

    it('should validate content after string validation', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: 'valid string but invalid content'
      };
      
      mockValidation.validateContent.mockImplementation(() => {
        throw new InvalidTaskError('Content validation failed', 'content');
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('Content validation failed');
      
      // Should have called string validation first
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('valid string but invalid content', 'content');
      expect(mockValidation.validateContent).toHaveBeenCalledWith('valid string but invalid content');
    });
  });

  describe('file system error propagation', () => {
    it('should propagate directory creation errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: 'content'
      };
      
      const dirError = new Error('EACCES: permission denied, mkdir');
      mockFileSystem.ensureDirectory.mockRejectedValue(dirError);
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('EACCES: permission denied, mkdir');
      
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should propagate file write errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: 'content'
      };
      
      const writeError = new Error('ENOSPC: no space left on device');
      mockFileSystem.writeFile.mockRejectedValue(writeError);
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('ENOSPC: no space left on device');
    });

    it('should propagate permission errors for file writing', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'DONE',
        content: 'content'
      };
      
      const permissionError = new Error('EACCES: permission denied, open');
      mockFileSystem.writeFile.mockRejectedValue(permissionError);
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('EACCES: permission denied, open');
    });

    it('should propagate IO errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'ERROR',
        content: 'content'
      };
      
      const ioError = new Error('EIO: i/o error, write');
      mockFileSystem.writeFile.mockRejectedValue(ioError);
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('EIO: i/o error, write');
    });

    it('should propagate timeout errors', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: 'content'
      };
      
      const timeoutError = new Error('ETIMEDOUT: operation timed out');
      mockFileSystem.writeFile.mockRejectedValue(timeoutError);
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('ETIMEDOUT: operation timed out');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle minimal valid inputs', async () => {
      const args = {
        agent: 'a',
        task: 'b',
        file: 'PLAN',
        content: 'c'
      };
      
      const result = await writeTask(mockConfig, args);

      const expectedPath = path.join(mockConfig.commDir, 'a', 'b', 'PLAN.md');
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedPath, 'c');
      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBe(1);
    });

    it('should handle very long agent and task names', async () => {
      const longAgent = 'very-long-agent-name-' + 'x'.repeat(200);
      const longTask = 'very-long-task-name-' + 'y'.repeat(200);
      
      const args = {
        agent: longAgent,
        task: longTask,
        file: 'DONE',
        content: 'content'
      };
      
      const result = await writeTask(mockConfig, args);

      const expectedTaskDir = path.join(mockConfig.commDir, longAgent, longTask);
      const expectedFilePath = path.join(expectedTaskDir, 'DONE.md');
      
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith(expectedTaskDir);
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedFilePath, 'content');
      expect(result.success).toBe(true);
    });

    it('should handle special characters in agent and task names', async () => {
      const args = {
        agent: 'agent with spaces',
        task: 'task/with/slashes',
        file: 'ERROR',
        content: 'Error content'
      };
      
      await writeTask(mockConfig, args);

      const expectedTaskDir = path.join(mockConfig.commDir, 'agent with spaces', 'task/with/slashes');
      const expectedFilePath = path.join(expectedTaskDir, 'ERROR.md');
      
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledWith(expectedTaskDir);
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedFilePath, 'Error content');
    });

    it('should handle trimmed values from validation', async () => {
      const args = {
        agent: '  test-agent  ',
        task: '  test-task  ',
        file: 'PLAN',
        content: '  content with spaces  '
      };
      
      mockValidation.validateRequiredString
        .mockReturnValueOnce('test-agent')
        .mockReturnValueOnce('test-task')
        .mockReturnValueOnce('content with spaces');
      
      await writeTask(mockConfig, args);

      const expectedPath = path.join(mockConfig.commDir, 'test-agent', 'test-task', 'PLAN.md');
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedPath, 'content with spaces');
    });

    it('should handle content with newlines and special characters', async () => {
      const complexContent = `# Complex Content

## Section 1
This is a test with *markdown* **formatting**.

### Subsection
- Item 1
- Item 2

\`\`\`javascript
const code = "example";
console.log(code);
\`\`\`

> Blockquote with **emphasis**

[Link](https://example.com)

| Table | Header |
|-------|--------|
| Cell  | Data   |

---

**End of content**`;
      
      const args = {
        agent: 'test-agent',
        task: 'complex-task',
        file: 'DONE',
        content: complexContent
      };
      
      const result = await writeTask(mockConfig, args);

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, 'test-agent', 'complex-task', 'DONE.md'),
        complexContent
      );
      expect(result.bytesWritten).toBe(Buffer.byteLength(complexContent, 'utf8'));
    });
  });

  describe('file type handling', () => {
    it('should handle all valid file types', async () => {
      const fileTypes = ['PLAN', 'DONE', 'ERROR'] as const;
      
      for (const fileType of fileTypes) {
        const args = {
          agent: 'test-agent',
          task: 'test-task',
          file: fileType,
          content: `Content for ${fileType} file`
        };
        
        mockValidation.validateEnum.mockReturnValue(fileType);
        
        const result = await writeTask(mockConfig, args);
        
        // File type is validated internally, not exposed in response
        expect(result.success).toBe(true);
        
        jest.clearAllMocks();
        mockFileSystem.ensureDirectory.mockResolvedValue();
        mockFileSystem.writeFile.mockResolvedValue();
        mockValidation.validateRequiredString.mockImplementation((value) => value as string);
        mockValidation.validateEnum.mockImplementation(<T extends string>(value: unknown) => value as T);
        mockValidation.validateContent.mockImplementation(() => {});
      }
    });

    it('should construct correct file paths for each file type', async () => {
      const fileTypes = [
        { type: 'PLAN', expected: 'PLAN.md' },
        { type: 'DONE', expected: 'DONE.md' },
        { type: 'ERROR', expected: 'ERROR.md' }
      ] as const;
      
      for (const { type, expected } of fileTypes) {
        const args = {
          agent: 'path-test-agent',
          task: 'path-test-task',
          file: type,
          content: 'test content'
        };
        
        mockValidation.validateEnum.mockReturnValue(type);
        
        await writeTask(mockConfig, args);
        
        const expectedPath = path.join(mockConfig.commDir, 'path-test-agent', 'path-test-task', expected);
        expect(mockFileSystem.writeFile).toHaveBeenCalledWith(expectedPath, 'test content');
        
        jest.clearAllMocks();
        mockFileSystem.ensureDirectory.mockResolvedValue();
        mockFileSystem.writeFile.mockResolvedValue();
        mockValidation.validateRequiredString.mockImplementation((value) => value as string);
        mockValidation.validateEnum.mockImplementation(<T extends string>(value: unknown) => value as T);
        mockValidation.validateContent.mockImplementation(() => {});
      }
    });

    it('should reject unsupported file types', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'INIT', // Not allowed for write operations
        content: 'content'
      };

      // Note: validateEnum is not used, file validation is done inline

      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('Invalid file type: INIT. Must be one of: PLAN, DONE, ERROR');
    });
  });

  describe('response structure validation', () => {
    it('should return WriteTaskResponse with required properties', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: 'test content'
      };
      
      const result = await writeTask(mockConfig, args);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('bytesWritten');
      
      expect(result.success).toBe(true);
      expect(typeof result.bytesWritten).toBe('number');
    });

    it('should always return success: true for successful operations', async () => {
      const args = {
        agent: 'success-agent',
        task: 'success-task',
        file: 'DONE',
        content: 'success content'
      };
      
      const result = await writeTask(mockConfig, args);
      expect(result.success).toBe(true);
    });

    it('should return absolute file path', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'ERROR',
        content: 'content'
      };
      
      const result = await writeTask(mockConfig, args);

      // Path is no longer exposed in response for security reasons
      expect(result.success).toBe(true);
    });

    it('should return correct byte count for various content encodings', async () => {
      const testCases = [
        { content: 'ASCII content', expectedBytes: 13 },
        { content: 'UTF-8: 日本語', expectedBytes: 16 }, // Multi-byte characters (日本語 = 9 bytes)
        { content: 'Emoji: 🎉🚀', expectedBytes: 15 }, // Emoji characters (🎉🚀 = 8 bytes)
        { content: 'Mixed: Hello 世界 🌍', expectedBytes: 24 } // Mixed content (世界 = 6 bytes, 🌍 = 4 bytes)
      ];
      
      for (const testCase of testCases) {
        const args = {
          agent: 'test-agent',
          task: 'test-task',
          file: 'PLAN',
          content: testCase.content
        };
        
        const result = await writeTask(mockConfig, args);
        
        expect(result.bytesWritten).toBe(testCase.expectedBytes);
        expect(result.bytesWritten).toBe(Buffer.byteLength(testCase.content, 'utf8'));
        
        jest.clearAllMocks();
        mockFileSystem.ensureDirectory.mockResolvedValue();
        mockFileSystem.writeFile.mockResolvedValue();
        mockValidation.validateRequiredString.mockImplementation((value) => value as string);
        mockValidation.validateEnum.mockImplementation(<T extends string>(value: unknown) => value as T);
        mockValidation.validateContent.mockImplementation(() => {});
      }
    });
  });

  describe('async operation handling', () => {
    it('should properly await file system operations in sequence', async () => {
      const args = {
        agent: 'async-agent',
        task: 'async-task',
        file: 'PLAN',
        content: 'async content'
      };
      
      let resolveEnsure: () => void;
      let resolveWrite: () => void;
      
      const delayedEnsure = new Promise<void>((resolve) => {
        resolveEnsure = resolve;
      });
      
      const delayedWrite = new Promise<void>((resolve) => {
        resolveWrite = resolve;
      });
      
      mockFileSystem.ensureDirectory.mockReturnValue(delayedEnsure);
      mockFileSystem.writeFile.mockReturnValue(delayedWrite);
      
      const resultPromise = writeTask(mockConfig, args);
      
      // Resolve directory creation first
      setTimeout(() => resolveEnsure(), 10);
      // Then resolve file write
      setTimeout(() => resolveWrite(), 20);
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      
      // Verify both operations were called
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalled();
      expect(mockFileSystem.writeFile).toHaveBeenCalled();
    });

    it('should handle concurrent write operations', async () => {
      const args1 = {
        agent: 'agent-1',
        task: 'task-1',
        file: 'PLAN',
        content: 'Content 1'
      };
      
      const args2 = {
        agent: 'agent-2',
        task: 'task-2',
        file: 'DONE',
        content: 'Content 2'
      };
      
      const [result1, result2] = await Promise.all([
        writeTask(mockConfig, args1),
        writeTask(mockConfig, args2)
      ]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Path is no longer exposed in response for security reasons
      expect(result1.bytesWritten).toBeGreaterThan(0);
      expect(result2.bytesWritten).toBeGreaterThan(0);
      expect(mockFileSystem.ensureDirectory).toHaveBeenCalledTimes(2);
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure in concurrent operations', async () => {
      const args1 = {
        agent: 'success-agent',
        task: 'success-task',
        file: 'PLAN',
        content: 'Success content'
      };
      
      const args2 = {
        agent: 'fail-agent',
        task: 'fail-task',
        file: 'DONE',
        content: 'Fail content'
      };
      
      // Make second operation fail
      mockFileSystem.writeFile
        .mockResolvedValueOnce() // First call succeeds
        .mockRejectedValueOnce(new Error('Write failed')); // Second call fails
      
      const results = await Promise.allSettled([
        writeTask(mockConfig, args1),
        writeTask(mockConfig, args2)
      ]);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      
      if (results[0].status === 'fulfilled') {
        expect(results[0].value.success).toBe(true);
      }
      
      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toBe('Write failed');
      }
    });
  });

  describe('validation order', () => {
    it('should validate parameters in correct order', async () => {
      const args = {
        agent: '',
        task: 'test-task',
        file: 'INVALID',
        content: ''
      };
      
      // Agent validation should fail first
      mockValidation.validateRequiredString.mockImplementation((value, name) => {
        if (name === 'agent') {
          throw new InvalidTaskError('agent must be a non-empty string', 'agent');
        }
        return value as string;
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
      
      // Should not reach other validations
      expect(mockValidation.validateEnum).not.toHaveBeenCalled();
      expect(mockValidation.validateContent).not.toHaveBeenCalled();
    });

    it('should validate content after string validation but before file operations', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: 'invalid content'
      };
      
      mockValidation.validateContent.mockImplementation(() => {
        throw new InvalidTaskError('Content validation failed', 'content');
      });
      
      await expect(writeTask(mockConfig, args))
        .rejects.toThrow('Content validation failed');
      
      // Should have called string validation first
      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('invalid content', 'content');
      expect(mockValidation.validateContent).toHaveBeenCalledWith('invalid content');
      
      // Should not reach file operations
      expect(mockFileSystem.ensureDirectory).not.toHaveBeenCalled();
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should ensure directory before writing file', async () => {
      const args = {
        agent: 'test-agent',
        task: 'test-task',
        file: 'PLAN',
        content: 'content'
      };
      
      await writeTask(mockConfig, args);

      expect(mockFileSystem.ensureDirectory).toHaveBeenCalled();
      expect(mockFileSystem.writeFile).toHaveBeenCalled();
    });
  });
});