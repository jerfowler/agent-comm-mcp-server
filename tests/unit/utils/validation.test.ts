/**
 * Unit tests for validation utilities
 */

import {
  validateRequiredString,
  validateOptionalString,
  validateNumber,
  validateBoolean,
  validateEnum,
  validateTaskFileType,
  validateArchiveMode,
  validateFileName,
  validateDirectoryName,
  validateContent,
  sanitizeString
} from '../../../src/utils/validation.js';
import { InvalidTaskError } from '../../../src/types.js';

describe('Validation Utilities', () => {
  describe('validateRequiredString', () => {
    it('should return trimmed string for valid input', () => {
      expect(validateRequiredString('  test  ', 'param')).toBe('test');
      expect(validateRequiredString('valid-string', 'param')).toBe('valid-string');
    });

    it('should throw for non-string input', () => {
      expect(() => validateRequiredString(123, 'param')).toThrow(InvalidTaskError);
      expect(() => validateRequiredString(null, 'param')).toThrow(InvalidTaskError);
      expect(() => validateRequiredString(undefined, 'param')).toThrow(InvalidTaskError);
      expect(() => validateRequiredString({}, 'param')).toThrow(InvalidTaskError);
    });

    it('should throw for empty string', () => {
      expect(() => validateRequiredString('', 'param')).toThrow(InvalidTaskError);
      expect(() => validateRequiredString('   ', 'param')).toThrow(InvalidTaskError);
    });

    it('should include parameter name in error message', () => {
      expect(() => validateRequiredString('', 'testParam')).toThrow('testParam must be a non-empty string');
    });
  });

  describe('validateOptionalString', () => {
    it('should return trimmed string for valid input', () => {
      expect(validateOptionalString('  test  ', 'param')).toBe('test');
      expect(validateOptionalString('valid-string', 'param')).toBe('valid-string');
    });

    it('should return undefined for null/undefined', () => {
      expect(validateOptionalString(null, 'param')).toBeUndefined();
      expect(validateOptionalString(undefined, 'param')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(validateOptionalString('', 'param')).toBeUndefined();
      expect(validateOptionalString('   ', 'param')).toBeUndefined();
    });

    it('should throw for non-string input', () => {
      expect(() => validateOptionalString(123, 'param')).toThrow(InvalidTaskError);
      expect(() => validateOptionalString({}, 'param')).toThrow(InvalidTaskError);
    });
  });

  describe('validateNumber', () => {
    it('should return number for valid input', () => {
      expect(validateNumber(42, 'param')).toBe(42);
      expect(validateNumber(0, 'param')).toBe(0);
      expect(validateNumber(-10, 'param')).toBe(-10);
      expect(validateNumber(3.14, 'param')).toBe(3.14);
    });

    it('should throw for non-number input', () => {
      expect(() => validateNumber('42', 'param')).toThrow(InvalidTaskError);
      expect(() => validateNumber(null, 'param')).toThrow(InvalidTaskError);
      expect(() => validateNumber(NaN, 'param')).toThrow(InvalidTaskError);
    });

    it('should validate minimum value', () => {
      expect(validateNumber(10, 'param', 5)).toBe(10);
      expect(() => validateNumber(3, 'param', 5)).toThrow('param must be at least 5');
    });

    it('should validate maximum value', () => {
      expect(validateNumber(10, 'param', undefined, 15)).toBe(10);
      expect(() => validateNumber(20, 'param', undefined, 15)).toThrow('param must be at most 15');
    });

    it('should validate both min and max', () => {
      expect(validateNumber(10, 'param', 5, 15)).toBe(10);
      expect(() => validateNumber(3, 'param', 5, 15)).toThrow('param must be at least 5');
      expect(() => validateNumber(20, 'param', 5, 15)).toThrow('param must be at most 15');
    });
  });

  describe('validateBoolean', () => {
    it('should return boolean for valid input', () => {
      expect(validateBoolean(true, 'param')).toBe(true);
      expect(validateBoolean(false, 'param')).toBe(false);
    });

    it('should return default value for null/undefined', () => {
      expect(validateBoolean(null, 'param', true)).toBe(true);
      expect(validateBoolean(undefined, 'param', false)).toBe(false);
    });

    it('should throw when required and null/undefined', () => {
      expect(() => validateBoolean(null, 'param')).toThrow(InvalidTaskError);
      expect(() => validateBoolean(undefined, 'param')).toThrow(InvalidTaskError);
    });

    it('should throw for non-boolean input', () => {
      expect(() => validateBoolean('true', 'param')).toThrow(InvalidTaskError);
      expect(() => validateBoolean(1, 'param')).toThrow(InvalidTaskError);
    });
  });

  describe('validateEnum', () => {
    const validValues = ['option1', 'option2', 'option3'] as const;

    it('should return valid enum value', () => {
      expect(validateEnum('option1', 'param', validValues)).toBe('option1');
      expect(validateEnum('option2', 'param', validValues)).toBe('option2');
    });

    it('should throw for invalid enum value', () => {
      expect(() => validateEnum('invalid', 'param', validValues))
        .toThrow('param must be one of: option1, option2, option3');
    });

    it('should throw for non-string input', () => {
      expect(() => validateEnum(123, 'param', validValues)).toThrow(InvalidTaskError);
    });
  });

  describe('validateTaskFileType', () => {
    it('should return valid file type', () => {
      expect(validateTaskFileType('INIT')).toBe('INIT');
      expect(validateTaskFileType('PLAN')).toBe('PLAN');
      expect(validateTaskFileType('DONE')).toBe('DONE');
      expect(validateTaskFileType('ERROR')).toBe('ERROR');
    });

    it('should throw for invalid file type', () => {
      expect(() => validateTaskFileType('INVALID'))
        .toThrow('file must be one of: INIT, PLAN, DONE, ERROR');
    });
  });

  describe('validateArchiveMode', () => {
    it('should return valid archive mode', () => {
      expect(validateArchiveMode('completed')).toBe('completed');
      expect(validateArchiveMode('all')).toBe('all');
      expect(validateArchiveMode('by-agent')).toBe('by-agent');
      expect(validateArchiveMode('by-date')).toBe('by-date');
    });

    it('should throw for invalid archive mode', () => {
      expect(() => validateArchiveMode('invalid'))
        .toThrow('mode must be one of: completed, all, by-agent, by-date');
    });
  });

  describe('validateFileName', () => {
    it('should accept valid markdown file names', () => {
      expect(() => validateFileName('task.md')).not.toThrow();
      expect(() => validateFileName('INIT.md')).not.toThrow();
      expect(() => validateFileName('PLAN.md')).not.toThrow();
    });

    it('should throw for empty file name', () => {
      expect(() => validateFileName('')).toThrow('File name cannot be empty');
      expect(() => validateFileName('   ')).toThrow('File name cannot be empty');
    });

    it('should throw for path traversal attempts', () => {
      expect(() => validateFileName('../task.md')).toThrow('File name cannot contain path traversal characters');
      expect(() => validateFileName('task/../other.md')).toThrow('File name cannot contain path traversal characters');
      expect(() => validateFileName('task/file.md')).toThrow('File name cannot contain path traversal characters');
      expect(() => validateFileName('task\\\\file.md')).toThrow('File name cannot contain path traversal characters');
    });

    it('should throw for invalid system files', () => {
      expect(() => validateFileName('.hidden.md')).toThrow('Invalid file name');
    });

    it('should throw for non-markdown files', () => {
      expect(() => validateFileName('task.txt')).toThrow('File must have .md extension');
      expect(() => validateFileName('task')).toThrow('File must have .md extension');
    });
  });

  describe('validateDirectoryName', () => {
    it('should accept valid directory names', () => {
      expect(() => validateDirectoryName('task-directory')).not.toThrow();
      expect(() => validateDirectoryName('agent123')).not.toThrow();
      expect(() => validateDirectoryName('.archive')).not.toThrow();
    });

    it('should throw for empty directory name', () => {
      expect(() => validateDirectoryName('')).toThrow('Directory name cannot be empty');
    });

    it('should throw for path traversal attempts', () => {
      expect(() => validateDirectoryName('../directory')).toThrow('Directory name cannot contain path traversal characters');
      expect(() => validateDirectoryName('dir/subdir')).toThrow('Directory name cannot contain path traversal characters');
    });

    it('should throw for invalid system directories', () => {
      expect(() => validateDirectoryName('.hidden')).toThrow('Invalid directory name');
    });
  });

  describe('validateContent', () => {
    it('should accept non-empty content', () => {
      expect(() => validateContent('Valid content')).not.toThrow();
      expect(() => validateContent('# Title\\n\\nContent')).not.toThrow();
    });

    it('should throw for empty content', () => {
      expect(() => validateContent('')).toThrow('Content cannot be empty');
      expect(() => validateContent('   ')).toThrow('Content cannot be empty');
    });
  });

  describe('sanitizeString', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeString('file<>:"/\\\\|?*.txt')).toBe('file.txt');
      expect(sanitizeString('valid-name')).toBe('valid-name');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  trimmed  ')).toBe('trimmed');
    });

    it('should remove null bytes', () => {
      expect(sanitizeString('file\x00name')).toBe('filename');
    });

    it('should limit length', () => {
      const longString = 'a'.repeat(300);
      const result = sanitizeString(longString);
      expect(result.length).toBe(255);
    });

    it('should handle empty input', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });
  });
});