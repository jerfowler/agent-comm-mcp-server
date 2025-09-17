/**
 * @fileoverview Working test suite for the unified create_task tool
 * Focuses on testing the actual implemented functionality
 */

import { jest } from '@jest/globals';
import { createTask, createTaskTool } from '../../../src/tools/create-task.js';
import * as fs from '../../../src/utils/file-system.js';
import * as taskManager from '../../../src/utils/task-manager.js';
import { getConfig } from '../../../src/config.js';
import { AgentCommError, ServerConfig } from '../../../src/types.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';

// Mock dependencies
jest.mock('../../../src/utils/file-system.js');
jest.mock('../../../src/utils/task-manager.js');
jest.mock('../../../src/config.js');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedTaskManager = taskManager as jest.Mocked<typeof taskManager>;
const mockedGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

// Helper function to create complete ServerConfig for tests
function createMockServerConfig(): ServerConfig {
  return {
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
      } as unknown as ConnectionManager,
    eventLogger: {
      logOperation: jest.fn(),
      logError: jest.fn(),
        getOperationStatistics: jest.fn()
      } as unknown as EventLogger
  };
}

describe('create_task unified tool', () => {
  const mockConfig = createMockServerConfig();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetConfig.mockReturnValue(mockConfig);
    
    // Reset all mocks to default successful state
    mockedFs.pathExists.mockResolvedValue(false); // No existing tasks by default
    mockedFs.listDirectory.mockResolvedValue([]);
    mockedFs.isDirectory.mockResolvedValue(true);
    mockedFs.writeFile.mockResolvedValue(void 0);
    
    // Default successful mock for initializeTask
    mockedTaskManager.initializeTask.mockResolvedValue({
      taskDir: '2025-09-04T06-26-51-clean-task-name',
      initPath: '/test/path/INIT.md'
    });
  });

  describe('Basic functionality', () => {
    it('should create a new task successfully', async () => {
      const options = {
        agent: 'test-agent',
        taskName: 'clean-task-name',
        content: 'Test task content',
      };

      const result = await createTask(mockConfig, options);

      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(true);
      expect(result.taskId).toBe('2025-09-04T06-26-51-clean-task-name');
      expect(result.message).toContain('Task successfully created');
      
      // Should call initializeTask
      expect(mockedTaskManager.initializeTask).toHaveBeenCalledWith(
        mockConfig,
        'test-agent',
        'clean-task-name'
      );

      // Should write enhanced content without protocol injection
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        '/test/path/INIT.md',
        expect.stringContaining('Test task content')
      );

      // Should include tracking information
      expect(result.tracking).toBeDefined();
      expect(result.tracking.progress_command).toContain('track_task_progress');
      expect(result.tracking.lifecycle_command).toContain('get_full_lifecycle');
    });

    it('should detect existing tasks and return them (idempotent)', async () => {
      const existingTaskDir = '2025-09-04T06-26-51-clean-task-name';
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.listDirectory.mockResolvedValue([existingTaskDir]);
      mockedFs.isDirectory.mockResolvedValue(true);

      const options = {
        agent: 'test-agent',
        taskName: 'clean-task-name'
      };

      const result = await createTask(mockConfig, options);

      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(false); // Not created, found existing
      expect(result.taskId).toBe(existingTaskDir);
      expect(result.message).toContain('existing task found');
      
      // Should NOT call task creation functions
      expect(mockedTaskManager.initializeTask).not.toHaveBeenCalled();
    });

    it('should extract clean name from timestamped input', async () => {
      const options = {
        agent: 'test-agent',
        taskName: '2025-09-04T06-26-51-clean-task-name', // Already timestamped
        content: 'Test content'
      };

      await createTask(mockConfig, options);

      // Should extract clean name
      expect(mockedTaskManager.initializeTask).toHaveBeenCalledWith(
        mockConfig,
        'test-agent',
        'clean-task-name' // Clean name extracted
      );
    });

    it('should include only user content without protocol injection', async () => {
      const options = {
        agent: 'test-agent',
        taskName: 'test-task',
        content: 'Original content'
      };

      await createTask(mockConfig, options);

      // Verify only user content and metadata, no protocol injection
      const writtenContent = (mockedFs.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('Original content');
      expect(writtenContent).toContain('## Metadata');
      expect(writtenContent).not.toContain('## MCP Task Management Protocol');
    });

    it('should create template for self tasks without content', async () => {
      const options = {
        agent: 'test-agent',
        taskName: 'self-task'
        // No content provided
      };

      await createTask(mockConfig, options);

      // Should write template with only metadata, no protocol injection
      const writtenContent = (mockedFs.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('## Metadata');
      expect(writtenContent).toContain('Agent: test-agent');
      expect(writtenContent).not.toContain('## MCP Task Management Protocol');
    });

    it('should include parent task reference for subtasks', async () => {
      const options = {
        agent: 'test-agent',
        taskName: 'child-task',
        parentTask: 'parent-task-id',
        content: 'Subtask content'
      };

      await createTask(mockConfig, options);

      // Should include parent reference
      const writtenContent = (mockedFs.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).toContain('Parent Task: parent-task-id');
      expect(writtenContent).toContain('Subtask content');
    });
  });

  describe('MCP tool wrapper', () => {
    it('should handle createTaskTool wrapper correctly', async () => {
      const args = {
        agent: 'test-agent',
        taskName: 'wrapper-test',
        content: 'Test content'
      };

      const result = await createTaskTool(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(true);
      
      // Should call underlying function
      expect(mockedTaskManager.initializeTask).toHaveBeenCalledWith(
        mockConfig,
        'test-agent',
        'wrapper-test'
      );
    });
  });

  describe('Error handling', () => {
    it('should throw AgentCommError for invalid agent name', async () => {
      const options = {
        agent: '', // Invalid
        taskName: 'test-task'
      };

      await expect(createTask(mockConfig, options))
        .rejects.toThrow(AgentCommError);
    });

    it('should throw AgentCommError for invalid task name', async () => {
      const options = {
        agent: 'test-agent',
        taskName: '' // Invalid
      };

      await expect(createTask(mockConfig, options))
        .rejects.toThrow(AgentCommError);
    });

    it('should handle file system errors gracefully', async () => {
      mockedTaskManager.initializeTask.mockRejectedValue(new Error('File system error'));

      const options = {
        agent: 'test-agent',
        taskName: 'test-task'
      };

      await expect(createTask(mockConfig, options))
        .rejects.toThrow(AgentCommError);
    });

    // Test uncovered lines 195, 230, 246 from create-task.ts
    it('should handle malformed task names with multiple timestamps (line 195)', async () => {
      const options = {
        agent: 'test-agent',
        taskName: 'task-20240101-123456-20240102-654321-name'
      };

      const result = await createTask(mockConfig, options);
      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(true);
    });

    it('should handle task name with regex match but no group 1 (line 195 break case)', async () => {
      // This tests the break condition in the while loop when match[1] doesn't exist
      const options = {
        agent: 'test-agent', 
        taskName: 'test-task-incomplete-pattern'
      };

      const result = await createTask(mockConfig, options);
      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(true);
    });

    it('should handle wrapper tool error scenario (line 360)', async () => {
      // Mock the createTaskTool to throw error
      mockedTaskManager.initializeTask.mockRejectedValue(new Error('Mock error for coverage'));

      const args = {
        agent: 'test-agent',
        taskName: 'test-wrapper-error',
        content: 'Test content',
      };

      try {
        await createTaskTool(mockConfig, args);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentCommError);
        expect((error as AgentCommError).message).toContain('Mock error for coverage');
      }
    });
  });

  describe('Clean name extraction', () => {
    const testCases = [
      {
        input: '2025-09-04T06-26-51-clean-name',
        expected: 'clean-name',
        description: 'Full ISO timestamp prefix'
      },
      {
        input: '2025-09-04T05-51-46-2025-09-04T05-51-15-double-timestamp',
        expected: 'double-timestamp',
        description: 'Double timestamp bug case'
      },
      {
        input: 'clean-name',
        expected: 'clean-name',
        description: 'Already clean name'
      }
    ];

    testCases.forEach(({ input, expected, description }) => {
      it(`should extract clean name from: ${description}`, async () => {
        const options = {
          agent: 'test-agent',
          taskName: input
        };
        
        await createTask(mockConfig, options);

        // Verify clean name passed to underlying function
        expect(mockedTaskManager.initializeTask).toHaveBeenCalledWith(
          mockConfig,
          'test-agent',
          expected
        );
      });
    });
  });
});