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

### 🚀 Enhanced Capabilities (v0.6.0)

This version introduces **significant enhancements** for enterprise-grade task management:

#### 🆔 Enhanced Task Management
- **Optional `taskId` parameters** in `submit_plan`, `report_progress`, `mark_complete`
- **Explicit task targeting** - work with any task by ID without changing context
- **Flexible multi-task workflows** - concurrent task operations and any-order completion
- **Current task tracking** with automatic fallback to active tasks

#### 🔒 Strict Agent Ownership Validation  
- **AgentOwnershipError** class with detailed ownership information
- **Elimination of "default-agent"** fallback mechanism for security
- **Comprehensive audit logging** for all ownership operations
- **Cross-agent task protection** prevents unauthorized modifications

#### 🎯 MCP Prompts Integration
- **5 dynamic prompts** compliant with MCP 2025-06-18 specification
- **Context-aware content generation** based on agent state and tasks
- **Multi-modal support** with embedded resources and code examples  
- **Error-specific troubleshooting** guides with real-time context

#### 📊 Advanced Workflow Support
- **Parallel task execution** across multiple agents
- **Task context switching** for priority-based work management
- **Coordinated multi-agent workflows** with dependency handling
- **Dynamic task prioritization** with flexible scheduling

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
- `agent` (optional): **REQUIRED** - Agent name (**"default-agent" no longer supported**)

**⚠️ BREAKING CHANGE (v0.6.0)**
The `agent` parameter is now **effectively required** due to strict ownership validation:
- **"default-agent" eliminated** for security reasons
- **AgentOwnershipError** thrown for invalid agent names
- **Must specify actual agent** (e.g., "senior-frontend-engineer")

**Returns:** TaskContext with title, objective, requirements, protocol instructions

```python
# Example 1: Get current active task context
context = mcp_call('get_task_context', agent='senior-frontend-engineer')

# Example 2: Get specific task context  
context = mcp_call('get_task_context',
    agent='senior-frontend-engineer',
    taskId='2024-01-15T10-30-00-implement-dashboard'
)

# Example 3: **NEW** - Multi-task context switching
# Get context for Task A
context_a = mcp_call('get_task_context',
    agent='senior-backend-engineer',
    taskId='task-a-database-migration'
)

# Switch to Task B context
context_b = mcp_call('get_task_context',
    agent='senior-backend-engineer', 
    taskId='task-b-api-endpoints'
)

# Work with both contexts as needed
print(f"Task A status: {context_a['status']}")
print(f"Task B status: {context_b['status']}")

# ❌ This will now throw AgentOwnershipError
# context = mcp_call('get_task_context', agent='default-agent')
```

---

#### `submit_plan(content, agent, taskId?)`
Submit implementation plan content with automatic file creation.

**Parameters:**
- `content` (required): Plan content with **mandatory checkbox format**
- `agent` (required): Agent name submitting the plan
- `taskId` (optional): Specific task ID to target (defaults to current active task)

**Returns:** Plan submission result with steps identified

```python
# Example 1: Submit to current active task (default)
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

# Example 2: Submit to specific task using taskId
result = mcp_call('submit_plan',
    agent='senior-frontend-engineer',
    taskId='task-2024-01-15-dashboard-implementation',
    content="# Plan for specific task...")
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

#### `report_progress(updates, agent, taskId?)`
Report progress updates on specific plan steps.

**Parameters:**
- `updates` (required): Array of step updates
- `agent` (required): Agent name reporting progress
- `taskId` (optional): Specific task ID to target (defaults to current active task)

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

#### `mark_complete(status, summary, agent, taskId?, [reconciliation_mode], [reconciliation_explanations])`
Mark task as complete with **intelligent reconciliation** for unchecked plan items.

**Parameters:**
- `status` (required): "DONE" | "ERROR"
- `summary` (required): Completion summary (minimum 10 characters)
- `agent` (required): Agent name completing the task
- `taskId` (optional): Specific task ID to target (defaults to current active task)
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

### 🔄 Multi-Task Workflow (v0.6.0)

**NEW**: Enhanced multi-task management enables concurrent task operations and flexible workflows.

#### Pattern 1: Parallel Task Execution

```python
# 1. Create multiple tasks for different components
frontend_task = mcp_call('create_task',
    agent='senior-frontend-engineer',
    taskName='dashboard-component',
    content='# Frontend: Dashboard Component Implementation'
)

backend_task = mcp_call('create_task', 
    agent='senior-backend-engineer',
    taskName='user-api-endpoints',
    content='# Backend: User Management API'
)

database_task = mcp_call('create_task',
    agent='senior-dba-advisor', 
    taskName='user-schema-migration',
    content='# Database: User Schema Updates'
)

