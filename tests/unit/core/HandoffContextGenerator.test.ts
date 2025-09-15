/**
 * Tests for HandoffContextGenerator
 */

import { HandoffContextGenerator } from '../../../src/core/HandoffContextGenerator.js';
import type {
  TaskInfo,
  WorkItem,
  KeyDecision
} from '../../../src/core/HandoffContextGenerator.js';

describe('HandoffContextGenerator', () => {
  let generator: HandoffContextGenerator;

  beforeEach(() => {
    generator = new HandoffContextGenerator();
  });

  describe('generateHandoffContext', () => {
    it('should generate comprehensive handoff context', () => {
      const taskInfo: TaskInfo = {
        taskId: 'test-task-123',
        taskDescription: 'Implement feature X',
        currentAgent: 'agent-1',
        startedAt: new Date('2024-01-01T10:00:00Z')
      };

      const workItems: WorkItem[] = [
        { description: 'Setup environment', completed: true, notes: 'Done successfully' },
        { description: 'Write tests', completed: false },
        { description: 'Implement feature', completed: false, blockedReason: 'Waiting for API' }
      ];

      const keyDecisions: KeyDecision[] = [
        {
          decision: 'Use TypeScript',
          rationale: 'Better type safety',
          timestamp: new Date('2024-01-01T11:00:00Z')
        }
      ];

      const dependencies = ['external-api', 'database-migration'];

      const handoff = generator.generateHandoffContext(
        taskInfo,
        workItems,
        keyDecisions,
        dependencies
      );

      expect(handoff.criticalContext).toContain('Task: test-task-123 - Implement feature X');
      expect(handoff.completedWork).toContain('✓ Setup environment - Done successfully');
      expect(handoff.nextSteps).toContain('Continue: Write tests');
      expect(handoff.dependencies).toEqual(dependencies);
      expect(Object.keys(handoff.keyDecisions)).toHaveLength(1);
    });

    it('should handle blocked work items', () => {
      const taskInfo: TaskInfo = {
        taskId: 'blocked-task',
        taskDescription: 'Feature with blockers',
        currentAgent: 'agent-1',
        startedAt: new Date()
      };

      const workItems: WorkItem[] = [
        { description: 'Blocked task', completed: false, blockedReason: 'Missing dependencies' }
      ];

      const handoff = generator.generateHandoffContext(taskInfo, workItems, [], []);

      expect(handoff.criticalContext.some(item => item.includes('BLOCKED'))).toBe(true);
      expect(handoff.nextSteps.some(step => step.includes('Resolve blockers'))).toBe(true);
    });

    it('should estimate continuation context accurately', () => {
      const taskInfo: TaskInfo = {
        taskId: 'context-task',
        taskDescription: 'Context estimation test',
        currentAgent: 'agent-1',
        startedAt: new Date()
      };

      const workItems: WorkItem[] = [
        { description: 'Complete item', completed: true },
        { description: 'Pending item 1', completed: false },
        { description: 'Pending item 2', completed: false }
      ];

      const handoff = generator.generateHandoffContext(taskInfo, workItems, [], []);

      expect(handoff.estimatedContinuationContext).toBeGreaterThan(0);
    });
  });

  describe('generateTextSummary', () => {
    it('should generate readable text summary', () => {
      const handoff = {
        criticalContext: ['Critical info 1', 'Critical info 2'],
        completedWork: ['✓ Task 1', '✓ Task 2'],
        nextSteps: ['Next step 1', 'Next step 2'],
        keyDecisions: { 'Decision_1': 'Important decision' },
        dependencies: ['dep1', 'dep2'],
        estimatedContinuationContext: 1500
      };

      const summary = generator.generateTextSummary(handoff);

      expect(summary).toContain('TASK HANDOFF CONTEXT');
      expect(summary).toContain('CRITICAL INFORMATION');
      expect(summary).toContain('COMPLETED WORK');
      expect(summary).toContain('NEXT STEPS');
      expect(summary).toContain('KEY DECISIONS');
      expect(summary).toContain('DEPENDENCIES');
      expect(summary).toContain('1500 tokens');
    });
  });

  describe('validateHandoffContext', () => {
    it('should validate complete handoff context', () => {
      const validHandoff = {
        criticalContext: ['Some critical info'],
        completedWork: ['✓ Completed task'],
        nextSteps: ['Next step'],
        keyDecisions: {},  // Empty key decisions should trigger warning
        dependencies: [],
        estimatedContinuationContext: 1000
      };

      const validation = generator.validateHandoffContext(validHandoff);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(1); // Only warning about no key decisions
      expect(validation.issues[0]).toContain('Warning');
      expect(validation.issues[0]).toContain('key decisions');
    });

    it('should identify incomplete handoff context', () => {
      const incompleteHandoff = {
        criticalContext: [],
        completedWork: [],
        nextSteps: [],
        keyDecisions: {},
        dependencies: [],
        estimatedContinuationContext: -1
      };

      const validation = generator.validateHandoffContext(incompleteHandoff);

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues.some(issue => issue.includes('No critical context'))).toBe(true);
      expect(validation.issues.some(issue => issue.includes('No completed work'))).toBe(true);
      expect(validation.issues.some(issue => issue.includes('No next steps'))).toBe(true);
    });
  });
});