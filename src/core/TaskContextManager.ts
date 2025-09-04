/**
 * TaskContextManager - Core abstraction layer for MCP Server
 * Provides pure context-based API without exposing file system operations
 */

import fs from 'fs-extra';
import path from 'path';
import { ConnectionManager, Connection } from './ConnectionManager.js';
import { EventLogger } from '../logging/EventLogger.js';

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
- ❌ Skipping MCP operations in todo lists`;

  constructor(config: TaskContextManagerConfig) {
    this.config = config;
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
      const taskPath = path.join(this.config.commDir, connection.agent, taskId);
      const initPath = path.join(taskPath, 'INIT.md');

      if (!(await fs.pathExists(initPath))) {
        throw new Error('Task not found or not accessible');
      }

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
      // Validate plan format
      if (!this.isValidPlanFormat(content)) {
        throw new Error('Invalid plan format: Plan must contain clear steps with progress markers');
      }

      const steps = this.extractPlanSteps(content);
      const phases = this.extractPhases(content);
      const initialProgress = this.analyzePlanProgress(content);

      // Find current active task for this agent
      const agentDir = path.join(this.config.commDir, connection.agent);
      let activeTaskDir = '';
      
      if (await fs.pathExists(agentDir)) {
        const taskDirs = await fs.readdir(agentDir);
        
        // For now, assume the most recently modified task directory
        let latestTime = 0;
        
        for (const taskDir of taskDirs) {
          const taskPath = path.join(agentDir, taskDir);
          const stat = await fs.stat(taskPath);
          if (stat.isDirectory() && stat.mtime.getTime() > latestTime) {
            latestTime = stat.mtime.getTime();
            activeTaskDir = taskDir;
          }
        }

        if (activeTaskDir) {
          const planPath = path.join(agentDir, activeTaskDir, 'PLAN.md');
          await fs.writeFile(planPath, content);
        }
      }

      const result: PlanSubmissionResult = {
        success: true,
        message: 'Plan submitted successfully',
        stepsIdentified: steps.length,
        phases: phases.length,
        initialProgress
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
      // Validate updates
      for (const update of updates) {
        if (!update.step || !update.status || !update.description) {
          throw new Error('Invalid step reference: Each update must have step, status, and description');
        }
      }

      const summary = {
        completed: updates.filter(u => u.status === 'COMPLETE').length,
        inProgress: updates.filter(u => u.status === 'IN_PROGRESS').length,
        pending: updates.filter(u => u.status === 'PENDING').length,
        blocked: updates.filter(u => u.status === 'BLOCKED').length
      };

      const totalTimeSpent = updates.reduce((sum, u) => sum + (u.timeSpent || 0), 0);
      const estimatedRemaining = updates.reduce((sum, u) => sum + (u.estimatedTimeRemaining || 0), 0);

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
   * Mark task complete without file path exposure
   */
  async markComplete(status: 'DONE' | 'ERROR', summary: string, connection: Connection): Promise<CompletionResult> {
    const startTime = Date.now();

    try {
      if (!['DONE', 'ERROR'].includes(status)) {
        throw new Error('Invalid completion status: Must be DONE or ERROR');
      }

      const isError = status === 'ERROR';
      const recommendations = isError ? this.extractRecommendations(summary) : undefined;

      // Find and update the active task
      const agentDir = path.join(this.config.commDir, connection.agent);
      let activeTaskDir = '';
      
      if (await fs.pathExists(agentDir)) {
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

        if (activeTaskDir) {
          const completionPath = path.join(agentDir, activeTaskDir, `${status}.md`);
          await fs.writeFile(completionPath, summary);
        }
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
    const stepMatches = content.match(/\[(?:PENDING|✓ COMPLETE|→ IN PROGRESS|BLOCKED)\]/g);
    return stepMatches || [];
  }

  private extractPhases(content: string): string[] {
    // Look for numbered phases or major plan sections
    const phaseMatches = content.match(/^## (?:Phase|Step) \d+/gm) || [];
    const sectionMatches = content.match(/^## [A-Z][^#\n]+/gm) || [];
    
    // Return numbered phases if found, otherwise count major sections
    return phaseMatches.length > 0 ? phaseMatches : sectionMatches;
  }

  private analyzePlanProgress(content: string): { completed: number; inProgress: number; pending: number; blocked: number } {
    const completed = (content.match(/\[✓ COMPLETE\]/g) || []).length;
    const inProgress = (content.match(/\[→ IN PROGRESS\]/g) || []).length;
    const pending = (content.match(/\[PENDING\]/g) || []).length;
    const blocked = (content.match(/\[BLOCKED\]/g) || []).length;

    return { completed, inProgress, pending, blocked };
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
}