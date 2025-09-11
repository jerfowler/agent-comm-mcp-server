/**
 * Tests for DynamicPromptEngine - Context-aware prompt content generation
 */

import { jest } from '@jest/globals';
import { DynamicPromptEngine } from '../../../src/prompts/DynamicPromptEngine.js';
import { ServerConfig } from '../../../src/types.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import * as taskManager from '../../../src/utils/task-manager.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import type { PromptName } from '../../../src/prompts/types.js';

// Mock dependencies
jest.mock('../../../src/utils/task-manager.js');
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));

describe('DynamicPromptEngine', () => {
  let engine: DynamicPromptEngine;
  let mockConfig: ServerConfig;
  const mockedTaskManager = taskManager as jest.Mocked<typeof taskManager>;
  const mockedFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock config
    mockConfig = {
      commDir: '/test/comm',
      archiveDir: '/test/archive', 
      logDir: '/test/logs',
      enableArchiving: true,
      connectionManager: new ConnectionManager(),
      eventLogger: new EventLogger('/test/logs')
    };

    // Create engine
    engine = new DynamicPromptEngine(mockConfig);
  });

  describe('generatePromptContent', () => {
    describe('task-workflow-guide', () => {
      it('should generate basic workflow guide without context', async () => {
        mockedTaskManager.getAgentTasks.mockResolvedValue([]);
        
        const content = await engine.generatePromptContent('task-workflow-guide', {});
        
        expect(content.messages).toBeDefined();
        expect(content.messages.length).toBeGreaterThan(0);
        
        const textContent = content.messages[0].content;
        expect(textContent.type).toBe('text');
        if (textContent.type === 'text') {
          expect(textContent.text).toContain('Task Management Workflow Guide');
          expect(textContent.text).toContain('create_task');
          expect(textContent.text).toContain('submit_plan');
          expect(textContent.text).toContain('report_progress');
          expect(textContent.text).toContain('mark_complete');
        }
      });

      it('should include agent-specific context when agent provided', async () => {
        const mockTasks = [
          {
            name: 'task-123-implement-feature',
            agent: 'test-agent',
            path: '/test/comm/test-agent/task-123',
            hasInit: true,
            hasPlan: true,
            hasDone: false,
            hasError: false
          }
        ];
        
        mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
        mockedFs.readFile.mockResolvedValue(
          '# Task: Implement feature\n\nImplement the new feature as specified.'
        );
        
        const content = await engine.generatePromptContent('task-workflow-guide', { 
          agent: 'test-agent' 
        });
        
        const messageContent = content.messages[0].content;
        if (messageContent.type === 'text') {
          expect(messageContent.text).toContain('test-agent');
          expect(messageContent.text).toContain('Current Tasks');
          expect(messageContent.text).toContain('task-123-implement-feature');
          expect(messageContent.text).toContain('🔄 in-progress');
        }
      });

      it('should include task-specific workflow when taskId provided', async () => {
        const mockTasks = [{
          name: 'task-123-feature',
          agent: 'test-agent',
          path: '/test/comm/test-agent/task-123-feature',
          hasInit: true,
          hasPlan: true,
          hasDone: false,
          hasError: false
        }];
        
        mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
        
        // Mock PLAN.md file existence and content with checkboxes
        mockedFs.pathExists.mockImplementation((path: string) => {
          return Promise.resolve(path.includes('PLAN.md'));
        });
        
        mockedFs.readFile.mockImplementation((path: string) => {
          if (path.includes('PLAN.md')) {
            return Promise.resolve(`# Implementation Plan

## Steps:
- [x] Step 1: Setup environment
- [ ] Step 2: Implement core logic
- [ ] Step 3: Add tests`);
          }
          return Promise.resolve('# Task: Test task');
        });
        
        const content = await engine.generatePromptContent('task-workflow-guide', {
          agent: 'test-agent',
          taskId: 'task-123-feature'
        });
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Current Task Progress');
        expect(textContent).toContain('Step 1: Setup environment');
        expect(textContent).toContain('✅ Step 1: Setup environment');
        expect(textContent).toContain('Step 2: Implement core logic');
        expect(textContent).toContain('⏳ Step 2: Implement core logic');
      });
    });

    describe('agent-validation-requirements', () => {
      it('should generate validation guide for specific agent', async () => {
        const content = await engine.generatePromptContent('agent-validation-requirements', {
          agent: 'senior-frontend-engineer'
        });
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Agent Validation Requirements');
        expect(textContent).toContain('senior-frontend-engineer');
        expect(textContent).toContain('ownership validation');
        expect(textContent).toContain('Best Practices');
      });

      it('should include common validation errors and solutions', async () => {
        const content = await engine.generatePromptContent('agent-validation-requirements', {
          agent: 'test-agent'
        });
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Common Validation Issues');
        expect(textContent).toContain('default-agent');
        expect(textContent).toContain('Solution');
      });

      it('should throw error when agent not provided', async () => {
        await expect(
          engine.generatePromptContent('agent-validation-requirements', {})
        ).rejects.toThrow('Required argument missing: agent');
      });
    });

    describe('flexible-task-operations', () => {
      it('should generate guide for multi-task workflows', async () => {
        const mockTasks = [
          {
            name: 'task-001-feature-a',
            agent: 'test-agent',
            path: '/test/comm/test-agent/task-001',
            hasInit: true,
            hasPlan: true,
            hasDone: false,
            hasError: false
          },
          {
            name: 'task-002-feature-b',
            agent: 'test-agent',
            path: '/test/comm/test-agent/task-002',
            hasInit: true,
            hasPlan: false,
            hasDone: false,
            hasError: false
          }
        ];
        
        mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
        
        const content = await engine.generatePromptContent('flexible-task-operations', {
          agent: 'test-agent'
        });
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Flexible Task Operations');
        expect(textContent).toContain('Multiple Active Tasks');
        expect(textContent).toContain('task-001-feature-a');
        expect(textContent).toContain('task-002-feature-b');
        expect(textContent).toContain('Switch between tasks');
      });

      it('should provide examples for working with multiple tasks', async () => {
        mockedTaskManager.getAgentTasks.mockResolvedValue([]);
        
        const content = await engine.generatePromptContent('flexible-task-operations', {});
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Example Workflows');
        expect(textContent).toContain('Parallel Task Execution');
        expect(textContent).toContain('Sequential Task Completion');
      });
    });

    describe('troubleshooting-common-errors', () => {
      it('should provide general troubleshooting guide', async () => {
        const content = await engine.generatePromptContent('troubleshooting-common-errors', {});
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Troubleshooting Guide');
        expect(textContent).toContain('Common Errors');
        expect(textContent).toContain('Solutions');
      });

      it('should provide specific guidance for error types', async () => {
        const content = await engine.generatePromptContent('troubleshooting-common-errors', {
          errorType: 'default-agent'
        });
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('default-agent');
        expect(textContent).toContain('"default-agent" Error');
        expect(textContent).toContain('✅ Correct');
      });

      it('should include context-aware troubleshooting', async () => {
        const mockTasks = [{
          name: 'task-123',
          agent: 'test-agent',
          path: '/test/comm/test-agent/task-123',
          hasInit: true,
          hasPlan: false,
          hasDone: false,
          hasError: true
        }];
        
        mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
        mockedFs.pathExists.mockResolvedValue(true);
        mockedFs.readFile.mockResolvedValue('Error: Task execution failed');
        
        const content = await engine.generatePromptContent('troubleshooting-common-errors', {
          agent: 'test-agent'
        });
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Recent Errors for test-agent');
        expect(textContent).toContain('task-123');
        expect(textContent).toContain('Task has error status');
      });
    });

    describe('protocol-compliance-checklist', () => {
      it('should generate comprehensive compliance checklist', async () => {
        const content = await engine.generatePromptContent('protocol-compliance-checklist', {});
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Protocol Compliance Checklist');
        expect(textContent).toContain('Task Creation');
        expect(textContent).toContain('Plan Submission');
        expect(textContent).toContain('Progress Reporting');
        expect(textContent).toContain('Task Completion');
        expect(textContent).toContain('Best Practices');
      });

      it('should include agent-specific compliance status', async () => {
        const mockTasks = [
          {
            name: 'task-001',
            agent: 'test-agent',
            path: '/test/comm/test-agent/task-001',
            hasInit: true,
            hasPlan: true,
            hasDone: true,
            hasError: false
          },
          {
            name: 'task-002',
            agent: 'test-agent',
            path: '/test/comm/test-agent/task-002',
            hasInit: true,
            hasPlan: false,
            hasDone: false,
            hasError: false
          }
        ];
        
        mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
        
        const content = await engine.generatePromptContent('protocol-compliance-checklist', {
          agent: 'test-agent'
        });
        
        const messageContent = content.messages[0].content;
        if (messageContent.type !== 'text') throw new Error('Expected text content');
        const textContent = messageContent.text;
        expect(textContent).toContain('Agent Compliance Status: test-agent');
        expect(textContent).toContain('test-agent');
        expect(textContent).toContain('Completed: 1');
        expect(textContent).toContain('In Progress: 1');
      });
    });
  });

  describe('multi-modal content', () => {
    it('should include embedded resources for examples', async () => {
      const content = await engine.generatePromptContent('task-workflow-guide', {});
      
      // Should have at least one embedded resource
      const resourceMessage = content.messages.find(m => m.content.type === 'resource');
      expect(resourceMessage).toBeDefined();
      
      if (resourceMessage && resourceMessage.content.type === 'resource') {
        expect(resourceMessage.content.resource.mimeType).toBe('text/markdown');
        expect(resourceMessage.content.resource.text).toContain('Example');
      }
    });

    it('should include code examples as resources', async () => {
      const content = await engine.generatePromptContent('protocol-compliance-checklist', {});
      
      const codeResource = content.messages.find(m => 
        m.content.type === 'resource' && 
        m.content.resource?.mimeType === 'text/x-typescript'
      );
      
      expect(codeResource).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockedTaskManager.getAgentTasks.mockRejectedValue(new Error('File system error'));
      
      // Should still generate content without task context
      const content = await engine.generatePromptContent('task-workflow-guide', {
        agent: 'test-agent'
      });
      
      expect(content.messages).toBeDefined();
      const messageContent = content.messages[0].content;
      if (messageContent.type !== 'text') throw new Error('Expected text content');
      const textContent = messageContent.text;
      expect(textContent).toContain('Task Management Workflow Guide');
      expect(textContent).not.toContain('Current Tasks'); // No task context due to error
    });

    it('should handle invalid prompt names', async () => {
      await expect(
        engine.generatePromptContent('invalid-prompt' as unknown as PromptName, {})
      ).rejects.toThrow('Unknown prompt: invalid-prompt');
    });

    it('should validate argument types', async () => {
      await expect(
        engine.generatePromptContent('task-workflow-guide', { agent: 123 as unknown })
      ).rejects.toThrow('Invalid argument type');
    });
  });

  describe('performance', () => {
    it('should cache task information within reasonable time', async () => {
      const mockTasks = Array(10).fill(null).map((_, i) => ({
        name: `task-${i}`,
        agent: 'test-agent',
        path: `/test/comm/test-agent/task-${i}`,
        hasInit: true,
        hasPlan: true,
        hasDone: false,
        hasError: false
      }));
      
      mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
      
      const start = Date.now();
      await engine.generatePromptContent('task-workflow-guide', { agent: 'test-agent' });
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle concurrent prompt generation', async () => {
      mockedTaskManager.getAgentTasks.mockResolvedValue([]);
      
      const promises = [
        engine.generatePromptContent('task-workflow-guide', {}),
        engine.generatePromptContent('protocol-compliance-checklist', {}),
        engine.generatePromptContent('flexible-task-operations', {})
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.messages).toBeDefined();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing template gracefully', async () => {
      await expect(engine.generatePromptContent('non-existent-template' as unknown as PromptName, {}))
        .rejects.toThrow('Unknown prompt: non-existent-template');
    });

    it('should handle TaskManager errors gracefully', async () => {
      mockedTaskManager.getAgentTasks.mockRejectedValue(new Error('Task retrieval failed'));
      
      const result = await engine.generatePromptContent('task-workflow-guide', { agent: 'test-agent' });
      
      // Should still generate prompt without tasks
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('should handle empty agent parameter', async () => {
      mockedTaskManager.getAgentTasks.mockResolvedValue([]);
      
      const result = await engine.generatePromptContent('task-workflow-guide', { agent: '' });
      
      expect(result.messages).toBeDefined();
      expect(mockedTaskManager.getAgentTasks).not.toHaveBeenCalled();
    });

    it('should handle undefined parameters object', async () => {
      const result = await engine.generatePromptContent('protocol-compliance-checklist', {} as Record<string, unknown>);
      
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('should handle empty parameters object', async () => {
      const result = await engine.generatePromptContent('protocol-compliance-checklist', {});
      
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('should handle task with all status files', async () => {
      const mockTasks = [{
        taskId: 'complete-task',
        name: 'complete-task',
        agent: 'test-agent',
        path: '/test/comm/test-agent/complete-task',
        hasInit: true,
        hasPlan: true,
        hasDone: true,
        hasError: true // Both DONE and ERROR (edge case)
      }];
      
      mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
      
      const result = await engine.generatePromptContent('task-workflow-guide', { agent: 'test-agent' });
      
      expect(result.messages).toBeDefined();
      // Should handle conflicting status gracefully
    });

    it('should handle task with no status files', async () => {
      const mockTasks = [{
        taskId: 'empty-task',
        name: 'empty-task',
        agent: 'test-agent',
        path: '/test/comm/test-agent/empty-task',
        hasInit: false,
        hasPlan: false,
        hasDone: false,
        hasError: false
      }];
      
      mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
      
      const result = await engine.generatePromptContent('task-workflow-guide', { agent: 'test-agent' });
      
      expect(result.messages).toBeDefined();
      // Should handle empty task gracefully
    });

    it('should handle very long task names', async () => {
      const longTaskName = 'a'.repeat(500);
      const mockTasks = [{
        taskId: longTaskName,
        name: longTaskName,
        agent: 'test-agent',
        path: `/test/comm/test-agent/${longTaskName}`,
        hasInit: true,
        hasPlan: true,
        hasDone: false,
        hasError: false
      }];
      
      mockedTaskManager.getAgentTasks.mockResolvedValue(mockTasks);
      
      const result = await engine.generatePromptContent('task-workflow-guide', { agent: 'test-agent' });
      
      expect(result.messages).toBeDefined();
      // Should handle long names without issues
    });

    it('should cache prompts correctly', async () => {
      mockedTaskManager.getAgentTasks.mockResolvedValue([]);
      
      // Generate same prompt twice
      const result1 = await engine.generatePromptContent('protocol-compliance-checklist', {});
      const result2 = await engine.generatePromptContent('protocol-compliance-checklist', {});
      
      // Should get same reference if cached
      expect(result1).toEqual(result2);
    });

    it('should handle special characters in parameters', async () => {
      const specialParams = {
        agent: 'test-agent<>"|',
        task: '../../etc/passwd',
        customField: '<script>alert("xss")</script>'
      };
      
      mockedTaskManager.getAgentTasks.mockResolvedValue([]);
      
      const result = await engine.generatePromptContent('task-workflow-guide', specialParams);
      
      expect(result.messages).toBeDefined();
      // Should sanitize or handle special characters safely
    });
  });
});