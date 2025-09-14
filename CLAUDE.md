# CLAUDE.md - Agent Communication MCP Server

This file provides guidance to Claude Code when working with the **agent-comm-mcp-server** NPM package.

## Project Overview

**Name**: `@jerfowler/agent-comm-mcp-server`  
**Purpose**: MCP server for AI agent task communication and delegation with diagnostic lifecycle visibility  
**Author**: Jeremy Fowler  
**License**: MIT  

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

## Comprehensive TypeScript Strict Mode Enforcement System

This project implements a **multi-layered enforcement system** to permanently eliminate TypeScript strict mode violations, 'any' types, and direct fs-extra imports. This system prevents the "never ending cycle of fix, break, repeat" through comprehensive validation at multiple checkpoints.

### Enforcement Architecture

The system uses **four complementary layers** that work together:

```
Layer 1: Real-time Write Validation (Claude Code hooks)
         ↓
Layer 2: Pre-commit Git Validation (Git hooks)
         ↓  
Layer 3: ESLint Strict Configuration (Build-time)
         ↓
Layer 4: TypeScript Strict Mode (Compile-time)
```

### Layer 1: Real-time Write Validation

**File**: `.claude/hooks/write-tool-validator.py`  
**Trigger**: Claude Code Write tool operations  
**Purpose**: Catch violations immediately as files are being written

**Features**:
- Blocks Write operations for TypeScript/JavaScript files with violations
- Pattern-based detection: `any` types, direct fs-extra imports, unsafe operations
- Runs TypeScript compiler check on content before write
- Runs ESLint validation on content before write
- Provides immediate feedback with fix suggestions

**Exit Codes**:
- `0` = Allow write (no violations)
- `1` = Block write (violations detected)
- `2` = Allow with warning

### Layer 2: Pre-commit Git Validation  

**File**: `.git/hooks/pre-commit`  
**Trigger**: Git commit operations  
**Purpose**: Comprehensive validation before code enters version control

**Six-Phase Validation**:
1. **TypeScript Strict Mode**: `npm run type-check` with `exactOptionalPropertyTypes`
2. **ESLint Strict Enforcement**: Zero tolerance for warnings/errors
3. **Critical File Validation**: Pattern scanning in staged files
4. **Test Coverage**: Maintain 95%+ coverage requirement
5. **Build Validation**: Ensure successful TypeScript compilation
6. **Documentation Consistency**: Check for API change documentation

**Cannot Be Bypassed**: All phases must pass for commit to succeed

### Layer 3: Hardened ESLint Configuration

**File**: `.eslintrc.cjs`  
**Updated Configuration**: Strict type checking with complete 'any' ban

**Key Rules**:
```javascript
extends: [
  'eslint:recommended',
  'plugin:@typescript-eslint/strict-type-checked',
  'plugin:@typescript-eslint/stylistic-type-checked'
],
rules: {
  // STRICT ENFORCEMENT: Ban 'any' types completely
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  
  // Ban direct fs-extra imports
  'no-restricted-imports': ['error', {
    patterns: [{
      group: ['fs-extra'],
      message: 'Import from ../utils/fs-extra-safe.js instead'
    }]
  }],
  
  // Ban 'any' in all contexts using AST selectors
  'no-restricted-syntax': ['error', {
    selector: 'TSTypeAnnotation > TSAnyKeyword',
    message: 'The "any" type is banned. Use specific types or unknown instead.'
  }]
}
```

### Layer 4: fs-extra-safe Utility Architecture

**File**: `src/utils/fs-extra-safe.ts`  
**Purpose**: Centralized, fully-tested fs-extra wrapper  
**Proven Solution**: Cherry-picked from commit `55c379a` with 82.4% coverage

**Benefits**:
- Eliminates fs-extra import inconsistencies across codebase
- Provides fallback mechanisms for edge cases
- Comprehensive test coverage eliminates repeated test failures
- Single source of truth for file system operations

### Session Continuity System

**Problem**: Context compaction can lose critical session state  
**Solution**: Automatic state capture and recovery hooks

