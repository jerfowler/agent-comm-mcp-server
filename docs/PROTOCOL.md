# Agent Communication Protocol

## Overview
**MCP Server**: Context-based task management with complete file system abstraction. Agents work with task IDs and content only, never file paths or directory structures.

## Core Architecture

### Context-Based Operations
The API provides complete file system abstraction for simplified agent development:

**Context-Based Tools**:
- `get_task_context(taskId?)` - Task content without file paths
- `submit_plan(content)` - Content-only planning submission
- `report_progress(updates)` - Progress marker updates only
- `mark_complete(status, summary)` - Handles completion internally
- `archive_completed_tasks()` - Batch cleanup operation

**Key Benefits**:
- **No File Path Exposure**: Agents never see filesystem internals
- **Auto-Context Injection**: Protocol instructions automatically added to delegated tasks  
- **JSON Lines Logging**: All operations logged with metadata for monitoring
- **Session Management**: Connection tracking for multi-agent coordination

### Diagnostic Lifecycle Tools
Complete visibility into agent task execution:

**Diagnostic Tools**:
- `get_full_lifecycle` - Complete task journey with agent thought process
- `track_task_progress` - Real-time progress monitoring with percentages
- `delegate_task` - Enhanced delegation with tracking information

### Core Task Management
Essential functionality for task coordination:

**Core Tools**:
- `check_tasks` - Monitor agent task queues
- `read_task` - Read task files (INIT, PLAN, DONE, ERROR)
- `write_task` - Create task progress files
- `init_task` - Initialize tasks from task files
- `archive_tasks` - Archive completed tasks
- `restore_tasks` - Restore archived tasks

## Todo System Integration

### Why Use Todos with MCP
The Todo system supplements MCP operations by:
- Maintaining execution state across multiple tool calls
- Ensuring no steps are forgotten
- Providing clear progress visibility
- Creating an audit trail of completed work

### Standard Workflow Pattern
1. **Start Task** → Create comprehensive todo list
2. **Submit Plan** → Mark planning todos complete, add implementation todos
3. **Report Progress** → Update todos as you complete steps
4. **Mark Complete** → Ensure all todos are completed first

### Example: Complete Task Execution
```typescript
// 1. Start task and create todos
const context = await start_task(taskId);
await TodoWrite([
  { content: "Analyze requirements from context", status: "in_progress", activeForm: "Analyzing" },
  { content: "Create detailed implementation plan", status: "pending", activeForm: "Planning" },
  { content: "Submit plan using submit_plan()", status: "pending", activeForm: "Submitting plan" },
  // ... more todos based on requirements
]);

// 2. As you work, update todos
await TodoWrite([
  { content: "Analyze requirements from context", status: "completed", activeForm: "Analyzing" },
  { content: "Create detailed implementation plan", status: "in_progress", activeForm: "Planning" },
  // ... rest unchanged
]);

// 3. Before marking task complete, verify todos
const todos = await TodoRead();
if (todos.some(t => t.status !== 'completed')) {
  // Complete remaining todos first!
}
await mark_complete('DONE', summary);
```

### Common Todo Patterns

#### Pattern 1: Task Start
```typescript
// Parse requirements into actionable todos
const requirements = context.requirements;
const todos = [
  { content: "Understand task context", status: "in_progress", activeForm: "Understanding" },
  ...requirements.map(req => ({
    content: `Implement: ${req}`,
    status: "pending",
    activeForm: `Working on: ${req}`
  })),
  { content: "Submit final plan", status: "pending", activeForm: "Submitting plan" },
  { content: "Mark task complete", status: "pending", activeForm: "Completing task" }
];
await TodoWrite(todos);
```

#### Pattern 2: Progress Updates
```typescript
// Update todos before reporting progress
await TodoWrite(updatedTodos);
await report_progress([
  { step: 1, status: 'COMPLETE', description: 'Initial setup done' },
  { step: 2, status: 'IN_PROGRESS', description: 'Core implementation' }
]);
```

### Todo Anti-Patterns (Avoid These)
- ❌ Starting work without creating todos
- ❌ Forgetting to mark completed items
- ❌ Having multiple items 'in_progress'
- ❌ Creating vague, non-actionable todos
- ❌ Not including MCP operations as todos

## Task Structure

### Context-Based Task Flow
```
1. Task Context → Agent gets context without file paths
2. Planning → Agent submits plan content (no file management)
3. Progress → Agent reports progress markers as work progresses
4. Completion → Agent marks complete with status and summary
```

