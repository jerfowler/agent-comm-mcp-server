# CLAUDE.md - Agent Communication MCP Server

This file provides guidance to Claude Code when working with the **agent-comm-mcp-server** NPM package.

## Project Overview

**Name**: `@jerfowler/agent-comm-mcp-server`  
**Purpose**: MCP server for AI agent task communication and delegation with diagnostic lifecycle visibility  
**Author**: Jeremy Fowler  
**License**: MIT  
**Version**: 0.6.0  

This is a standalone TypeScript NPM package that implements a Model Context Protocol (MCP) server enabling Claude Code to coordinate multiple specialized agents, track their progress in real-time, and understand exactly how they approach and solve complex tasks.

## Repository Context

- **Standalone NPM Package**: This is NOT part of a parent project - it's an independent package
- **GitHub**: https://github.com/jerfowler/agent-comm-mcp-server
- **NPM**: https://www.npmjs.com/package/@jerfowler/agent-comm-mcp-server
- **Node.js**: >= 18.0.0 required

## Architecture

### Core Design Principles
- **Zero File Path Exposure**: Agents never see file paths, only clean context IDs
- **Non-Blocking Operations**: All agents can work simultaneously 
- **Context-Based Abstraction**: Clean task descriptions automatically generated
- **Diagnostic Visibility**: Monitor without controlling execution flow

### Component Hierarchy
```
MCP SDK Layer (JSON-RPC communication)
    ↓
Tool Layer (17 specialized MCP tools)
    ↓
Core Layer (TaskContextManager, ConnectionManager, EventLogger)
    ↓
Utility Layer (FileSystem, LockManager, TaskManager, validation)
    ↓
Storage Layer (File system with locking coordination)
```

### Task Lifecycle
```
INIT → PLAN → PROGRESS → DONE/ERROR
  ↓      ↓        ↓         ↓
Context-based workflow with diagnostic visibility
```

## Development Workflow

### Building
```bash
npm run build          # TypeScript compilation with auto-generated version
npm run dev            # Watch mode with auto-reload
npm run clean          # Remove dist and generated files
```

### Testing Strategy (95% coverage required)
```bash
npm test               # Run all test suites (unit + smoke + integration)
npm run test:unit      # Unit tests with coverage
npm run test:smoke     # Quick critical path validation
npm run test:integration # Tool coordination tests
npm run test:lifecycle # Full task workflow tests
npm run test:e2e       # Complete system validation
npm run test:coverage  # Coverage report
npm run test:watch     # Watch mode during development
```

### Code Quality
```bash
npm run lint           # ESLint checking (zero warnings required)
npm run lint:fix       # Auto-fix ESLint issues
npm run type-check     # TypeScript validation with strict mode
npm run ci             # Complete CI pipeline (type + lint + test)
```

## Tool Categories (17 Total)

### Context-Based Tools (5 - Recommended)
- **`get_task_context`** - Get clean task context without file paths
- **`submit_plan`** - Submit implementation plan with progress markers  
- **`report_progress`** - Update progress with checkbox synchronization
- **`mark_complete`** - Complete task with intelligent reconciliation
- **`archive_completed_tasks`** - Batch cleanup operations

### Traditional Tools (7 - Advanced)
- **`create_task`** - Create tasks with duplicate prevention
- **`check_tasks`** - Check assigned tasks for agents
- **`read_task`/`write_task`** - Direct file access (INIT, PLAN, DONE, ERROR)
- **`list_agents`** - Agent statistics and workload
- **`archive_tasks`/`restore_tasks`** - Archive management

### Diagnostic Tools (2 - Monitoring)
- **`get_full_lifecycle`** - Complete task history and lifecycle
- **`track_task_progress`** - Real-time progress monitoring

### Utility Tools (3 - System)
- **`sync_todo_checkboxes`** - TodoWrite integration for checkbox sync
- **`get_server_info`** - Server metadata and capabilities
- **`ping`** - Health check and connectivity

## TodoWrite Hook Integration

### Hook Location
- **Source**: `.claude/hooks/sync-todos-to-checkboxes.py`
- **Target**: `~/.claude/hooks/sync-todos-to-checkboxes.py`

### Hook Behavior
- Reads JSON from stdin (not command-line arguments)
- Exit code 0: No action needed
- Exit code 2: Reminder with todo summary
- Handles TodoWrite events, ignores others

