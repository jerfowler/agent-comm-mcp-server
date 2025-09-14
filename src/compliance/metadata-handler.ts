/**
 * MCP Metadata Handler Compliance
 * 
 * Implements MCP 2025-06-18 specification metadata handling for full protocol compliance.
 * Manages _meta field validation, reserved key handling, and metadata creation utilities
 * for MCP-compliant responses.
 * 
 * @see https://modelcontextprotocol.io/specification/2025-06-18#metadata
 */

/**
 * MCP Metadata Validation Result
 */
import debug from 'debug';

const log = debug('agent-comm:metadatahandler');

// Initialize metadata handler
log('MCP metadata handler initialized');

export interface MCPMetaValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * MCP Standard Metadata Fields
 * Core metadata structure for MCP responses
 */
export interface MCPStandardMeta {
  serverVersion?: string;
  serverName?: string;
  requestId?: string;
  timestamp?: string;
  responseStatus?: string;
  errorType?: string;
  errorMessage?: string;
  taskId?: string;
  progress?: number;
  status?: string;
}

/**
 * MCP Reserved Key Patterns
 * All keys starting with modelcontextprotocol.io/ are reserved
 */
const MCP_RESERVED_PREFIX = 'modelcontextprotocol.io/';

/**
 * Valid MCP Reserved Keys
 * Complete list of officially supported MCP metadata keys
 */
const VALID_MCP_RESERVED_KEYS = new Set([
  'modelcontextprotocol.io/serverVersion',
  'modelcontextprotocol.io/serverName', 
  'modelcontextprotocol.io/requestId',
  'modelcontextprotocol.io/timestamp',
  'modelcontextprotocol.io/responseStatus',
  'modelcontextprotocol.io/errorType',
  'modelcontextprotocol.io/errorMessage',
  'modelcontextprotocol.io/taskId',
  'modelcontextprotocol.io/progress',
  'modelcontextprotocol.io/status'
]);

/**
 * MCP Metadata Handler
 * Core class for managing MCP-compliant metadata operations
 */
export class MCPMetaHandler {
  constructor(
    private readonly serverVersion: string,
    private readonly serverName: string
  ) {}

  /**
   * Create standard response metadata
   * 
   * @param requestId - Request identifier
   * @param status - Response status
   * @returns MCP-compliant metadata object
   */
  createResponseMeta(requestId: string, status: string): Record<string, unknown> {
    return {
      'modelcontextprotocol.io/serverVersion': this.serverVersion,
      'modelcontextprotocol.io/serverName': this.serverName,
      'modelcontextprotocol.io/requestId': requestId,
      'modelcontextprotocol.io/responseStatus': status,
      'modelcontextprotocol.io/timestamp': new Date().toISOString()
    };
  }

  /**
   * Create error-specific metadata
   * 
   * @param requestId - Request identifier
   * @param errorType - Type of error
   * @param errorMessage - Error message
   * @returns MCP-compliant error metadata
   */
  createErrorMeta(requestId: string, errorType: string, errorMessage: string): Record<string, unknown> {
    return {
      'modelcontextprotocol.io/serverVersion': this.serverVersion,
      'modelcontextprotocol.io/requestId': requestId,
      'modelcontextprotocol.io/errorType': errorType,
      'modelcontextprotocol.io/errorMessage': errorMessage,
      'modelcontextprotocol.io/timestamp': new Date().toISOString()
    };
  }

  /**
   * Create progress tracking metadata
   * 
   * @param taskId - Task identifier
   * @param progress - Progress percentage (0-100)
   * @param status - Current status
   * @returns MCP-compliant progress metadata
   */
  createProgressMeta(taskId: string, progress: number, status: string): Record<string, unknown> {
    return {
      'modelcontextprotocol.io/taskId': taskId,
      'modelcontextprotocol.io/progress': progress,
      'modelcontextprotocol.io/status': status,
      'modelcontextprotocol.io/timestamp': new Date().toISOString()
    };
  }

  /**
   * Validate metadata structure and reserved keys
   * 
   * @param meta - Metadata object to validate
   * @returns Validation result with errors
   */
  validateMeta(meta: Record<string, unknown>): MCPMetaValidationResult {
    const errors: string[] = [];

    // Check all keys for reserved key violations
    for (const key of Object.keys(meta)) {
      if (isMCPReservedKey(key) && !VALID_MCP_RESERVED_KEYS.has(key)) {
        errors.push(`Invalid reserved key: ${key}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Merge metadata objects with conflict resolution
   * Override strategy: later values override earlier ones
   * 
   * @param base - Base metadata object
   * @param override - Override metadata object
   * @returns Merged metadata object
   */
  mergeMeta(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
    return { ...base, ...override };
  }
}

/**
 * Create MCP-compliant metadata from standard fields
 * 
 * @param meta - Standard metadata fields
 * @returns MCP-compliant metadata object with proper key prefixes
 */
export function createMCPMeta(meta: MCPStandardMeta): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (meta.serverVersion !== undefined) {
    result['modelcontextprotocol.io/serverVersion'] = meta.serverVersion;
  }
  if (meta.serverName !== undefined) {
    result['modelcontextprotocol.io/serverName'] = meta.serverName;
  }
  if (meta.requestId !== undefined) {
    result['modelcontextprotocol.io/requestId'] = meta.requestId;
  }
  if (meta.timestamp !== undefined) {
    result['modelcontextprotocol.io/timestamp'] = meta.timestamp;
  }
  if (meta.responseStatus !== undefined) {
    result['modelcontextprotocol.io/responseStatus'] = meta.responseStatus;
  }
  if (meta.errorType !== undefined) {
    result['modelcontextprotocol.io/errorType'] = meta.errorType;
  }
  if (meta.errorMessage !== undefined) {
    result['modelcontextprotocol.io/errorMessage'] = meta.errorMessage;
  }
  if (meta.taskId !== undefined) {
    result['modelcontextprotocol.io/taskId'] = meta.taskId;
  }
  if (meta.progress !== undefined) {
    result['modelcontextprotocol.io/progress'] = meta.progress;
  }
  if (meta.status !== undefined) {
    result['modelcontextprotocol.io/status'] = meta.status;
  }

  return result;
}

/**
 * Validate MCP metadata structure
 * 
 * @param meta - Metadata object to validate
 * @returns Validation result with errors
 */
export function validateMCPMeta(meta: Record<string, unknown>): MCPMetaValidationResult {
  const errors: string[] = [];

  // Check all keys for reserved key violations
  for (const key of Object.keys(meta)) {
    if (isMCPReservedKey(key) && !VALID_MCP_RESERVED_KEYS.has(key)) {
      errors.push(`Invalid reserved key: ${key}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Merge MCP metadata objects
 * Simple merge strategy where later values override earlier ones
 * 
 * @param meta1 - First metadata object
 * @param meta2 - Second metadata object (takes precedence)
 * @returns Merged metadata object
 */
export function mergeMCPMeta(meta1: Record<string, unknown>, meta2: Record<string, unknown>): Record<string, unknown> {
  return { ...meta1, ...meta2 };
}

/**
 * Check if a key is MCP reserved
 * All keys starting with modelcontextprotocol.io/ are considered reserved
 * 
 * @param key - Key to check
 * @returns True if key is MCP reserved
 */
export function isMCPReservedKey(key: string): boolean {
  return key.startsWith(MCP_RESERVED_PREFIX);
}