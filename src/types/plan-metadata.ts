/**
 * Plan metadata type definitions for stepCount validation
 * @module src/types/plan-metadata
 */

/**
 * Metadata stored alongside PLAN.md files for efficient validation
 * Stored in PLAN.metadata.json files
 */
export interface PlanMetadata {
  /** Total number of checkbox steps in the plan */
  stepCount: number;

  /** Agent who created/owns the plan */
  agent: string;

  /** Optional task ID this plan belongs to */
  taskId?: string;

  /** ISO timestamp when plan was created */
  createdAt: string;

  /** Pattern used for checkbox detection (for future extensibility) */
  checkboxPattern: 'markdown';

  /** Version of the metadata format */
  version: '2.0.0';
}

/**
 * Information about a single checkbox item in a plan
 * Used for parsing and tracking checkbox state
 */
export interface CheckboxInfo {
  /** Line number where checkbox appears (1-based) */
  line: number;

  /** Text content after the checkbox */
  content: string;

  /** Whether the checkbox is checked [x] or unchecked [ ] */
  checked: boolean;

  /** Indentation level (0 for root, 1 for single indent, etc) */
  indentLevel: number;
}