/**
 * EventLogger Path Resolution Tests
 * Tests for Issue #50: Fix directory structure bug
 */

import { EventLogger, MockTimerDependency } from '../../../src/logging/EventLogger.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';

// Mock fs-extra-safe
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 0 })
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('EventLogger Path Resolution', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockTimerDependency: MockTimerDependency;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env['LOG_DIR'];
    jest.clearAllMocks();
    mockTimerDependency = new MockTimerDependency();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Directory Path Bug Fix', () => {
    it('should NOT create nested .logs directories when LOG_DIR is not set', () => {
      // Test that when passing './comm', it should create './comm/.logs' NOT './comm/.logs/.logs'
      const logger = new EventLogger('./comm', mockTimerDependency);
      const logDir = logger.getLogDirectory();

      // Should be './comm/.logs' not './comm/.logs/.logs'
      expect(logDir).toBe(path.resolve('./comm/.logs'));
      expect(logDir).not.toContain('.logs/.logs');
    });

    it('should NOT append .logs when directory already ends with .logs', () => {
      // Test that when passing './comm/.logs', it should NOT add another .logs
      const logger = new EventLogger('./comm/.logs', mockTimerDependency);
      const logDir = logger.getLogDirectory();

      // Should remain './comm/.logs' not become './comm/.logs/.logs'
      expect(logDir).toBe(path.resolve('./comm/.logs'));
      expect(logDir).not.toContain('.logs/.logs');
    });

    it('should respect absolute LOG_DIR environment variable', () => {
      const absolutePath = '/var/log/agent-comm';
      process.env['LOG_DIR'] = absolutePath;

      const logger = new EventLogger('./comm', mockTimerDependency);
      const logDir = logger.getLogDirectory();

      expect(logDir).toBe(absolutePath);
    });

    it('should respect relative LOG_DIR environment variable', () => {
      process.env['LOG_DIR'] = 'custom-logs';

      const logger = new EventLogger('./comm', mockTimerDependency);
      const logDir = logger.getLogDirectory();

      // Should be relative to provided logDir
      expect(logDir).toBe(path.resolve('./comm/custom-logs'));
    });

    it('should handle empty LOG_DIR environment variable', () => {
      process.env['LOG_DIR'] = '';

      const logger = new EventLogger('./comm', mockTimerDependency);
      const logDir = logger.getLogDirectory();

      // Should default to .logs subdirectory
      expect(logDir).toBe(path.resolve('./comm/.logs'));
      expect(logDir).not.toContain('.logs/.logs');
    });

    it('should handle whitespace-only LOG_DIR environment variable', () => {
      process.env['LOG_DIR'] = '   ';

      const logger = new EventLogger('./comm', mockTimerDependency);
      const logDir = logger.getLogDirectory();

      // Should default to .logs subdirectory
      expect(logDir).toBe(path.resolve('./comm/.logs'));
      expect(logDir).not.toContain('.logs/.logs');
    });

    it('should create correct log file path', async () => {
      const logger = new EventLogger('./comm', mockTimerDependency);

      // Log an operation to trigger path creation
      await logger.logOperation('test', 'test-agent');

      // Wait for write to complete
      mockTimerDependency.flushAll();
      await logger.waitForWriteQueueEmpty();

      // Check that ensureDir was called with correct path
      expect(mockedFs.ensureDir).toHaveBeenCalledWith(path.resolve('./comm/.logs'));

      // Check that appendFile was called with correct file path
      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        path.resolve('./comm/.logs/agent-comm.log'),
        expect.any(String)
      );
    });

    it('should handle undefined and test directory paths correctly', () => {
      // Test with 'undefined' as string (common bug scenario)
      const logger1 = new EventLogger('undefined', mockTimerDependency);
      expect(logger1.getLogDirectory()).toBe(path.resolve('undefined/.logs'));
      expect(logger1.getLogDirectory()).not.toContain('.logs/.logs');

      // Test with 'test/logs' path
      const logger2 = new EventLogger('test/logs', mockTimerDependency);
      expect(logger2.getLogDirectory()).toBe(path.resolve('test/logs/.logs'));
      expect(logger2.getLogDirectory()).not.toContain('.logs/.logs');
    });
  });

  describe('Path Resolution Logic', () => {
    it('should detect if path already contains .logs segment', () => {
      // Various test cases where .logs already exists in the path
      const testCases = [
        { input: './comm/.logs', expected: './comm/.logs' },
        { input: './.logs', expected: './.logs' },
        { input: 'some/path/.logs', expected: 'some/path/.logs' },
        { input: '.logs', expected: '.logs' },
        { input: 'path/.logs/subdir', expected: 'path/.logs/subdir/.logs' } // .logs in middle needs .logs at end
      ];

      testCases.forEach(({ input, expected }) => {
        const logger = new EventLogger(input, mockTimerDependency);
        const logDir = logger.getLogDirectory();
        expect(logDir).toBe(path.resolve(expected));
        expect(logDir).not.toContain('.logs/.logs');
      });
    });

    it('should add .logs to paths that do not have it', () => {
      const testCases = [
        { input: './comm', expected: './comm/.logs' },
        { input: 'test', expected: 'test/.logs' },
        { input: './data/logs', expected: './data/logs/.logs' }, // 'logs' is not '.logs'
        { input: 'mylogs', expected: 'mylogs/.logs' }
      ];

      testCases.forEach(({ input, expected }) => {
        const logger = new EventLogger(input, mockTimerDependency);
        const logDir = logger.getLogDirectory();
        expect(logDir).toBe(path.resolve(expected));
      });
    });
  });
});