# 2. Submit plans for each task concurrently
mcp_call('submit_plan',
    agent='senior-frontend-engineer',
    taskId=frontend_task['taskId'],
    content='''
    # Frontend Implementation Plan
    - [ ] **Component Architecture**: Design React components
    - [ ] **State Management**: Implement Redux store
    - [ ] **API Integration**: Connect to backend services
    '''
)

mcp_call('submit_plan',
    agent='senior-backend-engineer', 
    taskId=backend_task['taskId'],
    content='''
    # Backend Implementation Plan
    - [ ] **API Design**: Define REST endpoints
    - [ ] **Database Models**: Create user entities
    - [ ] **Authentication**: Implement JWT middleware
    '''
)

# 3. Report progress independently on each task
# Frontend progress
mcp_call('report_progress',
    agent='senior-frontend-engineer',
    taskId=frontend_task['taskId'],
    updates=[{"step": 1, "status": "COMPLETE", "description": "Component architecture defined"}]
)

# Backend progress (different task, different timing)
mcp_call('report_progress',
    agent='senior-backend-engineer',
    taskId=backend_task['taskId'], 
    updates=[{"step": 1, "status": "IN_PROGRESS", "description": "Working on API design"}]
)

# 4. Complete tasks as they finish (any order)
# Backend finishes first
mcp_call('mark_complete',
    agent='senior-backend-engineer',
    taskId=backend_task['taskId'],
    status='DONE',
    summary='API endpoints completed and tested'
)

# Frontend finishes later
mcp_call('mark_complete', 
    agent='senior-frontend-engineer',
    taskId=frontend_task['taskId'],
    status='DONE', 
    summary='Dashboard component fully implemented'
)
```

#### Pattern 2: Task Context Switching

```python
# Agent working on multiple tasks simultaneously
agent = 'senior-system-architect'

# Create two architectural tasks
task_a = mcp_call('create_task', agent=agent, taskName='microservices-design')
task_b = mcp_call('create_task', agent=agent, taskName='security-architecture')

# Switch between tasks based on priority/blockers
# Work on Task A
context_a = mcp_call('get_task_context', agent=agent, taskId='microservices-design')
mcp_call('submit_plan', agent=agent, taskId='microservices-design', content='# Microservices Plan...')

# Switch to Task B when blocked on Task A  
context_b = mcp_call('get_task_context', agent=agent, taskId='security-architecture')
mcp_call('submit_plan', agent=agent, taskId='security-architecture', content='# Security Plan...')

# Back to Task A when unblocked
mcp_call('report_progress', 
    agent=agent,
    taskId='microservices-design',
    updates=[{"step": 2, "status": "COMPLETE", "description": "Service boundaries defined"}]
)

# Continue with Task B
mcp_call('report_progress',
    agent=agent, 
    taskId='security-architecture',
    updates=[{"step": 1, "status": "COMPLETE", "description": "Threat model completed"}]
)
```

#### Pattern 3: Coordinated Multi-Agent Workflow

```python
# Coordinated development with dependencies
def coordinate_feature_development():
    # Phase 1: Database setup (prerequisite for backend)
    db_task = mcp_call('create_task',
        agent='senior-dba-advisor',
        taskName='user-tables-creation'
    )
    
    mcp_call('submit_plan', agent='senior-dba-advisor', 
             taskId=db_task['taskId'], content='# Database Plan...')
    
    # Wait for database completion (in real scenario, use polling)
    mcp_call('mark_complete', agent='senior-dba-advisor',
             taskId=db_task['taskId'], status='DONE', summary='Tables created')
    
    # Phase 2: Backend development (depends on database)
    backend_task = mcp_call('create_task',
        agent='senior-backend-engineer',
        taskName='user-service-api'  
    )
    
    # Phase 3: Frontend development (can start independently)
    frontend_task = mcp_call('create_task',
        agent='senior-frontend-engineer',
        taskName='user-interface-components'
    )
    
    # Concurrent backend and frontend work
    mcp_call('submit_plan', agent='senior-backend-engineer',
             taskId=backend_task['taskId'], content='# Backend API Plan...')
    
    mcp_call('submit_plan', agent='senior-frontend-engineer', 
             taskId=frontend_task['taskId'], content='# Frontend UI Plan...')
    
    # Each agent reports progress independently
    return {
        'database': db_task['taskId'],
        'backend': backend_task['taskId'], 
        'frontend': frontend_task['taskId']
    }

