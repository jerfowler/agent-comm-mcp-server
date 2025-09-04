/**
 * Tests for ping tool
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ping } from '../../../src/tools/ping.js';
import { ServerConfig } from '../../../src/types.js';

describe('ping tool', () => {
  let mockConfig: ServerConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      commDir: './comm',
      archiveDir: './comm/.archive',
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
      } as any,
      eventLogger: {
        logOperation: jest.fn(),
        logError: jest.fn(),
        getOperationStatistics: jest.fn()
      } as any
    };

    // Mock Date.now() to return consistent timestamp
    jest.spyOn(Date, 'now').mockReturnValue(1672531200000); // 2023-01-01T00:00:00.000Z
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return basic ping response with status ok', async () => {
    const result = await ping(mockConfig, {});

    expect(result).toEqual({
      status: 'ok',
      timestamp: 1672531200000,
      timestampISO: '2023-01-01T00:00:00.000Z',
      server: 'agent-comm',
      message: 'pong'
    });
  });

  it('should handle empty arguments', async () => {
    const result = await ping(mockConfig);

    expect(result.status).toBe('ok');
    expect(result.message).toBe('pong');
    expect(result.server).toBe('agent-comm');
  });

  it('should return current timestamp', async () => {
    // Use real Date.now()
    jest.restoreAllMocks();
    
    const beforeTime = Date.now();
    const result = await ping(mockConfig, {});
    const afterTime = Date.now();

    expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(result.timestamp).toBeLessThanOrEqual(afterTime);
    expect(result.timestampISO).toBe(new Date(result.timestamp).toISOString());
  });

  it('should always return consistent structure', async () => {
    const result = await ping(mockConfig, {});

    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('timestampISO');
    expect(result).toHaveProperty('server');
    expect(result).toHaveProperty('message');
    
    expect(typeof result.status).toBe('string');
    expect(typeof result.timestamp).toBe('number');
    expect(typeof result.timestampISO).toBe('string');
    expect(typeof result.server).toBe('string');
    expect(typeof result.message).toBe('string');
  });

  it('should not expose sensitive configuration data', async () => {
    const sensitiveConfig = {
      ...mockConfig,
      apiKey: 'secret-key',
      password: 'secret-password'
    };

    const result = await ping(sensitiveConfig, {});

    expect(result).not.toHaveProperty('config');
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('password');
  });

  it('should handle config parameter being undefined', async () => {
    const result = await ping(undefined, {});

    expect(result.status).toBe('ok');
    expect(result.server).toBe('agent-comm');
  });
});