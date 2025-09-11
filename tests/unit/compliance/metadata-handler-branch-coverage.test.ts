/**
 * Additional tests for metadata-handler to improve branch coverage
 * Current: 56.25% → Target: 95%
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MetadataHandler } from '../../../src/compliance/metadata-handler.js';
import { ErrorCodes } from '../../../src/compliance/error-codes.js';

describe('MetadataHandler - Branch Coverage', () => {
  let handler: MetadataHandler;
  let errorCodes: ErrorCodes;
  
  beforeEach(() => {
    errorCodes = new ErrorCodes();
    handler = new MetadataHandler(errorCodes);
  });

  describe('Edge cases and error paths', () => {
    
    it('should handle extractMetadata with null content', () => {
      const result = handler.extractMetadata(null as any);
      
      expect(result).toEqual({
        originalContent: '',
        metadata: {}
      });
    });

    it('should handle extractMetadata with undefined content', () => {
      const result = handler.extractMetadata(undefined as any);
      
      expect(result).toEqual({
        originalContent: '',
        metadata: {}
      });
    });

    it('should handle extractMetadata with non-string content', () => {
      const result = handler.extractMetadata(12345 as any);
      
      expect(result).toEqual({
        originalContent: '12345',
        metadata: {}
      });
    });

    it('should handle extractMetadata with object content', () => {
      const result = handler.extractMetadata({ test: 'value' } as any);
      
      expect(result).toEqual({
        originalContent: '[object Object]',
        metadata: {}
      });
    });

    it('should handle malformed YAML front matter', () => {
      const content = `---
invalid: yaml: content: that: breaks
malformed: [not closed
---
# Content`;
      
      const result = handler.extractMetadata(content);
      
      // Should return original content when YAML parsing fails
      expect(result.originalContent).toBe(content);
      expect(result.metadata).toEqual({});
    });

    it('should handle YAML with only opening delimiter', () => {
      const content = `---
title: Test
# Missing closing delimiter`;
      
      const result = handler.extractMetadata(content);
      
      expect(result.originalContent).toBe(content);
      expect(result.metadata).toEqual({});
    });

    it('should handle YAML with only closing delimiter', () => {
      const content = `Missing opening delimiter
---
# Content`;
      
      const result = handler.extractMetadata(content);
      
      expect(result.originalContent).toBe(content);
      expect(result.metadata).toEqual({});
    });

    it('should extract valid YAML metadata', () => {
      const content = `---
title: Test Document
author: Test Author
tags:
  - test
  - coverage
priority: high
---
# Main Content
This is the document content.`;
      
      const result = handler.extractMetadata(content);
      
      expect(result.originalContent).toContain('Main Content');
      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.metadata.tags).toEqual(['test', 'coverage']);
      expect(result.metadata.priority).toBe('high');
    });

    it('should handle empty YAML block', () => {
      const content = `---
---
# Content`;
      
      const result = handler.extractMetadata(content);
      
      expect(result.originalContent).toContain('Content');
      expect(result.metadata).toEqual({});
    });

    it('should injectMetadata with null metadata', () => {
      const content = '# Document';
      
      const result = handler.injectMetadata(content, null as any);
      
      expect(result).toBe(content);
    });

    it('should injectMetadata with undefined metadata', () => {
      const content = '# Document';
      
      const result = handler.injectMetadata(content, undefined as any);
      
      expect(result).toBe(content);
    });

    it('should injectMetadata with empty metadata object', () => {
      const content = '# Document';
      
      const result = handler.injectMetadata(content, {});
      
      expect(result).toBe(content);
    });

    it('should injectMetadata with complex metadata', () => {
      const content = '# Document\nMain content here';
      const metadata = {
        title: 'Test',
        version: 1.0,
        nested: {
          key: 'value',
          array: [1, 2, 3]
        },
        tags: ['test', 'coverage'],
        nullValue: null,
        undefinedValue: undefined
      };
      
      const result = handler.injectMetadata(content, metadata);
      
      expect(result).toContain('---');
      expect(result).toContain('title: Test');
      expect(result).toContain('version: 1');
      expect(result).toContain('nested:');
      expect(result).toContain('key: value');
      expect(result).toContain('tags:');
      expect(result).toContain('- test');
      expect(result).toContain('- coverage');
      expect(result).toContain('Main content here');
    });

    it('should injectMetadata into content that already has metadata', () => {
      const content = `---
existing: metadata
---
# Document`;
      
      const newMetadata = {
        title: 'New Title',
        author: 'New Author'
      };
      
      const result = handler.injectMetadata(content, newMetadata);
      
      expect(result).toContain('title: New Title');
      expect(result).toContain('author: New Author');
      expect(result).not.toContain('existing: metadata');
    });

    it('should validateMetadata with null metadata', () => {
      const errors = handler.validateMetadata(null as any);
      
      expect(errors).toEqual([]);
    });

    it('should validateMetadata with undefined metadata', () => {
      const errors = handler.validateMetadata(undefined as any);
      
      expect(errors).toEqual([]);
    });

    it('should validateMetadata with non-object metadata', () => {
      const errors = handler.validateMetadata('string' as any);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must be an object');
    });

    it('should validateMetadata with array metadata', () => {
      const errors = handler.validateMetadata([1, 2, 3] as any);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must be an object');
    });

    it('should validateMetadata with valid metadata', () => {
      const metadata = {
        title: 'Valid Title',
        priority: 'high',
        tags: ['tag1', 'tag2']
      };
      
      const errors = handler.validateMetadata(metadata);
      
      expect(errors).toEqual([]);
    });

    it('should validateMetadata with invalid priority', () => {
      const metadata = {
        priority: 'invalid-priority'
      };
      
      const errors = handler.validateMetadata(metadata);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('priority');
    });

    it('should validateMetadata with non-string title', () => {
      const metadata = {
        title: 12345
      };
      
      const errors = handler.validateMetadata(metadata);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('title');
    });

    it('should validateMetadata with non-array tags', () => {
      const metadata = {
        tags: 'not-an-array'
      };
      
      const errors = handler.validateMetadata(metadata);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('tags');
    });

    it('should validateMetadata with mixed tag types', () => {
      const metadata = {
        tags: ['string', 123, true, null]
      };
      
      const errors = handler.validateMetadata(metadata);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('tag');
    });

    it('should handle circular references in metadata', () => {
      const metadata: any = {
        title: 'Test'
      };
      metadata.circular = metadata;
      
      // Should handle circular reference without crashing
      const result = handler.injectMetadata('# Content', metadata);
      
      expect(result).toContain('# Content');
      expect(result).toContain('title: Test');
    });

    it('should handle special characters in metadata values', () => {
      const metadata = {
        title: 'Title with "quotes" and \'apostrophes\'',
        description: 'Line 1\\nLine 2\\tTabbed',
        special: '---'
      };
      
      const content = '# Document';
      const result = handler.injectMetadata(content, metadata);
      
      expect(result).toContain('title:');
      expect(result).toContain('description:');
      expect(result).toContain('special:');
    });

    it('should handle date objects in metadata', () => {
      const metadata = {
        createdAt: new Date('2025-01-01T00:00:00Z'),
        title: 'Test'
      };
      
      const result = handler.injectMetadata('# Content', metadata);
      
      expect(result).toContain('createdAt:');
      expect(result).toContain('title: Test');
    });

    it('should handle functions in metadata (should be ignored)', () => {
      const metadata = {
        title: 'Test',
        fn: () => console.log('test'),
        method: function() { return 'test'; }
      };
      
      const result = handler.injectMetadata('# Content', metadata as any);
      
      expect(result).toContain('title: Test');
      expect(result).not.toContain('fn:');
      expect(result).not.toContain('method:');
    });

    it('should handle Symbol in metadata', () => {
      const metadata = {
        title: 'Test',
        [Symbol('test')]: 'value'
      };
      
      const result = handler.injectMetadata('# Content', metadata);
      
      expect(result).toContain('title: Test');
      // Symbols should be ignored
    });

    it('should preserve content when YAML stringification fails', () => {
      // Mock console.error to suppress error output in test
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const metadata = {
        title: 'Test'
      };
      
      // Override YAML stringify to throw
      const originalStringify = JSON.stringify;
      (global as any).JSON = {
        ...JSON,
        stringify: () => { throw new Error('Stringify failed'); }
      };
      
      const result = handler.injectMetadata('# Content', metadata);
      
      // Should return original content on error
      expect(result).toBe('# Content');
      
      // Restore
      (global as any).JSON.stringify = originalStringify;
      consoleError.mockRestore();
    });
  });

  describe('Error code metadata handling', () => {
    
    it('should handle error metadata with all fields', () => {
      const metadata = {
        errorCode: 'TEST_ERROR',
        severity: 'high',
        category: 'validation',
        timestamp: new Date().toISOString()
      };
      
      const content = handler.injectMetadata('Error occurred', metadata);
      
      expect(content).toContain('errorCode: TEST_ERROR');
      expect(content).toContain('severity: high');
      expect(content).toContain('category: validation');
    });

    it('should extract error metadata correctly', () => {
      const content = `---
errorCode: TEST_ERROR
severity: high
category: validation
---
# Error Details
Something went wrong`;
      
      const result = handler.extractMetadata(content);
      
      expect(result.metadata.errorCode).toBe('TEST_ERROR');
      expect(result.metadata.severity).toBe('high');
      expect(result.metadata.category).toBe('validation');
      expect(result.originalContent).toContain('Error Details');
    });
  });

  describe('Complex nested metadata', () => {
    
    it('should handle deeply nested metadata structures', () => {
      const metadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep'
              }
            }
          }
        }
      };
      
      const result = handler.injectMetadata('# Content', metadata);
      
      expect(result).toContain('level1:');
      expect(result).toContain('level2:');
      expect(result).toContain('level3:');
      expect(result).toContain('level4:');
      expect(result).toContain('value: deep');
    });

    it('should handle mixed arrays and objects', () => {
      const metadata = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ],
        config: {
          settings: ['setting1', 'setting2'],
          enabled: true
        }
      };
      
      const result = handler.injectMetadata('# Content', metadata);
      
      expect(result).toContain('items:');
      expect(result).toContain('id: 1');
      expect(result).toContain('name: Item 1');
      expect(result).toContain('settings:');
      expect(result).toContain('- setting1');
    });
  });
});