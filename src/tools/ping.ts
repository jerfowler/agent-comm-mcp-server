/**
 * Ping Tool
 * Simple health check mechanism for the MCP server
 */

import { ServerConfig } from '../types.js';

/**
 * Ping tool for health checks
 */
export function ping(
  _config?: ServerConfig,
  _args?: Record<string, unknown>
): {
  status: string;
  timestamp: number;
  timestampISO: string;
  server: string;
  message: string;
} {
  const now = Date.now();
  
  return {
    status: 'ok',
    timestamp: now,
    timestampISO: new Date(now).toISOString(),
    server: 'agent-comm',
    message: 'pong'
  };
}