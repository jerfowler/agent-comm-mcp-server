/**
 * DynamicPromptEngine - Context-aware prompt content generation
 * Generates dynamic content based on current agent states and tasks
 */

import { ServerConfig, Task } from '../types.js';
import { getAgentTasks } from '../utils/task-manager.js';
import * as fs from '../utils/fs-extra-safe.js';
import * as path from 'path';
import type {
  PromptContent,
  PromptMessage,
  PromptName,
  TaskContext,
  ErrorType
} from './types.js';

/**
 * Engine for generating dynamic, context-aware prompt content
 */
export class DynamicPromptEngine {
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  /**
   * Generate prompt content based on prompt name and arguments
   */
  async generatePromptContent(promptName: PromptName, args: Record<string, unknown>): Promise<PromptContent> {
    // Validate arguments
    this.validateArguments(promptName, args);

    // Get task context if agent provided
    const agent = args['agent'] as string | undefined;
    const taskId = args['taskId'] as string | undefined;
    const context = agent ? await this.getTaskContext(agent, taskId) : null;

    // Generate content based on prompt type
    switch (promptName) {
      case 'task-workflow-guide':
        return this.generateTaskWorkflowGuide(context, args);
      
      case 'agent-validation-requirements':
        if (!agent) {
          throw new Error('Required argument missing: agent');
        }
        return this.generateAgentValidationGuide(agent);
      
      case 'flexible-task-operations':
        return this.generateFlexibleTaskGuide(context);
      
      case 'troubleshooting-common-errors': {
        const errorType = args['errorType'] as ErrorType | undefined;
        return this.generateTroubleshootingGuide(context, errorType);
      }
      
      case 'protocol-compliance-checklist':
        return this.generateComplianceChecklist(context);
      
      default:
        throw new Error(`Unknown prompt: ${String(promptName)}`);
    }
  }

  /**
   * Validate arguments for the prompt
   */
  private validateArguments(_promptName: PromptName, args: Record<string, unknown>): void {
    // Type validation
    if (args['agent'] !== undefined && typeof args['agent'] !== 'string') {
      throw new Error('Invalid argument type for agent: expected string');
    }
    if (args['taskId'] !== undefined && typeof args['taskId'] !== 'string') {
      throw new Error('Invalid argument type for taskId: expected string');
    }
    if (args['errorType'] !== undefined && typeof args['errorType'] !== 'string') {
      throw new Error('Invalid argument type for errorType: expected string');
    }
  }

  /**
   * Get task context for an agent
   */
  private async getTaskContext(agent: string, taskId?: string): Promise<TaskContext | null> {
    try {
      const tasks = await getAgentTasks(this.config, agent);
      
      const taskContexts = await Promise.all(tasks.map(async (task) => {
        const status = this.getTaskStatus(task);
        
        // Get progress if plan exists
        let progress: { step: string; status: 'complete' | 'pending' | 'in-progress' }[] = [];
        if (task.hasPlan) {
          progress = await this.extractProgressFromPlan(task);
        }
        
        return {
          name: task.name,
          status,
          hasInit: task.hasInit,
          hasPlan: task.hasPlan,
          hasDone: task.hasDone,
          hasError: task.hasError,
          progress
        };
      }));

      // Get current task details if taskId provided
      let currentTask: unknown = undefined;
      if (taskId) {
        const task = tasks.find(t => t.name === taskId);
        if (task) {
          currentTask = await this.getTaskDetails(task);
        }
      }

      const result: TaskContext = {
        agent,
        tasks: taskContexts
      };
      
      if (currentTask) {
        result.currentTask = currentTask as { id: string; content: string; planContent?: string; errorContent?: string; };
      }
      
      return result;
    } catch (error) {
      // Return null context on error - prompt will use generic content
      return null;
    }
  }

  /**
   * Get task status from flags
   */
  private getTaskStatus(task: Task): 'pending' | 'in-progress' | 'completed' | 'error' {
    if (task.hasError) return 'error';
    if (task.hasDone) return 'completed';
    if (task.hasPlan || task.hasInit) return 'in-progress';
    return 'pending';
  }

