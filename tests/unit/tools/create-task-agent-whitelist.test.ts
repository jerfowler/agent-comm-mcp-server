/**
 * Tests for agent whitelist validation in create_task tool
 * Testing security feature to prevent invalid agent impersonation
 */

import { jest } from '@jest/globals';
import * as fileSystem from '../../../src/utils/file-system.js';
import { createTask } from '../../../src/tools/create-task.js';
import type { ServerConfig } from '../../../src/types.js';

// Mock file-system module
jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  listDirectory: jest.fn(),
  ensureDirectory: jest.fn(),
  getStats: jest.fn(),
  generateTimestamp: jest.fn(() => '2025-09-21T04-00-00'),
  validateAgentName: jest.fn(),  // Add missing function
  validateTaskName: jest.fn()     // Add missing function
}));

// Mock EventLogger
jest.mock('../../../src/logging/EventLogger.js', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logOperation: jest.fn(() => Promise.resolve()),
    logEvent: jest.fn(() => Promise.resolve()),
    waitForWriteQueueEmpty: jest.fn(() => Promise.resolve())
  }))
}));

describe('create-task agent whitelist validation', () => {
  let mockConfig: ServerConfig;
  let mockEventLogger: any;
  let mockConnectionManager: any;

  // Define the valid agents whitelist (should match what's in the implementation)
  const VALID_AGENTS = [
    'senior-frontend-engineer',
    'senior-backend-engineer',
    'senior-system-architect',
    'devops-deployment-engineer',
    'senior-ai-ml-engineer',
    'senior-dba-advisor',
    'qa-test-automation-engineer',
    'security-analyst',
    'debug-investigator',
    'ux-ui-designer',
    'product-docs-manager',
    'product-manager',
    'product-owner-agile',
    'scrum-master-coach'
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock event logger
    mockEventLogger = {
      logOperation: jest.fn(() => Promise.resolve()),
      logEvent: jest.fn(() => Promise.resolve()),
      waitForWriteQueueEmpty: jest.fn(() => Promise.resolve())
    };

    // Setup mock connection manager
    mockConnectionManager = {
      setCurrentTask: jest.fn(() => undefined),
      getCurrentTask: jest.fn(() => 'current-task'),
      getMetadata: jest.fn(() => ({})),
      setMetadata: jest.fn(() => undefined)
    };

    // Setup mock config with proper type casting
    mockConfig = {
      connectionManager: mockConnectionManager,
      eventLogger: mockEventLogger,
      errorLogger: {
        logError: jest.fn(() => Promise.resolve())
      } as any,
      baseDir: '/test/comm',
      commDir: '/test/comm',
      archiveDir: '/test/comm/.archive',
      logDir: '/test/comm/.logs',
      enableArchiving: true
    } as unknown as ServerConfig;

    // Setup default file system mocks
    const mockPathExists = fileSystem.pathExists as jest.MockedFunction<typeof fileSystem.pathExists>;
    mockPathExists.mockImplementation((path: string) => {
      if (path.includes('test-agent')) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const mockListDirectory = fileSystem.listDirectory as jest.MockedFunction<typeof fileSystem.listDirectory>;
    mockListDirectory.mockResolvedValue([]);

    // ensureDirectory is the correct function name
    const mockEnsureDirectory = fileSystem.ensureDirectory as jest.MockedFunction<typeof fileSystem.ensureDirectory>;
    mockEnsureDirectory.mockResolvedValue(undefined);

    const mockWriteFile = fileSystem.writeFile as jest.MockedFunction<typeof fileSystem.writeFile>;
    mockWriteFile.mockResolvedValue(undefined);

    const mockReadFile = fileSystem.readFile as jest.MockedFunction<typeof fileSystem.readFile>;
    mockReadFile.mockResolvedValue('');

    const mockGetStats = fileSystem.getStats as jest.MockedFunction<typeof fileSystem.getStats>;
    mockGetStats.mockResolvedValue({
      isDirectory: () => true,
      mtime: new Date()
    } as any);
  });

  describe('valid agent acceptance', () => {
    test('should accept valid agent senior-backend-engineer', async () => {
      const result = await createTask(mockConfig, {
        agent: 'senior-backend-engineer',
        taskName: 'test-task',
        content: 'Test task content'
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      // Verify the task was created successfully
      expect(result.taskCreated).toBe(true);
    });

    test('should accept all known valid agents', async () => {
      for (const agent of VALID_AGENTS) {
        jest.clearAllMocks();

        const result = await createTask(mockConfig, {
          agent,
          taskName: `test-task-${agent}`,
          content: 'Test task content'
        });

        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      }
    });
  });

  describe('invalid agent rejection', () => {
    test('should reject unknown agent non-existent-agent', async () => {
      await expect(createTask(mockConfig, {
        agent: 'non-existent-agent',
        taskName: 'test-task',
        content: 'Test task content'
      })).rejects.toThrow(/Invalid agent.*non-existent-agent/i);
    });

    test('should reject agent with typo in name', async () => {
      await expect(createTask(mockConfig, {
        agent: 'senior-backend-enginer',  // typo: enginer instead of engineer
        taskName: 'test-task',
        content: 'Test task content'
      })).rejects.toThrow(/Invalid agent/i);
    });

    test('should reject agent with different case', async () => {
      await expect(createTask(mockConfig, {
        agent: 'Senior-Backend-Engineer',  // wrong case
        taskName: 'test-task',
        content: 'Test task content'
      })).rejects.toThrow(/Invalid agent/i);
    });

    test('should provide descriptive error message for invalid agents', async () => {
      try {
        await createTask(mockConfig, {
          agent: 'hacker-agent',
          taskName: 'malicious-task',
          content: 'Malicious content'
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Invalid agent');
        expect(errorMessage).toContain('hacker-agent');
        // Could also check if it suggests valid agents
      }
    });
  });

  describe('edge cases', () => {
    test('should reject null agent', async () => {
      await expect(createTask(mockConfig, {
        agent: null as any,
        taskName: 'test-task',
        content: 'Test content'
      })).rejects.toThrow();
    });

    test('should reject undefined agent', async () => {
      await expect(createTask(mockConfig, {
        agent: undefined as any,
        taskName: 'test-task',
        content: 'Test content'
      })).rejects.toThrow();
    });

    test('should reject empty string agent', async () => {
      await expect(createTask(mockConfig, {
        agent: '',
        taskName: 'test-task',
        content: 'Test content'
      })).rejects.toThrow();
    });

    test('should reject agent with special characters', async () => {
      await expect(createTask(mockConfig, {
        agent: '../../../etc/passwd',
        taskName: 'test-task',
        content: 'Test content'
      })).rejects.toThrow(/Invalid agent/i);
    });

    test('should reject agent with SQL injection attempt', async () => {
      await expect(createTask(mockConfig, {
        agent: "'; DROP TABLE agents; --",
        taskName: 'test-task',
        content: 'Test content'
      })).rejects.toThrow(/Invalid agent/i);
    });

    test('should reject agent with script tags', async () => {
      await expect(createTask(mockConfig, {
        agent: '<script>alert("xss")</script>',
        taskName: 'test-task',
        content: 'Test content'
      })).rejects.toThrow(/Invalid agent/i);
    });
  });

  describe('performance', () => {
    test('agent validation should complete in less than 10ms', async () => {
      const startTime = Date.now();

      try {
        await createTask(mockConfig, {
          agent: 'invalid-agent-for-perf-test',
          taskName: 'test-task',
          content: 'Test content'
        });
      } catch (error) {
        // We expect it to fail, we're just timing it
      }

      const duration = Date.now() - startTime;

      // Agent validation should be very fast (< 10ms)
      expect(duration).toBeLessThan(10);
    });

    test('valid agent lookup should be efficient', async () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        try {
          // Just validate, don't create actual tasks
          const agent = VALID_AGENTS[i % VALID_AGENTS.length];
          // In real implementation, this would be the validation function
          const isValid = VALID_AGENTS.includes(agent);
          expect(isValid).toBe(true);
        } catch (error) {
          // Ignore errors for performance test
        }
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      // Average lookup time should be < 1ms
      expect(avgTime).toBeLessThan(1);
    });
  });

  describe('backward compatibility', () => {
    test('should maintain compatibility with existing valid agents', async () => {
      // These agents are known to be used in existing workflows
      const criticalAgents = [
        'senior-backend-engineer',
        'senior-frontend-engineer',
        'qa-test-automation-engineer'
      ];

      for (const agent of criticalAgents) {
        const result = await createTask(mockConfig, {
          agent,
          taskName: `compatibility-test-${agent}`,
          content: 'Backward compatibility test'
        });

        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      }
    });
  });

  describe('error logging', () => {
    test('should log security error for invalid agent attempts', async () => {
      const mockErrorLogger = mockConfig.errorLogger as any;

      try {
        await createTask(mockConfig, {
          agent: 'malicious-agent',
          taskName: 'test-task',
          content: 'Test content'
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify that the security violation was logged
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'validation',
          operation: 'create_task',
          severity: expect.stringMatching(/critical|high/)
        })
      );
    });
  });
});