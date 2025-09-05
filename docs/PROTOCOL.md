# Agent Communication Protocol

## Overview

The **Agent Communication MCP Server** provides a robust, context-based task management system for AI agent coordination. Built as a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server, it enables Claude Code to delegate tasks to specialized agents with complete lifecycle visibility and diagnostic monitoring.

### Key Capabilities

- **🎯 Context-Based Operations**: Agents work with task IDs and content only—never file paths
- **🔍 Complete Lifecycle Visibility**: Track agent thought processes from INIT → PLAN → PROGRESS → COMPLETION
- **🛡️ Zero File System Exposure**: Complete abstraction eliminates path-related bugs
- **📊 Real-Time Monitoring**: Track progress, diagnose failures, analyze agent approaches
- **🔄 Intelligent Reconciliation**: Flexible task completion with plan variance handling
- **⚡ Non-Blocking Architecture**: Preserves Claude Code parallelism with async-first design

---

## Quick Start

### Installation & Setup

```bash
# Global installation (recommended for MCP)
npm install -g @jerfowler/agent-comm-mcp-server

# Or use directly
npx @jerfowler/agent-comm-mcp-server
```

### MCP Client Configuration

```json
{
  "servers": {
    "agent-comm": {
      "command": "node",
      "args": ["./node_modules/@jerfowler/agent-comm-mcp-server/dist/index.js"],
      "env": {
        "AGENT_COMM_DIR": "./comm"
      }
    }
  }
}
```

### Basic Usage Example

```python
# 1. Create a task
task = mcp_call('create_task', 
    agent='senior-frontend-engineer',
    taskName='implement-dashboard'
)

# 2. Get task context (recommended workflow)
context = mcp_call('get_task_context', 
    agent='senior-frontend-engineer'
)

# 3. Submit implementation plan
mcp_call('submit_plan', 
    agent='senior-frontend-engineer',
    content='# Implementation Plan...'
)

# 4. Complete task
mcp_call('mark_complete', 
    agent='senior-frontend-engineer',
    status='DONE',
    summary='Dashboard implemented successfully'
)
```

---

## Core Concepts

### Task Lifecycle

Every task follows a structured lifecycle:

```
INIT → PLAN → PROGRESS → COMPLETION
 ↓      ↓        ↓         ↓
Created → Planned → In Progress → DONE/ERROR
```

**File Structure:**
- `INIT.md` - Initial task definition and requirements
- `PLAN.md` - Implementation plan with checkboxes
- `PROGRESS.md` - Real-time progress tracking (optional)
- `DONE.md` or `ERROR.md` - Final outcome

### Agent Communication Patterns

**Context-Based (Recommended):**
- Agents receive task context without file paths
- Complete file system abstraction
- Simplified development workflow

**Traditional (Advanced):**
- Direct file system operations
- Complete control over task files
- Requires path management

### Task Organization

```
comm/
├── {agent-name}/
│   ├── {task-timestamp-name}/
│   │   ├── INIT.md
│   │   ├── PLAN.md
│   │   ├── PROGRESS.md (optional)
│   │   └── DONE.md or ERROR.md
│   └── ...
├── .archive/
│   └── {timestamp}/
└── .logs/
    └── operations.jsonl
```

---

## Complete Tool Reference

### Traditional Task Management Tools

#### `check_tasks(agent)`
Monitor agent task queues and status.

**Parameters:**
- `agent` (required): Agent name (e.g., "senior-frontend-engineer")

**Returns:** List of assigned tasks with metadata

```python
tasks = mcp_call('check_tasks', agent='senior-frontend-engineer')
```

---

#### `create_task(agent, taskName, [content], [taskType], [parentTask])`
**Unified task creation tool** - replaces deprecated `delegate_task` and `init_task`.

**Parameters:**
- `agent` (required): Target agent name
- `taskName` (required): Clean task name (auto-timestamped internally)
- `content` (optional): Task content in markdown format
- `taskType` (optional): "delegation" | "self" | "subtask" (default: "delegation")
- `parentTask` (optional): Parent task ID for subtasks

**Returns:** Task creation result with tracking information