### Testing Hook
```bash
echo '{"tool":{"name":"TodoWrite"},"result":{"todos":[{"content":"Test todo","status":"completed","activeForm":"Testing"}]}}' | python3 ~/.claude/hooks/sync-todos-to-checkboxes.py
# Should output: "TodoWrite updated 1 todo: 1 completed, 0 in-progress, 0 pending"
```

### Verification
```bash
./scripts/verify-hook-installation.sh  # Comprehensive validation
```

## Publishing Process

### Current Status
- **Version**: 0.6.0
- **Ready**: ✅ All tests passing, build clean, npm package configured

### Publishing Steps
```bash
npm login                              # Browser-based authentication
npm publish --access public           # Publish to npm registry
gh release create v0.6.0             # Create GitHub release
npx @jerfowler/agent-comm-mcp-server  # Test published package
```

## Key Files

### Core Implementation
- **`src/index.ts`** - MCP server entry point and tool registration
- **`src/core/TaskContextManager.ts`** - Core abstraction layer  
- **`src/core/ConnectionManager.ts`** - Agent session tracking
- **`src/logging/EventLogger.ts`** - JSON Lines audit logging

### Tools Directory
- **`src/tools/*.ts`** - All 17 MCP tool implementations
- Each tool follows consistent validation and error handling patterns

### Configuration
- **`package.json`** - NPM package configuration and scripts
- **`tsconfig.json`** - TypeScript strict mode configuration
- **`jest.config.js`** - Test configuration with coverage requirements

### Documentation
- **`README.md`** - User-facing documentation and installation
- **`docs/PROTOCOL.md`** - Complete technical protocol reference
- **`docs/TODOWRITE-INTEGRATION.md`** - Hook integration details

## Common Development Tasks

### Adding a New MCP Tool
1. Create `src/tools/new-tool.ts` following existing patterns
2. Add validation using `src/utils/validation.ts`
3. Register in `src/index.ts` tools array
4. Add comprehensive tests in `tests/unit/tools/`
5. Update documentation in README and PROTOCOL.md

### Fixing TypeScript Strict Mode Issues
- Use non-null assertions (`!`) carefully after null checks
- Cast mocks to `jest.Mock` for fs-extra compatibility
- Check `exactOptionalPropertyTypes` requirements

### Test Pattern Examples
```typescript
// Mock fs-extra properly
(mockedFs.pathExists as jest.Mock).mockImplementation((path: string) => {
  return Promise.resolve(true);
});

// Use EventLogger deterministic features
await eventLogger.waitForWriteQueueEmpty();
```

### Hook Development
- Always test with both `python3` and `python` commands
- Use stdin for JSON input, not command-line arguments
- Exit code 2 means "success with information"
- Handle invalid JSON gracefully (exit code 0)

## Important Notes

### Security & Best Practices
- Never expose file paths to agents (use context IDs only)
- Always validate tool parameters before processing
- Use lock coordination for file operations
- Log all operations for audit trail

### TypeScript Configuration
- Strict mode enabled with `exactOptionalPropertyTypes`
- ES2022 target with ES modules
- Coverage thresholds: 95% lines, 85% branches, 96% functions

### Testing Requirements
- Maintain 95%+ test coverage
- Test both success and error paths
- Validate JSON-RPC response structures
- Use TypeScript type compliance checks

### Common Gotchas
- Hook must read from stdin, not argv
- MCP tools return structured responses, not plain strings
- TaskContextManager hides all file operations from agents
- Archive operations require proper timestamp formatting

## TypeScript Strict Mode Requirements

### Critical Testing Standards
This project uses TypeScript strict mode with `exactOptionalPropertyTypes: true`. ALL tests must pass TypeScript compilation without errors or warnings.

**NEVER skip TypeScript type checking on tests** - this leads to runtime failures in CI/CD pipelines.

### Jest + fs-extra Mock Patterns

#### ❌ WRONG - Automatic Mocking with Type Casting
```typescript
// DON'T DO THIS - causes "UnknownFunction" errors in strict mode
jest.mock('fs-extra');
const mockedFs = fs as unknown as MockedFsExtra;
(mockedFs.pathExists as jest.Mock).mockImplementation(...);
```