#### Pre-Compact State Capture
**File**: `.claude/hooks/pre-compact-state-capture.py`  
**Trigger**: Before Claude Code context compaction  
**Captures**:
- Git context (branch, recent commits, status)
- Project context (package.json, version)
- Agent communication state (active tasks, progress)
- Todo lists and working directory context
- Environment variables and tool states

#### Session Recovery
**File**: `.claude/hooks/session-stats-recovery.py`  
**Trigger**: Session start/stats events  
**Features**:
- Finds and loads recent state captures
- Displays context recovery information
- Shows agent task status and git state
- Auto-cleanup of old state files

### Validation Commands

**Complete CI Pipeline**: 
```bash
npm run ci              # type-check + lint + all tests (must pass 100%)
```

**Individual Validation**:
```bash
npm run type-check      # TypeScript strict mode validation
npm run lint            # ESLint strict enforcement  
npm run test:unit       # Unit tests with 95%+ coverage requirement
npm run build           # TypeScript compilation verification
```

### Hook Installation

**Automatic Setup**: Hooks are stored in `.claude/hooks/` and automatically discovered by Claude Code

**Manual Verification**:
```bash
# Check hook permissions
ls -la .claude/hooks/
# Should show executable permissions (755) on all .py files

# Test Write validator (if needed)
echo '{"tool":{"name":"Write","parameters":{"file_path":"test.ts","content":"const x: any = 1;"}}}' | \
  .claude/hooks/write-tool-validator.py

# Test state capture (creates sample state file)
echo '{}' | .claude/hooks/pre-compact-state-capture.py
```

### Enforcement Metrics

**Before Enforcement**:
- 78.12% branch coverage (below 80% threshold)
- Recurring TypeScript strict mode violations  
- 192+ ESLint violations detected
- Repeated fs-extra import issues

**After Enforcement**:
- 84.08% branch coverage (above 80% threshold)
- Zero TypeScript strict mode violations allowed
- Zero ESLint violations allowed
- Centralized fs-extra-safe usage

### Critical Success Factors

1. **Never Lower Thresholds**: Test coverage and quality standards are never compromised
2. **Fix Forward**: Always fix code to match tests/standards, never vice versa  
3. **Multi-Layer Defense**: No single point of failure in enforcement
4. **Immediate Feedback**: Catch violations as early as possible in workflow
5. **Session Continuity**: Preserve context across compaction events
6. **Zero Tolerance**: All violations must be fixed before proceeding

### Troubleshooting

**Common Violations**:
```typescript
// ❌ BANNED - Direct any type
const data: any = response;

// ✅ ALLOWED - Specific type  
const data: ResponseData = response;

// ❌ BANNED - Direct fs-extra import
import * as fs from 'fs-extra';

// ✅ ALLOWED - fs-extra-safe utility
import * as fs from '../utils/fs-extra-safe.js';

// ❌ BANNED - Type assertion to any
const result = (data as any).property;

// ✅ ALLOWED - Proper type assertion
const result = (data as ResponseData).property;
```

**If Enforcement Fails**:
1. Check hook permissions: `ls -la .claude/hooks/`
2. Verify ESLint config: `cat .eslintrc.cjs`
3. Test TypeScript config: `npx tsc --showConfig`
4. Run individual validation: `npm run type-check && npm run lint`

This enforcement system ensures **100% clean pull requests** and eliminates the recurring TypeScript strict mode issues permanently.

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

## Git Feature Branch Workflow & Issue Management

This repository uses **Git Feature Branch Workflow** with **branch protection** on `main` and **comprehensive GitHub issue automation**. Direct commits to main are **prohibited**.

### Branch Protection Rules
- ✅ **No direct commits** to `main` - all changes via pull requests
- ✅ **Required code reviews** - at least 1 approval needed (admin can self-approve)
- ✅ **Required status checks** - comprehensive CI must pass:
  - `Comprehensive Testing / Quick Validation (Unit + Smoke)`
  - `Comprehensive Testing / Server Lifecycle Testing`
  - `Comprehensive Testing / MCP Protocol Integration (18, 20, 22)`
  - `Comprehensive Testing / Security & Dependency Scan`
  - `Comprehensive Testing / End-to-End Testing` (PR only)