  /**
   * Extract progress from PLAN.md checkboxes
   */
  private async extractProgressFromPlan(task: Task): Promise<{ step: string; status: 'complete' | 'pending' | 'in-progress' }[]> {
    try {
      const planPath = path.join(task.path, 'PLAN.md');
      if (!await fs.pathExists(planPath)) {
        return [];
      }

      const content = await fs.readFile(planPath, 'utf-8');
      const lines = content.split('\n');
      const progress: { step: string; status: 'complete' | 'pending' | 'in-progress' }[] = [];

      for (const line of lines) {
        const checkedMatch = line.match(/^\s*-\s*\[x\]\s+(.+)/i);
        const uncheckedMatch = line.match(/^\s*-\s*\[\s*\]\s+(.+)/i);
        
        if (checkedMatch) {
          progress.push({ step: checkedMatch[1].trim(), status: 'complete' });
        } else if (uncheckedMatch) {
          progress.push({ step: uncheckedMatch[1].trim(), status: 'pending' });
        }
      }

      return progress;
    } catch {
      return [];
    }
  }

  /**
   * Get detailed task information
   */
  private async getTaskDetails(task: Task): Promise<Record<string, unknown>> {
    const details: Record<string, unknown> = {
      id: task.name,
      content: ''
    };

    try {
      // Read INIT.md for task content
      if (task.hasInit) {
        const initPath = path.join(task.path, 'INIT.md');
        details['content'] = await fs.readFile(initPath, 'utf-8');
      }

      // Read PLAN.md if exists
      if (task.hasPlan) {
        const planPath = path.join(task.path, 'PLAN.md');
        details['planContent'] = await fs.readFile(planPath, 'utf-8');
      }

      // Read ERROR.md if exists
      if (task.hasError) {
        const errorPath = path.join(task.path, 'ERROR.md');
        details['errorContent'] = await fs.readFile(errorPath, 'utf-8');
      }
    } catch {
      // Ignore read errors
    }

    return details;
  }

  /**
   * Generate task workflow guide
   */
  private generateTaskWorkflowGuide(context: TaskContext | null, args: Record<string, unknown>): PromptContent {
    const messages: PromptMessage[] = [];

    // Main guide content
    let mainContent = `# Task Management Workflow Guide

## Overview
This guide provides comprehensive instructions for managing tasks using the MCP agent communication server.

## Core Workflow Steps

### 1. Create Task
Use \`create_task\` to initiate a new task:
- Specify the agent name (ownership validation enforced)
- Provide a clean task name (no timestamps needed)
- Include task content in markdown format

### 2. Submit Plan
Use \`submit_plan\` to provide implementation plan:
- Include detailed steps with checkboxes
- Add time estimates and dependencies
- Mark initial progress status

### 3. Report Progress
Use \`report_progress\` to update task status:
- Update checkbox states in PLAN.md
- Provide descriptions of work completed
- Report blockers if encountered

### 4. Complete Task
Use \`mark_complete\` to finish the task:
- Set status to DONE or ERROR
- Provide comprehensive summary
- Handle unchecked items with reconciliation modes`;

    // Add context-specific content
    if (context) {
      mainContent += `\n\n## Current Context for ${context.agent}`;
      
      if (context.tasks.length > 0) {
        mainContent += `\n\n### Current Tasks (${context.tasks.length})`;
        for (const task of context.tasks) {
          const statusEmoji = this.getStatusEmoji(task.status);
          mainContent += `\n- **${task.name}** ${statusEmoji} ${task.status}`;
          
          if (task.progress && task.progress.length > 0) {
            const completed = task.progress.filter(p => p.status === 'complete').length;
            const total = task.progress.length;
            mainContent += ` (${completed}/${total} steps)`;
          }
        }
      } else {
        mainContent += '\n\n### No Active Tasks\nReady to create new tasks.';
      }

      // Add current task details
      if (context.currentTask && args['taskId']) {
        const taskId = String(args['taskId']);
        mainContent += `\n\n### Current Task Progress: ${taskId}`;
        
        if (context.tasks.length > 0) {
          const task = context.tasks.find(t => t.name === taskId);
          if (task?.progress && task.progress.length > 0) {
            mainContent += '\n\n**Steps:**';
            for (const step of task.progress) {
              const icon = step.status === 'complete' ? '✅' : '⏳';
              mainContent += `\n- ${icon} ${step.step}`;
            }
          }
        }
      }
    }

    messages.push({
      role: 'user',
      content: {
        type: 'text',
        text: mainContent
      }
    });

    // Add example as embedded resource
    messages.push({
      role: 'user',
      content: {
        type: 'resource',
        resource: {
          uri: 'file:///examples/task-workflow.md',
          mimeType: 'text/markdown',
          text: `# Example Task Workflow

## Step 1: Create Task
\`\`\`typescript
await create_task({
  agent: "senior-backend-engineer",
  taskName: "implement-api-endpoint",
  content: "# Task: Implement User API\\n\\nCreate RESTful endpoint for user management"
});
\`\`\`

## Step 2: Submit Plan
\`\`\`typescript
await submit_plan({
  agent: "senior-backend-engineer",
  content: "# Implementation Plan\\n\\n- [ ] Design API schema\\n- [ ] Implement endpoint\\n- [ ] Add tests"
});
\`\`\`

## Step 3: Report Progress
\`\`\`typescript
await report_progress({
  agent: "senior-backend-engineer",
  updates: [{
    step: 1,
    status: "COMPLETE",
    description: "API schema designed and documented"
  }]
});
\`\`\`

## Step 4: Mark Complete
\`\`\`typescript
await mark_complete({
  agent: "senior-backend-engineer",
  status: "DONE",
  summary: "Successfully implemented user API endpoint with full test coverage"
});
\`\`\``
        }
      }
    });

    return { messages };
  }

