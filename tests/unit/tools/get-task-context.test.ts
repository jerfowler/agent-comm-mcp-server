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
      } as unknown as EventLogger
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

  it('should require agent when not provided', async () => {
    const args = {
      taskId: 'test-task-id'
      // agent not provided
    };

    await expect(getTaskContext(mockConfig, args)).rejects.toThrow(
      'Agent name is required. Please specify the agent performing this operation.'
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
});