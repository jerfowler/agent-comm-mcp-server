/**
 * ResourceManager Test Suite
 * Tests for core MCP resource management functionality
 * Following MCP 2025-06-18 specification
 */

import { ResourceManager } from '../../../src/resources/ResourceManager.js';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import type { 
  ListResourcesResult, 
  ReadResourceResult
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import * as fileSystem from '../../../src/utils/file-system.js';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  readFile: jest.fn(),
  pathExists: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));
jest.mock('../../../src/core/TaskContextManager.js');
jest.mock('../../../src/core/ConnectionManager.js');
jest.mock('../../../src/logging/EventLogger.js');

// Mock file-system utilities - need to return actual implementations for most tests
jest.mock('../../../src/utils/file-system.js');

describe('ResourceManager', () => {
  let resourceManager: ResourceManager;
  let mockTaskContextManager: jest.Mocked<TaskContextManager>;
  let mockConnectionManager: jest.Mocked<ConnectionManager>;
  let mockEventLogger: jest.Mocked<EventLogger>;
  const mockedFs = fs as jest.Mocked<typeof fs>;
  const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset file-system mocks to default behavior 
    (mockedFileSystem.pathExists as jest.Mock).mockImplementation(() => Promise.resolve(true));
    (mockedFileSystem.listDirectory as jest.Mock).mockImplementation(() => Promise.resolve([]));
    (mockedFileSystem.isDirectory as jest.Mock).mockImplementation(() => Promise.resolve(true));
    (mockedFileSystem.getTaskInfo as jest.Mock).mockImplementation(() => Promise.resolve(null));
    
    // Setup mocks
    mockEventLogger = new EventLogger('/test/logs') as jest.Mocked<EventLogger>;
    mockEventLogger.logOperation = jest.fn().mockResolvedValue(undefined);
    
    mockConnectionManager = new ConnectionManager() as jest.Mocked<ConnectionManager>;
    
    mockTaskContextManager = new TaskContextManager(
      { eventLogger: mockEventLogger, connectionManager: mockConnectionManager, commDir: "./test-comm" } as ConstructorParameters<typeof TaskContextManager>[0]
    ) as jest.Mocked<TaskContextManager>;
    
    // Setup default methods
    mockTaskContextManager.getTaskContext = jest.fn().mockResolvedValue(null);
    
    // Create resource manager instance
    resourceManager = new ResourceManager({
      taskContextManager: mockTaskContextManager,
      eventLogger: mockEventLogger,
      connectionManager: mockConnectionManager
    });
  });

  describe('listResources', () => {
    it('should list all available resources with proper MCP format', async () => {
      // Arrange
      // Mock fs-extra for TaskResourceProvider
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock)
        .mockResolvedValueOnce(['test-agent'])  // Agent directory
        .mockResolvedValueOnce(['2025-01-09T10-00-00-test-task']); // Task directory
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });
      
      // Mock pathExists for task status files
      (mockedFs.pathExists as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('INIT.md')) return Promise.resolve(true);
        if (path.includes('PLAN.md') || path.includes('DONE.md') || path.includes('ERROR.md')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });

      // Act
      const result = await resourceManager.listResources();

      // Assert
      expect(result).toMatchObject<ListResourcesResult>({
        resources: expect.arrayContaining([
          expect.objectContaining({
            uri: expect.stringMatching(/^agent:\/\//),
            name: expect.any(String),
            mimeType: expect.stringMatching(/^(text\/plain|application\/json)$/),
            description: expect.any(String)
          })
        ])
      });
      
      expect(result.resources.length).toBeGreaterThan(0);
      expect(mockEventLogger.logOperation).toHaveBeenCalledWith(
        'list_resources',
        'system',
        expect.objectContaining({
          count: expect.any(Number)
        })
      );
    });

    it('should support cursor-based pagination', async () => {
      // Arrange
      // Create many mock tasks to trigger pagination (page size is 20)
      const mockAgents = Array.from({ length: 5 }, (_, i) => `agent-${i + 1}`);
      const mockTasks = Array.from({ length: 5 }, (_, i) => `2025-01-09T10-00-00-task-${i + 1}`);
      
      // Mock fs calls to return many tasks
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock)
        .mockResolvedValueOnce(mockAgents) // Return 5 agents
        .mockResolvedValue(mockTasks); // Return 5 tasks for each agent (25 total tasks)
      
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });
      
      // Mock file existence checks for task status
      (mockedFs.pathExists as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('INIT.md')) return Promise.resolve(true);
        if (path.includes('ERROR.md') || path.includes('DONE.md') || path.includes('PLAN.md')) {
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });

      // Act
      const firstPage = await resourceManager.listResources({});
      const secondPage = firstPage.nextCursor 
        ? await resourceManager.listResources({ cursor: firstPage.nextCursor })
        : { resources: [] };

      // Assert
      expect(firstPage.resources.length).toBeLessThanOrEqual(20); // Default page size
      // With 25 task resources + 3 server resources = 28 total, should have nextCursor
      expect(firstPage.nextCursor).toBeDefined();
      expect(secondPage.resources).toBeDefined();
      expect(secondPage.resources.length).toBeGreaterThan(0);
      // Verify pagination worked - second page should have different resources
      if (secondPage.resources.length > 0 && firstPage.resources.length > 0) {
        expect(secondPage.resources[0]?.uri).not.toBe(firstPage.resources[0]?.uri);
      }
    });

    it('should include server information resources', async () => {
      // Arrange
      // Mock fs for TaskResourceProvider to avoid errors
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock).mockResolvedValue([]);
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });

      // Act
      const result = await resourceManager.listResources();

      // Assert
      // Server resources should be included regardless of provider resources
      expect(result.resources).toBeDefined();
      expect(result.resources.length).toBeGreaterThan(0);
      
      // Check for server resources specifically (not checking exact count as providers may add more)
      const serverResources = result.resources.filter(r => r.uri.startsWith('server://'));
      
      expect(serverResources).toContainEqual(
        expect.objectContaining({
          uri: 'server://info',
          name: 'Server Information',
          mimeType: 'application/json'
        })
      );
      expect(serverResources).toContainEqual(
        expect.objectContaining({
          uri: 'server://version',
          name: 'Server Version',
          mimeType: 'text/plain'
        })
      );
      expect(serverResources).toContainEqual(
        expect.objectContaining({
          uri: 'server://capabilities',
          name: 'Server Capabilities',
          mimeType: 'application/json'
        })
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      // Mock fs to throw error for TaskResourceProvider
      (mockedFs.pathExists as jest.Mock).mockRejectedValue(error);

      // Act
      const result = await resourceManager.listResources();

      // Assert - Should log error but still return server resources
      // Check that provider_error was logged (it's one of the calls)
      const calls = (mockEventLogger.logOperation as jest.Mock).mock.calls;
      const hasProviderError = calls.some(call => 
        call[0] === 'provider_error' && 
        call[1] === 'system' &&
        call[2]?.error?.includes('Provider')
      );
      expect(hasProviderError).toBe(true);
      expect(result.resources).toBeDefined();
      // Should still include server resources even when providers fail
      const serverResources = result.resources.filter(r => r.uri.startsWith('server://'));
      expect(serverResources.length).toBeGreaterThan(0);
    });
  });

  describe('readResource', () => {
    it('should read task resource content with correct MIME type', async () => {
      // Arrange
      const taskUri = 'agent://agent-1/tasks/task-123';
      const mockTaskContent = {
        taskId: 'task-123',
        agent: 'agent-1',
        status: 'PLAN',
        content: 'Task implementation plan content'
      };
      
      // Mock getTaskContext to return the task context
      // Note: getTaskContext expects (taskId, connection) not (agent, taskId)
      mockTaskContextManager.getTaskContext = jest.fn().mockImplementation((taskId: string, _connection: unknown) => {
        if (taskId === 'task-123') {
          return Promise.resolve(mockTaskContent);
        }
        return Promise.resolve(null);
      });
      
      // Mock fs for TaskResourceProvider
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock).mockResolvedValue(['agent-1']);
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });

      // Act
      const result = await resourceManager.readResource(taskUri);

      // Assert
      expect(result).toMatchObject<ReadResourceResult>({
        contents: expect.arrayContaining([
          expect.objectContaining({
            uri: taskUri,
            mimeType: 'application/json',
            text: expect.stringContaining('task-123')
          })
        ])
      });
      
      const parsedContent = JSON.parse(result.contents[0].text as string);
      expect(parsedContent).toMatchObject(mockTaskContent);
      
      // Verify getTaskContext was called with correct parameters
      expect(mockTaskContextManager.getTaskContext).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          id: expect.stringMatching(/^resource-/),
          agent: 'agent-1',
          startTime: expect.any(Date),
          metadata: {}
        })
      );
    });

    it('should read server version resource', async () => {
      // Arrange
      const versionUri = 'server://version';
      (mockedFs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ version: '1.0.0' }));

      // Act
      const result = await resourceManager.readResource(versionUri);

      // Assert
      expect(result).toMatchObject<ReadResourceResult>({
        contents: expect.arrayContaining([
          expect.objectContaining({
            uri: versionUri,
            mimeType: 'text/plain',
            text: '1.0.0'
          })
        ])
      });
    });

    it('should read server capabilities resource', async () => {
      // Arrange
      const capabilitiesUri = 'server://capabilities';

      // Act
      const result = await resourceManager.readResource(capabilitiesUri);

      // Assert
      expect(result).toMatchObject<ReadResourceResult>({
        contents: expect.arrayContaining([
          expect.objectContaining({
            uri: capabilitiesUri,
            mimeType: 'application/json',
            text: expect.stringContaining('resources')
          })
        ])
      });
      
      const capabilities = JSON.parse(result.contents[0].text as string);
      expect(capabilities).toHaveProperty('resources');
      expect(capabilities).toHaveProperty('tools');
    });

    it('should handle resource not found with proper MCP error', async () => {
      // Arrange
      const invalidUri = 'agent://nonexistent/tasks/invalid';
      mockTaskContextManager.getTaskContext = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(resourceManager.readResource(invalidUri)).rejects.toThrow('Task not found');
      // Note: Error logging happens in TaskResourceProvider, not ResourceManager
    });

    it('should handle invalid URI format', async () => {
      // Arrange
      const invalidUri = 'not-a-valid-uri';

      // Act & Assert
      await expect(resourceManager.readResource(invalidUri)).rejects.toThrow('Invalid resource URI');
    });

    it('should read agent status resource', async () => {
      // Arrange
      const statusUri = 'agent://agent-1/status';
      
      // Mock file-system utilities for task-manager
      (mockedFileSystem.pathExists as jest.Mock).mockImplementation((path: string) => {
        // All paths exist except specific status files
        if (path.includes('INIT.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        if (path.includes('task-123') && path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('task-456') && path.includes('DONE.md')) return Promise.resolve(true);
        return Promise.resolve(true);
      });
      
      // Mock fs.listDirectory for task-manager utility (this is what getAgentTasks actually calls)
      (mockedFileSystem.listDirectory as jest.Mock).mockResolvedValue(
        ['2025-01-09T10-00-00-task-123', '2025-01-09T11-00-00-task-456']
      );
      
      // Mock fs.isDirectory
      (mockedFileSystem.isDirectory as jest.Mock).mockResolvedValue(true);
      
      // Mock fs.getTaskInfo to return proper task structure (no status field, only flags)
      (mockedFileSystem.getTaskInfo as jest.Mock).mockImplementation((taskPath: string, _agent: string) => {
        if (taskPath.includes('task-123')) {
          return Promise.resolve({
            name: 'task-123',
            agent: 'agent-1',
            path: taskPath,
            hasInit: false,
            hasPlan: true,  // This is a PLAN task
            hasDone: false,
            hasError: false
          });
        } else if (taskPath.includes('task-456')) {
          return Promise.resolve({
            name: 'task-456',
            agent: 'agent-1',
            path: taskPath,
            hasInit: false,
            hasPlan: false,
            hasDone: true,  // This is a DONE task
            hasError: false
          });
        }
        return Promise.resolve(null);
      });
      
      // Also mock fs-extra for other providers that might use it
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock).mockResolvedValue([]);
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });

      // Act
      const result = await resourceManager.readResource(statusUri);

      // Assert - The resource should be in correct MCP format
      expect(result).toMatchObject<ReadResourceResult>({
        contents: expect.arrayContaining([
          expect.objectContaining({
            uri: statusUri,
            mimeType: 'application/json',
            text: expect.any(String) // JSON string with status data
          })
        ])
      });
      
      // Parse and validate the actual JSON content
      const status = JSON.parse(result.contents[0].text as string);
      
      // Check the actual structure returned by AgentResourceProvider
      expect(status).toMatchObject({
        connectionStatus: {
          connected: false,
          lastActivity: null
        },
        taskStats: {
          total: 2,
          pending: 1,  // 1 PLAN task
          completed: 1, // 1 DONE task
          error: 0
        },
        currentTask: 'task-123' // The name of the first PLAN status task
      });
    });
  });

  describe('registerProvider', () => {
    it('should register custom resource providers', async () => {
      // Arrange
      const customProvider = {
        getScheme: () => 'custom',
        canHandle: (uri: string) => uri.startsWith('custom://'),
        listResources: jest.fn().mockResolvedValue([
          {
            uri: 'custom://resource-1',
            name: 'Custom Resource',
            mimeType: 'text/plain',
            description: 'A custom resource'
          }
        ]),
        readResource: jest.fn().mockResolvedValue({
          uri: 'custom://resource-1',
          mimeType: 'text/plain',
          text: 'Custom content'
        })
      };

      // Act
      resourceManager.registerProvider(customProvider);
      const listResult = await resourceManager.listResources();

      // Assert
      expect(listResult.resources).toContainEqual(
        expect.objectContaining({
          uri: 'custom://resource-1',
          name: 'Custom Resource'
        })
      );
      expect(customProvider.listResources).toHaveBeenCalled();
    });

    it('should handle multiple providers without conflicts', async () => {
      // Arrange
      const provider1 = {
        getScheme: () => 'prov1',
        canHandle: (uri: string) => uri.startsWith('prov1://'),
        listResources: jest.fn().mockResolvedValue([
          { uri: 'prov1://res1', name: 'Resource 1', mimeType: 'text/plain' }
        ]),
        readResource: jest.fn()
      };
      
      const provider2 = {
        getScheme: () => 'prov2',
        canHandle: (uri: string) => uri.startsWith('prov2://'),
        listResources: jest.fn().mockResolvedValue([
          { uri: 'prov2://res2', name: 'Resource 2', mimeType: 'text/plain' }
        ]),
        readResource: jest.fn()
      };

      // Act
      resourceManager.registerProvider(provider1);
      resourceManager.registerProvider(provider2);
      const result = await resourceManager.listResources();

      // Assert
      expect(result.resources).toContainEqual(
        expect.objectContaining({ uri: 'prov1://res1' })
      );
      expect(result.resources).toContainEqual(
        expect.objectContaining({ uri: 'prov2://res2' })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle provider listing errors gracefully', async () => {
      // Arrange
      const errorProvider = {
        getScheme: () => 'error',
        canHandle: (uri: string) => uri.startsWith('error://'),
        listResources: jest.fn().mockRejectedValue(new Error('Provider error')),
        readResource: jest.fn()
      };
      
      resourceManager.registerProvider(errorProvider);
      
      // Act - should not throw, but should log error
      const result = await resourceManager.listResources();
      
      // Assert - other resources should still be listed
      expect(result.resources.length).toBeGreaterThan(0);
      expect(errorProvider.listResources).toHaveBeenCalled();
    });

    it('should handle readResource with no matching provider', async () => {
      // Act & Assert
      await expect(resourceManager.readResource('unknown://resource'))
        .rejects.toThrow('Resource not found');
    });

    it('should handle provider readResource errors', async () => {
      // Arrange
      const errorProvider = {
        getScheme: () => 'error',
        canHandle: (uri: string) => uri.startsWith('error://'),
        listResources: jest.fn().mockResolvedValue([]),
        readResource: jest.fn().mockRejectedValue(new Error('Read error'))
      };
      
      resourceManager.registerProvider(errorProvider);
      
      // Act & Assert
      await expect(resourceManager.readResource('error://resource'))
        .rejects.toThrow('Resource not found');
    });

    it('should handle listResources with empty providers', async () => {
      // Arrange - Create new ResourceManager with no providers
      const emptyManager = new ResourceManager({
        taskContextManager: mockTaskContextManager,
        connectionManager: mockConnectionManager,
        eventLogger: mockEventLogger
      });
      
      // Act
      const result = await emptyManager.listResources();
      
      // Assert - should return built-in resources only
      expect(result.resources.length).toBeGreaterThan(0);
      expect(result.resources.some(r => r.uri.startsWith('server://'))).toBe(true);
    });

    it('should handle concurrent provider operations', async () => {
      // Arrange
      const slowProvider = {
        getScheme: () => 'slow',
        canHandle: (uri: string) => uri.startsWith('slow://'),
        listResources: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => 
            resolve([{ uri: 'slow://res1', name: 'Slow Resource', mimeType: 'text/plain' }]), 
            100
          ))
        ),
        readResource: jest.fn()
      };
      
      const fastProvider = {
        getScheme: () => 'fast',
        canHandle: (uri: string) => uri.startsWith('fast://'),
        listResources: jest.fn().mockResolvedValue([
          { uri: 'fast://res1', name: 'Fast Resource', mimeType: 'text/plain' }
        ]),
        readResource: jest.fn()
      };
      
      resourceManager.registerProvider(slowProvider);
      resourceManager.registerProvider(fastProvider);
      
      // Act - List resources concurrently
      const [result1, result2] = await Promise.all([
        resourceManager.listResources(),
        resourceManager.listResources()
      ]);
      
      // Assert - Both should complete successfully
      expect(result1.resources).toContainEqual(
        expect.objectContaining({ uri: 'slow://res1' })
      );
      expect(result1.resources).toContainEqual(
        expect.objectContaining({ uri: 'fast://res1' })
      );
      expect(result2.resources).toEqual(result1.resources);
    });
  });

  describe('getResourceMetadata', () => {
    it('should return metadata for a resource', async () => {
      // Arrange
      const uri = 'agent://agent-1/tasks/task-123';
      mockTaskContextManager.getTaskContext = jest.fn().mockResolvedValue({
        context: { taskId: 'task-123', status: 'PLAN' },
        contextId: 'ctx-123'
      });
      
      // Mock fs for TaskResourceProvider
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock).mockResolvedValue(['agent-1']);
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });

      // Act
      const metadata = await resourceManager.getResourceMetadata(uri);

      // Assert
      expect(metadata).toMatchObject({
        uri,
        name: expect.any(String),
        mimeType: expect.stringMatching(/^(text\/plain|application\/json)$/),
        description: expect.any(String),
        size: expect.any(Number),
        lastModified: expect.any(String)
      });
    });
  });

  describe('searchResources', () => {
    it('should search resources by query', async () => {
      // Arrange
      // Mock fs for TaskResourceProvider to list test tasks
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock)
        .mockResolvedValueOnce(['agent-1', 'agent-2'])
        .mockResolvedValueOnce(['task-test-1', 'task-test-3'])
        .mockResolvedValueOnce(['task-prod-2']);
      
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });
      
      // Mock file existence for status checks
      (mockedFs.pathExists as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('task-test-3/PLAN.md')) return Promise.resolve(true);
        if (path.includes('task-prod-2/DONE.md')) return Promise.resolve(true);
        if (path.includes('ERROR.md') || path.includes('DONE.md') || path.includes('PLAN.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      // Act
      const result = await resourceManager.searchResources('test');

      // Assert
      // Should find task resources and possibly server resources containing 'test'
      const taskResources = result.resources.filter(r => r.uri.includes('/tasks/'));
      expect(taskResources.length).toBeGreaterThanOrEqual(2);
      expect(taskResources.every(r => r.uri.includes('test') || r.name.includes('test'))).toBe(true);
    });
  });
});