# Execute coordinated workflow
task_ids = coordinate_feature_development()
```

#### Pattern 4: Dynamic Task Prioritization

```python
# Agent managing multiple tasks with changing priorities
class TaskManager:
    def __init__(self, agent_name):
        self.agent = agent_name
        self.active_tasks = []
    
    def create_task(self, name, priority='medium'):
        task = mcp_call('create_task', agent=self.agent, taskName=name)
        self.active_tasks.append({
            'id': task['taskId'],
            'name': name,
            'priority': priority,
            'status': 'created'
        })
        return task['taskId']
    
    def work_on_highest_priority(self):
        # Sort by priority
        high_priority = [t for t in self.active_tasks if t['priority'] == 'high']
        
        if high_priority:
            task = high_priority[0]
            
            # Get context for high priority task
            context = mcp_call('get_task_context', 
                agent=self.agent, 
                taskId=task['id']
            )
            
            # Work on it
            if not task.get('planned'):
                mcp_call('submit_plan', 
                    agent=self.agent,
                    taskId=task['id'],
                    content=f'# High Priority Plan for {task["name"]}...'
                )
                task['planned'] = True
            
            return task['id']
    
    def update_priority(self, task_name, new_priority):
        for task in self.active_tasks:
            if task['name'] == task_name:
                task['priority'] = new_priority
                break

# Usage
manager = TaskManager('senior-frontend-engineer')
task1 = manager.create_task('feature-a', 'low')
task2 = manager.create_task('bug-fix-critical', 'high')  # Higher priority

# Work on highest priority first
current_task = manager.work_on_highest_priority()  # Returns bug-fix-critical

# Priority changes dynamically
manager.update_priority('feature-a', 'high')
current_task = manager.work_on_highest_priority()  # Could switch to feature-a
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

#### `sync_todo_checkboxes(agent, todoUpdates, [taskId])`
**TodoWrite Integration tool** - syncs TodoWrite changes to PLAN.md checkboxes automatically.

**Parameters:**
- `agent` (required): Agent name for which to sync todo updates
- `todoUpdates` (required): Array of todo update objects with title and status
- `taskId` (optional): Specific task ID to target. If not provided, uses the most recent task for the agent.

**Todo Update Format:**
```typescript
{
  title: string,    // Todo title to match against PLAN.md checkboxes  
  status: "pending" | "in_progress" | "completed"
}
```

**Three-State Checkbox Mapping:**
- `[ ]` (pending) ← maps to TodoWrite "pending" status
- `[~]` (in_progress) ← maps to TodoWrite "in_progress" status  
- `[x]` (completed) ← maps to TodoWrite "completed" status

**Usage Example:**
```python
# Update TodoWrite todos
await TodoWrite([
    {"content": "Parse requirements", "status": "completed", "activeForm": "Parsing"},
    {"content": "Submit plan", "status": "in_progress", "activeForm": "Submitting"},
    {"content": "Implement features", "status": "pending", "activeForm": "Implementing"}
])

# Sync changes to PLAN.md checkboxes (auto-detect most recent task)
mcp_call('sync_todo_checkboxes',
    agent='senior-frontend-engineer',
    todoUpdates=[
        {"title": "Parse requirements", "status": "completed"},
        {"title": "Submit plan", "status": "in_progress"}, 
        {"title": "Implement features", "status": "pending"}
    ]
)

# Target specific task by ID
mcp_call('sync_todo_checkboxes',
    agent='senior-frontend-engineer',
    taskId='implement-dashboard-20241205-143012',
    todoUpdates=[
        {"title": "Component setup", "status": "completed"},
        {"title": "API integration", "status": "in_progress"}
    ]
)
```

**Integration Workflow:**
1. **Automatic Detection**: TodoWrite PostToolUse hook detects todo changes
2. **Reminder Message**: Hook displays sync reminder to Claude
3. **Manual Sync**: Use `sync_todo_checkboxes()` to update PLAN.md
4. **Fuzzy Matching**: Tool uses 60% similarity threshold for checkbox matching
5. **Lock Coordination**: Prevents conflicts with other MCP operations

**Key Benefits:**
- ✅ Maintains consistency between TodoWrite and PLAN.md
- ✅ Preserves agent task visibility and progress tracking  
- ✅ Automatic conflict resolution with lock coordination
- ✅ Fuzzy matching handles minor title variations
- ✅ Non-blocking integration preserves Claude Code parallelism

## TodoWrite Hook Installation & Configuration

The TodoWrite integration includes an optional PostToolUse hook that automatically detects todo changes and provides sync reminders. This section covers complete installation, configuration, and troubleshooting.

### Hook Architecture

**Hook Trigger:** PostToolUse event from Claude Code TodoWrite tool
**Hook Type:** Python script with exit code signaling
**Integration Pattern:** Non-disruptive reminder system with exit code 2

