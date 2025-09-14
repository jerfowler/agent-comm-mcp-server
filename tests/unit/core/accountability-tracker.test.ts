/**
 * AccountabilityTracker tests - Verify evidence tracking and verification
 */

import { jest } from '@jest/globals';
import { AccountabilityTracker } from '../../../src/core/AccountabilityTracker.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import type { VerificationResult } from '../../../src/core/AccountabilityTracker.js';

describe('AccountabilityTracker', () => {
  let tracker: AccountabilityTracker;
  let mockEventLogger: jest.Mocked<EventLogger>;

  beforeEach(() => {
    mockEventLogger = {
      logOperation: jest.fn(() => Promise.resolve()),
      waitForWriteQueueEmpty: jest.fn(() => Promise.resolve()),
      close: jest.fn(() => Promise.resolve())
    } as unknown as jest.Mocked<EventLogger>;

    tracker = new AccountabilityTracker(mockEventLogger);
  });

  describe('recordClaim', () => {
    it('should record claims with evidence', async () => {
      await tracker.recordClaim(
        'task-123',
        'senior-backend-engineer',
        'Implemented parallel execution',
        'Added Task() command generation'
      );

      const score = tracker.getCompletionScore('task-123');
      expect(score).toBe(0); // Not verified yet

      expect(mockEventLogger.logOperation).toHaveBeenCalledWith(
        'accountability_claim_recorded',
        'senior-backend-engineer',
        expect.objectContaining({
          taskId: 'task-123',
          claim: 'Implemented parallel execution',
          hasEvidence: true
        })
      );
    });

    it('should generate verification commands for parallel execution claims', async () => {
      await tracker.recordClaim(
        'task-123',
        'senior-backend-engineer',
        'Added parallel execution feature',
        'Multiple Task() commands'
      );

      const report = tracker.generateEvidenceReport('task-123');
      expect(report).toContain('grep -n "Task(subagent_type.*Task(subagent_type"');
      expect(report).toContain('parallel.*Task');
    });

    it('should generate verification commands for escalation claims', async () => {
      await tracker.recordClaim(
        'task-456',
        'senior-backend-engineer',
        'Implemented urgency escalation levels',
        'Three levels: gentle, firm, critical'
      );

      const report = tracker.generateEvidenceReport('task-456');
      expect(report).toContain('urgency_level.*gentle\\|firm\\|critical');
      expect(report).toContain('escalation');
    });

    it('should generate verification commands for test claims', async () => {
      await tracker.recordClaim(
        'task-789',
        'senior-backend-engineer',
        'Wrote comprehensive tests',
        '50+ test cases added'
      );

      const report = tracker.generateEvidenceReport('task-789');
      expect(report).toContain('npm test');
      expect(report).toContain('Tests:.*passed');
      expect(report).toContain('test:coverage');
    });
  });

  describe('verifyClaim', () => {
    it('should accept completion with sufficient evidence', async () => {
      await tracker.recordClaim(
        'task-123',
        'senior-backend-engineer',
        'Implemented all features'
      );

      const verificationResults: VerificationResult[] = [
        { command: 'grep parallel', success: true, output: 'Found 5 instances' },
        { command: 'grep urgency', success: true, output: 'Found 3 levels' },
        { command: 'npm test', success: true, output: 'All tests passing' }
      ];

      const result = await tracker.verifyClaim('task-123', verificationResults);
      expect(result).toBe(true);
      expect(tracker.getCompletionScore('task-123')).toBe(100);
      expect(tracker.canAcceptCompletion('task-123')).toBe(true);
    });

    it('should reject completion with insufficient evidence', async () => {
      await tracker.recordClaim(
        'task-456',
        'senior-backend-engineer',
        'Implemented features'
      );

      const verificationResults: VerificationResult[] = [
        { command: 'grep parallel', success: false, output: 'Not found' },
        { command: 'grep urgency', success: true, output: 'Found 1 level' },
        { command: 'npm test', success: false, output: 'Tests failing' }
      ];

      const result = await tracker.verifyClaim('task-456', verificationResults);
      expect(result).toBe(false);
      expect(tracker.getCompletionScore('task-456')).toBeCloseTo(33.33, 1);
      expect(tracker.canAcceptCompletion('task-456')).toBe(false);
    });

    it('should require 70% score for acceptance', async () => {
      await tracker.recordClaim(
        'task-789',
        'senior-backend-engineer',
        'Partial implementation'
      );

      // 2 out of 3 pass = 66.67% (below 70% threshold)
      const verificationResults: VerificationResult[] = [
        { command: 'test1', success: true },
        { command: 'test2', success: true },
        { command: 'test3', success: false }
      ];

      const result = await tracker.verifyClaim('task-789', verificationResults);
      expect(result).toBe(false);
      expect(tracker.canAcceptCompletion('task-789')).toBe(false);

      // Add one more passing test (3 out of 4 = 75%)
      verificationResults.push({ command: 'test4', success: true });
      const result2 = await tracker.verifyClaim('task-789', verificationResults);
      expect(result2).toBe(true);
      expect(tracker.canAcceptCompletion('task-789')).toBe(true);
    });
  });

  describe('generateVerificationGuidance', () => {
    it('should provide guidance for unverified tasks', () => {
      const guidance = tracker.generateVerificationGuidance('unknown-task');
      expect(guidance).toBe('Start by recording your implementation claims');
    });

    it('should show success for verified tasks', async () => {
      await tracker.recordClaim('task-123', 'agent', 'Done');
      await tracker.verifyClaim('task-123', [
        { command: 'test', success: true }
      ]);

      const guidance = tracker.generateVerificationGuidance('task-123');
      expect(guidance).toContain('✅ Evidence verified');
      expect(guidance).toContain('100%');
    });

    it('should show warning for partial verification', async () => {
      await tracker.recordClaim('task-456', 'agent', 'Partial');
      await tracker.verifyClaim('task-456', [
        { command: 'test1', success: true },
        { command: 'test2', success: false }
      ]);

      const guidance = tracker.generateVerificationGuidance('task-456');
      expect(guidance).toContain('⚠️ Evidence insufficient');
      expect(guidance).toContain('50%');
      expect(guidance).toContain('Need 20% more');
    });

    it('should show critical alert for no verification', async () => {
      await tracker.recordClaim('task-789', 'agent', 'Unverified');

      const guidance = tracker.generateVerificationGuidance('task-789');
      expect(guidance).toContain('🚨 NO EVIDENCE PROVIDED');
      expect(guidance).toContain('Must provide verification');
    });
  });

  describe('generateEvidenceReport', () => {
    it('should generate comprehensive report', async () => {
      await tracker.recordClaim(
        'task-123',
        'senior-backend-engineer',
        'Implemented feature X',
        'Code at line 100-150'
      );

      await tracker.recordClaim(
        'task-123',
        'senior-backend-engineer',
        'Added tests',
        '20 test cases'
      );

      const verificationResults: VerificationResult[] = [
        { command: 'grep feature', success: true, output: 'Found feature X' },
        { command: 'npm test', success: false, output: 'Tests failing' }
      ];

      await tracker.verifyClaim('task-123', verificationResults);

      const report = tracker.generateEvidenceReport('task-123');

      expect(report).toContain('# Evidence Report for Task task-123');
      expect(report).toContain('Agent: senior-backend-engineer');
      expect(report).toContain('Completion Score: 50%');
      expect(report).toContain('❌ INSUFFICIENT EVIDENCE');
      expect(report).toContain('## Claims (2)');
      expect(report).toContain('Implemented feature X');
      expect(report).toContain('Evidence: Code at line 100-150');
      expect(report).toContain('## Verification Results (2)');
      expect(report).toContain('✅ `grep feature`');
      expect(report).toContain('❌ `npm test`');
    });
  });

  describe('resetTask', () => {
    it('should clear all task data', async () => {
      await tracker.recordClaim('task-123', 'agent', 'Claim');
      await tracker.verifyClaim('task-123', [
        { command: 'test', success: true }
      ]);

      expect(tracker.getCompletionScore('task-123')).toBe(100);

      tracker.resetTask('task-123');
      expect(tracker.getCompletionScore('task-123')).toBe(0);
      expect(tracker.generateEvidenceReport('task-123')).toBe('No claims recorded for this task');
    });
  });

  describe('getPendingVerifications', () => {
    it('should return tasks needing verification', async () => {
      // Task 1: Fully verified
      await tracker.recordClaim('task-1', 'agent', 'Done');
      await tracker.verifyClaim('task-1', [
        { command: 'test', success: true }
      ]);

      // Task 2: Partially verified
      await tracker.recordClaim('task-2', 'agent', 'Partial');
      await tracker.verifyClaim('task-2', [
        { command: 'test', success: false }
      ]);

      // Task 3: Not verified
      await tracker.recordClaim('task-3', 'agent', 'Unverified');

      const pending = tracker.getPendingVerifications();
      expect(pending).toEqual(['task-2', 'task-3']);
      expect(pending).not.toContain('task-1');
    });
  });
});