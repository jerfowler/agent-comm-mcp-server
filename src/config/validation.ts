/**
 * Validation configuration for plan format validation
 * Issue #74: Support flexible validation modes
 */

import debug from 'debug';

const log = debug('agent-comm:config:validation');

/**
 * Validation modes for plan format checking
 */
export enum ValidationMode {
  /** Original strict validation - requires bold titles, 2-5 bullets per checkbox */
  STRICT = 'strict',

  /** Relaxed validation - allows flexible formats but still requires checkboxes */
  RELAXED = 'relaxed',

  /** Minimal validation - accepts any text content */
  MINIMAL = 'minimal'
}

/**
 * Configuration for validation behavior
 */
export interface ValidationConfig {
  mode: ValidationMode;
  requireCheckboxes: boolean;
  requireBoldTitles: boolean;
  minBulletsPerCheckbox: number;
  maxBulletsPerCheckbox: number;
  requireActionKeywords: boolean;
}

/**
 * Get validation configuration based on mode
 */
export function getValidationConfig(mode: ValidationMode): ValidationConfig {
  switch (mode) {
    case ValidationMode.STRICT:
      return {
        mode: ValidationMode.STRICT,
        requireCheckboxes: true,
        requireBoldTitles: true,
        minBulletsPerCheckbox: 2,
        maxBulletsPerCheckbox: 5,
        requireActionKeywords: true
      };

    case ValidationMode.RELAXED:
      return {
        mode: ValidationMode.RELAXED,
        requireCheckboxes: true,
        requireBoldTitles: false,
        minBulletsPerCheckbox: 0,
        maxBulletsPerCheckbox: 100,
        requireActionKeywords: false
      };

    case ValidationMode.MINIMAL:
      return {
        mode: ValidationMode.MINIMAL,
        requireCheckboxes: false,
        requireBoldTitles: false,
        minBulletsPerCheckbox: 0,
        maxBulletsPerCheckbox: 100,
        requireActionKeywords: false
      };

    default:
      // Default to relaxed mode
      log('Unknown validation mode "%s", defaulting to RELAXED', mode);
      return getValidationConfig(ValidationMode.RELAXED);
  }
}

/**
 * Load validation mode from environment or parameters
 */
export function loadValidationMode(explicitMode?: string): ValidationMode {
  // Priority: explicit parameter > environment variable > default
  const modeString = explicitMode ?? process.env['AGENT_COMM_VALIDATION_MODE'] ?? 'relaxed';

  // Normalize to lowercase and trim whitespace for comparison
  const normalized = modeString.trim().toLowerCase();

  switch (normalized) {
    case 'strict':
      log('Using STRICT validation mode');
      return ValidationMode.STRICT;

    case 'relaxed':
      log('Using RELAXED validation mode');
      return ValidationMode.RELAXED;

    case 'minimal':
      log('Using MINIMAL validation mode');
      return ValidationMode.MINIMAL;

    default:
      log('Invalid validation mode "%s", defaulting to RELAXED', modeString);
      return ValidationMode.RELAXED;
  }
}