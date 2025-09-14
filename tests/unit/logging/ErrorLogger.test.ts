/**
 * ErrorLogger Tests
 * Tests for Issue #50: Enhanced Error Logging System
 */

import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import { MockTimerDependency } from '../../../src/logging/EventLogger.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import type { ErrorLogEntry } from '../../../src/logging/ErrorLogger.js';

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

describe('ErrorLogger', () => {
  let errorLogger: ErrorLogger;
  let mockTimerDependency: MockTimerDependency;
  const testLogDir = './test-logs';

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimerDependency = new MockTimerDependency();
    errorLogger = new ErrorLogger(testLogDir, mockTimerDependency);
  });

  describe('Constructor', () => {
    it('should initialize with correct paths', () => {
      expect(errorLogger.getLogDirectory()).toBe(path.resolve(testLogDir, '.logs'));
      expect(errorLogger.getErrorLogPath()).toBe(path.resolve(testLogDir, '.logs', 'error.log'));
    });

    it('should handle LOG_DIR environment variable', () => {
      process.env['LOG_DIR'] = 'custom-error-logs';
      const customLogger = new ErrorLogger(testLogDir, mockTimerDependency);
      expect(customLogger.getLogDirectory()).toBe(path.resolve(testLogDir, 'custom-error-logs'));
      delete process.env['LOG_DIR'];
    });
  });

  describe('logError', () => {
    it('should log error entries to error.log', async () => {
      const errorEntry: ErrorLogEntry = {
        timestamp: new Date('2025-01-14T10:00:00Z'),
        source: 'tool_execution',
        operation: 'create_task',
        agent: 'test-agent',
        taskId: 'task-123',
        error: {
          message: 'Task creation failed',
          name: 'ValidationError',
          code: 'INVALID_PARAMS',
          stack: 'Error stack trace...'
        },
        context: {
          tool: 'create_task',
          parameters: { agent: 'test-agent', taskName: 'test' },
          retryCount: 1
        },
        severity: 'high',
        metadata: { version: '1.0.0' }
      };

      await errorLogger.logError(errorEntry);

      // Flush timer to process write queue
      mockTimerDependency.flushAll();
      await errorLogger.waitForWriteQueueEmpty();

      // Verify error.log was created
      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        path.resolve(testLogDir, '.logs', 'error.log'),
        expect.stringContaining('Task creation failed')
      );

      // Verify agent-comm.log also gets the entry (parent EventLogger)
      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        path.resolve(testLogDir, '.logs', 'agent-comm.log'),
        expect.any(String)
      );
    });

    it('should categorize severity correctly', async () => {
      const criticalError: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'runtime',
        operation: 'system_init',
        agent: 'system',
        error: {
          message: 'Database connection failed',
          name: 'ConnectionError'
        },
        context: {},
        severity: 'critical'
      };

      await errorLogger.logError(criticalError);
      mockTimerDependency.flushAll();
      await errorLogger.waitForWriteQueueEmpty();

      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('error.log'),
        expect.stringContaining('"severity":"critical"')
      );
    });
  });

  describe('Error Analysis', () => {
    beforeEach(() => {
      // Mock reading error log with sample data
      const sampleErrors = [
        {
          timestamp: new Date('2025-01-14T10:00:00Z'),
          source: 'tool_execution',
          operation: 'create_task',
          agent: 'agent-1',
          error: { message: 'Validation failed', name: 'ValidationError' },
          context: { tool: 'create_task' },
          severity: 'medium'
        },
        {
          timestamp: new Date('2025-01-14T10:01:00Z'),
          source: 'tool_execution',
          operation: 'create_task',
          agent: 'agent-1',
          error: { message: 'Validation failed', name: 'ValidationError' },
          context: { tool: 'create_task' },
          severity: 'medium'
        },
        {
          timestamp: new Date('2025-01-14T10:02:00Z'),
          source: 'network',
          operation: 'api_call',
          agent: 'agent-2',
          error: { message: 'Connection timeout', name: 'NetworkError' },
          context: {},
          severity: 'high'
        }
      ];

      mockedFs.readFile.mockResolvedValue(
        sampleErrors.map(e => JSON.stringify(e)).join('\n')
      );
      mockedFs.pathExists.mockResolvedValue(true);
    });

    it('should analyze error patterns', async () => {
      const analysis = await errorLogger.analyzeErrorPatterns();

      expect(analysis.totalErrors).toBe(3);
      expect(analysis.errorsBySource['tool_execution']).toBe(2);
      expect(analysis.errorsBySource['network']).toBe(1);
      expect(analysis.errorsBySeverity['medium']).toBe(2);
      expect(analysis.errorsBySeverity['high']).toBe(1);
    });

    it('should identify common error patterns', async () => {
      const analysis = await errorLogger.analyzeErrorPatterns();

      expect(analysis.commonPatterns).toContainEqual(
        expect.objectContaining({
          pattern: 'ValidationError: Validation failed',
          frequency: 2
        })
      );
    });

    it('should calculate agent error rates', async () => {
      const analysis = await errorLogger.analyzeErrorPatterns();

      expect(analysis.agentErrorRates['agent-1']).toEqual(
        expect.objectContaining({
          totalErrors: 2,
          mostCommonErrors: expect.arrayContaining(['ValidationError'])
        })
      );
    });
  });

  describe('Error Filtering', () => {
    beforeEach(() => {
      const errors = [
        {
          timestamp: new Date('2025-01-14T10:00:00Z'),
          source: 'tool_execution',
          operation: 'create_task',
          agent: 'agent-1',
          error: { message: 'Error 1', name: 'Error' },
          context: {},
          severity: 'low'
        },
        {
          timestamp: new Date('2025-01-14T11:00:00Z'),
          source: 'network',
          operation: 'api_call',
          agent: 'agent-2',
          error: { message: 'Error 2', name: 'Error' },
          context: {},
          severity: 'high'
        }
      ];

      mockedFs.readFile.mockResolvedValue(
        errors.map(e => JSON.stringify(e)).join('\n')
      );
      mockedFs.pathExists.mockResolvedValue(true);
    });

    it('should filter errors by agent', async () => {
      const errors = await errorLogger.getErrorsByAgent('agent-1');
      expect(errors).toHaveLength(1);
      expect(errors[0].agent).toBe('agent-1');
    });

    it('should filter errors by severity', async () => {
      const errors = await errorLogger.getErrorsBySeverity('high');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('high');
    });

    it('should filter errors by time range', async () => {
      const start = new Date('2025-01-14T10:30:00Z');
      const end = new Date('2025-01-14T11:30:00Z');
      const errors = await errorLogger.getErrorsByTimeRange(start, end);

      expect(errors).toHaveLength(1);
      expect(errors[0].operation).toBe('api_call');
    });
  });

  describe('Error Report Generation', () => {
    it('should generate comprehensive error report', async () => {
      mockedFs.readFile.mockResolvedValue(
        JSON.stringify({
          timestamp: new Date('2025-01-14T10:00:00Z'),
          source: 'tool_execution',
          operation: 'create_task',
          agent: 'test-agent',
          error: { message: 'Test error', name: 'TestError' },
          context: {},
          severity: 'medium'
        })
      );
      mockedFs.pathExists.mockResolvedValue(true);

      const report = await errorLogger.generateErrorReport();

      expect(report).toContain('Error Report');
      expect(report).toContain('Total Errors: 1');
      expect(report).toContain('tool_execution');
      expect(report).toContain('medium');
    });
  });

  describe('Error Log Maintenance', () => {
    it('should clear old error entries', async () => {
      const oldError = {
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old
        source: 'tool_execution',
        operation: 'old_op',
        agent: 'agent',
        error: { message: 'Old error', name: 'Error' },
        context: {},
        severity: 'low'
      };

      const recentError = {
        timestamp: new Date(), // Current
        source: 'tool_execution',
        operation: 'new_op',
        agent: 'agent',
        error: { message: 'New error', name: 'Error' },
        context: {},
        severity: 'low'
      };

      mockedFs.readFile.mockResolvedValue(
        [oldError, recentError].map(e => JSON.stringify(e)).join('\n')
      );
      mockedFs.pathExists.mockResolvedValue(true);

      const clearedCount = await errorLogger.clearOldErrors(7); // Clear errors older than 7 days

      expect(clearedCount).toBe(1);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('error.log'),
        expect.stringContaining('New error')
      );
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('error.log'),
        expect.not.stringContaining('Old error')
      );
    });
  });

  describe('Integration with MCP Response', () => {
    it('should capture MCP tool errors', async () => {
      const mcpError = {
        timestamp: new Date(),
        source: 'mcp_server' as const,
        operation: 'tool_call',
        agent: 'test-agent',
        error: {
          message: 'Tool execution failed',
          name: 'MCPError',
          code: -32603
        },
        context: {
          tool: 'invalid_tool',
          parameters: {}
        },
        severity: 'high' as const
      };

      await errorLogger.logError(mcpError);
      mockTimerDependency.flushAll();
      await errorLogger.waitForWriteQueueEmpty();

      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('error.log'),
        expect.stringContaining('MCPError')
      );
    });
  });
});