```
TodoWrite Tool → Hook Execution → MCP Server Integration
     ↓                ↓                     ↓
Todos Updated → Analysis & Reminder → sync_todo_checkboxes()
```

### Installation Steps

#### 1. Locate Hook File

The hook is included with your agent-comm-mcp-server installation:

```bash
# Global installation path
find /usr/local/lib/node_modules/@jerfowler/agent-comm-mcp-server/.claude/hooks/ -name "*.py"

# Local installation path  
find ./node_modules/@jerfowler/agent-comm-mcp-server/.claude/hooks/ -name "*.py"

# From source installation
ls .claude/hooks/sync-todos-to-checkboxes.py
```

#### 2. Copy to Claude Code Hooks Directory

```bash
# Create hooks directory if it doesn't exist
mkdir -p ~/.claude/hooks

# Copy the hook (adjust path based on your installation)
cp node_modules/@jerfowler/agent-comm-mcp-server/.claude/hooks/sync-todos-to-checkboxes.py ~/.claude/hooks/

# Make executable
chmod +x ~/.claude/hooks/sync-todos-to-checkboxes.py
```

#### 3. Verify Installation

```bash
# Test with sample todo data (recommended first test)
echo '{"tool":{"name":"TodoWrite"},"result":{"todos":[{"content":"Test todo","status":"pending","activeForm":"Testing"}]}}' | python3 ~/.claude/hooks/sync-todos-to-checkboxes.py

# Expected output:
# TodoWrite updated 1 todo: 0 completed, 0 in-progress, 1 pending.
# 
# Remember to sync to your task checkboxes using the agent-comm MCP if you have an active task.

# Test with empty todos (should be silent)
echo '{"tool":{"name":"TodoWrite"},"result":{"todos":[]}}' | python3 ~/.claude/hooks/sync-todos-to-checkboxes.py

# Expected: Silent exit (no output)
```

### Hook Configuration Options

The hook accepts several configuration patterns through environment variables:

#### Environment Variables

```bash
# Enable debug output (default: false)
export AGENT_COMM_HOOK_DEBUG=true

# Custom MCP server name (default: agent-comm)
export AGENT_COMM_MCP_SERVER=my-agent-comm

# Disable hook entirely (default: false)  
export AGENT_COMM_HOOK_DISABLE=true
```

#### Hook Behavior Configuration

```python
# Hook configuration options (edit ~/.claude/hooks/sync-todos-to-checkboxes.py)

# Minimum todos to trigger reminder (default: 1)
MIN_TODOS_FOR_REMINDER = 1

# Show detailed state breakdown (default: True)
SHOW_STATE_SUMMARY = True

# Exit code for Claude Code integration (default: 2)
HOOK_SUCCESS_EXIT_CODE = 2
```

### Integration Workflow

#### 1. Automatic Detection

When you use TodoWrite in Claude Code:
```python
TodoWrite([
    {"content": "Implement authentication", "status": "completed", "activeForm": "Implementing"},
    {"content": "Add error handling", "status": "in_progress", "activeForm": "Adding"},
    {"content": "Write unit tests", "status": "pending", "activeForm": "Writing"}
])
```

#### 2. Hook Execution

The hook automatically:
- Parses todo data structure
- Counts state distribution (pending/in_progress/completed)  
- Determines if sync reminder is warranted
- Outputs reminder message with tool usage guidance
- Returns exit code 2 (success with info)

#### 3. MCP Tool Usage

Follow the hook's guidance to sync:
```python
# Use the suggested MCP tool call
mcp_call('sync_todo_checkboxes',
    agent='current-agent',
    todoUpdates=[
        {"title": "Implement authentication", "status": "completed"},
        {"title": "Add error handling", "status": "in_progress"}, 
        {"title": "Write unit tests", "status": "pending"}
    ]
)
```

### Advanced Configuration

#### Custom Hook Behavior

Create a custom hook configuration by editing the installed file:

```python
# ~/.claude/hooks/sync-todos-to-checkboxes.py

# Custom reminder thresholds
def should_show_reminder(state_counts):
    total_todos = sum(state_counts.values())
    completed_count = state_counts.get('completed', 0)
    
    # Only remind if there are completed todos to sync
    return completed_count > 0 and total_todos >= 2

# Custom output formatting  
def format_reminder(state_counts):
    total = sum(state_counts.values())
    return f"🔄 Ready to sync {total} todos to agent checkboxes"
```

#### Integration with Multiple Agents

For complex multi-agent workflows:

