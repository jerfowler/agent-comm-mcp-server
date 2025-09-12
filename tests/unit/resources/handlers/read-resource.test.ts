/**
 * read-resource Handler Test Suite
 * Tests for MCP resources/read endpoint handler
 * Following MCP 2025-06-18 specification
 */

import { readResourceHandler } from '../../../../src/resources/handlers/read-resource.js';
import { ResourceManager } from '../../../../src/resources/ResourceManager.js';
import type { 
  ReadResourceRequest,
  ReadResourceResult 
} from '@modelcontextprotocol/sdk/types.js';
import { AgentCommError } from '../../../../src/types.js';

// Mock ResourceManager
jest.mock('../../../../src/resources/ResourceManager.js');

describe('readResourceHandler', () => {
  let mockResourceManager: jest.Mocked<ResourceManager>;
  let handler: ReturnType<typeof readResourceHandler>;

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
    
    // Create handler
    handler = readResourceHandler(mockResourceManager);
  });

  describe('resources/read request handling', () => {
    it('should read task resource content', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'agent://senior-backend-engineer/tasks/2025-01-09T10-00-00-implement-feature'
        }
      };
      
      const mockContent: ReadResourceResult = {
        contents: [
          {
            uri: 'agent://senior-backend-engineer/tasks/2025-01-09T10-00-00-implement-feature',
            mimeType: 'application/json',
            text: JSON.stringify({
              taskId: '2025-01-09T10-00-00-implement-feature',
              agent: 'senior-backend-engineer',
              status: 'PLAN',
              plan: '## Implementation Plan\n- [ ] Write tests\n- [ ] Implement feature'
            })
          }
        ]
      };
      
      mockResourceManager.readResource.mockResolvedValue(mockContent);

      // Act
      const result = await handler(request);

      // Assert
      expect(result).toEqual(mockContent);
      expect(mockResourceManager.readResource).toHaveBeenCalledWith(
        'agent://senior-backend-engineer/tasks/2025-01-09T10-00-00-implement-feature'
      );
    });

    it('should read server information resource', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'server://info'
        }
      };
      
      const mockContent: ReadResourceResult = {
        contents: [
          {
            uri: 'server://info',
            mimeType: 'application/json',
            text: JSON.stringify({
              name: 'agent-comm-mcp-server',
              version: '1.0.0',
              capabilities: {
                resources: {},
                tools: {},
                prompts: {}
              }
            })
          }
        ]
      };
      
      mockResourceManager.readResource.mockResolvedValue(mockContent);

      // Act
      const result = await handler(request);

      // Assert
      expect(result).toEqual(mockContent);
      expect(result.contents[0].mimeType).toBe('application/json');
    });

    it('should read server version resource as plain text', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'server://version'
        }
      };
      
      const mockContent: ReadResourceResult = {
        contents: [
          {
            uri: 'server://version',
            mimeType: 'text/plain',
            text: '1.0.0'
          }
        ]
      };
      
      mockResourceManager.readResource.mockResolvedValue(mockContent);

      // Act
      const result = await handler(request);

      // Assert
      expect(result).toEqual(mockContent);
      expect(result.contents[0].mimeType).toBe('text/plain');
      expect(result.contents[0].text).toBe('1.0.0');
    });

    it('should handle resource not found with MCP error', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'agent://nonexistent/tasks/invalid'
        }
      };
      
      mockResourceManager.readResource.mockRejectedValue(
        new AgentCommError('Resource not found', 'RESOURCE_NOT_FOUND')
      );

      // Act & Assert
      await expect(handler(request)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found'
      });
    });

    it('should validate URI parameter is provided', async () => {
      // Arrange
      const request = {
        method: 'resources/read',
        params: {}
      } as unknown as ReadResourceRequest;

      // Act & Assert
      await expect(handler(request)).rejects.toThrow('URI parameter is required');
    });

    it('should validate URI format', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'not-a-valid-uri'
        }
      };
      
      mockResourceManager.readResource.mockRejectedValue(
        new AgentCommError('Invalid resource URI', 'INVALID_PARAMS')
      );

      // Act & Assert
      await expect(handler(request)).rejects.toMatchObject({
        code: 'INVALID_PARAMS',
        message: 'Invalid resource URI'
      });
    });

    it('should validate request method', async () => {
      // Arrange
      const invalidRequest = {
        method: 'invalid/method',
        params: {
          uri: 'agent://agent-1/tasks/task-123'
        }
      } as unknown as ReadResourceRequest;

      // Act & Assert
      await expect(handler(invalidRequest)).rejects.toThrow('Invalid request method');
    });

    it('should handle binary content with base64 encoding', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'agent://agent-1/tasks/task-with-attachment'
        }
      };
      
      const mockContent: ReadResourceResult = {
        contents: [
          {
            uri: 'agent://agent-1/tasks/task-with-attachment',
            mimeType: 'application/pdf',
            blob: 'JVBERi0xLjQKJcfs...' // Base64 encoded PDF
          }
        ]
      };
      
      mockResourceManager.readResource.mockResolvedValue(mockContent);

      // Act
      const result = await handler(request);

      // Assert
      expect(result).toEqual(mockContent);
      expect(result.contents[0].blob).toBeDefined();
      expect(result.contents[0].text).toBeUndefined();
    });

    it('should handle multiple content items', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'agent://agent-1/tasks/task-with-multiple-files'
        }
      };
      
      const mockContent: ReadResourceResult = {
        contents: [
          {
            uri: 'agent://agent-1/tasks/task-with-multiple-files/plan.md',
            mimeType: 'text/markdown',
            text: '## Plan\n- Step 1\n- Step 2'
          },
          {
            uri: 'agent://agent-1/tasks/task-with-multiple-files/status.json',
            mimeType: 'application/json',
            text: '{"status": "PLAN"}'
          }
        ]
      };
      
      mockResourceManager.readResource.mockResolvedValue(mockContent);

      // Act
      const result = await handler(request);

      // Assert
      expect(result.contents).toHaveLength(2);
      expect(result.contents[0].mimeType).toBe('text/markdown');
      expect(result.contents[1].mimeType).toBe('application/json');
    });

    it('should handle agent status resource', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'agent://senior-backend-engineer/status'
        }
      };
      
      const mockContent: ReadResourceResult = {
        contents: [
          {
            uri: 'agent://senior-backend-engineer/status',
            mimeType: 'application/json',
            text: JSON.stringify({
              agent: 'senior-backend-engineer',
              connected: true,
              activeTask: '2025-01-09T10-00-00-implement-feature',
              lastActivity: '2025-01-09T12:00:00Z'
            })
          }
        ]
      };
      
      mockResourceManager.readResource.mockResolvedValue(mockContent);

      // Act
      const result = await handler(request);

      // Assert
      expect(result).toEqual(mockContent);
      const status = JSON.parse(result.contents[0].text as string);
      expect(status.agent).toBe('senior-backend-engineer');
      expect(status.connected).toBe(true);
    });

    it('should handle server capabilities resource', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'server://capabilities'
        }
      };
      
      const mockContent: ReadResourceResult = {
        contents: [
          {
            uri: 'server://capabilities',
            mimeType: 'application/json',
            text: JSON.stringify({
              resources: {
                listResources: true,
                readResource: true
              },
              tools: {
                listTools: true,
                callTool: true
              },
              prompts: {
                listPrompts: true,
                getPrompt: true
              }
            })
          }
        ]
      };
      
      mockResourceManager.readResource.mockResolvedValue(mockContent);

      // Act
      const result = await handler(request);

      // Assert
      const capabilities = JSON.parse(result.contents[0].text as string);
      expect(capabilities).toHaveProperty('resources');
      expect(capabilities).toHaveProperty('tools');
      expect(capabilities).toHaveProperty('prompts');
    });
  });

  describe('error handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'agent://agent-1/tasks/task-123'
        }
      };
      
      const error = new Error('Unexpected error occurred');
      mockResourceManager.readResource.mockRejectedValue(error);

      // Act & Assert
      await expect(handler(request)).rejects.toThrow(AgentCommError);
      await expect(handler(request)).rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining('Failed to read resource')
      });
    });

    it('should preserve original error codes', async () => {
      // Arrange
      const request: ReadResourceRequest = {
        method: 'resources/read',
        params: {
          uri: 'agent://agent-1/tasks/task-123'
        }
      };
      
      const customError = new AgentCommError('Permission denied', 'PERMISSION_DENIED');
      mockResourceManager.readResource.mockRejectedValue(customError);

      // Act & Assert
      await expect(handler(request)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
        message: 'Permission denied'
      });
    });
  });
});