- ✅ **Up-to-date branches** - must sync with main before merge
- ✅ **Admin enforcement** - even admins must follow workflow

### GitHub Issue Automation (Complete Implementation)

#### Automated Issue Processing
- ✅ **Auto-assignment** - All new issues assigned to repository owner (@jerfowler)
- ✅ **Smart labeling** - Content analysis adds priority and category labels:
  - `priority:high` for "critical", "urgent", "security" keywords
  - `priority:medium` for "important", "breaking" keywords  
  - `category:performance` for performance-related issues
  - `category:security` for security mentions
  - `category:testing` for test-related content
- ✅ **Welcome messages** - First-time contributors receive helpful onboarding
- ✅ **Issue commands** - Repository owner can use:
  - `/priority <level>` - Set priority (high, medium, low)
  - `/branch` - Get development branch suggestions
  - `/close [reason]` - Close issue with optional reason

#### PR-Issue Integration
- ✅ **Automatic linking** - PRs auto-link to issues via patterns:
  - `closes #123`, `fixes #456`, `resolves #789`
  - Branch names like `issue-123-feature-name`
  - Issue references like `#123` in PR body/title
- ✅ **Status updates** - Issues receive PR status notifications:
  - PR created, converted to draft, ready for review
  - Automatic closure when linked PR merges
- ✅ **Resolution tracking** - Merged PRs post completion messages to issues

#### Stale Issue Management  
- ✅ **30-day lifecycle** - Issues marked stale after 30 days inactivity
- ✅ **7-day warning** - Auto-closure 7 days after stale marking
- ✅ **Smart exemptions** - High priority and in-progress issues exempt
- ✅ **Automated reporting** - Stale items report when 5+ items detected

### Development Workflow

#### 1. Create Feature Branch
```bash
# From main branch
git checkout main && git pull origin main

# Create feature branch with proper naming
git checkout -b feature/task-delegation-improvements
# or
git checkout -b fix/typescript-strict-mode-error
# or  
git checkout -b docs/api-reference-update
```

#### 2. Make Changes and Test
```bash
# Run comprehensive CI pipeline before committing
npm run ci                    # Type check + lint + all tests

# Development cycle
npm run test:watch           # Watch mode during development
npm run dev                  # Auto-reload during changes
```

#### 3. Commit with Conventional Format
```bash
git add .
git commit -m "feat: add task delegation improvements

- Implement duplicate prevention in create_task tool
- Add comprehensive validation for task parameters  
- Update test coverage to maintain 95%+ requirement
- Add JSDoc documentation for new public APIs

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### 4. Push and Create PR
```bash
# Push feature branch
git push -u origin feature/task-delegation-improvements

# Create PR using custom alias (auto-configured)
gh pr-create                 # Uses: gh pr create --fill --assignee @me
```

#### 5. Monitor and Merge
```bash
# Check CI status
gh pr-checks                 # View status check results

# Merge when approved and CI passes
gh pr-merge                  # Uses: gh pr merge --squash --delete-branch
```

### Pre-configured GitHub CLI Aliases

The repository includes comprehensive workflow aliases for both development and issue management:

#### Development Workflow Aliases
```bash
gh pr-create                 # Create PR with auto-fill and self-assignment
gh pr-checks                 # Check PR CI status and results
gh pr-merge                  # Squash merge with automatic branch cleanup
gh feature                   # Create feature branch from GitHub issue
gh workflow-status           # Check recent workflow runs
```

#### Issue Management Aliases (11 Total)
```bash
# Issue Creation
gh bug-report                # Create bug report using template
gh feature-request           # Create feature request using template
gh doc-issue                 # Create documentation issue using template

# Issue Discovery & Triage
gh triage                    # View issues needing triage (needs-triage label)
gh high-priority             # View high-priority issues (priority:high)
gh my-issues                 # View your assigned issues
gh stale-issues              # View stale issues awaiting action

