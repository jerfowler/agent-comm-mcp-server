/**
 * TaskContextManager - Core abstraction layer for MCP Server
 * Provides pure context-based API without exposing file system operations
 */

import * as fs from '../utils/fs-extra-safe.js';
import path from 'path';
import { ConnectionManager, Connection } from './ConnectionManager.js';
import { EventLogger } from '../logging/EventLogger.js';
import { ProgressMarkers, AgentCommError, AgentOwnershipError, TaskState, MultiTaskState } from '../types.js';
import { LockManager } from '../utils/lock-manager.js';

export interface TaskContext {
  title: string;
  objective: string;
  requirements: string[];
  currentAgent: string;
  protocolInstructions: string;
  agentCapabilities: string[];
  additionalContext?: string;
  currentProgress?: {
    completed: number;
    inProgress: number;
    pending: number;
    blocked?: number;
  };
}

export interface TaskSummary {
  taskId: string;
  title: string;
  status: 'new' | 'in_progress' | 'completed' | 'error';
  progress?: {
    completed: number;
    inProgress: number;
    pending: number;
  };
}

export interface PlanSubmissionResult {
  success: boolean;
  message: string;
  stepsIdentified: number;
  phases: number;
  initialProgress?: {
    completed: number;
    inProgress: number;
    pending: number;
    blocked: number;
  };
  progressMarkers?: ProgressMarkers;
}

export interface ProgressUpdate {
  step: number;
  status: 'COMPLETE' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED';
  description: string;
  timeSpent?: number;
  estimatedTimeRemaining?: number;
  blocker?: string;
}

export interface ProgressReportResult {
  success: boolean;
  updatedSteps: number;
  summary: {
    completed: number;
    inProgress: number;
    pending: number;
    blocked: number;
  };
  timeTracking?: {
    totalTimeSpent: number;
    estimatedRemaining: number;
  };
}

export interface CompletionResult {
  success: boolean;
  status: 'DONE' | 'ERROR';
  summary: string;
  completedAt: Date;
  isError?: boolean;
  recommendations?: string[];
}

export interface OwnershipValidationResult {
  valid: boolean;
  agent: string;
  taskId: string;
  taskPath: string;
}

export interface TaskContextManagerConfig {
  commDir: string;
  connectionManager: ConnectionManager;
  eventLogger: EventLogger;
}

/**
 * TaskContextManager provides complete file system abstraction
 * Agents never see file paths, folder names, or file extensions
 */
export class TaskContextManager {
  private config: TaskContextManagerConfig;
  private currentTaskMap = new Map<string, string>(); // agent -> current taskId
  private protocolInstructions = `## MCP Protocol

Use these context-based operations for all task management:

**Core Operations:**
- \`check_assigned_tasks()\` - Returns task IDs and titles only
- \`start_task(taskId)\` - Activates task, returns context
- \`get_task_context(taskId?)\` - Pure context, no file paths
- \`submit_plan(content)\` - Content only, handles planning internally
- \`report_progress(updates)\` - Updates progress markers only
- \`mark_complete(status, summary)\` - Handles completion internally
- \`archive_completed_tasks()\` - Batch cleanup operation

**Important Notes:**
- Never reference file paths or extensions
- Work with task IDs and content only
- All file operations are handled automatically
- Focus on task content and progress, not file management

## Todo System Integration

**CRITICAL: Use Todo System with MCP Operations**
1. **Start every task** by creating comprehensive todos from requirements
2. **Include MCP operations** as explicit todo items (submit_plan, report_progress, mark_complete)
3. **Update todos IMMEDIATELY** after completing each step - never skip this
4. **Only ONE todo** should be 'in_progress' at any time
5. **Verify all todos complete** before calling mark_complete()

**Standard Todo Flow:**
\`\`\`
// Task start
TodoWrite([
  { content: "Parse task requirements", status: "in_progress", activeForm: "Parsing requirements" },
  { content: "Submit plan using submit_plan()", status: "pending", activeForm: "Submitting plan" },
  { content: "Implement requirements", status: "pending", activeForm: "Implementing" },
  { content: "Report progress using report_progress()", status: "pending", activeForm: "Reporting progress" },
  { content: "Mark complete using mark_complete()", status: "pending", activeForm: "Marking complete" }
]);

// Update as you progress - CRITICAL
TodoWrite([...updatedTodos]); // Mark completed items, move next to in_progress
\`\`\`

**Todo Anti-Patterns to Avoid:**
- ❌ Starting work without creating todos first
- ❌ Forgetting to update todos after completing steps
- ❌ Having multiple items 'in_progress' simultaneously
- ❌ Creating vague, non-actionable todo items
- ❌ Skipping MCP operations in todo lists

## TodoWrite Integration with MCP Tasks

**CRITICAL: Sync TodoWrite changes to PLAN.md checkboxes**
When you use TodoWrite to update todos, remember to sync these changes to your active task's PLAN.md checkboxes using the sync_todo_checkboxes tool.

**Automatic Sync Process:**
1. **Hook Detection**: The TodoWrite PostToolUse hook automatically detects todo changes
2. **Sync Reminder**: Hook displays a reminder message to sync with agent-comm MCP
3. **Manual Sync**: Use \`sync_todo_checkboxes()\` to update PLAN.md checkboxes

**Three-State Checkbox Support:**
- \`[ ]\` (pending) ← maps to TodoWrite "pending" status
- \`[~]\` (in_progress) ← maps to TodoWrite "in_progress" status  
- \`[x]\` (completed) ← maps to TodoWrite "completed" status

**Sync Commands:**
\`\`\`
// Auto-detect most recent task (default)
mcp__agent_comm__sync_todo_checkboxes(agent="current-agent", todoUpdates=[
  { title: "Parse task requirements", status: "completed" },
  { title: "Submit plan using submit_plan()", status: "in_progress" },
  { title: "Implement requirements", status: "pending" }
]);

// Target specific task (when working with multiple tasks)
mcp__agent_comm__sync_todo_checkboxes(agent="current-agent", taskId="specific-task-id", todoUpdates=[...]);
\`\`\`

**Integration Workflow:**
1. Update todos with TodoWrite (triggers hook reminder)
2. Use sync_todo_checkboxes tool to update PLAN.md
3. Continue with MCP task operations (report_progress, mark_complete)`;