```python
# Basic task creation
result = mcp_call('create_task',
    agent='senior-frontend-engineer',
    taskName='implement-login-form',
    content='# Task: Login Form Implementation\n...'
)

# Subtask creation
subtask = mcp_call('create_task',
    agent='senior-frontend-engineer', 
    taskName='validation-logic',
    taskType='subtask',
    parentTask='implement-login-form'
)
```

---

#### `read_task(agent, task, file)`
Read task files by type.

**Parameters:**
- `agent` (required): Agent name
- `task` (required): Task folder name
- `file` (required): "INIT" | "PLAN" | "DONE" | "ERROR"

**Returns:** File content and metadata

```python
content = mcp_call('read_task',
    agent='senior-frontend-engineer',
    task='2024-01-15T10-30-00-implement-dashboard',
    file='PLAN'
)
```

---

#### `write_task(agent, task, file, content)`
Write task progress files.

**Parameters:**
- `agent` (required): Agent name
- `task` (required): Task folder name  
- `file` (required): "PLAN" | "DONE" | "ERROR"
- `content` (required): File content to write

**Returns:** Write operation result

```python
result = mcp_call('write_task',
    agent='senior-frontend-engineer',
    task='2024-01-15T10-30-00-implement-dashboard',
    file='DONE',
    content='# Task Complete\n\nDashboard implementation finished...'
)
```

---

#### `list_agents()`
List all agents with task statistics.

**Parameters:** None

**Returns:** Agent list with task counts

```python
agents = mcp_call('list_agents')
# Returns: [{'name': 'senior-frontend-engineer', 'taskCount': 5, ...}]
```

---

#### `archive_tasks([mode], [agent], [olderThan], [dryRun])`
Archive tasks to clean up communication directory.

**Parameters:**
- `mode` (optional): "completed" | "all" | "by-agent" | "by-date" (default: "completed")
- `agent` (optional): Agent name (required for "by-agent" mode)
- `olderThan` (optional): Archive tasks older than N days (for "by-date" mode)
- `dryRun` (optional): Preview changes without archiving

**Returns:** Archive operation result

```python
# Archive all completed tasks
result = mcp_call('archive_tasks', mode='completed')

# Archive specific agent tasks
result = mcp_call('archive_tasks', 
    mode='by-agent', 
    agent='senior-frontend-engineer'
)
```

---

#### `restore_tasks(timestamp, [agent], [taskName])`
Restore archived tasks.

**Parameters:**
- `timestamp` (required): Archive timestamp (YYYY-MM-DDTHH-mm-ss format)
- `agent` (optional): Restore tasks for specific agent only
- `taskName` (optional): Restore tasks matching name pattern

**Returns:** Restore operation result

```python
result = mcp_call('restore_tasks',
    timestamp='2024-01-15T10-30-00',
    agent='senior-frontend-engineer'
)
```

---

### Context-Based Tools (Recommended Primary Workflow)

#### `get_task_context([taskId], [agent])`
Get task context without file paths - the **recommended starting point**.

**Parameters:**
- `taskId` (optional): Specific task ID. If omitted, returns current active task
- `agent` (optional): Agent name (defaults to "default-agent")

**Returns:** TaskContext with title, objective, requirements, protocol instructions

```python
# Get current active task context
context = mcp_call('get_task_context', agent='senior-frontend-engineer')

# Get specific task context
context = mcp_call('get_task_context',
    agent='senior-frontend-engineer',
    taskId='2024-01-15T10-30-00-implement-dashboard'
)
```

---

#### `submit_plan(content, agent)`
Submit implementation plan content with automatic file creation.

**Parameters:**
- `content` (required): Plan content with **mandatory checkbox format**
- `agent` (required): Agent name submitting the plan

**Returns:** Plan submission result with steps identified

```python
result = mcp_call('submit_plan', 
    agent='senior-frontend-engineer',
    content="""
# Implementation Plan: Dashboard Component

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
""")
```

**⚠️ MANDATORY PLAN FORMAT:**

Every trackable item MUST follow this structure:
```markdown
- [ ] **Step Title**: Brief one-line description
  - Action: Specific command or task
  - Expected: Success criteria  
  - Error: Handling approach if fails
```

