/**
 * ComplianceTracker - Tracks agent behavior patterns and compliance scores
 * Part of the Smart Response System for improving agent task completion
 */

import debug from 'debug';
import type {
  AgentComplianceRecord,
  ComplianceActivity,
  ServerConfig
} from '../types.js';
import * as fs from '../utils/fs-extra-safe.js';
import * as path from 'path';

const log = debug('agent-comm:core:compliancetracker');
/**
 * ComplianceTracker manages agent compliance scoring and escalation levels
 */
export class ComplianceTracker {
  private complianceDir: string;
  private records = new Map<string, AgentComplianceRecord>();

  constructor(config: ServerConfig) {
    this.complianceDir = path.join(config.commDir, '.compliance');
  }

  /**
   * Initialize the compliance tracker
   */
  async initialize(): Promise<void> {
    log('initialize called');
    await fs.ensureDir(this.complianceDir);
  }

  /**
   * Record an agent activity
   */
  async recordActivity(agent: string, activity: ComplianceActivity): Promise<void> {
    try {
      // Get or create agent record
      const record = await this.getAgentRecord(agent);

      // Update counters based on activity type
      switch (activity.type) {
        case 'task_created':
          record.tasksCreated++;
          break;
        case 'delegation_completed':
          record.delegationsCompleted++;
          break;
        case 'todowrite_used':
          record.todoWriteUsage++;
          break;
        case 'plan_submitted':
          record.planSubmissions++;
          break;
        case 'progress_reported':
          record.progressReports++;
          break;
        case 'task_completed':
          record.completions++;
          break;
      }

      // Update last activity timestamp
      record.lastActivity = new Date();

      // Recalculate compliance score
      await this.updateComplianceScore(agent);

      // Save updated record
      await this.saveAgentRecord(record);
    } catch (error) {
      // Error recording activity - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Get compliance level for an agent (0-100)
   */
  async getComplianceLevel(agent: string): Promise<number> {
    try {
      const record = await this.getAgentRecord(agent);
      
      // New agents start with perfect compliance
      if (record.tasksCreated === 0) {
        return 100;
      }

      return this.calculateComplianceScore(record);
    } catch (error) {
      // Error getting compliance level - return default
      void error; // Acknowledge but don't log
      return 100; // Default to perfect compliance on error
    }
  }

  /**
   * Get escalation level based on compliance score (1-4)
   */
  async getEscalationLevel(agent: string): Promise<number> {
    const complianceLevel = await this.getComplianceLevel(agent);
    
    if (complianceLevel >= 90) return 1; // Friendly reminders
    if (complianceLevel >= 70) return 2; // Warning messages
    if (complianceLevel >= 50) return 3; // Critical notifications
    return 4; // Blocking interventions
  }

  /**
   * Get personalized guidance for an agent based on their compliance
   */
  async getPersonalizedGuidance(agent: string, toolName: string): Promise<string> {
    const escalationLevel = await this.getEscalationLevel(agent);
    const record = await this.getAgentRecord(agent);

    // Calculate specific metrics
    const unsubmittedPlans = record.tasksCreated - record.planSubmissions;
    const delegationRate = record.tasksCreated > 0 
      ? Math.round((record.delegationsCompleted / record.tasksCreated) * 100)
      : 100;

    // Tool-specific guidance based on escalation level
    switch (toolName) {
      case 'create_task':
        return this.getCreateTaskGuidance(escalationLevel, unsubmittedPlans, delegationRate);
      case 'submit_plan':
        return this.getSubmitPlanGuidance(escalationLevel);
      case 'report_progress':
        return this.getReportProgressGuidance(escalationLevel);
      case 'mark_complete':
        return this.getMarkCompleteGuidance(escalationLevel);
      default:
        return this.getDefaultGuidance(escalationLevel);
    }
  }

  /**
   * Update compliance score for an agent
   */
  async updateComplianceScore(agent: string): Promise<void> {
    try {
      const record = await this.getAgentRecord(agent);
      record.complianceScore = this.calculateComplianceScore(record);
      record.escalationLevel = await this.getEscalationLevel(agent);
      await this.saveAgentRecord(record);
    } catch (error) {
      // Error updating compliance score - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Get or create agent record
   */
  async getAgentRecord(agent: string): Promise<AgentComplianceRecord> {
    // Check in-memory cache first
    if (this.records.has(agent)) {
      const record = this.records.get(agent);
      if (!record) {
        throw new Error(`Record for agent ${agent} not found in cache`);
      }
      return record;
    }

    // Try to load from disk
    const recordPath = path.join(this.complianceDir, `${agent}.json`);
    
    try {
      if (await fs.pathExists(recordPath)) {
        const content = await fs.readFile(recordPath, 'utf8');
        const record = JSON.parse(content) as AgentComplianceRecord;
        // Convert string dates back to Date objects
        record.lastActivity = new Date(record.lastActivity);
        this.records.set(agent, record);
        return record;
      }
    } catch (error) {
      // Error loading compliance record - continue with new record
      void error; // Acknowledge but don't log
    }

    // Create new record
    const newRecord: AgentComplianceRecord = {
      agent,
      tasksCreated: 0,
      delegationsCompleted: 0,
      todoWriteUsage: 0,
      planSubmissions: 0,
      progressReports: 0,
      completions: 0,
      lastActivity: new Date(),
      complianceScore: 100,
      escalationLevel: 1
    };

    this.records.set(agent, newRecord);
    return newRecord;
  }

  /**
   * Save agent record to disk
   */
  private async saveAgentRecord(record: AgentComplianceRecord): Promise<void> {
    try {
      const recordPath = path.join(this.complianceDir, `${record.agent}.json`);
      const jsonStr = JSON.stringify(record, null, 2);
      await fs.writeFile(recordPath, jsonStr);
    } catch (error) {
      // Error saving compliance record - silently continue
      void error; // Acknowledge but don't log
    }
  }

  /**
   * Calculate compliance score based on agent metrics
   */
  private calculateComplianceScore(record: AgentComplianceRecord): number {
    let score = 100;
    
    // Prevent division by zero
    const taskCount = Math.max(1, record.tasksCreated);
    
    // Delegation completion rate (Issue #12 specific) - weight: 20 points
    const delegationRate = record.delegationsCompleted / taskCount;
    if (delegationRate < 0.8) {
      score -= 20;
    }
    
    // TodoWrite integration - weight: 15 points
    const todoUsageRate = record.todoWriteUsage / taskCount;
    if (todoUsageRate < 0.9) {
      score -= 15;
    }
    
    // Plan submission consistency - weight: 10 points
    const planRate = record.planSubmissions / taskCount;
    if (planRate < 0.95) {
      score -= 10;
    }
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Get guidance for create_task tool
   */
  private getCreateTaskGuidance(escalationLevel: number, unsubmittedPlans: number, delegationRate: number): string {
    switch (escalationLevel) {
      case 1:
        return '✅ Great job! Task created. NEXT: Submit your implementation plan with checkboxes.';
      case 2:
        return `⚠️ Task created. You have ${unsubmittedPlans} tasks without plans. Submit plan now.`;
      case 3:
        return `🚨 CRITICAL: Task created but ${delegationRate}% delegation completion rate. Complete workflow!`;
      case 4:
        return '❌ BLOCKED: Cannot create more tasks until existing delegation workflow completed.';
      default:
        return 'Task created. Follow MCP protocol.';
    }
  }

  /**
   * Get guidance for submit_plan tool
   */
  private getSubmitPlanGuidance(escalationLevel: number): string {
    switch (escalationLevel) {
      case 1:
        return '✅ Excellent! Plan submitted. Begin implementation with TodoWrite integration.';
      case 2:
        return '⚠️ Plan submitted. Remember to use TodoWrite for tracking progress.';
      case 3:
        return '🚨 Plan submitted. You must use TodoWrite - compliance is critical.';
      case 4:
        return '❌ Plan submitted but compliance too low. Follow all protocol steps.';
      default:
        return 'Plan submitted. Begin implementation.';
    }
  }

  /**
   * Get guidance for report_progress tool
   */
  private getReportProgressGuidance(escalationLevel: number): string {
    switch (escalationLevel) {
      case 1:
        return '✅ Progress updated! Continue with remaining steps.';
      case 2:
        return '⚠️ Progress reported. Keep TodoWrite synchronized.';
      case 3:
        return '🚨 Progress reported. Ensure all steps are properly tracked.';
      case 4:
        return '❌ Progress reported but compliance issues detected.';
      default:
        return 'Progress reported. Continue work.';
    }
  }

  /**
   * Get guidance for mark_complete tool
   */
  private getMarkCompleteGuidance(escalationLevel: number): string {
    switch (escalationLevel) {
      case 1:
        return 'Great work! Consider archiving and checking for new tasks.';
      case 2:
        return 'Task complete. Archive and improve your workflow compliance.';
      case 3:
        return 'Task complete but compliance is low. Review protocol.';
      case 4:
        return 'Task complete. Critical compliance issues need addressing.';
      default:
        return 'Task marked complete.';
    }
  }

  /**
   * Get default guidance for unknown tools
   */
  private getDefaultGuidance(escalationLevel: number): string {
    switch (escalationLevel) {
      case 1:
        return 'Continue following MCP protocol.';
      case 2:
        return '⚠️ Remember to follow complete MCP protocol.';
      case 3:
        return '🚨 Critical: Protocol compliance required.';
      case 4:
        return '❌ Blocked: Compliance violations detected.';
      default:
        return 'Follow MCP protocol.';
    }
  }

  /**
   * Clean up stale records older than 30 days
   */
  async cleanupStaleRecords(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const [agent, record] of this.records.entries()) {
        if (record.lastActivity < thirtyDaysAgo) {
          const recordPath = path.join(this.complianceDir, `${agent}.json`);
          await fs.remove(recordPath);
          this.records.delete(agent);
        }
      }
    } catch (error) {
      // Error cleaning up stale records - silently continue
      void error; // Acknowledge but don't log
    }
  }
}