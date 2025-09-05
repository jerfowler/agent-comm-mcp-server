# Agent Communication MCP Server

[![npm version](https://badge.fury.io/js/%40jerfowler%2Fagent-comm-mcp-server.svg)](https://www.npmjs.com/package/@jerfowler/agent-comm-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/jerfowler/agent-comm-mcp-server)](https://github.com/jerfowler/agent-comm-mcp-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

**Make AI agents work together seamlessly.** This [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server enables Claude Code to coordinate multiple specialized agents, track their progress in real-time, and understand exactly how they approach and solve complex tasks.

**Author:** Jeremy Fowler

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

That's it! Claude now has access to the agent communication tools.

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

---

## What's in the Complete Protocol Guide

The **[complete PROTOCOL.md documentation](./docs/PROTOCOL.md)** covers everything in detail. Here's what you'll find:

### 📚 Core Concepts
- **Task Lifecycle**: Complete breakdown of how tasks flow from creation to completion
- **Agent Communication Patterns**: Context-based vs traditional workflows
- **Task Organization**: How files and data are structured behind the scenes

### 🛠️ Complete Tool Reference (17 Tools Total)

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

**Diagnostic Tools (2 tools):**
- Get complete lifecycle visibility for any task
- Track real-time progress with detailed percentages

**Utility Tools (3 tools):**
- Server health checks and status
- Comprehensive server information and capabilities
- TodoWrite integration for checkbox synchronization

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

## Support

**Questions?** Check the issues tab or create a new issue with:
- What you were trying to do
- What happened instead
- Your configuration and environment details

---

**Agent Communication MCP Server** - Making AI agent coordination simple, transparent, and powerful.