# Issue Workflow
gh start-work 123            # Create development branch from issue #123
gh issue-list                # List recent open issues (last 20)
gh issue-search "keyword"    # Search issues by keyword
gh completed-issues          # View recently completed issues
```

#### Issue-to-Branch-to-PR Workflow
```bash
# Complete workflow example
gh bug-report                # Create new bug report
gh triage                    # Review and prioritize
gh start-work 123            # Create branch: issue-123-bug-description
# Make fixes...
gh pr-create                 # Create PR (auto-links to issue #123)
gh pr-checks                 # Monitor CI status  
gh pr-merge                  # Merge (auto-closes issue #123)
```

### Branch Naming Conventions

Use descriptive branch names with type prefixes:

- `feature/` - New features (`feature/mcp-protocol-validation`)
- `fix/` - Bug fixes (`fix/context-manager-null-ref`)  
- `docs/` - Documentation (`docs/api-reference-update`)
- `refactor/` - Code improvements (`refactor/error-handling`)
- `test/` - Test additions (`test/integration-coverage`)
- `chore/` - Maintenance (`chore/dependency-updates`)
- `perf/` - Performance (`perf/file-io-optimization`)
- `ci/` - CI/CD changes (`ci/parallel-execution`)

### Commit Type Guidelines

**For MCP Server Features (Version Bumps):**
- `feat:` - New MCP tools, server capabilities, or user-facing functionality
- `fix:` - Bug fixes in server behavior, tool functionality, or user experience
- `perf:` - Performance improvements in server or tool execution

**For Infrastructure/Meta (No Version Bump):**
- `ci:` - GitHub Actions workflows, automation, testing infrastructure
- `chore:` - Dependencies, build scripts, maintenance tasks  
- `docs:` - Documentation updates, README improvements
- `test:` - Test additions, test infrastructure improvements
- `refactor:` - Code organization without functional changes

**Automatic Detection:**
The system automatically detects CI/CD "features" and treats them as chores to prevent unnecessary version bumps.

### PR Requirements Checklist

Before your PR can be merged:

#### Code Quality ✅
- [ ] TypeScript compilation passes (`npm run type-check`)
- [ ] ESLint passes with zero warnings (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Test coverage maintained at 95%+
- [ ] Code follows existing patterns

#### Documentation ✅  
- [ ] README.md updated (if needed)
- [ ] PROTOCOL.md updated (for API changes)
- [ ] JSDoc comments added for new APIs
- [ ] CHANGELOG.md entry (if applicable)

#### Security & Testing ✅
- [ ] Security audit passes (`npm audit`)
- [ ] No hardcoded credentials
- [ ] Comprehensive test coverage for new code
- [ ] Integration tests updated (if needed)

### Troubleshooting Workflow Issues

#### Branch Protection Bypass Attempt
```bash
# This will fail with "Changes must be made through a pull request"
git push origin main
# ❌ remote: error: GH006: Protected branch update failed
```

#### Failed CI Checks
```bash
# Check what failed
gh pr-checks

# Run locally to debug
npm run ci                   # Full pipeline
npm run test:unit            # Unit tests only
npm run type-check          # TypeScript issues
npm run lint                # Code style issues
```

#### Merge Conflicts
```bash
# Update your branch with latest main
git checkout main && git pull origin main
git checkout your-branch
git rebase main              # Or use: git merge main

