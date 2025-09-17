# Agent Communication MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/jerfowler/agent-comm-mcp-server)](https://github.com/jerfowler/agent-comm-mcp-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

**Make AI agents work together seamlessly.** This [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server enables Claude Code to coordinate multiple specialized agents, track their progress in real-time, and understand exactly how they approach and solve complex tasks.

**Author:** Jeremy Fowler

## 📦 Current Version

[![Version](https://img.shields.io/npm/v/@jerfowler/agent-comm-mcp-server?label=NPM%20Version&color=blue)](https://www.npmjs.com/package/@jerfowler/agent-comm-mcp-server)
[![Release](https://img.shields.io/github/v/release/jerfowler/agent-comm-mcp-server?label=Latest%20Release)](https://github.com/jerfowler/agent-comm-mcp-server/releases/latest)
[![Changelog](https://img.shields.io/badge/📋-Changelog-green)](./CHANGELOG.md)

**Latest Release:** See [releases](https://github.com/jerfowler/agent-comm-mcp-server/releases) for version history and changes.

---

## What This Does

Think of this as a **mission control** for AI agents. Instead of trying to do everything yourself, you can delegate specific tasks to specialized agents (like a frontend engineer, backend engineer, or QA tester) and monitor their complete thought process from start to finish.

### Why You'd Want This

**🎯 **Delegation Made Simple**: Create tasks for specific agents without worrying about file management or coordination complexity**

**🔍 **Complete Transparency**: See exactly how each agent understood your request, planned their approach, and executed the work**

**📊 **Real-Time Monitoring**: Track progress without interrupting agents or blocking your workflow**

**🛡️ **Zero Complexity**: Agents get clean task context automatically—no file paths, no setup headaches**

**🔄 **Smart Completion**: Flexible task completion that handles real-world variations from the original plan**

**⚡ **Non-Blocking**: All agents can work simultaneously while you stay productive**

### Latest Features (v0.10.0)

**🎯 **Universal Orchestration Guidance** (Issue #64)**: Get consistent, parallel-first instructions every time you delegate tasks. No more guessing how to coordinate multiple agents—the system tells you exactly how to run them together efficiently.

**⚙️ **Configurable Protocol Management** (Issue #63)**: New `protocol_config` tool lets you customize how tasks are created and plans are structured. Want different templates for different types of work? Now you can set that up easily.

**⚡ **90% Performance Boost** (Issue #60)**: Plan validation is now lightning fast thanks to smart caching with the new `stepCount` parameter. What used to take 100ms now takes less than 10ms. Your agents get feedback faster, work flows smoother.

**How to Use:** Add `stepCount` to your `submit_plan` calls:
```javascript
// Old way: ~100ms validation time
mcp__agent_comm__submit_plan(agent="engineer", content="plan with checkboxes")

// New way: <10ms validation time
mcp__agent_comm__submit_plan(agent="engineer", stepCount=5, content="plan with 5 checkboxes")
```

**Benefits:** Creates `PLAN.metadata.json` for caching, dramatically speeds up `report_progress` and `track_task_progress` operations.

**🔍 **Smart Agent Discovery** (Issue #59)**: The system automatically finds and validates agents, making setup more reliable. Less trial-and-error, more "it just works."

**📊 **Enhanced Visibility** (Issue #51)**: Better reporting and context sharing means you always know what your agents are thinking and doing. No more black boxes—complete transparency into their work process.

---

## Quick Start

### Installation

Choose the method that works best for your setup:

```bash
# Option 1: Global installation (recommended for MCP)
npm install -g @jerfowler/agent-comm-mcp-server

# Option 2: Use directly without installation
npx @jerfowler/agent-comm-mcp-server

# Option 3: From source
git clone https://github.com/jerfowler/agent-comm-mcp-server.git
cd agent-comm-mcp-server
npm install && npm run build
```

### Setup with Claude

**Quick Setup:**
```bash
# Install and setup in one step
npm install -g @jerfowler/agent-comm-mcp-server
npm run setup  # Creates .mcp.json with all configured servers
```

**Manual Setup:**
Add this to your Claude configuration file (`.mcp.json` or `claude_desktop_config.json`):

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

**🔒 Security Note:** Never commit API keys to git. The `.mcp.json` file is gitignored to protect sensitive credentials. Use `.mcp.json.example` as a template and `npm run setup` for easy configuration.

### Optional: TodoWrite Hook Integration

Want your Claude Code todos to automatically sync with agent task checkboxes? This optional hook makes it seamless.

**What it does:** When you update todos with TodoWrite, the hook reminds you to sync those changes to your active agent task's PLAN.md checkboxes. No more manual checkbox updates!

**Quick Setup (3 steps):**

1. **Copy the hook file** to your Claude Code hooks directory:
```bash
# The hook is already in your agent-comm-mcp-server installation
cp node_modules/@jerfowler/agent-comm-mcp-server/.claude/hooks/sync-todos-to-checkboxes.py ~/.claude/hooks/
```

2. **Make it executable:**
```bash
chmod +x ~/.claude/hooks/sync-todos-to-checkboxes.py
```

3. **Test it works:**
```bash
echo '{"tool":{"name":"TodoWrite"},"result":{"todos":[{"content":"Test todo","status":"completed","activeForm":"Testing"}]}}' | python3 ~/.claude/hooks/sync-todos-to-checkboxes.py
# Should output: "TodoWrite updated 1 todo: 1 completed, 0 in-progress, 0 pending"
# Remember to sync to your task checkboxes using the agent-comm MCP if you have an active task
```

**Need help?** Run our verification script to check everything:
```bash
# Download and run the verification script
curl -s https://raw.githubusercontent.com/jerfowler/agent-comm-mcp-server/main/scripts/verify-hook-installation.sh | bash

# Or if you have the project locally
./scripts/verify-hook-installation.sh
```

**That's it!** Now when you use TodoWrite, you'll get helpful reminders to sync your todo changes to agent task checkboxes using the `sync_todo_checkboxes` tool.

**Skip this if:** You don't use TodoWrite or prefer manual checkbox management. The agent communication works perfectly without this hook.

### Try It Out

Here are some conversational prompts you can use with Claude right away:

**Delegate a task:**
```
Using the agent-comm tools, create a task for senior-frontend-engineer to implement a responsive dashboard with dark mode support and real-time updates. Include proper TypeScript interfaces.
```

**Check on progress:**
```
Can you use the agent-comm server to check how the dashboard task is going for the frontend engineer?
```

**Get the full story:**
```
Use agent-comm tools to show me the complete lifecycle of that dashboard task - what did the agent understand, how did they plan it, and what was the final result?
```

**Clean up when done:**
```
Please use the agent-comm server to archive all completed tasks.
```

---

## How It Works

### The Agent Task Lifecycle

Every task goes through a clear, trackable lifecycle:

```
1. INIT: What you asked for → 2. PLAN: How they'll do it → 3. PROGRESS: Work updates → 4. DONE/ERROR: Final result
```

This gives you complete visibility into:
- **What the agent understood** from your request
- **How they planned** to approach the work  
- **What they actually did** step by step
- **What the final outcome** was (success or failure)

### Two Ways to Work

**Context-Based (Recommended - Simple):**
Agents get clean task descriptions automatically. You never deal with file paths or technical details. Just create tasks and monitor progress.

**Traditional (Advanced - Full Control):**
Direct access to all task files and management. Perfect if you need granular control over the process.

### How the Smart Response System Works (NEW)

The **Smart Response System** learns from your agent interactions to provide progressively better guidance over time. It automatically detects common patterns and helps agents complete tasks more effectively.

**What it does for you:**

1. **Detects Incomplete Delegations**: When you create a task for another agent, the system notices if you forget to follow up and provides the exact command to check on it.

2. **Progressive Guidance**: As agents work together more, the system learns their patterns and provides increasingly specific help:
   - **New agents** get friendly reminders about the workflow
   - **Experienced agents** get concise, targeted guidance
   - **Struggling agents** receive more detailed assistance

3. **Automatic Compliance Tracking**: The system quietly tracks how well agents follow the task workflow and adjusts its guidance accordingly—no manual intervention needed.

4. **Parallel Execution Optimization**: Automatically detects opportunities to run multiple agents in parallel and generates the specific Task() commands for you. The parallel execution feature analyzes task dependencies and suggests concurrent execution patterns to maximize throughput.

5. **Escalating Urgency Levels**: Provides gentle reminders for compliant agents, firm warnings for those falling behind, and critical alerts when immediate action is required.

**Example: Before and After**

**Before Smart Response System:**
```json
{
  "success": true,
  "taskId": "2025-01-10T10-30-00-implement-feature",
  "message": "Task created successfully"
}
```

**After Smart Response System:**
```json
{
  "success": true,
  "taskId": "2025-01-10T10-30-00-implement-feature",
  "message": "Task created successfully",
  "guidance": {
    "next_steps": "You've delegated to frontend-engineer. Check their progress with:",
    "actionable_command": "mcp__agent_comm__track_task_progress(agent=\"frontend-engineer\", taskId=\"2025-01-10T10-30-00-implement-feature\")",
    "contextual_reminder": "Remember to review their plan before they start implementation",
    "compliance_level": 85
  }
}
```

**Parallel Execution Example:**

When the system detects multiple independent tasks, it automatically suggests parallel execution patterns. This parallel execution capability dramatically reduces overall completion time by utilizing all available agents concurrently.

```json
{
  "tasks": [
    { "id": "task-1", "targetAgent": "senior-frontend-engineer" },
    { "id": "task-2", "targetAgent": "senior-backend-engineer" },
    { "id": "task-3", "targetAgent": "senior-dba-advisor" }
  ],
  "guidance": {
    "contextual_reminder": "🚀 PARALLEL EXECUTION OPPORTUNITY: Multiple independent tasks detected!",
    "actionable_command": "# Execute these agents in parallel:\nTask(subagent_type=\"senior-frontend-engineer\", prompt=\"Handle task: task-1\")\nTask(subagent_type=\"senior-backend-engineer\", prompt=\"Handle task: task-2\")\nTask(subagent_type=\"senior-dba-advisor\", prompt=\"Handle task: task-3\")"
  }
}
```

The parallel execution optimizer considers task dependencies, agent availability, and workload distribution to generate optimal execution strategies.

The system is **completely automatic**—it's enabled by default and works silently in the background. You'll only notice it when it helps you avoid mistakes or complete tasks more efficiently.

---

## What's in the Complete Protocol Guide

The **[complete PROTOCOL.md documentation](./docs/PROTOCOL.md)** covers everything in detail. Here's what you'll find:

### 📚 Core Concepts
- **Task Lifecycle**: Complete breakdown of how tasks flow from creation to completion
- **Agent Communication Patterns**: Context-based vs traditional workflows
- **Task Organization**: How files and data are structured behind the scenes

### 🛠️ Complete Tool Reference (18 Tools Total)

**Traditional Task Management (7 tools):**
- Create and manage tasks with full control
- Read and write task files directly
- List agents and their current workload
- Archive and restore completed work

**Context-Based Tools (5 tools):**
- Get clean task context without file paths
- Submit implementation plans with automatic validation
- Report progress updates in real-time  
- Complete tasks with intelligent reconciliation
- Batch cleanup operations
- **NEW**: Optional `taskId` parameter support for targeting specific tasks

**Diagnostic Tools (2 tools):**
- Get complete lifecycle visibility for any task
- Track real-time progress with detailed percentages

**Utility Tools (4 tools):**
- Server health checks and status
- Comprehensive server information and capabilities
- TodoWrite integration for checkbox synchronization
- Protocol configuration management for custom templates

### 🔄 Workflow Patterns
- **Context-Based Workflow**: The recommended simple approach
- **Diagnostic Monitoring**: How to track multiple agents non-blocking
- **Traditional Workflow**: Full control for advanced users

### 🚀 Advanced Features

**TodoWrite Integration:**
Seamless synchronization between Claude Code's TodoWrite system and agent PLAN.md checkboxes. The integration includes a PostToolUse hook that automatically detects todo changes and reminds you to sync with the MCP server. See `docs/TODOWRITE-INTEGRATION.md` for complete setup and usage guide.

**Intelligent Reconciliation:**
Handle real-world scenarios where agents optimize their approach or encounter blockers. Four reconciliation modes help you complete tasks even when the original plan changes.

**Archive and Restore:**
Keep your workspace clean with smart archiving that lets you restore previous work when needed.

### ⚙️ Configuration Reference
- **Environment Variables**: Complete list with defaults and examples
- **MCP Client Setup**: Configuration for Claude Desktop, VSCode, and other clients
- **Agent Instructions**: Ready-to-use templates for your agent descriptions

### 🔧 Error Handling & Troubleshooting
- **Common Error Patterns**: What goes wrong and how to fix it
- **Best Practices**: Proven approaches for reliable agent coordination
- **Performance Tips**: Keep everything running smoothly

### 📊 API Version & Compatibility
- Current version information
- MCP compatibility details
- Node.js requirements and testing info

---

## Real-World Usage Examples

### Parallel Development Team
```
Create these tasks in parallel using agent-comm tools:
1. senior-backend-engineer: "Design REST API for user authentication"
2. senior-frontend-engineer: "Build login/signup UI components"  
3. qa-test-automation-engineer: "Create test suite for auth system"
4. devops-deployment-engineer: "Set up staging environment"
```

### Large Feature Implementation
```
Use agent-comm to delegate this complex e-commerce cart implementation to senior-frontend-engineer: "Build shopping cart with real-time inventory updates, discount code support, saved cart persistence, and mobile-responsive checkout flow."

Then monitor progress and get diagnostic insights on their approach.
```

### Code Review and Quality
```
After the frontend work is complete, use agent-comm to assign qa-test-automation-engineer: "Review the shopping cart implementation and create comprehensive automated tests covering all user flows and edge cases."
```

---

## Why This Architecture

**Non-Blocking by Design**: You can launch multiple agents and they'll work simultaneously while you stay productive. No waiting around for sequential completion.

**Complete Transparency**: Instead of wondering "what is that agent doing?", you get full insight into their thinking process, planning, and execution.

**File System Abstraction**: Agents never see file paths or directory structures. They get clean task context and produce clean results. No more path-related bugs or setup complexity.

**Real-World Flexibility**: The reconciliation system handles when agents find better approaches or encounter unexpected issues. Tasks can still complete successfully even when the original plan changes.

**Production Ready**: Full TypeScript implementation with comprehensive testing, error handling, and logging. Built for reliability in real development workflows.

---

## Environment Options

The server is configurable via environment variables:

| Variable | What It Does | Default |
|----------|--------------|---------|
| `AGENT_COMM_DIR` | Where to store task communications | `./comm` |
| `AGENT_COMM_ARCHIVE_DIR` | Where to store completed tasks | `./comm/.archive` |
| `AGENT_COMM_LOG_DIR` | Where to store operation logs | `./comm/.logs` |
| `AGENT_COMM_DISABLE_ARCHIVE` | Turn off archiving completely | `false` |

For most users, the defaults work perfectly. The system creates directories automatically as needed.

---

## Filesystem Architecture

The server implements a **robust dual-layer filesystem architecture** designed for reliable file operations with comprehensive error handling and cross-platform compatibility.

### Architecture Overview

```
High-Level Operations (file-system.ts)
    ↓ Validation & Error Handling
Low-Level Operations (fs-extra-safe.ts)  
    ↓ Fallback Mechanisms
Node.js Built-in Modules (fs, path)
    ↓ Cross-Platform Support
Operating System Filesystem
```

### Layer Responsibilities

**🎯 High-Level Layer (`src/utils/file-system.ts`)**
- Task-focused operations with domain validation
- Automatic directory creation for write operations
- Meaningful error messages with context (FileNotFoundError, InvalidTaskError)
- Task metadata parsing and validation utilities
- Agent Communication Server specific functionality

**⚙️ Low-Level Layer (`src/utils/fs-extra-safe.ts`)**
- Direct filesystem operations with Node.js built-in fallbacks  
- Handles fs-extra import issues and module resolution conflicts
- Diagnostic capabilities and performance monitoring
- Cross-platform reliability with multiple import strategies
- Basic operations: pathExists, readdir, writeFile, readFile, stat, remove, ensureDir

### Usage Guidelines

**Use High-Level Layer when:**
- Creating or managing agent tasks
- Need validation (task names, agent names)
- Want automatic directory creation
- Need domain-specific error handling

**Use Low-Level Layer when:**
- Need direct filesystem control
- Bulk operations like directory scanning
- Require specific fs-extra features
- Building custom filesystem utilities

### Key Benefits

**🛡️ Reliability**: Multi-strategy imports with Node.js fallbacks ensure operations work regardless of fs-extra installation status

**🔒 Validation**: Comprehensive input validation prevents path traversal attacks and invalid task creation

**🚀 Performance**: Optimized imports and caching reduce overhead while maintaining flexibility

**🔧 Maintainability**: Clear separation of concerns makes the codebase easier to understand and extend

**🌐 Cross-Platform**: Consistent behavior across Windows, macOS, and Linux environments

This architecture ensures reliable filesystem operations while providing the flexibility needed for both simple task management and complex agent coordination workflows.

---

## Development & Building

```bash
npm run build          # Build everything
npm run dev            # Development mode with auto-reload
npm test               # Run all tests
npm run test:coverage  # Test with coverage report
npm run lint           # Check code style
npm run type-check     # TypeScript validation
```

The project uses **build-time version injection** - version info is automatically pulled from `package.json` and compiled into the server, so there's no runtime file access needed.

---

## Get Started Today

1. **Install**: `npm install -g @jerfowler/agent-comm-mcp-server`
2. **Configure**: Add the MCP server to your Claude configuration
3. **Try it**: Ask Claude to "create a task for senior-frontend-engineer using agent-comm tools"
4. **Explore**: Check out the **[complete PROTOCOL.md documentation](./docs/PROTOCOL.md)** for everything else

---

## Contributing & Git Workflow

This project uses a **Git Feature Branch Workflow** with branch protection on `main`:

### Quick Contribution Guide
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test
npm run ci  # Run all quality checks

# Push and create PR
git push -u origin feature/your-feature-name
gh pr-create  # Uses our custom alias

# Check status
gh pr-checks
```

### Branch Protection
- ✅ **No direct commits** to `main` - all changes via PRs
- ✅ **Required reviews** - at least 1 approval needed  
- ✅ **All tests must pass** - comprehensive CI pipeline
- ✅ **Up-to-date branches** - must be current with main

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** and **[BRANCHING.md](./BRANCHING.md)** for complete workflow details.

### GitHub CLI Aliases
Pre-configured aliases for streamlined workflow:
- `gh pr-create` - Create PR with auto-fill and self-assignment
- `gh pr-checks` - Check PR status and CI results
- `gh pr-merge` - Squash merge with branch cleanup
- `gh feature` - Create branch from GitHub issue

---

## Support

**Questions?** Check the issues tab or create a new issue with:
- What you were trying to do
- What happened instead
- Your configuration and environment details

---

**Agent Communication MCP Server** - Making AI agent coordination simple, transparent, and powerful.