  /**
   * Generate agent validation guide
   */
  private generateAgentValidationGuide(agent: string): PromptContent {
    const messages: PromptMessage[] = [];

    const content = `# Agent Validation Requirements

## Agent: ${agent}

### Ownership Validation
The MCP server enforces strict ownership validation to ensure agents can only modify their own tasks.

### Key Requirements

1. **Agent Name Specification**
   - Always provide the exact agent name
   - Never use "default-agent" (this is a placeholder)
   - Agent names are case-sensitive

2. **Valid Agent Names**
   - senior-frontend-engineer
   - senior-backend-engineer
   - senior-system-architect
   - devops-deployment-engineer
   - qa-test-automation-engineer
   - And other specialized agents

3. **Best Practices**
   - Store agent name in a variable for consistency
   - Validate agent name before operations
   - Use \`list_agents\` to see available agents

### Common Validation Issues

#### Issue: "default-agent" Error
**Problem**: Using the default placeholder instead of actual agent name
**Solution**: 
\`\`\`typescript
// ❌ Wrong
await create_task({ agent: "default-agent", ... });

// ✅ Correct
await create_task({ agent: "${agent}", ... });
\`\`\`

#### Issue: Ownership Validation Failed
**Problem**: Trying to modify another agent's task
**Solution**: Ensure you're using the correct agent name for the task

#### Issue: Agent Not Found
**Problem**: Using an invalid agent name
**Solution**: Check available agents with \`list_agents\` tool

### Validation Workflow

1. **Check Agent Tasks**
   \`\`\`typescript
   await check_tasks({ agent: "${agent}" });
   \`\`\`

2. **Verify Ownership**
   - Tasks are isolated by agent
   - Each agent has its own task directory
   - Cross-agent operations are not permitted

3. **Handle Validation Errors**
   - Catch and handle ownership errors
   - Provide clear error messages
   - Suggest corrective actions`;

    messages.push({
      role: 'user',
      content: { type: 'text', text: content }
    });

    return { messages };
  }

  /**
   * Generate flexible task operations guide
   */
  private generateFlexibleTaskGuide(context: TaskContext | null): PromptContent {
    const messages: PromptMessage[] = [];

    let content = `# Flexible Task Operations Guide

## Working with Multiple Tasks

The MCP server supports flexible multi-task workflows, allowing you to:
- Work on multiple tasks simultaneously
- Switch between tasks as needed
- Complete tasks in any order
- Manage dependencies between tasks

## Key Concepts

### Parallel Task Execution
Work on multiple tasks concurrently without blocking:
- Create multiple tasks at once
- Switch context between tasks
- Update progress independently

### Task Switching
Use \`get_task_context\` with different taskIds to switch focus:
\`\`\`typescript
// Switch to task A
await get_task_context({ agent: "agent-name", taskId: "task-001" });

// Switch to task B
await get_task_context({ agent: "agent-name", taskId: "task-002" });
\`\`\`

### Flexible Completion
Tasks can be completed in any order:
- No strict sequential requirements
- Handle dependencies explicitly
- Archive completed tasks as needed`;

    // Add context-specific multi-task info
    if (context && context.tasks.length > 1) {
      content += `\n\n## Your Multiple Active Tasks

You currently have ${context.tasks.length} tasks:`;
      
      for (const task of context.tasks) {
        const emoji = this.getStatusEmoji(task.status);
        content += `\n\n### ${task.name} ${emoji}
- Status: ${task.status}
- Has Plan: ${task.hasPlan ? 'Yes' : 'No'}`;
        
        if (task.progress && task.progress.length > 0) {
          const completed = task.progress.filter(p => p.status === 'complete').length;
          content += `\n- Progress: ${completed}/${task.progress.length} steps complete`;
        }
      }

      content += `\n\n## Recommended Actions
1. Focus on tasks marked as "in-progress"
2. Complete blocked tasks by resolving dependencies
3. Archive completed tasks to maintain clarity`;
    }

    content += `\n\n## Example Workflows

### Sequential Task Completion
\`\`\`typescript
// Complete task 1
await mark_complete({ agent: "agent", status: "DONE", summary: "Task 1 done" });

// Start task 2
await submit_plan({ agent: "agent", content: "Plan for task 2" });
\`\`\`

### Parallel Task Progress
\`\`\`typescript
// Update task A
await report_progress({ agent: "agent", updates: [{ step: 1, status: "COMPLETE" }] });

// Switch to task B
await report_progress({ agent: "agent", updates: [{ step: 2, status: "IN_PROGRESS" }] });
\`\`\``;

    messages.push({
      role: 'user',
      content: { type: 'text', text: content }
    });

    // Add workflow diagram as resource
    messages.push({
      role: 'user',
      content: {
        type: 'resource',
        resource: {
          uri: 'file:///examples/multi-task-workflow.md',
          mimeType: 'text/markdown',
          text: `# Multi-Task Workflow Example

## Scenario: Three Parallel Features

### Task Structure
- task-001-authentication
- task-002-database-migration  
- task-003-api-endpoints

### Workflow
1. Create all three tasks
2. Submit plans for each
3. Work on them in parallel
4. Complete in order of readiness
5. Archive when all done`
        }
      }
    });

    return { messages };
  }