**Validation Rules:**
- Minimum ONE checkbox required (use `- [ ]` format exactly)
- Each checkbox must have bold title: `**Title**:`
- Each checkbox must have 2-4 detail bullets
- NO [PENDING]/[COMPLETE] status markers allowed
- Plans failing validation will be rejected

---

#### `report_progress(updates, agent)`
Report progress updates on specific plan steps.

**Parameters:**
- `updates` (required): Array of step updates
- `agent` (required): Agent name reporting progress

**Step Update Format:**
```typescript
{
  step: number,           // Step number being updated
  status: "COMPLETE" | "IN_PROGRESS" | "PENDING" | "BLOCKED",
  description: string,    // Description of work done
  timeSpent?: number,     // Optional: time in minutes
  estimatedTimeRemaining?: number,  // Optional: remaining time
  blocker?: string        // Optional: blocking issue description
}
```

```python
mcp_call('report_progress',
    agent='senior-frontend-engineer', 
    updates=[
        {
            "step": 1,
            "status": "COMPLETE", 
            "description": "Component architecture completed with TypeScript interfaces"
        },
        {
            "step": 2, 
            "status": "IN_PROGRESS",
            "description": "Setting up state management with Zustand",
            "timeSpent": 45,
            "estimatedTimeRemaining": 30
        }
    ]
)
```

---

#### `mark_complete(status, summary, agent, [reconciliation_mode], [reconciliation_explanations])`
Mark task as complete with **intelligent reconciliation** for unchecked plan items.

**Parameters:**
- `status` (required): "DONE" | "ERROR"
- `summary` (required): Completion summary (minimum 10 characters)
- `agent` (required): Agent name completing the task
- `reconciliation_mode` (optional): "strict" | "auto_complete" | "reconcile" | "force"
- `reconciliation_explanations` (optional): Object mapping unchecked items to explanations

**Reconciliation Modes:**

##### `strict` (default)
Requires all checkboxes to be checked before allowing DONE status.
```python
# Will fail if any checkboxes remain unchecked
mcp_call('mark_complete',
    status='DONE',
    summary='Task completed according to plan',
    agent='senior-frontend-engineer',
    reconciliation_mode='strict'
)
```

##### `auto_complete`
Automatically marks all unchecked items as complete and updates PLAN.md.
```python
# Automatically completes all checkboxes
mcp_call('mark_complete',
    status='DONE', 
    summary='All work completed, updating plan to reflect reality',
    agent='senior-frontend-engineer',
    reconciliation_mode='auto_complete'
)
```

##### `reconcile`
Accepts DONE status with explanations for unchecked items.
```python
# Explain why unchecked items are actually complete
mcp_call('mark_complete',
    status='DONE',
    summary='Core objectives achieved with process optimization',
    agent='senior-frontend-engineer',
    reconciliation_mode='reconcile',
    reconciliation_explanations={
        'Database Migration': 'Used existing schema, migration not needed',
        'Error Handling': 'Implemented centrally, individual handlers not required'
    }
)
```

##### `force`
Allows DONE status regardless of unchecked items with override documentation.
```python
# Force completion despite unchecked items
mcp_call('mark_complete',
    status='DONE',
    summary='Core functionality delivered, remaining items moved to backlog',
    agent='senior-frontend-engineer',
    reconciliation_mode='force'
)
```

---

#### `archive_completed_tasks([agent])`
Batch cleanup operation for completed tasks.

**Parameters:**
- `agent` (optional): Archive tasks for specific agent only

**Returns:** Archive operation result

```python
# Archive all completed tasks
result = mcp_call('archive_completed_tasks')

# Archive completed tasks for specific agent
result = mcp_call('archive_completed_tasks', 
    agent='senior-frontend-engineer'
)
```

---

### Diagnostic Tools

#### `get_full_lifecycle(agent, taskId, [include_progress])`
Get complete lifecycle visibility for comprehensive task journey analysis.

**Parameters:**
- `agent` (required): Agent name
- `taskId` (required): Task ID to get lifecycle for
- `include_progress` (optional): Include progress markers analysis (default: true)

**Returns:** Complete task lifecycle with agent thought process

