/**
 * Additional tests for MCP Metadata Handler to achieve 95%+ coverage
 * Focuses on uncovered lines in createMCPMeta function
 */

import { 
  createMCPMeta,
  MCPStandardMeta
} from '../../../src/compliance/metadata-handler.js';

describe('MCP Metadata Handler Additional Coverage', () => {
  describe('createMCPMeta with all optional fields', () => {
    it('should handle all fields being undefined', () => {
      const meta: MCPStandardMeta = {};
      const result = createMCPMeta(meta);
      
      expect(result).toEqual({});
      expect(Object.keys(result).length).toBe(0);
    });

    it('should include serverName when provided', () => {
      const meta: MCPStandardMeta = {
        serverName: 'test-server'
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/serverName']).toBe('test-server');
      expect(Object.keys(result).length).toBe(1);
    });

    it('should include timestamp when provided', () => {
      const timestamp = new Date().toISOString();
      const meta: MCPStandardMeta = {
        timestamp
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/timestamp']).toBe(timestamp);
      expect(Object.keys(result).length).toBe(1);
    });

    it('should include responseStatus when provided', () => {
      const meta: MCPStandardMeta = {
        responseStatus: 'success'
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/responseStatus']).toBe('success');
      expect(Object.keys(result).length).toBe(1);
    });

    it('should include errorType when provided', () => {
      const meta: MCPStandardMeta = {
        errorType: 'ValidationError'
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/errorType']).toBe('ValidationError');
      expect(Object.keys(result).length).toBe(1);
    });

    it('should include errorMessage when provided', () => {
      const meta: MCPStandardMeta = {
        errorMessage: 'Invalid input'
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/errorMessage']).toBe('Invalid input');
      expect(Object.keys(result).length).toBe(1);
    });

    it('should include taskId when provided', () => {
      const meta: MCPStandardMeta = {
        taskId: 'task-123'
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/taskId']).toBe('task-123');
      expect(Object.keys(result).length).toBe(1);
    });

    it('should include progress when provided', () => {
      const meta: MCPStandardMeta = {
        progress: 50
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/progress']).toBe(50);
      expect(Object.keys(result).length).toBe(1);
    });

    it('should include status when provided', () => {
      const meta: MCPStandardMeta = {
        status: 'in_progress'
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/status']).toBe('in_progress');
      expect(Object.keys(result).length).toBe(1);
    });

    it('should handle all fields being provided', () => {
      const meta: MCPStandardMeta = {
        serverVersion: '1.0.0',
        serverName: 'test-server',
        requestId: 'req-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        responseStatus: 'success',
        errorType: 'none',
        errorMessage: 'no error',
        taskId: 'task-456',
        progress: 100,
        status: 'completed'
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/serverVersion']).toBe('1.0.0');
      expect(result['modelcontextprotocol.io/serverName']).toBe('test-server');
      expect(result['modelcontextprotocol.io/requestId']).toBe('req-123');
      expect(result['modelcontextprotocol.io/timestamp']).toBe('2024-01-01T00:00:00.000Z');
      expect(result['modelcontextprotocol.io/responseStatus']).toBe('success');
      expect(result['modelcontextprotocol.io/errorType']).toBe('none');
      expect(result['modelcontextprotocol.io/errorMessage']).toBe('no error');
      expect(result['modelcontextprotocol.io/taskId']).toBe('task-456');
      expect(result['modelcontextprotocol.io/progress']).toBe(100);
      expect(result['modelcontextprotocol.io/status']).toBe('completed');
      expect(Object.keys(result).length).toBe(10);
    });

    it('should handle partial fields', () => {
      const meta: MCPStandardMeta = {
        serverVersion: '2.0.0',
        requestId: 'req-789',
        progress: 25
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/serverVersion']).toBe('2.0.0');
      expect(result['modelcontextprotocol.io/requestId']).toBe('req-789');
      expect(result['modelcontextprotocol.io/progress']).toBe(25);
      expect(Object.keys(result).length).toBe(3);
    });

    it('should handle zero progress value', () => {
      const meta: MCPStandardMeta = {
        progress: 0
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/progress']).toBe(0);
      expect(Object.keys(result).length).toBe(1);
    });

    it('should handle empty string values', () => {
      const meta: MCPStandardMeta = {
        serverName: '',
        errorMessage: '',
        status: ''
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/serverName']).toBe('');
      expect(result['modelcontextprotocol.io/errorMessage']).toBe('');
      expect(result['modelcontextprotocol.io/status']).toBe('');
      expect(Object.keys(result).length).toBe(3);
    });

    it('should not include explicitly undefined fields', () => {
      const meta: MCPStandardMeta = {
        serverVersion: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z'
      };
      const result = createMCPMeta(meta);
      
      expect(result['modelcontextprotocol.io/serverVersion']).toBe('1.0.0');
      expect(result['modelcontextprotocol.io/timestamp']).toBe('2024-01-01T00:00:00.000Z');
      expect(result['modelcontextprotocol.io/serverName']).toBeUndefined();
      expect(result['modelcontextprotocol.io/requestId']).toBeUndefined();
      expect(Object.keys(result).length).toBe(2);
    });
  });
});