/**
 * DelegationTracker - Tracks delegation patterns to address Issue #12
 * Detects incomplete delegations and provides actionable guidance
 */

import type {
  DelegationRecord,
  DelegationStats,
  ServerConfig
} from '../types.js';
import * as fs from '../utils/fs-extra-safe.js';
import * as path from 'path';

/**
 * DelegationTracker manages delegation lifecycle tracking and detection
 */
export class DelegationTracker {
  private delegationsDir: string;
  private delegations = new Map<string, DelegationRecord>();

  constructor(config: ServerConfig) {
    this.delegationsDir = path.join(config.commDir, '.delegations');
  }

  /**
   * Initialize the delegation tracker
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.delegationsDir);
    await this.loadDelegations();
  }

  /**
   * Record a new delegation task creation
   */
  async recordDelegationCreated(taskId: string, targetAgent: string): Promise<void> {
    try {
      // Check if delegation already exists
      const existingPath = path.join(this.delegationsDir, `${taskId}.json`);
      if (await fs.pathExists(existingPath)) {
        // Delegation already exists, skip creation
        return;
      }

      // Create new delegation record
      const record: DelegationRecord = {
        taskId,
        targetAgent,
        createdAt: new Date(),
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      // Save to disk and cache
      await this.saveDelegationRecord(record);
      this.delegations.set(taskId, record);
    } catch (error) {
      // Error recording delegation - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Record a delegation using a complete DelegationRecord
   * This method accepts the full record and saves it directly
   */
  async recordDelegation(record: DelegationRecord): Promise<void> {
    try {
      // Save to disk and cache
      await this.saveDelegationRecord(record);
      this.delegations.set(record.taskId, record);
    } catch (error) {
      // Error recording delegation - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Record that the Task tool was invoked for a delegation
   */
  async recordTaskToolInvoked(taskId: string): Promise<void> {
    try {
      const record = await this.getDelegationRecord(taskId);
      if (!record) {
        // Delegation not found - skip update
        return;
      }

      // Update record
      record.taskToolInvoked = true;
      record.subagentStarted = true;
      record.completionStatus = 'complete';

      // Save updated record
      await this.saveDelegationRecord(record);
    } catch (error) {
      // Error updating delegation - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Check for incomplete delegations for an agent
   * Returns delegations that are pending and older than 10 minutes
   */
  async checkIncompleteDelegations(_agent: string): Promise<DelegationRecord[]> {
    try {
      await this.loadDelegations();
      
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const incompleteDelegations: DelegationRecord[] = [];

      for (const record of this.delegations.values()) {
        // Check if delegation is incomplete and old enough
        if (record.completionStatus === 'pending' && 
            record.createdAt < tenMinutesAgo &&
            !record.taskToolInvoked) {
          incompleteDelegations.push(record);
        }
      }

      return incompleteDelegations;
    } catch (error) {
      // Error checking incomplete delegations - return empty
      void error; // Acknowledge but don't log
      return [];
    }
  }

  /**
   * Generate a reminder message for incomplete delegations
   */
  async generateDelegationReminder(agent: string): Promise<string> {
    try {
      const incompleteDelegations = await this.checkIncompleteDelegations(agent);
      
      if (incompleteDelegations.length === 0) {
        return '';
      }

      const now = new Date();
      let reminder = `⚠️ You have ${incompleteDelegations.length} incomplete delegation${incompleteDelegations.length > 1 ? 's' : ''}:\n`;

      for (const delegation of incompleteDelegations) {
        const ageMinutes = Math.round((now.getTime() - delegation.createdAt.getTime()) / (1000 * 60));
        const ageHours = Math.floor(ageMinutes / 60);
        
        let urgency = '';
        if (ageHours >= 3) {
          urgency = '🚨 CRITICAL: ';
        } else if (ageHours >= 1) {
          urgency = '⚠️ URGENT: ';
        }

        const timeAgo = ageHours > 0 ? `${ageHours} hours ago` : `${ageMinutes} minutes ago`;
        
        reminder += `\n${urgency}Task ${delegation.taskId} (created ${timeAgo})`;
        reminder += `\n  Target: ${delegation.targetAgent}`;
        reminder += `\n  Action: Invoke Task tool to start subagent`;
      }

      reminder += '\n\n📋 Remember: Delegation requires TWO steps:';
      reminder += '\n  1. ✅ Create MCP task (done)';
      reminder += '\n  2. ❗ Invoke Task tool (pending)';

      return reminder;
    } catch (error) {
      // Error generating delegation reminder - return empty
      void error; // Acknowledge but don't log
      return '';
    }
  }

  /**
   * Generate a Task tool invocation command
   */
  generateTaskToolInvocation(targetAgent: string, taskId: string, taskContent: string): string {
    // Escape quotes in content
    const escapedContent = taskContent.replace(/"/g, '\\"');
    
    return `Task(
  subagent_type="${targetAgent}",
  prompt="You have an assigned MCP task: ${taskId}
  
  Start with: mcp__agent_comm__check_tasks(agent=\\"${targetAgent}\\")
  Then get context and begin work.
  
  Requirements: ${escapedContent}"
)`;
  }

  /**
   * Mark a delegation as abandoned (too old without completion)
   */
  async markDelegationAbandoned(taskId: string): Promise<void> {
    try {
      const record = await this.getDelegationRecord(taskId);
      if (!record) {
        return;
      }

      record.completionStatus = 'abandoned';
      await this.saveDelegationRecord(record);
    } catch (error) {
      // Error marking delegation as abandoned - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Get delegation statistics for an agent
   */
  async getDelegationStats(agent: string): Promise<DelegationStats> {
    try {
      await this.loadDelegations();
      
      let totalDelegations = 0;
      let completedDelegations = 0;
      let pendingDelegations = 0;
      let abandonedDelegations = 0;
      const totalCompletionTime = 0;
      let completionCount = 0;

      for (const record of this.delegations.values()) {
        if (record.targetAgent === agent) {
          totalDelegations++;
          
          switch (record.completionStatus) {
            case 'complete':
              completedDelegations++;
              // Calculate completion time if we have timestamps
              if (record.taskToolInvoked) {
                completionCount++;
                // For now, we don't track actual completion time
                // This would require tracking when Task tool was invoked
              }
              break;
            case 'pending':
              pendingDelegations++;
              break;
            case 'abandoned':
              abandonedDelegations++;
              break;
          }
        }
      }

      const completionRate = totalDelegations > 0 
        ? Math.round((completedDelegations / totalDelegations) * 100)
        : 100;

      const averageCompletionTime = completionCount > 0
        ? Math.round(totalCompletionTime / completionCount)
        : undefined;

      return {
        totalDelegations,
        completedDelegations,
        pendingDelegations,
        abandonedDelegations,
        completionRate,
        averageCompletionTime
      } as DelegationStats;
    } catch (error) {
      // Error getting delegation stats - return defaults
      void error; // Acknowledge but don't log
      const stats: DelegationStats = {
        totalDelegations: 0,
        completedDelegations: 0,
        pendingDelegations: 0,
        abandonedDelegations: 0,
        completionRate: 100
      };
      return stats;
    }
  }

  /**
   * Clean up old delegation records (older than 7 days)
   */
  async cleanupOldDelegations(): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const files = await fs.readdir(this.delegationsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.delegationsDir, file);
          const record = await fs.readJson(filePath) as DelegationRecord;
          
          // Convert string date to Date object if needed
          const createdAt = new Date(record.createdAt);
          
          if (createdAt < sevenDaysAgo) {
            await fs.remove(filePath);
            const taskId = file.replace('.json', '');
            this.delegations.delete(taskId);
          }
        }
      }
    } catch (error) {
      // Error cleaning up old delegations - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Load delegations from disk into memory
   */
  private async loadDelegations(): Promise<void> {
    try {
      if (!await fs.pathExists(this.delegationsDir)) {
        return;
      }

      const files = await fs.readdir(this.delegationsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.delegationsDir, file);
            const record = await fs.readJson(filePath) as DelegationRecord;
            
            // Convert string dates to Date objects
            record.createdAt = new Date(record.createdAt);
            
            const taskId = file.replace('.json', '');
            this.delegations.set(taskId, record);
          } catch (error) {
            // Error loading specific delegation file - skip it
            void error; // Acknowledge but don't log
          }
        }
      }
    } catch (error) {
      // Error loading delegations - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Get a delegation record by task ID
   */
  private async getDelegationRecord(taskId: string): Promise<DelegationRecord | null> {
    // Check cache first
    if (this.delegations.has(taskId)) {
      const record = this.delegations.get(taskId);
      if (!record) {
        throw new Error(`Delegation ${taskId} not found in cache`);
      }
      return record;
    }

    // Try to load from disk
    const recordPath = path.join(this.delegationsDir, `${taskId}.json`);
    
    try {
      if (await fs.pathExists(recordPath)) {
        const record = await fs.readJson(recordPath) as DelegationRecord;
        record.createdAt = new Date(record.createdAt);
        this.delegations.set(taskId, record);
        return record;
      }
    } catch (error) {
      // Error loading delegation - return null
      void error; // Acknowledge but don't log
    }

    return null;
  }

  /**
   * Save a delegation record to disk
   */
  private async saveDelegationRecord(record: DelegationRecord): Promise<void> {
    try {
      const recordPath = path.join(this.delegationsDir, `${record.taskId}.json`);
      await fs.writeJson(recordPath, record, { spaces: 2 });
    } catch (error) {
      // Error saving delegation - silently continue
      void error; // Acknowledge but don't log
    }
  }
}