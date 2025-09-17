/**
 * Agent availability validation test suite
 * Tests filesystem scanning, YAML parsing, and caching for agent discovery
 *
 * Following TDD methodology - these tests MUST FAIL initially until implementation is complete
 */

import {
  validateAgentAvailability,
  getAvailableAgents,
  validateAgentWithAvailability,
  clearAgentAvailabilityCache
} from '../../../src/utils/validation.js';
import { InvalidTaskError } from '../../../src/types.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';

// Mock fs-extra-safe for filesystem operations
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  readFile: jest.fn(),
  ensureDir: jest.fn(),
  stat: jest.fn()
}));

const mockedFs = fs as unknown as {
  pathExists: jest.Mock;
  readdir: jest.Mock;
  readFile: jest.Mock;
  ensureDir: jest.Mock;
  stat: jest.Mock;
};

// Mock os module for home directory detection
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/testuser')
}));

// Store original process.cwd for restoration
const originalCwd = process.cwd;

// Mock process.cwd for consistent project directory
beforeAll(() => {
  process.cwd = jest.fn(() => '/test/project');
});

afterAll(() => {
  process.cwd = originalCwd;
});

describe('Agent Availability Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear cache between tests
    clearAgentAvailabilityCache();
  });

  describe('validateAgentAvailability()', () => {
    it('should return true for agent found in user directory', async () => {
      // Setup: Mock filesystem to find agent in ~/.claude/agents/
      mockedFs.pathExists.mockImplementation((dirPath: string) => {
        if (dirPath.includes('/.claude/agents')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.readdir.mockResolvedValue(['senior-backend-engineer.md', 'product-manager.md']);

      mockedFs.readFile.mockResolvedValue(`---
name: senior-backend-engineer
description: Senior Backend Engineer specializing in TypeScript and Node.js
---

# Senior Backend Engineer Agent`);

      const result = await validateAgentAvailability('senior-backend-engineer');
      expect(result).toBe(true);
    });

    it('should return true for agent found in project directory', async () => {
      // Setup: Mock filesystem to find agent in .claude/agents/
      mockedFs.pathExists.mockImplementation((dirPath: string) => {
        // User directory doesn't exist
        if (dirPath === '/home/testuser/.claude/agents') return Promise.resolve(false);
        // Project directory exists
        if (dirPath === '/test/project/.claude/agents') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.readdir.mockResolvedValue(['ux-ui-designer.md']);

      mockedFs.readFile.mockResolvedValue(`---
name: ux-ui-designer
description: UX/UI Designer for user experience optimization
---

# UX/UI Designer Agent`);

      const result = await validateAgentAvailability('ux-ui-designer');
      expect(result).toBe(true);
    });

    it('should return false for agent not found in any directory', async () => {
      // Setup: Mock filesystem with no matching agents
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['other-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---
name: other-agent
---`);

      const result = await validateAgentAvailability('nonexistent-agent');
      expect(result).toBe(false);
    });

    it('should handle filesystem errors gracefully', async () => {
      // Setup: Mock filesystem to throw permission errors
      mockedFs.pathExists.mockRejectedValue(new Error('Permission denied'));

      const result = await validateAgentAvailability('any-agent');
      expect(result).toBe(false); // Should fallback gracefully
    });

    it('should handle malformed YAML gracefully', async () => {
      // Setup: Mock filesystem with invalid YAML
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['malformed-agent.md']);
      mockedFs.readFile.mockResolvedValue(`invalid yaml content
no frontmatter here`);

      const result = await validateAgentAvailability('malformed-agent');
      expect(result).toBe(false); // Should handle parsing errors
    });

    it('should use caching for performance', async () => {
      // Setup: Mock successful filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['cached-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---
name: cached-agent
---`);

      // First call
      await validateAgentAvailability('cached-agent');

      // Second call should use cache
      await validateAgentAvailability('cached-agent');

      // Verify filesystem was only called once (due to caching)
      expect(mockedFs.readdir).toHaveBeenCalledTimes(2); // User + project directories
    });

    it('should validate performance requirements', async () => {
      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['performance-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---
name: performance-agent
---`);

      const startTime = Date.now();
      await validateAgentAvailability('performance-agent');
      const duration = Date.now() - startTime;

      // Should complete within 100ms requirement
      expect(duration).toBeLessThan(100);
    });
  });

  describe('getAvailableAgents()', () => {
    it('should return agents from user directory', async () => {
      // Setup: Mock user directory with agents
      mockedFs.pathExists.mockImplementation((dirPath: string) => {
        if (dirPath.includes('/.claude/agents')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.readdir.mockResolvedValue(['agent1.md', 'agent2.md']);
      mockedFs.readFile
        .mockResolvedValueOnce(`---\nname: agent1\n---`)
        .mockResolvedValueOnce(`---\nname: agent2\n---`);

      const agents = await getAvailableAgents();
      expect(agents).toContain('agent1');
      expect(agents).toContain('agent2');
    });

    it('should return agents from project directory', async () => {
      // Setup: Mock project directory with agents
      mockedFs.pathExists.mockImplementation((dirPath: string) => {
        if (dirPath === '/home/testuser/.claude/agents') return Promise.resolve(false);
        if (dirPath === '/test/project/.claude/agents') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.readdir.mockResolvedValue(['project-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---\nname: project-agent\n---`);

      const agents = await getAvailableAgents();
      expect(agents).toContain('project-agent');
    });

    it('should handle precedence correctly (user overrides project)', async () => {
      // Setup: Mock both directories with same agent name
      mockedFs.pathExists.mockResolvedValue(true);

      mockedFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === '/home/testuser/.claude/agents') {
          return Promise.resolve(['duplicate-agent.md']);
        }
        if (dirPath === '/test/project/.claude/agents') {
          return Promise.resolve(['duplicate-agent.md', 'project-only.md']);
        }
        return Promise.resolve([]);
      });

      mockedFs.readFile.mockImplementation((filePath: string) => {
        if (filePath === '/home/testuser/.claude/agents/duplicate-agent.md') {
          return Promise.resolve(`---\nname: duplicate-agent\n---`);
        }
        if (filePath === '/test/project/.claude/agents/duplicate-agent.md') {
          return Promise.resolve(`---\nname: duplicate-agent\n---`);
        }
        if (filePath.includes('project-only.md')) {
          return Promise.resolve(`---\nname: project-only\n---`);
        }
        return Promise.resolve('');
      });

      const agents = await getAvailableAgents();

      // Should contain both agents but no duplicates
      expect(agents).toContain('duplicate-agent');
      expect(agents).toContain('project-only');

      // Should not have duplicates
      const duplicateCount = agents.filter(agent => agent === 'duplicate-agent').length;
      expect(duplicateCount).toBe(1);
    });

    it('should fallback to static registry on filesystem failure', async () => {
      // Setup: Mock filesystem failure
      mockedFs.pathExists.mockRejectedValue(new Error('Filesystem error'));

      const agents = await getAvailableAgents();

      // Should return static registry agents
      expect(agents).toContain('senior-backend-engineer');
      expect(agents).toContain('senior-frontend-engineer');
      expect(agents).toContain('product-manager');
      expect(agents.length).toBeGreaterThan(10); // Static registry has 14 agents
    });

    it('should use caching for performance', async () => {
      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['cached-list-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---\nname: cached-list-agent\n---`);

      // First call
      const agents1 = await getAvailableAgents();
      const firstCallCount = mockedFs.readdir.mock.calls.length;

      // Second call should use cache
      const agents2 = await getAvailableAgents();
      const secondCallCount = mockedFs.readdir.mock.calls.length;

      expect(agents1).toEqual(agents2);
      // Verify filesystem was only called initially (2 directories) and not again
      expect(firstCallCount).toBe(2); // User + project directories
      expect(secondCallCount).toBe(2); // No additional calls due to caching
    });
  });

  describe('validateAgentWithAvailability()', () => {
    it('should pass for secure and available agent', async () => {
      // Setup: Mock agent exists
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['valid-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---\nname: valid-agent\n---`);

      const result = await validateAgentWithAvailability('valid-agent');
      expect(result).toBe('valid-agent');
    });

    it('should throw on security validation failure (first stage)', async () => {
      // Setup: Mock malicious agent name (fails security check)
      await expect(validateAgentWithAvailability('../../../etc/passwd'))
        .rejects
        .toThrow(InvalidTaskError);
    });

    it('should handle unavailable but secure agent gracefully', async () => {
      // Setup: Mock agent doesn't exist but name is secure
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue([]);

      // Should not throw (availability is warning-only)
      const result = await validateAgentWithAvailability('unknown-but-secure-agent');
      expect(result).toBe('unknown-but-secure-agent');
    });

    it('should maintain performance requirements for two-stage validation', async () => {
      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['performance-test-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---\nname: performance-test-agent\n---`);

      const startTime = Date.now();
      await validateAgentWithAvailability('performance-test-agent');
      const duration = Date.now() - startTime;

      // Should complete within 100ms requirement (including both validations)
      expect(duration).toBeLessThan(100);
    });

    it('should integrate with existing security caching', async () => {
      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['cached-security-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---\nname: cached-security-agent\n---`);

      // First call
      await validateAgentWithAvailability('cached-security-agent');

      // Second call should use security cache
      const startTime = Date.now();
      await validateAgentWithAvailability('cached-security-agent');
      const duration = Date.now() - startTime;

      // Should be very fast due to security caching
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty agent directories', async () => {
      // Setup: Mock empty directories
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue([]);

      const result = await validateAgentAvailability('any-agent');
      expect(result).toBe(false);
    });

    it('should handle non-markdown files in agent directories', async () => {
      // Setup: Mock directory with non-markdown files
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === '/home/testuser/.claude/agents') {
          return Promise.resolve(['agent.txt', 'config.json', 'valid-agent.md']);
        }
        return Promise.resolve([]);
      });

      mockedFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('valid-agent.md')) {
          return Promise.resolve(`---\nname: valid-agent\n---`);
        }
        return Promise.resolve('');
      });

      const agents = await getAvailableAgents();
      expect(agents).toContain('valid-agent');
      expect(agents).not.toContain('agent');
      expect(agents).not.toContain('config');
    });

    it('should handle files without YAML frontmatter', async () => {
      // Setup: Mock markdown files without frontmatter
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockImplementation((dirPath: string) => {
        if (dirPath === '/home/testuser/.claude/agents') {
          return Promise.resolve(['no-frontmatter.md', 'with-frontmatter.md']);
        }
        return Promise.resolve([]);
      });

      mockedFs.readFile.mockImplementation((filePath: string) => {
        if (filePath.includes('no-frontmatter.md')) {
          return Promise.resolve('# Just a markdown file without frontmatter');
        }
        if (filePath.includes('with-frontmatter.md')) {
          return Promise.resolve(`---\nname: with-frontmatter\n---\n# Valid agent`);
        }
        return Promise.resolve('');
      });

      const agents = await getAvailableAgents();
      expect(agents).toContain('with-frontmatter');
      expect(agents).not.toContain('no-frontmatter');
    });

    it('should handle missing name field in YAML frontmatter', async () => {
      // Setup: Mock YAML without name field
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['no-name.md']);
      mockedFs.readFile.mockResolvedValue(`---
description: Agent without name field
version: 1.0
---`);

      const agents = await getAvailableAgents();
      expect(agents).not.toContain('no-name');
    });
  });

  describe('Caching Behavior', () => {
    it('should cache availability results with TTL', async () => {
      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['ttl-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---\nname: ttl-agent\n---`);

      // First call
      await validateAgentAvailability('ttl-agent');
      expect(mockedFs.readdir).toHaveBeenCalledTimes(2); // User + project

      // Second call within TTL should use cache
      await validateAgentAvailability('ttl-agent');
      expect(mockedFs.readdir).toHaveBeenCalledTimes(2); // No additional calls
    });

    it('should provide cache statistics for monitoring', async () => {
      // This test verifies that cache hit/miss ratios can be monitored
      // Implementation should include debug logging for cache performance

      // Setup: Mock filesystem operations
      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readdir.mockResolvedValue(['stats-agent.md']);
      mockedFs.readFile.mockResolvedValue(`---\nname: stats-agent\n---`);

      // Multiple calls to test cache behavior
      await validateAgentAvailability('stats-agent');
      await validateAgentAvailability('stats-agent');
      await validateAgentAvailability('stats-agent');

      // Implementation should log cache statistics
      // This test validates that monitoring is possible
      expect(mockedFs.readdir).toHaveBeenCalledTimes(2); // Only initial calls
    });
  });
});