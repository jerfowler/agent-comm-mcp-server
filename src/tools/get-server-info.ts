/**
 * Get Server Info Tool
 * Returns comprehensive server metadata including version, capabilities, and runtime info
 */

import { ServerConfig } from '../types.js';
import { PACKAGE_INFO } from '../generated/version.js';

/**
 * Server start time for uptime calculation
 */
let serverStartTime: Date | null = null;

/**
 * Initialize server start time (called when server starts)
 */
export function initializeServerStartTime(): void {
  if (!serverStartTime) {
    serverStartTime = new Date();
  }
}


/**
 * Server information response structure
 */
interface ServerInfoResponse {
  name: string;
  version: string;
  description: string;
  author: string;
  repository: string | { url: string; type: string } | null;
  uptime: number;
  startTime: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    logging: boolean;
  };
  configuration: Record<string, unknown>;
  memoryUsage: NodeJS.MemoryUsage;
}

/**
 * Get comprehensive server information
 */
export function getServerInfo(
  config: ServerConfig, 
  _args?: Record<string, unknown>
): ServerInfoResponse {
  // Use generated package information constants
  
  // Initialize start time if not already set
  if (!serverStartTime) {
    initializeServerStartTime();
  }

  // Calculate uptime
  const uptime = process.uptime();
  
  // Get memory usage
  const memoryUsage = process.memoryUsage();
  
  // Sanitize configuration (remove sensitive data)
  const sanitizedConfig = sanitizeConfiguration(config);
  
  return {
    name: PACKAGE_INFO.name,
    version: PACKAGE_INFO.version,
    description: PACKAGE_INFO.description,
    author: PACKAGE_INFO.author,
    repository: PACKAGE_INFO.repository,
    uptime,
    startTime: serverStartTime?.toISOString() ?? new Date().toISOString(),
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
      logging: true
    },
    configuration: sanitizedConfig,
    memoryUsage
  };
}

/**
 * Sanitize configuration to remove sensitive data
 */
function sanitizeConfiguration(config: ServerConfig): Record<string, unknown> {
  const sensitiveKeys = [
    'apiKey', 'password', 'secret', 'token', 'key', 
    'auth', 'credential', 'connectionString'
  ];
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(config)) {
    // Skip sensitive keys (case-insensitive check)
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitiveKey => 
      lowerKey.includes(sensitiveKey)
    );
    
    if (!isSensitive) {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}