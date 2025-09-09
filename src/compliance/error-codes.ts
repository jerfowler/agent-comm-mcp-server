/**
 * MCP Error Codes Compliance
 * 
 * Implements MCP 2025-06-18 specification error codes for full protocol compliance.
 * Maps internal AgentCommError types to standard MCP error codes and provides
 * utilities for creating MCP-compliant error responses.
 * 
 * @see https://modelcontextprotocol.io/specification/2025-06-18#error-handling
 */

import { AgentCommError } from '../types.js';

/**
 * MCP 2025-06-18 Standard Error Codes
 * Based on JSON-RPC 2.0 specification with MCP-specific extensions
 */
export const MCPErrorCodes = {
  // JSON-RPC 2.0 Standard Error Codes
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // MCP-Specific Error Codes (reserved range -32000 to -32099)
  RESOURCE_NOT_FOUND: -32001,
  RESOURCE_UNAVAILABLE: -32002,
  PROMPT_NOT_FOUND: -32003,
  TOOL_NOT_FOUND: -32004,
  COMPLETION_NOT_AVAILABLE: -32005
} as const;

/**
 * MCP Error Structure
 * Standard MCP error format with code, message, and optional data
 */
export interface MCPError {
  code: number;
  message: string;
  data?: {
    type: string;
    originalError?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * MCP Error Response Structure
 * Complete JSON-RPC 2.0 error response with MCP compliance
 */
export interface MCPErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: MCPError;
  _meta?: Record<string, unknown>;
}

/**
 * Metadata for MCP error responses
 * Standard _meta fields for error context and diagnostics
 */
export interface MCPErrorMeta {
  'modelcontextprotocol.io/errorSource'?: string;
  'modelcontextprotocol.io/timestamp'?: string;
  'modelcontextprotocol.io/requestId'?: string;
  'modelcontextprotocol.io/serverVersion'?: string;
}

/**
 * Map AgentCommError types to MCP error codes
 */
const ERROR_TYPE_MAPPING: Record<string, number> = {
  // Resource-related errors
  'TASK_NOT_FOUND': MCPErrorCodes.RESOURCE_NOT_FOUND,
  'AGENT_NOT_FOUND': MCPErrorCodes.RESOURCE_NOT_FOUND,
  'FILE_NOT_FOUND': MCPErrorCodes.RESOURCE_NOT_FOUND,
  
  // Validation and parameter errors
  'VALIDATION_ERROR': MCPErrorCodes.INVALID_PARAMS,
  'INVALID_INPUT': MCPErrorCodes.INVALID_PARAMS,
  
  // Tool and method errors
  'UNKNOWN_TOOL': MCPErrorCodes.TOOL_NOT_FOUND,
  
  // Resource availability errors
  'TASK_LOCKED': MCPErrorCodes.RESOURCE_UNAVAILABLE,
  'LOCK_FAILED': MCPErrorCodes.RESOURCE_UNAVAILABLE,
  
  // Prompt-related errors
  'PROMPT_ERROR': MCPErrorCodes.PROMPT_NOT_FOUND,
  
  // Internal server errors (default fallback)
  'INTERNAL_ERROR': MCPErrorCodes.INTERNAL_ERROR
};

/**
 * Create MCP-compliant error from AgentCommError or generic Error
 * 
 * @param error - AgentCommError instance or generic Error
 * @returns MCP-compliant error structure
 */
export function createMCPError(error: AgentCommError | Error): MCPError {
  if (error instanceof AgentCommError) {
    // Map AgentCommError to appropriate MCP error code
    const code = ERROR_TYPE_MAPPING[error.code] || MCPErrorCodes.INTERNAL_ERROR;
    
    return {
      code,
      message: error.message,
      data: {
        type: error.code,
        originalError: error.message,
        ...(error.details ? { details: error.details as Record<string, unknown> } : {})
      }
    };
  }
  
  // Handle generic Error objects
  return {
    code: MCPErrorCodes.INTERNAL_ERROR,
    message: error.message,
    data: {
      type: 'INTERNAL_ERROR',
      originalError: error.message
    }
  };
}

/**
 * Format complete MCP error response
 * 
 * @param error - MCP error structure
 * @param requestId - JSON-RPC request ID (null for notifications)
 * @param meta - Optional metadata for error context
 * @returns Complete MCP-compliant error response
 */
export function formatMCPErrorResponse(
  error: MCPError,
  requestId: string | number | null,
  meta?: Record<string, unknown>
): MCPErrorResponse {
  const response: MCPErrorResponse = {
    jsonrpc: '2.0',
    id: requestId,
    error
  };
  
  if (meta && Object.keys(meta).length > 0) {
    response._meta = meta;
  }
  
  return response;
}

/**
 * Create standard error metadata for MCP responses
 * 
 * @param source - Error source identifier
 * @param serverVersion - Server version string
 * @param requestId - Original request ID
 * @returns Standard MCP error metadata
 */
export function createErrorMeta(
  source: string,
  serverVersion?: string,
  requestId?: string
): MCPErrorMeta {
  const meta: MCPErrorMeta = {
    'modelcontextprotocol.io/errorSource': source,
    'modelcontextprotocol.io/timestamp': new Date().toISOString()
  };
  
  if (serverVersion) {
    meta['modelcontextprotocol.io/serverVersion'] = serverVersion;
  }
  
  if (requestId) {
    meta['modelcontextprotocol.io/requestId'] = requestId;
  }
  
  return meta;
}

/**
 * Utility to check if an error code is an MCP-specific code
 * 
 * @param code - Error code to check
 * @returns True if code is in MCP-specific range
 */
export function isMCPSpecificError(code: number): boolean {
  return code >= -32099 && code <= -32000;
}

/**
 * Get human-readable error type from MCP error code
 * 
 * @param code - MCP error code
 * @returns Human-readable error type
 */
export function getErrorTypeFromCode(code: number): string {
  const codeMap = Object.entries(MCPErrorCodes).find(([, value]) => value === code);
  return codeMap ? codeMap[0] : 'UNKNOWN_ERROR';
}