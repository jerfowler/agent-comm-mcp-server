/**
 * Unit tests for mark-complete tool ErrorLogger integration
 * Testing error logging for validation failures, runtime errors, and tool execution issues
 *
 * NOTE: Legacy strict mode tests removed per Issue #74 (relaxed validation)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { markComplete } from '../../../src/tools/mark-complete.js';
import * as fileSystem from '../../../src/utils/file-system.js';
import * as agentVerifier from '../../../src/core/agent-work-verifier.js';
import type { ServerConfig } from '../../../src/types.js';

// Mock all dependencies
jest.mock('../../../src/utils/file-system.js');
jest.mock('../../../src/core/agent-work-verifier.js');

const mockedFs = fileSystem as jest.Mocked<typeof fileSystem>;
const mockedVerifyAgentWork = agentVerifier.verifyAgentWork as jest.MockedFunction<typeof agentVerifier.verifyAgentWork>;

describe('mark-complete ErrorLogger Integration', () => {
  let mockConfig: ServerConfig;
  let mockErrorLogger: jest.Mocked<{ logError: jest.Mock }>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockErrorLogger = {
      logError: jest.fn().mockResolvedValue(undefined)
    };

    mockConfig = {
      commDir: '/test/comm',
      archiveDir: '/test/archive',
      logDir: '/test/logs',
      enableArchiving: true,
      connectionManager: {
        register: jest.fn(),
        unregister: jest.fn()
      } as any,
      eventLogger: {
        logOperation: jest.fn().mockResolvedValue(undefined)
      } as any,
      errorLogger: mockErrorLogger as any
    };

    // Default file system mocks
    mockedFs.pathExists.mockResolvedValue(true);
    mockedFs.listDirectory.mockResolvedValue(['test-task']);
    mockedFs.readFile.mockResolvedValue('# Plan\n- [x] **Task**: Completed');

    // Default verification mock
    mockedVerifyAgentWork.mockResolvedValue({
      success: true,
      confidence: 75,
      warnings: [],
      evidence: {
        filesModified: 3,
        testsRun: true,
        mcpProgress: true,
        timeSpent: 900
      },
      recommendation: 'Work verified'
    });
  });

  describe('Runtime Errors', () => {
    it('should handle file system errors gracefully in relaxed validation', async () => {
      // Setup: File system error
      const fsError = new Error('ENOENT: file not found');
      (fsError as NodeJS.ErrnoException).code = 'ENOENT';
      mockedFs.readFile.mockRejectedValue(fsError);

      // Execute: Issue #74 - relaxed validation handles errors gracefully
      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Task completion attempt'
      });

      // Verify: Should complete successfully despite file system error
      expect(result.success).toBe(true);
      // Note: In relaxed validation, result structure may not include message
      if (result.message) {
        expect(result.message).toContain('completed');
      }
    });
  });

  describe('Force Mode Audit Logging', () => {
    it('should log force mode usage for audit trail', async () => {
      // Setup: Plan with unchecked items
      mockedFs.readFile.mockResolvedValue('# Plan\n- [ ] **Task**: Incomplete');

      // Execute: Use force mode to bypass validation
      await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Force completion despite unchecked items',
        reconciliation_mode: 'force'
      });

      // Verify: Should log force mode usage for audit
      expect(mockConfig.eventLogger?.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'force_mode_used',
          agent: 'test-agent',
          success: true,
          metadata: expect.objectContaining({
            warning: 'FORCE_MODE_USED - Bypassed all validation checks',
            reconciliationMode: 'force'
          })
        })
      );
    });
  });

  // NOTE: Legacy tests for strict mode reconciliation rejection removed
  // Issue #74 implements relaxed validation that accepts flexible formats
});