  constructor(config: TaskContextManagerConfig) {
    this.config = config;
  }

  /**
   * Validate that an agent owns a specific task
   * @throws {AgentOwnershipError} if agent doesn't own the task
   */
  async validateAgentOwnership(taskId: string, agent: string): Promise<OwnershipValidationResult> {
    const startTime = Date.now();
    
    try {
      // Reject default-agent immediately
      if (agent === 'default-agent') {
        throw new AgentOwnershipError(
          "Invalid agent specification: 'default-agent' is not allowed. Please specify the actual agent name.",
          agent,
          taskId
        );
      }

      // Require explicit agent specification
      if (!agent || agent.trim() === '') {
        throw new AgentOwnershipError(
          "Agent name is required. Please specify the agent performing this operation.",
          agent || '',
          taskId
        );
      }

      const taskPath = path.join(this.config.commDir, agent, taskId);
      const initPath = path.join(taskPath, 'INIT.md');

      // Check if task exists in agent's directory
      if (!(await fs.pathExists(taskPath))) {
        // Try to find the actual owner for better error message
        let actualOwner: string | undefined;
        
        if (await fs.pathExists(this.config.commDir)) {
          const agents = await fs.readdir(this.config.commDir);
          for (const otherAgent of agents) {
            const otherTaskPath = path.join(this.config.commDir, otherAgent, taskId);
            if (await fs.pathExists(otherTaskPath)) {
              const stat = await fs.stat(otherTaskPath);
              if (stat.isDirectory()) {
                actualOwner = otherAgent;
                break;
              }
            }
          }
        }

        const message = actualOwner
          ? `Agent '${agent}' does not own task '${taskId}'. This task belongs to '${actualOwner}'.`
          : `Task '${taskId}' not found for agent '${agent}'.`;

        await this.config.eventLogger.logOperation({
          timestamp: new Date(),
          operation: 'validate_ownership',
          agent,
          taskId,
          success: false,
          duration: Date.now() - startTime,
          metadata: {
            validationResult: 'unauthorized',
            securityFlag: 'ownership_violation',
            actualOwner
          },
          error: {
            message,
            name: 'AgentOwnershipError'
          }
        });

        throw new AgentOwnershipError(message, agent, taskId, actualOwner);
      }

      // Verify it's a valid task directory with INIT.md
      if (!(await fs.pathExists(initPath))) {
        const message = `Task '${taskId}' exists but is not properly initialized for agent '${agent}'.`;
        
        await this.config.eventLogger.logOperation({
          timestamp: new Date(),
          operation: 'validate_ownership',
          agent,
          taskId,
          success: false,
          duration: Date.now() - startTime,
          metadata: {
            validationResult: 'invalid_task',
            securityFlag: 'incomplete_task'
          },
          error: {
            message,
            name: 'AgentOwnershipError'
          }
        });

        throw new AgentOwnershipError(message, agent, taskId);
      }

      // Ownership is valid
      const result: OwnershipValidationResult = {
        valid: true,
        agent,
        taskId,
        taskPath
      };

      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'validate_ownership',
        agent,
        taskId,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          taskPath,
          validationResult: 'authorized'
        }
      });

      return result;
    } catch (error) {
      // Re-throw if it's already an AgentOwnershipError
      if (error instanceof AgentOwnershipError) {
        throw error;
      }

      // Log unexpected errors
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'validate_ownership',
        agent,
        taskId,
        success: false,
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError'
        }
      });

      throw error;
    }
  }

  /**
   * Get list of assigned tasks for the connected agent
   * Returns task IDs and titles without exposing file paths
   */
  async checkAssignedTasks(connection: Connection): Promise<TaskSummary[]> {
    const startTime = Date.now();
    
    try {
      const agentDir = path.join(this.config.commDir, connection.agent);
      
      if (!(await fs.pathExists(agentDir))) {
        await this.config.eventLogger.logOperation({
          timestamp: new Date(),
          operation: 'check_assigned_tasks',
          agent: connection.agent,
          success: true,
          duration: Date.now() - startTime,
          metadata: { tasksFound: 0, newTasks: 0, inProgress: 0 }
        });
        
        return [];
      }

      const taskDirs = await fs.readdir(agentDir);
      const tasks: TaskSummary[] = [];

      for (const taskDir of taskDirs) {
        const taskPath = path.join(agentDir, taskDir);
        const stat = await fs.stat(taskPath);
        
        if (!stat.isDirectory()) continue;

        const initPath = path.join(taskPath, 'INIT.md');
        if (!(await fs.pathExists(initPath))) continue;

        const initContent = await fs.readFile(initPath, 'utf8');
        const title = this.extractTitle(initContent);
        const status = await this.determineTaskStatus(taskPath);
        const progress = await this.extractProgress(taskPath);

        const taskSummary: TaskSummary = {
          taskId: taskDir,
          title,
          status
        };
        
        if (progress) {
          taskSummary.progress = progress;
        }
        
        tasks.push(taskSummary);
      }

      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'check_assigned_tasks',
        agent: connection.agent,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          tasksFound: tasks.length,
          newTasks: tasks.filter(t => t.status === 'new').length,
          inProgress: tasks.filter(t => t.status === 'in_progress').length
        }
      });

      return tasks;
    } catch (error) {
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'check_assigned_tasks',
        agent: connection.agent,
        success: false,
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError',
          ...(error instanceof Error && error.stack && { stack: error.stack })
        }
      });
      throw error;
    }
  }

  /**
   * Start a task and return pure context without file paths
   */
  async startTask(taskId: string, connection: Connection): Promise<TaskContext> {
    const startTime = Date.now();

    try {
      // Validate agent specification first
      if (connection.agent === 'default-agent') {
        throw new AgentOwnershipError(
          "Invalid agent specification: 'default-agent' is not allowed. Please specify the actual agent name.",
          connection.agent,
          taskId
        );
      }

      if (!connection.agent || connection.agent.trim() === '') {
        throw new AgentOwnershipError(
          "Agent name is required. Please specify the agent performing this operation.",
          connection.agent || '',
          taskId
        );
      }

      // Validate ownership
      await this.validateAgentOwnership(taskId, connection.agent);

      const taskPath = path.join(this.config.commDir, connection.agent, taskId);
      const initPath = path.join(taskPath, 'INIT.md');

      const initContent = await fs.readFile(initPath, 'utf8');
      const context = this.parseTaskContext(initContent, connection.agent);

      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'start_task',
        agent: connection.agent,
        taskId,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          title: context.title,
          objective: context.objective,
          requirementsCount: context.requirements.length,
          contextSize: JSON.stringify(context).length
        }
      });

      return context;
    } catch (error) {
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'start_task',
        agent: connection.agent,
        taskId,
        success: false,
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError',
          ...(error instanceof Error && error.stack && { stack: error.stack })
        }
      });
      throw error;
    }
  }

  /**
   * Get task context without exposing file operations
   */
  async getTaskContext(taskId: string, connection: Connection): Promise<TaskContext> {
    if (!taskId) {
      return {
        title: 'No Active Task',
        objective: '',
        requirements: [],
        currentAgent: connection.agent,
        protocolInstructions: this.protocolInstructions,
        agentCapabilities: this.getAgentCapabilities(connection.agent),
        additionalContext: 'No active task. Use check_assigned_tasks() to find available tasks.'
      };
    }

    try {
      return await this.startTask(taskId, connection);
    } catch (error) {
      // Return graceful error context instead of throwing
      return {
        title: 'Task Not Found',
        objective: '',
        requirements: [],
        currentAgent: connection.agent,
        protocolInstructions: this.protocolInstructions,
        agentCapabilities: this.getAgentCapabilities(connection.agent),
        additionalContext: `Task "${taskId}" not found or not accessible. Use check_assigned_tasks() to see available tasks.`
      };
    }
  }

  /**
   * Submit plan content without exposing file creation
   */
  async submitPlan(content: string, connection: Connection): Promise<PlanSubmissionResult> {
    const startTime = Date.now();

    try {
      // Validate agent specification first
      if (connection.agent === 'default-agent') {
        throw new AgentOwnershipError(
          "Invalid agent specification: 'default-agent' is not allowed. Please specify the actual agent name.",
          connection.agent,
          ''
        );
      }

      if (!connection.agent || connection.agent.trim() === '') {
        throw new AgentOwnershipError(
          "Agent name is required. Please specify the agent performing this operation.",
          connection.agent || '',
          ''
        );
      }

      // Validate plan format
      if (!this.isValidPlanFormat(content)) {
        throw new Error('Invalid plan format: Plan must contain clear steps with progress markers');
      }

      const steps = this.extractPlanSteps(content);
      const phases = this.extractPhases(content);
      const initialProgress = this.analyzePlanProgress(content);
      const progressMarkers = this.extractProgressMarkers(content);

      // Find task directory - either from taskId or use active task
      const agentDir = path.join(this.config.commDir, connection.agent);
      let activeTaskDir = '';
      
      // Check if taskId is provided in connection metadata
      let taskId = connection.metadata['taskId'] as string | undefined;
      
      // If no taskId provided, check for current task
      if (!taskId) {
        const currentTask = this.getCurrentTask(connection);
        if (currentTask) {
          taskId = currentTask;
        }
      }
      
      if (taskId) {
        // Validate ownership for specified taskId
        await this.validateAgentOwnership(taskId, connection.agent);
        activeTaskDir = taskId;
      } else if (await fs.pathExists(agentDir)) {
        // No taskId or current task - use most recently modified task (backward compatibility)
        const taskDirs = await fs.readdir(agentDir);
        
        // Find the most recently modified task directory
        let latestTime = 0;
        
        for (const taskDir of taskDirs) {
          const taskPath = path.join(agentDir, taskDir);
          const stat = await fs.stat(taskPath);
          if (stat.isDirectory() && stat.mtime.getTime() > latestTime) {
            latestTime = stat.mtime.getTime();
            activeTaskDir = taskDir;
          }
        }
        
        // Validate ownership for the most recent task (backward compatibility)
        if (activeTaskDir) {
          await this.validateAgentOwnership(activeTaskDir, connection.agent);
        }
      }

      if (activeTaskDir) {
        const planPath = path.join(agentDir, activeTaskDir, 'PLAN.md');
        await fs.writeFile(planPath, content);
      }

      const result: PlanSubmissionResult = {
        success: true,
        message: 'Plan submitted successfully',
        stepsIdentified: steps.length,
        phases: phases.length,
        initialProgress,
        progressMarkers
      };

      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'submit_plan',
        agent: connection.agent,
        taskId: activeTaskDir,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          planSize: content.length,
          stepsIdentified: steps.length,
          phases: phases.length,
          complexity: steps.length > 10 ? 'high' : steps.length > 5 ? 'medium' : 'low'
        }
      });

      return result;
    } catch (error) {
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'submit_plan',
        agent: connection.agent,
        success: false,
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError'
        }
      });
      throw error;
    }
  }

  /**
   * Report progress updates without file exposure
   */
  async reportProgress(updates: ProgressUpdate[], connection: Connection): Promise<ProgressReportResult> {
    const startTime = Date.now();

    try {
      // Validate agent specification first
      if (connection.agent === 'default-agent') {
        throw new AgentOwnershipError(
          "Invalid agent specification: 'default-agent' is not allowed. Please specify the actual agent name.",
          connection.agent,
          ''
        );
      }

      if (!connection.agent || connection.agent.trim() === '') {
        throw new AgentOwnershipError(
          "Agent name is required. Please specify the agent performing this operation.",
          connection.agent || '',
          ''
        );
      }

      // Updates are already validated at the tool layer

      // Find task directory - either from taskId or use active task
      const agentDir = path.join(this.config.commDir, connection.agent);
      let activeTaskDir: string | null = null;
      
      // Check if taskId is provided in connection metadata
      let taskId = connection.metadata['taskId'] as string | undefined;
      
      // If no taskId provided, check for current task
      if (!taskId) {
        const currentTask = this.getCurrentTask(connection);
        if (currentTask) {
          taskId = currentTask;
        }
      }
      
      if (taskId) {
        // Validate ownership for specified taskId
        await this.validateAgentOwnership(taskId, connection.agent);
        activeTaskDir = taskId;
      } else {
        // No taskId or current task - find active task (backward compatibility)
        activeTaskDir = await this.findActiveTaskDir(agentDir);
        
        // Validate ownership for the found task
        if (activeTaskDir) {
          await this.validateAgentOwnership(activeTaskDir, connection.agent);
        }
      }
      
      if (activeTaskDir) {
        const lockManager = new LockManager();
        const taskPath = path.join(agentDir, activeTaskDir);
        
        // Check if task is locked by another process
        const lockStatus = await lockManager.checkLock(taskPath);
        if (lockStatus.isLocked && !lockStatus.isStale) {
          throw new AgentCommError(
            `Task is currently locked by ${lockStatus.lockInfo?.tool} (PID: ${lockStatus.lockInfo?.pid}, Lock ID: ${lockStatus.lockInfo?.lockId})`,
            'TASK_LOCKED'
          );
        }
        
        // Acquire lock for this operation
        const lockResult = await lockManager.acquireLock(taskPath, 'report-progress');
        if (!lockResult.acquired) {
          throw new AgentCommError(
            `Failed to acquire lock: ${lockResult.reason}`,
            'LOCK_FAILED'
          );
        }
        
        try {
          return await this.performProgressUpdate(updates, connection, agentDir, activeTaskDir, startTime);
        } finally {
          // Always release the lock, even if an error occurred
          if (lockResult.lockId) {
            await lockManager.releaseLock(taskPath, lockResult.lockId);
          }
        }
      } else {
        // No active task found, proceed without lock
        return await this.performProgressUpdate(updates, connection, agentDir, null, startTime);
      }
    } catch (error) {
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'report_progress',
        agent: connection.agent,
        success: false,
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError'
        }
      });
      throw error;
    }
  }

  /**
   * Perform the actual progress update logic (extracted for lock management)
   */
  private async performProgressUpdate(
    updates: ProgressUpdate[], 
    connection: Connection, 
    agentDir: string, 
    activeTaskDir: string | null,
    startTime: number
  ): Promise<ProgressReportResult> {
    const summary = {
      completed: updates.filter(u => u.status === 'COMPLETE').length,
      inProgress: updates.filter(u => u.status === 'IN_PROGRESS').length,
      pending: updates.filter(u => u.status === 'PENDING').length,
      blocked: updates.filter(u => u.status === 'BLOCKED').length
    };

    const totalTimeSpent = updates.reduce((sum, u) => sum + (u.timeSpent ?? 0), 0);
    const estimatedRemaining = updates.reduce((sum, u) => sum + (u.estimatedTimeRemaining ?? 0), 0);

    const result: ProgressReportResult = {
      success: true,
      updatedSteps: updates.length,
      summary
    };
    
    if (totalTimeSpent > 0) {
      result.timeTracking = {
        totalTimeSpent,
        estimatedRemaining
      };
    }

    // Update PLAN.md file with checkbox changes
    if (activeTaskDir) {
      await this.updatePlanFileWithProgress(agentDir, activeTaskDir, updates);
    }

    await this.config.eventLogger.logOperation({
      timestamp: new Date(),
      operation: 'report_progress',
      agent: connection.agent,
      success: true,
      duration: Date.now() - startTime,
      metadata: {
        stepsUpdated: updates.length,
        completed: summary.completed,
        inProgress: summary.inProgress,
        blocked: summary.blocked,
        totalTimeSpent,
        estimatedRemaining
      }
    });

    return result;
  }

  /**
   * Mark task complete without file path exposure
   */
  async markComplete(status: 'DONE' | 'ERROR', summary: string, connection: Connection): Promise<CompletionResult> {
    const startTime = Date.now();

    try {
      // Validate agent specification first
      if (connection.agent === 'default-agent') {
        throw new AgentOwnershipError(
          "Invalid agent specification: 'default-agent' is not allowed. Please specify the actual agent name.",
          connection.agent,
          ''
        );
      }

      if (!connection.agent || connection.agent.trim() === '') {
        throw new AgentOwnershipError(
          "Agent name is required. Please specify the agent performing this operation.",
          connection.agent || '',
          ''
        );
      }

      if (!['DONE', 'ERROR'].includes(status)) {
        throw new Error('Invalid completion status: Must be DONE or ERROR');
      }

      const isError = status === 'ERROR';
      const recommendations = isError ? this.extractRecommendations(summary) : undefined;

      // Find task directory - either from taskId or use active task
      const agentDir = path.join(this.config.commDir, connection.agent);
      let activeTaskDir = '';
      
      // Check if taskId is provided in connection metadata
      let taskId = connection.metadata['taskId'] as string | undefined;
      
      // If no taskId provided, check for current task
      if (!taskId) {
        const currentTask = this.getCurrentTask(connection);
        if (currentTask) {
          taskId = currentTask;
        }
      }
      
      if (taskId) {
        // Validate ownership for specified taskId
        await this.validateAgentOwnership(taskId, connection.agent);
        activeTaskDir = taskId;
      } else if (await fs.pathExists(agentDir)) {
        // No taskId or current task - use most recently modified task (backward compatibility)
        const taskDirs = await fs.readdir(agentDir);
        let latestTime = 0;
        
        for (const taskDir of taskDirs) {
          const taskPath = path.join(agentDir, taskDir);
          const stat = await fs.stat(taskPath);
          if (stat.isDirectory() && stat.mtime.getTime() > latestTime) {
            latestTime = stat.mtime.getTime();
            activeTaskDir = taskDir;
          }
        }
        
        // Validate ownership for the most recent task (backward compatibility)
        if (activeTaskDir) {
          await this.validateAgentOwnership(activeTaskDir, connection.agent);
        }
      }

      if (activeTaskDir) {
        const completionPath = path.join(agentDir, activeTaskDir, `${status}.md`);
        await fs.writeFile(completionPath, summary);
      }

      const result: CompletionResult = {
        success: true,
        status,
        summary,
        completedAt: new Date(),
        isError
      };
      
      if (recommendations && recommendations.length > 0) {
        result.recommendations = recommendations;
      }

      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'mark_complete',
        agent: connection.agent,
        taskId: activeTaskDir,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          completionStatus: status,
          summarySize: summary.length,
          achievements: isError ? 0 : this.extractAchievements(summary).length,
          nextSteps: this.extractNextSteps(summary).length
        }
      });

      return result;
    } catch (error) {
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'mark_complete',
        agent: connection.agent,
        success: false,
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError'
        }
      });
      throw error;
    }
  }

  // Private helper methods

  private extractTitle(content: string): string {
    // Try "# Task: Title" format first
    let titleMatch = content.match(/^# Task: (.+)$/m);
    if (titleMatch) {
      return titleMatch[1];
    }
    
    // Fall back to any first heading "# Title"
    titleMatch = content.match(/^# (.+)$/m);
    if (titleMatch) {
      return titleMatch[1];
    }
    
    return 'Untitled Task';
  }

  private async determineTaskStatus(taskPath: string): Promise<'new' | 'in_progress' | 'completed' | 'error'> {
    const donePath = path.join(taskPath, 'DONE.md');
    const errorPath = path.join(taskPath, 'ERROR.md');
    const planPath = path.join(taskPath, 'PLAN.md');

    if (await fs.pathExists(donePath)) return 'completed';
    if (await fs.pathExists(errorPath)) return 'error';
    if (await fs.pathExists(planPath)) return 'in_progress';
    return 'new';
  }

  private async extractProgress(taskPath: string): Promise<{ completed: number; inProgress: number; pending: number } | undefined> {
    const planPath = path.join(taskPath, 'PLAN.md');
    
    if (!(await fs.pathExists(planPath))) return undefined;

    const planContent = await fs.readFile(planPath, 'utf8');
    return this.analyzePlanProgress(planContent);
  }

  private parseTaskContext(content: string, agent: string): TaskContext {
    const title = this.extractTitle(content);
    const objective = this.extractObjective(content);
    const requirements = this.extractRequirements(content);
    const additionalContext = this.extractAdditionalContext(content);

    return {
      title,
      objective,
      requirements,
      currentAgent: agent,
      protocolInstructions: this.protocolInstructions,
      agentCapabilities: this.getAgentCapabilities(agent),
      additionalContext
    };
  }

  private extractObjective(content: string): string {
    const match = content.match(/## Objective\s*\n(.*?)(?=\n##|\n\n|$)/s);
    return match ? match[1].trim() : '';
  }

  private extractRequirements(content: string): string[] {
    const match = content.match(/## Requirements\s*\n(.*?)(?=\n##|\n\n|$)/s);
    if (!match) return [];

    const reqText = match[1].trim();
    return reqText.split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.substring(2).trim());
  }

  private extractAdditionalContext(content: string): string {
    const match = content.match(/## Additional Context\s*\n(.*?)(?=\n##|$)/s);
    return match ? match[1].trim() : '';
  }

  private getAgentCapabilities(agent: string): string[] {
    const capabilities: Record<string, string[]> = {
      'senior-frontend-engineer': [
        'React/TypeScript development',
        'Modern frontend patterns',
        'UI/UX implementation',
        'Performance optimization'
      ],
      'senior-backend-engineer': [
        'Go microservices',
        'API design and implementation',
        'Database integration',
        'Performance optimization'
      ],
      'senior-system-architect': [
        'System design and architecture',
        'Technology stack decisions',
        'Cross-cutting concerns',
        'End-to-end integration'
      ],
      'senior-ai-ml-engineer': [
        'Machine learning models',
        'AI system integration',
        'Data processing pipelines',
        'Model deployment and serving'
      ]
    };

    return capabilities[agent] || ['General development capabilities'];
  }

  private isValidPlanFormat(content: string): boolean {
    // Check for basic plan structure - must have a header and some content
    const hasHeader = content.includes('# ');
    const hasSteps = content.length > 50; // Basic content check
    
    // Allow plans without progress markers initially (they can be added later)
    return hasHeader && hasSteps;
  }

  private extractPlanSteps(content: string): string[] {
    // Look for checkbox format: - [ ] and - [x]
    const checkboxMatches = content.match(/^- \[[x ]\] /gm);
    
    // Legacy support for old status format
    const statusMatches = content.match(/\[(?:PENDING|✓ COMPLETE|→ IN PROGRESS|BLOCKED)\]/g);
    
    // Return checkbox matches if found, otherwise legacy status matches
    return checkboxMatches ?? statusMatches ?? [];
  }

  private extractPhases(content: string): string[] {
    // Look for numbered phases or major plan sections
    const phaseMatches = content.match(/^## (?:Phase|Step) \d+/gm) ?? [];
    const sectionMatches = content.match(/^## [A-Z][^#\n]+/gm) ?? [];
    
    // Return numbered phases if found, otherwise count major sections
    return phaseMatches.length > 0 ? phaseMatches : sectionMatches;
  }

  private analyzePlanProgress(content: string): { completed: number; inProgress: number; pending: number; blocked: number } {
    // Parse standard checkbox format: - [x] **Title** and - [ ] **Title**
    const checkedBoxes = (content.match(/^- \[x\] /gm) ?? []).length;
    const uncheckedBoxes = (content.match(/^- \[ \] /gm) ?? []).length;
    
    return { 
      completed: checkedBoxes, 
      inProgress: 0, // Track via progress updates, not static parsing
      pending: uncheckedBoxes, 
      blocked: 0 // Track via progress updates, not static parsing
    };
  }

  private extractProgressMarkers(content: string): ProgressMarkers {
    const completed: string[] = [];
    const pending: string[] = [];
    
    // Match checkbox lines and extract titles
    const lines = content.split('\n');
    for (const line of lines) {
      const checkedMatch = line.match(/^- \[x\] \*\*(.*?)\*\*/);
      const uncheckedMatch = line.match(/^- \[ \] \*\*(.*?)\*\*/);
      
      if (checkedMatch) {
        completed.push(checkedMatch[1].trim());
      } else if (uncheckedMatch) {
        pending.push(uncheckedMatch[1].trim());
      }
    }
    
    return { completed, pending };
  }

  private async findActiveTaskDir(agentDir: string): Promise<string | null> {
    if (!(await fs.pathExists(agentDir))) return null;
    
    const taskDirs = await fs.readdir(agentDir);
    let latestTime = 0;
    let activeTaskDir = '';
    
    for (const taskDir of taskDirs) {
      const taskPath = path.join(agentDir, taskDir);
      try {
        const stat = await fs.stat(taskPath);
        
        // Check if it's a directory using either method or stat mode
        const isDirectory = typeof stat.isDirectory === 'function' 
          ? stat.isDirectory() 
          : stat.mode ? (stat.mode & 0o170000) === 0o040000 : false;
          
        // Check if mtime exists and is valid
        const mtime = stat.mtime || (stat.mtimeMs ? new Date(stat.mtimeMs) : new Date(0));
        const mtimeValue = typeof mtime.getTime === 'function' ? mtime.getTime() : 0;
        
        if (mtimeValue > latestTime && isDirectory) {
          latestTime = mtimeValue;
          activeTaskDir = taskDir;
        }
      } catch (error) {
        // Skip if we can't stat the path
        continue;
      }
    }
    
    return activeTaskDir || null;
  }

  private async updatePlanFileWithProgress(agentDir: string, taskId: string, updates: ProgressUpdate[]): Promise<void> {
    const planPath = path.join(agentDir, taskId, 'PLAN.md');
    if (!(await fs.pathExists(planPath))) return;
    
    let planContent = await fs.readFile(planPath, 'utf8');
    
    for (const update of updates) {
      if (update.status === 'COMPLETE') {
        // Convert unchecked to checked for completed steps
        // Find checkbox lines and update based on step number or title matching
        const lines = planContent.split('\n');
        let stepCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^- \[[ x]\] \*\*.*?\*\*/)) {
            stepCount++;
            if (stepCount === update.step) {
              lines[i] = lines[i].replace(/^- \[ \]/, '- [x]');
              break;
            }
          }
        }
        
        planContent = lines.join('\n');
      }
    }
    
    await fs.writeFile(planPath, planContent);
  }

  private extractRecommendations(content: string): string[] {
    const match = content.match(/## Recommendations\s*\n(.*?)(?=\n##|$)/s);
    if (!match) return [];

    return match[1].trim().split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.substring(2).trim());
  }

  private extractAchievements(content: string): string[] {
    const match = content.match(/## Achievements\s*\n(.*?)(?=\n##|$)/s);
    if (!match) return [];

    return match[1].trim().split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.substring(2).trim());
  }

  private extractNextSteps(content: string): string[] {
    const match = content.match(/## Next Steps\s*\n(.*?)(?=\n##|$)/s);
    if (!match) return [];

    return match[1].trim().split('\n')
      .filter(line => line.startsWith('- '))
      .map(line => line.substring(2).trim());
  }

  // ========================
  // Multi-Task Workflow Support (Issue #25)
  // ========================

  /**
   * Set the current task for an agent
   * @param taskId - The task to set as current
   * @param connection - The agent connection
   * @returns true if successful
   */
  async setCurrentTask(taskId: string, connection: Connection): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Validate ownership first
      await this.validateAgentOwnership(taskId, connection.agent);
      
      // Set current task for the agent
      this.currentTaskMap.set(connection.agent, taskId);
      
      // Store in connection metadata for persistence
      connection.metadata['currentTask'] = taskId;
      
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'set_current_task',
        agent: connection.agent,
        taskId,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          previousTask: this.currentTaskMap.get(connection.agent),
          newTask: taskId
        }
      });
      
      return true;
    } catch (error) {
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'set_current_task',
        agent: connection.agent,
        taskId,
        success: false,
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError'
        }
      });
      throw error;
    }
  }

  /**
   * Get the current task for an agent
   * @param connection - The agent connection
   * @returns The current task ID or null if not set
   */
  getCurrentTask(connection: Connection): string | null {
    // Check connection metadata first (persistent across operations)
    const metadataTask = connection.metadata['currentTask'] as string | undefined;
    if (metadataTask) {
      // Sync with internal map
      this.currentTaskMap.set(connection.agent, metadataTask);
      return metadataTask;
    }
    
    // Check internal map
    return this.currentTaskMap.get(connection.agent) ?? null;
  }

  /**
   * Get multi-task state for an agent
   * @param connection - The agent connection
   * @returns Complete multi-task state information
   */
  async getMultiTaskState(connection: Connection): Promise<MultiTaskState> {
    const startTime = Date.now();
    
    try {
      const agentDir = path.join(this.config.commDir, connection.agent);
      const tasks: TaskState[] = [];
      const activeTasks: TaskState[] = [];
      
      if (await fs.pathExists(agentDir)) {
        const taskDirs = await fs.readdir(agentDir);
        
        for (const taskDir of taskDirs) {
          const taskPath = path.join(agentDir, taskDir);
          const stat = await fs.stat(taskPath);
          
          if (!stat.isDirectory()) continue;
          
          const initPath = path.join(taskPath, 'INIT.md');
          if (!(await fs.pathExists(initPath))) continue;
          
          const initContent = await fs.readFile(initPath, 'utf8');
          const title = this.extractTitle(initContent);
          const status = await this.determineTaskStatus(taskPath);
          const progress = await this.extractProgress(taskPath);
          
          const taskState: TaskState = {
            taskId: taskDir,
            status,
            title,
            lastModified: stat.mtime,
            ...(progress && { progress })
          };
          
          tasks.push(taskState);
          
          // Task is active if it has a plan but is not completed
          if (status === 'in_progress') {
            activeTasks.push(taskState);
          }
        }
      }
      
      // Get current task
      const currentTask = this.getCurrentTask(connection);
      
      // Calculate task counts
      const taskCount = {
        total: tasks.length,
        new: tasks.filter(t => t.status === 'new').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        error: tasks.filter(t => t.status === 'error').length
      };
      
      const multiTaskState: MultiTaskState = {
        agent: connection.agent,
        tasks,
        activeTasks,
        currentTask,
        taskCount
      };
      
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'get_multi_task_state',
        agent: connection.agent,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          taskCount: taskCount.total,
          activeCount: activeTasks.length,
          currentTask
        }
      });
      
      return multiTaskState;
    } catch (error) {
      await this.config.eventLogger.logOperation({
        timestamp: new Date(),
        operation: 'get_multi_task_state',
        agent: connection.agent,
        success: false,
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError'
        }
      });
      throw error;
    }
  }

  /**
   * Enhanced submitPlan that respects current task when no taskId is provided
   */
  async submitPlanWithCurrentTask(content: string, connection: Connection): Promise<PlanSubmissionResult> {
    // If taskId is not in metadata, check for current task
    if (!connection.metadata['taskId']) {
      const currentTask = this.getCurrentTask(connection);
      if (currentTask) {
        connection.metadata['taskId'] = currentTask;
      }
    }
    
    // Delegate to existing submitPlan
    return this.submitPlan(content, connection);
  }

  /**
   * Enhanced reportProgress that respects current task when no taskId is provided
   */
  async reportProgressWithCurrentTask(updates: ProgressUpdate[], connection: Connection): Promise<ProgressReportResult> {
    // If taskId is not in metadata, check for current task
    if (!connection.metadata['taskId']) {
      const currentTask = this.getCurrentTask(connection);
      if (currentTask) {
        connection.metadata['taskId'] = currentTask;
      }
    }
    
    // Delegate to existing reportProgress
    return this.reportProgress(updates, connection);
  }

  /**
   * Enhanced markComplete that respects current task when no taskId is provided
   */
  async markCompleteWithCurrentTask(status: 'DONE' | 'ERROR', summary: string, connection: Connection): Promise<CompletionResult> {
    // If taskId is not in metadata, check for current task
    if (!connection.metadata['taskId']) {
      const currentTask = this.getCurrentTask(connection);
      if (currentTask) {
        connection.metadata['taskId'] = currentTask;
      }
    }
    
    // Delegate to existing markComplete
    return this.markComplete(status, summary, connection);
  }
}