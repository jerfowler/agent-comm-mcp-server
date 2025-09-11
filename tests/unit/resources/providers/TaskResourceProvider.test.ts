/**
 * TaskResourceProvider Test Suite
 * Tests for task-based resource provider functionality
 * Following MCP 2025-06-18 specification
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TaskResourceProvider } from '../../../../src/resources/providers/TaskResourceProvider.js';
import { TaskContextManager } from '../../../../src/core/TaskContextManager.js';
import { ConnectionManager } from '../../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../../src/logging/EventLogger.js';
// Resource type is used for type checking in tests

// Mock dependencies
jest.mock('../../../../src/utils/fs-extra-safe.js');
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
    mockEventLogger = new EventLogger('/test/logs') as unknown as jest.Mocked<EventLogger>;
    (mockEventLogger.logOperation as unknown as jest.Mock) = jest.fn().mockResolvedValue(undefined as never);
    
    const mockConnectionManager = new ConnectionManager() as unknown as jest.Mocked<ConnectionManager>;
    
    mockTaskContextManager = new TaskContextManager(
      { 
        eventLogger: mockEventLogger, 
        connectionManager: mockConnectionManager,
        commDir: "./test-comm" 
      }
    ) as unknown as jest.Mocked<TaskContextManager>;
    
    // Create provider instance
    provider = new TaskResourceProvider({
      taskContextManager: mockTaskContextManager,
      eventLogger: mockEventLogger
    });
    
    // Reset all mocks to avoid type issues
    (mockedFs.pathExists as unknown as jest.Mock).mockReset();
    (mockedFs.readdir as unknown as jest.Mock).mockReset();
    (mockedFs.stat as unknown as jest.Mock).mockReset();
  });

  describe('getScheme', () => {
    it('should return agent scheme', () => {
      expect(provider.getScheme()).toBe('agent');
    });
  });

  describe('listResources', () => {
    it('should list all task resources with agent:// URI format', async () => {
      // Arrange
      (mockedFs.pathExists as unknown as jest.Mock).mockResolvedValue(true as never);
      (mockedFs.readdir as unknown as jest.Mock)
        .mockResolvedValueOnce(['senior-backend-engineer', 'qa-test-automation-engineer', '.archive'] as never) // comm dir
        .mockResolvedValueOnce(['2025-01-09T10-00-00-implement-feature', '2025-01-09T11-00-00-fix-bug'] as never) // senior-backend-engineer
        .mockResolvedValueOnce(['2025-01-09T12-00-00-write-tests'] as never); // qa-test-automation-engineer
      
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true } as never);
      
      // Mock file existence checks for status determination
      (mockedFs.pathExists as unknown as jest.Mock).mockImplementation(((path: unknown) => {
        const pathStr = path as string;
        if (pathStr.includes('2025-01-09T10-00-00-implement-feature/PLAN.md')) return Promise.resolve(true);
        if (pathStr.includes('2025-01-09T11-00-00-fix-bug/DONE.md')) return Promise.resolve(true);
        if (pathStr.includes('ERROR.md') || pathStr.includes('DONE.md') || pathStr.includes('PLAN.md')) return Promise.resolve(false);
        return Promise.resolve(true); // Default for directories
      }) as jest.Mock);

      // Act
      const resources = await provider.listResources();

      // Assert
      expect(resources).toHaveLength(3);
      expect(resources).toContainEqual(
        expect.objectContaining({
          uri: 'agent://senior-backend-engineer/tasks/2025-01-09T10-00-00-implement-feature',
          name: 'Task: implement-feature (PLAN)',
          mimeType: 'application/json',
          description: expect.stringContaining('senior-backend-engineer')
        })
      );
      expect(resources).toContainEqual(
        expect.objectContaining({
          uri: 'agent://senior-backend-engineer/tasks/2025-01-09T11-00-00-fix-bug',
          name: 'Task: fix-bug (DONE)',
          mimeType: 'application/json',
          description: expect.stringContaining('senior-backend-engineer')
        })
      );
      expect(resources).toContainEqual(
        expect.objectContaining({
          uri: 'agent://qa-test-automation-engineer/tasks/2025-01-09T12-00-00-write-tests',
          name: 'Task: write-tests (INIT)',
          mimeType: 'application/json',
          description: expect.stringContaining('qa-test-automation-engineer')
        })
      );
    });

    it('should handle empty task list gracefully', async () => {
      // Arrange
      (mockedFs.pathExists as unknown as jest.Mock).mockResolvedValue(true as never);
      (mockedFs.readdir as unknown as jest.Mock).mockResolvedValue(['.archive', '.logs'] as never); // Only hidden dirs

      // Act
      const resources = await provider.listResources();

      // Assert
      expect(resources).toEqual([]);
    });

    it('should include task metadata in resource description', async () => {
      // Arrange
      (mockedFs.pathExists as unknown as jest.Mock).mockResolvedValue(true as never);
      (mockedFs.readdir as unknown as jest.Mock)
        .mockResolvedValueOnce(['agent-1'] as never)
        .mockResolvedValueOnce(['2025-01-09T10-00-00-complex-task'] as never);
      
      (mockedFs.stat as unknown as jest.Mock).mockResolvedValue({ isDirectory: () => true } as never);
      
      // Mock PLAN.md exists
      (mockedFs.pathExists as unknown as jest.Mock).mockImplementation(((path: unknown) => {
        const pathStr = path as string;
        if (pathStr.includes('PLAN.md')) return Promise.resolve(true);
        if (pathStr.includes('ERROR.md') || pathStr.includes('DONE.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      }) as jest.Mock);

      // Act
      const resources = await provider.listResources();

      // Assert
      expect(resources[0].description).toContain('agent-1');
      expect(resources[0].description).toContain('PLAN');
    });

    it('should handle errors during listing', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      (mockedFs.pathExists as unknown as jest.Mock).mockRejectedValue(error as never);

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
      (mockTaskContextManager.getTaskContext as unknown as jest.Mock) = jest.fn().mockImplementation(((taskId: unknown, _connection: unknown) => {
        if (taskId === '2025-01-09T10-00-00-implement-feature') {
          return Promise.resolve(mockTaskContext);
        }
        return Promise.resolve(null);
      }) as jest.Mock);

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
      (mockTaskContextManager.getTaskContext as unknown as jest.Mock) = jest.fn().mockResolvedValue(null as never);

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
      
      (mockTaskContextManager.getTaskContext as unknown as jest.Mock) = jest.fn().mockResolvedValue({
        taskId: 'test',
        status: 'INIT'
      } as never);

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
        (mockTaskContextManager.getTaskContext as unknown as jest.Mock) = jest.fn().mockResolvedValue({
          context: { taskId: `task-${testCase.status}`, status: testCase.status },
          contextId: 'ctx-test'
        } as never);

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
      
      (mockTaskContextManager.getTaskContext as unknown as jest.Mock) = jest.fn().mockResolvedValue(mockContext as never);

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