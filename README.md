# Agent Communication MCP Server

[![npm version](https://badge.fury.io/js/%40jerfowler%2Fagent-comm-mcp-server.svg)](https://www.npmjs.com/package/@jerfowler/agent-comm-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/jerfowler/agent-comm-mcp-server)](https://github.com/jerfowler/agent-comm-mcp-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for AI agent task communication and delegation with **diagnostic lifecycle visibility**. Enables Claude Code to delegate tasks to specialized agents and monitor their complete thought process and execution.

**Author:** Jeremy Fowler

## Features

### Diagnostic Lifecycle Visibility
- **Complete Agent Transparency**: Full visibility into how agents think and execute tasks
- **Task Journey Tracking**: Monitor INIT → PLAN → PROGRESS → COMPLETION lifecycle
- **Real-time Progress**: Track agent progress with detailed step completion
- **Failure Analysis**: Understand exactly why tasks failed with complete context
- **Learning Opportunities**: Analyze agent approaches for continuous improvement

### Core Task Management
- **Zero File System Exposure**: Agents work with task IDs and content only, never file paths
- **Context-Based Operations**: Complete file system abstraction for simplified development
- **Auto-Context Injection**: Protocol instructions automatically added to delegated tasks
- **Session Management**: Connection tracking for multi-agent coordination
- **JSON Lines Logging**: All operations logged with metadata for monitoring
- **Type-Safe**: Full TypeScript implementation
- **Non-Blocking Architecture**: Async-first design preserving Claude Code parallelism

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Installation

#### Global Installation (Recommended for MCP)
```bash
npm install -g @jerfowler/agent-comm-mcp-server
```

#### Using npx (No Installation Required)
```bash
npx @jerfowler/agent-comm-mcp-server
```

#### From Source
```bash
git clone https://github.com/jerfowler/agent-comm-mcp-server.git
cd agent-comm-mcp-server
npm install
npm run build
```

### Configuration

Add to your `.mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-comm": {
      "command": "npx",
      "args": ["@jerfowler/agent-comm-mcp-server"],
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

#### Alternative: Local Development

```json
{
  "mcpServers": {
    "agent-comm": {
      "command": "node",
      "args": ["/absolute/path/to/agent-comm-mcp-server/dist/index.js"],
      "env": {
        "AGENT_COMM_DIR": "./comm",
        "AGENT_COMM_ARCHIVE_DIR": "./comm/.archive",
        "AGENT_COMM_LOG_DIR": "./comm/.logs"
      }
    }
  }
}
```

### Basic Usage

#### Sample Claude Code Prompts

Here are effective prompts that explicitly reference the MCP server to ensure Claude uses the agent-comm tools:

**Delegate a Task:**
```
Using the agent-comm MCP server, delegate this task to senior-frontend-engineer: "Implement a responsive dashboard component with real-time data updates and dark mode support. Include proper TypeScript interfaces and comprehensive tests."
```

**Monitor Task Progress:**
```
Using the MCP agent-comm tools, check the progress of the dashboard task assigned to senior-frontend-engineer
```

**Get Complete Task Analysis:**
```
Use the agent-comm MCP server to show me the complete lifecycle analysis for the dashboard task - what the agent understood, how they planned it, and the final results
```

**Create Multiple Parallel Tasks:**
```
Using the agent-comm MCP tools, create these tasks in parallel:
1. senior-backend-engineer: "Design and implement REST API endpoints for user management"  
2. senior-frontend-engineer: "Build user interface components for the user management system"
3. qa-test-automation-engineer: "Create comprehensive test suite for user management features"
```

**Archive Completed Work:**
```
Use the agent-comm MCP server to archive all completed agent communication tasks
```

#### Diagnostic Lifecycle Workflow

```python
# 1. Delegate task to agent
result = mcp__agent_comm__delegate_task(
    targetAgent="senior-frontend-engineer",
    taskName="implement-dashboard",
    content="# Task: Dashboard Implementation\n## Requirements\n- Responsive design\n- Real-time updates"
)

# 2. Monitor progress (non-blocking)
progress = mcp__agent_comm__track_task_progress(
    agent="senior-frontend-engineer",
    task_id=result['task_id']
)

# 3. Get complete diagnostic analysis when done
if progress['status'] == 'completed':
    lifecycle = mcp__agent_comm__get_full_lifecycle(
        agent="senior-frontend-engineer", 
        task_id=result['task_id']
    )
    print("Agent's approach:", lifecycle['lifecycle']['plan']['content'])
    print("Final outcome:", lifecycle['lifecycle']['outcome']['content'])
```

#### Smart Task Creation

The `create_task` tool is the **primary tool** for all task creation:

```python
# Create task with duplicate prevention
result = mcp__agent_comm__create_task(
    agent="senior-frontend-engineer",
    taskName="implement-dashboard-widgets",
    content="# Implement Interactive Dashboard Widgets\n\n## Requirements\n- Create 3 widget types...",
    taskType="delegation"  # default
)

# Tool returns comprehensive tracking information
print(f"Progress tracking: {result['tracking']['progress_command']}")
print(f"Lifecycle tracking: {result['tracking']['lifecycle_command']}")
```

**Key Benefits:**
- **Duplicate Prevention**: Automatically detects and prevents duplicate task creation
- **Smart Timestamp Extraction**: Handles malformed inputs with double timestamps
- **Enhanced Protocol Context**: Automatically injects comprehensive MCP protocol instructions
- **Multiple Task Types**: Supports delegation, self-organization, and subtasks
- **Idempotent**: Safe to call multiple times - returns existing task if found

## Available Tools

### Core Task Management

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `create_task` | **Smart task creation with duplicate prevention** | `agent`, `taskName`, `content?`, `taskType?` |
| `track_task_progress` | Real-time progress monitoring | `agent`, `task_id` |
| `get_full_lifecycle` | Complete task journey analysis | `agent`, `task_id` |
| `check_tasks` | Check for tasks assigned to agent | `agent` |
| `read_task` | Read task files (INIT, PLAN, DONE, ERROR) | `agent`, `task`, `file` |
| `write_task` | Write task progress files | `agent`, `task`, `file`, `content` |
| `archive_tasks` | Archive tasks (completed, all, by-agent, by-date) | `mode`, `agent?`, `olderThan?` |

### Server Management

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `get_server_info` | Comprehensive server metadata and status | none |
| `ping` | Health check with status and timestamp | none |

## Task Lifecycle Architecture

The server provides complete transparency into agent task execution:

```
INIT.md     →  PLAN.md     →  Progress     →  DONE/ERROR.md
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────┐
│ What    │    │ How     │    │ Steps   │    │ Outcome     │
│ agent   │    │ agent   │    │ [✓]     │    │ Final       │
│ was     │    │ planned │    │ [→]     │    │ results     │
│ asked   │    │ to do   │    │ [ ]     │    │ or errors   │
└─────────┘    └─────────┘    └─────────┘    └─────────────┘
```

## Usage Patterns

### Pattern 1: Fire-and-Monitor
```python
# Delegate and monitor non-blocking
result = delegate_task(...)
while True:
    progress = track_task_progress(agent, task_id)
    if progress['status'] in ['completed', 'error']:
        break
    time.sleep(30)  # Non-blocking check every 30s
lifecycle = get_full_lifecycle(agent, task_id)  # Complete diagnostic report
```

### Pattern 2: Parallel Agent Coordination
```python
# Launch multiple agents simultaneously
tasks = [
    delegate_task("senior-backend-engineer", "api-endpoints", content_1),
    delegate_task("senior-frontend-engineer", "ui-components", content_2),
    delegate_task("devops-deployment-engineer", "infrastructure", content_3)
]

# Monitor all tasks non-blocking
completed_tasks = []
while len(completed_tasks) < len(tasks):
    for task in tasks:
        if task['task_id'] not in completed_tasks:
            progress = track_task_progress(task['agent'], task['task_id'])
            if progress['status'] == 'completed':
                completed_tasks.append(task['task_id'])
    time.sleep(30)
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_COMM_DIR` | Communication directory | `./comm` |
| `AGENT_COMM_ARCHIVE_DIR` | Archive directory | `./comm/.archive` |
| `AGENT_COMM_LOG_DIR` | Log directory | `./comm/.logs` |
| `AGENT_COMM_DISABLE_ARCHIVE` | Disable archiving functionality | `false` |

### Logging Configuration

The server automatically logs all operations to JSON Lines format:

- **Log Location**: Configurable via `AGENT_COMM_LOG_DIR` environment variable
- **Default Location**: `./comm/.logs/agent-comm.log` 
- **Log Format**: JSON Lines with timestamps, operation types, agents, and metadata

Example log entries:
```json
{"timestamp":"2025-09-04T21:35:15.413Z","operation":"delegate_task","agent":"senior-frontend-engineer","taskId":"dashboard-impl","success":true,"duration":150}
{"timestamp":"2025-09-04T21:35:16.200Z","operation":"submit_plan","agent":"senior-frontend-engineer","taskId":"dashboard-impl","success":true,"duration":75,"metadata":{"planSteps":5}}
```

### Sample Claude Commands

The server includes sample Claude Code commands in `.claude/commands/`:

- **`clear-comms.yaml`**: MCP-native task archiving and restoration
  - `clear comms` - Archive completed tasks
  - `clear all comms` - Archive all tasks  
  - `restore comms` - Restore archived tasks
  - `comms status` - Show task statistics

All operations use MCP tools directly, eliminating permission prompts and providing atomic operations with proper error handling.

## Best Practices

### Claude Code Integration
- **Non-Blocking Operations**: Never use blocking patterns that prevent parallel agent execution
- **Task ID Tracking**: Always capture `task_id` from delegation responses for monitoring
- **Progress Monitoring**: Use `track_task_progress` for real-time status without blocking
- **Diagnostic Analysis**: Use `get_full_lifecycle` for post-completion analysis and debugging
- **Parallel Coordination**: Launch multiple agents simultaneously for maximum efficiency

### MCP Protocol Compliance
- **Async-First Design**: All operations follow asynchronous JSON-RPC 2.0 patterns
- **Type Safety**: Full TypeScript implementation with complete interface definitions
- **Error Handling**: Comprehensive error propagation with structured error types
- **Connection Management**: Persistent connections with activity tracking and cleanup

### Performance Optimization
- **Minimal Context**: Agents work with task IDs and content only, never file paths
- **JSON Lines Logging**: All operations logged for monitoring without performance impact
- **Archive Management**: Regular cleanup of completed tasks to maintain performance
- **Resource Efficiency**: Context-based operations minimize file system overhead

## Development

### Build System

This project uses **build-time version injection** to maintain package.json as the single source of truth:

```bash
npm run build          # Auto-generates version constants, then compiles TypeScript
npm run dev            # Auto-generates version constants, then runs TypeScript watch mode  
npm test               # Run tests
npm run test:coverage  # Run with coverage
npm run lint           # Check code style
npm run clean          # Remove dist/ and generated files
```

### Version Management

- **Single Source of Truth**: Version info lives only in `package.json`
- **Build-Time Injection**: `scripts/generate-version.cjs` creates `src/generated/version.ts` before compilation
- **No Runtime File Access**: Version constants are compiled into the code for reliability
- **Auto-Hooks**: `prebuild` and `predev` npm scripts ensure version is always current

### Generated Files

```
src/generated/version.ts    # Auto-generated package info constants (git-ignored)
dist/generated/version.js   # Compiled constants used by server at runtime
```

**⚠️ Important**: Never edit files in `src/generated/` - they are auto-generated from `package.json`

## Documentation

- **[Protocol Documentation](./docs/PROTOCOL.md)** - Complete communication protocol with diagnostic patterns

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Check existing issues first
- Provide detailed reproduction steps  
- Include configuration and environment details

---

**Agent Communication MCP Server** - Non-blocking AI agent coordination with complete diagnostic lifecycle visibility and file system abstraction.