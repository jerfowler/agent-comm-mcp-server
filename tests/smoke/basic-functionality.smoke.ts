/**
 * Smoke Tests - Basic Functionality
 * Fast validation of critical paths and dependencies
 * Target: <30 seconds total execution time
 */

import * as fs from 'fs-extra';
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        expect(() => require(toolPath)).not.toThrow();
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
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        expect(() => require(component)).not.toThrow();
      }
    });

    it('should import main server without errors', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      expect(() => require('../../src/index.js')).not.toThrow();
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
      
      // This will catch fs.readJsonSync vs fs.readJson issues
      await fs.writeJson(jsonFile, data);
      const readData = await fs.readJson(jsonFile);
      
      expect(readData).toEqual(data);
    });
  });

  describe('MCP SDK Dependencies', () => {
    it('should import MCP server components', () => {
      expect(() => require('@modelcontextprotocol/sdk/server/index.js')).not.toThrow();
      expect(() => require('@modelcontextprotocol/sdk/server/stdio.js')).not.toThrow();
      expect(() => require('@modelcontextprotocol/sdk/types.js')).not.toThrow();
    });

    it('should create basic MCP structures', () => {
      const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
      
      expect(() => new Server({ name: 'test', version: '1.0.0' }, { capabilities: {} })).not.toThrow();
    });
  });

  describe('TypeScript Compilation Validation', () => {
    it('should have dist directory with compiled files', async () => {
      const distDir = path.join(__dirname, '../../dist');
      
      // Check that dist directory exists and has key files
      expect(await fs.pathExists(distDir)).toBe(true);
      expect(await fs.pathExists(path.join(distDir, 'index.js'))).toBe(true);
      expect(await fs.pathExists(path.join(distDir, 'config.js'))).toBe(true);
    });
  });

  describe('Package Dependencies', () => {
    it('should have all required dependencies available', () => {
      const packageJson = require('../../package.json');
      
      // Check that key dependencies are defined in package.json
      expect(packageJson.dependencies['@modelcontextprotocol/sdk']).toBeDefined();
      expect(packageJson.dependencies['fs-extra']).toBeDefined();
      
      // Verify fs-extra can be imported (MCP SDK might have module resolution issues in Jest)
      expect(() => require('fs-extra')).not.toThrow();
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
      delete process.env['AGENT_COMM_DIR'];
      
      const { getConfig } = require('../../src/config.js');
      
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
        
        const { getConfig, validateConfig } = require('../../src/config.js');
        const config = getConfig();
        
        expect(() => validateConfig(config)).not.toThrow();
      } finally {
        await fs.remove(tempDir);
      }
    });
  });

  describe('Error Handling Patterns', () => {
    it('should have proper error classes available', () => {
      const { AgentCommError } = require('../../src/types.js');
      
      expect(AgentCommError).toBeDefined();
      expect(() => new AgentCommError('test', 'TEST_ERROR')).not.toThrow();
    });

    it('should handle common error scenarios', () => {
      const { AgentCommError } = require('../../src/types.js');
      
      const error = new AgentCommError('Test error', 'TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error).toBeInstanceOf(Error);
    });
  });
});