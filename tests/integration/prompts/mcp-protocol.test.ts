/**
 * Integration tests for MCP 2025-06-18 specification compliance
 */

import { jest } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createMCPServer } from '../../../src/index.js';
import type { 
  ListPromptsRequest,
  ListPromptsResult,
  GetPromptRequest,
  GetPromptResult
} from '@modelcontextprotocol/sdk/types.js';

describe('MCP Protocol Compliance - Prompts', () => {
  let server: Server;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['AGENT_COMM_DIR'] = '/tmp/test-comm';
    process.env['AGENT_COMM_ARCHIVE_DIR'] = '/tmp/test-archive';
    process.env['AGENT_COMM_LOG_DIR'] = '/tmp/test-logs';
    
    // Create server but don't start transport
    server = createMCPServer();
  });

  afterEach(() => {
    delete process.env['AGENT_COMM_DIR'];
    delete process.env['AGENT_COMM_ARCHIVE_DIR'];
    delete process.env['AGENT_COMM_LOG_DIR'];
  });

  describe('Server Capabilities', () => {
    it('should declare prompts capability during initialization', () => {
      const serverInfo = (server as any).serverInfo;
      const capabilities = serverInfo.capabilities;
      
      expect(capabilities).toHaveProperty('prompts');
      expect(capabilities.prompts).toEqual({});
    });

    it('should include prompts in server metadata', () => {
      const serverInfo = (server as any).serverInfo;
      
      expect(serverInfo.name).toBe('agent-comm-mcp-server');
      expect(serverInfo.version).toBeDefined();
    });
  });

  describe('prompts/list endpoint', () => {
    it('should handle prompts/list request', async () => {
      const request: ListPromptsRequest = {
        method: 'prompts/list'
      };

      // Get the handler directly
      const handlers = (server as any)._requestHandlers;
      const listHandler = handlers.get('prompts/list');
      
      expect(listHandler).toBeDefined();
      
      const result = await listHandler(request);
      
      expect(result).toHaveProperty('prompts');
      expect(Array.isArray(result.prompts)).toBe(true);
      expect(result.prompts.length).toBe(5);
    });

    it('should return properly formatted prompt metadata', async () => {
      const request: ListPromptsRequest = {
        method: 'prompts/list'
      };

      const handlers = (server as any)._requestHandlers;
      const listHandler = handlers.get('prompts/list');
      const result: ListPromptsResult = await listHandler(request);
      
      const firstPrompt = result.prompts[0];
      expect(firstPrompt).toHaveProperty('name');
      expect(firstPrompt).toHaveProperty('description');
      expect(firstPrompt).toHaveProperty('arguments');
      
      // Verify MCP spec fields
      expect(typeof firstPrompt.name).toBe('string');
      expect(typeof firstPrompt.description).toBe('string');
      
      if (firstPrompt.arguments) {
        expect(Array.isArray(firstPrompt.arguments)).toBe(true);
        firstPrompt.arguments.forEach(arg => {
          expect(arg).toHaveProperty('name');
          expect(arg).toHaveProperty('description');
          expect(arg).toHaveProperty('required');
        });
      }
    });

    it('should include all 5 core prompts', async () => {
      const request: ListPromptsRequest = {
        method: 'prompts/list'
      };

      const handlers = (server as any)._requestHandlers;
      const listHandler = handlers.get('prompts/list');
      const result: ListPromptsResult = await listHandler(request);
      
      const promptNames = result.prompts.map(p => p.name);
      
      expect(promptNames).toContain('task-workflow-guide');
      expect(promptNames).toContain('agent-validation-requirements');
      expect(promptNames).toContain('flexible-task-operations');
      expect(promptNames).toContain('troubleshooting-common-errors');
      expect(promptNames).toContain('protocol-compliance-checklist');
    });
  });

  describe('prompts/get endpoint', () => {
    it('should handle prompts/get request with valid prompt', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'task-workflow-guide',
          arguments: {}
        }
      };

      const handlers = (server as any)._requestHandlers;
      const getHandler = handlers.get('prompts/get');
      
      expect(getHandler).toBeDefined();
      
      const result: GetPromptResult = await getHandler(request);
      
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('messages');
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('should pass arguments to prompt generation', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'task-workflow-guide',
          arguments: {
            agent: 'test-agent',
            taskId: 'task-123'
          }
        }
      };

      const handlers = (server as any)._requestHandlers;
      const getHandler = handlers.get('prompts/get');
      const result: GetPromptResult = await getHandler(request);
      
      // Content should be customized based on arguments
      const textMessage = result.messages.find(m => m.content.type === 'text');
      expect(textMessage).toBeDefined();
      
      if (textMessage && textMessage.content.type === 'text') {
        // Should contain agent-specific content
        expect(textMessage.content.text).toContain('test-agent');
      }
    });

    it('should return error for invalid prompt name', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'invalid-prompt',
          arguments: {}
        }
      };

      const handlers = (server as any)._requestHandlers;
      const getHandler = handlers.get('prompts/get');
      
      await expect(getHandler(request)).rejects.toThrow('Prompt not found');
    });

    it('should return error for missing required arguments', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'agent-validation-requirements',
          arguments: {} // Missing required 'agent' argument
        }
      };

      const handlers = (server as any)._requestHandlers;
      const getHandler = handlers.get('prompts/get');
      
      await expect(getHandler(request)).rejects.toThrow('Missing required argument: agent');
    });

    it('should support multi-modal responses', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'task-workflow-guide',
          arguments: {}
        }
      };

      const handlers = (server as any)._requestHandlers;
      const getHandler = handlers.get('prompts/get');
      const result: GetPromptResult = await getHandler(request);
      
      // Should have text content
      const textMessage = result.messages.find(m => m.content.type === 'text');
      expect(textMessage).toBeDefined();
      
      // Should have embedded resources
      const resourceMessage = result.messages.find(m => m.content.type === 'resource');
      expect(resourceMessage).toBeDefined();
      
      if (resourceMessage && resourceMessage.content.type === 'resource') {
        expect(resourceMessage.content.resource).toHaveProperty('uri');
        expect(resourceMessage.content.resource).toHaveProperty('mimeType');
        expect(resourceMessage.content.resource).toHaveProperty('text');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const request = {
        method: 'prompts/get',
        // Missing params
      } as any;

      const handlers = (server as any)._requestHandlers;
      const getHandler = handlers.get('prompts/get');
      
      await expect(getHandler(request)).rejects.toThrow();
    });

    it('should validate argument types', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'task-workflow-guide',
          arguments: {
            agent: 123 as any // Should be string
          }
        }
      };

      const handlers = (server as any)._requestHandlers;
      const getHandler = handlers.get('prompts/get');
      
      await expect(getHandler(request)).rejects.toThrow('Invalid argument type');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond to prompts/list within 100ms', async () => {
      const request: ListPromptsRequest = {
        method: 'prompts/list'
      };

      const handlers = (server as any)._requestHandlers;
      const listHandler = handlers.get('prompts/list');
      
      const start = Date.now();
      await listHandler(request);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });

    it('should generate prompt content within 100ms', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'task-workflow-guide',
          arguments: {}
        }
      };

      const handlers = (server as any)._requestHandlers;
      const getHandler = handlers.get('prompts/get');
      
      const start = Date.now();
      await getHandler(request);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });
  });
});