  /**
   * Generate troubleshooting guide
   */
  private generateTroubleshootingGuide(context: TaskContext | null, errorType?: ErrorType): PromptContent {
    const messages: PromptMessage[] = [];

    let content = `# Troubleshooting Guide

## Common Errors and Solutions`;

    // Add specific error guidance
    if (errorType) {
      content += `\n\n## Specific Issue: ${errorType}`;
      
      switch (errorType as ErrorType) {
        case 'default-agent':
          content += `\n\n### "default-agent" Error
**Cause**: Using the placeholder agent name instead of a real agent
**Solution**: Replace "default-agent" with actual agent name like "senior-backend-engineer"

\`\`\`typescript
// ❌ Incorrect
await create_task({ agent: "default-agent", ... });

// ✅ Correct
await create_task({ agent: "senior-backend-engineer", ... });
\`\`\``;
          break;

        case 'ownership-validation':
          content += `\n\n### Ownership Validation Failed
**Cause**: Attempting to modify a task owned by another agent
**Solution**: Ensure you're using the correct agent name for the task you're modifying`;
          break;

        case 'task-not-found':
          content += `\n\n### Task Not Found
**Cause**: Referencing a task that doesn't exist
**Solution**: Use \`check_tasks\` to list available tasks first`;
          break;

        default:
          content += `\n\n### Generic Error Resolution
1. Check agent name is correct
2. Verify task exists with \`check_tasks\`
3. Ensure proper permissions
4. Review error messages for specific details`;
      }
    }

    // Add recent errors from context
    if (context) {
      const errorTasks = context.tasks.filter(t => t.status === 'error');
      if (errorTasks.length > 0) {
        content += `\n\n## Recent Errors for ${context.agent}`;
        for (const task of errorTasks) {
          content += `\n- **${task.name}**: Task has error status`;
        }
        content += '\n\nUse `read_task` with file type "ERROR" to see details.';
      }
    }

    // General troubleshooting steps
    content += `\n\n## General Troubleshooting Steps

1. **Verify Agent Name**
   \`\`\`typescript
   await list_agents(); // See all available agents
   \`\`\`

2. **Check Task Status**
   \`\`\`typescript
   await check_tasks({ agent: "your-agent" });
   \`\`\`

3. **Read Error Details**
   \`\`\`typescript
   await read_task({ 
     agent: "your-agent",
     task: "task-name",
     file: "ERROR"
   });
   \`\`\`

4. **Validate Arguments**
   - Ensure all required arguments are provided
   - Check argument types match expectations
   - Verify task and agent names are correct

5. **Review Protocol Compliance**
   - Follow the task lifecycle: INIT → PLAN → DONE/ERROR
   - Use appropriate tools for each phase
   - Maintain proper task state

## Error Prevention Best Practices

- Always specify agent name explicitly
- Use \`check_tasks\` before operations
- Handle errors gracefully in your code
- Archive completed tasks regularly
- Follow the protocol compliance checklist`;

    messages.push({
      role: 'user',
      content: { type: 'text', text: content }
    });

    return { messages };
  }

