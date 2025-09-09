# Agent Communication MCP Server - Project Overview

## Purpose
MCP (Model Context Protocol) server for AI agent task communication and delegation with diagnostic lifecycle visibility. Enables Claude Code to coordinate multiple specialized agents, track their progress in real-time, and understand exactly how they approach and solve complex tasks.

## Tech Stack
- **Language**: TypeScript 5.0+ with strict mode enabled
- **Runtime**: Node.js 18+ with ES modules
- **Framework**: @modelcontextprotocol/sdk for MCP implementation
- **Testing**: Jest with ts-jest for TypeScript support
- **File System**: fs-extra with custom safe wrappers
- **Linting**: ESLint with TypeScript plugin
- **Build**: TypeScript compiler (tsc)

## Architecture
- **Core Layer**: TaskContextManager, ConnectionManager, EventLogger
- **Tool Layer**: 17 specialized MCP tools (context-based, traditional, diagnostic, utility)
- **Utility Layer**: FileSystem, LockManager, TaskManager, validation
- **Storage Layer**: File system with locking coordination

## Key Features
- Zero file path exposure to agents (context IDs only)
- Non-blocking operations for parallel agent execution
- Context-based abstraction for clean task descriptions
- Diagnostic visibility without controlling execution flow
- Task lifecycle: INIT → PLAN → PROGRESS → DONE/ERROR