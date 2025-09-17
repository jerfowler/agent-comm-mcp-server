/**
 * Integration tests for create-task tool agent validation
 * Tests end-to-end security protection through the complete create_task workflow
 *
 * Following TDD methodology - these tests initially FAIL to demonstrate current vulnerability
 */

import { jest } from '@jest/globals';
import { createTask } from '../../../src/tools/create-task.js';
import { InvalidTaskError } from '../../../src/types.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';

// Mock all dependencies
jest.mock('../../../src/utils/fs-extra-safe.js');
const mockedFs = jest.mocked(fs);

describe('create-task Agent Validation Integration', () => {
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful file system operations
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFs.ensureDir.mockResolvedValue(undefined);
    mockedFs.readdir.mockResolvedValue([]);
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue('');

    // Mock configuration with required dependencies
    mockConfig = {
      commDir: '/test/comm',
      archiveDir: '/test/archive',
      logDir: '/test/logs',
      enableArchiving: false,
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
      } as any,
      errorLogger: {
        logError: jest.fn()
      } as any,
      taskContextManager: {
        injectProtocolInstructions: jest.fn().mockImplementation((content: unknown) =>
          typeof content === 'string' ? content : String(content)
        )
      } as any
    };
  });

  describe('Path Traversal Protection in create-task', () => {
    it('should reject path traversal attacks through create-task workflow', async () => {
      const maliciousAgent = '../../../etc/passwd';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name.*path traversal/i);
    });

    it('should reject Windows path traversal through create-task', async () => {
      const maliciousAgent = '..\\..\\windows\\system32';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name.*path traversal/i);
    });
  });

  describe('Command Injection Protection in create-task', () => {
    it('should reject command injection with semicolon through create-task', async () => {
      const maliciousAgent = 'agent; rm -rf /';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      // Note: Path traversal protection triggers first due to "/" character
      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name.*(path traversal|command injection)/i);
    });

    it('should reject command injection with pipe through create-task', async () => {
      const maliciousAgent = 'agent | cat /etc/passwd';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      // Note: Path traversal protection triggers first due to "/" character
      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name.*(path traversal|command injection)/i);
    });

    it('should reject command substitution attacks through create-task', async () => {
      const maliciousAgent = 'agent$(whoami)';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name.*command injection/i);
    });
  });

  describe('Script Injection Protection in create-task', () => {
    it('should reject JavaScript injection through create-task', async () => {
      const maliciousAgent = '<script>alert(1)</script>';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      // Multiple violations possible - any security rejection is valid
      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name/i);
    });

    it('should reject JavaScript URL injection through create-task', async () => {
      const maliciousAgent = 'javascript:alert(1)';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      // Colon triggers command injection protection
      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name/i);
    });
  });

  describe('Null Byte Protection in create-task', () => {
    it('should reject null byte injection through create-task', async () => {
      const maliciousAgent = 'agent\0malicious';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name.*null bytes/i);
    });

    it('should reject URL encoded null bytes through create-task', async () => {
      const maliciousAgent = 'agent%00malicious';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name.*null bytes/i);
    });
  });

  describe('SQL Injection Protection in create-task', () => {
    it('should reject SQL injection with DROP TABLE through create-task', async () => {
      const maliciousAgent = "agent'; DROP TABLE users; --";

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      // Single quotes and semicolons trigger command injection protection
      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name/i);
    });

    it('should reject SQL injection with UNION SELECT through create-task', async () => {
      const maliciousAgent = 'agent UNION SELECT * FROM users';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/invalid agent name.*sql injection/i);
    });
  });

  describe('Valid Agent Names in create-task', () => {
    it('should accept legitimate agent names through create-task workflow', async () => {
      const validAgents = [
        'senior-backend-engineer',
        'qa-test-automation-engineer',
        'product-docs-manager',
        'agent-v2',
        'debug_investigator'
      ];

      for (const agentName of validAgents) {
        const result = await createTask(mockConfig, {
          agent: agentName,
          taskName: 'test-task',
          content: 'test content'
        });

        expect(result.success).toBe(true);
        expect(result.targetAgent).toBe(agentName);
      }
    });

    it('should trim whitespace from agent names in create-task', async () => {
      const result = await createTask(mockConfig, {
        agent: '  senior-backend-engineer  ',
        taskName: 'test-task',
        content: 'test content',
      });

      expect(result.success).toBe(true);
      expect(result.targetAgent).toBe('senior-backend-engineer');
    });
  });

  describe('Error Logging Integration', () => {
    it('should log validation errors when malicious agent names are rejected', async () => {
      const maliciousAgent = '../../../etc/passwd';

      await expect(createTask(mockConfig, {
        agent: maliciousAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow();

      // Verify error was logged
      expect(mockConfig.errorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          operation: 'create_task',
          agent: maliciousAgent,
          error: expect.objectContaining({
            message: expect.stringContaining('Invalid agent name')
          }),
          severity: 'high'
        })
      );
    });

    it('should not log errors for valid agent names', async () => {
      await createTask(mockConfig, {
        agent: 'senior-backend-engineer',
        taskName: 'test-task',
        content: 'test content',
      });

      // Verify no validation errors were logged
      const errorCalls = mockConfig.errorLogger.logError.mock.calls;
      const validationErrors = errorCalls.filter((call: any) =>
        call[0]?.source === 'validation'
      );
      expect(validationErrors).toHaveLength(0);
    });
  });

  describe('Performance Requirements in create-task Workflow', () => {
    it('should complete agent validation within performance requirements', async () => {
      const startTime = Date.now();

      await createTask(mockConfig, {
        agent: 'senior-backend-engineer',
        taskName: 'test-task',
        content: 'test content',
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Agent validation should be a negligible part of total time
      // The whole operation should complete reasonably quickly
      expect(duration).toBeLessThan(1000); // 1 second for the entire operation
    });

    it('should handle rapid successive validations efficiently', async () => {
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(createTask(mockConfig, {
          agent: `agent-${i}`,
          taskName: `test-task-${i}`,
          content: 'test content'
        }));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / 10;

      expect(avgTime).toBeLessThan(100); // Average should be under 100ms per task
    });
  });

  describe('Edge Cases in create-task Integration', () => {
    it('should reject empty agent names', async () => {
      await expect(createTask(mockConfig, {
        agent: '',
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: '',
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/must be a non-empty string/i);
    });

    it('should reject whitespace-only agent names', async () => {
      await expect(createTask(mockConfig, {
        agent: '   ',
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: '   ',
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/must be a non-empty string/i);
    });

    it('should reject non-string agent names', async () => {
      await expect(createTask(mockConfig, {
        agent: 123 as any,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: null as any,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: undefined as any,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);
    });

    it('should reject excessively long agent names', async () => {
      const longAgent = 'a'.repeat(150); // 150 characters

      await expect(createTask(mockConfig, {
        agent: longAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(InvalidTaskError);

      await expect(createTask(mockConfig, {
        agent: longAgent,
        taskName: 'test-task',
        content: 'test content',
      })).rejects.toThrow(/exceeds maximum length/i);
    });
  });

  describe('Backward Compatibility Verification', () => {
    it('should maintain all existing create-task functionality', async () => {
      const result = await createTask(mockConfig, {
        agent: 'senior-backend-engineer',
        taskName: 'test-task',
        content: 'test content',
      });

      // Verify all expected response fields are present
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('targetAgent', 'senior-backend-engineer');
      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('message');

      // Verify file operations were called
      expect(mockedFs.ensureDir).toHaveBeenCalled();
      expect(mockedFs.writeFile).toHaveBeenCalled();

      // Note: Logging operations may not be triggered in test environment
    });

    it('should work with different task configurations', async () => {
      // Test basic task creation
      const result = await createTask(mockConfig, {
        agent: 'senior-backend-engineer',
        taskName: 'test-task',
        content: 'test content'
      });

      expect(result.success).toBe(true);

      // Test with parent task
      const resultWithParent = await createTask(mockConfig, {
        agent: 'senior-backend-engineer',
        taskName: 'sub-task',
        content: 'test content',
        parentTask: 'parent-task-id'
      });

      expect(resultWithParent.success).toBe(true);
    });
  });
});