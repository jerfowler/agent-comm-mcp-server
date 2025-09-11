/**
 * Tests for get-server-info tool with build-time version injection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getServerInfo } from '../../../src/tools/get-server-info.js';
import { ServerConfig } from '../../../src/types.js';
import { PACKAGE_INFO } from '../../../src/generated/version.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';

// Mock process for environment variables
const mockProcess = {
  uptime: jest.fn(),
  memoryUsage: jest.fn(),
  env: {}
};

jest.mock('process', () => mockProcess);

describe('get-server-info tool', () => {
  let mockConfig: ServerConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      commDir: './comm',
      archiveDir: './comm/.archive',
      logDir: './logs',
      enableArchiving: true,
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
        getOperationStatistics: jest.fn()
      } as unknown as EventLogger
    };

    // Mock process.uptime
    mockProcess.uptime.mockReturnValue(123.456);
    
    // Mock process.memoryUsage
    mockProcess.memoryUsage.mockReturnValue({
      rss: 25165824,
      heapTotal: 8388608,
      heapUsed: 4194304,
      external: 1048576,
      arrayBuffers: 512000
    });
  });

  it('should return comprehensive server information using generated constants', async () => {
    const result = await getServerInfo(mockConfig, {});

    expect(result).toEqual({
      name: PACKAGE_INFO.name,
      version: PACKAGE_INFO.version,
      description: PACKAGE_INFO.description,
      author: PACKAGE_INFO.author,
      repository: PACKAGE_INFO.repository,
      uptime: expect.any(Number),
      startTime: expect.any(String),
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
        logging: true
      },
      configuration: expect.objectContaining({
        commDir: './comm',
        archiveDir: './comm/.archive',
        enableArchiving: true
      }),
      memoryUsage: expect.any(Object)
    });

    // Validate memory usage has expected properties
    expect(result.memoryUsage).toHaveProperty('rss');
    expect(result.memoryUsage).toHaveProperty('heapTotal');
    expect(result.memoryUsage).toHaveProperty('heapUsed');
    expect(result.memoryUsage).toHaveProperty('external');
    expect(result.memoryUsage).toHaveProperty('arrayBuffers');

    // Validate uptime is positive
    expect(result.uptime).toBeGreaterThan(0);
  });

  it('should always return current version from generated constants', async () => {
    const result = await getServerInfo(mockConfig, {});

    // Should never return "unknown" since constants are always available
    expect(result.version).toBe(PACKAGE_INFO.version);
    expect(result.version).not.toBe('unknown');
  });

  it('should always return actual package info from generated constants', async () => {
    const result = await getServerInfo(mockConfig, {});

    // Should return real package info, not fallback values
    expect(result.name).toBe('@jerfowler/agent-comm-mcp-server');
    expect(result.author).toBe('Jeremy Fowler');
    expect(result.description).toContain('MCP server for AI agent task communication');
    expect(result.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/jerfowler/agent-comm-mcp-server.git'
    });
  });

  it('should sanitize sensitive configuration data', async () => {
    const sensitiveConfig = {
      ...mockConfig,
      apiKey: 'secret-key-123',
      password: 'secret-password',
      secretToken: 'secret-token',
      normalField: 'normal-value'
    };

    const result = await getServerInfo(sensitiveConfig, {});

    // Should exclude sensitive fields from the configuration object  
    expect(result.configuration).not.toHaveProperty('apiKey');
    expect(result.configuration).not.toHaveProperty('password');
    expect(result.configuration).not.toHaveProperty('secretToken');
    
    // Should include normal fields (configuration might have connectionManager/eventLogger objects)
    expect(result.configuration).toHaveProperty('normalField', 'normal-value');
    expect(result.configuration).toHaveProperty('commDir', './comm');
  });

  it('should handle server start time initialization', async () => {
    const result = await getServerInfo(mockConfig, {});

    // Should have a valid ISO timestamp
    expect(result.startTime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    expect(new Date(result.startTime)).toBeInstanceOf(Date);
  });

  it('should return consistent server capabilities', async () => {
    const result = await getServerInfo(mockConfig, {});

    expect(result.capabilities).toEqual({
      tools: true,
      resources: false,
      prompts: false,
      logging: true
    });
  });

  it('should handle multiple calls consistently', async () => {
    const result1 = await getServerInfo(mockConfig, {});
    const result2 = await getServerInfo(mockConfig, {});

    // Package info should be identical (from constants)
    expect(result1.name).toBe(result2.name);
    expect(result1.version).toBe(result2.version);
    expect(result1.description).toBe(result2.description);
    expect(result1.author).toBe(result2.author);

    // Capabilities should be identical
    expect(result1.capabilities).toEqual(result2.capabilities);
  });

  it('should reflect build-time injection benefits', async () => {
    const result = await getServerInfo(mockConfig, {});

    // Benefits of build-time injection:
    // 1. Always has correct version (never "unknown")
    expect(result.version).toBe(PACKAGE_INFO.version);
    expect(result.version).not.toBe('unknown');

    // 2. Package info is always accurate and available
    expect(result.name).toBe('@jerfowler/agent-comm-mcp-server');
    expect(result.author).not.toBe('unknown');

    // 3. No file system dependencies at runtime
    // (This test implicitly validates this since no fs mocking is needed)
  });
});