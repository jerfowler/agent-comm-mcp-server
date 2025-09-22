/**
 * Tests for validation configuration module
 * Achieving comprehensive branch coverage for real-world scenarios
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ValidationMode,
  getValidationConfig,
  loadValidationMode
} from '../../../src/config/validation.js';

describe('Validation Configuration', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original env var
    originalEnv = process.env['AGENT_COMM_VALIDATION_MODE'];
    delete process.env['AGENT_COMM_VALIDATION_MODE'];
  });

  afterEach(() => {
    // Restore original env var
    if (originalEnv !== undefined) {
      process.env['AGENT_COMM_VALIDATION_MODE'] = originalEnv;
    } else {
      delete process.env['AGENT_COMM_VALIDATION_MODE'];
    }
  });

  describe('getValidationConfig', () => {
    describe('STRICT mode configuration', () => {
      it('should return strict configuration for STRICT mode', () => {
        const config = getValidationConfig(ValidationMode.STRICT);

        expect(config.mode).toBe(ValidationMode.STRICT);
        expect(config.requireCheckboxes).toBe(true);
        expect(config.requireBoldTitles).toBe(true);
        expect(config.minBulletsPerCheckbox).toBe(2);
        expect(config.maxBulletsPerCheckbox).toBe(5);
        expect(config.requireActionKeywords).toBe(true);
      });

      it('should enforce checkbox requirements in STRICT mode', () => {
        const config = getValidationConfig(ValidationMode.STRICT);

        // Verify strict validation rules
        expect(config.requireCheckboxes).toBe(true);
        expect(config.minBulletsPerCheckbox).toBeGreaterThan(0);
        expect(config.maxBulletsPerCheckbox).toBeLessThan(10);
      });
    });

    describe('RELAXED mode configuration', () => {
      it('should return relaxed configuration for RELAXED mode', () => {
        const config = getValidationConfig(ValidationMode.RELAXED);

        expect(config.mode).toBe(ValidationMode.RELAXED);
        expect(config.requireCheckboxes).toBe(true);
        expect(config.requireBoldTitles).toBe(false);
        expect(config.minBulletsPerCheckbox).toBe(0);
        expect(config.maxBulletsPerCheckbox).toBe(100);
        expect(config.requireActionKeywords).toBe(false);
      });

      it('should allow flexible formatting in RELAXED mode', () => {
        const config = getValidationConfig(ValidationMode.RELAXED);

        // Verify relaxed validation rules
        expect(config.requireBoldTitles).toBe(false);
        expect(config.requireActionKeywords).toBe(false);
        expect(config.minBulletsPerCheckbox).toBe(0);
      });
    });

    describe('MINIMAL mode configuration', () => {
      it('should return minimal configuration for MINIMAL mode', () => {
        const config = getValidationConfig(ValidationMode.MINIMAL);

        expect(config.mode).toBe(ValidationMode.MINIMAL);
        expect(config.requireCheckboxes).toBe(false);
        expect(config.requireBoldTitles).toBe(false);
        expect(config.minBulletsPerCheckbox).toBe(0);
        expect(config.maxBulletsPerCheckbox).toBe(100);
        expect(config.requireActionKeywords).toBe(false);
      });

      it('should allow any content without checkboxes in MINIMAL mode', () => {
        const config = getValidationConfig(ValidationMode.MINIMAL);

        // Verify minimal validation - accepts anything
        expect(config.requireCheckboxes).toBe(false);
        expect(config.requireBoldTitles).toBe(false);
        expect(config.requireActionKeywords).toBe(false);
      });

      it('should handle production scenarios in MINIMAL mode', () => {
        const config = getValidationConfig(ValidationMode.MINIMAL);

        // MINIMAL mode for emergency situations or legacy content
        expect(config.requireCheckboxes).toBe(false);
        expect(config.maxBulletsPerCheckbox).toBeGreaterThan(50);
      });
    });

    describe('Default fallback handling', () => {
      it('should fall back to RELAXED mode for invalid enum value', () => {
        // Force an invalid enum value
        const invalidMode = 'INVALID' as ValidationMode;
        const config = getValidationConfig(invalidMode);

        expect(config.mode).toBe(ValidationMode.RELAXED);
        expect(config.requireCheckboxes).toBe(true);
        expect(config.requireBoldTitles).toBe(false);
      });

      it('should handle undefined mode by falling back to RELAXED', () => {
        const undefinedMode = undefined as unknown as ValidationMode;
        const config = getValidationConfig(undefinedMode);

        expect(config.mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle null mode by falling back to RELAXED', () => {
        const nullMode = null as unknown as ValidationMode;
        const config = getValidationConfig(nullMode);

        expect(config.mode).toBe(ValidationMode.RELAXED);
      });

      it('should reject numeric input and fall back to RELAXED', () => {
        const numericMode = 123 as unknown as ValidationMode;
        const config = getValidationConfig(numericMode);

        expect(config.mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle empty string and fall back to RELAXED', () => {
        const emptyMode = '' as ValidationMode;
        const config = getValidationConfig(emptyMode);

        expect(config.mode).toBe(ValidationMode.RELAXED);
      });
    });
  });

  describe('loadValidationMode', () => {
    describe('Explicit parameter handling', () => {
      it('should prioritize explicit parameter over environment variable', () => {
        process.env['AGENT_COMM_VALIDATION_MODE'] = 'strict';

        const mode = loadValidationMode('minimal');
        expect(mode).toBe(ValidationMode.MINIMAL);
      });

      it('should handle explicit STRICT parameter', () => {
        const mode = loadValidationMode('strict');
        expect(mode).toBe(ValidationMode.STRICT);
      });

      it('should handle explicit RELAXED parameter', () => {
        const mode = loadValidationMode('relaxed');
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle explicit MINIMAL parameter', () => {
        const mode = loadValidationMode('minimal');
        expect(mode).toBe(ValidationMode.MINIMAL);
      });
    });

    describe('Environment variable handling', () => {
      it('should load mode from environment variable when no explicit parameter', () => {
        process.env['AGENT_COMM_VALIDATION_MODE'] = 'strict';

        const mode = loadValidationMode();
        expect(mode).toBe(ValidationMode.STRICT);
      });

      it('should use default RELAXED when env var is missing', () => {
        delete process.env['AGENT_COMM_VALIDATION_MODE'];

        const mode = loadValidationMode();
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle invalid env var value by falling back to RELAXED', () => {
        process.env['AGENT_COMM_VALIDATION_MODE'] = 'invalid-mode';

        const mode = loadValidationMode();
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle empty env var by falling back to RELAXED', () => {
        process.env['AGENT_COMM_VALIDATION_MODE'] = '';

        const mode = loadValidationMode();
        expect(mode).toBe(ValidationMode.RELAXED);
      });
    });

    describe('Case sensitivity and normalization', () => {
      it('should handle uppercase STRICT', () => {
        const mode = loadValidationMode('STRICT');
        expect(mode).toBe(ValidationMode.STRICT);
      });

      it('should handle mixed case Strict', () => {
        const mode = loadValidationMode('Strict');
        expect(mode).toBe(ValidationMode.STRICT);
      });

      it('should handle lowercase strict', () => {
        const mode = loadValidationMode('strict');
        expect(mode).toBe(ValidationMode.STRICT);
      });

      it('should handle uppercase RELAXED', () => {
        const mode = loadValidationMode('RELAXED');
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle mixed case Relaxed', () => {
        const mode = loadValidationMode('Relaxed');
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle uppercase MINIMAL', () => {
        const mode = loadValidationMode('MINIMAL');
        expect(mode).toBe(ValidationMode.MINIMAL);
      });

      it('should handle mixed case Minimal', () => {
        const mode = loadValidationMode('Minimal');
        expect(mode).toBe(ValidationMode.MINIMAL);
      });

      it('should handle whitespace in mode string', () => {
        const mode = loadValidationMode('  strict  ');
        expect(mode).toBe(ValidationMode.STRICT);
      });
    });

    describe('Invalid input handling', () => {
      it('should handle invalid mode string', () => {
        const mode = loadValidationMode('invalid-mode');
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle numeric string', () => {
        const mode = loadValidationMode('123');
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle special characters', () => {
        const mode = loadValidationMode('@#$%');
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle very long string', () => {
        const longString = 'a'.repeat(1000);
        const mode = loadValidationMode(longString);
        expect(mode).toBe(ValidationMode.RELAXED);
      });

      it('should handle mode with typo', () => {
        const mode = loadValidationMode('strickt'); // typo
        expect(mode).toBe(ValidationMode.RELAXED);
      });
    });

    describe('Priority chain validation', () => {
      it('should follow priority: explicit > env > default', () => {
        // Test default (no explicit, no env)
        delete process.env['AGENT_COMM_VALIDATION_MODE'];
        let mode = loadValidationMode();
        expect(mode).toBe(ValidationMode.RELAXED);

        // Test env overrides default
        process.env['AGENT_COMM_VALIDATION_MODE'] = 'strict';
        mode = loadValidationMode();
        expect(mode).toBe(ValidationMode.STRICT);

        // Test explicit overrides env
        mode = loadValidationMode('minimal');
        expect(mode).toBe(ValidationMode.MINIMAL);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle real-world configuration switching', () => {
      // Start with strict for CI/CD
      let config = getValidationConfig(ValidationMode.STRICT);
      expect(config.requireBoldTitles).toBe(true);

      // Switch to relaxed for development
      config = getValidationConfig(ValidationMode.RELAXED);
      expect(config.requireBoldTitles).toBe(false);

      // Switch to minimal for emergency
      config = getValidationConfig(ValidationMode.MINIMAL);
      expect(config.requireCheckboxes).toBe(false);
    });

    it('should maintain consistency across mode loads', () => {
      const mode1 = loadValidationMode('strict');
      const mode2 = loadValidationMode('STRICT');
      const mode3 = loadValidationMode('Strict');

      expect(mode1).toBe(mode2);
      expect(mode2).toBe(mode3);
      expect(mode1).toBe(ValidationMode.STRICT);
    });

    it('should handle production environment variable scenarios', () => {
      // Simulate production with strict validation
      process.env['AGENT_COMM_VALIDATION_MODE'] = 'strict';
      const prodMode = loadValidationMode();
      const prodConfig = getValidationConfig(prodMode);

      expect(prodConfig.requireCheckboxes).toBe(true);
      expect(prodConfig.requireBoldTitles).toBe(true);
      expect(prodConfig.minBulletsPerCheckbox).toBeGreaterThan(0);
    });
  });
});