**Context Objects**:
- **TaskContext**: Title, objective, requirements, protocol instructions
- **TaskSummary**: Task ID, title, status, progress metrics
- **PlanSubmission**: Content, steps identified, phases, initial progress

## Agent Protocol

### Context-Based Workflow

#### 1. Get Task Context
```python
# Get task context without file paths
context = mcp_call('get_task_context', agent='senior-frontend-engineer')
# Returns: TaskContext with title, objective, requirements, protocol instructions
```

#### 2. Planning

**REQUIRED PLAN FORMAT**: All plans must use markdown checkboxes with detailed structure.

```python
# Submit implementation plan (content only)
result = mcp_call('submit_plan', 
    agent='senior-frontend-engineer',
    content="""
# Implementation Plan: Dashboard Implementation

## Phase 1: Setup and Architecture

- [ ] **Component Architecture Design**: Create component structure
  - Design: Component hierarchy and props interfaces
  - Files: Create component files and index exports
  - Expected: Clean component architecture with TypeScript types
  - Error: If type errors, review interface definitions

- [ ] **State Management Setup**: Implement state management
  - Tool: Use React Context or Zustand for state
  - Integration: Connect components to state management
  - Expected: Centralized state with proper typing
  - Error: If state issues, check provider setup

- [ ] **API Integration**: Connect to backend services
  - Endpoints: Define API endpoints and data contracts
  - Fetching: Implement data fetching with error handling
  - Expected: Working data flow from API to components
  - Error: If API fails, implement fallback data
""")
# Returns: {'success': true, 'stepsIdentified': 3, 'phases': 1}
```

### Plan Format Specification (Mandatory)

Every trackable item MUST follow this structure:
```markdown
- [ ] **Step Title**: Brief one-line description
  - Action: Specific command or task
  - Expected: Success criteria  
  - Error: Handling approach if fails
  - Notes: Additional context (optional)
```

**Validation Rules:**
- Minimum ONE checkbox required (use `- [ ]` format exactly)
- Each checkbox must have bold title: `**Title**:`
- Each checkbox must have 2-5 detail bullets
- NO [PENDING]/[COMPLETE] status markers allowed
- Use ONLY checkboxes for tracking
- Plans failing validation will be rejected with format guidance

#### 3. Progress Updates
```python
# Report progress on specific steps
mcp_call('report_progress', 
    agent='senior-frontend-engineer',
    updates=[
        {"step": 1, "status": "COMPLETE", "description": "Component setup finished"},
        {"step": 2, "status": "IN_PROGRESS", "description": "Working on styling"}
    ]
)
```

#### 4. Task Completion

**Task Completion with Reconciliation**: The `mark_complete` tool includes intelligent reconciliation for handling unchecked plan items.

```python
# Basic completion (strict mode - default)
mcp_call('mark_complete', 
    agent='senior-frontend-engineer',
    status='DONE',
    summary='Dashboard component implemented with full responsive design and API integration'
)

# Completion with reconciliation options
mcp_call('mark_complete', 
    agent='senior-frontend-engineer',
    status='DONE',
    summary='Dashboard implementation complete',
    reconciliation={
        'mode': 'reconcile',
        'explanations': {
            'API Integration': 'Used mock data for demo, API integration deferred to next sprint',
            'Mobile Responsive': 'Desktop version complete, mobile optimization not needed for current milestone'
        }
    }
)
```

### Reconciliation Modes

The task completion system provides flexible handling for plans where not all checkboxes are marked complete:

#### Mode: `strict` (default)
- **Behavior**: Requires all checkboxes to be checked (`[x]`) before allowing DONE status
- **Use Case**: When plan adherence is critical and all steps must be completed exactly as written
- **Error Response**: Returns ERROR status with list of unchecked items

```python
# Will fail if any checkboxes remain unchecked
mcp_call('mark_complete', 
    status='DONE',
    summary='Task complete',
    reconciliation={'mode': 'strict'}
)
```

#### Mode: `auto_complete`
- **Behavior**: Automatically marks all unchecked items as complete (`[x]`) and updates PLAN.md
- **Use Case**: When agent completed work but forgot to update checkboxes during progress
- **Result**: PLAN.md is updated to reflect all items as completed

```python
# Automatically completes all checkboxes
mcp_call('mark_complete', 
    status='DONE',
    summary='All work completed, updating plan to reflect reality',
    reconciliation={'mode': 'auto_complete'}
)
```

