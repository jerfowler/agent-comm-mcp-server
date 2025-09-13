/**
 * Tests for AgentResourceProvider
 */

import { jest } from '@jest/globals';
import { AgentResourceProvider } from '../../../../src/resources/providers/AgentResourceProvider.js';
import { ConnectionManager } from '../../../../src/core/ConnectionManager.js';
import { TaskContextManager } from '../../../../src/core/TaskContextManager.js';
import { EventLogger } from '../../../../src/logging/EventLogger.js';
import { AgentCommError } from '../../../../src/types.js';

// Mock dependencies
jest.mock('../../../../src/core/ConnectionManager.js');
jest.mock('../../../../src/core/TaskContextManager.js');
jest.mock('../../../../src/logging/EventLogger.js');
jest.mock('../../../../src/utils/task-manager.js');

// Import mocked task-manager
import { getAllAgents, getAgentTasks } from '../../../../src/utils/task-manager.js';

const mockedGetAllAgents = getAllAgents as jest.MockedFunction<typeof getAllAgents>;
const mockedGetAgentTasks = getAgentTasks as jest.MockedFunction<typeof getAgentTasks>;

describe('AgentResourceProvider', () => {
  let provider: AgentResourceProvider;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let mockTaskContextManager: jest.Mocked<TaskContextManager>;
  let mockEventLogger: jest.Mocked<EventLogger>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockConnectionManager = new ConnectionManager() as jest.Mocked<ConnectionManager>;
    mockTaskContextManager = new TaskContextManager({
      connectionManager: mockConnectionManager,
      eventLogger: mockEventLogger
    } as any) as jest.Mocked<TaskContextManager>;
    mockEventLogger = {
      logOperation: jest.fn()
    } as unknown as jest.Mocked<EventLogger>;
    
    (mockEventLogger.logOperation as jest.Mock).mockImplementation(() => Promise.resolve());

    provider = new AgentResourceProvider({
      connectionManager: mockConnectionManager,
      taskContextManager: mockTaskContextManager,
      eventLogger: mockEventLogger
    });
  });

  describe('getScheme', () => {
    it('should return agent scheme', () => {
      expect(provider.getScheme()).toBe('agent');
    });
  });

  describe('canHandle', () => {
    it('should return true for agent status URIs', () => {
      expect(provider.canHandle('agent://test-agent/status')).toBe(true);
      expect(provider.canHandle('agent://another-agent/status')).toBe(true);
    });

    it('should return false for non-status agent URIs', () => {
      expect(provider.canHandle('agent://test-agent/other')).toBe(false);
      expect(provider.canHandle('agent://test-agent')).toBe(false);
    });

    it('should return false for non-agent URIs', () => {
      expect(provider.canHandle('server://info')).toBe(false);
      expect(provider.canHandle('https://example.com')).toBe(false);
    });
  });

  describe('listResources', () => {
    it('should list all agent status resources', async () => {
      // Mock getAllAgents to return test agents
      mockedGetAllAgents.mockResolvedValue([
        { name: 'agent-1', taskCount: 2, pendingCount: 1, completedCount: 1, errorCount: 0 },
        { name: 'agent-2', taskCount: 3, pendingCount: 2, completedCount: 0, errorCount: 1 }
      ]);

      const resources = await provider.listResources();

      expect(resources).toHaveLength(2);
      expect(resources[0]).toEqual({
        uri: 'agent://agent-1/status',
        name: 'agent-1 Status',
        mimeType: 'application/json',
        description: 'Current status and activity for agent-1'
      });
      expect(resources[1]).toEqual({
        uri: 'agent://agent-2/status',
        name: 'agent-2 Status',
        mimeType: 'application/json',
        description: 'Current status and activity for agent-2'
      });
    });

    it('should handle errors gracefully and return empty array', async () => {
      // Mock getAllAgents to throw an error
      mockedGetAllAgents.mockRejectedValue(new Error('Failed to get agents'));

      const resources = await provider.listResources();

      expect(resources).toEqual([]);
      expect(mockEventLogger.logOperation).toHaveBeenCalledWith('error', 'system', {
        operation: 'list_agent_resources',
        error: 'Failed to list agent resources',
        originalError: expect.any(Error)
      });
    });

    it('should handle empty agent list', async () => {
      mockedGetAllAgents.mockResolvedValue([]);

      const resources = await provider.listResources();

      expect(resources).toEqual([]);
    });
  });

  describe('readResource', () => {
    beforeEach(() => {
      // Setup default mock for getAgentTasks
      mockedGetAgentTasks.mockResolvedValue([
        {
          name: 'task-1',
          agent: 'test-agent',
          path: '/test/comm/test-agent/task-1',
          created: new Date(),
          hasInit: true,
          hasPlan: true,
          hasDone: false,
          hasError: false
        }
      ]);
    });

    it('should read agent status successfully', async () => {
      const uri = 'agent://test-agent/status';
      const result = await provider.readResource(uri);

      expect(result.uri).toBe(uri);
      expect(result.mimeType).toBe('application/json');
      
      const status = JSON.parse(result.text!);
      expect(status.connectionStatus.connected).toBe(false);
      expect(status.connectionStatus.lastActivity).toBe(null);
      expect(status.currentTask).toBe('task-1');
      expect(status.taskStats).toEqual({
        total: 1,
        pending: 1,
        completed: 0,
        error: 0
      });
    });

    it('should handle completed tasks correctly', async () => {
      mockedGetAgentTasks.mockResolvedValue([
        {
          name: 'completed-task',
          agent: 'test-agent',
          path: '/test/comm/test-agent/completed-task',
          created: new Date(),
          hasInit: true,
          hasPlan: true,
          hasDone: true,
          hasError: false
        }
      ]);

      const result = await provider.readResource('agent://test-agent/status');
      const status = JSON.parse(result.text!);

      expect(status.currentTask).toBe(null);
      expect(status.taskStats.completed).toBe(1);
      expect(status.taskStats.pending).toBe(1); // Has init/plan
    });

    it('should handle error tasks correctly', async () => {
      mockedGetAgentTasks.mockResolvedValue([
        {
          name: 'error-task',
          agent: 'test-agent',
          path: '/test/comm/test-agent/error-task',
          created: new Date(),
          hasInit: false,
          hasPlan: false,
          hasDone: false,
          hasError: true
        }
      ]);

      const result = await provider.readResource('agent://test-agent/status');
      const status = JSON.parse(result.text!);

      expect(status.currentTask).toBe(null);
      expect(status.taskStats.error).toBe(1);
    });

    it('should throw error for non-status URIs', async () => {
      await expect(provider.readResource('agent://test-agent/other'))
        .rejects
        .toThrow(AgentCommError);
    });

    it('should handle getAgentTasks errors gracefully', async () => {
      mockedGetAgentTasks.mockRejectedValue(new Error('Failed to get tasks'));

      await expect(provider.readResource('agent://test-agent/status'))
        .rejects
        .toThrow(AgentCommError);

      expect(mockEventLogger.logOperation).toHaveBeenCalledWith('error', 'system', {
        operation: 'get_agent_status',
        error: 'Failed to get agent status',
        agent: 'test-agent',
        originalError: expect.any(Error)
      });
    });

    it('should handle multiple active tasks', async () => {
      mockedGetAgentTasks.mockResolvedValue([
        {
          name: 'active-task-1',
          agent: 'test-agent',
          path: '/test/comm/test-agent/active-task-1',
          created: new Date(),
          hasInit: true,
          hasPlan: true,
          hasDone: false,
          hasError: false
        },
        {
          name: 'active-task-2',
          agent: 'test-agent',
          path: '/test/comm/test-agent/active-task-2',
          created: new Date(),
          hasInit: true,
          hasPlan: true,
          hasDone: false,
          hasError: false
        }
      ]);

      const result = await provider.readResource('agent://test-agent/status');
      const status = JSON.parse(result.text!);

      // Should return the first active task
      expect(status.currentTask).toBe('active-task-1');
    });

    it('should handle empty task list', async () => {
      mockedGetAgentTasks.mockResolvedValue([]);

      const result = await provider.readResource('agent://test-agent/status');
      const status = JSON.parse(result.text!);

      expect(status.currentTask).toBe(null);
      expect(status.taskStats).toEqual({
        total: 0,
        pending: 0,
        completed: 0,
        error: 0
      });
    });
  });

  describe('getResourceMetadata', () => {
    it('should return metadata for agent resource', async () => {
      const uri = 'agent://test-agent/status';
      const metadata = await provider.getResourceMetadata(uri);

      expect(metadata.uri).toBe(uri);
      expect(metadata.name).toBe('test-agent Status');
      expect(metadata.mimeType).toBe('application/json');
      expect(metadata.description).toBe('Current status and activity for test-agent');
      expect(metadata['dynamic']).toBe(true);
      expect(metadata['agent']).toBe('test-agent');
      expect(metadata.lastModified).toBeDefined();
    });

    it('should throw error for invalid URI format', async () => {
      await expect(provider.getResourceMetadata('invalid-uri'))
        .rejects
        .toThrow(AgentCommError);
    });
  });

  describe('parseAgentUri', () => {
    it('should parse valid agent URIs', () => {
      // Access private method through any cast for testing
      const parseMethod = (provider as any).parseAgentUri.bind(provider);
      
      expect(parseMethod('agent://test-agent/status')).toBe('test-agent');
      expect(parseMethod('agent://another-agent/status')).toBe('another-agent');
      expect(parseMethod('agent://agent-with-dash/status')).toBe('agent-with-dash');
    });

    it('should throw error for invalid URI formats', () => {
      const parseMethod = (provider as any).parseAgentUri.bind(provider);

      expect(() => parseMethod('agent://test-agent')).toThrow(AgentCommError);
      expect(() => parseMethod('agent://test-agent/other')).toThrow(AgentCommError);
      expect(() => parseMethod('server://info')).toThrow(AgentCommError);
      expect(() => parseMethod('invalid')).toThrow(AgentCommError);
    });
  });
});