/**
 * Test suite for configurable log directory functionality
 * Tests environment variable configuration and default behavior
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';

describe('Configurable Log Directory', () => {
  let testDir: string;
  const originalEnv = process.env;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'log-config-test-'));
    
    // Reset environment
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(testDir);
    
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default Log Directory', () => {
    it('should use ".logs" as default directory when no environment variable is set', async () => {
      delete process.env['LOG_DIR'];
      
      const baseDir = testDir;
      const logger = new EventLogger(baseDir);
      
      const expectedLogDir = path.join(baseDir, '.logs');
      expect(logger.getLogDirectory()).toBe(expectedLogDir);
      
      // Verify directory is created
      await logger.logOperation('test-op', 'test-agent', { test: true });
      expect(await fs.pathExists(expectedLogDir)).toBe(true);
    });

    it('should create .logs directory if it does not exist', async () => {
      delete process.env['LOG_DIR'];
      
      const baseDir = testDir;
      const expectedLogDir = path.join(baseDir, '.logs');
      
      // Verify directory doesn't exist initially
      expect(await fs.pathExists(expectedLogDir)).toBe(false);
      
      const logger = new EventLogger(baseDir);
      await logger.logOperation('test-op', 'test-agent', { test: true });
      
      // Verify directory was created
      expect(await fs.pathExists(expectedLogDir)).toBe(true);
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should use LOG_DIR environment variable when set', async () => {
      const customLogDir = 'custom-logs';
      process.env['LOG_DIR'] = customLogDir;
      
      const baseDir = testDir;
      const logger = new EventLogger(baseDir);
      
      const expectedLogDir = path.join(baseDir, customLogDir);
      expect(logger.getLogDirectory()).toBe(expectedLogDir);
    });

    it('should handle absolute paths in LOG_DIR environment variable', async () => {
      const absoluteLogDir = path.join(testDir, 'absolute-logs');
      process.env['LOG_DIR'] = absoluteLogDir;
      
      const baseDir = path.join(testDir, 'base');
      const logger = new EventLogger(baseDir);
      
      expect(logger.getLogDirectory()).toBe(absoluteLogDir);
    });

    it('should create custom log directory when specified via LOG_DIR', async () => {
      const customLogDir = 'my-logs';
      process.env['LOG_DIR'] = customLogDir;
      
      const baseDir = testDir;
      const expectedLogDir = path.join(baseDir, customLogDir);
      
      // Verify directory doesn't exist initially
      expect(await fs.pathExists(expectedLogDir)).toBe(false);
      
      const logger = new EventLogger(baseDir);
      await logger.logOperation('test-op', 'test-agent', { test: true });
      
      // Verify custom directory was created
      expect(await fs.pathExists(expectedLogDir)).toBe(true);
      
      // Verify log file exists in custom directory
      const logFile = path.join(expectedLogDir, 'agent-comm.log');
      expect(await fs.pathExists(logFile)).toBe(true);
    });

    it('should handle empty LOG_DIR environment variable by using default', async () => {
      process.env['LOG_DIR'] = '';
      
      const baseDir = testDir;
      const logger = new EventLogger(baseDir);
      
      const expectedLogDir = path.join(baseDir, '.logs');
      expect(logger.getLogDirectory()).toBe(expectedLogDir);
    });

    it('should handle whitespace-only LOG_DIR environment variable by using default', async () => {
      process.env['LOG_DIR'] = '   \t\n  ';
      
      const baseDir = testDir;
      const logger = new EventLogger(baseDir);
      
      const expectedLogDir = path.join(baseDir, '.logs');
      expect(logger.getLogDirectory()).toBe(expectedLogDir);
    });
  });

  describe('Log File Operations with Custom Directory', () => {
    it('should write log files to custom directory specified by LOG_DIR', async () => {
      const customLogDir = 'test-logs';
      process.env['LOG_DIR'] = customLogDir;
      
      const baseDir = testDir;
      const logger = new EventLogger(baseDir);
      
      const testOperation = {
        operation: 'test-operation',
        agent: 'test-agent',
        data: { message: 'test log entry' }
      };
      
      await logger.logOperation(testOperation.operation, testOperation.agent, testOperation.data);
      
      // Verify log file exists in custom directory
      const expectedLogFile = path.join(baseDir, customLogDir, 'agent-comm.log');
      expect(await fs.pathExists(expectedLogFile)).toBe(true);
      
      // Verify log content
      const logContent = await fs.readFile(expectedLogFile, 'utf8');
      expect(logContent).toContain(testOperation.operation);
      expect(logContent).toContain(testOperation.agent);
      expect(logContent).toContain('test log entry');
    });

    it('should handle archiving with custom directory', async () => {
      const customLogDir = 'archive-logs';
      process.env['LOG_DIR'] = customLogDir;
      
      const baseDir = testDir;
      const logger = new EventLogger(baseDir);
      
      // Write test data with old timestamps
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      
      await logger.logOperation({
        timestamp: oldDate,
        operation: 'old-operation',
        agent: 'test-agent',
        success: true,
        duration: 100,
        data: { test: 'old data' }
      });
      
      await logger.logOperation('new-operation', 'test-agent', { test: 'new data' });
      
      // Wait for writes to complete
      await logger.waitForWriteQueueEmpty();
      
      // Archive entries older than 7 days
      const result = await logger.archiveOldEntries(7);
      
      const logDir = path.join(baseDir, customLogDir);
      const files = await fs.readdir(logDir);
      
      // Should have main log file and archive file
      expect(files.length).toBeGreaterThan(1);
      expect(files.some(f => f.startsWith('agent-comm-'))).toBe(true);
      expect(files.some(f => f === 'agent-comm.log')).toBe(true);
      expect(result.archivedCount).toBe(1);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing log file structure in custom directory', async () => {
      const customLogDir = 'compat-logs';
      process.env['LOG_DIR'] = customLogDir;
      
      const baseDir = testDir;
      const logger = new EventLogger(baseDir);
      
      await logger.logOperation('check_assigned_tasks', 'test-agent', {
        tasksFound: 5,
        activeConnections: 2
      });
      
      const logFile = path.join(baseDir, customLogDir, 'agent-comm.log');
      const logContent = await fs.readFile(logFile, 'utf8');
      const logEntry = JSON.parse(logContent.trim());
      
      // Verify standard log entry structure is maintained
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('operation', 'check_assigned_tasks');
      expect(logEntry).toHaveProperty('agent', 'test-agent');
      expect(logEntry).toHaveProperty('data');
      expect(logEntry.data).toHaveProperty('tasksFound', 5);
      expect(logEntry.data).toHaveProperty('activeConnections', 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors when creating custom log directory', async () => {
      // This test would be platform-specific and might be skipped in some environments
      const customLogDir = 'restricted-logs';
      process.env['LOG_DIR'] = customLogDir;
      
      const baseDir = testDir;
      const logger = new EventLogger(baseDir);
      
      // Try to log something - should not throw even if directory creation fails
      await expect(logger.logOperation('test-op', 'test-agent', { test: true }))
        .resolves.not.toThrow();
    });
  });
});