#### Mode: `reconcile`
- **Behavior**: Accepts DONE status with explanations for why unchecked items are considered complete
- **Use Case**: When agent optimized the approach or completed work differently than originally planned
- **Required**: Must provide `explanations` mapping unchecked item titles to justifications

```python
# Explain why unchecked items are actually complete
mcp_call('mark_complete', 
    status='DONE',
    summary='Core objectives achieved with process optimization',
    reconciliation={
        'mode': 'reconcile',
        'explanations': {
            'Step 3 Database Migration': 'Used existing schema, migration not needed',
            'Step 5 Error Handling': 'Implemented centrally, individual handlers not required'
        }
    }
)
```

#### Mode: `force`
- **Behavior**: Allows DONE status regardless of unchecked items, documenting override in completion
- **Use Case**: Emergency completion or when plan became obsolete but core work is done
- **Result**: Completion documented with forced override and list of skipped items

```python
# Force completion despite unchecked items
mcp_call('mark_complete', 
    status='DONE',
    summary='Core functionality delivered, remaining items moved to backlog',
    reconciliation={'mode': 'force'}
)
```

### Reconciliation Best Practices

1. **Default to Strict**: Use strict mode for critical path items requiring complete adherence
2. **Auto-Complete for Tracking**: Use auto_complete when work is done but checkboxes weren't updated
3. **Reconcile for Optimization**: Use reconcile mode when agent found better approaches during implementation
4. **Force for Emergencies**: Use force mode sparingly, only when plan became obsolete but core work succeeded

### Validation Process

Before marking any task complete, the system automatically:

1. **Parses Plan Checkboxes**: Counts total checkboxes and identifies unchecked items
2. **Applies Reconciliation**: Based on mode, determines appropriate completion action
3. **Updates Documentation**: Modifies PLAN.md if reconciliation produces changes
4. **Records Audit Trail**: Documents reconciliation decisions in completion files

This reconciliation system ensures flexibility while maintaining audit trails and plan accountability.

#### 5. Cleanup
```python
# Archive completed tasks
mcp_call('archive_completed_tasks', agent='senior-frontend-engineer')
```

## Key Benefits

### Complete File System Abstraction
- **No Path Exposure**: Agents never see file paths, directories, or extensions
- **Simplified Development**: Work with task IDs and content only
- **Error Reduction**: Eliminates file system related bugs and path issues

### Auto-Context Injection
- **Protocol Instructions**: Automatically added to delegated tasks
- **Consistent Guidelines**: Every agent receives proper protocol guidance

### JSON Lines Logging
- **Operation Tracking**: All operations logged with timestamps and metadata
- **Performance Monitoring**: Duration and success metrics for every operation
- **Audit Trail**: Complete history of agent interactions and task progress

### Session Management
- **Connection Tracking**: ConnectionManager maintains agent session state
- **Concurrent Support**: Multiple agents can work simultaneously
- **Resource Coordination**: Prevents conflicts during parallel execution

## Diagnostic Lifecycle Monitoring

### Task Journey Visibility
For complete transparency into agent task execution, use diagnostic tools:

#### 1. Fire-and-Wait Pattern
```bash
# Delegate task and wait for completion
result = mcp__agent_comm__delegate_task(
    targetAgent="senior-frontend-engineer",
    taskName="implement-dashboard",
    content="# Task: Dashboard Implementation..."
)

# Monitor progress non-blocking
while True:
    progress = mcp__agent_comm__track_task_progress(
        agent="senior-frontend-engineer",
        task_id=result['task_id']
    )
    if progress['status'] in ['completed', 'error']:
        break
    time.sleep(30)  # Check every 30 seconds
```

#### 2. Real-time Progress Monitoring
```bash
# Monitor agent progress in real-time
progress = mcp__agent_comm__track_task_progress(
    agent="senior-frontend-engineer",
    task_id="dashboard-task-123"
)

print(f"Progress: {progress['progress']['percentage']}%")
```

#### 3. Complete Diagnostic Analysis
```bash
# Get complete agent thought process and execution journey
lifecycle = mcp__agent_comm__get_full_lifecycle(
    agent="senior-frontend-engineer", 
    task_id="dashboard-task-123"
)

print("Agent's approach:", lifecycle['lifecycle']['plan']['content'])
print("Final outcome:", lifecycle['lifecycle']['outcome']['content'])
```

## Environment Configuration

