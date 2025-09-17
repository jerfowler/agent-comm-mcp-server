/**
 * Tests for guidance templates
 */

import { describe, it, expect } from '@jest/globals';
import {
  GUIDANCE_TEMPLATES,
  DELEGATION_TEMPLATES,
  TODOWRITE_REMINDERS,
  processTemplate,
  getTemplateForLevel,
  generateGuidanceMessage,
  generateNextSteps,
  type GuidanceTemplate
} from '../../../src/core/guidance-templates.js';

// Mock TaskContext for testing
interface TaskContext {
  currentTask?: string;
  completedSteps?: number;
  totalSteps?: number;
  pendingTasks?: number;
  complianceScore?: number;
}

describe('Guidance Templates', () => {
  describe('GUIDANCE_TEMPLATES', () => {
    it('should have templates for all required tools', () => {
      const requiredTools = [
        'create_task',
        'submit_plan',
        'report_progress',
        'mark_complete',
        'archive_tasks',
        'check_tasks'
      ];

      requiredTools.forEach(tool => {
        expect(GUIDANCE_TEMPLATES).toHaveProperty(tool);
        const template = GUIDANCE_TEMPLATES[tool];
        expect(template).toHaveProperty('level_1');
        expect(template).toHaveProperty('level_2');
        expect(template).toHaveProperty('level_3');
        expect(template).toHaveProperty('level_4');
      });
    });

    it('should have non-empty messages for all levels', () => {
      Object.entries(GUIDANCE_TEMPLATES).forEach(([_tool, template]) => {
        expect(template.level_1).toBeTruthy();
        expect(template.level_2).toBeTruthy();
        expect(template.level_3).toBeTruthy();
        expect(template.level_4).toBeTruthy();

        // Check messages are strings
        expect(typeof template.level_1).toBe('string');
        expect(typeof template.level_2).toBe('string');
        expect(typeof template.level_3).toBe('string');
        expect(typeof template.level_4).toBe('string');
      });
    });
  });

  describe('DELEGATION_TEMPLATES', () => {
    it('should have all required levels', () => {
      expect(DELEGATION_TEMPLATES).toHaveProperty('level_1');
      expect(DELEGATION_TEMPLATES).toHaveProperty('level_2');
      expect(DELEGATION_TEMPLATES).toHaveProperty('level_3');
      expect(DELEGATION_TEMPLATES).toHaveProperty('level_4');
    });

    it('should contain delegation-specific guidance', () => {
      expect(DELEGATION_TEMPLATES.level_1).toContain('Task tool');
      expect(DELEGATION_TEMPLATES.level_2).toContain('2-step process');
      expect(DELEGATION_TEMPLATES.level_3).toContain('forget to complete delegations');
      expect(DELEGATION_TEMPLATES.level_4).toContain('delegation completion rate');
    });
  });

  describe('TODOWRITE_REMINDERS', () => {
    it('should have TodoWrite specific reminders', () => {
      expect(TODOWRITE_REMINDERS.level_1).toContain('TodoWrite');
      expect(TODOWRITE_REMINDERS.level_2).toContain('TodoWrite');
      expect(TODOWRITE_REMINDERS.level_3).toContain('TodoWrite');
      expect(TODOWRITE_REMINDERS.level_4).toContain('TodoWrite');
    });
  });

  describe('processTemplate', () => {
    it('should replace all placeholders with values', () => {
      const template = 'You have {count} tasks and {rate}% completion rate';
      const variables = { count: 5, rate: 75 };
      const result = processTemplate(template, variables);
      expect(result).toBe('You have 5 tasks and 75% completion rate');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'You have {count} tasks';
      const variables = {};
      const result = processTemplate(template, variables);
      expect(result).toBe('You have {count} tasks');
    });

    it('should handle undefined variables', () => {
      const template = 'Rate is {rate}%';
      const variables = { rate: undefined };
      const result = processTemplate(template, variables);
      expect(result).toBe('Rate is undefined%');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '{name} is great! Yes, {name} really is!';
      const variables = { name: 'Testing' };
      const result = processTemplate(template, variables);
      expect(result).toBe('Testing is great! Yes, Testing really is!');
    });

    it('should handle null values', () => {
      const template = 'Value is {value}';
      const variables = { value: null };
      const result = processTemplate(template, variables);
      expect(result).toBe('Value is null');
    });

    it('should handle numeric values', () => {
      const template = 'Count is {count}';
      const variables = { count: 42 };
      const result = processTemplate(template, variables);
      expect(result).toBe('Count is 42');
    });
  });

  describe('getTemplateForLevel', () => {
    it('should return correct template for each level', () => {
      const templates: GuidanceTemplate = {
        level_1: 'Level 1 message',
        level_2: 'Level 2 message',
        level_3: 'Level 3 message',
        level_4: 'Level 4 message'
      };

      expect(getTemplateForLevel(templates, 1)).toBe('Level 1 message');
      expect(getTemplateForLevel(templates, 2)).toBe('Level 2 message');
      expect(getTemplateForLevel(templates, 3)).toBe('Level 3 message');
      expect(getTemplateForLevel(templates, 4)).toBe('Level 4 message');
    });

    it('should default to level 1 for invalid levels', () => {
      const templates: GuidanceTemplate = {
        level_1: 'Default message',
        level_2: 'Level 2',
        level_3: 'Level 3',
        level_4: 'Level 4'
      };

      expect(getTemplateForLevel(templates, 0 as 1)).toBe('Default message');
      expect(getTemplateForLevel(templates, 5 as 1)).toBe('Default message');
      expect(getTemplateForLevel(templates, -1 as 1)).toBe('Default message');
    });
  });

  describe('generateGuidanceMessage', () => {
    it('should generate message for create_task', () => {
      const message = generateGuidanceMessage('create_task', 90, {
        unsubmittedPlans: 2,
        delegationRate: 75
      });
      expect(message).toContain('Task created');
    });

    it('should generate message for submit_plan', () => {
      const message = generateGuidanceMessage('submit_plan', 85, {
        todoUsageRate: 60
      });
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should generate message for report_progress', () => {
      const message = generateGuidanceMessage('report_progress', 95, {
        remainingSteps: 3
      });
      expect(message).toContain('3');
    });

    it('should generate message for mark_complete', () => {
      const message = generateGuidanceMessage('mark_complete', 45, {
        complianceScore: 45
      });
      expect(message).toContain('complete');
    });

    it('should generate message for archive_tasks', () => {
      const message = generateGuidanceMessage('archive_tasks', 95, {
        pendingCount: 5
      });
      expect(message).toContain('archive');
    });

    it('should generate message for check_tasks', () => {
      const message = generateGuidanceMessage('check_tasks', 40, {
        taskCount: 10,
        newCount: 3,
        activeCount: 4,
        errorCount: 2,
        pendingCount: 8
      });
      expect(message).toBeTruthy();
    });

    it('should handle unknown tools', () => {
      const message = generateGuidanceMessage('unknown_tool', 90, {});
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should handle delegation flag', () => {
      const message = generateGuidanceMessage('create_task', 85, {}, true);
      expect(message).toContain('Delegation');
    });
  });

  describe('generateNextSteps', () => {
    it('should generate next steps for create_task non-delegation', () => {
      const context: TaskContext = {
        currentTask: 'test-task',
        completedSteps: 0,
        totalSteps: 5
      };
      const steps = generateNextSteps('create_task', context);
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]).toContain('Submit your implementation plan');
    });

    it('should generate next steps for create_task delegation', () => {
      const context: TaskContext & { taskType: string } = {
        currentTask: 'test-task',
        completedSteps: 0,
        totalSteps: 5,
        taskType: 'delegation'
      };
      const steps = generateNextSteps('create_task', context);
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]).toContain('Copy the Task tool');
    });

    it('should generate next steps for submit_plan', () => {
      const context: TaskContext = {
        currentTask: 'test-task',
        completedSteps: 0,
        totalSteps: 5
      };
      const steps = generateNextSteps('submit_plan', context);
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]).toContain('Initialize TodoWrite');
    });

    it('should generate next steps for report_progress', () => {
      const context: TaskContext = {
        currentTask: 'test-task',
        completedSteps: 2,
        totalSteps: 5
      };
      const steps = generateNextSteps('report_progress', context);
      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[0]).toContain('Sync TodoWrite');
    });

    it('should generate next steps for mark_complete', () => {
      const context: TaskContext = {
        currentTask: 'test-task',
        pendingTasks: 3
      };
      const steps = generateNextSteps('mark_complete', context);
      expect(Array.isArray(steps)).toBe(true);
      expect(steps[0]).toContain('archive_completed_tasks');
    });

    it('should handle unknown tools', () => {
      const context: TaskContext = {};
      const steps = generateNextSteps('unknown_tool', context);
      expect(Array.isArray(steps)).toBe(true);
      expect(steps[0]).toContain('Continue');
    });
  });
});