/**
 * list-resources Handler Test Suite
 * Tests for MCP resources/list endpoint handler
 * Following MCP 2025-06-18 specification
 */

import { listResourcesHandler } from '../../../../src/resources/handlers/list-resources.js';
import { ResourceManager } from '../../../../src/resources/ResourceManager.js';
import type { 
  ListResourcesRequest,
  ListResourcesResult 
} from '@modelcontextprotocol/sdk/types.js';
import { AgentCommError } from '../../../../src/types.js';

// Mock ResourceManager
jest.mock('../../../../src/resources/ResourceManager.js');

describe('listResourcesHandler', () => {
  let mockResourceManager: jest.Mocked<ResourceManager>;
  let handler: ReturnType<typeof listResourcesHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock
    mockResourceManager = {
      listResources: jest.fn(),
      readResource: jest.fn(),
      registerProvider: jest.fn(),
      getResourceMetadata: jest.fn(),
      searchResources: jest.fn()
    } as unknown as jest.Mocked<ResourceManager>;
    } as any;
    
    // Create handler
    handler = listResourcesHandler(mockResourceManager);
  });

  describe('resources/list request handling', () => {
    it('should handle list request without cursor', async () => {
      // Arrange
      const request: ListResourcesRequest = {
        method: 'resources/list',
        params: {}
      };
      
      const mockResources: ListResourcesResult = {
        resources: [
          {
            uri: 'agent://agent-1/tasks/task-123',
            name: 'Task 123',
            mimeType: 'application/json',
            description: 'A test task'
          },
          {
            uri: 'server://info',
            name: 'Server Information',
            mimeType: 'application/json'
          }
        ]
      };
      
      mockResourceManager.listResources.mockResolvedValue(mockResources);

      // Act
      const result = await handler(request);

      // Assert
      expect(result).toEqual(mockResources);
      expect(mockResourceManager.listResources).toHaveBeenCalledWith({});
    });

    it('should handle list request with cursor', async () => {
      // Arrange
      const request: ListResourcesRequest = {
        method: 'resources/list',
        params: {
          cursor: 'eyJvZmZzZXQiOjIwfQ=='
        }
      };
      
      const mockResources: ListResourcesResult = {
        resources: [
          {
            uri: 'agent://agent-2/tasks/task-456',
            name: 'Task 456',
            mimeType: 'application/json'
          }
        ],
        nextCursor: 'eyJvZmZzZXQiOjQwfQ=='
      };
      
      mockResourceManager.listResources.mockResolvedValue(mockResources);

      // Act
      const result = await handler(request);

      // Assert
      expect(result).toEqual(mockResources);
      expect(mockResourceManager.listResources).toHaveBeenCalledWith({
        cursor: 'eyJvZmZzZXQiOjIwfQ=='
      });
    });

    it('should return empty list when no resources available', async () => {
      // Arrange
      const request: ListResourcesRequest = {
        method: 'resources/list',
        params: {}
      };
      
      const emptyResult: ListResourcesResult = {
        resources: []
      };
      
      mockResourceManager.listResources.mockResolvedValue(emptyResult);

      // Act
      const result = await handler(request);

      // Assert
      expect(result).toEqual(emptyResult);
      expect(result.resources).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const firstRequest: ListResourcesRequest = {
        method: 'resources/list',
        params: {}
      };
      
      const firstPage: ListResourcesResult = {
        resources: Array.from({ length: 20 }, (_, i) => ({
          uri: `agent://agent-1/tasks/task-${i}`,
          name: `Task ${i}`,
          mimeType: 'application/json'
        })),
        nextCursor: 'page-2-cursor'
      };
      
      const secondRequest: ListResourcesRequest = {
        method: 'resources/list',
        params: {
          cursor: 'page-2-cursor'
        }
      };
      
      const secondPage: ListResourcesResult = {
        resources: Array.from({ length: 10 }, (_, i) => ({
          uri: `agent://agent-1/tasks/task-${i + 20}`,
          name: `Task ${i + 20}`,
          mimeType: 'application/json'
        }))
      };
      
      mockResourceManager.listResources
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage);

      // Act
      const result1 = await handler(firstRequest);
      const result2 = await handler(secondRequest);

      // Assert
      expect(result1.resources).toHaveLength(20);
      expect(result1.nextCursor).toBe('page-2-cursor');
      expect(result2.resources).toHaveLength(10);
      expect(result2.nextCursor).toBeUndefined();
    });

    it('should handle errors with proper MCP error format', async () => {
      // Arrange
      const request: ListResourcesRequest = {
        method: 'resources/list',
        params: {}
      };
      
      const error = new Error('Database connection failed');
      mockResourceManager.listResources.mockRejectedValue(error);

      // Act & Assert
      await expect(handler(request)).rejects.toThrow(AgentCommError);
      await expect(handler(request)).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('Failed to list resources')
      });
    });

    it('should validate request method', async () => {
      // Arrange
      const invalidRequest = {
        method: 'invalid/method',
        params: {}
      } as unknown as ListResourcesRequest;
      } as any;

      // Act & Assert
      await expect(handler(invalidRequest)).rejects.toThrow('Invalid request method');
    });

    it('should handle invalid cursor gracefully', async () => {
      // Arrange
      const request: ListResourcesRequest = {
        method: 'resources/list',
        params: {
          cursor: 'invalid-cursor-!@#$'
        }
      };
      
      mockResourceManager.listResources.mockRejectedValue(
        new AgentCommError('Invalid cursor format', 'INVALID_PARAMS')
      );

      // Act & Assert
      await expect(handler(request)).rejects.toMatchObject({
        code: 'INVALID_PARAMS',
        message: 'Invalid cursor format'
      });
    });
  });

  describe('resource format validation', () => {
    it('should ensure all resources have required fields', async () => {
      // Arrange
      const request: ListResourcesRequest = {
        method: 'resources/list',
        params: {}
      };
      
      const mockResources: ListResourcesResult = {
        resources: [
          {
            uri: 'agent://agent-1/tasks/task-123',
            name: 'Task 123',
            mimeType: 'application/json',
            description: 'Task description'
          },
          {
            uri: 'server://version',
            name: 'Server Version',
            mimeType: 'text/plain'
            // description is optional
          }
        ]
      };
      
      mockResourceManager.listResources.mockResolvedValue(mockResources);

      // Act
      const result = await handler(request);

      // Assert
      result.resources.forEach(resource => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('mimeType');
        expect(typeof resource.uri).toBe('string');
        expect(typeof resource.name).toBe('string');
        expect(typeof resource.mimeType).toBe('string');
      });
    });

    it('should handle resources with metadata', async () => {
      // Arrange
      const request: ListResourcesRequest = {
        method: 'resources/list',
        params: {}
      };
      
      const mockResources: ListResourcesResult = {
        resources: [
          {
            uri: 'agent://agent-1/tasks/task-123',
            name: 'Task 123',
            mimeType: 'application/json',
            description: 'Task with metadata',
            metadata: {
              status: 'PLAN',
              createdAt: '2025-01-09T10:00:00Z',
              size: 1024
            }
          }
        ]
      };
      
      mockResourceManager.listResources.mockResolvedValue(mockResources);

      // Act
      const result = await handler(request);

      // Assert
      expect(result.resources[0]['metadata']).toBeDefined();
      expect(result.resources[0]['metadata']).toMatchObject({
        status: 'PLAN',
        createdAt: '2025-01-09T10:00:00Z',
        size: 1024
      });
    });
  });
});