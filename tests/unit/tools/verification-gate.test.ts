/**
 * Unit tests for Agent False Success Reporting Prevention
 * Tests for mandatory verification gate in mark-complete tool
 * 
 * Based on Issue #11: Agent False Success Reporting
 * Implements mandatory verification to prevent dangerous false confidence
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { markComplete } from '../../../src/tools/mark-complete.js';
import * as verification from '../../../src/core/agent-work-verifier.js';
import * as validation from '../../../src/utils/validation.js';
import * as fs from '../../../src/utils/file-system.js';
import { TaskContextManager, CompletionResult } from '../../../src/core/TaskContextManager.js';
import { ServerConfig } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';

// Mock modules
jest.mock('../../../src/core/agent-work-verifier.js');
jest.mock('../../../src/utils/validation.js');
jest.mock('../../../src/core/TaskContextManager.js');

// Mock fs-extra using factory pattern (required for mark-complete.ts)
jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  listDirectory: jest.fn(),
  getStats: jest.fn(),
  readFile: jest.fn()
}));

const mockVerification = verification as jest.Mocked<typeof verification>;
const mockValidation = validation as jest.Mocked<typeof validation>;
const mockFs = fs as jest.Mocked<typeof fs>;
const MockTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;

interface VerificationResult {
  success: boolean;
  confidence: number;
  warnings: string[];
  evidence: {
    filesModified: number;
    testsRun: boolean;
    mcpProgress: boolean;
    timeSpent: number;
  };
  recommendation: string;
}

describe('Agent Work Verification Gate', () => {
  let mockConfig: ServerConfig;
  let mockContextManager: jest.Mocked<TaskContextManager>;
  let mockCompletionResult: CompletionResult;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = testUtils.createMockConfig();
    
    // Create mock CompletionResult
    mockCompletionResult = {
      success: true,
      status: 'DONE',
      summary: 'Task completed successfully',
      completedAt: new Date('2025-01-01T12:00:00Z'),
      isError: false,
      recommendations: ['Great job!', 'Consider optimization next time']
    };

    // Setup validation mocks (critical for tests to run)
    mockValidation.validateRequiredString
      .mockImplementation((value) => value as string);
    
    // Setup file system mocks (required for mark-complete reconciliation logic)
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.listDirectory.mockResolvedValue(['task-dir']);
    mockFs.getStats.mockResolvedValue({
      isDirectory: () => true,
      mtime: new Date('2025-01-01T12:00:00Z')
    } as fs.Stats);
    mockFs.readFile.mockResolvedValue('# Test Plan\n- [ ] **Step 1**: Pending\n- [x] **Step 2**: Complete');
    
    // Setup TaskContextManager mock
    mockContextManager = {
      markComplete: jest.fn<() => Promise<CompletionResult>>().mockResolvedValue(mockCompletionResult)
    } as unknown as jest.Mocked<TaskContextManager>;
    
    MockTaskContextManager.mockImplementation(() => mockContextManager);
    
    // Default successful verification mock
    mockVerification.verifyAgentWork = jest.fn<() => Promise<VerificationResult>>()
      .mockResolvedValue({
        success: true,
        confidence: 85,
        warnings: [],
        evidence: {
          filesModified: 3,
          testsRun: true,
          mcpProgress: true,
          timeSpent: 1200
        },
        recommendation: 'Work verified successfully'
      });
  });

  describe('CRITICAL: Mandatory verification gate for DONE status', () => {
    it('should BLOCK DONE completion with low verification confidence', async () => {
      // Setup low confidence verification result (simulates false reporting)
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: false,
        confidence: 25, // VERY LOW CONFIDENCE
        warnings: [
          'No PLAN.md found - progress tracking missing',
          'No file modifications detected',
          'No test execution evidence found',
          'No MCP progress updates recorded'
        ],
        evidence: {
          filesModified: 0,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 0
        },
        recommendation: 'Cannot verify work completion - insufficient evidence'
      });

      const args = {
        status: 'DONE',
        summary: '✅ All tests fixed successfully! 37 test failures resolved, 100% pass rate achieved.',
        agent: 'senior-frontend-engineer'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow(/VERIFICATION FAILED.*25% confidence/);
      
      expect(mockVerification.verifyAgentWork)
        .toHaveBeenCalledWith(mockConfig, 'senior-frontend-engineer');
    });

    it('should ALLOW DONE completion with high verification confidence', async () => {
      // Setup high confidence verification result (real work detected)
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: true,
        confidence: 92, // HIGH CONFIDENCE
        warnings: [],
        evidence: {
          filesModified: 5,
          testsRun: true,
          mcpProgress: true,
          timeSpent: 2400
        },
        recommendation: 'Work verified with high confidence'
      });

      const args = {
        status: 'DONE',
        summary: 'Tests fixed with comprehensive verification evidence',
        agent: 'verified-agent'
      };

      // Should not throw - verification passes
      const result = await markComplete(mockConfig, args);
      
      expect(result.success).toBe(true);
      expect(mockVerification.verifyAgentWork)
        .toHaveBeenCalledWith(mockConfig, 'verified-agent');
    });

    it('should use 70% as default confidence threshold', async () => {
      // Test exactly at threshold
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: true,
        confidence: 70, // EXACTLY AT THRESHOLD
        warnings: ['Minor verification gaps'],
        evidence: {
          filesModified: 2,
          testsRun: true,
          mcpProgress: false,
          timeSpent: 600
        },
        recommendation: 'Minimal verification evidence - proceed with caution'
      });

      const args = {
        status: 'DONE',
        summary: 'Work completed with minimal verification',
        agent: 'threshold-agent'
      };

      // Should not throw - exactly at 70% threshold
      const result = await markComplete(mockConfig, args);
      expect(result.success).toBe(true);
    });

    it('should REJECT completion just below 70% threshold', async () => {
      // Test just below threshold
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: false,
        confidence: 69, // JUST BELOW THRESHOLD
        warnings: ['Insufficient verification evidence'],
        evidence: {
          filesModified: 1,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 300
        },
        recommendation: 'Verification failed - provide more evidence'
      });

      const args = {
        status: 'DONE',
        summary: 'Work claimed complete but insufficient evidence',
        agent: 'below-threshold-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow(/VERIFICATION FAILED.*69% confidence/);
    });

    it('should ALWAYS allow ERROR status regardless of verification confidence', async () => {
      // Even with zero confidence, ERROR status should be allowed
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: false,
        confidence: 0, // ZERO CONFIDENCE
        warnings: ['Complete verification failure'],
        evidence: {
          filesModified: 0,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 0
        },
        recommendation: 'No work evidence detected'
      });

      const args = {
        status: 'ERROR',
        summary: 'Task failed - unable to complete requirements',
        agent: 'error-agent'
      };

      // Should not throw - ERROR status bypasses verification gate
      const result = await markComplete(mockConfig, args);
      expect(result.success).toBe(true);
      
      // Verification should NOT be called for ERROR status (correct behavior)
      expect(mockVerification.verifyAgentWork)
        .not.toHaveBeenCalled();
    });
  });

  describe('Verification error handling', () => {
    it('should handle verification system failures gracefully', async () => {
      // Verification system itself fails
      mockVerification.verifyAgentWork.mockRejectedValue(
        new Error('Verification service unavailable')
      );

      const args = {
        status: 'DONE',
        summary: 'Work completed but verification unavailable',
        agent: 'verification-error-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow('Verification service unavailable');
    });

    it('should handle malformed verification responses', async () => {
      // Verification returns invalid data
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: true,
        confidence: NaN, // INVALID CONFIDENCE
        warnings: [],
        evidence: {
          filesModified: 0,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 0
        },
        recommendation: ''
      });

      const args = {
        status: 'DONE',
        summary: 'Work completed with invalid verification',
        agent: 'malformed-verification-agent'
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow(/Invalid verification confidence/);
    });
  });

  describe('Enhanced error messages for user guidance', () => {
    it('should provide detailed error message with verification warnings', async () => {
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: false,
        confidence: 35,
        warnings: [
          'No PLAN.md found - progress tracking missing',
          'No file modifications detected in git status',
          'No test execution logs found',
          'MCP progress shows 0% completion'
        ],
        evidence: {
          filesModified: 0,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 0
        },
        recommendation: 'Use report_progress tool and provide file modification evidence'
      });

      const args = {
        status: 'DONE',
        summary: 'Complex task completed with all requirements met',
        agent: 'detailed-error-agent'
      };

      try {
        await markComplete(mockConfig, args);
        fail('Expected verification to fail');
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Should include confidence score
        expect(errorMessage).toMatch(/35% confidence/);
        
        // Should include specific warnings
        expect(errorMessage).toMatch(/No PLAN\.md found/);
        expect(errorMessage).toMatch(/No file modifications detected/);
        expect(errorMessage).toMatch(/No test execution logs found/);
        
        // Should include recommendation
        expect(errorMessage).toMatch(/Use report_progress tool/);
      }
    });

    it('should suggest ERROR status as alternative when verification fails', async () => {
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: false,
        confidence: 15,
        warnings: ['No work evidence found'],
        evidence: {
          filesModified: 0,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 0
        },
        recommendation: 'Cannot complete with DONE status. Use ERROR status or provide evidence.'
      });

      const args = {
        status: 'DONE',
        summary: 'Work allegedly completed',
        agent: 'suggestion-agent'
      };

      try {
        await markComplete(mockConfig, args);
        fail('Expected verification to fail');
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Should suggest ERROR status as alternative
        expect(errorMessage).toMatch(/Use ERROR status.*provide evidence/);
      }
    });
  });

  describe('Performance and reliability', () => {
    it('should handle verification within reasonable time limits', async () => {
      let verificationStartTime: number;
      
      mockVerification.verifyAgentWork.mockImplementation(async () => {
        verificationStartTime = Date.now();
        
        // Simulate reasonable verification time (under 500ms as per spec)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        return {
          success: true,
          confidence: 80,
          warnings: [],
          evidence: {
            filesModified: 2,
            testsRun: true,
            mcpProgress: true,
            timeSpent: 1000
          },
          recommendation: 'Work verified successfully'
        };
      });

      const args = {
        status: 'DONE',
        summary: 'Performance tested completion',
        agent: 'performance-agent'
      };

      const operationStart = Date.now();
      const result = await markComplete(mockConfig, args);
      const operationEnd = Date.now();

      expect(result.success).toBe(true);
      
      // Total operation time should be reasonable (under 1 second for tests)
      expect(operationEnd - operationStart).toBeLessThan(1000);
      
      // Verification should have taken expected time
      expect(Date.now() - verificationStartTime!).toBeGreaterThan(150);
    });

    it('should handle concurrent verification operations', async () => {
      mockVerification.verifyAgentWork.mockImplementation(async (_config, agent) => {
        // Simulate different verification results for different agents
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return {
          success: true,
          confidence: agent === 'concurrent-1' ? 85 : 75,
          warnings: [],
          evidence: {
            filesModified: agent === 'concurrent-1' ? 3 : 2,
            testsRun: true,
            mcpProgress: true,
            timeSpent: 1200
          },
          recommendation: 'Work verified successfully'
        };
      });

      const args1 = {
        status: 'DONE',
        summary: 'First concurrent completion',
        agent: 'concurrent-1'
      };

      const args2 = {
        status: 'DONE',
        summary: 'Second concurrent completion',
        agent: 'concurrent-2'
      };

      const [result1, result2] = await Promise.all([
        markComplete(mockConfig, args1),
        markComplete(mockConfig, args2)
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockVerification.verifyAgentWork).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with existing reconciliation system', () => {
    it('should run verification before reconciliation logic', async () => {
      // This test ensures verification gate runs first, before plan reconciliation
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: false,
        confidence: 50, // FAIL VERIFICATION
        warnings: ['Low verification confidence'],
        evidence: {
          filesModified: 1,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 200
        },
        recommendation: 'Provide more evidence'
      });

      const args = {
        status: 'DONE',
        summary: 'Work completed',
        agent: 'reconciliation-agent',
        reconciliation_mode: 'auto_complete' // Should not matter - verification fails first
      };

      await expect(markComplete(mockConfig, args))
        .rejects.toThrow(/VERIFICATION FAILED/);
      
      // Verification should be called
      expect(mockVerification.verifyAgentWork).toHaveBeenCalled();
    });

    it('should allow reconciliation to proceed when verification passes', async () => {
      mockVerification.verifyAgentWork.mockResolvedValue({
        success: true,
        confidence: 80, // PASS VERIFICATION
        warnings: [],
        evidence: {
          filesModified: 3,
          testsRun: true,
          mcpProgress: true,
          timeSpent: 1500
        },
        recommendation: 'Work verified successfully'
      });

      const args = {
        status: 'DONE',
        summary: 'Work completed with reconciliation',
        agent: 'verified-reconciliation-agent',
        reconciliation_mode: 'reconcile',
        reconciliation_explanations: {
          'Unchecked Item': 'Completed via alternative approach'
        }
      };

      // Should not throw - verification passes, reconciliation can proceed
      const result = await markComplete(mockConfig, args);
      expect(result.success).toBe(true);
    });
  });
});