/**
 * @fileoverview Test suite for get-task-context tool
 */

import { jest } from '@jest/globals';
import { getTaskContext } from '../../../src/tools/get-task-context.js';
import { TaskContextManager, TaskContext } from '../../../src/core/TaskContextManager.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { ServerConfig } from '../../../src/types.js';

// Mock dependencies
jest.mock('../../../src/core/TaskContextManager.js');

const MockedTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;

// Mock ErrorLogger
const mockErrorLogger = {
  logError: jest.fn().mockImplementation(() => Promise.resolve())
};

describe('get-task-context tool', () => {
  const mockConfig = {
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
      } as unknown as EventLogger,
    errorLogger: mockErrorLogger as any
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get task context successfully', async () => {
    const mockContext: TaskContext = {
      title: 'Test Task',
      objective: 'Test objective',
      requirements: [],
      currentAgent: 'test-agent',
      protocolInstructions: 'Test protocol',
      agentCapabilities: [],
      additionalContext: ''
    };

    const mockInstance = {
      getTaskContext: jest.fn().mockResolvedValue(mockContext as never)
    };
    (MockedTaskContextManager as unknown as jest.Mock).mockImplementation(() => mockInstance);

    const args = {
      taskId: 'test-task-id',
      agent: 'test-agent'
    };

    const result = await getTaskContext(mockConfig, args);

    expect(result).toEqual(mockContext);
    expect(MockedTaskContextManager).toHaveBeenCalledWith(expect.objectContaining({
      commDir: mockConfig.commDir
    }));
    expect(mockInstance.getTaskContext).toHaveBeenCalled();
  });

  it('should require agent when not provided and log error', async () => {
    const args = {
      taskId: 'test-task-id'
      // agent not provided
    };

    await expect(getTaskContext(mockConfig, args)).rejects.toThrow(
      'Agent name is required. Please specify the agent performing this operation.'
    );

    expect(mockErrorLogger.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(Date),
        source: 'validation',
        operation: 'get_task_context',
        agent: 'unknown',
        error: expect.objectContaining({
          message: 'Agent name is required. Please specify the agent performing this operation.'
        }),
        context: expect.objectContaining({
          tool: 'get-task-context',
          parameters: expect.objectContaining({
            taskId: 'test-task-id',
            agent: undefined
          })
        }),
        severity: 'medium'
      })
    );
  });

  it('should handle missing configuration components', async () => {
    const badConfig = {
      commDir: '/test/comm',
      archiveDir: '/test/archive',
      logDir: '/test/logs',
      enableArchiving: false
      // Missing connectionManager and eventLogger
    };

    const args = {
      taskId: 'test-task-id',
      agent: 'test-agent'
    };

    await expect(getTaskContext(badConfig as unknown as ServerConfig, args))
      .rejects.toThrow('Configuration missing required components');
  });

  it('should log errors when task context retrieval fails', async () => {
    const mockInstance = {
      getTaskContext: jest.fn().mockImplementation(() => Promise.reject(new Error('Task not found')))
    };
    (MockedTaskContextManager as unknown as jest.Mock).mockImplementation(() => mockInstance);

    const args = {
      taskId: 'nonexistent-task',
      agent: 'test-agent'
    };

    await expect(getTaskContext(mockConfig, args)).rejects.toThrow('Task not found');

    expect(mockErrorLogger.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(Date),
        source: 'tool_execution',
        operation: 'get_task_context',
        agent: 'test-agent',
        error: expect.objectContaining({
          message: 'Task not found'
        }),
        context: expect.objectContaining({
          tool: 'get-task-context',
          parameters: expect.objectContaining({
            taskId: 'nonexistent-task',
            agent: 'test-agent'
          })
        }),
        severity: 'low'
      })
    );
  });

  it('should log errors when context assembly fails', async () => {
    const mockInstance = {
      getTaskContext: jest.fn().mockImplementation(() => Promise.reject(new Error('Failed to parse task context')))
    };
    (MockedTaskContextManager as unknown as jest.Mock).mockImplementation(() => mockInstance);

    const args = {
      taskId: 'corrupted-task',
      agent: 'test-agent'
    };

    await expect(getTaskContext(mockConfig, args)).rejects.toThrow('Failed to parse task context');

    expect(mockErrorLogger.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(Date),
        source: 'tool_execution',
        operation: 'get_task_context',
        agent: 'test-agent',
        error: expect.objectContaining({
          message: 'Failed to parse task context'
        }),
        context: expect.objectContaining({
          tool: 'get-task-context',
          parameters: expect.objectContaining({
            taskId: 'corrupted-task',
            agent: 'test-agent'
          })
        }),
        severity: 'high'
      })
    );
  });
});