  /**
   * Generate protocol compliance checklist
   */
  private generateComplianceChecklist(context: TaskContext | null): PromptContent {
    const messages: PromptMessage[] = [];

    let content = `# Protocol Compliance Checklist

## Task Lifecycle Compliance

### ✅ Task Creation
- [ ] Use \`create_task\` with proper agent name
- [ ] Avoid "default-agent" placeholder
- [ ] Provide clean task names (no manual timestamps)
- [ ] Include comprehensive task content

### ✅ Plan Submission  
- [ ] Use \`submit_plan\` after task creation
- [ ] Include checkbox-formatted steps
- [ ] Add time estimates where applicable
- [ ] Set initial progress markers

### ✅ Progress Reporting
- [ ] Use \`report_progress\` for updates
- [ ] Update checkbox states accurately
- [ ] Provide clear descriptions
- [ ] Report blockers when encountered

### ✅ Task Completion
- [ ] Use \`mark_complete\` to finish
- [ ] Choose appropriate status (DONE/ERROR)
- [ ] Provide comprehensive summary
- [ ] Handle unchecked items properly

## Best Practices

### Agent Operations
- [ ] Validate agent ownership before operations
- [ ] Use \`list_agents\` to verify agent names
- [ ] Handle multi-agent workflows correctly
- [ ] Respect task isolation boundaries

### Error Handling
- [ ] Catch and handle all errors
- [ ] Provide clear error messages
- [ ] Log errors appropriately
- [ ] Implement retry logic where suitable

### Performance
- [ ] Batch operations when possible
- [ ] Archive completed tasks regularly
- [ ] Clean up old tasks periodically
- [ ] Monitor task accumulation`;

    // Add agent-specific compliance status
    if (context) {
      const completed = context.tasks.filter(t => t.status === 'completed').length;
      const inProgress = context.tasks.filter(t => t.status === 'in-progress').length;
      const errors = context.tasks.filter(t => t.status === 'error').length;
      const total = context.tasks.length;

      content += `\n\n## Agent Compliance Status: ${context.agent}

### Task Statistics
- Total Tasks: ${total}
- Completed: ${completed}
- In Progress: ${inProgress}
- Errors: ${errors}

### Compliance Score
`;

      // Calculate compliance score
      let score = 100;
      const issues: string[] = [];

      if (errors > 0) {
        score -= errors * 10;
        issues.push(`${errors} task(s) in error state`);
      }

      if (inProgress > 5) {
        score -= 10;
        issues.push('Too many tasks in progress simultaneously');
      }

      score = Math.max(0, score);
      content += `**${score}/100**`;

      if (issues.length > 0) {
        content += '\n\n### Issues Detected';
        for (const issue of issues) {
          content += `\n- ${issue}`;
        }
      }

      content += '\n\n### Recommendations';
      if (errors > 0) {
        content += '\n- Review and resolve error tasks';
      }
      if (inProgress > 3) {
        content += '\n- Focus on completing in-progress tasks';
      }
      if (completed > 10) {
        content += '\n- Archive completed tasks to reduce clutter';
      }
    }

    messages.push({
      role: 'user',
      content: { type: 'text', text: content }
    });

    // Add code example as resource
    messages.push({
      role: 'user',
      content: {
        type: 'resource',
        resource: {
          uri: 'file:///examples/compliant-workflow.ts',
          mimeType: 'text/x-typescript',
          text: `// Example: Fully Compliant Task Workflow

import { 
  create_task,
  submit_plan,
  report_progress,
  mark_complete 
} from '@mcp/agent-comm';

async function compliantWorkflow() {
  const agent = 'senior-backend-engineer';
  
  // Step 1: Create task with validation
  const task = await create_task({
    agent,
    taskName: 'implement-user-service',
    content: '# Task: Implement User Service\\n\\nCreate user management service with CRUD operations'
  });
  
  // Step 2: Submit detailed plan
  await submit_plan({
    agent,
    content: \`# Implementation Plan
    
- [ ] Design service interface
- [ ] Implement data models
- [ ] Create service methods
- [ ] Add unit tests
- [ ] Integration testing\`
  });
  
  // Step 3: Report progress incrementally
  await report_progress({
    agent,
    updates: [
      {
        step: 1,
        status: 'COMPLETE',
        description: 'Service interface designed and documented'
      }
    ]
  });
  
  // Step 4: Complete with summary
  await mark_complete({
    agent,
    status: 'DONE',
    summary: 'User service implemented with full test coverage and documentation'
  });
}`
        }
      }
    });

    return { messages };
  }

  /**
   * Get status emoji for display
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  }
}