```python
# Hook can suggest agent-specific syncing
def detect_likely_agent(todos):
    # Analyze todo content for agent hints
    if any("frontend" in todo.get('content', '').lower() for todo in todos):
        return "senior-frontend-engineer"
    elif any("backend" in todo.get('content', '').lower() for todo in todos):  
        return "senior-backend-engineer"
    return "detected-agent-name"
```

### Troubleshooting

#### Common Issues

**Issue: Hook not executing**
```bash
# Check hook permissions
ls -la ~/.claude/hooks/sync-todos-to-checkboxes.py
# Should show: -rwxr-xr-x (executable)

# Check Python availability
which python
python --version
```

**Issue: Permission denied**
```bash
# Fix permissions
chmod +x ~/.claude/hooks/sync-todos-to-checkboxes.py

# Check directory permissions  
ls -la ~/.claude/
mkdir -p ~/.claude/hooks
```

**Issue: Hook executes but no output**
```bash
# Enable debug mode
export AGENT_COMM_HOOK_DEBUG=true

# Test with verbose output
echo '{"tool":{"name":"TodoWrite"},"result":{"todos":[{"content":"test","status":"pending","activeForm":"testing"}]}}' | python3 ~/.claude/hooks/sync-todos-to-checkboxes.py
```

#### Debug Mode

Enable comprehensive debugging:

```python
# Edit hook file to enable debug output
DEBUG = True  # Set this at top of hook file

# Test with debug enabled
export AGENT_COMM_HOOK_DEBUG=true
python ~/.claude/hooks/sync-todos-to-checkboxes.py '[...]' 'debug-data'
```

#### Hook Validation Script

Create a validation script to test your hook installation:

```bash
#!/bin/bash
# validate-hook.sh

echo "Testing TodoWrite Hook Installation..."

HOOK_FILE="$HOME/.claude/hooks/sync-todos-to-checkboxes.py"

if [ ! -f "$HOOK_FILE" ]; then
    echo "❌ Hook file not found at $HOOK_FILE"
    exit 1
fi

if [ ! -x "$HOOK_FILE" ]; then
    echo "❌ Hook file not executable"
    exit 1  
fi

# Test basic execution
echo "Testing basic execution..."
echo '{"tool":{"name":"TodoWrite"},"result":{"todos":[]}}' | python3 "$HOOK_FILE"
echo "Exit code: $?"

# Test with todo data
echo "Testing with sample todos..."
echo '{"tool":{"name":"TodoWrite"},"result":{"todos":[{"content":"Test todo","status":"completed","activeForm":"Testing"}]}}' | python3 "$HOOK_FILE"
echo "Exit code: $?"

echo "✅ Hook installation validated"
```

**Automated Verification:** Use our comprehensive verification script:

```bash
# Run the included verification script
./scripts/verify-hook-installation.sh

# Or download and run directly
curl -s https://raw.githubusercontent.com/jerfowler/agent-comm-mcp-server/main/scripts/verify-hook-installation.sh | bash
```

This script performs comprehensive testing including:
- Python environment validation
- Hook file installation and permissions  
- Functionality testing with various todo scenarios
- Performance benchmarking
- Debug mode validation

### Performance Considerations

#### Hook Execution Time

The hook is designed for minimal overhead:
- **Execution time**: <50ms typical
- **Memory usage**: <5MB Python interpreter
- **CPU impact**: Negligible (simple JSON parsing)

#### Scaling for Large Todo Lists

For workflows with many todos:

```python
# Hook includes optimizations for large datasets
MAX_TODOS_TO_PROCESS = 50  # Prevents performance issues
BATCH_SIZE = 10           # Process in batches if needed
```

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

#### 🔒 Agent Ownership Validation Errors (v0.6.0)

**NEW**: Strict ownership validation prevents agents from modifying tasks they don't own.

```python
# ❌ Wrong: Using "default-agent" placeholder
try:
    context = mcp_call('get_task_context', agent='default-agent')
except AgentOwnershipError as e:
    print(f"Ownership validation failed: {e.message}")
    print(f"Agent: {e.agent}")
    print(f"Task: {e.task_id}")
    print(f"Actual Owner: {e.actual_owner}")

# ✅ Correct: Use actual agent name
context = mcp_call('get_task_context', agent='senior-frontend-engineer')
```

**AgentOwnershipError Details:**
- **Error Type**: `AgentOwnershipError` (extends `AgentCommError`)
- **When Thrown**: Agent attempts to access task owned by another agent
- **Contains**: Agent name, task ID, actual owner information
- **Solution**: Use correct agent name that owns the task

