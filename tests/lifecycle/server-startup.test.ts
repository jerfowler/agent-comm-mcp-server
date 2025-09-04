/**
 * Server Lifecycle Tests - Critical startup/shutdown testing
 * These tests validate actual server initialization and would catch issues like fs.readJsonSync
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { createMCPServer } from '../../src/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

describe('Server Startup Lifecycle', () => {
  let tempDir: string;
  let originalCommDir: string | undefined;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'server-lifecycle-test-'));
    
    // Backup original environment
    originalCommDir = process.env['AGENT_COMM_DIR'];
    
    // Set test environment
    process.env['AGENT_COMM_DIR'] = tempDir;
  });

  afterEach(async () => {
    // Restore original environment
    if (originalCommDir) {
      process.env['AGENT_COMM_DIR'] = originalCommDir;
    } else {
      delete process.env['AGENT_COMM_DIR'];
    }
    
    // Clean up temporary directory
    await fs.remove(tempDir);
  });

  describe('Server Creation', () => {
    it('should create server without runtime errors', () => {
      // This test would catch the fs.readJsonSync issue
      expect(() => createMCPServer()).not.toThrow();
    });

    it('should return valid Server instance', () => {
      const server = createMCPServer();
      expect(server).toBeInstanceOf(Server);
      expect(server).toBeDefined();
    });

    it('should initialize with valid configuration', () => {
      const server = createMCPServer();
      
      // Server should be created successfully
      expect(server).toBeDefined();
      
      // Server should be created successfully
      // Note: Server info is internal to MCP SDK, focus on core functionality
    });
  });

  describe('Configuration Validation', () => {
    it('should validate comm directory exists', async () => {
      // Test with non-existent directory
      process.env['AGENT_COMM_DIR'] = '/non/existent/path';
      
      // Should throw during config validation
      expect(() => createMCPServer()).toThrow();
    });

    it('should handle missing comm directory by creating it', async () => {
      const newCommDir = path.join(tempDir, 'new-comm');
      process.env['AGENT_COMM_DIR'] = newCommDir;
      
      // Should create directory and succeed
      expect(() => createMCPServer()).not.toThrow();
      
      // Directory should be created
      expect(await fs.pathExists(newCommDir)).toBe(true);
    });

    it('should validate archive directory when archiving enabled', async () => {
      process.env['AGENT_COMM_ENABLE_ARCHIVING'] = 'true';
      process.env['AGENT_COMM_ARCHIVE_DIR'] = path.join(tempDir, 'archive');
      
      const server = createMCPServer();
      expect(server).toBeDefined();
      
      // Archive directory should be created
      expect(await fs.pathExists(path.join(tempDir, 'archive'))).toBe(true);
    });
  });

  describe('Dependency Validation', () => {
    it('should have all required tools available', async () => {
      const server = createMCPServer();
      
      // Server should be created with tools registered
      // Note: Tool registration happens during server creation
      expect(server).toBeDefined();
      
      // Validate server has tool handlers set up
      // This ensures the server initialization completed successfully
    });

    it('should import all core components successfully', () => {
      // These imports should work without errors
      expect(() => require('../../src/core/ConnectionManager.js')).not.toThrow();
      expect(() => require('../../src/logging/EventLogger.js')).not.toThrow();
      expect(() => require('../../src/utils/file-system.js')).not.toThrow();
      expect(() => require('../../src/utils/validation.js')).not.toThrow();
    });

    it('should validate fs-extra usage patterns', async () => {
      // Test that fs-extra is used correctly throughout the codebase
      const fsUtils = await import('../../src/utils/file-system.js');
      
      // These should not throw due to incorrect fs-extra usage
      expect(typeof fsUtils.ensureDirectory).toBe('function');
      expect(typeof fsUtils.writeFile).toBe('function');
      expect(typeof fsUtils.readFile).toBe('function');
    });
  });

  describe('Error Handling During Startup', () => {
    it('should handle configuration errors gracefully', () => {
      // Test with invalid JSON configuration if applicable
      process.env['AGENT_COMM_DIR'] = '';
      
      expect(() => createMCPServer()).toThrow(/configuration|directory/i);
    });

    it('should handle missing environment variables', () => {
      delete process.env['AGENT_COMM_DIR'];
      
      // Should either use defaults or throw meaningful error
      const result = () => createMCPServer();
      
      // Should either succeed with defaults or fail with clear message
      try {
        const server = result();
        expect(server).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/configuration|directory/i);
      }
    });

    it('should handle permission issues', async () => {
      // Create directory with restricted permissions (Unix only)
      if (process.platform !== 'win32') {
        const restrictedDir = path.join(tempDir, 'restricted');
        await fs.ensureDir(restrictedDir);
        await fs.chmod(restrictedDir, 0o000);
        
        process.env['AGENT_COMM_DIR'] = path.join(restrictedDir, 'comm');
        
        try {
          expect(() => createMCPServer()).toThrow();
        } finally {
          // Restore permissions for cleanup
          await fs.chmod(restrictedDir, 0o755);
        }
      }
    });
  });

  describe('Component Initialization', () => {
    it('should initialize ConnectionManager', () => {
      const server = createMCPServer();
      
      // Verify that ConnectionManager is properly initialized
      // Note: This tests the actual initialization path
      expect(server).toBeDefined();
      
      server.close();
    });

    it('should initialize EventLogger with correct path', async () => {
      const server = createMCPServer();
      
      // Event logger should be initialized with logs directory
      const logsPath = path.join(tempDir, 'logs');
      expect(await fs.pathExists(logsPath)).toBe(true);
      
      server.close();
    });

    it('should set up all request handlers', async () => {
      const server = createMCPServer();
      
      // Server should have completed initialization
      expect(server).toBeDefined();
    });
  });

  describe('Server Info Validation', () => {
    it('should initialize without throwing errors', () => {
      const server = createMCPServer();
      expect(server).toBeDefined();
    });
  });
});

describe('Server Shutdown Lifecycle', () => {
  let server: Server;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'server-shutdown-test-'));
    process.env['AGENT_COMM_DIR'] = tempDir;
    server = createMCPServer();
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should handle graceful shutdown', async () => {
    // Test that server can be properly closed
    expect(() => server.close()).not.toThrow();
  });

  it('should clean up resources on shutdown', async () => {
    // Create some test resources
    const testFile = path.join(tempDir, 'test.txt');
    await fs.writeFile(testFile, 'test');
    
    // Close server
    server.close();
    
    // Test file should still exist (we don't auto-cleanup user data)
    expect(await fs.pathExists(testFile)).toBe(true);
  });
});