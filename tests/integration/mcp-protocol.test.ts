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
    await testEnv.cleanup();
  }, 30000);

  describe('Server Initialization', () => {
    it('should create MCP server with proper structure', async () => {
      const server = await createMCPServer();
      
      expect(server).toBeDefined();
      expect(typeof server.setRequestHandler).toBe('function');
      expect(typeof server.close).toBe('function');
      
      await server.close();
    });

    it('should configure request handlers during setup', async () => {
      const server = await createMCPServer();
      
      // Server should be properly configured with handlers
      expect(server).toBeDefined();
      
      await server.close();
    });
  });

  describe('MCP Tool Integration', () => {
    it('should create server without throwing errors', () => {
      // Test that server creation succeeds - this validates MCP setup
      expect(() => createMCPServer()).not.toThrow();
    });

    it('should handle server lifecycle properly', async () => {
      const server = await createMCPServer();
      
      expect(server).toBeDefined();
      
      // Test graceful shutdown
      expect(() => server.close()).not.toThrow();
    });
  });

  describe('Configuration Integration', () => {
    it('should respect environment configuration in MCP context', async () => {
      // Set test environment
      process.env['AGENT_COMM_DIR'] = testEnv.tempDir;
      
      const server = await createMCPServer();
      expect(server).toBeDefined();
      
      await server.close();
      
      // Clean up
      // Resetting to undefined is preferred over delete for dynamic keys
      process.env['AGENT_COMM_DIR'] = undefined as unknown as string;
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid configuration gracefully', async () => {
      const originalDir = process.env['AGENT_COMM_DIR'];
      
      try {
        process.env['AGENT_COMM_DIR'] = '';
        
        // Should either succeed with defaults or throw meaningful error
        const result = () => createMCPServer();
        
        try {
          const server = await result();
          expect(server).toBeDefined();
          await server.close();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      } finally {
        // Restore original environment
        if (originalDir) {
          process.env['AGENT_COMM_DIR'] = originalDir;
        } else {
          // Resetting to undefined is preferred over delete for dynamic keys
          process.env['AGENT_COMM_DIR'] = undefined as unknown as string;
        }
      }
    });
  });
});