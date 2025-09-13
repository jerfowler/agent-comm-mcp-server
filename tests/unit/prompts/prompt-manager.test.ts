/**
 * Tests for PromptManager - Core prompt management system
 */

import { jest } from '@jest/globals';
import { PromptManager } from '../../../src/prompts/PromptManager.js';
import { DynamicPromptEngine } from '../../../src/prompts/DynamicPromptEngine.js';
import { ServerConfig } from '../../../src/types.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import type { 
  PromptContent
} from '../../../src/prompts/types.js';

// Mock dependencies
jest.mock('../../../src/prompts/DynamicPromptEngine.js');
jest.mock('../../../src/core/ConnectionManager.js');
jest.mock('../../../src/logging/EventLogger.js');

describe('PromptManager', () => {
  let promptManager: PromptManager;
  let mockConfig: ServerConfig;
  let mockEngine: jest.Mocked<DynamicPromptEngine>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock config
    mockConfig = {
      commDir: '/test/comm',
      archiveDir: '/test/archive',
      logDir: '/test/logs',
      enableArchiving: true,
      connectionManager: new ConnectionManager() as jest.Mocked<ConnectionManager>,
      eventLogger: new EventLogger('/test/logs') as jest.Mocked<EventLogger>
    };

    // Create mock engine
    mockEngine = new DynamicPromptEngine(mockConfig) as jest.Mocked<DynamicPromptEngine>;
    
    // Create prompt manager
    promptManager = new PromptManager(mockConfig);
    // Replace engine with mock
    (promptManager as unknown as { engine: typeof mockEngine }).engine = mockEngine;
  });

  describe('listPrompts', () => {
    it('should return all available prompts with metadata', async () => {
      const result = await promptManager.listPrompts();
      
      expect(result).toHaveProperty('prompts');
      expect(Array.isArray(result.prompts)).toBe(true);
      expect(result.prompts.length).toBe(5); // We have 5 core prompts
      
      // Check first prompt structure
      const firstPrompt = result.prompts[0];
      expect(firstPrompt).toHaveProperty('name');
      expect(firstPrompt).toHaveProperty('description');
      expect(firstPrompt).toHaveProperty('arguments');
      
      // Verify all 5 core prompts are present
      const promptNames = result.prompts.map(p => p.name);
      expect(promptNames).toContain('task-workflow-guide');
      expect(promptNames).toContain('agent-validation-requirements');
      expect(promptNames).toContain('flexible-task-operations');
      expect(promptNames).toContain('troubleshooting-common-errors');
      expect(promptNames).toContain('protocol-compliance-checklist');
    });

    it('should include proper argument definitions', async () => {
      const result = await promptManager.listPrompts();
      
      const workflowGuide = result.prompts.find(p => p.name === 'task-workflow-guide');
      expect(workflowGuide).toBeDefined();
      expect(workflowGuide!.arguments).toBeDefined();
      
      // Should have agent argument
      const agentArg = workflowGuide!.arguments!.find(a => a.name === 'agent');
      expect(agentArg).toBeDefined();
      expect(agentArg!.description).toContain('agent');
      expect(agentArg!.required).toBe(false); // Optional
    });

    it('should log operation to EventLogger', async () => {
      const mockLogOperation = jest.fn();
      (mockConfig.eventLogger.logOperation as unknown) = mockLogOperation;
      
      await promptManager.listPrompts();
      
      expect(mockLogOperation).toHaveBeenCalledWith(
        'prompts_list',
        'system',
        expect.objectContaining({
          timestamp: expect.any(String),
          promptCount: 5
        })
      );
    });
  });

  describe('getPrompt', () => {
    it('should return prompt content for valid prompt name', async () => {
      const mockContent: PromptContent = {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Test prompt content'
            }
          }
        ]
      };
      
      mockEngine.generatePromptContent.mockResolvedValue(mockContent);
      
      const result = await promptManager.getPrompt('task-workflow-guide', {});
      
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('messages');
      expect(result.messages).toEqual(mockContent.messages);
      expect(mockEngine.generatePromptContent).toHaveBeenCalledWith('task-workflow-guide', {});
    });

    it('should pass arguments to dynamic engine', async () => {
      const mockContent: PromptContent = {
        messages: [
          {
            role: 'user', 
            content: {
              type: 'text',
              text: 'Agent-specific content'
            }
          }
        ]
      };
      
      mockEngine.generatePromptContent.mockResolvedValue(mockContent);
      
      const args = { agent: 'test-agent', taskId: 'task-123' };
      await promptManager.getPrompt('task-workflow-guide', args);
      
      expect(mockEngine.generatePromptContent).toHaveBeenCalledWith('task-workflow-guide', args);
    });

    it('should throw error for invalid prompt name', async () => {
      await expect(
        promptManager.getPrompt('invalid-prompt', {})
      ).rejects.toThrow('Prompt not found: invalid-prompt');
    });

    it('should validate required arguments', async () => {
      // For a prompt that requires arguments
      await expect(
        promptManager.getPrompt('agent-validation-requirements', {})
      ).rejects.toThrow('Missing required argument: agent');
    });

    it('should log operation to EventLogger', async () => {
      const mockLogOperation = jest.fn();
      (mockConfig.eventLogger.logOperation as unknown) = mockLogOperation;
      
      const mockContent: PromptContent = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Test' }
        }]
      };
      mockEngine.generatePromptContent.mockResolvedValue(mockContent);
      
      await promptManager.getPrompt('task-workflow-guide', { agent: 'test' });
      
      expect(mockLogOperation).toHaveBeenCalledWith(
        'prompts_get',
        'system',
        expect.objectContaining({
          timestamp: expect.any(String),
          promptName: 'task-workflow-guide',
          arguments: { agent: 'test' }
        })
      );
    });

    it('should handle multi-modal content with embedded resources', async () => {
      const mockContent: PromptContent = {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Here is the workflow guide with examples:'
            }
          },
          {
            role: 'user',
            content: {
              type: 'resource',
              resource: {
                uri: 'file:///examples/workflow.md',
                mimeType: 'text/markdown',
                text: '# Example Workflow\n\n1. Create task\n2. Submit plan'
              }
            }
          }
        ]
      };
      
      mockEngine.generatePromptContent.mockResolvedValue(mockContent);
      
      const result = await promptManager.getPrompt('task-workflow-guide', {});
      
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].content.type).toBe('resource');
    });
  });

  describe('prompt metadata', () => {
    it('should provide comprehensive metadata for task-workflow-guide', async () => {
      const result = await promptManager.listPrompts();
      const prompt = result.prompts.find(p => p.name === 'task-workflow-guide');
      
      expect(prompt).toBeDefined();
      expect(prompt!.description).toContain('workflow');
      expect(prompt!.arguments).toBeDefined();
      expect(prompt!.arguments!.some(a => a.name === 'agent')).toBe(true);
      expect(prompt!.arguments!.some(a => a.name === 'taskId')).toBe(true);
    });

    it('should provide metadata for agent-validation-requirements', async () => {
      const result = await promptManager.listPrompts();
      const prompt = result.prompts.find(p => p.name === 'agent-validation-requirements');
      
      expect(prompt).toBeDefined();
      expect(prompt!.description).toContain('validation');
      expect(prompt!.arguments).toBeDefined();
      expect(prompt!.arguments!.some(a => a.name === 'agent' && a.required === true)).toBe(true);
    });

    it('should provide metadata for flexible-task-operations', async () => {
      const result = await promptManager.listPrompts();
      const prompt = result.prompts.find(p => p.name === 'flexible-task-operations');
      
      expect(prompt).toBeDefined();
      expect(prompt!.description).toContain('multiple tasks');
    });

    it('should provide metadata for troubleshooting-common-errors', async () => {
      const result = await promptManager.listPrompts();
      const prompt = result.prompts.find(p => p.name === 'troubleshooting-common-errors');
      
      expect(prompt).toBeDefined();
      expect(prompt!.description).toContain('error');
      expect(prompt!.arguments!.some(a => a.name === 'errorType')).toBe(true);
    });

    it('should provide metadata for protocol-compliance-checklist', async () => {
      const result = await promptManager.listPrompts();
      const prompt = result.prompts.find(p => p.name === 'protocol-compliance-checklist');
      
      expect(prompt).toBeDefined();
      expect(prompt!.description).toContain('compliance');
    });
  });

  describe('error handling', () => {
    it('should handle dynamic engine errors gracefully', async () => {
      mockEngine.generatePromptContent.mockRejectedValue(new Error('Engine failure'));
      
      await expect(
        promptManager.getPrompt('task-workflow-guide', {})
      ).rejects.toThrow('Failed to generate prompt content: Engine failure');
    });

    it('should validate argument types', async () => {
      await expect(
        promptManager.getPrompt('task-workflow-guide', { agent: 123 as unknown })
      ).rejects.toThrow('Invalid argument type for agent: expected string');
    });

    it('should handle missing optional arguments', async () => {
      const mockContent: PromptContent = {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Generic content' }
        }]
      };
      
      mockEngine.generatePromptContent.mockResolvedValue(mockContent);
      
      // Should not throw - taskId is optional
      const result = await promptManager.getPrompt('task-workflow-guide', { agent: 'test' });
      expect(result).toBeDefined();
    });
  });
});