#### ✅ CORRECT - Factory Function Mocking
```typescript
// Factory function mock - proper TypeScript pattern
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  remove: jest.fn(),
  ensureDir: jest.fn()
}));

// Properly typed mock interface
const mockFs = fs as unknown as jest.Mocked<{
  pathExists: jest.MockedFunction<(path: string) => Promise<boolean>>;
  readFile: jest.MockedFunction<(path: string, encoding?: string) => Promise<string>>;
  writeFile: jest.MockedFunction<(path: string, data: string) => Promise<void>>;
  readdir: jest.MockedFunction<(path: string) => Promise<string[]>>;
  stat: jest.MockedFunction<(path: string) => Promise<{ isDirectory: () => boolean; mtime?: Date }>>;
  remove: jest.MockedFunction<(path: string) => Promise<void>>;
  ensureDir: jest.MockedFunction<(path: string) => Promise<void>>;
}>;

// Clean mock calls - no type casting needed
mockFs.pathExists.mockImplementation((filePath: string) => {
  // implementation
});
```

### Error Handling in Tests
```typescript
// ❌ WRONG - 'error' is of type 'unknown'
} catch (error) {
  expect(error.message).toContain('expected text');
}

// ✅ CORRECT - Proper error type assertion
} catch (error) {
  expect((error as Error).message).toContain('expected text');
}
```

### Mock Call Assertions
```typescript
// ✅ CORRECT - Type-safe mock call assertions
const writeFileCalls = mockFs.writeFile.mock.calls;
const planWriteCall = writeFileCalls.find(call => 
  (call as [string, string])[0].endsWith('PLAN.md')
) as [string, string];
expect(planWriteCall).toBeDefined();
expect(planWriteCall[1]).toContain('expected content');
```

### Promise-based Mock Returns
```typescript
// ✅ CORRECT - Always return promises for async mocks
mockFs.writeFile.mockImplementation(async (filePath: string, content: string) => {
  // logic here
  return Promise.resolve(); // ← Always return Promise for async functions
});
```

### Fixing Common Strict Mode Errors

1. **"UnknownFunction" errors**: Use factory function mocks instead of automatic mocking
2. **"Object is of type 'unknown'"**: Add proper type assertions `(error as Error)`
3. **"possibly undefined"**: Add null checks or proper type assertions
4. **"not assignable to parameter"**: Check mock function signatures match expected types
5. **Mock reassignment errors**: Use `.mockImplementation()` instead of reassigning mock functions

### CI Pipeline Requirements

**GitHub Actions MUST pass these checks**:
- `npm run type-check` - Zero TypeScript errors
- `npm run lint:all` - Zero ESLint warnings/errors  
- `npm run test:all` - 100% test success rate
- `npm run ci` - Complete pipeline validation

### Verification Commands
```bash
# Always run these before committing
npm run type-check      # TypeScript strict mode validation
npm run lint:all        # Code quality checks
npm run test:all        # Full test suite
npm run ci              # Complete CI pipeline

# Quick validation during development
npm run test:unit       # Unit tests only
npm run test:smoke      # Critical path tests
```

### References
- See `tests/unit/utils/file-system.test.ts` for correct fs-extra mock pattern
- TypeScript config: `tsconfig.all.json` with strict mode settings
- Jest config: `jest.config.mjs` with ESM and coverage requirements

## Environment Variables

```bash
AGENT_COMM_DIR=./comm                 # Task communication directory
AGENT_COMM_ARCHIVE_DIR=./comm/.archive # Archive storage location  
AGENT_COMM_LOG_DIR=./comm/.logs       # Operation logs directory
AGENT_COMM_DISABLE_ARCHIVE=false      # Disable archiving completely
AGENT_COMM_HOOK_DEBUG=true           # Enable hook debug mode
```

## Quick Reference Commands

```bash
# Development
npm run dev && npm test              # Build + test cycle
npm run ci                          # Full CI pipeline

# Debugging  
npm run test:debug                  # Debug with open handles detection
npm run test:watch                  # Interactive test development

# Publishing
npm run clean && npm run build && npm test:all  # Pre-publish verification
npm publish --access public                     # Publish to npm
```

This MCP server is designed to make AI agent coordination simple, transparent, and powerful. Focus on the context-based tools for the best user experience.