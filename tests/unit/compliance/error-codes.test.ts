/**
 * MCP Error Codes Compliance Tests
 * Tests for MCP 2025-06-18 specification error code compliance
 */

import { 
  MCPErrorCodes, 
  createMCPError, 
  formatMCPErrorResponse,
  createErrorMeta,
  isMCPSpecificError,
  getErrorTypeFromCode
} from '../../../src/compliance/error-codes.js';
import { AgentCommError } from '../../../src/types.js';

describe('MCP Error Codes Compliance', () => {
  describe('MCPErrorCodes Constants', () => {
    it('should define all required MCP error codes', () => {
      expect(MCPErrorCodes.PARSE_ERROR).toBe(-32700);
      expect(MCPErrorCodes.INVALID_REQUEST).toBe(-32600);
      expect(MCPErrorCodes.METHOD_NOT_FOUND).toBe(-32601);
      expect(MCPErrorCodes.INVALID_PARAMS).toBe(-32602);
      expect(MCPErrorCodes.INTERNAL_ERROR).toBe(-32603);
    });

    it('should define MCP-specific error codes', () => {
      expect(MCPErrorCodes.RESOURCE_NOT_FOUND).toBe(-32001);
      expect(MCPErrorCodes.RESOURCE_UNAVAILABLE).toBe(-32002);
      expect(MCPErrorCodes.PROMPT_NOT_FOUND).toBe(-32003);
      expect(MCPErrorCodes.TOOL_NOT_FOUND).toBe(-32004);
      expect(MCPErrorCodes.COMPLETION_NOT_AVAILABLE).toBe(-32005);
    });
  });

  describe('createMCPError Function', () => {
    it('should create MCP-compliant error for AgentCommError mapping', () => {
      const agentError = new AgentCommError('Task not found', 'TASK_NOT_FOUND');
      const mcpError = createMCPError(agentError);

      expect(mcpError).toEqual({
        code: MCPErrorCodes.RESOURCE_NOT_FOUND,
        message: 'Task not found',
        data: {
          type: 'TASK_NOT_FOUND',
          originalError: 'Task not found'
        }
      });
    });

    it('should create MCP-compliant error for validation errors', () => {
      const agentError = new AgentCommError('Invalid agent name', 'VALIDATION_ERROR');
      const mcpError = createMCPError(agentError);

      expect(mcpError).toEqual({
        code: MCPErrorCodes.INVALID_PARAMS,
        message: 'Invalid agent name',
        data: {
          type: 'VALIDATION_ERROR',
          originalError: 'Invalid agent name'
        }
      });
    });

    it('should handle unknown error types with internal error code', () => {
      const agentError = new AgentCommError('Unknown error', 'UNKNOWN_ERROR_TYPE');
      const mcpError = createMCPError(agentError);

      expect(mcpError).toEqual({
        code: MCPErrorCodes.INTERNAL_ERROR,
        message: 'Unknown error',
        data: {
          type: 'UNKNOWN_ERROR_TYPE',
          originalError: 'Unknown error'
        }
      });
    });

    it('should handle generic Error objects', () => {
      const genericError = new Error('Generic error message');
      const mcpError = createMCPError(genericError);

      expect(mcpError).toEqual({
        code: MCPErrorCodes.INTERNAL_ERROR,
        message: 'Generic error message',
        data: {
          type: 'INTERNAL_ERROR',
          originalError: 'Generic error message'
        }
      });
    });
  });

  describe('formatMCPErrorResponse Function', () => {
    it('should format complete MCP error response with request ID', () => {
      const error = {
        code: MCPErrorCodes.RESOURCE_NOT_FOUND,
        message: 'Resource not found',
        data: { type: 'RESOURCE_ERROR' }
      };
      
      const response = formatMCPErrorResponse(error, 'req-123');

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 'req-123',
        error: {
          code: -32001,
          message: 'Resource not found',
          data: { type: 'RESOURCE_ERROR' }
        }
      });
    });

    it('should handle null request ID for notifications', () => {
      const error = {
        code: MCPErrorCodes.INTERNAL_ERROR,
        message: 'Internal error',
        data: { type: 'INTERNAL_ERROR' }
      };
      
      const response = formatMCPErrorResponse(error, null);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { type: 'INTERNAL_ERROR' }
        }
      });
    });

    it('should include _meta field when provided', () => {
      const error = {
        code: MCPErrorCodes.INVALID_PARAMS,
        message: 'Invalid parameters',
        data: { type: 'VALIDATION_ERROR' }
      };
      
      const meta = {
        'modelcontextprotocol.io/errorSource': 'server-validation',
        'modelcontextprotocol.io/timestamp': '2024-01-15T10:30:00Z'
      };
      
      const response = formatMCPErrorResponse(error, 'req-456', meta);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 'req-456',
        error: {
          code: -32602,
          message: 'Invalid parameters',
          data: { type: 'VALIDATION_ERROR' }
        },
        _meta: meta
      });
    });
  });

  describe('Error Mapping Integration', () => {
    it('should correctly map all AgentCommError types to MCP codes', () => {
      const errorMappings = [
        { type: 'TASK_NOT_FOUND', expectedCode: MCPErrorCodes.RESOURCE_NOT_FOUND },
        { type: 'AGENT_NOT_FOUND', expectedCode: MCPErrorCodes.RESOURCE_NOT_FOUND },
        { type: 'FILE_NOT_FOUND', expectedCode: MCPErrorCodes.RESOURCE_NOT_FOUND },
        { type: 'VALIDATION_ERROR', expectedCode: MCPErrorCodes.INVALID_PARAMS },
        { type: 'INVALID_INPUT', expectedCode: MCPErrorCodes.INVALID_PARAMS },
        { type: 'UNKNOWN_TOOL', expectedCode: MCPErrorCodes.TOOL_NOT_FOUND },
        { type: 'TASK_LOCKED', expectedCode: MCPErrorCodes.RESOURCE_UNAVAILABLE },
        { type: 'LOCK_FAILED', expectedCode: MCPErrorCodes.RESOURCE_UNAVAILABLE },
        { type: 'INTERNAL_ERROR', expectedCode: MCPErrorCodes.INTERNAL_ERROR }
      ];

      errorMappings.forEach(({ type, expectedCode }) => {
        const error = new AgentCommError(`Test ${type}`, type);
        const mcpError = createMCPError(error);
        expect(mcpError.code).toBe(expectedCode);
      });
    });
  });

  describe('createErrorMeta Function', () => {
    it('should create standard error metadata', () => {
      const meta = createErrorMeta('server-validation', '0.7.0', 'req-123');
      
      expect(meta['modelcontextprotocol.io/errorSource']).toBe('server-validation');
      expect(meta['modelcontextprotocol.io/serverVersion']).toBe('0.7.0');
      expect(meta['modelcontextprotocol.io/requestId']).toBe('req-123');
      expect(meta['modelcontextprotocol.io/timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle optional parameters', () => {
      const meta = createErrorMeta('server-validation');
      
      expect(meta['modelcontextprotocol.io/errorSource']).toBe('server-validation');
      expect(meta['modelcontextprotocol.io/timestamp']).toBeDefined();
      expect(meta['modelcontextprotocol.io/serverVersion']).toBeUndefined();
      expect(meta['modelcontextprotocol.io/requestId']).toBeUndefined();
    });
  });

  describe('Utility Functions', () => {
    it('should correctly identify MCP-specific error codes', () => {
      expect(isMCPSpecificError(MCPErrorCodes.RESOURCE_NOT_FOUND)).toBe(true);
      expect(isMCPSpecificError(MCPErrorCodes.RESOURCE_UNAVAILABLE)).toBe(true);
      expect(isMCPSpecificError(MCPErrorCodes.INTERNAL_ERROR)).toBe(false);
      expect(isMCPSpecificError(-32100)).toBe(false);
      expect(isMCPSpecificError(-31999)).toBe(false);
    });

    it('should get human-readable error type from code', () => {
      expect(getErrorTypeFromCode(MCPErrorCodes.RESOURCE_NOT_FOUND)).toBe('RESOURCE_NOT_FOUND');
      expect(getErrorTypeFromCode(MCPErrorCodes.INVALID_PARAMS)).toBe('INVALID_PARAMS');
      expect(getErrorTypeFromCode(-99999)).toBe('UNKNOWN_ERROR');
    });
  });
});