```python
# Example: Handling ownership validation errors
try:
    mcp_call('submit_plan', 
        agent='senior-backend-engineer',  # Wrong agent
        taskId='frontend-task-created-by-other-agent',
        content='# Plan...'
    )
except AgentOwnershipError as e:
    # Get the correct owner
    correct_agent = e.actual_owner
    print(f"Task '{e.task_id}' is owned by '{correct_agent}', not '{e.agent}'")
    
    # Use correct agent or delegate properly
    mcp_call('submit_plan',
        agent=correct_agent,  # Use actual owner
        taskId=e.task_id,
        content='# Plan...'
    )
```

**Common Ownership Issues:**

1. **"default-agent" Error**
   ```python
   # ❌ This always fails now
   mcp_call('create_task', agent='default-agent', taskName='task')
   
   # ✅ Use specific agent
   mcp_call('create_task', agent='senior-frontend-engineer', taskName='task')
   ```

2. **Cross-Agent Task Access**
   ```python
   # ❌ Agent A trying to modify Agent B's task
   mcp_call('mark_complete', 
       agent='senior-backend-engineer',    # Agent A
       taskId='frontend-task-123',         # Belongs to Agent B
       status='DONE')
   
   # ✅ Only the task owner can modify it
   mcp_call('mark_complete',
       agent='senior-frontend-engineer',   # Correct owner
       taskId='frontend-task-123', 
       status='DONE')
   ```

3. **Multi-Task Ownership Confusion**
   ```python
   # ❌ Wrong: Agent trying to complete task with wrong ownership
   try:
       for task_id in ['task-a', 'task-b', 'task-c']:
           mcp_call('mark_complete',
               agent='senior-backend-engineer',  # Same agent for all
               taskId=task_id,
               status='DONE')
   except AgentOwnershipError as e:
       print(f"Task {e.task_id} belongs to {e.actual_owner}, not {e.agent}")
   
   # ✅ Correct: Use appropriate agent for each task
   task_ownership = {
       'task-a': 'senior-frontend-engineer',
       'task-b': 'senior-backend-engineer', 
       'task-c': 'senior-system-architect'
   }
   
   for task_id, owner in task_ownership.items():
       mcp_call('mark_complete',
           agent=owner,        # Correct owner for each task
           taskId=task_id,
           status='DONE')
   ```

#### Multi-Task Management Errors (v0.6.0)

**NEW**: Enhanced multi-task workflow support introduces new error patterns.

```python
# ❌ Wrong: Assuming taskId parameter works everywhere
try:
    # This tool doesn't support taskId parameter
    mcp_call('list_agents', taskId='some-task')
except TypeError as e:
    print("taskId parameter not supported for this tool")

# ✅ Correct: Check tool documentation for parameter support
mcp_call('list_agents')  # No taskId needed

# Tools that DO support optional taskId:
tools_with_taskid = [
    'get_task_context',
    'submit_plan', 
    'report_progress',
    'mark_complete'
]
```

**Flexible Workflow Patterns:**
```python
# ✅ Correct: Any-order operations
# Create multiple tasks
task_a = mcp_call('create_task', agent='agent', taskName='task-a')
task_b = mcp_call('create_task', agent='agent', taskName='task-b')

# Work on A, then B, then back to A
mcp_call('submit_plan', agent='agent', taskId='task-a', content='Plan A')
mcp_call('submit_plan', agent='agent', taskId='task-b', content='Plan B')
mcp_call('report_progress', agent='agent', taskId='task-a', updates=[...])
```

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

## MCP Prompts System (v0.6.0)

The agent-comm MCP server now includes a comprehensive **MCP Prompts system** compliant with the **MCP 2025-06-18 specification**. This system provides **dynamic, context-aware guidance** for working with the task management protocol.

### Available Prompts

#### 1. `task-workflow-guide`
**Purpose**: Comprehensive workflow guidance for task management  
**Context-Aware**: Shows current agent tasks and progress  
**Use Case**: Getting started with the protocol or understanding best practices

```python
# Get workflow guide for current agent context
prompt = mcp_call('prompts/get', 
    name='task-workflow-guide',
    arguments={'agent': 'senior-frontend-engineer'}
)

# Get workflow guide for specific task
prompt = mcp_call('prompts/get',
    name='task-workflow-guide', 
    arguments={'agent': 'senior-frontend-engineer', 'taskId': 'specific-task-id'}
)
```

#### 2. `agent-validation-requirements`
**Purpose**: Agent ownership validation guidelines and troubleshooting  
**Context-Aware**: Agent-specific validation rules and common issues  
**Use Case**: Resolving ownership validation errors

```python
# Get validation requirements for specific agent
prompt = mcp_call('prompts/get',
    name='agent-validation-requirements',
    arguments={'agent': 'senior-backend-engineer'}
)
```

