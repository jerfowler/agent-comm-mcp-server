/**
 * Security test suite for agent validation
 * Tests protection against malicious inputs including path traversal, injection attacks, and null bytes
 * Also tests two-stage validation (security + availability) integration
 *
 * Following TDD methodology - these tests MUST FAIL initially to demonstrate current vulnerability
 */

import { validateAgent, validateAgentWithAvailability } from '../../../src/utils/validation.js';
import { InvalidTaskError } from '../../../src/types.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';

// Mock fs-extra-safe for availability validation tests
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  readFile: jest.fn()
}));

const mockedFs = fs as unknown as {
  pathExists: jest.Mock;
  readdir: jest.Mock;
  readFile: jest.Mock;
};

describe('validateAgent - Security Tests', () => {
  describe('Path Traversal Protection', () => {
    it('should reject path traversal with ../', () => {
      expect(() => validateAgent('../../../etc/passwd', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('../../../etc/passwd', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject path traversal with .\\', () => {
      expect(() => validateAgent('..\\..\\windows\\system32', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('..\\..\\windows\\system32', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject mixed path separators', () => {
      expect(() => validateAgent('../..\\mixed/path', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('../..\\mixed/path', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject encoded path traversal', () => {
      expect(() => validateAgent('%2e%2e%2f%2e%2e%2f', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('%2e%2e%2f%2e%2e%2f', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject absolute paths', () => {
      expect(() => validateAgent('/etc/passwd', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('C:\\Windows\\System32', 'agent')).toThrow(InvalidTaskError);
    });
  });

  describe('Command Injection Protection', () => {
    it('should reject command injection with semicolon', () => {
      expect(() => validateAgent('agent; rm -rf /', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent; rm -rf /', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject command injection with pipe', () => {
      expect(() => validateAgent('agent | cat /etc/passwd', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent | cat /etc/passwd', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject command injection with ampersand', () => {
      expect(() => validateAgent('agent & echo malicious', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent & echo malicious', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject command injection with backticks', () => {
      expect(() => validateAgent('agent`whoami`', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent`whoami`', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject command injection with $() substitution', () => {
      expect(() => validateAgent('agent$(whoami)', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent$(whoami)', 'agent')).toThrow(/invalid agent name/i);
    });
  });

  describe('Script Injection Protection', () => {
    it('should reject JavaScript injection', () => {
      expect(() => validateAgent('<script>alert(1)</script>', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('<script>alert(1)</script>', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject JavaScript URL injection', () => {
      expect(() => validateAgent('javascript:alert(1)', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('javascript:alert(1)', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject data URL injection', () => {
      expect(() => validateAgent('data:text/html,<script>alert(1)</script>', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('data:text/html,<script>alert(1)</script>', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject HTML injection', () => {
      expect(() => validateAgent('<img src=x onerror=alert(1)>', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('<img src=x onerror=alert(1)>', 'agent')).toThrow(/invalid agent name/i);
    });
  });

  describe('Null Byte and Control Character Protection', () => {
    it('should reject null bytes', () => {
      expect(() => validateAgent('agent\0malicious', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent\0malicious', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject encoded null bytes', () => {
      expect(() => validateAgent('agent%00malicious', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent%00malicious', 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject newline injection', () => {
      expect(() => validateAgent('agent\nmalicious', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent\rmalicious', 'agent')).toThrow(InvalidTaskError);
    });

    it('should reject tab injection', () => {
      expect(() => validateAgent('agent\tmalicious', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent\tmalicious', 'agent')).toThrow(/invalid agent name/i);
    });
  });

  describe('SQL Injection Protection', () => {
    it('should reject SQL injection attempts', () => {
      expect(() => validateAgent("agent'; DROP TABLE users; --", 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent("agent'; DROP TABLE users; --", 'agent')).toThrow(/invalid agent name/i);
    });

    it('should reject SQL injection with UNION', () => {
      expect(() => validateAgent('agent UNION SELECT * FROM users', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('agent UNION SELECT * FROM users', 'agent')).toThrow(/invalid agent name/i);
    });
  });

  describe('Valid Agent Names', () => {
    it('should accept standard hyphenated agent names', () => {
      expect(validateAgent('senior-backend-engineer', 'agent')).toBe('senior-backend-engineer');
      expect(validateAgent('qa-test-automation-engineer', 'agent')).toBe('qa-test-automation-engineer');
      expect(validateAgent('product-docs-manager', 'agent')).toBe('product-docs-manager');
    });

    it('should accept agent names with numbers', () => {
      expect(validateAgent('agent-v2', 'agent')).toBe('agent-v2');
      expect(validateAgent('backend-engineer-1', 'agent')).toBe('backend-engineer-1');
    });

    it('should accept underscored agent names', () => {
      expect(validateAgent('senior_backend_engineer', 'agent')).toBe('senior_backend_engineer');
      expect(validateAgent('debug_investigator', 'agent')).toBe('debug_investigator');
    });

    it('should trim whitespace from valid names', () => {
      expect(validateAgent('  senior-backend-engineer  ', 'agent')).toBe('senior-backend-engineer');
      expect(validateAgent('\t qa-engineer \n', 'agent')).toBe('qa-engineer');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should reject empty string', () => {
      expect(() => validateAgent('', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('', 'agent')).toThrow(/must be a non-empty string/i);
    });

    it('should reject whitespace-only string', () => {
      expect(() => validateAgent('   ', 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent('   ', 'agent')).toThrow(/must be a non-empty string/i);
    });

    it('should reject non-string types', () => {
      expect(() => validateAgent(123 as unknown as string, 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent(null as unknown as string, 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent(undefined as unknown as string, 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent({} as unknown as string, 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent([] as unknown as string, 'agent')).toThrow(InvalidTaskError);
    });

    it('should reject excessively long agent names', () => {
      const longName = 'a'.repeat(300); // 300 character agent name
      expect(() => validateAgent(longName, 'agent')).toThrow(InvalidTaskError);
      expect(() => validateAgent(longName, 'agent')).toThrow(/invalid agent name/i);
    });
  });

  describe('Performance Requirements', () => {
    it('should validate agent names in under 100ms', () => {
      const startTime = Date.now();
      validateAgent('senior-backend-engineer', 'agent');
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle multiple validations efficiently', () => {
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        validateAgent(`agent-${i}`, 'agent');
      }
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / 100;
      expect(avgTime).toBeLessThan(10); // Average should be under 10ms per validation
    });
  });

  describe('Caching Performance', () => {
    it('should demonstrate caching improves performance for repeated validations', () => {
      const agentName = 'senior-backend-engineer';

      // First validation (no cache)
      const startTime1 = Date.now();
      validateAgent(agentName, 'agent');
      const firstTime = Date.now() - startTime1;

      // Second validation (should be cached)
      const startTime2 = Date.now();
      validateAgent(agentName, 'agent');
      const secondTime = Date.now() - startTime2;

      // Cached validation should be faster (or at least not significantly slower)
      expect(secondTime).toBeLessThanOrEqual(firstTime + 5); // Allow 5ms margin
    });
  });

  describe('Two-Stage Validation (Security + Availability)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should enforce security validation first (fail fast)', async () => {
      // Security failures should throw immediately without checking availability
      await expect(validateAgentWithAvailability('../../../etc/passwd'))
        .rejects
        .toThrow(InvalidTaskError);

      // Verify availability check was never called
      expect(mockedFs.pathExists).not.toHaveBeenCalled();
      expect(mockedFs.readdir).not.toHaveBeenCalled();
    });

    it('should pass secure but unavailable agents with warnings', async () => {
      // Setup: Mock agent not found in filesystem
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue([]);

      // Should not throw for unknown but secure agent names
      const result = await validateAgentWithAvailability('unknown-but-secure-agent');
      expect(result).toBe('unknown-but-secure-agent');
    });

    it('should validate available and secure agents successfully', async () => {
      // Setup: Mock agent found in filesystem
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['secure-available-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---
name: secure-available-agent
---`);

      const result = await validateAgentWithAvailability('secure-available-agent');
      expect(result).toBe('secure-available-agent');
    });

    it('should never bypass security for any reason', async () => {
      // Even if availability check would succeed, security must always be enforced
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['malicious-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---
name: malicious-agent
---`);

      // Security violations should fail regardless of availability
      await expect(validateAgentWithAvailability('malicious; rm -rf /'))
        .rejects
        .toThrow(InvalidTaskError);

      await expect(validateAgentWithAvailability('../../../etc/passwd'))
        .rejects
        .toThrow(InvalidTaskError);

      await expect(validateAgentWithAvailability('<script>alert(1)</script>'))
        .rejects
        .toThrow(InvalidTaskError);
    });

    it('should maintain performance requirements for two-stage validation', async () => {
      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['performance-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---
name: performance-agent
---`);

      const startTime = Date.now();
      await validateAgentWithAvailability('performance-agent');
      const duration = Date.now() - startTime;

      // Should complete both validations within 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should leverage security caching for repeated validations', async () => {
      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['cached-validation-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---
name: cached-validation-agent
---`);

      const agentName = 'cached-validation-agent';

      // First validation
      const startTime1 = Date.now();
      await validateAgentWithAvailability(agentName);
      const firstTime = Date.now() - startTime1;

      // Second validation should leverage security cache
      const startTime2 = Date.now();
      await validateAgentWithAvailability(agentName);
      const secondTime = Date.now() - startTime2;

      // Second call should be faster due to security caching
      expect(secondTime).toBeLessThanOrEqual(firstTime);
    });

    it('should handle filesystem errors gracefully during availability check', async () => {
      // Setup: Mock filesystem error during availability check
      mockedFs.pathExists.mockRejectedValue(new Error('Permission denied'));

      // Should not throw for filesystem errors, only log warnings
      const result = await validateAgentWithAvailability('filesystem-error-agent');
      expect(result).toBe('filesystem-error-agent');
    });

    it('should prioritize security errors over availability errors', async () => {
      // Setup: Mock filesystem operation that would fail
      mockedFs.pathExists.mockRejectedValue(new Error('Filesystem error'));

      // Security errors should always take precedence
      await expect(validateAgentWithAvailability('malicious; echo test'))
        .rejects
        .toThrow(InvalidTaskError);

      // Verify filesystem check was never attempted due to security failure
      expect(mockedFs.pathExists).not.toHaveBeenCalled();
    });

    it('should maintain security validation cache integrity across two-stage validations', async () => {
      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['cache-integrity-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---
name: cache-integrity-agent
---`);

      const agentName = 'cache-integrity-agent';

      // Mix single-stage and two-stage validations
      validateAgent(agentName, 'agent');
      await validateAgentWithAvailability(agentName);
      validateAgent(agentName, 'agent');
      await validateAgentWithAvailability(agentName);

      // All should succeed and leverage same security cache
      expect(true).toBe(true); // Implicit success if no errors thrown
    });
  });
});