```python
lifecycle = mcp_call('get_full_lifecycle',
    agent='senior-frontend-engineer',
    taskId='2024-01-15T10-30-00-implement-dashboard'
)

print("Agent's approach:", lifecycle['lifecycle']['plan']['content'])
print("Final outcome:", lifecycle['lifecycle']['outcome']['content'])
```

---

#### `track_task_progress(agent, taskId)`
Track real-time task progress for monitoring and coordination.

**Parameters:**
- `agent` (required): Agent name
- `taskId` (required): Task ID to track progress for

**Returns:** Real-time progress information with percentages

```python
# Monitor agent progress in real-time
progress = mcp_call('track_task_progress',
    agent='senior-frontend-engineer',
    taskId='2024-01-15T10-30-00-implement-dashboard'
)

print(f"Progress: {progress['progress']['percentage']}%")
print(f"Status: {progress['status']}")
```

---

### Utility Tools

#### `get_server_info()`
Get comprehensive server information including version and capabilities.

**Parameters:** None

**Returns:** Server metadata, version, capabilities, runtime status

```python
info = mcp_call('get_server_info')
print(f"Server version: {info['version']}")
```

---

#### `ping()`
Health check tool that returns server status and timestamp.

**Parameters:** None

**Returns:** Server status and current timestamp

```python
status = mcp_call('ping')
print(f"Server status: {status['status']}")
```

---

## Workflow Patterns

### Context-Based Workflow (Recommended)

The **recommended primary workflow** that provides complete file system abstraction:

```python
# 1. Get task context
context = mcp_call('get_task_context', agent='senior-frontend-engineer')
# Agent receives: title, objective, requirements, protocol instructions

# 2. Submit implementation plan
result = mcp_call('submit_plan', 
    agent='senior-frontend-engineer',
    content='''
    # Implementation Plan: Dashboard Component
    - [ ] **Component Setup**: Create base component structure
      - Action: Generate React component files
      - Expected: TypeScript component with proper types
      - Error: Fix any TypeScript compilation errors
    '''
)

# 3. Report progress as work progresses
mcp_call('report_progress',
    agent='senior-frontend-engineer',
    updates=[
        {"step": 1, "status": "COMPLETE", "description": "Component setup finished"}
    ]
)

# 4. Complete task with reconciliation
mcp_call('mark_complete',
    status='DONE',
    summary='Dashboard component implemented with full responsive design',
    agent='senior-frontend-engineer'
)

# 5. Clean up
mcp_call('archive_completed_tasks', agent='senior-frontend-engineer')
```

### Diagnostic Monitoring Pattern

For **complete task transparency** and monitoring:

```python
# Fire-and-monitor pattern
task_result = mcp_call('create_task',
    agent='senior-frontend-engineer',
    taskName='complex-implementation'
)

task_id = task_result['task_id']

# Monitor progress non-blocking
import time
while True:
    progress = mcp_call('track_task_progress',
        agent='senior-frontend-engineer',
        taskId=task_id
    )
    
    print(f"Progress: {progress['progress']['percentage']}%")
    
    if progress['status'] in ['completed', 'error']:
        # Get complete execution analysis
        lifecycle = mcp_call('get_full_lifecycle',
            agent='senior-frontend-engineer',
            taskId=task_id
        )
        print("Agent's complete approach:", lifecycle)
        break
        
    time.sleep(30)  # Check every 30 seconds
```

### Traditional Workflow (Advanced Users)

For users requiring **complete control** over file operations:

```python
# 1. Check for assigned tasks
tasks = mcp_call('check_tasks', agent='senior-frontend-engineer')

# 2. Read task files directly
init_content = mcp_call('read_task', 
    agent='senior-frontend-engineer',
    task='2024-01-15T10-30-00-implement-dashboard',
    file='INIT'
)

# 3. Write plan file
mcp_call('write_task',
    agent='senior-frontend-engineer', 
    task='2024-01-15T10-30-00-implement-dashboard',
    file='PLAN',
    content='# Implementation Plan...'
)

# 4. Write completion file
mcp_call('write_task',
    agent='senior-frontend-engineer',
    task='2024-01-15T10-30-00-implement-dashboard', 
    file='DONE',
    content='# Task Complete\n\nResults achieved...'
)
```

