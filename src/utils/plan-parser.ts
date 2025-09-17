/**
 * Unified plan parser utility - single source of truth for checkbox parsing
 * @module src/utils/plan-parser
 */

import debug from 'debug';
import type { CheckboxInfo } from '../types/plan-metadata.js';

// Re-export the CheckboxInfo type for consumers
export type { CheckboxInfo };

// Create debug instance with proper namespace
const log = debug('agent-comm:utils:plan-parser');

/**
 * Single source of truth regex for matching checkbox patterns
 * Matches: - [ ] or - [x] with optional leading whitespace
 * Allows multiple spaces in unchecked boxes
 */
export const CHECKBOX_REGEX = /^(\s*)-\s*\[( +|x)\]\s+/gm;

/**
 * Parse plan content to extract all checkbox information
 * @param content - Plan content (typically from PLAN.md)
 * @returns Array of CheckboxInfo objects with line numbers and content
 */
export function parsePlanCheckboxes(content: string): CheckboxInfo[] {
  const startTime = Date.now();
  log('Starting plan checkbox parsing');

  // Handle null/undefined input gracefully
  if (!content) {
    log('Empty content provided, returning empty array');
    return [];
  }

  const checkboxes: CheckboxInfo[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Reset regex lastIndex for each line
    const regex = new RegExp(CHECKBOX_REGEX.source, CHECKBOX_REGEX.flags);
    const match = regex.exec(line);

    if (match) {
      const indentSpaces = match[1] ?? '';
      const isChecked = match[2].trim() === 'x';
      const contentStart = match[0].length;
      const content = line.substring(contentStart).trimEnd();

      checkboxes.push({
        line: index + 1, // 1-based line number
        content,
        checked: isChecked,
        indentLevel: Math.floor(indentSpaces.length / 2)
      });
    }
  });

  const duration = Date.now() - startTime;
  log('Parsed %d checkboxes in %dms', checkboxes.length, duration);

  // Log performance warning if operation took too long
  if (duration > 10) {
    log('PERFORMANCE WARNING: Parsing took %dms (>10ms threshold)', duration);
  }

  return checkboxes;
}

/**
 * Validate that the expected step count matches the actual checkbox count
 * @param expectedCount - Expected number of steps
 * @param actualCount - Actual number of checkboxes found
 * @returns True if counts match, false otherwise
 */
export function validateStepCount(expectedCount: number, actualCount: number): boolean {
  const isValid = expectedCount === actualCount;

  if (!isValid) {
    log('Step count mismatch: expected %d, actual %d', expectedCount, actualCount);
  } else {
    log('Step count validation passed: %d steps', expectedCount);
  }

  return isValid;
}

/**
 * Extract checkbox content as a simple string array
 * @param content - Plan content to parse
 * @returns Array of checkbox content strings
 */
export function extractCheckboxes(content: string): string[] {
  const startTime = Date.now();
  log('Extracting checkbox content');

  // Handle null/undefined input gracefully
  if (!content) {
    log('Empty content provided, returning empty array');
    return [];
  }

  const checkboxContents: string[] = [];
  const lines = content.split('\n');

  lines.forEach(line => {
    // Reset regex lastIndex for each line
    const regex = new RegExp(CHECKBOX_REGEX.source, CHECKBOX_REGEX.flags);
    const match = regex.exec(line);

    if (match) {
      const contentStart = match[0].length;
      const content = line.substring(contentStart).trimEnd();
      checkboxContents.push(content);
    }
  });

  const duration = Date.now() - startTime;
  log('Extracted %d checkbox contents in %dms', checkboxContents.length, duration);

  if (duration > 10) {
    log('PERFORMANCE WARNING: Extraction took %dms (>10ms threshold)', duration);
  }

  return checkboxContents;
}

/**
 * Count the number of checked checkboxes in the content
 * @param content - Plan content to analyze
 * @returns Number of checked checkboxes
 */
export function countCheckedBoxes(content: string): number {
  const startTime = Date.now();
  log('Counting checked checkboxes');

  // Handle null/undefined input gracefully
  if (!content) {
    log('Empty content provided, returning 0');
    return 0;
  }

  let checkedCount = 0;
  const lines = content.split('\n');

  lines.forEach(line => {
    // Use a simpler regex just for checked boxes
    if (/^\s*-\s*\[x\]\s+/i.test(line)) {
      checkedCount++;
    }
  });

  const duration = Date.now() - startTime;
  log('Counted %d checked boxes in %dms', checkedCount, duration);

  if (duration > 10) {
    log('PERFORMANCE WARNING: Counting took %dms (>10ms threshold)', duration);
  }

  return checkedCount;
}