/**
 * Validation utilities for the Agent Communication MCP Server
 */

import { InvalidTaskError, ServerConfig } from '../types.js';
import debug from 'debug';


const log = debug('agent-comm:utils:validation');

// Initialize validation utilities
log('Validation utilities initialized');

/**
 * Validate required string parameter
 */
export function validateRequiredString(value: unknown, paramName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidTaskError(`${paramName} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validate optional string parameter
 */
export function validateOptionalString(value: unknown, paramName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new InvalidTaskError(`${paramName} must be a string`);
  }
  return value.trim() || undefined;
}

/**
 * Validate number parameter
 */
export function validateNumber(value: unknown, paramName: string, min?: number, max?: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new InvalidTaskError(`${paramName} must be a valid number`);
  }
  if (min !== undefined && value < min) {
    throw new InvalidTaskError(`${paramName} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new InvalidTaskError(`${paramName} must be at most ${max}`);
  }
  return value;
}

/**
 * Validate boolean parameter
 */
export function validateBoolean(value: unknown, paramName: string, defaultValue?: boolean): boolean {
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new InvalidTaskError(`${paramName} is required`);
  }
  if (typeof value !== 'boolean') {
    throw new InvalidTaskError(`${paramName} must be a boolean`);
  }
  return value;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: unknown, 
  paramName: string, 
  validValues: readonly T[]
): T {
  if (typeof value !== 'string') {
    throw new InvalidTaskError(`${paramName} must be a string`);
  }
  if (!validValues.includes(value as T)) {
    throw new InvalidTaskError(`${paramName} must be one of: ${validValues.join(', ')}`);
  }
  return value as T;
}

/**
 * Validate task file type
 */
export function validateTaskFileType(fileType: unknown): 'INIT' | 'PLAN' | 'DONE' | 'ERROR' {
  return validateEnum(fileType, 'file', ['INIT', 'PLAN', 'DONE', 'ERROR'] as const);
}

/**
 * Validate archive mode
 */
export function validateArchiveMode(mode: unknown): 'completed' | 'all' | 'by-agent' | 'by-date' {
  return validateEnum(mode, 'mode', ['completed', 'all', 'by-agent', 'by-date'] as const);
}

/**
 * Validate file name for security
 */
export function validateFileName(fileName: string): void {
  if (!fileName || fileName.trim().length === 0) {
    throw new InvalidTaskError('File name cannot be empty');
  }
  
  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new InvalidTaskError('File name cannot contain path traversal characters');
  }
  
  // Check for system files
  if (fileName.startsWith('.') && !['INIT.md', 'PLAN.md', 'DONE.md', 'ERROR.md'].includes(fileName)) {
    throw new InvalidTaskError('Invalid file name');
  }
  
  // Check file extension
  if (!fileName.endsWith('.md')) {
    throw new InvalidTaskError('File must have .md extension');
  }
}

/**
 * Validate directory name for security
 */
export function validateDirectoryName(dirName: string): void {
  if (!dirName || dirName.trim().length === 0) {
    throw new InvalidTaskError('Directory name cannot be empty');
  }
  
  // Check for path traversal attempts
  if (dirName.includes('..') || dirName.includes('/') || dirName.includes('\\')) {
    throw new InvalidTaskError('Directory name cannot contain path traversal characters');
  }
  
  // Check for system directories
  if (dirName.startsWith('.') && dirName !== '.archive') {
    throw new InvalidTaskError('Invalid directory name');
  }
}

/**
 * Validate content is not empty
 */
export function validateContent(content: string): void {
  if (!content || content.trim().length === 0) {
    throw new InvalidTaskError('Content cannot be empty');
  }
}

/**
 * Sanitize input string
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>:"/\\|?*]/g, '') // Remove Windows invalid filename chars
    .replace(/\0/g, '') // Remove null bytes
    .substring(0, 255); // Limit length
}

/**
 * Validate required configuration components
 * Ensures connectionManager and eventLogger are present
 * Note: This validation is primarily for runtime safety when config might be malformed
 */
export function validateRequiredConfig(config: ServerConfig): void {
  // Runtime validation for required components
  // This handles test scenarios where these might be undefined
  // ESLint is disabled here because we need runtime validation for potentially malformed configs in tests
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  const hasConnectionManager = Object.prototype.hasOwnProperty.call(config, 'connectionManager') && 
                               config.connectionManager != null;
  const hasEventLogger = Object.prototype.hasOwnProperty.call(config, 'eventLogger') && 
                        config.eventLogger != null;
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */
  
  if (!hasConnectionManager || !hasEventLogger) {
    throw new Error('Configuration missing required components: connectionManager and eventLogger');
  }
}