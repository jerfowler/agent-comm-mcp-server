/**
 * Unified create_task tool for the Agent Communication MCP Server
 * Replaces delegate_task and init_task with a single, robust implementation
 * that prevents duplicate folder bugs and provides consistent PROTOCOL_CONTEXT
 */

import { ServerConfig, CreateTaskResponse, EnhancementContext } from '../types.js';
import { initializeTask } from '../utils/task-manager.js';
import { validateRequiredString, validateOptionalString, validateContent, validateAgentWithAvailability } from '../utils/validation.js';
import { AgentCommError } from '../types.js';
import { ErrorLogEntry } from '../logging/ErrorLogger.js';
import * as fs from '../utils/file-system.js';
import * as path from 'path';
import debug from 'debug';


const log = debug('agent-comm:tools:create-task');
// Enhanced PROTOCOL_CONTEXT with strong directives
export const PROTOCOL_CONTEXT = `

## MCP Task Management Protocol

### IMPORTANT: Creating Tasks
**ALWAYS** use \`create_task\` for ANY new task:
\`\`\`javascript
create_task({
  agent: "target-agent",      // Required: target agent name
  taskName: "task-name",      // Required: clean name (NO timestamps)
  content: "task details",    // Optional: include for delegation
  taskType: "delegation",     // Optional: delegation|self|subtask
  parentTask: "parent-id"     // Optional: for subtasks only
})
\`\`\`

### CRITICAL: Task Workflow
**YOU MUST** follow this exact sequence:
1. \`check_assigned_tasks()\` - **ALWAYS** start here
2. \`start_task(taskId)\` - **REQUIRED** before any work
3. \`submit_plan(content)\` - **MANDATORY** before implementation
4. \`report_progress(updates)\` - **UPDATE** after each step
5. \`mark_complete(status, summary, reconciliation_options)\` - **ONLY** when fully done

### MANDATORY: Todo Integration
**YOU MUST ALWAYS:**
- **CREATE** TodoWrite items for EVERY task step
- **UPDATE** todos to 'in_progress' BEFORE starting work
- **MARK** todos 'completed' IMMEDIATELY after finishing
- **NEVER** have more than ONE 'in_progress' item
- **INCLUDE** MCP operations as todo items

### REQUIRED Plan Format
**ALL PLANS MUST USE CHECKBOX FORMAT:**

Each trackable item MUST follow this structure:
\`\`\`
- [ ] **Step Title**: Brief one-line description
  - Action: Specific command or task
  - Expected: Success criteria
  - Error: Handling approach if fails
  - Notes: Additional context (optional)
\`\`\`

**Example Plan Format:**
\`\`\`markdown
## Testing Plan

- [ ] **Test Discovery**: Identify all test configurations
  - Run: \`pnpm list --filter "*" --depth 0\`
  - Scan for: jest.config.*, *.test.ts, *.spec.ts files
  - Expected: List of all test files and configurations
  - Error handling: If no tests found, document as critical issue
  - Dependencies: Node.js and pnpm installed

- [ ] **Test Execution**: Run all test suites
  - Command: \`pnpm test:all --coverage\`
  - Success criteria: All tests pass with >80% coverage
  - Failure action: Document failed tests with error messages
  - Output location: ./coverage/lcov-report/index.html
\`\`\`

**VALIDATION RULES:**
- Minimum ONE checkbox required (use \`- [ ]\` format exactly)
- Each checkbox must have bold title: \`**Title**:\`
- Each checkbox must have 2-5 detail bullets
- NO [PENDING]/[COMPLETE] status markers allowed
- Use ONLY checkboxes for tracking

### CRITICAL RULES - NEVER VIOLATE
- **NEVER** create duplicate tasks (auto-prevented)
- **NEVER** add timestamps to taskName
- **ALWAYS** update progress after EACH action
- **ALWAYS** sync todos with actual work
- **NEVER** skip submit_plan step
- **ONLY** mark complete when 100% done
- **ALWAYS** use checkbox format in plans
- **UNDERSTAND** reconciliation modes for mark_complete

### Task Completion Reconciliation
**mark_complete** supports intelligent reconciliation when plan checkboxes remain unchecked:

**4 Reconciliation Modes:**
1. **\`strict\`** (default) - Requires ALL checkboxes checked before DONE status
   - Use when: Plan adherence is critical
   - Behavior: Rejects DONE with unchecked items, allows ERROR

2. **\`auto_complete\`** - Automatically marks unchecked items complete
   - Use when: Work is done but forgot to check boxes
   - Behavior: Updates PLAN.md with all items checked

3. **\`reconcile\`** - Accept completion with explanations for variances  
   - Use when: Completed work differently than planned
   - Requires: reconciliation_explanations object
   - Behavior: Creates variance report with justifications

4. **\`force\`** - Override completion despite unchecked items
   - Use when: Emergency completion, plan became obsolete
   - Behavior: Documents forced override with warnings

**Reconciliation Examples (Essential Examples for Proper Usage):**
\`\`\`javascript
// Example 1: Default strict mode (recommended example)
mark_complete({
  status: 'DONE',
  summary: 'All work completed as planned',
  agent: 'agent-name'
  // No reconciliation = strict mode
});

// Example 3: Auto-complete forgotten checkboxes example
mark_complete({
  status: 'DONE', 
  summary: 'Forgot to check boxes during work',
  agent: 'agent-name',
  reconciliation_mode: 'auto_complete'
});

// Example 4: Reconcile with explanations (detailed example)
mark_complete({
  status: 'DONE',
  summary: 'Core work done, some items handled differently', 
  agent: 'agent-name',
  reconciliation_mode: 'reconcile',
  reconciliation_explanations: {
    'Database Setup': 'Used existing schema, setup not needed',
    'Performance Testing': 'Deferred to next sprint per stakeholder decision'
  }
});

// Force completion in emergency  
mark_complete({
  status: 'DONE',
  summary: 'Emergency deployment, remaining items moved to backlog',
  agent: 'agent-name', 
  reconciliation_mode: 'force'
});
\`\`\`

**BEST PRACTICES:**
- **Update checkboxes** as you complete work (prevents reconciliation need)
- **Use strict mode** by default (ensures plan accountability) 
- **Provide clear explanations** when using reconcile mode
- **Reserve force mode** for genuine emergencies only
- **Document reconciliation decisions** thoroughly in summary

### Diagnostic Tools
- \`track_task_progress(agent, taskId)\` - Monitor progress
- \`get_full_lifecycle(agent, taskId)\` - View task history

**REMEMBER:** Update todos, use checkbox format in plans, and report progress CONTINUOUSLY!`;

