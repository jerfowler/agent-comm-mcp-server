/**
 * Get Server Info Tool
 * Returns comprehensive server metadata including version, capabilities, and runtime info
 */

import { ServerConfig } from '../types.js';
import { PACKAGE_INFO } from '../generated/version.js';
import debug from 'debug';


const log = debug('agent-comm:tools:getserverinfo');

// Initialize server info tool
log('Server info tool ready');

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
export async function getServerInfo(
  config: ServerConfig,
  _args?: Record<string, unknown>
): Promise<ServerInfoResponse> {
  // Use generated package information constants
  
  // Initialize start time if not already set
  if (!serverStartTime) {
    initializeServerStartTime();

    // Log warning about server start time not being initialized
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'get_server_info',
        agent: '',
        taskId: '',
        error: {
          message: 'Server start time not initialized, using current time',
          name: 'StartTimeWarning',
          code: undefined
        },
        context: {
          tool: 'get_server_info'
        },
        severity: 'low'
      });
    }
  }

  // Calculate uptime based on server start time
  let uptime = 0;
  if (serverStartTime) {
    try {
      uptime = (Date.now() - serverStartTime.getTime()) / 1000;
    } catch (error) {
      // Log uptime calculation error
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'runtime',
          operation: 'get_server_info',
          agent: '',
          taskId: '',
          error: {
            message: `Uptime calculation failed: ${(error as Error).message}`,
            name: (error as Error).name || 'Error',
            code: undefined
          },
          context: {
            tool: 'get_server_info'
          },
          severity: 'low'
        });
      }
    }
  }

  // Get memory usage
  let memoryUsage: NodeJS.MemoryUsage;
  try {
    memoryUsage = process.memoryUsage();
  } catch (error) {
    // Log memory usage error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'get_server_info',
        agent: '',
        taskId: '',
        error: {
          message: `Memory usage retrieval failed: ${(error as Error).message}`,
          name: (error as Error).name || 'Error',
          code: undefined
        },
        context: {
          tool: 'get_server_info'
        },
        severity: 'low'
      });
    }
    throw error;
  }
  
  // Sanitize configuration (remove sensitive data)
  let sanitizedConfig: Record<string, unknown>;
  try {
    sanitizedConfig = sanitizeConfiguration(config);
  } catch (error) {
    // Log configuration access error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'get_server_info',
        agent: '',
        taskId: '',
        error: {
          message: (error as Error).message,
          name: (error as Error).name || 'Error',
          code: undefined
        },
        context: {
          tool: 'get_server_info'
        },
        severity: 'low'
      });
    }
    throw error;
  }
  
  // Validate package info and log warnings if needed
  try {
    if (!PACKAGE_INFO) {
      const error = new Error('Package info not available');
      // Log error using ErrorLogger if available
      if (config.errorLogger) {
        await config.errorLogger.logError({
          timestamp: new Date(),
          source: 'runtime',
          operation: 'get_server_info',
          agent: '',
          taskId: '',
          error: {
            message: error.message,
            name: 'PackageInfoError',
            code: undefined
          },
          context: {
            tool: 'get_server_info'
          },
          severity: 'low'
        });
      }
      throw error;
    }

    const version = PACKAGE_INFO.version || '0.0.0';
    if (!PACKAGE_INFO.version && config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'get_server_info',
        agent: '',
        taskId: '',
        error: {
          message: 'Version not found in package info, using fallback',
          name: 'VersionExtractionWarning',
          code: undefined
        },
        context: {
          tool: 'get_server_info'
        },
        severity: 'low'
      });
    }

    // Handle repository format
    const repository = PACKAGE_INFO.repository;
    if (typeof repository === 'string' && config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'get_server_info',
        agent: '',
        taskId: '',
        error: {
          message: 'Repository format is string instead of object',
          name: 'RepositoryFormatWarning',
          code: undefined
        },
        context: {
          tool: 'get_server_info',
          parameters: { repository }
        },
        severity: 'low'
      });
    }

    return {
      name: PACKAGE_INFO.name,
      version,
      description: PACKAGE_INFO.description,
      author: PACKAGE_INFO.author,
      repository,
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
  } catch (error) {
    // Log critical error
    if (config.errorLogger) {
      await config.errorLogger.logError({
        timestamp: new Date(),
        source: 'runtime',
        operation: 'get_server_info',
        agent: '',
        taskId: '',
        error: {
          message: (error as Error).message,
          name: (error as Error).name || 'Error',
          code: (error as Error & { code?: string })?.code
        },
        context: {
          tool: 'get_server_info'
        },
        severity: 'low'
      });
    }
    throw error;
  }
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