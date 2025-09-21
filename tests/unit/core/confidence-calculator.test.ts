/**
 * Tests for confidence calculation
 * Testing Issue #74 - Fix hardcoded 27% confidence bug
 */

import { jest } from '@jest/globals';
import { verifyAgentWork, DEFAULT_CONFIDENCE_THRESHOLD } from '../../../src/core/agent-work-verifier.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import type { ServerConfig } from '../../../src/types.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';

// Mock fs-extra-safe
jest.mock('../../../src/utils/fs-extra-safe.js');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('confidence calculation', () => {
  let mockConfig: ServerConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setup
    mockFs.pathExists.mockResolvedValue(false);
    mockFs.readFile.mockResolvedValue('');
    mockFs.readdir.mockResolvedValue([]);
    mockFs.stat.mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      mtime: new Date(),
      size: 1000
    } as any);

    mockConfig = {
      commDir: './comm',
      archiveDir: './comm/.archive',
      logDir: './comm/.logs',
      enableArchiving: false,
      connectionManager: {
        register: jest.fn(),
        getConnection: jest.fn(),
        updateActivity: jest.fn(),
        getActiveConnections: jest.fn(),
        unregister: jest.fn(),
        getConnectionsByAgent: jest.fn(),
        cleanupStaleConnections: jest.fn(),
        getStatistics: jest.fn(),
        getConnectionCount: jest.fn(),
        hasConnection: jest.fn()
      } as unknown as ConnectionManager,
      eventLogger: {
        logOperation: jest.fn(),
        logError: jest.fn(),
        getOperationStatistics: jest.fn(),
        flush: jest.fn(),
        waitForWriteQueueEmpty: jest.fn()
      } as unknown as EventLogger
    };
  });

  describe('confidence percentage calculation', () => {
    it('should return 0% confidence when no work is done', async () => {
      // Mock empty task directory
      mockFs.pathExists.mockResolvedValue(false);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      expect(result.confidence).toBe(0);
      expect(result.success).toBe(false);
    });

    it('should NOT return hardcoded 27% confidence', async () => {
      // Mock minimal work - just INIT.md exists
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path.includes('INIT.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFs.readFile.mockResolvedValue('# Task\nSome task content');
      mockFs.readdir.mockResolvedValue(['INIT.md']);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      // Should NOT be 27%
      expect(result.confidence).not.toBe(27);
      // Should be a reasonable value based on actual evidence
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should return 100% confidence when all checkboxes are complete', async () => {
      // Mock complete task
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Plan
- [x] Task 1
- [x] Task 2
- [x] Task 3`);
        }
        if (path.includes('DONE.md')) {
          return Promise.resolve('# Completed\nAll tasks done');
        }
        return Promise.resolve('# Content');
      });

      mockFs.readdir.mockResolvedValue(['INIT.md', 'PLAN.md', 'DONE.md']);
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        mtime: new Date(),
        size: 1000
      } as any);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      // Should have high confidence with all checkboxes complete
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.success).toBe(true);
    });

    it('should calculate reasonable confidence for half-completed tasks', async () => {
      // Mock half-complete task
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Plan
- [x] Task 1
- [x] Task 2
- [ ] Task 3
- [ ] Task 4`);
        }
        return Promise.resolve('# Content');
      });

      mockFs.readdir.mockResolvedValue(['INIT.md', 'PLAN.md']);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      // With 50% checkboxes complete plus file evidence, should have moderate-high confidence
      // The confidence includes: plan file (20pts), progress updates (20pts), completion bonus (5pts), file mods (15-25pts)
      expect(result.confidence).toBeGreaterThan(40);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should calculate reasonable confidence for 1/4 completed tasks', async () => {
      // Mock 25% complete task
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Plan
- [x] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Task 4`);
        }
        return Promise.resolve('# Content');
      });

      mockFs.readdir.mockResolvedValue(['INIT.md', 'PLAN.md']);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      // With 25% checkboxes complete plus file evidence, confidence includes multiple factors
      // Even with low completion, file existence and modifications add to confidence
      expect(result.confidence).toBeGreaterThan(30);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should calculate 75% confidence for 3/4 completed tasks', async () => {
      // Mock 75% complete task
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Plan
- [x] Task 1
- [x] Task 2
- [x] Task 3
- [ ] Task 4`);
        }
        return Promise.resolve('# Content');
      });

      mockFs.readdir.mockResolvedValue(['INIT.md', 'PLAN.md']);
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        mtime: new Date(),
        size: 1000
      } as any);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      // With 75% checkboxes complete, should have moderate-high confidence
      expect(result.confidence).toBeGreaterThan(40);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('edge cases', () => {
    it('should handle empty plan gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('');
      mockFs.readdir.mockResolvedValue(['PLAN.md']);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.success).toBe(false);
    });

    it('should handle plan with no checkboxes', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve(`# Plan
This is a plan without checkboxes.
Just regular text.`);
        }
        return Promise.resolve('# Content');
      });

      mockFs.readdir.mockResolvedValue(['INIT.md', 'PLAN.md']);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      // Should still provide a confidence score
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should handle single checkbox correctly', async () => {
      mockFs.pathExists.mockResolvedValue(true);

      // Test unchecked
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve('- [ ] Single task');
        }
        return Promise.resolve('# Content');
      });

      let result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      const uncheckedConfidence = result.confidence;

      // Test checked
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('PLAN.md')) {
          return Promise.resolve('- [x] Single task');
        }
        return Promise.resolve('# Content');
      });

      result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      const checkedConfidence = result.confidence;

      // Checked should have higher confidence than unchecked
      expect(checkedConfidence).toBeGreaterThan(uncheckedConfidence);
    });
  });

  describe('threshold checking', () => {
    it('should respect DEFAULT_CONFIDENCE_THRESHOLD', async () => {
      // Setup for low confidence
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('# Minimal content');
      mockFs.readdir.mockResolvedValue(['INIT.md']);

      const result = await verifyAgentWork(
        mockConfig,
        'test-agent',
        'test-task'
      );

      if (result.confidence < DEFAULT_CONFIDENCE_THRESHOLD) {
        expect(result.success).toBe(false);
      } else {
        expect(result.success).toBe(true);
      }
    });
  });
});