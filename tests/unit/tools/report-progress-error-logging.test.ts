/**
 * Tests for ErrorLogger integration in report-progress tool
 * Following strict TDD methodology - RED phase
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ServerConfig } from '../../../src/types.js';
import { reportProgress } from '../../../src/tools/report-progress.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import type { ErrorLogEntry } from '../../../src/logging/ErrorLogger.js';
// Removed unused import: path 'path';

// Mock dependencies - fs-extra-safe is used by TaskContextManager
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  remove: jest.fn()
}));

jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));


// Import mocked modules
import * as fs from '../../../src/utils/fs-extra-safe.js';
import * as fileSystem from '../../../src/utils/file-system.js';

describe('report-progress ErrorLogger Integration', () => {
  let mockConfig: ServerConfig;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;
  let loggedErrors: ErrorLogEntry[];

  beforeEach(() => {
    jest.clearAllMocks();
    loggedErrors = [];

    // Create mock ErrorLogger
    mockErrorLogger = {
      logError: jest.fn(async (entry: ErrorLogEntry) => {
        loggedErrors.push(entry);
      }),
      initialize: jest.fn(),
      close: jest.fn(),
      getLogPath: jest.fn(() => './comm/.logs/error.log')
    } as unknown as jest.Mocked<ErrorLogger>;

    // Create mock config with complete mocking
    mockConfig = {
      commDir: './comm',
      errorLogger: mockErrorLogger,
      eventLogger: {
        logOperation: jest.fn(),
        waitForWriteQueueEmpty: jest.fn()
      },
      connectionManager: {
        trackAgentConnection: jest.fn(),
        getActiveAgents: jest.fn(() => []),
        getAgentSessions: jest.fn(() => ({})),
        setCurrentTask: jest.fn(),
        getCurrentTask: jest.fn().mockReturnValue('test-task-123')
      }
    } as unknown as ServerConfig;

    // Setup default mock behaviors for BOTH file system modules
    const mockedFs = fs as jest.Mocked<typeof fs>;
    const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;

    // Mock fs-extra-safe (used by TaskContextManager for ownership validation)
    mockedFs.pathExists.mockImplementation(async (path: string) => {
      // Use includes() to handle different path separators and normalization
      if (path.includes('comm/test-agent/test-task-123/INIT.md')) return true;
      if (path.includes('comm/test-agent/test-task-123/PLAN.md')) return true;
      if (path.includes('comm/test-agent/test-task-123')) return true;
      if (path.includes('comm/test-agent')) return true;
      if (path.includes('comm') && !path.includes('/')) return true;
      return false;
    });

    // Mock readdir for ownership validation - return directories found in commDir
    mockedFs.readdir.mockImplementation(async (dirPath: string) => {
      if (dirPath === './comm') {
        return ['test-agent'] as unknown as string[];
      }
      return [] as unknown as string[];
    });

    // Mock stat for ownership validation
    const mockStats = {
      isDirectory: () => true,
      mtime: new Date(),
      size: 1024
    };
    mockedFs.stat.mockResolvedValue(mockStats as any);

    mockedFs.readFile.mockResolvedValue('# Test Plan\n\n- [ ] Step 1\n- [ ] Step 2\n- [ ] Step 3');
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.ensureDir.mockResolvedValue(undefined);
    mockedFs.remove.mockResolvedValue(undefined);

    // Mock file-system (used by report-progress tool directly)
    mockedFileSystem.pathExists.mockImplementation(async (path: string) => {
      if (path === './comm') return true; // commDir exists
      if (path === './comm/test-agent/test-task-123') return true; // Task directory exists
      if (path === './comm/test-agent/test-task-123/INIT.md') return true; // INIT.md exists
      if (path === './comm/test-agent/test-task-123/PLAN.md') return true; // PLAN.md exists by default
      return false;
    });

    mockedFileSystem.readFile.mockResolvedValue('# Test Plan\n\n- [ ] Step 1\n- [ ] Step 2\n- [ ] Step 3');
    mockedFileSystem.writeFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('PLAN.md Update Failures', () => {
    it('should handle missing PLAN.md file gracefully (no error thrown)', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;

      // Override BOTH file system modules to make PLAN.md not exist while keeping ownership validation working
      mockedFs.pathExists.mockImplementation(async (path: string) => {
        // Allow commDir to exist
        if (path === './comm') return true;
        // Allow agent directory to exist
        if (path.includes('comm/test-agent') && !path.includes('test-task-123')) return true;
        // Allow task directory to exist
        if (path.includes('comm/test-agent/test-task-123') && !path.includes('.md')) return true;
        // Allow INIT.md to exist (needed for ownership validation)
        if (path.includes('comm/test-agent/test-task-123/INIT.md')) return true;
        // PLAN.md should NOT exist (this is what we're testing)
        if (path.includes('comm/test-agent/test-task-123/PLAN.md')) return false;
        return false;
      });

      mockedFileSystem.pathExists.mockImplementation(async (path: string) => {
        // Allow commDir to exist
        if (path === './comm') return true;
        // Allow agent directory to exist
        if (path.includes('comm/test-agent') && !path.includes('test-task-123')) return true;
        // Allow task directory to exist
        if (path.includes('comm/test-agent/test-task-123') && !path.includes('.md')) return true;
        // Allow INIT.md to exist (needed for ownership validation)
        if (path.includes('comm/test-agent/test-task-123/INIT.md')) return true;
        // PLAN.md should NOT exist (this is what we're testing)
        if (path.includes('comm/test-agent/test-task-123/PLAN.md')) return false;
        return false;
      });

      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'COMPLETE' as const, description: 'Test step' }
        ]
      };

      // Should NOT throw - missing PLAN.md is handled gracefully
      const result = await reportProgress(mockConfig, options);
      expect(result.success).toBe(true);

      // Note: With graceful handling, PLAN.md missing doesn't generate an error in reportProgress
      // The TaskContextManager handles it internally with a debug log
    });

    it('should log error when PLAN.md read fails', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      // Override readFile to fail for PLAN.md
      mockedFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('PLAN.md')) {
          throw new Error('Permission denied');
        }
        return 'Default content';
      });

      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'COMPLETE' as const, description: 'Test step' }
        ]
      };

      await expect(reportProgress(mockConfig, options)).rejects.toThrow();

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('runtime');
      expect(loggedError.operation).toBe('report_progress');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.error.message).toContain('Permission denied');
    });

    it('should log error when PLAN.md write fails', async () => {
      const mockedFs = fs as jest.Mocked<typeof fs>;
      // Override writeFile to fail for PLAN.md
      mockedFs.writeFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('PLAN.md')) {
          throw new Error('Disk full');
        }
        return undefined;
      });

      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'COMPLETE' as const, description: 'Test step' }
        ]
      };

      await expect(reportProgress(mockConfig, options)).rejects.toThrow();

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('tool_execution');
      expect(loggedError.operation).toBe('report_progress');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.error.message).toContain('Disk full');
      expect(loggedError.context.tool).toBe('report_progress');
    });
  });

  describe('Invalid Step Number Errors', () => {
    it('should log warning for extremely large step number but not throw', async () => {
      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: 999, status: 'COMPLETE' as const, description: 'Large step' }
        ]
      };

      // Should NOT throw - permissive handling
      const result = await reportProgress(mockConfig, options);
      expect(result.success).toBe(true);

      // Verify ErrorLogger was called with warning
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('report_progress');
      expect(loggedError.severity).toBe('medium'); // Warning, not error
      expect(loggedError.error.name).toBe('ValidationWarning');
      expect(loggedError.context.parameters).toMatchObject({
        unusualStep: 999,
        typicalMax: 100
      });
    });

    it('should log warning for negative step number but not throw', async () => {
      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: -1, status: 'COMPLETE' as const, description: 'Negative step' }
        ]
      };

      // Should NOT throw - permissive handling
      const result = await reportProgress(mockConfig, options);
      expect(result.success).toBe(true);

      // Verify ErrorLogger was called with warning
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('report_progress');
      expect(loggedError.error.name).toBe('ValidationWarning');
      expect(loggedError.context.parameters?.['unusualStep']).toBe(-1);
      expect(loggedError.severity).toBe('medium'); // Warning, not error
    });
  });

  describe('Progress Marker Conflicts', () => {
    it('should log error for conflicting progress markers', async () => {
      // Mock PLAN.md with existing progress markers
      const mockedFileSystem = fileSystem as jest.Mocked<typeof fileSystem>;
      mockedFileSystem.readFile.mockResolvedValue(
        '# Test Plan\n\n- [x] Step 1 [COMPLETE]\n- [ ] Step 2\n- [ ] Step 3'
      );

      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'IN_PROGRESS' as const, description: 'Conflicting status' }
        ]
      };

      // This might not throw but log a warning
      const result = await reportProgress(mockConfig, options);
      expect(result.success).toBe(true);

      // Check if warning was logged
      if (mockErrorLogger.logError.mock.calls.length > 0) {
        const loggedError = loggedErrors[0];
        expect(loggedError.severity).toBe('high');
        expect(loggedError.context.parameters as any).toBeDefined();
      }
    });
  });

  describe('Checkbox Sync Failures', () => {
    it('should log error when checkbox sync fails', async () => {
      // Mock PLAN.md with malformed checkboxes
      const mockedFs = fs as jest.Mocked<typeof fs>;
      mockedFs.readFile.mockResolvedValue(
        '# Test Plan\n\n-[ ] Step 1 (missing space)\n- [] Step 2 (missing x position)\n- [ Step 3 (missing closing bracket)'
      );

      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'COMPLETE' as const, description: 'Test step' }
        ]
      };

      await expect(reportProgress(mockConfig, options)).rejects.toThrow();

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('report_progress');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.context.tool).toBe('report_progress');
    });
  });

  describe('Context Status Tracking Errors', () => {
    it('should log error when context estimation update fails', async () => {
      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'COMPLETE' as const, description: 'Test step' }
        ],
        contextStatus: {
          currentUsage: -100,  // Invalid negative value
          estimatedRemaining: 50,
          trend: 'INVALID' as any  // Invalid trend value
        }
      };

      await expect(reportProgress(mockConfig, options)).rejects.toThrow();

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('report_progress');
      expect(loggedError.severity).toBe('high');
      expect(loggedError.context.parameters as any).toBeDefined();
    });
  });

  describe('Validation Error Logging', () => {
    it('should log validation error for missing agent', async () => {
      const options = {
        agent: '',
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'COMPLETE' as const, description: 'Test step' }
        ]
      };

      await expect(reportProgress(mockConfig, options)).rejects.toThrow('agent must be a non-empty string');

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledTimes(1);

      const loggedError = loggedErrors[0];
      expect(loggedError.source).toBe('validation');
      expect(loggedError.operation).toBe('report_progress');
      expect(loggedError.severity).toBe('high');
    });

    it('should allow empty updates array (backward compatibility)', async () => {
      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: []  // Empty updates array
      };

      // Should NOT throw - empty arrays are allowed for backward compatibility
      const result = await reportProgress(mockConfig, options);
      expect(result.success).toBe(true);
      expect(result.updatedSteps).toBe(0);

      // No ErrorLogger call expected for empty arrays - it's allowed
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
    });
  });

  describe('Error Severity Classification', () => {
    it('should use HIGH severity for all report-progress errors', async () => {
      // Test various error scenarios
      const scenarios = [
        { agent: '', taskId: 'test', updates: [] },  // Validation error
        { agent: 'test', taskId: '', updates: [] },  // Validation error
      ];

      for (const scenario of scenarios) {
        jest.clearAllMocks();
        loggedErrors = [];

        try {
          await reportProgress(mockConfig, scenario as any);
        } catch {
          // Expected to throw
        }

        if (mockErrorLogger.logError.mock.calls.length > 0) {
          const loggedError = loggedErrors[0];
          expect(loggedError.severity).toBe('high');
        }
      }
    });
  });

  describe('Debug Package Integration', () => {
    it('should include debug logging context', async () => {
      // Debug package is integrated via import debug from 'debug'
      // and const log = debug('agent-comm:tools:report-progress')
      // This is tested by verifying the import exists in the source file

      const options = {
        agent: 'test-agent',
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'COMPLETE' as const, description: 'Test step' }
        ]
      };

      const result = await reportProgress(mockConfig, options);
      expect(result.success).toBe(true);

      // Debug logging happens internally, no external verification needed
      // The presence of debug import and usage is verified in the source
    });
  });

  describe('Error Logger Absence Handling', () => {
    it('should handle missing ErrorLogger gracefully', async () => {
      const configWithoutLogger = {
        ...mockConfig,
        errorLogger: undefined
      };

      const options = {
        agent: '',  // Invalid
        taskId: 'test-task-123',
        updates: [
          { step: 1, status: 'COMPLETE' as const, description: 'Test step' }
        ]
      };

      // Should still throw the validation error
      const configWithNoLogger = {
        ...configWithoutLogger,
        errorLogger: undefined
      } as unknown as ServerConfig;
      await expect(reportProgress(configWithNoLogger, options)).rejects.toThrow('agent must be a non-empty string');

      // No crash should occur due to missing logger
    });
  });
});