# Agent Communication Protocol - Technical Reference

[![Version](https://img.shields.io/npm/v/@jerfowler/agent-comm-mcp-server?label=NPM%20Version&color=blue)](https://www.npmjs.com/package/@jerfowler/agent-comm-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Version 0.7.0** - Complete technical documentation for the Agent Communication MCP Server

---

## Table of Contents

1. [Quick Start & Overview](#quick-start--overview)
2. [Core Concepts](#core-concepts)
3. [Tool Reference](#tool-reference)
4. [Smart Response System Guide](#smart-response-system-guide)
5. [Workflow Patterns](#workflow-patterns)
6. [Advanced Features](#advanced-features)
7. [Configuration & Troubleshooting](#configuration--troubleshooting)
8. [Migration Guide (v0.6.x → v0.7.0)](#migration-guide-v06x--v070)

---

## Quick Start & Overview

### What This Protocol Provides

The **Agent Communication MCP Server** implements a comprehensive task management protocol for AI agent coordination. Built as a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server, it enables Claude Code to:

- **🎯 Delegate tasks to specialized agents** with complete lifecycle visibility
- **📊 Track agent progress in real-time** without blocking operations
- **🛡️ Maintain secure agent ownership** with strict validation
- **🔄 Provide intelligent completion handling** with plan reconciliation
- **⚡ Support parallel agent workflows** with non-blocking architecture

### Key Capabilities (v0.7.0)

- **Smart Response System**: Progressive guidance that adapts to agent behavior patterns
- **Context-Based Operations**: Agents work with task content only—no file path management
- **Complete Lifecycle Visibility**: Track agent thought processes from INIT → PLAN → PROGRESS → COMPLETION
- **Intelligent Reconciliation**: Flexible task completion handling for real-world plan variations
- **Zero File System Exposure**: Complete abstraction eliminates path-related bugs
- **Non-Blocking Architecture**: Preserves Claude Code parallelism with async-first design

### Installation & Basic Setup

```bash
# Global installation (recommended)
npm install -g @jerfowler/agent-comm-mcp-server

# MCP Client Configuration
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

### Essential Workflow (Context-Based)

```typescript
// 1. Create a task
const task = await mcp.call('create_task', {
  agent: 'senior-frontend-engineer',
  taskName: 'implement-dashboard'
});

// 2. Get task context (recommended starting point)
const context = await mcp.call('get_task_context', {
  agent: 'senior-frontend-engineer'
});

// 3. Submit implementation plan
await mcp.call('submit_plan', {
  agent: 'senior-frontend-engineer',
  content: '# Implementation Plan\n- [ ] **Component Setup**: Create dashboard component...'
});

// 4. Complete task with reconciliation
await mcp.call('mark_complete', {
  agent: 'senior-frontend-engineer',
  status: 'DONE',
  summary: 'Dashboard implemented successfully'
});
```

---

## Core Concepts

### Task Lifecycle

Every task follows a structured lifecycle with automatic file management:

```
INIT → PLAN → PROGRESS → COMPLETION
 ↓      ↓        ↓         ↓
Created → Planned → In Progress → DONE/ERROR
```

**File Structure (Auto-Generated):**
```
comm/
├── {agent-name}/
│   ├── {task-timestamp-name}/
│   │   ├── INIT.md         # Initial task definition
│   │   ├── PLAN.md         # Implementation plan with checkboxes
│   │   ├── PROGRESS.md     # Real-time progress tracking (optional)
│   │   └── DONE.md         # Final outcome (or ERROR.md)
│   └── ...
├── .archive/               # Archived completed tasks
├── .compliance/            # Smart Response System data
└── .logs/                  # Operation audit logs
```

### Agent Communication Patterns

#### Context-Based (Recommended)
- **Complete Abstraction**: Agents receive clean task context without file paths
- **Simplified Development**: No file system management required
- **Automatic Coordination**: System handles all file operations internally
- **Smart Guidance**: Progressive assistance based on agent behavior patterns

#### Traditional (Advanced)
- **Direct File Access**: Complete control over task files and operations
- **Granular Management**: Manual file operations for custom workflows
- **Full Visibility**: Direct access to all task lifecycle files

### Smart Response System Integration

**New in v0.7.0**: Intelligent response enhancement that learns from agent behavior patterns to provide progressively better guidance.

**Key Features:**
- **Progressive Escalation**: Friendly → Warning → Critical → Blocking guidance levels
- **Behavior Learning**: Adapts guidance based on agent compliance patterns
- **Delegation Tracking**: Automatic monitoring of task handoffs between agents
- **Compliance Scoring**: Real-time assessment of agent protocol adherence

---

## Tool Reference

### Context-Based Tools (Recommended Primary Workflow)

#### `get_task_context(agent, [taskId])`
**Primary entry point** - Get clean task context without file path exposure.

**Parameters:**
- `agent` (required): Agent name (e.g., "senior-frontend-engineer")
- `taskId` (optional): Specific task ID. If omitted, returns current active task

**Returns:** TaskContext with title, objective, requirements, protocol instructions

```typescript
// Current active task
const context = await mcp.call('get_task_context', {
  agent: 'senior-frontend-engineer'
});

// Specific task by ID
const context = await mcp.call('get_task_context', {
  agent: 'senior-frontend-engineer',
  taskId: '2024-01-15T10-30-00-implement-dashboard'
});
```

**Enhanced Response Format (v0.7.0):**
```json
{
  "taskId": "2024-01-15T10-30-00-implement-dashboard",
  "title": "Dashboard Implementation",
  "objective": "Create responsive dashboard component",
  "requirements": ["React TypeScript", "Responsive design", "API integration"],
  "status": "INIT",
  "guidance": {
    "next_steps": "Submit your implementation plan with checkboxes",
    "actionable_command": "submit_plan(agent=\"senior-frontend-engineer\", content=\"...\")",
    "contextual_reminder": "Remember to use proper checkbox format: - [ ] **Title**: Description",
    "compliance_level": 85
  }
}
```

#### `submit_plan(agent, content, [taskId])`
Submit implementation plan with mandatory checkbox format and automatic progress tracking.

**Parameters:**
- `agent` (required): Agent name submitting the plan
- `content` (required): Plan content with **mandatory checkbox format**
- `taskId` (optional): Specific task ID (defaults to current active task)

**Returns:** Plan submission result with identified steps and Smart Response guidance

**Required Plan Format:**
```markdown
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
```

**Enhanced Response Example:**
```json
{
  "success": true,
  "stepsIdentified": 2,
  "planValidated": true,
  "guidance": {
    "next_steps": "Begin implementation and sync with TodoWrite",
    "contextual_reminder": "📝 Plan submitted! Remember to use TodoWrite for tracking",
    "compliance_level": 90
  }
}
```

#### `report_progress(agent, updates, [taskId])`
Report progress on specific plan steps with TodoWrite synchronization support.

**Parameters:**
- `agent` (required): Agent name reporting progress
- `updates` (required): Array of step updates
- `taskId` (optional): Specific task ID (defaults to current active task)

**Step Update Format:**
```typescript
{
  step: number;                    // Step number being updated
  status: "COMPLETE" | "IN_PROGRESS" | "PENDING" | "BLOCKED";
  description: string;             // Description of work done
  timeSpent?: number;              // Optional: time in minutes
  estimatedTimeRemaining?: number; // Optional: remaining time
  blocker?: string;                // Optional: blocking issue description
}
```

**Example Usage:**
```typescript
await mcp.call('report_progress', {
  agent: 'senior-frontend-engineer',
  updates: [
    {
      step: 1,
      status: "COMPLETE",
      description: "Component architecture completed with TypeScript interfaces"
    },
    {
      step: 2,
      status: "IN_PROGRESS",
      description: "Setting up state management with Zustand",
      timeSpent: 45,
      estimatedTimeRemaining: 30
    }
  ]
});
```

#### `mark_complete(agent, status, summary, [taskId], [reconciliation_mode], [reconciliation_explanations])`
Mark task as complete with **intelligent reconciliation** for unchecked plan items.

**Parameters:**
- `agent` (required): Agent name completing the task
- `status` (required): "DONE" | "ERROR"
- `summary` (required): Completion summary (minimum 10 characters)
- `taskId` (optional): Specific task ID (defaults to current active task)
- `reconciliation_mode` (optional): "strict" | "auto_complete" | "reconcile" | "force"
- `reconciliation_explanations` (optional): Object mapping unchecked items to explanations

**Reconciliation Modes:**

**`strict` (default)**: Requires all checkboxes checked
```typescript
await mcp.call('mark_complete', {
  agent: 'senior-frontend-engineer',
  status: 'DONE',
  summary: 'Task completed according to plan',
  reconciliation_mode: 'strict'
});
```

**`reconcile`**: Accept completion with explanations for unchecked items
```typescript
await mcp.call('mark_complete', {
  agent: 'senior-frontend-engineer',
  status: 'DONE',
  summary: 'Core objectives achieved with process optimization',
  reconciliation_mode: 'reconcile',
  reconciliation_explanations: {
    'Database Migration': 'Used existing schema, migration not needed',
    'Error Handling': 'Implemented centrally, individual handlers not required'
  }
});
```

### Traditional Task Management Tools

#### `create_task(agent, taskName, [content], [taskType], [parentTask])`
**Unified task creation tool** with duplicate prevention and Smart Response enhancement.

**Parameters:**
- `agent` (required): Target agent name
- `taskName` (required): Clean task name (auto-timestamped internally)
- `content` (optional): Task content in markdown format
- `taskType` (optional): "delegation" | "self" | "subtask" (default: "delegation")
- `parentTask` (optional): Parent task ID for subtasks

**Enhanced Response (v0.7.0):**
```json
{
  "success": true,
  "taskId": "2024-01-15T10-30-00-implement-dashboard",
  "taskType": "delegation",
  "targetAgent": "senior-frontend-engineer",
  "guidance": {
    "next_steps": "Complete delegation by invoking the Task tool",
    "actionable_command": "Task(subagent_type=\"senior-frontend-engineer\", prompt=\"Check MCP task: 2024-01-15T10-30-00-implement-dashboard\")",
    "contextual_reminder": "📋 2-Phase Delegation: ✅ Task Created → ❗ NEXT: Start Subagent",
    "compliance_level": 85,
    "delegation_template": "Task(subagent_type=\"senior-frontend-engineer\", prompt=\"Complete the implementation of dashboard component. MCP Task ID: 2024-01-15T10-30-00-implement-dashboard\")"
  }
}
```

#### `check_tasks(agent)`
Monitor agent task queues and status.

**Parameters:**
- `agent` (required): Agent name

**Returns:** List of assigned tasks with metadata and Smart Response guidance

#### `archive_completed_tasks([agent])`
Batch cleanup operation for completed tasks.

**Parameters:**
- `agent` (optional): Archive tasks for specific agent only

**Returns:** Archive operation result with cleanup summary

### Diagnostic Tools

#### `track_task_progress(agent, taskId)`
Track real-time task progress for monitoring and coordination.

**Parameters:**
- `agent` (required): Agent name
- `taskId` (required): Task ID to track

**Returns:** Real-time progress information with percentages and status

#### `get_full_lifecycle(agent, taskId, [include_progress])`
Get complete lifecycle visibility for comprehensive task journey analysis.

**Parameters:**
- `agent` (required): Agent name
- `taskId` (required): Task ID to analyze
- `include_progress` (optional): Include progress markers analysis (default: true)

**Returns:** Complete task lifecycle with agent thought process

### Utility Tools

#### `get_server_info()`
Get comprehensive server information including version and Smart Response System status.

#### `ping()`
Health check tool with server status and timestamp.

#### `sync_todo_checkboxes(agent, todoUpdates, [taskId])`
**TodoWrite Integration** - Sync TodoWrite changes to PLAN.md checkboxes automatically.

**Parameters:**
- `agent` (required): Agent name for sync operation
- `todoUpdates` (required): Array of todo update objects
- `taskId` (optional): Specific task ID (defaults to most recent task)

---

## Smart Response System Guide

### Overview

**New in v0.7.0**: The Smart Response System is an intelligent enhancement layer that learns from agent behavior patterns to provide progressively better guidance. It operates transparently within the MCP protocol, enhancing responses with contextual guidance without changing core functionality.

### How It Works

#### Progressive Escalation System

The system provides four levels of guidance based on agent compliance patterns:

1. **Friendly (90-100% compliance)**: Encouraging, minimal guidance
2. **Warning (70-89% compliance)**: More specific reminders and suggestions
3. **Critical (50-69% compliance)**: Detailed guidance with actionable commands
4. **Blocking (0-49% compliance)**: Comprehensive assistance with step-by-step instructions

#### Enhanced Response Format

Every tool response includes a `guidance` object with Smart Response enhancements:

```typescript
interface EnhancedResponse {
  // Original tool response fields
  success: boolean;
  // ... other tool-specific fields
  
  // Smart Response System enhancements
  guidance: {
    next_steps: string;                    // What to do next
    actionable_command?: string;           // Exact command to run
    contextual_reminder: string;           // Personalized guidance
    compliance_level?: number;             // Agent compliance score (0-100)
    delegation_template?: string;          // Full delegation command template
  };
}
```

### Core Components

#### ComplianceTracker

Monitors agent behavior patterns and calculates compliance scores:

- **Activity Tracking**: Records task creation, plan submission, progress reporting, completion
- **Behavior Analysis**: Identifies patterns in agent protocol adherence
- **Score Calculation**: Provides 0-100 compliance rating
- **Personalized Guidance**: Generates agent-specific recommendations

#### DelegationTracker

Manages task handoffs between agents:

- **Delegation Detection**: Identifies when tasks are created for other agents
- **Follow-up Monitoring**: Tracks whether delegating agents check on progress
- **Incomplete Detection**: Alerts to abandoned delegations
- **Template Generation**: Provides exact commands for proper delegation

#### ResponseEnhancer

Core engine that processes tool responses and adds intelligent guidance:

- **Tool-Specific Enhancement**: Customized guidance for each MCP tool
- **Context Integration**: Combines compliance data with current task state
- **Progressive Assistance**: Adapts guidance level to agent compliance
- **Command Generation**: Provides actionable next steps

### Example Enhancements

#### Before Smart Response System
```json
{
  "success": true,
  "taskId": "2024-01-15T10-30-00-implement-dashboard"
}
```

#### After Smart Response System
```json
{
  "success": true,
  "taskId": "2024-01-15T10-30-00-implement-dashboard",
  "guidance": {
    "next_steps": "Complete delegation by invoking the Task tool",
    "actionable_command": "Task(subagent_type=\"senior-frontend-engineer\", prompt=\"Check MCP task: 2024-01-15T10-30-00-implement-dashboard\")",
    "contextual_reminder": "📋 2-Phase Delegation: ✅ Task Created → ❗ NEXT: Start Subagent",
    "compliance_level": 85,
    "delegation_template": "Task(subagent_type=\"senior-frontend-engineer\", prompt=\"Complete dashboard implementation. MCP Task ID: 2024-01-15T10-30-00-implement-dashboard\")"
  }
}
```

### Compliance Behaviors Tracked

The system monitors these key protocol adherence patterns:

- **Task Creation**: Proper use of create_task with appropriate parameters
- **Plan Submission**: Following required checkbox format and completeness
- **Progress Reporting**: Regular updates during implementation
- **Task Completion**: Proper reconciliation and cleanup
- **TodoWrite Integration**: Synchronization between todos and plan checkboxes
- **Delegation Follow-up**: Checking on tasks assigned to other agents

### Integration with Workflow

The Smart Response System integrates seamlessly with existing workflows:

```typescript
// Standard workflow - guidance added automatically
const task = await mcp.call('create_task', {
  agent: 'senior-frontend-engineer',
  taskName: 'implement-feature'
});

// Response includes guidance based on agent's compliance history
if (task.guidance?.actionable_command) {
  // System provides exact next command to run
  console.log('Next step:', task.guidance.actionable_command);
}

// Compliance level influences guidance tone
if (task.guidance?.compliance_level && task.guidance.compliance_level < 70) {
  // Agent receives more detailed assistance
  console.log('Detailed guidance:', task.guidance.contextual_reminder);
}
```

### Configuration

The Smart Response System operates with minimal configuration:

```bash
# Environment variables
AGENT_COMM_DIR="./comm"                    # Base directory (includes .compliance)
AGENT_COMM_DISABLE_SMART_RESPONSE="false" # Disable Smart Response System
AGENT_COMM_COMPLIANCE_THRESHOLD="70"      # Compliance threshold for warnings
```

### Performance Impact

- **Minimal Overhead**: <10ms additional response time
- **Async Processing**: Compliance tracking happens in background
- **Graceful Degradation**: System continues working if Smart Response fails
- **Memory Efficient**: Compliance data stored in small JSON files

---

## Workflow Patterns

### Context-Based Workflow (Recommended)

The **recommended primary workflow** that provides complete file system abstraction with Smart Response guidance:

```typescript
// 1. Get task context with enhanced guidance
const context = await mcp.call('get_task_context', {
  agent: 'senior-frontend-engineer'
});

// Smart Response provides next steps automatically
if (context.guidance?.next_steps) {
  console.log('Recommended next action:', context.guidance.next_steps);
}

// 2. Submit implementation plan with checkbox format
const planResult = await mcp.call('submit_plan', {
  agent: 'senior-frontend-engineer',
  content: `
  # Implementation Plan: Dashboard Component
  
  - [ ] **Component Setup**: Create base component structure
    - Action: Generate React component files
    - Expected: TypeScript component with proper types
    - Error: Fix any TypeScript compilation errors
    
  - [ ] **State Management**: Implement centralized state
    - Action: Setup Zustand store with TypeScript
    - Expected: Type-safe state management
    - Error: Review type definitions if compilation fails
  `
});

// 3. Report progress with Smart Response tracking
await mcp.call('report_progress', {
  agent: 'senior-frontend-engineer',
  updates: [
    {
      step: 1,
      status: "COMPLETE",
      description: "Component setup finished with TypeScript"
    }
  ]
});

// 4. Complete task with intelligent reconciliation
await mcp.call('mark_complete', {
  agent: 'senior-frontend-engineer',
  status: 'DONE',
  summary: 'Dashboard component implemented with full responsive design',
  reconciliation_mode: 'reconcile',
  reconciliation_explanations: {
    'Optional Feature': 'Deferred to next sprint as agreed'
  }
});

// 5. Clean up with automatic guidance
await mcp.call('archive_completed_tasks', {
  agent: 'senior-frontend-engineer'
});
```

### Multi-Agent Delegation Pattern

**Enhanced with Smart Response delegation tracking:**

```typescript
// 1. Create delegation task with enhanced guidance
const frontendTask = await mcp.call('create_task', {
  agent: 'senior-frontend-engineer',
  taskName: 'dashboard-component',
  taskType: 'delegation',
  content: 'Implement responsive dashboard component with TypeScript'
});

// Smart Response provides exact delegation command
if (frontendTask.guidance?.delegation_template) {
  console.log('Use this command:', frontendTask.guidance.delegation_template);
  // Example: Task(subagent_type="senior-frontend-engineer", prompt="Complete dashboard...")
}

// 2. System automatically tracks delegation and reminds about follow-up
const backendTask = await mcp.call('create_task', {
  agent: 'senior-backend-engineer',
  taskName: 'api-endpoints',
  taskType: 'delegation'
});

// 3. Smart Response detects incomplete delegations
const progressCheck = await mcp.call('track_task_progress', {
  agent: 'senior-frontend-engineer',
  taskId: frontendTask.taskId
});

// Enhanced response includes delegation status
if (progressCheck.guidance?.contextual_reminder?.includes('delegation')) {
  console.log('Delegation reminder:', progressCheck.guidance.contextual_reminder);
}
```

### Parallel Task Workflow

**With Smart Response coordination:**

```typescript
// Create multiple tasks with Smart Response tracking
const tasks = await Promise.all([
  mcp.call('create_task', {
    agent: 'senior-frontend-engineer',
    taskName: 'dashboard-ui',
    content: 'Frontend dashboard implementation'
  }),
  mcp.call('create_task', {
    agent: 'senior-backend-engineer',
    taskName: 'dashboard-api',
    content: 'Backend API endpoints for dashboard'
  }),
  mcp.call('create_task', {
    agent: 'senior-dba-advisor',
    taskName: 'dashboard-schema',
    content: 'Database schema for dashboard data'
  })
]);

// Smart Response provides coordination guidance
tasks.forEach(task => {
  if (task.guidance?.compliance_level && task.guidance.compliance_level < 80) {
    console.log(`Agent ${task.targetAgent} needs additional guidance`);
  }
});

// Monitor progress across all tasks with enhanced visibility
const progressPromises = tasks.map(task =>
  mcp.call('track_task_progress', {
    agent: task.targetAgent,
    taskId: task.taskId
  })
);

const progressResults = await Promise.all(progressPromises);
progressResults.forEach(progress => {
  console.log(`Task progress: ${progress.percentage}%`);
  if (progress.guidance?.next_steps) {
    console.log(`Recommended: ${progress.guidance.next_steps}`);
  }
});
```

### Error Recovery with Smart Response

```typescript
try {
  await mcp.call('mark_complete', {
    agent: 'senior-frontend-engineer',
    status: 'DONE',
    summary: 'Task complete',
    reconciliation_mode: 'strict'
  });
} catch (error) {
  // Smart Response provides specific error guidance
  const context = await mcp.call('get_task_context', {
    agent: 'senior-frontend-engineer'
  });
  
  if (context.guidance?.contextual_reminder?.includes('unchecked')) {
    console.log('Use reconciliation mode:', context.guidance.actionable_command);
    
    // Follow Smart Response suggestion
    await mcp.call('mark_complete', {
      agent: 'senior-frontend-engineer',
      status: 'DONE',
      summary: 'Core functionality delivered',
      reconciliation_mode: 'reconcile',
      reconciliation_explanations: {
        'Optional Feature': 'Moved to backlog per discussion'
      }
    });
  }
}
```

---

## Advanced Features

### TodoWrite Integration

**Enhanced with Smart Response synchronization:**

The TodoWrite system supplements MCP operations by maintaining execution state across multiple tool calls, now with automatic synchronization guidance.

#### Smart Todo Synchronization

```typescript
// 1. Create todos based on task context
const context = await mcp.call('get_task_context', {
  agent: 'senior-frontend-engineer'
});

await TodoWrite([
  {
    content: "Analyze requirements from context",
    status: "in_progress",
    activeForm: "Analyzing"
  },
  {
    content: "Create detailed implementation plan",
    status: "pending",
    activeForm: "Planning"
  },
  {
    content: "Submit plan using submit_plan()",
    status: "pending",
    activeForm: "Submitting plan"
  }
]);

// 2. Smart Response provides sync reminders
// Hook automatically detects TodoWrite changes and suggests:
await mcp.call('sync_todo_checkboxes', {
  agent: 'senior-frontend-engineer',
  todoUpdates: [
    { title: "Analyze requirements", status: "completed" },
    { title: "Create implementation plan", status: "in_progress" }
  ]
});
```

#### Three-State Checkbox Mapping

- `[ ]` (pending) ← TodoWrite "pending" status
- `[~]` (in_progress) ← TodoWrite "in_progress" status  
- `[x]` (completed) ← TodoWrite "completed" status

### MCP Prompts System

**Enhanced with Smart Response context:**

Dynamic, context-aware guidance for working with the task management protocol.

#### Available Prompts

1. **`task-workflow-guide`**: Comprehensive workflow guidance with agent-specific context
2. **`agent-validation-requirements`**: Ownership validation guidelines and troubleshooting
3. **`flexible-task-operations`**: Multi-task workflow patterns and switching guidance
4. **`troubleshooting-common-errors`**: Error-specific solutions with Smart Response integration
5. **`protocol-compliance-checklist`**: Compliance assessment with scoring

#### Smart Response Integration

```typescript
// Get enhanced workflow guidance based on compliance level
const workflowGuide = await mcp.call('prompts/get', {
  name: 'task-workflow-guide',
  arguments: {
    agent: 'senior-frontend-engineer'
  }
});

// Response includes Smart Response enhancements
if (workflowGuide.guidance?.compliance_level < 70) {
  // Prompt includes additional assistance for low-compliance agents
  console.log('Enhanced guidance provided due to compliance score');
}
```

### Archive and Restore Operations

**With Smart Response cleanup recommendations:**

```typescript
// Smart Response recommends cleanup based on agent activity
const completedTasks = await mcp.call('archive_completed_tasks', {
  agent: 'senior-frontend-engineer'
});

if (completedTasks.guidance?.next_steps) {
  console.log('Cleanup recommendation:', completedTasks.guidance.next_steps);
}

// Archive with different modes
await mcp.call('archive_tasks', {
  mode: 'by-date',
  olderThan: 30,
  dryRun: true  // Preview changes first
});
```

---

## Configuration & Troubleshooting

### Environment Configuration

#### Core Settings
```bash
# Base configuration
AGENT_COMM_DIR="./comm"                     # Communication directory
AGENT_COMM_ARCHIVE_DIR="./comm/.archive"   # Archive storage
AGENT_COMM_LOG_DIR="./comm/.logs"          # Operation logs

# Smart Response System
AGENT_COMM_DISABLE_SMART_RESPONSE="false"  # Enable/disable Smart Response
AGENT_COMM_COMPLIANCE_THRESHOLD="70"       # Warning threshold for compliance
AGENT_COMM_HOOK_DEBUG="false"              # Debug TodoWrite hook integration
```

#### Advanced Configuration
```bash
# Performance tuning
AGENT_COMM_AUTO_ARCHIVE_DAYS="30"          # Auto-archive after N days
AGENT_COMM_MAX_TASK_AGE="90"               # Maximum task retention
AGENT_COMM_DISABLE_ARCHIVE="false"         # Disable archiving entirely
```

### MCP Client Setup

#### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "agent-comm": {
      "command": "node",
      "args": ["./node_modules/@jerfowler/agent-comm-mcp-server/dist/index.js"],
      "env": {
        "AGENT_COMM_DIR": "./comm",
        "AGENT_COMM_COMPLIANCE_THRESHOLD": "75",
        "AGENT_COMM_HOOK_DEBUG": "true"
      }
    }
  }
}
```

### Common Error Patterns and Solutions

#### Smart Response Enhanced Error Handling

**Agent Ownership Validation Errors:**
```typescript
try {
  await mcp.call('submit_plan', {
    agent: 'wrong-agent',
    taskId: 'task-owned-by-other-agent',
    content: '# Plan...'
  });
} catch (error) {
  // Smart Response provides specific remediation
  if (error.guidance?.actionable_command) {
    console.log('Fix with:', error.guidance.actionable_command);
  }
}
```

**Plan Validation Errors with Smart Response:**
```typescript
// Invalid plan format
const invalidPlan = `
# Plan
1. [PENDING] Do something  // ❌ Wrong format
`;

// Smart Response suggests correct format
const validPlan = `
# Implementation Plan
- [ ] **Task Setup**: Initialize components
  - Action: Create component files
  - Expected: Clean TypeScript structure
  - Error: Fix compilation issues if needed
`;
```

#### Performance Troubleshooting

**Smart Response Performance Monitoring:**
```typescript
// Get server info with Smart Response status
const serverInfo = await mcp.call('get_server_info');
console.log('Smart Response enabled:', serverInfo.smartResponseEnabled);
console.log('Compliance tracking active:', serverInfo.complianceTracking);

// Monitor response enhancement overhead
const startTime = Date.now();
const response = await mcp.call('create_task', { /* ... */ });
const enhancementTime = Date.now() - startTime;
console.log('Enhancement overhead:', enhancementTime, 'ms');
```

### Diagnostic Commands

#### Smart Response Diagnostics
```typescript
// Check agent compliance levels
const compliance = await mcp.call('get_server_info');
Object.entries(compliance.agentCompliance || {}).forEach(([agent, level]) => {
  console.log(`${agent}: ${level}% compliance`);
});

// Monitor delegation tracking
const delegations = await mcp.call('check_incomplete_delegations', {
  agent: 'current-agent'
});
console.log('Incomplete delegations:', delegations.length);
```

#### System Health Monitoring
```typescript
// Health check with Smart Response status
const health = await mcp.call('ping');
console.log('Server status:', health.status);
console.log('Smart Response active:', health.smartResponseActive);

// Full lifecycle analysis
const lifecycle = await mcp.call('get_full_lifecycle', {
  agent: 'senior-frontend-engineer',
  taskId: 'specific-task-id'
});
console.log('Task journey:', lifecycle.guidance?.contextual_reminder);
```

---

## Migration Guide (v0.6.x → v0.7.0)

### Breaking Changes

#### 1. Smart Response System Integration
**Previous (v0.6.x):** Simple tool responses
```json
{
  "success": true,
  "taskId": "task-123"
}
```

**New (v0.7.0):** Enhanced responses with guidance
```json
{
  "success": true,
  "taskId": "task-123",
  "guidance": {
    "next_steps": "Submit your implementation plan",
    "compliance_level": 85
  }
}
```

**Migration:** No code changes required - guidance is additive and optional.

#### 2. Enhanced Error Messages
**Previous (v0.6.x):** Basic error information
```typescript
catch (error) {
  console.log(error.message);
}
```

**New (v0.7.0):** Smart Response enhanced errors
```typescript
catch (error) {
  console.log(error.message);
  if (error.guidance?.actionable_command) {
    console.log('Fix with:', error.guidance.actionable_command);
  }
}
```

### New Features

#### 1. Smart Response System
**Completely new** - provides intelligent guidance based on agent behavior:

```typescript
// Access Smart Response guidance in any tool response
const response = await mcp.call('create_task', { /* ... */ });

if (response.guidance) {
  console.log('Next steps:', response.guidance.next_steps);
  console.log('Compliance level:', response.guidance.compliance_level);
  
  if (response.guidance.actionable_command) {
    console.log('Exact command:', response.guidance.actionable_command);
  }
}
```

#### 2. Enhanced Delegation Tracking
**New capability** - automatic monitoring of task handoffs:

```typescript
// System automatically tracks when you delegate
const delegationTask = await mcp.call('create_task', {
  agent: 'other-agent',
  taskName: 'delegated-work',
  taskType: 'delegation'
});

// Smart Response provides delegation template
if (delegationTask.guidance?.delegation_template) {
  console.log('Use this command:', delegationTask.guidance.delegation_template);
}
```

#### 3. Compliance-Based Guidance
**New feature** - personalized guidance based on protocol adherence:

```typescript
// Higher compliance = less intrusive guidance
// Lower compliance = more detailed assistance

const context = await mcp.call('get_task_context', {
  agent: 'senior-frontend-engineer'
});

// Guidance adapts to agent's compliance history
if (context.guidance?.compliance_level < 70) {
  // More detailed guidance provided
  console.log('Enhanced assistance:', context.guidance.contextual_reminder);
}
```

### Recommended Migration Approach

#### Phase 1: Update Dependencies (Required)
```bash
# Update to v0.7.0
npm update @jerfowler/agent-comm-mcp-server

# Verify version
npm list @jerfowler/agent-comm-mcp-server
```

#### Phase 2: Adopt New Features (Optional)
```typescript
// Gradually adopt Smart Response guidance
async function enhancedWorkflow() {
  const task = await mcp.call('create_task', { /* ... */ });
  
  // Use Smart Response guidance if available
  if (task.guidance?.next_steps) {
    console.log('Recommended action:', task.guidance.next_steps);
  }
  
  // Execute suggested command if provided
  if (task.guidance?.actionable_command) {
    // Could automate this based on compliance level
    console.log('Auto-executable:', task.guidance.actionable_command);
  }
}
```

#### Phase 3: Leverage Enhanced Features
```typescript
// Use compliance data for workflow optimization
async function smartWorkflowManagement() {
  const agents = ['senior-frontend-engineer', 'senior-backend-engineer'];
  
  for (const agent of agents) {
    const context = await mcp.call('get_task_context', { agent });
    
    if (context.guidance?.compliance_level) {
      const level = context.guidance.compliance_level;
      
      if (level < 70) {
        console.log(`Agent ${agent} needs additional support`);
        // Provide more detailed instructions
      } else if (level > 90) {
        console.log(`Agent ${agent} is highly compliant`);
        // Can provide minimal guidance
      }
    }
  }
}
```

### Compatibility Matrix

| Feature | v0.6.x | v0.7.0 | Migration Required |
|---------|--------|--------|--------------------|
| Core MCP tools | ✅ | ✅ | No |
| Context-based workflow | ✅ | ✅ | No |
| Basic responses | ✅ | ✅ | No |
| Smart Response guidance | ❌ | ✅ | No (optional) |
| Compliance tracking | ❌ | ✅ | No (automatic) |
| Delegation monitoring | ❌ | ✅ | No (automatic) |
| Enhanced error messages | ❌ | ✅ | No (additive) |

### Testing Your Migration

#### 1. Verify Smart Response System
```typescript
async function testSmartResponse() {
  const task = await mcp.call('create_task', {
    agent: 'test-agent',
    taskName: 'test-task'
  });
  
  if (task.guidance) {
    console.log('✅ Smart Response System active');
    console.log('Guidance provided:', task.guidance);
  } else {
    console.log('⚠️ Smart Response not active (check configuration)');
  }
}
```

#### 2. Test Compliance Tracking
```typescript
async function testComplianceTracking() {
  // Create and complete a task to generate compliance data
  const task = await mcp.call('create_task', {
    agent: 'test-agent',
    taskName: 'compliance-test'
  });
  
  await mcp.call('submit_plan', {
    agent: 'test-agent',
    content: '# Test Plan\n- [ ] **Test**: Verify compliance tracking'
  });
  
  await mcp.call('mark_complete', {
    agent: 'test-agent',
    status: 'DONE',
    summary: 'Compliance test completed'
  });
  
  // Check if compliance level is tracked
  const context = await mcp.call('get_task_context', {
    agent: 'test-agent'
  });
  
  if (context.guidance?.compliance_level !== undefined) {
    console.log('✅ Compliance tracking active');
    console.log('Compliance level:', context.guidance.compliance_level);
  }
}
```

### Support Resources

- **Smart Response Issues**: Use enhanced error messages with actionable commands
- **Compliance Questions**: Monitor guidance adaptation over time
- **Migration Support**: All v0.6.x functionality remains unchanged
- **Performance**: Smart Response adds <10ms overhead with graceful degradation

---

**Version 0.7.0** - This comprehensive protocol documentation provides complete technical reference for the Agent Communication MCP Server with Smart Response System integration, ensuring optimal AI agent coordination and task management workflows.