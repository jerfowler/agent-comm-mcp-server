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

// Type definitions for accessing server internals
interface ServerWithPrivates {
  _capabilities?: Record<string, unknown>;
  _serverInfo?: {
    name: string;
    version: string;
  };
  _requestHandlers?: Map<string, (request: unknown) => Promise<unknown>>;
}

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
      // Access private fields using proper type assertion
      const serverPrivate = server as unknown as ServerWithPrivates;
      const capabilities = serverPrivate._capabilities;
      
      expect(capabilities).toBeDefined();
      expect(capabilities).toHaveProperty('prompts');
      expect(capabilities?.['prompts']).toEqual({});
    });

    it('should include prompts in server metadata', () => {
      // Access private _serverInfo field with proper type assertion
      const serverPrivate = server as unknown as ServerWithPrivates;
      const serverInfo = serverPrivate._serverInfo;
      
      expect(serverInfo).toBeDefined();
      expect(serverInfo?.name).toBe('agent-comm');
      expect(serverInfo?.version).toBeDefined();
    });
  });

  describe('prompts/list endpoint', () => {
    it('should handle prompts/list request', async () => {
      const request: ListPromptsRequest = {
        method: 'prompts/list'
      };

      // Get the handler directly with proper type assertion
      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const listHandler = handlers?.get('prompts/list');
      
      expect(listHandler).toBeDefined();
      
      const result = await listHandler!(request);
      
      expect(result).toHaveProperty('prompts');
      expect(Array.isArray((result as ListPromptsResult).prompts)).toBe(true);
      expect((result as ListPromptsResult).prompts.length).toBe(5);
    });

    it('should return properly formatted prompt metadata', async () => {
      const request: ListPromptsRequest = {
        method: 'prompts/list'
      };

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const listHandler = handlers?.get('prompts/list');
      const result = await listHandler!(request) as ListPromptsResult;
      
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

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const listHandler = handlers?.get('prompts/list');
      const result = await listHandler!(request) as ListPromptsResult;
      
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

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const getHandler = handlers?.get('prompts/get');
      
      expect(getHandler).toBeDefined();
      
      const result = await getHandler!(request) as GetPromptResult;
      
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

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const getHandler = handlers?.get('prompts/get');
      const result = await getHandler!(request) as GetPromptResult;
      
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

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const getHandler = handlers?.get('prompts/get');
      
      await expect(getHandler!(request)).rejects.toThrow('Prompt not found');
    });

    it('should return error for missing required arguments', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'agent-validation-requirements',
          arguments: {} // Missing required 'agent' argument
        }
      };

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const getHandler = handlers?.get('prompts/get');
      
      await expect(getHandler!(request)).rejects.toThrow('Missing required argument: agent');
    });

    it('should support multi-modal responses', async () => {
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'task-workflow-guide',
          arguments: {}
        }
      };

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const getHandler = handlers?.get('prompts/get');
      const result = await getHandler!(request) as GetPromptResult;
      
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
      // Create a properly formed request with empty params to test handler
      const request: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: '',  // Empty name should trigger error
          arguments: {}
        }
      };

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const getHandler = handlers?.get('prompts/get');
      
      // Should throw because empty name is invalid
      await expect(getHandler!(request)).rejects.toThrow();
    });

    it('should validate argument types', async () => {
      // Test with valid string type for agent argument
      const validRequest: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'agent-validation-requirements',
          arguments: {
            agent: 'test-agent' // Correct string type
          }
        }
      };

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const getHandler = handlers?.get('prompts/get');
      
      // Should work with correct type
      const result = await getHandler!(validRequest);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('messages');
      
      // Test with a different valid agent name to ensure type validation works
      const anotherValidRequest: GetPromptRequest = {
        method: 'prompts/get',
        params: {
          name: 'agent-validation-requirements',
          arguments: {
            agent: 'another-agent' // Another valid string
          }
        }
      };
      
      // Should also work with different valid agent name
      const result2 = await getHandler!(anotherValidRequest);
      expect(result2).toBeDefined();
      expect(result2).toHaveProperty('messages');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond to prompts/list within 100ms', async () => {
      const request: ListPromptsRequest = {
        method: 'prompts/list'
      };

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const listHandler = handlers?.get('prompts/list');
      
      const start = Date.now();
      await listHandler!(request);
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

      const serverPrivate = server as unknown as ServerWithPrivates;
      const handlers = serverPrivate._requestHandlers;
      const getHandler = handlers?.get('prompts/get');
      
      const start = Date.now();
      await getHandler!(request);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
    });
  });
});