// Task creation options interface
export interface CreateTaskOptions {
  agent: string;
  taskName: string;
  content?: string;
  taskType?: 'delegation' | 'self' | 'subtask';
  parentTask?: string;
  sourceAgent?: string;  // For delegation tasks to track source agent
}

// Use CreateTaskResponse from types.ts

/**
 * Extract clean task name from potentially timestamped input
 * Handles the duplicate timestamp bug cases
 */
function extractCleanTaskName(taskName: string): string {
  // Pattern for ISO timestamp: YYYY-MM-DDTHH-mm-ss
  const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)$/;
  
  let cleanName = taskName;
  
  // Keep extracting until no more timestamps found (handles double timestamps)
  while (timestampPattern.test(cleanName)) {
    const match = cleanName.match(timestampPattern);
    if (match?.[1]) {
      cleanName = match[1];
    } else {
      break;
    }
  }
  
  return cleanName;
}

/**
 * Check if task already exists to prevent duplicates
 */
async function findExistingTask(config: ServerConfig, agent: string, taskName: string): Promise<string | null> {
  const agentDir = path.join(config.commDir, agent);
  
  if (!await fs.pathExists(agentDir)) {
    return null;
  }
  
  try {
    const entries = await fs.listDirectory(agentDir);
    
    for (const entry of entries) {
      if (await fs.isDirectory(path.join(agentDir, entry))) {
        // Check if this directory matches our task name pattern
        const cleanEntryName = extractCleanTaskName(entry);
        if (cleanEntryName === taskName) {
          return entry; // Return the full timestamped directory name
        }
      }
    }
  } catch (error) {
    // Log error but don't fail - better to create duplicate than fail entirely
    // Error checking for existing tasks: could be directory not found or permission issue
    // Fallback is to allow task creation which is safer than blocking
    if (config.errorLogger) {
      const errorEntry: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'runtime',
        operation: 'create_task',
        agent,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Error'
        },
        context: {
          tool: 'create_task',
          parameters: { agent, taskName, action: 'duplicate_detection' }
        },
        severity: 'high'
      };
      await config.errorLogger.logError(errorEntry);
    }
  }
  
  return null;
}

/**
 * Generate enhanced content with protocol context and task-specific information
 */
