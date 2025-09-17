/**
 * Tests for delegation templates
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateTaskToolInvocation,
  generateSimpleTaskCommand,
  generateDelegationChecklist,
  generateDelegationReminder,
  generateTwoPhaseExplanation,
  generateDelegationSuccess,
  generateDelegationExample,
  validateTaskToolCommand
} from '../../../src/core/delegation-templates.js';

describe('Delegation Templates', () => {
  describe('generateTaskToolInvocation', () => {
    it('should generate valid Task tool invocation', () => {
      const result = generateTaskToolInvocation(
        'senior-backend-engineer',
        'task-123',
        'Implement the new API endpoint'
      );

      expect(result).toContain('Task(');
      expect(result).toContain('subagent_type="senior-backend-engineer"');
      expect(result).toContain('task-123');
      expect(result).toContain('Implement the new API endpoint');
      expect(result).toContain('check_tasks');
    });

    it('should escape special characters in content', () => {
      const result = generateTaskToolInvocation(
        'test-agent',
        'task-456',
        'Content with "quotes" and\nnewlines'
      );

      expect(result).toContain('\\"quotes\\"');
      expect(result).toContain('\\n');
    });

    it('should handle backslashes in content', () => {
      const result = generateTaskToolInvocation(
        'test-agent',
        'task-789',
        'Path: C:\\Users\\test\\file.txt'
      );

      expect(result).toContain('\\\\');
    });

    it('should handle empty content', () => {
      const result = generateTaskToolInvocation(
        'test-agent',
        'task-empty',
        ''
      );

      expect(result).toContain('Task(');
      expect(result).toContain('task-empty');
    });
  });

  describe('generateSimpleTaskCommand', () => {
    it('should generate simple Task command', () => {
      const result = generateSimpleTaskCommand(
        'frontend-engineer',
        'task-abc'
      );

      expect(result).toBe('Task(subagent_type="frontend-engineer", prompt="Check MCP task: task-abc")');
    });

    it('should handle agent names with special characters', () => {
      const result = generateSimpleTaskCommand(
        'qa-test-automation-engineer',
        'test-123'
      );

      expect(result).toContain('qa-test-automation-engineer');
      expect(result).toContain('test-123');
    });
  });

  describe('generateDelegationChecklist', () => {
    it('should generate checklist for task', () => {
      const result = generateDelegationChecklist('task-789', 'test-agent');

      expect(result).toContain('☐');
      expect(result).toContain('task-789');
      expect(result).toContain('test-agent');
      expect(result).toContain('Create MCP communication task');
      expect(result).toContain('Invoke Task tool');
    });

    it('should handle completed checklist', () => {
      const result1 = generateDelegationChecklist('simple-task', 'agent1', false);
      const result2 = generateDelegationChecklist('complex-task', 'agent2', true);

      expect(result1).toContain('simple-task');
      expect(result2).toContain('complex-task');
    });
  });

  describe('generateDelegationReminder', () => {
    it('should generate reminder for no incomplete delegations', () => {
      const result = generateDelegationReminder([]);
      expect(result).toBe(''); // Empty string for no delegations
    });

    it('should generate reminder for single incomplete delegation', () => {
      const result = generateDelegationReminder([
        { taskId: 'task-123', targetAgent: 'test-agent', ageMinutes: 5 }
      ]);
      expect(result).toContain('1 incomplete delegation');
      expect(result).toContain('task-123');
    });

    it('should generate reminder for multiple incomplete delegations', () => {
      const result = generateDelegationReminder([
        { taskId: 'task-123', targetAgent: 'agent1', ageMinutes: 10 },
        { taskId: 'task-456', targetAgent: 'agent2', ageMinutes: 30 }
      ]);
      expect(result).toContain('2 incomplete delegation(s)'); // Parentheses around 's'
    });

    it('should handle delegations with different ages', () => {
      const result = generateDelegationReminder([
        { taskId: 'task-1', targetAgent: 'agent1', ageMinutes: 60 },
        { taskId: 'task-2', targetAgent: 'agent2', ageMinutes: 120 }
      ]);
      expect(result).toBeTruthy();
      expect(result).toContain('incomplete');
    });
  });

  describe('generateTwoPhaseExplanation', () => {
    it('should generate two-phase explanation', () => {
      const result = generateTwoPhaseExplanation();

      expect(result).toContain('Two-Phase Delegation Pattern'); // Actual text instead of TWO-PHASE
      expect(result).toContain('Phase 1');
      expect(result).toContain('Phase 2');
      expect(result).toContain('MCP Task'); // Actual text instead of create_task
      expect(result).toContain('Task Tool'); // Capitalized
    });
  });

  describe('generateDelegationSuccess', () => {
    it('should generate success message', () => {
      const result = generateDelegationSuccess('frontend-engineer', 'ui-task-123');

      expect(result).toContain('✅');
      expect(result).toContain('Success');
      expect(result).toContain('frontend-engineer');
      expect(result).toContain('ui-task-123');
      expect(result).toContain('track_task_progress');
    });

    it('should handle different agent types', () => {
      const result1 = generateDelegationSuccess('backend-engineer', 'api-task');
      const result2 = generateDelegationSuccess('qa-engineer', 'test-task');

      expect(result1).toContain('backend-engineer');
      expect(result2).toContain('qa-engineer');
    });
  });

  describe('generateDelegationExample', () => {
    it('should generate example with proper formatting', () => {
      const result = generateDelegationExample();

      expect(result).toContain('Complete Delegation Example'); // Actual text
      expect(result).toContain('Step 1');
      expect(result).toContain('Step 2');
      expect(result).toContain('mcp__agent_comm__create_task'); // Full function name
      expect(result).toContain('Task(');
      expect(result).toContain('subagent_type');
    });
  });

  describe('validateTaskToolCommand', () => {
    it('should validate correct Task tool command', () => {
      const result = validateTaskToolCommand('Task(subagent_type="test-agent", prompt="Check MCP task with mcp__agent_comm__check_tasks")');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing subagent_type', () => {
      const result = validateTaskToolCommand('Task(prompt="test with mcp__agent_comm__check_tasks")');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing subagent_type parameter');
    });

    it('should detect missing prompt', () => {
      const result = validateTaskToolCommand('Task(subagent_type="test-agent")');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing prompt parameter');
    });

    it('should detect missing MCP task check command', () => {
      const result = validateTaskToolCommand('Task(subagent_type="test", prompt="test without MCP command")');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing MCP task check command in prompt');
    });

    it('should handle malformed commands', () => {
      const result1 = validateTaskToolCommand('Task');
      const result2 = validateTaskToolCommand('');
      const result3 = validateTaskToolCommand('Task()');

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result3.isValid).toBe(false);
    });

    it('should validate complex prompts with special characters', () => {
      const command = 'Task(subagent_type="backend", prompt="Complex task with \\"quotes\\" and\\nnewlines mcp__agent_comm__check_tasks")';
      const result = validateTaskToolCommand(command);

      expect(result.isValid).toBe(true);
    });
  });
});