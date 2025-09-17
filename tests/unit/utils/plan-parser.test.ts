/**
 * Unit tests for plan-parser utility
 * Following strict TDD - tests written BEFORE implementation
 * @module tests/unit/utils/plan-parser
 */

import {
  parsePlanCheckboxes,
  validateStepCount,
  extractCheckboxes,
  countCheckedBoxes,
  CHECKBOX_REGEX
} from '../../../src/utils/plan-parser.js';

describe('Plan Parser Utility', () => {
  describe('CHECKBOX_REGEX constant', () => {
    it('should export a single regex pattern', () => {
      expect(CHECKBOX_REGEX).toBeInstanceOf(RegExp);
      expect(CHECKBOX_REGEX.source).toBe('^(\\s*)-\\s*\\[( +|x)\\]\\s+');
      expect(CHECKBOX_REGEX.flags).toContain('g');
      expect(CHECKBOX_REGEX.flags).toContain('m');
    });

    it('should match valid checkbox patterns', () => {
      const validPatterns = [
        '- [ ] Unchecked item',
        '- [x] Checked item',
        '  - [ ] Indented unchecked',
        '    - [x] Double indented checked',
        '- [ ]    Extra spaces after bracket',
        '-  [ ] Extra space before bracket'
      ];

      validPatterns.forEach(pattern => {
        const regex = new RegExp(CHECKBOX_REGEX);
        expect(regex.test(pattern)).toBe(true);
      });
    });

    it('should not match invalid patterns', () => {
      const invalidPatterns = [
        '[ ] Missing dash',
        '- [] No space in brackets',
        '- [X] Capital X',
        '- [ No closing bracket',
        '- ] [ Reversed brackets',
        'Just plain text',
        '* [ ] Wrong bullet type'
      ];

      invalidPatterns.forEach(pattern => {
        const regex = new RegExp(CHECKBOX_REGEX);
        expect(regex.test(pattern)).toBe(false);
      });
    });
  });

  describe('parsePlanCheckboxes()', () => {
    it('should parse simple checkbox list', () => {
      const content = `# Test Plan
- [ ] First unchecked item
- [x] Second checked item
- [ ] Third unchecked item`;

      const result = parsePlanCheckboxes(content);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        line: 2,
        content: 'First unchecked item',
        checked: false,
        indentLevel: 0
      });
      expect(result[1]).toMatchObject({
        line: 3,
        content: 'Second checked item',
        checked: true,
        indentLevel: 0
      });
      expect(result[2]).toMatchObject({
        line: 4,
        content: 'Third unchecked item',
        checked: false,
        indentLevel: 0
      });
    });

    it('should handle nested checkboxes with indentation', () => {
      const content = `# Nested Plan
- [ ] Parent item
  - [ ] Child item 1
  - [x] Child item 2
    - [ ] Grandchild item
- [x] Another parent`;

      const result = parsePlanCheckboxes(content);

      expect(result).toHaveLength(5);
      expect(result[0].indentLevel).toBe(0);
      expect(result[1].indentLevel).toBe(1);
      expect(result[2].indentLevel).toBe(1);
      expect(result[3].indentLevel).toBe(2);
      expect(result[4].indentLevel).toBe(0);
    });

    it('should handle mixed content with non-checkbox lines', () => {
      const content = `# Implementation Plan

## Overview
This is a test plan with mixed content.

## Steps
- [ ] Step 1: Initialize
  Some description here
- [x] Step 2: Execute
  More description
- [ ] Step 3: Validate

## Notes
Additional notes here`;

      const result = parsePlanCheckboxes(content);

      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('Step 1: Initialize');
      expect(result[1].content).toBe('Step 2: Execute');
      expect(result[2].content).toBe('Step 3: Validate');
    });

    it('should return empty array for content without checkboxes', () => {
      const content = `# No Checkboxes Here
Just regular text
* Bullet points
1. Numbered list`;

      const result = parsePlanCheckboxes(content);
      expect(result).toEqual([]);
    });

    it('should handle unicode content correctly', () => {
      const content = `- [ ] Unicode: 测试 🚀 émojis
- [x] Special chars: < > & " '`;

      const result = parsePlanCheckboxes(content);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Unicode: 测试 🚀 émojis');
      expect(result[1].content).toBe('Special chars: < > & " \'');
    });

    it('should handle extra spaces and formatting', () => {
      const content = `- [ ]    Extra spaces after bracket
-  [x]  Spaces around dash and bracket
  - [ ]     Indented with extra spaces`;

      const result = parsePlanCheckboxes(content);

      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('Extra spaces after bracket');
      expect(result[1].content).toBe('Spaces around dash and bracket');
      expect(result[2].content).toBe('Indented with extra spaces');
    });

    it('should complete parsing in less than 10ms for typical plans', () => {
      const content = `# Large Plan\n${Array(50).fill(null)
        .map((_, i) => `- [${i % 3 === 0 ? 'x' : ' '}] Step ${i + 1}: Task description`)
        .join('\n')}`;

      const startTime = Date.now();
      const result = parsePlanCheckboxes(content);
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(50);
      expect(duration).toBeLessThan(10);
    });
  });

  describe('validateStepCount()', () => {
    it('should return true when counts match', () => {
      expect(validateStepCount(5, 5)).toBe(true);
      expect(validateStepCount(0, 0)).toBe(true);
      expect(validateStepCount(100, 100)).toBe(true);
    });

    it('should return false when counts do not match', () => {
      expect(validateStepCount(5, 4)).toBe(false);
      expect(validateStepCount(5, 6)).toBe(false);
      expect(validateStepCount(0, 1)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateStepCount(-1, -1)).toBe(true);
      expect(validateStepCount(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(true);
    });
  });

  describe('extractCheckboxes()', () => {
    it('should extract checkbox content as string array', () => {
      const content = `# Plan
- [ ] First item
- [x] Second item
- [ ] Third item`;

      const result = extractCheckboxes(content);

      expect(result).toEqual([
        'First item',
        'Second item',
        'Third item'
      ]);
    });

    it('should handle nested checkboxes', () => {
      const content = `- [ ] Parent
  - [x] Child 1
  - [ ] Child 2`;

      const result = extractCheckboxes(content);

      expect(result).toEqual([
        'Parent',
        'Child 1',
        'Child 2'
      ]);
    });

    it('should return empty array for no checkboxes', () => {
      const content = 'No checkboxes here';
      const result = extractCheckboxes(content);
      expect(result).toEqual([]);
    });

    it('should preserve content with special characters', () => {
      const content = `- [ ] Use && operator
- [x] Handle || conditions
- [ ] Parse $variable names`;

      const result = extractCheckboxes(content);

      expect(result).toEqual([
        'Use && operator',
        'Handle || conditions',
        'Parse $variable names'
      ]);
    });
  });

  describe('countCheckedBoxes()', () => {
    it('should count only checked boxes', () => {
      const content = `- [ ] Unchecked 1
- [x] Checked 1
- [x] Checked 2
- [ ] Unchecked 2
- [x] Checked 3`;

      const result = countCheckedBoxes(content);
      expect(result).toBe(3);
    });

    it('should return 0 for no checked boxes', () => {
      const content = `- [ ] Unchecked 1
- [ ] Unchecked 2
- [ ] Unchecked 3`;

      const result = countCheckedBoxes(content);
      expect(result).toBe(0);
    });

    it('should return 0 for no checkboxes', () => {
      const content = 'No checkboxes here';
      const result = countCheckedBoxes(content);
      expect(result).toBe(0);
    });

    it('should handle all checked boxes', () => {
      const content = `- [x] Checked 1
- [x] Checked 2
- [x] Checked 3`;

      const result = countCheckedBoxes(content);
      expect(result).toBe(3);
    });

    it('should count nested checked boxes', () => {
      const content = `- [x] Parent checked
  - [ ] Child unchecked
  - [x] Child checked
    - [x] Grandchild checked`;

      const result = countCheckedBoxes(content);
      expect(result).toBe(3);
    });

    it('should complete counting in less than 10ms for large plans', () => {
      const content = `# Large Plan\n${Array(100).fill(null)
        .map((_, i) => `- [${i % 2 === 0 ? 'x' : ' '}] Step ${i + 1}`)
        .join('\n')}`;

      const startTime = Date.now();
      const result = countCheckedBoxes(content);
      const duration = Date.now() - startTime;

      expect(result).toBe(50); // Half are checked
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Performance Requirements', () => {
    it('should handle extremely large plans efficiently', () => {
      const content = `# Massive Plan\n${Array(1000).fill(null)
        .map((_, i) => `${'  '.repeat(i % 5)}- [${i % 4 === 0 ? 'x' : ' '}] Task ${i + 1}: ${Array(20).fill('word').join(' ')}`)
        .join('\n')}`;

      const startTime = Date.now();

      const checkboxes = parsePlanCheckboxes(content);
      const extracted = extractCheckboxes(content);
      const checkedCount = countCheckedBoxes(content);
      const isValid = validateStepCount(1000, checkboxes.length);

      const duration = Date.now() - startTime;

      expect(checkboxes).toHaveLength(1000);
      expect(extracted).toHaveLength(1000);
      expect(checkedCount).toBe(250); // 25% are checked
      expect(isValid).toBe(true);
      expect(duration).toBeLessThan(100); // Should complete all operations in <100ms
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string input', () => {
      expect(parsePlanCheckboxes('')).toEqual([]);
      expect(extractCheckboxes('')).toEqual([]);
      expect(countCheckedBoxes('')).toBe(0);
    });

    it('should handle null/undefined gracefully', () => {
      // TypeScript will enforce non-null, but test runtime behavior
      expect(parsePlanCheckboxes(null as unknown as string)).toEqual([]);
      expect(parsePlanCheckboxes(undefined as unknown as string)).toEqual([]);
      expect(extractCheckboxes(null as unknown as string)).toEqual([]);
      expect(countCheckedBoxes(null as unknown as string)).toBe(0);
    });

    it('should handle malformed checkbox patterns', () => {
      const content = `- [?] Invalid checkbox state
- [-] Another invalid state
- [ x ] Space between x
- [  ] Double space`;

      const result = parsePlanCheckboxes(content);
      expect(result).toHaveLength(1); // Only the double space one is valid
      expect(result[0].content).toBe('Double space');
      expect(result[0].checked).toBe(false);
    });

    it('should handle Windows line endings correctly', () => {
      const content = '- [ ] Windows line 1\r\n- [x] Windows line 2\r\n- [ ] Windows line 3';

      const result = parsePlanCheckboxes(content);
      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('Windows line 1');
      expect(result[1].content).toBe('Windows line 2');
      expect(result[2].content).toBe('Windows line 3');
    });
  });
});