function generateEnhancedContent(options: CreateTaskOptions, sourceAgent?: string): string {
  let content = options.content ?? '';
  
  // Add delegation metadata for delegation tasks
  if (options.taskType === 'delegation') {
    const timestamp = new Date().toISOString();
    const metadataSection = `\n\n## Metadata\n- Agent: ${options.agent}\n- Created: ${timestamp}`;
    
    // Add source agent if provided (for delegation tracking)
    if (sourceAgent) {
      content = content + metadataSection + `\n- Source: ${sourceAgent}\n`;
    } else {
      content = content + metadataSection + '\n';
    }
  }
  
  // Add parent task reference for subtasks
  if (options.taskType === 'subtask' && options.parentTask) {
    const parentRef = `\n\n## Parent Task\nParent Task: ${options.parentTask}\n`;
    content = content + parentRef;
  }
  
  // For self-organization tasks without content, create a template
  if (options.taskType === 'self' && !content.trim()) {
    content = `# Task: ${options.taskName}\n\nTask initialized and ready for content.\n\n## Next Steps\n1. Define requirements\n2. Create implementation plan\n3. Begin execution\n`;
  }
  
  // Always append enhanced protocol context
  return content + PROTOCOL_CONTEXT;
}

/**
 * Generate tracking commands for the response
 */
function generateTracking(agent: string, taskId: string) {
  return {
    progress_command: `mcp__agent-comm__track_task_progress(agent: "${agent}", taskId: "${taskId}")`,
    lifecycle_command: `mcp__agent-comm__get_full_lifecycle(agent: "${agent}", taskId: "${taskId}")`
  };
}

/**
 * Unified create_task tool - replaces delegate_task and init_task
 */
export async function createTask(
  config: ServerConfig,
  options: CreateTaskOptions
): Promise<CreateTaskResponse> {
  const startTime = Date.now();
  log('createTask called with options: %O', options);

  // Validate inputs with error logging
  let agent: string;
  let rawTaskName: string;

  try {
    agent = await validateAgentWithAvailability(options.agent);
  } catch (error) {
    // Log validation error before re-throwing
    if (config.errorLogger) {
      const errorEntry: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'validation',
        operation: 'create_task',
        agent: String(options.agent ?? ''),
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'ValidationError'
        },
        context: {
          tool: 'create_task',
          parameters: { agent: options.agent, taskName: options.taskName }
        },
        severity: 'high'
      };
      await config.errorLogger.logError(errorEntry);
    }
    throw error;
  }

  try {
    rawTaskName = validateRequiredString(options.taskName, 'taskName');
  } catch (error) {
    // Log validation error before re-throwing
    if (config.errorLogger) {
      const errorEntry: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'validation',
        operation: 'create_task',
        agent: agent ?? String(options.agent ?? ''),
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'ValidationError'
        },
        context: {
          tool: 'create_task',
          parameters: { agent: options.agent, taskName: options.taskName }
        },
        severity: 'high'
      };
      await config.errorLogger.logError(errorEntry);
    }
    throw error;
  }

  const content = options.content;
  const taskType = options.taskType ?? 'delegation';
  const parentTask = options.parentTask;
  
  // Validate content if provided
  if (content) {
    validateContent(content);
  }
  
  try {
    // Extract clean task name to prevent double timestamps
    const cleanTaskName = extractCleanTaskName(rawTaskName);
    log('Extracted clean task name: %s from raw: %s', cleanTaskName, rawTaskName);
    
    // Check for existing task to prevent duplicates
    log('Checking for existing task: %s for agent: %s', cleanTaskName, agent);
    const existingTaskId = await findExistingTask(config, agent, cleanTaskName);
    
    if (existingTaskId) {
      // Return existing task - idempotent behavior
      log('Found existing task: %s, returning without creating duplicate', existingTaskId);
      const response: CreateTaskResponse = {
        success: true,
        taskCreated: false,
        taskId: existingTaskId,
        message: `existing task found: ${existingTaskId}. No duplicate created.`,
        tracking: generateTracking(agent, existingTaskId)
      };
      
      // Add targetAgent for delegation tasks
      if (taskType === 'delegation') {
        response.targetAgent = agent;
      }

      const elapsed = Date.now() - startTime;
      log('Returning existing task in %dms', elapsed);
      return response;
    }
    
    // Generate enhanced content with protocol context
    const taskOptions: CreateTaskOptions = {
      agent,
      taskName: cleanTaskName,
      taskType
    };
    if (content) {
      taskOptions.content = content;
    }
    if (parentTask) {
      taskOptions.parentTask = parentTask;
    }
    
    const enhancedContent = generateEnhancedContent(taskOptions, options.sourceAgent);
    
    // Create task using unified approach - initializeTask for all types
    log('Creating new task for agent: %s with name: %s', agent, cleanTaskName);
    const result = await initializeTask(config, agent, cleanTaskName);
    const taskId = result.taskDir;
    log('Task created with ID: %s', taskId);

    // Write enhanced content to INIT.md for all task types
    try {
      log('Writing INIT.md to: %s (%d bytes)', result.initPath, enhancedContent.length);
      await fs.writeFile(result.initPath, enhancedContent);
      log('Successfully wrote INIT.md');
    } catch (writeError) {
      // Add taskId to error for proper logging context
      log('Failed to write INIT.md: %O', writeError);
      if (writeError instanceof Error) {
        (writeError as Error & { taskId?: string }).taskId = taskId;
      }
      throw writeError;
    }
    
    const response: CreateTaskResponse = {
      success: true,
      taskCreated: true,
      taskId,
      message: `Task successfully created for ${agent}: ${taskId}`,
      tracking: generateTracking(agent, taskId)
    };
    
    // Add targetAgent for delegation tasks
    if (taskType === 'delegation') {
      response.targetAgent = agent;
    }

    const elapsed = Date.now() - startTime;
    log('Task creation completed in %dms', elapsed);
    return response;
    
  } catch (error) {
    // Log task creation error
    if (config.errorLogger) {
      const extractedTaskId = error instanceof Error && 'taskId' in error ?
        (error as Error & { taskId?: string }).taskId :
        undefined;

      const errorEntry: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'tool_execution',
        operation: 'create_task',
        agent,
        ...(extractedTaskId ? { taskId: extractedTaskId } : {}),  // Only include taskId if it exists
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Error'
        },
        context: {
          tool: 'create_task',
          parameters: {
            agent,
            taskName: rawTaskName,
            ...(extractedTaskId ? { taskId: extractedTaskId } : {})
          }
        },
        severity: 'high'
      };
      await config.errorLogger.logError(errorEntry);
    }

    if (error instanceof AgentCommError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new AgentCommError(`Failed to create task: ${message}`, 'TASK_CREATION_ERROR');
  }
}

