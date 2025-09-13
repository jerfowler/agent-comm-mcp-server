/**
 * Tests for AccountabilityTracker red flag detection and error code system
 * Ensures suspicious patterns are detected and blocked with proper exit codes
 */

import { AccountabilityTracker } from '../../../src/core/AccountabilityTracker.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';

jest.mock('../../../src/logging/EventLogger.js');

describe('AccountabilityTracker - Red Flag Detection', () => {
  let tracker: AccountabilityTracker;
  let mockEventLogger: jest.Mocked<EventLogger>;
  const testAgent = 'senior-backend-engineer';
  const testTaskId = '2025-01-13T12-00-00-test-task';

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventLogger = {
      logOperation: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({ operations: 0, errors: 0 })
    } as unknown as jest.Mocked<EventLogger>;

    tracker = new AccountabilityTracker(mockEventLogger);
  });

  describe('detectRedFlags', () => {
    it('should detect INSUFFICIENT_EVIDENCE when evidence score < 70%', async () => {
      // Record claims without sufficient evidence
      await tracker.recordClaim(testTaskId, testAgent, 'Implemented parallel execution');
      await tracker.recordClaim(testTaskId, testAgent, 'Added urgency levels');

      // Simulate low verification score
      await tracker.verifyClaim(testTaskId, [
        { command: 'grep parallel', success: false },
        { command: 'grep urgency', success: false },
        { command: 'npm test', success: false }
      ]);

      const flags = await tracker.detectRedFlags(testAgent, testTaskId);

      expect(flags).toContainEqual(expect.objectContaining({
        severity: 'CRITICAL',
        message: expect.stringContaining('🚨 EVIDENCE SCORE FAILING'),
        evidence: expect.stringContaining('Score: 0%')
      }));
    });

    it('should detect NO_PROGRESS_TRACKING when < 3 progress reports', async () => {
      // No progress reports filed
      const flags = await tracker.detectRedFlags(testAgent, testTaskId);

      expect(flags).toContainEqual(expect.objectContaining({
        severity: 'CRITICAL',
        message: expect.stringContaining('🚨 INSUFFICIENT PROGRESS TRACKING'),
        evidence: expect.stringContaining('Only 0 progress reports filed')
      }));
    });

    it('should detect FORCED_COMPLETION when mark_complete without evidence', async () => {
      // Attempt completion without progress reports or evidence
      await tracker.recordClaim(testTaskId, testAgent, 'Task completed successfully');

      const flags = await tracker.detectRedFlags(testAgent, testTaskId);

      expect(flags.length).toBeGreaterThan(0);
      expect(flags).toContainEqual(expect.objectContaining({
        severity: 'BLOCKER',
        recommendation: expect.stringContaining('Block completion until evidence provided')
      }));
    });

    it('should return no flags when evidence is sufficient', async () => {
      // Record progress reports (simulated)
      for (let i = 0; i < 5; i++) {
        await tracker.recordProgressReport?.(testAgent, testTaskId) ??
               tracker.recordClaim(testTaskId, testAgent, `Progress update ${i}`, 'evidence');
      }

      // Record claims with evidence
      await tracker.recordClaim(testTaskId, testAgent, 'Implemented feature', 'grep output shows implementation');

      // High verification score
      await tracker.verifyClaim(testTaskId, [
        { command: 'grep feature', success: true, output: 'found' },
        { command: 'npm test', success: true, output: 'passed' }
      ]);

      const flags = await tracker.detectRedFlags(testAgent, testTaskId);

      expect(flags).toEqual([]);
    });
  });

  describe('generateErrorResponse', () => {
    it('should generate INSUFFICIENT_EVIDENCE error response', async () => {
      const flags = [
        {
          severity: 'CRITICAL' as const,
          message: '🚨 EVIDENCE SCORE FAILING',
          evidence: 'Score: 45%',
          recommendation: 'Reject completion without evidence'
        },
        {
          severity: 'CRITICAL' as const,
          message: '🚨 NO TEST OUTPUT PROVIDED',
          evidence: 'No test results shown',
          recommendation: 'Run: npm test'
        }
      ];

      const response = await tracker.generateErrorResponse(flags);

      expect(response).toMatchObject({
        success: false,
        error_code: 'INSUFFICIENT_EVIDENCE',
        error_severity: 'CRITICAL',
        exit_code: 1,
        red_flags: expect.arrayContaining([
          '🚨 EVIDENCE SCORE FAILING',
          '🚨 NO TEST OUTPUT PROVIDED'
        ]),
        blocked: false,
        verification_commands: expect.arrayContaining([
          './tmp/issue-49/verify-all.sh'
        ])
      });
    });

    it('should generate NO_PROGRESS_TRACKING error response', async () => {
      const flags = [
        {
          severity: 'CRITICAL' as const,
          message: '🚨 INSUFFICIENT PROGRESS TRACKING',
          evidence: 'Only 0 progress reports filed',
          recommendation: 'Reject completion without evidence'
        }
      ];

      const response = await tracker.generateErrorResponse(flags);

      expect(response).toMatchObject({
        success: false,
        error_code: 'NO_PROGRESS_TRACKING',
        error_severity: 'CRITICAL',
        exit_code: 2,
        trust_score: 0,
        red_flags: expect.arrayContaining([
          '🚨 INSUFFICIENT PROGRESS TRACKING'
        ])
      });
    });

    it('should generate FORCED_COMPLETION error response with blocker', async () => {
      const flags = [
        {
          severity: 'BLOCKER' as const,
          message: '🚨 COMPLETION FORCED WITHOUT EVIDENCE',
          evidence: 'reconciliation_mode=force with score < 70%',
          recommendation: 'Block completion until evidence provided'
        }
      ];

      const response = await tracker.generateErrorResponse(flags);

      expect(response).toMatchObject({
        success: false,
        error_code: 'FORCED_COMPLETION',
        error_severity: 'BLOCKER',
        exit_code: 3,
        blocked: true,
        red_flags: expect.arrayContaining([
          '🚨 COMPLETION FORCED WITHOUT EVIDENCE'
        ])
      });
    });

    it('should prioritize highest severity in response', async () => {
      const flags = [
        {
          severity: 'CRITICAL' as const,
          message: 'Critical issue',
          evidence: 'evidence',
          recommendation: 'fix'
        },
        {
          severity: 'BLOCKER' as const,
          message: 'Blocker issue',
          evidence: 'evidence',
          recommendation: 'block'
        }
      ];

      const response = await tracker.generateErrorResponse(flags);

      expect(response.error_severity).toBe('BLOCKER');
      expect(response.blocked).toBe(true);
    });
  });

  describe('Error Code Exit Codes', () => {
    it('should return exit code 1 for INSUFFICIENT_EVIDENCE', async () => {
      const response = await tracker.generateErrorResponse([
        {
          severity: 'CRITICAL' as const,
          message: '🚨 EVIDENCE SCORE FAILING',
          evidence: 'Score: 45%',
          recommendation: 'Reject'
        }
      ]);

      expect(response.exit_code).toBe(1);
    });

    it('should return exit code 2 for NO_PROGRESS_TRACKING', async () => {
      const response = await tracker.generateErrorResponse([
        {
          severity: 'CRITICAL' as const,
          message: '🚨 INSUFFICIENT PROGRESS TRACKING',
          evidence: 'Only 0 reports',
          recommendation: 'Reject'
        }
      ]);

      expect(response.exit_code).toBe(2);
    });

    it('should return exit code 3 for FORCED_COMPLETION', async () => {
      const response = await tracker.generateErrorResponse([
        {
          severity: 'BLOCKER' as const,
          message: '🚨 COMPLETION FORCED WITHOUT EVIDENCE',
          evidence: 'forced',
          recommendation: 'Block'
        }
      ]);

      expect(response.exit_code).toBe(3);
    });

    it('should return exit code 4 for TASK_TOOL_DECEPTION', async () => {
      const response = await tracker.generateErrorResponse([
        {
          severity: 'CRITICAL' as const,
          message: '🚨 TASK TOOL RESPONSE IS MEANINGLESS',
          evidence: 'Agent claims success without evidence',
          recommendation: 'Zero trust'
        }
      ]);

      expect(response.exit_code).toBe(4);
    });
  });

  describe('Visual Error Output', () => {
    it('should format red flag output correctly', async () => {
      const flags = [
        {
          severity: 'CRITICAL' as const,
          message: '🚨 NO PROGRESS REPORTS FILED',
          evidence: '0 reports',
          recommendation: 'Reject'
        },
        {
          severity: 'CRITICAL' as const,
          message: '🚨 EVIDENCE SCORE: 45% (FAILING)',
          evidence: 'Score too low',
          recommendation: 'Block'
        }
      ];

      const response = await tracker.generateErrorResponse(flags);
      const formatted = tracker.formatErrorForConsole?.(response) ??
                       JSON.stringify(response, null, 2);

      expect(formatted).toContain('🚨🚨🚨 RED FLAG DETECTED 🚨🚨🚨');
      expect(formatted).toContain('ERROR CODE: INSUFFICIENT_EVIDENCE');
      expect(formatted).toContain('SEVERITY: CRITICAL');
      expect(formatted).toContain('RED FLAGS:');
      expect(formatted).toContain('⛔ DO NOT PROCEED WITHOUT VERIFICATION');
    });
  });

  describe('Integration with ResponseEnhancer', () => {
    it('should block mark_complete when red flags detected', async () => {
      // Simulate red flags
      await tracker.recordClaim(testTaskId, testAgent, 'Completed');

      const flags = await tracker.detectRedFlags(testAgent, testTaskId);
      expect(flags.length).toBeGreaterThan(0);

      const canComplete = tracker.canAcceptCompletion(testTaskId);
      expect(canComplete).toBe(false);
    });

    it('should provide verification commands in error response', async () => {
      const flags = [
        {
          severity: 'CRITICAL' as const,
          message: '🚨 INSUFFICIENT EVIDENCE',
          evidence: 'No verification',
          recommendation: 'Verify'
        }
      ];

      const response = await tracker.generateErrorResponse(flags);

      expect(response.verification_commands).toContain('./tmp/issue-49/verify-all.sh');
      expect(response.verification_commands).toContain(
        'grep -n "Task(subagent" src/core/ResponseEnhancer.ts'
      );
      expect(response.verification_commands).toContain(
        'npm test 2>&1 | grep -E "Tests:.*passed"'
      );
    });
  });

  describe('Trust Score Calculation', () => {
    it('should return 0 trust score for critical violations', async () => {
      const flags = [
        {
          severity: 'CRITICAL' as const,
          message: '🚨 NO PROGRESS TRACKING',
          evidence: 'Zero reports',
          recommendation: 'Reject'
        }
      ];

      const response = await tracker.generateErrorResponse(flags);

      expect(response.trust_score).toBe(0);
    });

    it('should calculate trust score based on evidence', async () => {
      // Add some evidence but not enough
      await tracker.recordClaim(testTaskId, testAgent, 'Partial work', 'some evidence');
      await tracker.verifyClaim(testTaskId, [
        { command: 'test1', success: true },
        { command: 'test2', success: false }
      ]);

      const flags = await tracker.detectRedFlags(testAgent, testTaskId);
      const response = await tracker.generateErrorResponse(flags);

      expect(response.trust_score).toBeGreaterThanOrEqual(0);
      expect(response.trust_score).toBeLessThan(70);
    });
  });
});