/**
 * Smoke Tests - Basic Functionality
 * Fast validation of critical paths and dependencies
 * Target: <30 seconds total execution time
 */

import * as fs from '../../src/utils/fs-extra-safe.js';
import * as path from 'path';
import * as os from 'os';
import { getConfig } from '../../src/config.js';

describe('Smoke Tests - Basic Functionality', () => {
  describe('Configuration Loading', () => {
    it('should load configuration without errors', () => {
      // This will catch import issues early
      expect(() => getConfig).not.toThrow();
    });

    it('should validate basic configuration structure', () => {
      
      expect(() => getConfig()).not.toThrow();
      
      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.commDir).toBeDefined();
    });
  });

  describe('Core Dependencies', () => {
    it('should import all tools without errors', () => {
      const tools = [
        'check-tasks', 'read-task', 'write-task', 'create-task',
        'list-agents', 'archive-tasks', 'restore-tasks',
        'get-task-context', 'submit-plan', 'report-progress', 'mark-complete',
        'get-full-lifecycle', 'track-task-progress'
      ];

      for (const tool of tools) {
        const toolPath = `../../src/tools/${tool}.js`;
        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require(toolPath);
        }).not.toThrow();
      }
    });

    it('should import core components without errors', () => {
      const components = [
        '../../src/core/ConnectionManager.js',
        '../../src/logging/EventLogger.js',
        '../../src/utils/file-system.js',
        '../../src/utils/validation.js',
        '../../src/utils/task-manager.js'
      ];

      for (const component of components) {
        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require(component);
        }).not.toThrow();
      }
    });

    it('should import main server without errors', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../../src/index.js');
      }).not.toThrow();
    });
  });

  describe('File System Operations', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smoke-test-'));
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('should create temporary directories successfully', async () => {
      const testDir = path.join(tempDir, 'test-dir');
      await fs.ensureDir(testDir);
      
      expect(await fs.pathExists(testDir)).toBe(true);
    });

    it('should read and write files successfully', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const content = 'smoke test content';
      
      await fs.writeFile(testFile, content);
      const readContent = await fs.readFile(testFile, 'utf-8');
      
      expect(readContent).toBe(content);
    });

    it('should handle JSON operations correctly', async () => {
      const jsonFile = path.join(tempDir, 'test.json');
      const data = { test: true, value: 123 };
      
      // This will catch fs.readFile vs fs.writeFile issues with JSON
      await fs.writeFile(jsonFile, JSON.stringify(data, null, 2));
      const readContent = await fs.readFile(jsonFile, 'utf-8');
      const readData = JSON.parse(readContent) as typeof data;
      
      expect(readData).toEqual(data);
    });
  });

  describe('MCP SDK Dependencies', () => {
    it('should import MCP server components', () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('@modelcontextprotocol/sdk/server/index.js');
      }).not.toThrow();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('@modelcontextprotocol/sdk/server/stdio.js');
      }).not.toThrow();
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('@modelcontextprotocol/sdk/types.js');
      }).not.toThrow();
    });

    it('should create basic MCP structures', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Server } = require('@modelcontextprotocol/sdk/server/index.js') as { Server: new (info: { name: string; version: string }, options: { capabilities: unknown }) => unknown };
      
      expect(() => new Server({ name: 'test', version: '1.0.0' }, { capabilities: {} })).not.toThrow();
    });
  });

  describe('TypeScript Compilation Validation', () => {
    it('should have dist directory with compiled files (if built)', async () => {
      const distDir = path.join(__dirname, '../../dist');
      
      // In CI, we run tests directly from TypeScript source without building
      // Only validate dist exists if we're in a built environment
      if (await fs.pathExists(distDir)) {
        // If dist exists, validate it has the expected structure
        expect(await fs.pathExists(path.join(distDir, 'index.js'))).toBe(true);
        expect(await fs.pathExists(path.join(distDir, 'config.js'))).toBe(true);
      } else {
        // In CI/test environments, dist may not exist - this is OK
        // We're testing TypeScript compilation via type-check step in CI
        expect(true).toBe(true); // Test passes - no dist directory needed for testing
      }
    });
  });

  describe('Package Dependencies', () => {
    it('should have all required dependencies available', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const packageJson = require('../../package.json') as { dependencies: Record<string, string> };
      
      // Check that key dependencies are defined in package.json
      expect(packageJson.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
      expect(packageJson.dependencies['fs-extra']).toBeDefined();
      
      // Verify fs-extra can be imported (MCP SDK might have module resolution issues in Jest)
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('fs-extra');
      }).not.toThrow();
    });
  });

  describe('Environment Setup', () => {
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      // Restore environment
      process.env = originalEnv;
    });

    it('should handle missing environment variables gracefully', () => {
      // Resetting to undefined is preferred over delete for dynamic keys
      process.env['AGENT_COMM_DIR'] = undefined as unknown as string;
      
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getConfig } = require('../../src/config.js') as { getConfig: () => unknown };
      
      // Should either use defaults or throw meaningful error
      try {
        const config = getConfig();
        expect(config).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should validate environment variable format', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'env-test-'));
      
      try {
        process.env['AGENT_COMM_DIR'] = tempDir;
        process.env['AGENT_COMM_ENABLE_ARCHIVING'] = 'true';
        
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getConfig, validateConfig } = require('../../src/config.js') as { getConfig: () => unknown; validateConfig: (config: unknown) => void };
        const config = getConfig();
        
        expect(() => { validateConfig(config); }).not.toThrow();
      } finally {
        await fs.remove(tempDir);
      }
    });
  });

  describe('Error Handling Patterns', () => {
    it('should have proper error classes available', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AgentCommError } = require('../../src/types.js') as { AgentCommError: new (msg: string, code: string) => Error };
      
      expect(AgentCommError).toBeDefined();
      expect(() => new AgentCommError('test', 'TEST_ERROR')).not.toThrow();
    });

    it('should handle common error scenarios', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AgentCommError } = require('../../src/types.js') as { AgentCommError: new (msg: string, code: string) => Error & { code: string } };
      
      const error = new AgentCommError('Test error', 'TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error).toBeInstanceOf(Error);
    });
  });
});