/**
 * Unit tests for ConnectionManager
 * Comprehensive coverage of all connection management functionality
 */

import { ConnectionManager, Connection } from '../../../src/core/ConnectionManager.js';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockConnection: Connection;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockConnection = {
      id: 'test-connection-1',
      agent: 'test-agent',
      startTime: new Date('2024-01-01T10:00:00.000Z'),
      metadata: { version: '1.0', type: 'test' }
    };
  });

  describe('register', () => {
    it('should register a new connection successfully', () => {
      connectionManager.register(mockConnection);
      
      const retrieved = connectionManager.getConnection('test-connection-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('test-connection-1');
      expect(retrieved!.agent).toBe('test-agent');
      expect(retrieved!.startTime).toEqual(new Date('2024-01-01T10:00:00.000Z'));
      expect(retrieved!.metadata).toEqual({ version: '1.0', type: 'test' });
      expect(retrieved!.lastActivity).toBeInstanceOf(Date);
    });

    it('should add lastActivity timestamp when registering', () => {
      const beforeRegister = Date.now();
      connectionManager.register(mockConnection);
      const afterRegister = Date.now();
      
      const retrieved = connectionManager.getConnection('test-connection-1');
      expect(retrieved!.lastActivity).toBeInstanceOf(Date);
      expect(retrieved!.lastActivity!.getTime()).toBeGreaterThanOrEqual(beforeRegister);
      expect(retrieved!.lastActivity!.getTime()).toBeLessThanOrEqual(afterRegister);
    });

    it('should overwrite existing connection with same ID', () => {
      connectionManager.register(mockConnection);
      
      const updatedConnection: Connection = {
        id: 'test-connection-1',
        agent: 'updated-agent',
        startTime: new Date('2024-01-02T10:00:00.000Z'),
        metadata: { version: '2.0', updated: true }
      };
      
      connectionManager.register(updatedConnection);
      
      const retrieved = connectionManager.getConnection('test-connection-1');
      expect(retrieved!.agent).toBe('updated-agent');
      expect(retrieved!.startTime).toEqual(new Date('2024-01-02T10:00:00.000Z'));
      expect(retrieved!.metadata).toEqual({ version: '2.0', updated: true });
    });

    it('should handle connection with no metadata', () => {
      const connectionWithoutMetadata: Connection = {
        id: 'no-metadata-connection',
        agent: 'test-agent',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(connectionWithoutMetadata);
      const retrieved = connectionManager.getConnection('no-metadata-connection');
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.metadata).toEqual({});
    });

    it('should handle multiple connections from same agent', () => {
      const connection1: Connection = {
        id: 'conn-1',
        agent: 'agent-a',
        startTime: new Date(),
        metadata: { session: 1 }
      };
      
      const connection2: Connection = {
        id: 'conn-2',
        agent: 'agent-a',
        startTime: new Date(),
        metadata: { session: 2 }
      };
      
      connectionManager.register(connection1);
      connectionManager.register(connection2);
      
      const retrieved1 = connectionManager.getConnection('conn-1');
      const retrieved2 = connectionManager.getConnection('conn-2');
      
      expect(retrieved1!.metadata['session']).toBe(1);
      expect(retrieved2!.metadata['session']).toBe(2);
    });
  });

  describe('getConnection', () => {
    it('should return undefined for non-existent connection', () => {
      const result = connectionManager.getConnection('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return the correct connection by ID', () => {
      connectionManager.register(mockConnection);
      
      const result = connectionManager.getConnection('test-connection-1');
      expect(result).toEqual(expect.objectContaining({
        id: 'test-connection-1',
        agent: 'test-agent',
        startTime: new Date('2024-01-01T10:00:00.000Z'),
        metadata: { version: '1.0', type: 'test' }
      }));
    });

    it('should handle empty string connection ID', () => {
      const result = connectionManager.getConnection('');
      expect(result).toBeUndefined();
    });

    it('should handle null connection ID gracefully', () => {
      const result = connectionManager.getConnection(null as any);
      expect(result).toBeUndefined();
    });

    it('should handle undefined connection ID gracefully', () => {
      const result = connectionManager.getConnection(undefined as any);
      expect(result).toBeUndefined();
    });
  });

  describe('updateActivity', () => {
    beforeEach(() => {
      connectionManager.register(mockConnection);
    });

    it('should update lastActivity for existing connection', async () => {
      const originalActivity = connectionManager.getConnection('test-connection-1')!.lastActivity;
      
      // Wait a small amount to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      connectionManager.updateActivity('test-connection-1');
      
      const updated = connectionManager.getConnection('test-connection-1')!;
      expect(updated.lastActivity).toBeInstanceOf(Date);
      expect(updated.lastActivity!.getTime()).toBeGreaterThan(originalActivity!.getTime());
    });

    it('should do nothing for non-existent connection', () => {
      // Should not throw
      expect(() => {
        connectionManager.updateActivity('non-existent');
      }).not.toThrow();
    });

    it('should handle empty string connection ID', () => {
      expect(() => {
        connectionManager.updateActivity('');
      }).not.toThrow();
    });

    it('should handle null connection ID', () => {
      expect(() => {
        connectionManager.updateActivity(null as any);
      }).not.toThrow();
    });

    it('should handle undefined connection ID', () => {
      expect(() => {
        connectionManager.updateActivity(undefined as any);
      }).not.toThrow();
    });

    it('should update activity timestamp correctly', () => {
      const beforeUpdate = Date.now();
      connectionManager.updateActivity('test-connection-1');
      const afterUpdate = Date.now();
      
      const updated = connectionManager.getConnection('test-connection-1')!;
      expect(updated.lastActivity!.getTime()).toBeGreaterThanOrEqual(beforeUpdate);
      expect(updated.lastActivity!.getTime()).toBeLessThanOrEqual(afterUpdate);
    });
  });

  describe('getActiveConnections', () => {
    it('should return empty array when no connections exist', () => {
      const result = connectionManager.getActiveConnections();
      expect(result).toEqual([]);
    });

    it('should return all registered connections', () => {
      const connection1: Connection = {
        id: 'conn-1',
        agent: 'agent-1',
        startTime: new Date(),
        metadata: {}
      };
      
      const connection2: Connection = {
        id: 'conn-2',
        agent: 'agent-2',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(connection1);
      connectionManager.register(connection2);
      
      const result = connectionManager.getActiveConnections();
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toContain('conn-1');
      expect(result.map(c => c.id)).toContain('conn-2');
    });

    it('should return array of connection objects', () => {
      connectionManager.register(mockConnection);
      
      const result = connectionManager.getActiveConnections();
      expect(result[0].id).toBe('test-connection-1');
      expect(result[0].agent).toBe('test-agent');
      
      // Note: This returns references to actual objects, not deep copies
      // This is expected behavior for performance reasons
    });

    it('should return connections with all properties', () => {
      connectionManager.register(mockConnection);
      
      const result = connectionManager.getActiveConnections();
      expect(result[0]).toEqual(expect.objectContaining({
        id: 'test-connection-1',
        agent: 'test-agent',
        startTime: expect.any(Date),
        metadata: expect.any(Object),
        lastActivity: expect.any(Date)
      }));
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      connectionManager.register(mockConnection);
    });

    it('should remove existing connection and return true', () => {
      const result = connectionManager.unregister('test-connection-1');
      
      expect(result).toBe(true);
      expect(connectionManager.getConnection('test-connection-1')).toBeUndefined();
    });

    it('should return false for non-existent connection', () => {
      const result = connectionManager.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should not affect other connections', () => {
      const connection2: Connection = {
        id: 'conn-2',
        agent: 'agent-2',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(connection2);
      
      const result = connectionManager.unregister('test-connection-1');
      
      expect(result).toBe(true);
      expect(connectionManager.getConnection('conn-2')).toBeDefined();
    });

    it('should handle empty string connection ID', () => {
      const result = connectionManager.unregister('');
      expect(result).toBe(false);
    });

    it('should handle null connection ID', () => {
      const result = connectionManager.unregister(null as any);
      expect(result).toBe(false);
    });
  });

  describe('getConnectionsByAgent', () => {
    beforeEach(() => {
      const connections: Connection[] = [
        {
          id: 'conn-1',
          agent: 'agent-a',
          startTime: new Date(),
          metadata: { session: 1 }
        },
        {
          id: 'conn-2',
          agent: 'agent-a',
          startTime: new Date(),
          metadata: { session: 2 }
        },
        {
          id: 'conn-3',
          agent: 'agent-b',
          startTime: new Date(),
          metadata: { session: 1 }
        }
      ];
      
      connections.forEach(conn => connectionManager.register(conn));
    });

    it('should return connections for specific agent', () => {
      const result = connectionManager.getConnectionsByAgent('agent-a');
      
      expect(result).toHaveLength(2);
      expect(result.every(conn => conn.agent === 'agent-a')).toBe(true);
      expect(result.map(c => c.id)).toContain('conn-1');
      expect(result.map(c => c.id)).toContain('conn-2');
    });

    it('should return empty array for agent with no connections', () => {
      const result = connectionManager.getConnectionsByAgent('non-existent-agent');
      expect(result).toEqual([]);
    });

    it('should return single connection for agent with one connection', () => {
      const result = connectionManager.getConnectionsByAgent('agent-b');
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('conn-3');
      expect(result[0].agent).toBe('agent-b');
    });

    it('should handle empty string agent name', () => {
      const result = connectionManager.getConnectionsByAgent('');
      expect(result).toEqual([]);
    });

    it('should handle null agent name', () => {
      const result = connectionManager.getConnectionsByAgent(null as any);
      expect(result).toEqual([]);
    });

    it('should be case sensitive', () => {
      const result1 = connectionManager.getConnectionsByAgent('agent-a');
      const result2 = connectionManager.getConnectionsByAgent('Agent-A');
      
      expect(result1).toHaveLength(2);
      expect(result2).toEqual([]);
    });
  });

  describe('cleanupStaleConnections', () => {
    it('should remove connections older than 1 hour', () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      
      const staleConnection: Connection = {
        id: 'stale-conn',
        agent: 'stale-agent',
        startTime: oldTime,
        metadata: {}
      };
      
      const recentConnection: Connection = {
        id: 'recent-conn',
        agent: 'recent-agent',
        startTime: recentTime,
        metadata: {}
      };
      
      connectionManager.register(staleConnection);
      connectionManager.register(recentConnection);
      
      // Manually set the lastActivity to old time for the stale connection
      const staleConn = connectionManager.getConnection('stale-conn')!;
      staleConn.lastActivity = oldTime;
      
      const removedCount = connectionManager.cleanupStaleConnections();
      
      expect(removedCount).toBe(1);
      expect(connectionManager.getConnection('stale-conn')).toBeUndefined();
      expect(connectionManager.getConnection('recent-conn')).toBeDefined();
    });

    it('should use lastActivity over startTime when available', () => {
      const oldStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const recentActivity = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      
      const connection: Connection = {
        id: 'test-conn',
        agent: 'test-agent',
        startTime: oldStartTime,
        metadata: {},
        lastActivity: recentActivity
      };
      
      connectionManager.register(connection);
      
      const removedCount = connectionManager.cleanupStaleConnections();
      
      expect(removedCount).toBe(0);
      expect(connectionManager.getConnection('test-conn')).toBeDefined();
    });

    it('should return 0 when no stale connections exist', () => {
      const recentConnection: Connection = {
        id: 'recent-conn',
        agent: 'recent-agent',
        startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        metadata: {}
      };
      
      connectionManager.register(recentConnection);
      
      const removedCount = connectionManager.cleanupStaleConnections();
      
      expect(removedCount).toBe(0);
      expect(connectionManager.getConnection('recent-conn')).toBeDefined();
    });

    it('should handle empty connections map', () => {
      const removedCount = connectionManager.cleanupStaleConnections();
      expect(removedCount).toBe(0);
    });

    it('should remove multiple stale connections', () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      
      const connections: Connection[] = [
        {
          id: 'stale-1',
          agent: 'agent-1',
          startTime: oldTime,
          metadata: {}
        },
        {
          id: 'stale-2',
          agent: 'agent-2',
          startTime: oldTime,
          metadata: {}
        },
        {
          id: 'stale-3',
          agent: 'agent-3',
          startTime: oldTime,
          metadata: {}
        }
      ];
      
      connections.forEach(conn => connectionManager.register(conn));
      
      // Manually set the lastActivity to old time for all connections
      connections.forEach(conn => {
        const registeredConn = connectionManager.getConnection(conn.id)!;
        registeredConn.lastActivity = oldTime;
      });
      
      const removedCount = connectionManager.cleanupStaleConnections();
      
      expect(removedCount).toBe(3);
      expect(connectionManager.getActiveConnections()).toHaveLength(0);
    });

    it('should handle connection with no lastActivity', () => {
      const oldConnection: Connection = {
        id: 'old-conn',
        agent: 'old-agent',
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        metadata: {}
        // No lastActivity - should use startTime
      };
      
      connectionManager.register(oldConnection);
      
      // Remove lastActivity that was added during registration
      const conn = connectionManager.getConnection('old-conn')!;
      delete conn.lastActivity;
      
      const removedCount = connectionManager.cleanupStaleConnections();
      
      expect(removedCount).toBe(1);
      expect(connectionManager.getConnection('old-conn')).toBeUndefined();
    });
  });

  describe('getStatistics', () => {
    it('should return zero stats for empty connections', () => {
      const stats = connectionManager.getStatistics();
      
      expect(stats).toEqual({
        totalConnections: 0,
        uniqueAgents: 0,
        connectionsByAgent: {}
      });
    });

    it('should return correct stats for single connection', () => {
      connectionManager.register(mockConnection);
      
      const stats = connectionManager.getStatistics();
      
      expect(stats).toEqual({
        totalConnections: 1,
        uniqueAgents: 1,
        connectionsByAgent: {
          'test-agent': 1
        }
      });
    });

    it('should return correct stats for multiple connections from same agent', () => {
      const connections: Connection[] = [
        {
          id: 'conn-1',
          agent: 'agent-a',
          startTime: new Date(),
          metadata: {}
        },
        {
          id: 'conn-2',
          agent: 'agent-a',
          startTime: new Date(),
          metadata: {}
        }
      ];
      
      connections.forEach(conn => connectionManager.register(conn));
      
      const stats = connectionManager.getStatistics();
      
      expect(stats).toEqual({
        totalConnections: 2,
        uniqueAgents: 1,
        connectionsByAgent: {
          'agent-a': 2
        }
      });
    });

    it('should return correct stats for multiple agents', () => {
      const connections: Connection[] = [
        {
          id: 'conn-1',
          agent: 'agent-a',
          startTime: new Date(),
          metadata: {}
        },
        {
          id: 'conn-2',
          agent: 'agent-a',
          startTime: new Date(),
          metadata: {}
        },
        {
          id: 'conn-3',
          agent: 'agent-b',
          startTime: new Date(),
          metadata: {}
        },
        {
          id: 'conn-4',
          agent: 'agent-c',
          startTime: new Date(),
          metadata: {}
        }
      ];
      
      connections.forEach(conn => connectionManager.register(conn));
      
      const stats = connectionManager.getStatistics();
      
      expect(stats).toEqual({
        totalConnections: 4,
        uniqueAgents: 3,
        connectionsByAgent: {
          'agent-a': 2,
          'agent-b': 1,
          'agent-c': 1
        }
      });
    });

    it('should handle dynamic changes to connections', () => {
      connectionManager.register(mockConnection);
      
      let stats = connectionManager.getStatistics();
      expect(stats.totalConnections).toBe(1);
      
      const connection2: Connection = {
        id: 'conn-2',
        agent: 'agent-2',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(connection2);
      
      stats = connectionManager.getStatistics();
      expect(stats.totalConnections).toBe(2);
      expect(stats.uniqueAgents).toBe(2);
      
      connectionManager.unregister('test-connection-1');
      
      stats = connectionManager.getStatistics();
      expect(stats.totalConnections).toBe(1);
      expect(stats.uniqueAgents).toBe(1);
      expect(stats.connectionsByAgent).toEqual({
        'agent-2': 1
      });
    });
  });

  describe('getConnectionCount', () => {
    it('should return 0 for empty connections', () => {
      expect(connectionManager.getConnectionCount()).toBe(0);
    });

    it('should return correct count for single connection', () => {
      connectionManager.register(mockConnection);
      expect(connectionManager.getConnectionCount()).toBe(1);
    });

    it('should return correct count for multiple connections', () => {
      const connections: Connection[] = [
        {
          id: 'conn-1',
          agent: 'agent-1',
          startTime: new Date(),
          metadata: {}
        },
        {
          id: 'conn-2',
          agent: 'agent-2',
          startTime: new Date(),
          metadata: {}
        },
        {
          id: 'conn-3',
          agent: 'agent-3',
          startTime: new Date(),
          metadata: {}
        }
      ];

      connections.forEach(conn => connectionManager.register(conn));
      expect(connectionManager.getConnectionCount()).toBe(3);
    });

    it('should update count when connections are removed', () => {
      connectionManager.register(mockConnection);
      expect(connectionManager.getConnectionCount()).toBe(1);
      
      connectionManager.unregister('test-connection-1');
      expect(connectionManager.getConnectionCount()).toBe(0);
    });
  });

  describe('hasConnection', () => {
    it('should return false for empty connections', () => {
      expect(connectionManager.hasConnection('any-id')).toBe(false);
    });

    it('should return false for non-existent connection', () => {
      connectionManager.register(mockConnection);
      expect(connectionManager.hasConnection('non-existent')).toBe(false);
    });

    it('should return true for existing connection', () => {
      connectionManager.register(mockConnection);
      expect(connectionManager.hasConnection('test-connection-1')).toBe(true);
    });

    it('should return false after connection is removed', () => {
      connectionManager.register(mockConnection);
      expect(connectionManager.hasConnection('test-connection-1')).toBe(true);
      
      connectionManager.unregister('test-connection-1');
      expect(connectionManager.hasConnection('test-connection-1')).toBe(false);
    });

    it('should handle empty string connection ID', () => {
      expect(connectionManager.hasConnection('')).toBe(false);
      
      const emptyIdConnection: Connection = {
        id: '',
        agent: 'test-agent',
        startTime: new Date(),
        metadata: {}
      };
      
      connectionManager.register(emptyIdConnection);
      expect(connectionManager.hasConnection('')).toBe(true);
    });

    it('should handle null and undefined connection IDs', () => {
      expect(connectionManager.hasConnection(null as any)).toBe(false);
      expect(connectionManager.hasConnection(undefined as any)).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete connection lifecycle', () => {
      // Register connection
      connectionManager.register(mockConnection);
      expect(connectionManager.getConnection('test-connection-1')).toBeDefined();
      
      // Update activity
      connectionManager.updateActivity('test-connection-1');
      
      // Check stats
      const stats = connectionManager.getStatistics();
      expect(stats.totalConnections).toBe(1);
      
      // Get active connections
      const active = connectionManager.getActiveConnections();
      expect(active).toHaveLength(1);
      
      // Get by agent
      const byAgent = connectionManager.getConnectionsByAgent('test-agent');
      expect(byAgent).toHaveLength(1);
      
      // Unregister
      const removed = connectionManager.unregister('test-connection-1');
      expect(removed).toBe(true);
      expect(connectionManager.getConnection('test-connection-1')).toBeUndefined();
    });

    it('should handle concurrent operations', () => {
      // Simulate concurrent registrations
      const connections: Connection[] = [];
      for (let i = 0; i < 10; i++) {
        connections.push({
          id: `conn-${i}`,
          agent: `agent-${i % 3}`,
          startTime: new Date(),
          metadata: { index: i }
        });
      }
      
      // Register all connections
      connections.forEach(conn => connectionManager.register(conn));
      
      // Verify all registered
      expect(connectionManager.getActiveConnections()).toHaveLength(10);
      
      // Update activities
      connections.forEach(conn => connectionManager.updateActivity(conn.id));
      
      // Check statistics
      const stats = connectionManager.getStatistics();
      expect(stats.totalConnections).toBe(10);
      expect(stats.uniqueAgents).toBe(3);
      
      // Cleanup some connections
      connectionManager.unregister('conn-0');
      connectionManager.unregister('conn-1');
      
      expect(connectionManager.getActiveConnections()).toHaveLength(8);
    });

    it('should handle edge cases gracefully', () => {
      // Test with unusual connection data
      const edgeCaseConnection: Connection = {
        id: '',
        agent: '',
        startTime: new Date(0), // Unix epoch
        metadata: { 
          null: null,
          undefined: undefined,
          empty: '',
          array: [],
          object: {},
          number: 0,
          boolean: false
        }
      };
      
      connectionManager.register(edgeCaseConnection);
      
      const retrieved = connectionManager.getConnection('');
      expect(retrieved).toBeDefined();
      
      const byAgent = connectionManager.getConnectionsByAgent('');
      expect(byAgent).toHaveLength(1);
      
      const stats = connectionManager.getStatistics();
      expect(stats.totalConnections).toBe(1);
      expect(stats.connectionsByAgent['']).toBe(1);
    });

    it('should maintain data integrity during rapid operations', () => {
      // Rapid register/unregister cycle
      for (let cycle = 0; cycle < 5; cycle++) {
        // Register connections
        for (let i = 0; i < 5; i++) {
          connectionManager.register({
            id: `cycle-${cycle}-conn-${i}`,
            agent: `agent-${i}`,
            startTime: new Date(),
            metadata: { cycle, index: i }
          });
        }
        
        // Verify registration
        expect(connectionManager.getActiveConnections()).toHaveLength(5);
        
        // Update some activities
        connectionManager.updateActivity(`cycle-${cycle}-conn-2`);
        
        // Remove some connections
        connectionManager.unregister(`cycle-${cycle}-conn-0`);
        connectionManager.unregister(`cycle-${cycle}-conn-1`);
        
        expect(connectionManager.getActiveConnections()).toHaveLength(3);
        
        // Cleanup remaining
        connectionManager.unregister(`cycle-${cycle}-conn-2`);
        connectionManager.unregister(`cycle-${cycle}-conn-3`);
        connectionManager.unregister(`cycle-${cycle}-conn-4`);
        
        expect(connectionManager.getActiveConnections()).toHaveLength(0);
      }
      
      // Final verification
      expect(connectionManager.getStatistics().totalConnections).toBe(0);
    });
  });
});