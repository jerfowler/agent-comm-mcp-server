/**
 * Configuration management for the Agent Communication MCP Server
 */

import * as path from 'path';
import { BaseServerConfig, ServerConfig } from './types.js';
import { PACKAGE_INFO, SERVER_NAME, SERVER_VERSION, SERVER_DESCRIPTION } from './generated/version.js';

const DEFAULT_CONFIG = {
  commDir: './comm',
  archiveDir: './comm/.archive',
  logDir: './comm/.logs',
  enableArchiving: true
};

/**
 * Get configuration from environment variables with defaults
 */
export function getConfig(): BaseServerConfig {
  const commDir = process.env['AGENT_COMM_DIR'] || DEFAULT_CONFIG.commDir;
  const archiveDir = process.env['AGENT_COMM_ARCHIVE_DIR'] || 
    path.resolve(commDir, '.archive');
  const logDir = process.env['AGENT_COMM_LOG_DIR'] || 
    path.resolve(commDir, '.logs');
  
  const autoArchiveDaysStr = process.env['AGENT_COMM_AUTO_ARCHIVE_DAYS'];
  const maxTaskAgeStr = process.env['AGENT_COMM_MAX_TASK_AGE'];
  
  const config: BaseServerConfig = {
    commDir: path.resolve(commDir),
    archiveDir: path.resolve(archiveDir),
    logDir: path.resolve(logDir),
    enableArchiving: process.env['AGENT_COMM_DISABLE_ARCHIVE'] !== 'true',
    ...(autoArchiveDaysStr && { autoArchiveDays: parseInt(autoArchiveDaysStr, 10) }),
    ...(maxTaskAgeStr && { maxTaskAge: parseInt(maxTaskAgeStr, 10) })
  };

  return config;
}

/**
 * Validate configuration
 */
export function validateConfig(config: ServerConfig): void {
  if (!config.commDir) {
    throw new Error('Communication directory path is required');
  }

  if (config.enableArchiving && !config.archiveDir) {
    throw new Error('Archive directory path is required when archiving is enabled');
  }

  if (config.autoArchiveDays !== undefined && config.autoArchiveDays < 1) {
    throw new Error('Auto archive days must be a positive number');
  }

  if (config.maxTaskAge !== undefined && config.maxTaskAge < 1) {
    throw new Error('Max task age must be a positive number');
  }
}

/**
 * Get package information from generated constants
 */
export function getPackageInfo() {
  return {
    name: PACKAGE_INFO.name,
    version: PACKAGE_INFO.version,
    description: PACKAGE_INFO.description,
    author: PACKAGE_INFO.author,
    repository: PACKAGE_INFO.repository
  };
}

/**
 * Get server information using generated constants
 */
export function getServerInfo(): {
  name: string;
  version: string;
  description: string;
} {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: SERVER_DESCRIPTION
  };
}

/**
 * Get dynamic server information (now uses generated constants)
 */
export function getDynamicServerInfo(): {
  name: string;
  version: string;
  description: string;
} {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: SERVER_DESCRIPTION
  };
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
  const commDir = process.env['AGENT_COMM_DIR'];
  
  // AGENT_COMM_DIR is now optional - will use default if not provided
  if (commDir !== undefined && commDir.trim() === '') {
    throw new Error('Configuration error: AGENT_COMM_DIR environment variable cannot be empty when provided');
  }
}

/**
 * Environment variable documentation
 */
export const ENV_VARS = {
  AGENT_COMM_DIR: {
    description: 'Path to the communication directory',
    default: './comm',
    example: '/path/to/project/comm'
  },
  AGENT_COMM_ARCHIVE_DIR: {
    description: 'Path to the archive directory',
    default: './comm/.archive',
    example: '/path/to/project/comm/.archive'
  },
  AGENT_COMM_AUTO_ARCHIVE_DAYS: {
    description: 'Automatically archive completed tasks older than N days',
    default: 'disabled',
    example: '30'
  },
  AGENT_COMM_MAX_TASK_AGE: {
    description: 'Maximum age for tasks in days (for cleanup)',
    default: 'unlimited',
    example: '90'
  },
  AGENT_COMM_DISABLE_ARCHIVE: {
    description: 'Disable archiving functionality',
    default: 'false',
    example: 'true'
  },
  AGENT_COMM_LOG_DIR: {
    description: 'Path to the log directory',
    default: './comm/.logs',
    example: '/path/to/project/comm/.logs'
  }
} as const;