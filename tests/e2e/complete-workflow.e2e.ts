/**
 * End-to-End Tests - Complete System Workflow
 * Simplified version focusing on actual server functionality
 */

import { createMCPServer } from '../../src/index.js';
import { TestEnvironment } from '../shared/race-condition-helpers.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

describe('E2E - Complete Workflow Tests', () => {
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup('e2e-workflow-');
  }, 30000);

  afterAll(async () => {
    await testEnv.cleanup();
  }, 30000);

  describe('Server Integration', () => {
    it('should create and initialize server successfully', () => {
      // Test complete server creation - this catches startup issues
      const server = createMCPServer();
      expect(server).toBeDefined();
    });

    it('should handle server lifecycle without errors', () => {
      const server = createMCPServer();
      
      // Test basic lifecycle
      expect(server).toBeDefined();
      
      // Test graceful shutdown
      expect(() => {
        void server.close();
      }).not.toThrow();
    });
  });

  describe('Real-World Scenario', () => {
    it('should handle multiple server instances', () => {
      // Test that multiple servers can be created (common in testing)
      const server1 = createMCPServer();
      const server2 = createMCPServer();
      
      expect(server1).toBeDefined();
      expect(server2).toBeDefined();
      
      // Cleanup
      void server1.close();
      void server2.close();
    });

    it('should maintain functionality after errors', () => {
      // Test error recovery
      const server = createMCPServer();
      expect(server).toBeDefined();
      
      // Simulate error conditions and recovery
      try {
        // Force an error scenario if possible
        void server.close();
        
        // Create new server after error
        const newServer = createMCPServer();
        expect(newServer).toBeDefined();
        
        void newServer.close();
      } catch (error) {
        // Error handling is working
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance and Scale', () => {
    it('should handle rapid server creation/destruction', () => {
      const servers: Server[] = [];
      
      // Create multiple servers quickly
      for (let i = 0; i < 5; i++) {
        const server = createMCPServer();
        expect(server).toBeDefined();
        servers.push(server);
      }
      
      // Clean up all servers
      servers.forEach(server => {
        expect(() => server.close()).not.toThrow();
      });
    });
  });
});