# Resolve conflicts, then
git add . && git rebase --continue
git push --force-with-lease origin your-branch
```

### Documentation References

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Complete contribution guide with issue workflow
- **[BRANCHING.md](./BRANCHING.md)** - Detailed branching strategy  
- **[.github/pull_request_template.md](./.github/pull_request_template.md)** - PR template
- **[.github/ISSUE_TEMPLATE/](./.github/ISSUE_TEMPLATE/)** - Issue templates (bug_report, feature_request, documentation)

### GitHub Actions Workflows (3 Active)

- **[.github/workflows/issue-management.yml](./.github/workflows/issue-management.yml)** - Issue automation, labeling, assignment
- **[.github/workflows/pr-issue-linking.yml](./.github/workflows/pr-issue-linking.yml)** - PR-issue linking and auto-closure  
- **[.github/workflows/stale-issues.yml](./.github/workflows/stale-issues.yml)** - Stale issue lifecycle management

### Automated Release Workflow

**Two-Stage Architecture:**
1. **release.yml**: Creates version bump PRs with automated semantic versioning
2. **publish.yml**: Publishes to NPM and creates GitHub releases after PR merge

**Version Bumping:**
- `feat:` → Minor version bump
- `fix:` → Patch version bump  
- `BREAKING CHANGE` or `!:` → Major version bump
- `chore/docs/test/style/refactor/ci:` → No version bump

**Quick Commands:**
```bash
node scripts/bump-version.cjs --dry-run     # Preview version bump
gh workflow run release.yml --ref main     # Trigger release workflow
```

**NPM Publishing Requirements:**
- `NPM_TOKEN` secret must be configured in repository settings
- Use automated workflows - never publish manually


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

## Enhanced Logging System (Issue #50 Implementation)

### Logging Infrastructure

The project implements a comprehensive three-tier logging system:

1. **EventLogger**: Production audit trails and operational logs
2. **ErrorLogger**: Centralized error capture and analysis
3. **Debug Package**: Development debugging and performance monitoring

### Error Tracking Capabilities

**ErrorLogger System:**
- Captures all MCP server response errors
- Tracks tool execution failures with context
- Logs runtime exceptions and validation errors
- Provides error pattern analysis for agent training
- Integrates with ResponseEnhancer and AccountabilityTracker

**Error Log Format**: JSON Lines (.jsonl) in `./comm/.logs/error.log`

**Error Sources Tracked:**
- MCP server response errors
- Tool execution failures
- Runtime exceptions
- Validation failures
- Network/connection issues

### Debug Package Integration

**Package**: debug@^4.4.3 with comprehensive namespace hierarchy

**Namespace Structure:**
```typescript
// Core system debugging
'agent-comm:core:accountability'     // AccountabilityTracker operations
'agent-comm:core:compliance'         // ComplianceTracker operations
'agent-comm:core:connection'         // ConnectionManager operations
'agent-comm:core:response'           // ResponseEnhancer operations
'agent-comm:core:context'            // TaskContextManager operations

// Tool system debugging
'agent-comm:tools:create-task'       // Task creation operations
'agent-comm:tools:archive'           // Archive operations
'agent-comm:tools:progress'          // Progress tracking
'agent-comm:tools:sync'              // Synchronization operations

// Logging system debugging
'agent-comm:logging:event'           // EventLogger operations
'agent-comm:logging:error'           // ErrorLogger operations

// Utility debugging
'agent-comm:utils:validation'        // Input validation
'agent-comm:utils:file-system'       // File operations
'agent-comm:utils:lock-manager'      // Lock management
```

**Environment Variable Control:**
```bash
# Development - verbose debugging
DEBUG=agent-comm:* npm start

# Production troubleshooting - errors only
DEBUG=agent-comm:logging:error npm start

# Component-specific debugging
DEBUG=agent-comm:core:response,agent-comm:tools:create-task npm start