#### 3. `flexible-task-operations`
**Purpose**: Multi-task workflow patterns and task switching guidance  
**Context-Aware**: Shows current multi-task state and recommendations  
**Use Case**: Managing multiple concurrent tasks

```python
# Get flexible operations guide
prompt = mcp_call('prompts/get',
    name='flexible-task-operations',
    arguments={'agent': 'senior-system-architect'}
)
```

#### 4. `troubleshooting-common-errors`
**Purpose**: Error-specific troubleshooting guides with solutions  
**Context-Aware**: Recent errors and agent-specific issues  
**Use Case**: Debugging specific error conditions

```python
# General troubleshooting
prompt = mcp_call('prompts/get',
    name='troubleshooting-common-errors',
    arguments={'agent': 'senior-frontend-engineer'}
)

# Error-specific guidance
prompt = mcp_call('prompts/get',
    name='troubleshooting-common-errors',
    arguments={'agent': 'senior-frontend-engineer', 'errorType': 'ownership-validation'}
)
```

**Supported Error Types:**
- `default-agent` - "default-agent" usage errors
- `ownership-validation` - Agent ownership validation failures  
- `task-not-found` - Task reference errors

#### 5. `protocol-compliance-checklist`
**Purpose**: Comprehensive compliance checklist with scoring  
**Context-Aware**: Agent-specific compliance metrics and recommendations  
**Use Case**: Ensuring proper protocol usage and identifying issues

```python
# Get compliance checklist with agent scoring
prompt = mcp_call('prompts/get',
    name='protocol-compliance-checklist',
    arguments={'agent': 'qa-test-automation-engineer'}
)
```

### Prompts API Reference

#### `prompts/list`
List all available prompts with metadata.

```python
# List all prompts
prompts = mcp_call('prompts/list')
# Returns: {'prompts': [{'name': '...', 'description': '...', 'arguments': [...]}]}
```

#### `prompts/get`
Get specific prompt content with dynamic generation.

**Parameters:**
- `name` (required): Prompt name from the available list
- `arguments` (optional): Context arguments for dynamic content

**Supported Arguments:**
- `agent` (string): Agent name for context-aware content
- `taskId` (string): Specific task ID for task-specific guidance  
- `errorType` (string): Error type for troubleshooting prompts

**Response Format:**
```typescript
{
  messages: [
    {
      role: 'user',
      content: {
        type: 'text' | 'resource',
        text?: string,
        resource?: {
          uri: string,
          mimeType: string,
          text?: string,
          blob?: string
        }
      }
    }
  ]
}
```

### Multi-Modal Prompt Content

Prompts support **embedded resources** for rich content delivery:

- **Text Content**: Markdown-formatted guidance and instructions
- **Resource Content**: Code examples, workflow diagrams, and templates
- **Context Integration**: Real-time agent status and task information

### Dynamic Content Generation

The prompt system generates **context-aware content** based on:

- **Current agent state** (active tasks, progress, errors)
- **Task-specific information** (plans, progress markers, completion status)
- **Error context** (recent failures, validation issues)
- **Multi-task coordination** (parallel workflows, dependencies)

### Example Workflow Integration

```python
# 1. Get workflow guidance for new agent
workflow_guide = mcp_call('prompts/get', 
    name='task-workflow-guide',
    arguments={'agent': 'senior-frontend-engineer'}
)

# 2. Check compliance before starting work
compliance = mcp_call('prompts/get',
    name='protocol-compliance-checklist', 
    arguments={'agent': 'senior-frontend-engineer'}
)

# 3. Get troubleshooting help if errors occur
if validation_error:
    troubleshooting = mcp_call('prompts/get',
        name='troubleshooting-common-errors',
        arguments={'agent': 'senior-frontend-engineer', 'errorType': 'ownership-validation'}
    )

# 4. Learn multi-task patterns when needed
multi_task_guide = mcp_call('prompts/get',
    name='flexible-task-operations',
    arguments={'agent': 'senior-frontend-engineer'}
)
```

### Performance and Caching

- **Fast Generation**: Context queries optimized for sub-second response times
- **Error Resilience**: Graceful degradation when context unavailable
- **Minimal Overhead**: Lightweight prompt generation with efficient context extraction

---

## API Version & Compatibility

- **Current Version**: 0.6.0
- **MCP Compatibility**: Model Context Protocol 1.0+
- **Node.js Requirements**: 18+ (tested with 18, 20, 22)
- **TypeScript Support**: Full type definitions included

---

## Migration Guide (v0.5.x → v0.6.0)

### Breaking Changes

