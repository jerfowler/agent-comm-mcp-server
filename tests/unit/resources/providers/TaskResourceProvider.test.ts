/**
 * TaskResourceProvider Test Suite
 * Tests for task-based resource provider functionality
 * Following MCP 2025-06-18 specification
 */

import { TaskResourceProvider } from '../../../../src/resources/providers/TaskResourceProvider.js';
import { TaskContextManager } from '../../../../src/core/TaskContextManager.js';
import { EventLogger } from '../../../../src/logging/EventLogger.js';
import type { Resource } from '@modelcontextprotocol/sdk/types.js';

// Mock dependencies
jest.mock('../../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));
jest.mock('../../../../src/core/TaskContextManager.js');
jest.mock('../../../../src/logging/EventLogger.js');

// Import fs-extra after mocking
import * as fs from '../../../../src/utils/fs-extra-safe.js';
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('TaskResourceProvider', () => {
  let provider: TaskResourceProvider;
  let mockTaskContextManager: jest.Mocked<TaskContextManager>;
  let mockEventLogger: jest.Mocked<EventLogger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockEventLogger = new EventLogger('/test/logs') as jest.Mocked<EventLogger>;
    mockEventLogger.logOperation = jest.fn().mockResolvedValue(undefined);
    
    mockTaskContextManager = new TaskContextManager(
      { eventLogger: mockEventLogger } as any
    ) as jest.Mocked<TaskContextManager>;
    
    // Create provider instance
    provider = new TaskResourceProvider({
      taskContextManager: mockTaskContextManager,
      eventLogger: mockEventLogger
    });
  });

  describe('getScheme', () => {
    it('should return agent scheme', () => {
      expect(provider.getScheme()).toBe('agent');
    });
  });

  describe('listResources', () => {
    it('should list all task resources with agent:// URI format', async () => {
      // Arrange
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock)
        .mockResolvedValueOnce(['senior-backend-engineer', 'qa-test-automation-engineer', '.archive']) // comm dir
        .mockResolvedValueOnce(['2025-01-09T10-00-00-implement-feature', '2025-01-09T11-00-00-fix-bug']) // senior-backend-engineer
        .mockResolvedValueOnce(['2025-01-09T12-00-00-write-tests']); // qa-test-automation-engineer
      
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });
      
      // Mock file existence checks for status determination
      (mockedFs.pathExists as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('2025-01-09T10-00-00-implement-feature/PLAN.md')) return Promise.resolve(true);
        if (path.includes('2025-01-09T11-00-00-fix-bug/DONE.md')) return Promise.resolve(true);
        if (path.includes('ERROR.md') || path.includes('DONE.md') || path.includes('PLAN.md')) return Promise.resolve(false);
        return Promise.resolve(true); // Default for directories
      });

      // Act
      const resources = await provider.listResources();

      // Assert
      expect(resources).toHaveLength(3);
      expect(resources).toContainEqual(
        expect.objectContaining<Resource>({
          uri: 'agent://senior-backend-engineer/tasks/2025-01-09T10-00-00-implement-feature',
          name: 'Task: implement-feature (PLAN)',
          mimeType: 'application/json',
          description: expect.stringContaining('senior-backend-engineer')
        })
      );
      expect(resources).toContainEqual(
        expect.objectContaining<Resource>({
          uri: 'agent://senior-backend-engineer/tasks/2025-01-09T11-00-00-fix-bug',
          name: 'Task: fix-bug (DONE)',
          mimeType: 'application/json',
          description: expect.stringContaining('senior-backend-engineer')
        })
      );
      expect(resources).toContainEqual(
        expect.objectContaining<Resource>({
          uri: 'agent://qa-test-automation-engineer/tasks/2025-01-09T12-00-00-write-tests',
          name: 'Task: write-tests (INIT)',
          mimeType: 'application/json',
          description: expect.stringContaining('qa-test-automation-engineer')
        })
      );
    });

    it('should handle empty task list gracefully', async () => {
      // Arrange
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock).mockResolvedValue(['.archive', '.logs']); // Only hidden dirs

      // Act
      const resources = await provider.listResources();

      // Assert
      expect(resources).toEqual([]);
    });

    it('should include task metadata in resource description', async () => {
      // Arrange
      (mockedFs.pathExists as jest.Mock).mockResolvedValue(true);
      (mockedFs.readdir as unknown as jest.Mock)
        .mockResolvedValueOnce(['agent-1'])
        .mockResolvedValueOnce(['2025-01-09T10-00-00-complex-task']);
      
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true });
      
      // Mock PLAN.md exists
      (mockedFs.pathExists as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('ERROR.md') || path.includes('DONE.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      // Act
      const resources = await provider.listResources();

      // Assert
      expect(resources[0].description).toContain('agent-1');
      expect(resources[0].description).toContain('PLAN');
    });

    it('should handle errors during listing', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      (mockedFs.pathExists as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(provider.listResources()).rejects.toThrow('Failed to list task resources');
      expect(mockEventLogger.logOperation).toHaveBeenCalledWith(
        'error',
        'system',
        expect.objectContaining({
          error: 'Failed to list task resources',
          originalError: error
        })
      );
    });
  });

  describe('readResource', () => {
    it('should read task content for valid URI', async () => {
      // Arrange
      const uri = 'agent://senior-backend-engineer/tasks/2025-01-09T10-00-00-implement-feature';
      const mockTaskContext = {
        taskId: '2025-01-09T10-00-00-implement-feature',
        agent: 'senior-backend-engineer',
        status: 'PLAN',
        plan: '## Implementation Plan\n- [ ] Write tests\n- [ ] Implement feature',
        createdAt: '2025-01-09T10:00:00Z',
        updatedAt: '2025-01-09T11:00:00Z'
      };
      
      // Mock getTaskContext - it expects (taskId, connection) not (agent, taskId)
      mockTaskContextManager.getTaskContext = jest.fn().mockImplementation((taskId: string, _connection: any) => {
        if (taskId === '2025-01-09T10-00-00-implement-feature') {
          return Promise.resolve(mockTaskContext);
        }
        return Promise.resolve(null);
      });

      // Act
      const result = await provider.readResource(uri);

      // Assert
      expect(result).toMatchObject({
        uri,
        mimeType: 'application/json',
        text: expect.stringContaining('2025-01-09T10-00-00-implement-feature')
      });
      
      const content = JSON.parse(result.text!);
      expect(content).toMatchObject(mockTaskContext);
      
      // Verify getTaskContext was called with correct parameters
      expect(mockTaskContextManager.getTaskContext).toHaveBeenCalledWith(
        '2025-01-09T10-00-00-implement-feature',
        expect.objectContaining({
          id: expect.stringMatching(/^resource-/),
          agent: 'senior-backend-engineer',
          startTime: expect.any(Date),
          metadata: {}
        })
      );
    });

    it('should handle task not found', async () => {
      // Arrange
      const uri = 'agent://agent-1/tasks/nonexistent-task';
      mockTaskContextManager.getTaskContext = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(provider.readResource(uri)).rejects.toThrow('Task not found');
      expect(mockEventLogger.logOperation).toHaveBeenCalledWith(
        'error',
        'system',
        expect.objectContaining({
          error: 'Task not found',
          uri,
          code: 'RESOURCE_NOT_FOUND',
          details: expect.objectContaining({
            uri,
            agent: 'agent-1',
            taskId: 'nonexistent-task'
          })
        })
      );
    });

    it('should parse URI correctly', async () => {
      // Arrange
      const testCases = [
        {
          uri: 'agent://agent-1/tasks/task-123',
          expectedAgent: 'agent-1',
          expectedTaskId: 'task-123'
        },
        {
          uri: 'agent://senior-backend-engineer/tasks/2025-01-09T10-00-00-complex-task',
          expectedAgent: 'senior-backend-engineer',
          expectedTaskId: '2025-01-09T10-00-00-complex-task'
        }
      ];
      
      mockTaskContextManager.getTaskContext = jest.fn().mockResolvedValue({
        taskId: 'test',
        status: 'INIT'
      });

      // Act & Assert
      for (const testCase of testCases) {
        // Clear previous calls
        (mockTaskContextManager.getTaskContext as jest.Mock).mockClear();
        
        await provider.readResource(testCase.uri);
        
        // Verify the URI was parsed correctly and getTaskContext called with right params
        expect(mockTaskContextManager.getTaskContext).toHaveBeenCalledWith(
          testCase.expectedTaskId,
          expect.objectContaining({
            id: expect.stringMatching(/^resource-/),
            agent: testCase.expectedAgent,
            startTime: expect.any(Date),
            metadata: {}
          })
        );
      }
    });

    it('should handle invalid URI format', async () => {
      // Arrange
      const invalidUris = [
        'not-a-uri',
        'agent://missing-tasks-segment',
        'agent://agent/wrong-segment/task-id',
        'http://wrong-scheme/tasks/task-id'
      ];

      // Act & Assert
      for (const uri of invalidUris) {
        await expect(provider.readResource(uri)).rejects.toThrow('Invalid task resource URI');
      }
    });

    it('should return proper MIME type for different task statuses', async () => {
      // Arrange
      const testCases = [
        { status: 'INIT', expectedMimeType: 'application/json' },
        { status: 'PLAN', expectedMimeType: 'application/json' },
        { status: 'DONE', expectedMimeType: 'application/json' },
        { status: 'ERROR', expectedMimeType: 'application/json' }
      ];
      
      for (const testCase of testCases) {
        const uri = `agent://agent-1/tasks/task-${testCase.status}`;
        mockTaskContextManager.getTaskContext = jest.fn().mockResolvedValue({
          context: { taskId: `task-${testCase.status}`, status: testCase.status },
          contextId: 'ctx-test'
        });

        // Act
        const result = await provider.readResource(uri);

        // Assert
        expect(result.mimeType).toBe(testCase.expectedMimeType);
      }
    });
  });

  describe('canHandle', () => {
    it('should return true for agent:// URIs', () => {
      const validUris = [
        'agent://agent-1/tasks/task-123',
        'agent://senior-backend-engineer/tasks/2025-01-09T10-00-00-task'
      ];
      
      for (const uri of validUris) {
        expect(provider.canHandle(uri)).toBe(true);
      }
    });

    it('should return false for non-agent URIs', () => {
      const invalidUris = [
        'server://info',
        'http://example.com',
        'file:///path/to/file',
        'custom://resource'
      ];
      
      for (const uri of invalidUris) {
        expect(provider.canHandle(uri)).toBe(false);
      }
    });
  });

  describe('getResourceMetadata', () => {
    it('should return metadata for a task resource', async () => {
      // Arrange
      const uri = 'agent://agent-1/tasks/task-123';
      const mockContext = {
        taskId: 'task-123',
        agent: 'agent-1',
        status: 'PLAN',
        plan: '## Plan content',
        createdAt: '2025-01-09T10:00:00Z',
        updatedAt: '2025-01-09T11:00:00Z'
      };
      
      mockTaskContextManager.getTaskContext = jest.fn().mockResolvedValue(mockContext);

      // Act
      const metadata = await provider.getResourceMetadata(uri);

      // Assert
      // The implementation returns basic metadata, not all task fields
      expect(metadata).toMatchObject({
        uri,
        name: expect.stringContaining('task-123'),
        mimeType: 'application/json',
        description: expect.stringContaining('agent-1'),
        size: expect.any(Number),
        lastModified: expect.any(String)
      });
      
      // Verify getTaskContext was called correctly
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
  });
});