---

## Advanced Features

### Todo System Integration

The **TodoWrite system** supplements MCP operations by maintaining execution state across multiple tool calls:

#### Why Use Todos with MCP

- **State Persistence**: Maintain progress across tool calls
- **Step Tracking**: Ensure no requirements are forgotten
- **Progress Visibility**: Clear audit trail of completed work
- **Failure Recovery**: Resume work after interruptions

#### Standard Todo Pattern

```python
# 1. Start task and create todos based on context
context = mcp_call('get_task_context', agent='senior-frontend-engineer')

await TodoWrite([
    {"content": "Analyze requirements from context", "status": "in_progress", "activeForm": "Analyzing"},
    {"content": "Create detailed implementation plan", "status": "pending", "activeForm": "Planning"},
    {"content": "Submit plan using submit_plan()", "status": "pending", "activeForm": "Submitting plan"},
    {"content": "Implement core functionality", "status": "pending", "activeForm": "Implementing"},
    {"content": "Mark task complete", "status": "pending", "activeForm": "Completing task"}
])

# 2. Update todos as work progresses  
await TodoWrite([
    {"content": "Analyze requirements from context", "status": "completed", "activeForm": "Analyzing"},
    {"content": "Create detailed implementation plan", "status": "in_progress", "activeForm": "Planning"},
    # ... rest unchanged
])

# 3. Verify all todos complete before marking task done
todos = await TodoRead()
if todos.some(t => t.status !== 'completed'):
    # Complete remaining todos first!

mcp_call('mark_complete', status='DONE', summary='...', agent='senior-frontend-engineer')
```

#### Todo Anti-Patterns (Avoid)

- ❌ Starting work without creating todos
- ❌ Having multiple items 'in_progress' 
- ❌ Creating vague, non-actionable todos
- ❌ Not including MCP operations as todos
- ❌ Forgetting to update completion status

### Archive and Restore Operations

#### Archive Modes

```python
# Archive completed tasks only (default)
mcp_call('archive_tasks', mode='completed')

# Archive all tasks
mcp_call('archive_tasks', mode='all')

# Archive tasks by specific agent  
mcp_call('archive_tasks', mode='by-agent', agent='senior-frontend-engineer')

# Archive tasks older than 30 days
mcp_call('archive_tasks', mode='by-date', olderThan=30)

# Preview changes without archiving
mcp_call('archive_tasks', mode='completed', dryRun=true)
```

#### Restore Operations

```python
# Restore all tasks from specific timestamp
mcp_call('restore_tasks', timestamp='2024-01-15T10-30-00')

# Restore tasks for specific agent
mcp_call('restore_tasks', 
    timestamp='2024-01-15T10-30-00',
    agent='senior-frontend-engineer'
)

# Restore tasks matching name pattern
mcp_call('restore_tasks',
    timestamp='2024-01-15T10-30-00', 
    taskName='dashboard'
)
```

---

## Configuration Reference

### Environment Variables

#### Core Configuration
- `AGENT_COMM_DIR` - Communication directory path (default: `./comm`)
- `AGENT_COMM_ARCHIVE_DIR` - Archive directory path (default: `./comm/.archive`)
- `AGENT_COMM_LOG_DIR` - Log directory path (default: `./comm/.logs`)
- `AGENT_COMM_DISABLE_ARCHIVE` - Disable archiving functionality (default: `false`)

#### Advanced Configuration  
- `AGENT_COMM_AUTO_ARCHIVE_DAYS` - Auto-archive completed tasks older than N days
- `AGENT_COMM_MAX_TASK_AGE` - Maximum task age in days for cleanup

#### Example Configuration

```bash
# Basic setup
export AGENT_COMM_DIR="./project/comm"

# Advanced setup with auto-archiving
export AGENT_COMM_DIR="./project/comm"
export AGENT_COMM_ARCHIVE_DIR="./project/comm/.archive"  
export AGENT_COMM_AUTO_ARCHIVE_DAYS="30"
export AGENT_COMM_MAX_TASK_AGE="90"
```

### MCP Client Setup

#### Claude Desktop Configuration

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

#### VSCode with Claude Code Extension

