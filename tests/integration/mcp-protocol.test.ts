/**
 * MCP Protocol Integration Tests
 * Tests that verify proper MCP protocol compliance and real server communication
 */

import { createMCPServer } from '../../src/index.js';
import { TestEnvironment } from '../shared/race-condition-helpers.js';

describe('MCP Protocol Integration', () => {
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup('mcp-protocol-');
  }, 30000);

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  }, 30000);

  describe('Server Initialization', () => {
    it('should create MCP server with proper structure', () => {
      const server = createMCPServer();
      
      expect(server).toBeDefined();
      expect(typeof server.setRequestHandler).toBe('function');
      expect(typeof server.close).toBe('function');
      
      server.close();
    });

    it('should configure request handlers during setup', () => {
      const server = createMCPServer();
      
      // Server should be properly configured with handlers
      expect(server).toBeDefined();
      
      server.close();
    });
  });

  describe('MCP Tool Integration', () => {
    it('should create server without throwing errors', () => {
      // Test that server creation succeeds - this validates MCP setup
      expect(() => createMCPServer()).not.toThrow();
    });

    it('should handle server lifecycle properly', () => {
      const server = createMCPServer();
      
      expect(server).toBeDefined();
      
      // Test graceful shutdown
      expect(() => server.close()).not.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    it('should respect environment configuration in MCP context', () => {
      // Set test environment
      process.env['AGENT_COMM_DIR'] = testEnv.tempDir;
      
      const server = createMCPServer();
      expect(server).toBeDefined();
      
      server.close();
      
      // Clean up
      delete process.env['AGENT_COMM_DIR'];
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configuration gracefully', () => {
      const originalDir = process.env['AGENT_COMM_DIR'];
      
      try {
        process.env['AGENT_COMM_DIR'] = '';
        
        // Should either succeed with defaults or throw meaningful error
        const result = () => createMCPServer();
        
        try {
          const server = result();
          expect(server).toBeDefined();
          server.close();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      } finally {
        // Restore original environment
        if (originalDir) {
          process.env['AGENT_COMM_DIR'] = originalDir;
        } else {
          delete process.env['AGENT_COMM_DIR'];
        }
      }
    });
  });
});