/**
 * ConnectionManager - Session tracking for MCP Server
 * Tracks which agent is making requests via connection context
 */

export interface Connection {
  id: string;
  agent: string;
  startTime: Date;
  metadata: Record<string, unknown>;
  lastActivity?: Date;
}

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();

  /**
   * Register a new agent connection
   */
  register(connection: Connection): void {
    this.connections.set(connection.id, {
      ...connection,
      lastActivity: new Date()
    });
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Update last activity for a connection
   */
  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): Connection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Remove a connection
   */
  unregister(connectionId: string): boolean {
    return this.connections.delete(connectionId);
  }

  /**
   * Get connections by agent name
   */
  getConnectionsByAgent(agent: string): Connection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.agent === agent);
  }

  /**
   * Clean up stale connections (inactive for more than 1 hour)
   */
  cleanupStaleConnections(): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, connection] of this.connections.entries()) {
      const lastActivity = connection.lastActivity || connection.startTime;
      if (lastActivity < oneHourAgo) {
        this.connections.delete(id);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get connection count (public accessor for testing)
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a connection exists (public accessor for testing)
   */
  hasConnection(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  /**
   * Get connection statistics
   */
  getStatistics(): {
    totalConnections: number;
    uniqueAgents: number;
    connectionsByAgent: Record<string, number>;
  } {
    const connections = Array.from(this.connections.values());
    const agentCounts: Record<string, number> = {};

    for (const conn of connections) {
      agentCounts[conn.agent] = (agentCounts[conn.agent] || 0) + 1;
    }

    return {
      totalConnections: connections.length,
      uniqueAgents: Object.keys(agentCounts).length,
      connectionsByAgent: agentCounts
    };
  }
}