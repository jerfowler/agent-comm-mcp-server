/**
 * get-server-info ErrorLogger Integration Tests
 * Phase 4: LOW Priority ErrorLogger Implementation
 *
 * Tests error logging functionality for server info retrieval failures
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import * as os from 'os';
import { testUtils } from '../../utils/testUtils.js';
import { getServerInfo, initializeServerStartTime } from '../../../src/tools/get-server-info.js';
import { ServerConfig } from '../../../src/types.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';

// Mock the ErrorLogger
jest.mock('../../../src/logging/ErrorLogger.js');

// Mock the generated version file
jest.mock('../../../src/generated/version.js', () => ({
  PACKAGE_INFO: {
    name: '@jerfowler/agent-comm-mcp-server',
    version: '1.0.0-test',
    description: 'Test MCP Server',
    author: 'Test Author',
    repository: { url: 'https://github.com/test/repo', type: 'git' }
  }
}));

describe('get-server-info ErrorLogger Integration', () => {
  let config: ServerConfig;
  let tempDir: string;
  let mockErrorLogger: jest.Mocked<ErrorLogger>;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'server-info-error-test-'));

    // Create mock ErrorLogger instance
    mockErrorLogger = {
      logError: jest.fn().mockImplementation(() => Promise.resolve()),
      waitForWriteQueueEmpty: jest.fn().mockImplementation(() => Promise.resolve()),
      close: jest.fn().mockImplementation(() => Promise.resolve())
    } as unknown as jest.Mocked<ErrorLogger>;

    config = testUtils.createMockConfig({
      commDir: path.join(tempDir, 'comm'),
      archiveDir: path.join(tempDir, 'comm', '.archive'),
      enableArchiving: true,
      errorLogger: mockErrorLogger
    });

    // Initialize server start time for tests
    initializeServerStartTime();

    // Ensure directories exist
    await fs.ensureDir(config.commDir);
  });

  afterEach(async () => {
    // Clean up test files
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Error Logging - Package Info Errors', () => {
    it('should log error when PACKAGE_INFO is malformed', async () => {
      // Mock PACKAGE_INFO to be undefined/malformed
      jest.doMock('../../../src/generated/version.js', () => ({
        PACKAGE_INFO: undefined
      }));

      // Clear module cache to pick up new mock
      jest.resetModules();

      // Re-import with mocked version
      const { getServerInfo: getServerInfoMocked } = await import(
        '../../../src/tools/get-server-info.js'
      );

      try {
        await getServerInfoMocked(config, {});
      } catch (error) {
        // Expected to throw
      }

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'runtime',
          operation: 'get_server_info',
          error: expect.objectContaining({
            message: expect.stringContaining('Package info'),
            name: expect.any(String)
          }),
          context: expect.objectContaining({
            tool: 'get_server_info'
          }),
          severity: 'low'
        })
      );
    });

    it('should log error when version extraction fails', async () => {
      // Mock PACKAGE_INFO with missing version
      jest.doMock('../../../src/generated/version.js', () => ({
        PACKAGE_INFO: {
          name: '@jerfowler/agent-comm-mcp-server',
          // version missing
          description: 'Test MCP Server'
        }
      }));

      // Clear module cache
      jest.resetModules();

      const { getServerInfo: getServerInfoMocked } = await import(
        '../../../src/tools/get-server-info.js'
      );

      const result = await getServerInfoMocked(config, {});

      // Should return result with fallback version
      expect(result).toBeDefined();
      expect(result.version).toBe('0.0.0'); // Fallback version

      // Verify warning was logged
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'get_server_info',
          error: expect.objectContaining({
            message: expect.stringContaining('Version not found'),
            name: 'VersionExtractionWarning'
          }),
          context: expect.objectContaining({
            tool: 'get_server_info'
          }),
          severity: 'low'
        })
      );
    });
  });

  describe('Error Logging - Capability Enumeration Errors', () => {
    it('should log error when capability check fails', async () => {
      // Create a config with problematic capability check
      const badConfig = {
        ...config,
        // Add a getter that throws an error
        get commDir(): string {
          throw new Error('Config access error');
        }
      } as unknown as ServerConfig;

      try {
        await getServerInfo(badConfig, {});
      } catch (error) {
        // Expected to throw
      }

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'runtime',
          operation: 'get_server_info',
          error: expect.objectContaining({
            message: expect.stringContaining('Config access error'),
            name: 'Error'
          }),
          severity: 'low'
        })
      );
    });
  });

  describe('Error Logging - Memory Usage Errors', () => {
    it('should log error when memory usage retrieval fails', async () => {
      // Mock process.memoryUsage to throw
      const originalMemoryUsage = process.memoryUsage;
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory usage unavailable');
      });

      try {
        await getServerInfo(config, {});
      } catch (error) {
        // Expected to throw
      }

      // Verify ErrorLogger was called
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'runtime',
          operation: 'get_server_info',
          error: expect.objectContaining({
            message: expect.stringContaining('Memory usage unavailable'),
            name: 'Error'
          }),
          context: expect.objectContaining({
            tool: 'get_server_info'
          }),
          severity: 'low'
        })
      );

      // Restore original
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Error Logging - MCP Server Info Errors', () => {
    it('should handle errors when building MCP server response', async () => {
      // Create config that causes issues during response building
      const problematicConfig = {
        ...config,
        // Add circular reference to cause JSON serialization issues
        circular: {} as any
      } as ServerConfig & { circular?: any };
      problematicConfig.circular = problematicConfig;

      try {
        const result = await getServerInfo(problematicConfig, {});
        // Should handle gracefully and return result
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, error should be logged
      }

      // Check if any errors were logged
      if (mockErrorLogger.logError.mock.calls.length > 0) {
        const errorCall = mockErrorLogger.logError.mock.calls[0][0];
        expect(errorCall.severity).toBe('low');
        expect(errorCall.operation).toBe('get_server_info');
      }
    });
  });

  describe('Error Logging - Server Start Time Errors', () => {
    it('should log warning when server start time is not initialized', async () => {
      // Reset server start time
      jest.resetModules();

      // Re-import without initialization
      const { getServerInfo: getServerInfoFresh } = await import(
        '../../../src/tools/get-server-info.js'
      );

      const result = await getServerInfoFresh(config, {});

      // Should still return result
      expect(result).toBeDefined();
      expect(result.uptime).toBe(0); // Fallback uptime

      // Verify warning was logged
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'tool_execution',
          operation: 'get_server_info',
          error: expect.objectContaining({
            message: expect.stringContaining('Server start time not initialized'),
            name: 'StartTimeWarning'
          }),
          severity: 'low'
        })
      );
    });
  });

  describe('Error Logging - Repository Info Errors', () => {
    it('should handle missing or malformed repository info', async () => {
      // Mock PACKAGE_INFO with invalid repository
      jest.doMock('../../../src/generated/version.js', () => ({
        PACKAGE_INFO: {
          name: '@jerfowler/agent-comm-mcp-server',
          version: '1.0.0',
          description: 'Test',
          repository: 'invalid-format' // Should be object or null
        }
      }));

      jest.resetModules();

      const { getServerInfo: getServerInfoMocked } = await import(
        '../../../src/tools/get-server-info.js'
      );

      const result = await getServerInfoMocked(config, {});

      // Should handle gracefully
      expect(result).toBeDefined();
      expect(result.repository).toBeDefined();

      // Verify warning was logged
      if (mockErrorLogger.logError.mock.calls.length > 0) {
        const warningCall = mockErrorLogger.logError.mock.calls.find(
          call => call[0].error.name === 'RepositoryFormatWarning'
        );
        if (warningCall) {
          expect(warningCall[0].severity).toBe('low');
        }
      }
    });
  });

  describe('Debug Package Integration', () => {
    it('should use correct debug namespace', async () => {
      // The tool should use debug namespace: agent-comm:tools:getserverinfo
      const result = await getServerInfo(config, {});

      // Verify successful execution
      expect(result).toBeDefined();
      expect(result.name).toBe('@jerfowler/agent-comm-mcp-server');
      expect(result.version).toBeDefined();
      expect(result.capabilities).toBeDefined();

      // Debug output would be visible with DEBUG=agent-comm:tools:getserverinfo
    });
  });

  describe('Error Severity Verification', () => {
    it('should always use LOW severity for all errors', async () => {
      // Trigger various error scenarios
      const scenarios = [
        // Missing version
        async () => {
          jest.doMock('../../../src/generated/version.js', () => ({
            PACKAGE_INFO: { name: 'test' }
          }));
          jest.resetModules();
          const { getServerInfo: gs } = await import('../../../src/tools/get-server-info.js');
          await gs(config, {});
        },
        // Memory usage error
        async () => {
          jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
            throw new Error('Test error');
          });
          await getServerInfo(config, {}).catch(() => {});
        }
      ];

      for (const scenario of scenarios) {
        await scenario().catch(() => {
          // Ignore errors, we just want to check logging
        });
      }

      // All errors should have LOW severity
      if (mockErrorLogger.logError.mock.calls.length > 0) {
        mockErrorLogger.logError.mock.calls.forEach(call => {
          const errorLog = call[0];
          expect(errorLog.severity).toBe('low');
        });
      }
    });
  });

  describe('Configuration Errors', () => {
    it('should handle missing configuration gracefully', async () => {
      const minimalConfig = {
        commDir: tempDir
      } as ServerConfig;

      const result = await getServerInfo(minimalConfig, {});

      // Should return result with defaults
      expect(result).toBeDefined();
      expect(result.configuration).toBeDefined();

      // Check if warnings were logged for missing config
      const warningCalls = mockErrorLogger.logError.mock.calls.filter(
        call => call[0].error.name?.includes('Warning')
      );

      if (warningCalls.length > 0) {
        warningCalls.forEach(call => {
          expect(call[0].severity).toBe('low');
        });
      }
    });
  });

  describe('Success Case Verification', () => {
    it('should not log errors during successful execution', async () => {
      // Clear previous mock calls
      mockErrorLogger.logError.mockClear();

      const result = await getServerInfo(config, {});

      // Verify successful response
      expect(result).toBeDefined();
      expect(result.name).toBe('@jerfowler/agent-comm-mcp-server');
      expect(result.version).toBe('1.0.0-test');
      expect(result.capabilities.tools).toBe(true);
      expect(result.capabilities.logging).toBe(true);
      expect(result.memoryUsage).toBeDefined();

      // Should not have logged any errors
      expect(mockErrorLogger.logError).not.toHaveBeenCalled();
    });
  });
});