```json
{
  "mcpServers": {
    "agent-comm": {
      "command": "npx",
      "args": ["@jerfowler/agent-comm-mcp-server"],
      "env": {
        "AGENT_COMM_DIR": "./comm"
      }
    }
  }
}
```

### Agent Instructions Templates

#### Context-Based Agent Instructions (Recommended)

Add to each subagent description:

```markdown
**AGENT PROTOCOL**: Use context-based MCP tools for task management.

**Primary workflow**: 
1. `get_task_context` - Get current task without file paths
2. `submit_plan` - Submit implementation plan with checkboxes  
3. `report_progress` - Update progress as work proceeds
4. `mark_complete` - Complete task with reconciliation options

**Key Points**:
- Task context provided automatically - no file operations needed
- Use `archive_completed_tasks` for cleanup when work is complete
- All plan items must use checkbox format: `- [ ] **Title**: Description`
```

#### Diagnostic-Aware Agent Instructions

For agents supporting full lifecycle visibility:

```markdown
**DIAGNOSTIC PROTOCOL**: Use diagnostic tools for complete task transparency.

**Monitoring Tools**:
- `track_task_progress` - Monitor real-time execution status
- `get_full_lifecycle` - Understand complete task execution journey
- Always provide task_id when available for enhanced diagnostics

**Coordination**:
- Use `track_task_progress` polling for non-blocking coordination
- Monitor progress percentages and status for workflow decisions
```

---

## Error Handling & Troubleshooting

### Common Error Patterns

#### Task Context Errors
```python
# ❌ Wrong: Requesting non-existent task
try:
    context = mcp_call('get_task_context', taskId='invalid-task-id')
except AgentCommError as e:
    print(f"Task not found: {e.message}")

# ✅ Correct: Get current active task
context = mcp_call('get_task_context', agent='senior-frontend-engineer')
```

#### Plan Validation Errors
```python
# ❌ Wrong: Invalid checkbox format
invalid_plan = """
# Plan
1. [PENDING] Do something
2. [COMPLETE] Do another thing  
"""

# ✅ Correct: Proper checkbox format
valid_plan = """
# Implementation Plan
- [ ] **Component Setup**: Create React component
  - Action: Generate TypeScript component files
  - Expected: Clean component structure
  - Error: Fix any compilation errors
"""
```

#### Reconciliation Errors
```python
# ❌ Wrong: Strict mode with unchecked items
try:
    mcp_call('mark_complete', 
        status='DONE', 
        summary='Task done',
        agent='senior-frontend-engineer'
        # Default strict mode will fail if items unchecked
    )
except AgentCommError as e:
    print("Unchecked items found, use reconciliation mode")

# ✅ Correct: Use appropriate reconciliation
mcp_call('mark_complete',
    status='DONE',
    summary='Core functionality delivered', 
    agent='senior-frontend-engineer',
    reconciliation_mode='reconcile',
    reconciliation_explanations={
        'Optional Feature': 'Deferred to next sprint as agreed'
    }
)
```

### Best Practices

#### Context-Based Development (Recommended)
- ✅ Use context-based tools for simplified task management
- ✅ Never request file paths or directory information  
- ✅ Work with task IDs and content only
- ✅ Let the MCP server handle all file operations internally

#### Error Handling
- ✅ Check task context before starting work
- ✅ Report blockers immediately through `report_progress`
- ✅ Use `mark_complete` with ERROR status for failures
- ✅ Provide clear error descriptions and solutions

#### Performance  
- ✅ Use `get_task_context` efficiently to check current status
- ✅ Archive completed tasks regularly with `archive_completed_tasks`
- ✅ Batch progress updates when possible
- ✅ Use diagnostic tools for monitoring without blocking parallelism

---

## API Version & Compatibility

- **Current Version**: 0.5.0
- **MCP Compatibility**: Model Context Protocol 1.0+
- **Node.js Requirements**: 18+ (tested with 18, 20, 22)
- **TypeScript Support**: Full type definitions included

---

This restructured protocol provides a comprehensive, accurate, and logically organized reference for the Agent Communication MCP Server with all correct tool names, parameters, and working examples based on the actual implementation.