### MCP Server Configuration
```json
{
  "servers": {
    "agent-comm": {
      "command": "node",
      "args": ["./path/to/agent-comm-mcp-server/dist/index.js"],
      "env": {
        "AGENT_COMM_DIR": "./comm",
        "AGENT_COMM_ARCHIVE_DIR": "./comm/.archive",
        "AGENT_COMM_LOG_DIR": "./comm/.logs",
        "AGENT_COMM_DISABLE_ARCHIVE": "false"
      }
    }
  }
}
```

### Environment Variables

#### Core Configuration
- `AGENT_COMM_DIR` - Communication directory path (default: `./comm`)
- `AGENT_COMM_ARCHIVE_DIR` - Archive directory path (default: `./comm/.archive`)
- `AGENT_COMM_LOG_DIR` - Log directory path (default: `./comm/.logs`)
- `AGENT_COMM_DISABLE_ARCHIVE` - Disable archiving functionality (default: `false`)


## Agent Instructions

### Context-Based Protocol Instructions (Recommended)
Add to each subagent description:
> **SUBAGENT PROTOCOL**: Use context-based MCP tools for task management.
> Primary workflow: `get_task_context`, `submit_plan`, `report_progress`, `mark_complete`.
> Task context provided automatically - no file path operations needed.
> Use `archive_completed_tasks` for cleanup when work is complete.

### Standard Protocol Instructions (Traditional)
For agents requiring complete control:
> **SUBAGENT PROTOCOL**: Process files from `$AGENT_COMM_DIR/{agent-name}/`.
> Prefer MCP server tools when available: `check_tasks`, `read_task`, `write_task`, `init_task`.
> First: Check for MCP server availability, then document current location.
> Always: Use consistent communication directory structure.
> Store files according to task specifications.

### Diagnostic-Aware Instructions
For agents supporting diagnostic lifecycle visibility:
> **DIAGNOSTIC PROTOCOL**: Use diagnostic tools for complete task visibility and monitoring.
> Progress Tracking: Use `track_task_progress` to monitor real-time execution status.
> Lifecycle Monitoring: Use `get_full_lifecycle` to understand complete task execution journey.
> Non-blocking Coordination: Use `track_task_progress` polling for coordination without blocking parallelism.
> Task Tracking: Always provide task_id when available for enhanced diagnostic capabilities.

## Content Formats

### Task Context Format
```markdown
# Task: [Description]
## Objective
[What to accomplish]
## Requirements
[List requirements]
## Protocol Instructions
[MCP workflow and tools to use]
## Additional Context
[Relevant context and constraints]
```

### Plan Submission Format
```markdown
# Implementation Plan: [Task Description]
## Task Analysis
- Core objective: [Primary goal]
- Success criteria: [How to measure completion]
- Complexity assessment: [Simple/Medium/Complex]

## Detailed Steps
1. [PENDING] [Step 1 with specific actions and expected outcomes]
2. [PENDING] [Step 2 with dependencies and validation points]
3. [PENDING] [Continue with logical sequence]

## Required Resources
- Tools needed: [Specific tools required for implementation]
- Dependencies: [What must be completed first]

## Risk Mitigation
- Potential issue 1: [Risk] → Mitigation: [Solution approach]
- Potential issue 2: [Risk] → Mitigation: [Backup plan]
```

### Completion Summary Format
```markdown
# Task Complete: [Description]
## Results
[Completed requirements and outcomes]
## Deliverables
[What was created or accomplished]
## Next Steps
[Follow-up actions if any]
```

## Best Practices

### Context-Based Development (Recommended)
- Use context-based tools for simplified task management
- Never request file paths or directory information
- Work with task IDs and content only
- Let the MCP server handle all file operations internally

### Error Handling
- Check task context before starting work
- Report blockers immediately through `report_progress`
- Use `mark_complete` with ERROR status for failures
- Provide clear error descriptions and recommended solutions

### Performance
- Use `get_task_context` efficiently to get current task status
- Archive completed tasks regularly with `archive_completed_tasks`
- Batch progress updates when possible

### Diagnostic Best Practices
- **Progress Monitoring**: Regularly use `track_task_progress` to monitor agent execution status
- **Lifecycle Analysis**: Use `get_full_lifecycle` to understand complete task execution journey
- **Non-blocking Coordination**: Use `track_task_progress` polling loops with appropriate intervals
- **Task Identification**: Always capture and use task_id for diagnostic operations
- **Error Analysis**: When tasks fail, use lifecycle tools to understand failure points
- **Performance Tracking**: Monitor duration and progress percentages for optimization
- **State Verification**: Validate task completion status before proceeding with dependent operations

This protocol provides a robust foundation for agent communication with modern MCP server capabilities and complete file system abstraction.