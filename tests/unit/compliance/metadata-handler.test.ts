/**
 * MCP Metadata Handler Tests
 * Tests for MCP 2025-06-18 specification _meta field compliance
 */

import { 
  MCPMetaHandler,
  createMCPMeta,
  validateMCPMeta,
  mergeMCPMeta,
  isMCPReservedKey
} from '../../../src/compliance/metadata-handler.js';

describe('MCP Metadata Handler Compliance', () => {
  let metaHandler: MCPMetaHandler;

  beforeEach(() => {
    metaHandler = new MCPMetaHandler('0.7.0', 'agent-comm-mcp-server');
  });

  describe('MCPMetaHandler Class', () => {
    it('should create standard metadata for responses', () => {
      const meta = metaHandler.createResponseMeta('req-123', 'success');

      expect(meta['modelcontextprotocol.io/serverVersion']).toBe('0.7.0');
      expect(meta['modelcontextprotocol.io/serverName']).toBe('agent-comm-mcp-server');
      expect(meta['modelcontextprotocol.io/requestId']).toBe('req-123');
      expect(meta['modelcontextprotocol.io/responseStatus']).toBe('success');
      expect(meta['modelcontextprotocol.io/timestamp']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should create error-specific metadata', () => {
      const meta = metaHandler.createErrorMeta('req-456', 'validation_error', 'Invalid parameters');

      expect(meta['modelcontextprotocol.io/serverVersion']).toBe('0.7.0');
      expect(meta['modelcontextprotocol.io/requestId']).toBe('req-456');
      expect(meta['modelcontextprotocol.io/errorType']).toBe('validation_error');
      expect(meta['modelcontextprotocol.io/errorMessage']).toBe('Invalid parameters');
      expect(meta['modelcontextprotocol.io/timestamp']).toBeDefined();
    });

    it('should create progress tracking metadata', () => {
      const meta = metaHandler.createProgressMeta('task-123', 75, 'in_progress');

      expect(meta['modelcontextprotocol.io/taskId']).toBe('task-123');
      expect(meta['modelcontextprotocol.io/progress']).toBe(75);
      expect(meta['modelcontextprotocol.io/status']).toBe('in_progress');
      expect(meta['modelcontextprotocol.io/timestamp']).toBeDefined();
    });

    it('should validate metadata structure', () => {
      const validMeta = {
        'modelcontextprotocol.io/serverVersion': '0.7.0',
        'custom.field': 'allowed'
      };

      const result = metaHandler.validateMeta(validMeta);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid reserved keys', () => {
      const invalidMeta = {
        'modelcontextprotocol.io/invalid-key': 'not-allowed',
        'custom.field': 'allowed'
      };

      const result = metaHandler.validateMeta(invalidMeta);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid reserved key: modelcontextprotocol.io/invalid-key');
    });

    it('should merge metadata with conflict resolution', () => {
      const base = {
        'modelcontextprotocol.io/serverVersion': '0.7.0',
        'custom.field1': 'base'
      };

      const override = {
        'modelcontextprotocol.io/requestId': 'req-123',
        'custom.field1': 'override'
      };

      const merged = metaHandler.mergeMeta(base, override);

      expect(merged['modelcontextprotocol.io/serverVersion']).toBe('0.7.0');
      expect(merged['modelcontextprotocol.io/requestId']).toBe('req-123');
      expect(merged['custom.field1']).toBe('override'); // Override wins
    });
  });

  describe('Utility Functions', () => {
    it('should create standard MCP metadata', () => {
      const meta = createMCPMeta({
        serverVersion: '0.7.0',
        requestId: 'req-123',
        timestamp: '2024-01-15T10:30:00Z'
      });

      expect(meta['modelcontextprotocol.io/serverVersion']).toBe('0.7.0');
      expect(meta['modelcontextprotocol.io/requestId']).toBe('req-123');
      expect(meta['modelcontextprotocol.io/timestamp']).toBe('2024-01-15T10:30:00Z');
    });

    it('should create metadata with all possible fields', () => {
      const meta = createMCPMeta({
        serverVersion: '0.7.0',
        serverName: 'test-server',
        requestId: 'req-456',
        timestamp: '2024-01-15T10:30:00Z',
        responseStatus: 'success',
        errorType: 'validation_error',
        errorMessage: 'Test error',
        taskId: 'task-789',
        progress: 75,
        status: 'in_progress'
      });

      expect(meta['modelcontextprotocol.io/serverVersion']).toBe('0.7.0');
      expect(meta['modelcontextprotocol.io/serverName']).toBe('test-server');
      expect(meta['modelcontextprotocol.io/requestId']).toBe('req-456');
      expect(meta['modelcontextprotocol.io/timestamp']).toBe('2024-01-15T10:30:00Z');
      expect(meta['modelcontextprotocol.io/responseStatus']).toBe('success');
      expect(meta['modelcontextprotocol.io/errorType']).toBe('validation_error');
      expect(meta['modelcontextprotocol.io/errorMessage']).toBe('Test error');
      expect(meta['modelcontextprotocol.io/taskId']).toBe('task-789');
      expect(meta['modelcontextprotocol.io/progress']).toBe(75);
      expect(meta['modelcontextprotocol.io/status']).toBe('in_progress');
    });

    it('should handle empty metadata object', () => {
      const meta = createMCPMeta({});
      expect(meta).toEqual({});
    });

    it('should only include defined fields', () => {
      const meta = createMCPMeta({
        serverVersion: '0.7.0',
        timestamp: '2024-01-15T10:30:00Z'
      });

      expect(meta['modelcontextprotocol.io/serverVersion']).toBe('0.7.0');
      expect(meta['modelcontextprotocol.io/serverName']).toBeUndefined();
      expect(meta['modelcontextprotocol.io/requestId']).toBeUndefined();
      expect(meta['modelcontextprotocol.io/timestamp']).toBe('2024-01-15T10:30:00Z');
      expect(Object.keys(meta).length).toBe(2);
    });

    it('should validate metadata structure', () => {
      const validMeta = {
        'modelcontextprotocol.io/serverVersion': '0.7.0',
        'app.custom.field': 'allowed'
      };

      const result = validateMCPMeta(validMeta);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid reserved keys', () => {
      const invalidMeta = {
        'modelcontextprotocol.io/unknown': 'not-allowed'
      };

      const result = validateMCPMeta(invalidMeta);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should merge metadata correctly', () => {
      const meta1 = { 'field1': 'value1', 'shared': 'original' };
      const meta2 = { 'field2': 'value2', 'shared': 'updated' };

      const merged = mergeMCPMeta(meta1, meta2);

      expect(merged['field1']).toBe('value1');
      expect(merged['field2']).toBe('value2');
      expect(merged['shared']).toBe('updated');
    });

    it('should identify MCP reserved keys correctly', () => {
      expect(isMCPReservedKey('modelcontextprotocol.io/serverVersion')).toBe(true);
      expect(isMCPReservedKey('modelcontextprotocol.io/requestId')).toBe(true);
      expect(isMCPReservedKey('modelcontextprotocol.io/unknown')).toBe(true); // Still reserved prefix
      expect(isMCPReservedKey('custom.field')).toBe(false);
      expect(isMCPReservedKey('app.field')).toBe(false);
    });
  });

  describe('Reserved Keys Validation', () => {
    const validReservedKeys = [
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
    ];

    validReservedKeys.forEach(key => {
      it(`should allow valid reserved key: ${key}`, () => {
        const meta = { [key]: 'test-value' };
        const result = validateMCPMeta(meta);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject unknown reserved keys', () => {
      const meta = { 'modelcontextprotocol.io/invalidKey': 'value' };
      const result = validateMCPMeta(meta);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid reserved key');
    });

    it('should allow non-reserved custom keys', () => {
      const customKeys = [
        'app.custom.field',
        'org.example.metadata',
        'custom-field',
        'user.preference'
      ];

      customKeys.forEach(key => {
        const meta = { [key]: 'test-value' };
        const result = validateMCPMeta(meta);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty metadata objects', () => {
      const result = validateMCPMeta({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle null and undefined values', () => {
      const meta = {
        'modelcontextprotocol.io/serverVersion': null,
        'modelcontextprotocol.io/requestId': undefined,
        'custom.field': 'value'
      };

      const result = validateMCPMeta(meta);
      expect(result.isValid).toBe(true); // null/undefined values are allowed
    });

    it('should handle metadata with circular references safely', () => {
      const obj = { 'custom.field': 'value' } as Record<string, unknown>;
      obj['circular'] = obj;

      // Should not throw, should handle gracefully
      expect(() => validateMCPMeta(obj)).not.toThrow();
    });

    it('should handle very large metadata objects', () => {
      const largeMeta: Record<string, unknown> = {};
      for (let i = 0; i < 1000; i++) {
        largeMeta[`custom.field${i}`] = `value${i}`;
      }

      const result = validateMCPMeta(largeMeta);
      expect(result.isValid).toBe(true);
    });
  });
});