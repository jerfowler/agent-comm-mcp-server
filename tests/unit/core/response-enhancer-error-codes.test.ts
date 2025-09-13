/**
 * Tests for ResponseEnhancer error code and red flag integration
 * Ensures Task tool responses trigger verification and blocking
 */

import { ResponseEnhancer } from '../../../src/core/ResponseEnhancer.js';
import { AccountabilityTracker } from '../../../src/core/AccountabilityTracker.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import type { EnhancementContext } from '../../../src/types.js';

jest.mock('../../../src/logging/EventLogger.js');
jest.mock('../../../src/core/AccountabilityTracker.js');

describe('ResponseEnhancer - Error Code Integration', () => {
  let enhancer: ResponseEnhancer;
  let mockAccountabilityTracker: jest.Mocked<AccountabilityTracker>;
  let mockEventLogger: jest.Mocked<EventLogger>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEventLogger = {
      logOperation: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({ operations: 0, errors: 0 })
    } as unknown as jest.Mocked<EventLogger>;

    mockAccountabilityTracker = {
      detectRedFlags: jest.fn(),
      generateErrorResponse: jest.fn(),
      recordClaim: jest.fn(),
      verifyClaim: jest.fn(),
      canAcceptCompletion: jest.fn(),
      formatErrorForConsole: jest.fn()
    } as unknown as jest.Mocked<AccountabilityTracker>;

    enhancer = new ResponseEnhancer(mockEventLogger, mockAccountabilityTracker);
  });

  describe('mark_complete with red flags', () => {
    it('should block completion when red flags detected', async () => {
      const redFlags = [
        {
          severity: 'BLOCKER' as const,
          message: '🚨 COMPLETION FORCED WITHOUT EVIDENCE',
          evidence: 'No progress reports',
          recommendation: 'Block completion'
        }
      ];

      const errorResponse = {
        success: false as const,
        error_code: 'FORCED_COMPLETION',
        error_severity: 'BLOCKER',
        exit_code: 3,
        red_flags: ['🚨 COMPLETION FORCED WITHOUT EVIDENCE'],
        blocked: true,
        verification_commands: ['./tmp/issue-49/verify-all.sh'],
        trust_score: 0
      };

      mockAccountabilityTracker.detectRedFlags.mockResolvedValue(redFlags);
      mockAccountabilityTracker.generateErrorResponse.mockResolvedValue(errorResponse);

      const context = {
        toolName: 'mark_complete',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: true,
          taskId: '2025-01-13T12-00-00-test-task',
          status: 'DONE'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result['success']).toBe(false);
      expect(result['error_code']).toBe('FORCED_COMPLETION');
      expect(result['exit_code']).toBe(3);
      expect(result.guidance?.next_steps).toContain('⛔ STOP!');
      expect(result.guidance?.contextual_reminder).toContain('🚨 DO NOT PROCEED WITHOUT EVIDENCE');
      expect(result.guidance?.trust_level).toBe('ZERO_TRUST');
    });

    it('should include verification commands in blocked response', async () => {
      const redFlags = [
        {
          severity: 'CRITICAL' as const,
          message: '🚨 INSUFFICIENT EVIDENCE',
          evidence: 'Score: 45%',
          recommendation: 'Reject'
        }
      ];

      const errorResponse = {
        success: false as const,
        error_code: 'INSUFFICIENT_EVIDENCE',
        error_severity: 'CRITICAL',
        exit_code: 1,
        red_flags: ['🚨 INSUFFICIENT EVIDENCE'],
        blocked: false,
        verification_commands: [
          './tmp/issue-49/verify-all.sh',
          'grep -n "Task(subagent" src/core/ResponseEnhancer.ts',
          'npm test 2>&1 | grep -E "Tests:.*passed"'
        ],
        trust_score: 45
      };

      mockAccountabilityTracker.detectRedFlags.mockResolvedValue(redFlags);
      mockAccountabilityTracker.generateErrorResponse.mockResolvedValue(errorResponse);

      const context = {
        toolName: 'mark_complete',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: true,
          taskId: '2025-01-13T12-00-00-test-task'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result.guidance?.actionable_command).toContain('./tmp/issue-49/verify-all.sh');
      expect(result.guidance?.actionable_command).toContain('grep -n "Task(subagent"');
      expect(result.guidance?.actionable_command).toContain('npm test');
    });

    it('should allow completion when no red flags', async () => {
      mockAccountabilityTracker.detectRedFlags.mockResolvedValue([]);
      mockAccountabilityTracker.canAcceptCompletion.mockReturnValue(true);

      const context = {
        toolName: 'mark_complete',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: true,
          taskId: '2025-01-13T12-00-00-test-task',
          status: 'DONE'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result['success']).toBe(true);
      expect(result['error_code']).toBeUndefined();
      expect(result['blocked']).toBeUndefined();
    });
  });

  describe('create_task with Task tool warning', () => {
    it('should add critical warning about Task tool meaninglessness', async () => {
      const context = {
        toolName: 'create_task',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: true,
          taskId: '2025-01-13T12-00-00-new-task',
          agent: 'senior-frontend-engineer'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result.guidance?.critical_warning).toContain('⚠️ CRITICAL: Task tool response means NOTHING!');
      expect(result.guidance?.critical_warning).toContain('"Completed" does NOT mean work was done');
      expect(result.guidance?.critical_warning).toContain('ZERO TRUST - verify EVERYTHING');
      expect(result.guidance?.verification_protocol?.trust_level).toBe('NEVER_TRUST_WITHOUT_EVIDENCE');
    });

    it('should include verification protocol for Task tool', async () => {
      const context = {
        toolName: 'create_task',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: true,
          taskId: '2025-01-13T12-00-00-new-task'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result.guidance?.verification_protocol).toMatchObject({
        required: true,
        commands: expect.arrayContaining([
          'mcp__agent_comm__track_task_progress(agent, taskId)',
          'Check for red flags in response',
          'Run verification script',
          'Demand evidence for all claims'
        ]),
        trust_level: 'NEVER_TRUST_WITHOUT_EVIDENCE'
      });
    });
  });

  describe('report_progress validation', () => {
    it('should reject empty progress reports', async () => {
      const context = {
        toolName: 'report_progress',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: false,
          error: 'No updates provided'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result.guidance?.error_handling).toContain('NO_EVIDENCE_PROVIDED');
      expect(result.guidance?.exit_code).toBe(2);
      expect(result.guidance?.red_flags).toContain('Empty progress report');
    });

    it('should track progress reports for evidence', async () => {
      const context = {
        toolName: 'report_progress',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: true,
          updates: [
            { step: 1, status: 'COMPLETE', description: 'Implemented feature' }
          ]
        }
      };

      await enhancer.enhanceToolResponse(context);

      expect(mockAccountabilityTracker.recordClaim).toHaveBeenCalledWith(
        expect.any(String),
        'senior-backend-engineer',
        expect.stringContaining('Progress update'),
        expect.any(String)
      );
    });
  });

  describe('submit_plan validation', () => {
    it('should reject invalid plans', async () => {
      const context = {
        toolName: 'submit_plan',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: false,
          error: 'Plan too short'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result.guidance?.error_handling).toContain('INVALID_PLAN');
      expect(result.guidance?.exit_code).toBe(1);
      expect(result.guidance?.red_flags).toContain('Plan too short');
    });

    it('should validate checkbox presence in plans', async () => {
      const context = {
        toolName: 'submit_plan',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: false,
          error: 'Missing checkboxes'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result.guidance?.red_flags).toContain('Missing checkboxes');
      expect(result.guidance?.requirement).toContain('Valid checkboxes required');
    });
  });

  describe('Console output formatting', () => {
    it('should format red flag warnings visually', async () => {
      const formattedOutput = `
🚨🚨🚨 RED FLAG DETECTED 🚨🚨🚨
ERROR CODE: INSUFFICIENT_EVIDENCE
SEVERITY: CRITICAL
TRUST SCORE: 0%

RED FLAGS:
• NO PROGRESS REPORTS FILED
• EVIDENCE SCORE: 45% (FAILING)
• TASK TOOL RESPONSE MEANINGLESS

REQUIRED ACTIONS:
1. Run: ./tmp/issue-49/verify-all.sh
2. Check: git diff for actual changes
3. Verify: npm test results

⛔ DO NOT PROCEED WITHOUT VERIFICATION
`;

      mockAccountabilityTracker.formatErrorForConsole.mockReturnValue(formattedOutput);

      const errorResponse = {
        success: false,
        error_code: 'INSUFFICIENT_EVIDENCE',
        error_severity: 'CRITICAL',
        exit_code: 1,
        red_flags: ['🚨 NO PROGRESS REPORTS FILED'],
        trust_score: 0
      };

      const formatted = mockAccountabilityTracker.formatErrorForConsole(errorResponse);

      expect(formatted).toContain('🚨🚨🚨 RED FLAG DETECTED 🚨🚨🚨');
      expect(formatted).toContain('ERROR CODE: INSUFFICIENT_EVIDENCE');
      expect(formatted).toContain('⛔ DO NOT PROCEED WITHOUT VERIFICATION');
    });
  });

  describe('Task tool deception detection', () => {
    it('should detect when Task returns but no work done', async () => {
      const redFlags = [
        {
          severity: 'CRITICAL' as const,
          message: '🚨 TASK TOOL RESPONSE IS MEANINGLESS',
          evidence: 'Agent claims success without evidence',
          recommendation: 'Zero trust - verify everything'
        }
      ];

      mockAccountabilityTracker.detectRedFlags.mockResolvedValue(redFlags);
      mockAccountabilityTracker.generateErrorResponse.mockResolvedValue({
        success: false,
        error_code: 'TASK_TOOL_DECEPTION',
        error_severity: 'CRITICAL',
        exit_code: 4,
        red_flags: ['🚨 TASK TOOL RESPONSE IS MEANINGLESS'],
        verification_required: true,
        trust_warning: '⚠️ Task tool "completion" means NOTHING. Always verify.'
      });

      const context = {
        toolName: 'create_task',
        agent: 'senior-backend-engineer',
        toolResponse: {
          success: true,
          response: 'Task completed successfully'
        }
      };

      const result = await enhancer.enhanceToolResponse(context);

      expect(result.guidance?.trust_warning).toContain('Task tool "completion" means NOTHING');
      expect(result.guidance?.verification_required).toBe(true);
    });
  });

  describe('Exit code propagation', () => {
    it('should propagate exit codes to calling agents', async () => {
      const testCases = [
        { code: 'INSUFFICIENT_EVIDENCE', exitCode: 1 },
        { code: 'NO_PROGRESS_TRACKING', exitCode: 2 },
        { code: 'FORCED_COMPLETION', exitCode: 3 },
        { code: 'TASK_TOOL_DECEPTION', exitCode: 4 }
      ];

      for (const { code, exitCode } of testCases) {
        mockAccountabilityTracker.generateErrorResponse.mockResolvedValue({
          success: false,
          error_code: code,
          exit_code: exitCode,
          red_flags: [`Error: ${code}`]
        });

        const context = {
          toolName: 'mark_complete',
          agent: 'test-agent',
          toolResponse: { success: false }
        };

        const result = await enhancer.enhanceToolResponse(context);

        expect(result.exit_code).toBe(exitCode);
      }
    });
  });
});