/**
 * MCP tool wrapper for create_task
 */
export async function createTaskTool(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<CreateTaskResponse> {
  let agent: string;

  try {
    agent = validateRequiredString(args['agent'], 'agent');
  } catch (error) {
    // Log validation error from tool wrapper
    if (config.errorLogger) {
      const errorEntry: ErrorLogEntry = {
        timestamp: new Date(),
        source: 'validation',
        operation: 'create_task',
        agent: String(args['agent'] ?? ''),
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'ValidationError'
        },
        context: {
          tool: 'create_task',
          parameters: args
        },
        severity: 'high'
      };
      await config.errorLogger.logError(errorEntry);
    }
    throw error;
  }
  const taskName = validateRequiredString(args['taskName'], 'taskName');
  const content = validateOptionalString(args['content'], 'content');
  const taskType = (args['taskType'] as 'delegation' | 'self' | 'subtask' | undefined) ?? 'delegation';
  const parentTask = validateOptionalString(args['parentTask'], 'parentTask');
  const sourceAgent = validateOptionalString(args['sourceAgent'], 'sourceAgent');
  
  const options: CreateTaskOptions = {
    agent,
    taskName,
    ...(content && { content }),
    taskType,
    ...(parentTask && { parentTask }),
    ...(sourceAgent && { sourceAgent })
  };
  
  // Create the task
  const response = await createTask(config, options);
  
  // Apply Smart Response System enhancement if available
  if (config.responseEnhancer && config.smartResponseConfig?.enabled) {
    try {
      // Track compliance if this is a task creation
      if (config.complianceTracker && response.taskCreated) {
        await config.complianceTracker.recordActivity(sourceAgent ?? agent, {
          type: 'task_created',
          taskId: response.taskId,
          taskType: taskType,
          timestamp: new Date()
        });
      }
      
      // Track delegation if this is a delegation task
      if (config.delegationTracker && taskType === 'delegation' && response.taskCreated) {
        await config.delegationTracker.recordDelegation({
          taskId: response.taskId,
          targetAgent: agent,
          createdAt: new Date(),
          taskToolInvoked: true,
          subagentStarted: false,
          completionStatus: 'pending'
        });
      }
      
      // Enhance response with Smart Response guidance
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (config.responseEnhancer) {
        const enhancementContext: EnhancementContext = {
          toolName: 'create_task',
          agent: sourceAgent ?? agent,
          toolResponse: response
        };
        
        // Only add optional properties if they are defined
        if (config.promptManager !== undefined) {
          enhancementContext.promptManager = config.promptManager;
        }
        if (config.complianceTracker !== undefined) {
          enhancementContext.complianceTracker = config.complianceTracker;
        }
        if (config.delegationTracker !== undefined) {
          enhancementContext.delegationTracker = config.delegationTracker;
        }
        
        const enhancedResponse = await config.responseEnhancer.enhance(enhancementContext);
        // The enhance method returns the full enhanced response
        // We need to ensure it has all required CreateTaskResponse properties
        return enhancedResponse as unknown as CreateTaskResponse;
      }
    } catch (error) {
      // Smart Response System errors are handled silently
      // The tool continues to work without enhancement
      void error; // Acknowledge error without logging
    }
  }
  
  return response;
}