#### 1. "default-agent" Elimination
**Previous (v0.5.x):**
```python
# This used to work
context = mcp_call('get_task_context', agent='default-agent')
```

**New (v0.6.0):**
```python
# Now required - specify actual agent
context = mcp_call('get_task_context', agent='senior-frontend-engineer')
```

**Migration Steps:**
1. Replace all `'default-agent'` usage with actual agent names
2. Update agent configuration to specify proper agent identities
3. Test ownership validation with new strict enforcement

#### 2. Enhanced Error Handling
**Previous (v0.5.x):**
```python
# Generic error handling
try:
    mcp_call('submit_plan', ...)
except AgentCommError as e:
    print(f"Error: {e.message}")
```

**New (v0.6.0):**
```python
# Specific ownership error handling
try:
    mcp_call('submit_plan', ...)
except AgentOwnershipError as e:
    print(f"Ownership Error: {e.message}")
    print(f"Task {e.task_id} owned by {e.actual_owner}, not {e.agent}")
    # Handle with correct agent
except AgentCommError as e:
    print(f"General Error: {e.message}")
```

### New Features

#### 1. Optional taskId Parameters
**Backward Compatible** - existing code continues to work:
```python
# Still works (uses current active task)
mcp_call('submit_plan', agent='agent', content='...')

# New capability (target specific task)
mcp_call('submit_plan', agent='agent', taskId='specific-task', content='...')
```

#### 2. MCP Prompts System
**New capability** - completely optional:
```python
# Get contextual guidance
prompt = mcp_call('prompts/get', 
    name='task-workflow-guide', 
    arguments={'agent': 'senior-frontend-engineer'})
```

### Recommended Migration Approach

#### Phase 1: Fix Breaking Changes (Required)
1. **Identify "default-agent" usage**:
   ```bash
   grep -r "default-agent" your-codebase/
   ```

2. **Replace with actual agents**:
   ```python
   # Map your usage patterns
   agent_mapping = {
       'frontend': 'senior-frontend-engineer',
       'backend': 'senior-backend-engineer',
       'database': 'senior-dba-advisor'
   }
   ```

3. **Add specific error handling**:
   ```python
   from agent_comm import AgentOwnershipError
   
   try:
       # Your existing MCP calls
       pass
   except AgentOwnershipError as e:
       # Handle ownership issues
       pass
   ```

#### Phase 2: Adopt New Features (Optional)
1. **Multi-task workflows**:
   ```python
   # Gradually adopt taskId parameters for complex workflows
   if complex_workflow:
       mcp_call('submit_plan', agent=agent, taskId=specific_task, content=plan)
   ```

2. **MCP Prompts integration**:
   ```python
   # Add prompts for user guidance
   if user_needs_help:
       guidance = mcp_call('prompts/get', name='troubleshooting-common-errors')
   ```

### Compatibility Matrix

| Feature | v0.5.x | v0.6.0 | Migration Required |
|---------|--------|--------|--------------------|
| Context-based tools | ✅ | ✅ | No |
| Agent ownership validation | Permissive | Strict | **Yes** |
| "default-agent" usage | ✅ | ❌ | **Yes** |
| taskId parameters | ❌ | ✅ | No (optional) |
| MCP Prompts | ❌ | ✅ | No (optional) |
| Multi-task workflows | Basic | Advanced | No (enhancement) |

### Testing Your Migration

#### 1. Validate Agent Names
```python
# Test agent validation
def test_agent_validation():
    valid_agents = ['senior-frontend-engineer', 'senior-backend-engineer']
    
    for agent in valid_agents:
        try:
            tasks = mcp_call('check_tasks', agent=agent)
            print(f"✅ Agent '{agent}' validated")
        except AgentOwnershipError:
            print(f"❌ Agent '{agent}' validation failed")
```

#### 2. Test Ownership Scenarios
```python
# Test cross-agent access prevention
def test_ownership_protection():
    try:
        # This should fail
        mcp_call('submit_plan', 
            agent='wrong-agent',
            taskId='task-owned-by-other-agent',
            content='...')
        print("❌ Ownership validation not working")
    except AgentOwnershipError:
        print("✅ Ownership validation working correctly")
```

### Support and Resources

- **Migration issues**: Use MCP prompts for troubleshooting guidance
- **Complex workflows**: Reference the new multi-task workflow patterns
- **Error debugging**: Enhanced error messages provide specific remediation steps
- **Performance**: New features maintain backward compatibility performance

---

This comprehensive protocol documentation reflects all enhanced task management capabilities implemented in Issues #23-26, providing enterprise-grade security, flexibility, and user guidance through the MCP Prompts system.