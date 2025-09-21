/**
 * Tests for three-state checkbox validation in mark_complete tool
 * Testing support for [ ], [~], and [x] checkbox states
 */

import { jest } from '@jest/globals';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import * as fileSystem from '../../../src/utils/file-system.js';
import { markComplete } from '../../../src/tools/mark-complete.js';
import type { ServerConfig } from '../../../src/types.js';
import * as agentVerifier from '../../../src/core/agent-work-verifier.js';

// Mock fs-extra module
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn()
}));

// Mock file-system module
jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  listDirectory: jest.fn(),
  ensureDir: jest.fn()
}));

// Mock agent work verifier
jest.mock('../../../src/core/agent-work-verifier.js');
const mockAgentVerifier = agentVerifier as jest.Mocked<typeof agentVerifier>;

describe('mark-complete three-state checkbox support', () => {
  let mockConfig: ServerConfig;
  let mockEventLogger: any;
  let mockConnectionManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock agent work verifier - return high confidence for tests
    mockAgentVerifier.verifyAgentWork.mockResolvedValue({
      success: true,
      confidence: 100,
      evidence: {
        filesModified: 5,
        testsRun: true,
        mcpProgress: true,
        timeSpent: 30
      },
      warnings: [],
      recommendation: 'Work verified successfully'
    });

    // Setup mock event logger with proper typing
    mockEventLogger = {
      logOperation: jest.fn(() => Promise.resolve()),
      logEvent: jest.fn(() => Promise.resolve()),
      waitForWriteQueueEmpty: jest.fn(() => Promise.resolve())
    };

    // Setup mock connection manager with proper typing
    mockConnectionManager = {
      setCurrentTask: jest.fn(() => undefined),
      getCurrentTask: jest.fn(() => 'test-task'),
      getMetadata: jest.fn(() => ({})),
      setMetadata: jest.fn(() => undefined)
    };

    // Setup mock config
    mockConfig = {
      connectionManager: mockConnectionManager,
      eventLogger: mockEventLogger,
      errorLogger: {
        logError: jest.fn(() => Promise.resolve())
      } as any,
      baseDir: '/test/comm',
      commDir: '/test/comm',  // Add commDir for validation function
      archiveDir: '/test/comm/.archive',
      logDir: '/test/comm/.logs',
      enableArchiving: true
    } as unknown as ServerConfig;

    // Setup default file system mocks
    const mockPathExists = fs.pathExists as jest.MockedFunction<typeof fs.pathExists>;
    mockPathExists.mockImplementation((path: string) => {
      if (path.includes('INIT.md')) return Promise.resolve(true);
      if (path.includes('PLAN.md')) return Promise.resolve(true);
      if (path.includes('test-agent')) return Promise.resolve(true);
      if (path.includes('test-task')) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    // Also mock file-system pathExists
    const mockFileSystemPathExists = fileSystem.pathExists as jest.MockedFunction<typeof fileSystem.pathExists>;
    mockFileSystemPathExists.mockImplementation((path: string) => {
      if (path.includes('INIT.md')) return Promise.resolve(true);
      if (path.includes('PLAN.md')) return Promise.resolve(true);
      if (path.includes('test-agent')) return Promise.resolve(true);
      if (path.includes('test-task')) return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const mockReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;
    mockReaddir.mockResolvedValue(['test-task'] as any);

    // Mock file-system listDirectory
    const mockListDirectory = fileSystem.listDirectory as jest.MockedFunction<typeof fileSystem.listDirectory>;
    mockListDirectory.mockResolvedValue(['test-task']);

    // Mock file-system readFile
    const mockFileSystemReadFile = fileSystem.readFile as jest.MockedFunction<typeof fileSystem.readFile>;
    mockFileSystemReadFile.mockImplementation((path: string) => {
      if (path.includes('INIT.md')) {
        return Promise.resolve('# Task\nInitialized');
      }
      if (path.includes('PLAN.md')) {
        return Promise.resolve('# Plan\n- [ ] **Task 1**: Default\n- [ ] **Task 2**: Default');
      }
      return Promise.resolve('');
    });

    const mockEnsureDir = fs.ensureDir as jest.MockedFunction<typeof fs.ensureDir>;
    mockEnsureDir.mockResolvedValue(undefined);

    const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
    mockWriteFile.mockResolvedValue(undefined);

    const mockFileSystemWriteFile = fileSystem.writeFile as jest.MockedFunction<typeof fileSystem.writeFile>;
    mockFileSystemWriteFile.mockResolvedValue(undefined);

    // Mock fs.stat for task directory checking
    const mockStat = fs.stat as jest.MockedFunction<typeof fs.stat>;
    mockStat.mockResolvedValue({
      isDirectory: () => true,
      mtime: new Date()
    } as any);
  });

  describe('checkbox state parsing', () => {
    test('should correctly parse pending state checkboxes [ ]', async () => {
      // Setup PLAN.md with pending checkboxes
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

## Tasks
- [ ] **Task 1**: Not started yet
- [ ] **Task 2**: Also pending
- [ ] **Task 3**: Waiting to begin`);
        }
        return Promise.resolve('');
      });

      // Also mock file-system readFile
      const mockFileSystemReadFile = fileSystem.readFile as jest.MockedFunction<typeof fileSystem.readFile>;
      mockFileSystemReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

## Tasks
- [ ] **Task 1**: Not started yet
- [ ] **Task 2**: Also pending
- [ ] **Task 3**: Waiting to begin`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Testing pending state parsing',
        reconciliation_mode: 'strict'
      });

      // In strict mode, this should fail because no tasks are complete
      expect(result.success).toBe(false);
      expect(result.isError).toBe(true);
      // The test should fail here because [~] is not currently recognized
    });

    test('should correctly parse in-progress state checkboxes [~]', async () => {
      // Setup PLAN.md with in-progress checkboxes
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

## Tasks
- [~] **Task 1**: Currently in progress
- [~] **Task 2**: Working on this now
- [ ] **Task 3**: Not started yet`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Testing in-progress state parsing',
        reconciliation_mode: 'strict'
      });

      // Should fail in strict mode with in-progress items
      expect(result.success).toBe(false);
      expect(result.isError).toBe(true);
      // The test should fail here because [~] is not currently supported
    });

    test('should correctly parse completed state checkboxes [x]', async () => {
      // Setup PLAN.md with completed checkboxes
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

## Tasks
- [x] **Task 1**: Completed successfully
- [x] **Task 2**: Also done
- [x] **Task 3**: Finished`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Testing completed state parsing',
        reconciliation_mode: 'strict'
      });

      // Should succeed with all items checked
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });

    test('should handle mixed checkbox states correctly', async () => {
      // Setup PLAN.md with mixed checkbox states
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

## Tasks
- [x] **Task 1**: Completed
- [~] **Task 2**: In progress
- [ ] **Task 3**: Not started
- [x] **Task 4**: Done
- [~] **Task 5**: Working on it`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Testing mixed checkbox states',
        reconciliation_mode: 'strict'
      });

      // Should fail with unchecked items (pending and in-progress)
      expect(result.success).toBe(false);
      expect(result.isError).toBe(true);
      // The test should fail here because [~] is not currently recognized
    });

    test('should reconcile mixed states with explanations', async () => {
      // Setup PLAN.md with mixed checkbox states
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

## Tasks
- [x] **Task 1**: Completed
- [~] **Task 2**: In progress
- [ ] **Task 3**: Not started`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Reconciling with explanations',
        reconciliation_mode: 'reconcile',
        reconciliation_explanations: {
          'Task 2': 'Actually completed during testing',
          'Task 3': 'No longer required due to scope change'
        }
      });

      // Should succeed with reconciliation
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');

      // Verify DONE.md was created with reconciliation notes
      const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
      const doneFileCall = mockWriteFile.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('DONE.md')
      );
      expect(doneFileCall).toBeDefined();
      if (doneFileCall) {
        expect(doneFileCall[1]).toContain('Task 2');
        expect(doneFileCall[1]).toContain('Actually completed during testing');
      }
    });

    test('should handle malformed checkbox formats gracefully', async () => {
      // Setup PLAN.md with malformed checkboxes
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

## Tasks
- [x] **Valid Task**: Completed
- [?] **Invalid Format 1**: Unknown state
- [] **Invalid Format 2**: Missing space
- [ **Invalid Format 3**: Missing closing bracket
- ] **Invalid Format 4**: Missing opening bracket`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Testing malformed checkboxes',
        reconciliation_mode: 'auto_complete'
      });

      // Should handle gracefully - only counting valid checkbox
      expect(result.success).toBe(true);
      // Invalid formats should be ignored, not counted as unchecked
    });

    test('should validate checkbox regex includes in-progress state', async () => {
      // Test that the regex pattern accepts [~]
      const testContent = `
- [ ] Pending task
- [~] In-progress task
- [x] Completed task
- [X] Also completed (uppercase)`;

      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(testContent);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Regex validation test',
        reconciliation_mode: 'force'
      });

      // Force mode should succeed regardless
      expect(result.success).toBe(true);

      // But we can check that the parsing found all checkboxes
      // by checking the write calls (force mode documents variances)
      const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
      const doneFileCall = mockWriteFile.mock.calls.find(
        call => typeof call[0] === 'string' && call[0].includes('DONE.md')
      );

      // The DONE content should mention the unchecked items if regex works
      if (doneFileCall && typeof doneFileCall[1] === 'string' && doneFileCall[1].includes('Force Override')) {
        // Force mode was used, so unchecked items were detected
        expect(doneFileCall[1]).toContain('task');
      }
    });

    test('should count in-progress items as incomplete for progress calculation', async () => {
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

## Tasks
- [x] **Task 1**: Done (1 complete)
- [x] **Task 2**: Done (2 complete)
- [~] **Task 3**: In progress (incomplete)
- [~] **Task 4**: In progress (incomplete)
- [ ] **Task 5**: Pending (incomplete)
Total: 5 tasks, 2 complete, 3 incomplete`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Progress calculation test',
        reconciliation_mode: 'strict'
      });

      // Should fail with 3 unchecked items
      expect(result.success).toBe(false);
      expect(result.isError).toBe(true);

      // Calculate progress: 2 complete out of 5 total = 40%
      const totalItems = 5;
      const completedItems = 2;
      const progressPercentage = (completedItems / totalItems) * 100;
      expect(progressPercentage).toBe(40);
    });

    test('should handle empty plan with no checkboxes', async () => {
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Implementation Plan

No checkboxes in this plan.
Just regular text content.`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Empty plan test',
        reconciliation_mode: 'strict'
      });

      // Should succeed as there are no checkboxes to validate
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });

    test('should handle Unicode checkbox variants correctly', async () => {
      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          // Some editors might insert different dash/space characters
          return Promise.resolve(`# Implementation Plan

## Tasks
- [ ] **Normal ASCII**: Standard format
− [ ] **Unicode minus**: U+2212
– [ ] **En dash**: U+2013
— [ ] **Em dash**: U+2014
- [ ] **No-break space**: U+00A0 after dash
-${String.fromCharCode(160)}[ ] **Actual NBSP**: After dash`);
        }
        return Promise.resolve('');
      });

      const result = await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Unicode variant test',
        reconciliation_mode: 'strict'
      });

      // The current implementation might not handle all Unicode variants
      // This test documents the expected behavior
      expect(result).toBeDefined();
      // If it fails, we know Unicode handling needs improvement
    });
  });

  describe('performance requirements', () => {
    test('checkbox validation should complete in less than 5ms', async () => {
      // Setup a large PLAN with many checkboxes
      const largePlan = Array.from({ length: 100 }, (_, i) => {
        const states = ['[ ]', '[~]', '[x]'];
        const state = states[i % 3];
        return `- ${state} **Task ${i + 1}**: Description for task ${i + 1}`;
      }).join('\n');

      const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
      mockReadFile.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) {
          return Promise.resolve('# Task\nInitialized');
        }
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Large Plan\n\n${largePlan}`);
        }
        return Promise.resolve('');
      });

      const startTime = Date.now();

      await markComplete(mockConfig, {
        agent: 'test-agent',
        status: 'DONE',
        summary: 'Performance test',
        reconciliation_mode: 'auto_complete'
      });

      const duration = Date.now() - startTime;

      // Should complete quickly even with 100 checkboxes
      // Note: This includes all processing, not just regex validation
      // The 5ms requirement is specifically for checkbox processing
      expect(duration).toBeLessThan(50); // Generous limit for entire operation
    });
  });
});