# Performance monitoring
DEBUG=agent-comm:*:perf npm start
```

**Performance Timing**: All critical operations include timing instrumentation with alerts for slow operations.

### Integration with Existing Systems

**ResponseEnhancer Integration:**
- Uses error history for response improvement
- Analyzes error patterns for agent training recommendations
- Provides structured error context in enhanced responses

**AccountabilityTracker Integration:**
- Tracks error attribution by agent
- Includes error metrics in compliance scoring
- Provides error-based red flag detection

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

## Publishing

All releases are handled through automated GitHub Actions workflows:
1. **release.yml**: Creates version bump PRs with automated semantic versioning
2. **publish.yml**: Publishes to NPM and creates GitHub releases after PR merge

**Never publish manually** - always use the automated two-stage workflow.

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


## Important Notes

### Security & Best Practices
- **🔒 CRITICAL**: Never commit API keys or sensitive credentials to git
- Use `.mcp.json.example` as template, actual `.mcp.json` is gitignored
- Run `npm run setup` for safe MCP configuration setup
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

### Important Notes
- MCP tools return structured responses, not plain strings
- TaskContextManager abstracts all file operations from agents  
- Archive operations use proper timestamp formatting

## TypeScript Strict Mode Requirements

This project uses TypeScript strict mode with `exactOptionalPropertyTypes: true`. ALL tests must pass TypeScript compilation.

**Key Patterns:**
- Use factory function mocking for fs-extra: `jest.mock('fs-extra', () => ({...}))`
- Type error assertions: `(error as Error).message`
- Always return promises for async mock functions
- Use proper type assertions instead of type casting

**Reference**: See `tests/unit/utils/file-system.test.ts` for correct patterns.

### Essential Commands
```bash
# Before committing - must pass 100%
npm run ci              # Complete pipeline (type + lint + test)
npm run type-check      # TypeScript validation  
npm run test:all        # Full test suite
npm run lint:all        # Code quality

# Development
npm run test:unit       # Unit tests only
npm run test:smoke      # Critical path validation
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

# Automated Semver Workflow
node scripts/bump-version.cjs --dry-run         # Preview version bump
gh workflow run promote.yml --ref test          # Trigger test promotion
gh workflow run release.yml --ref main          # Trigger main release
npm run version:bump:dry                        # Quick version preview

# Workflow Verification
# Use: .claude/commands/verify-workflow.yaml
# Manual checks:
node scripts/bump-version.cjs --dry-run         # Test version detection
gh workflow list                                # List all workflows
gh run list --limit 5                          # Recent workflow runs

# Publishing (automated only)
gh workflow run release.yml --ref main          # Create release PR
# After PR merge, publish.yml automatically publishes to NPM
```

## **🚨 CRITICAL: Test Error Prevention System**

**MANDATORY FOR ALL AGENTS**: This project implements a comprehensive test error prevention system to eliminate recurring patterns that cause CI/CD failures.

### **Required Reading Before Any Test Work**

1. **`TEST-ERROR-PATTERNS.md`** - Database of all banned error patterns with examples
2. **`TEST-GUIDELINES.md`** - Comprehensive mandatory requirements and enforcement

### **Zero Tolerance Violations**

The following patterns will cause **immediate pre-commit hook failure** and must be avoided:

- **❌ 'any' types in test files** - Use `as unknown as SpecificType` instead
- **❌ Logical OR (`||`) for defaults** - Use nullish coalescing (`??`) instead  
- **❌ Missing configuration validation** - Tests expecting errors must have runtime validation
- **❌ Invalid test plans** - Must be >50 chars with proper structure and checkboxes
- **❌ Incomplete mock setup** - Must mock ALL required files (INIT.md, PLAN.md, etc.)

### **Enforcement Mechanisms**

1. **Real-time Validation**: Claude Code hooks prevent violations during write
2. **Pre-commit Hook**: Comprehensive validation including all test suites
3. **Agent Constraints**: Backend engineers automatically receive prevention guidelines
4. **CI/CD Pipeline**: Branch protection with strict quality gates

### **Pre-Work Checklist**

Before ANY test-related work, agents must:
- [ ] Review `TEST-ERROR-PATTERNS.md` for current banned patterns
- [ ] Follow all requirements in `TEST-GUIDELINES.md`
- [ ] Verify no 'any' types will be used in test files
- [ ] Confirm proper TypeScript patterns and ESLint compliance
- [ ] Ensure complete mock setup for all dependencies

### **Escalation Process**

If a new error pattern is discovered:
1. **STOP** all work immediately
2. **Document** in `TEST-ERROR-PATTERNS.md`
3. **Update** prevention guidelines and agent constraints
4. **Only then** fix the specific instance

**Success Metric**: Zero repeated patterns from the error database - once documented, never repeated.

---

This MCP server is designed to make AI agent coordination simple, transparent, and powerful. Focus on the context-based tools for the best user experience.