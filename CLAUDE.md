# CLAUDE.md - Agent Communication MCP Server

This file provides guidance to Claude Code when working with the **agent-comm-mcp-server** NPM package.

## Project Overview

**Name**: `@jerfowler/agent-comm-mcp-server`  
**Purpose**: MCP server for AI agent task communication and delegation with diagnostic lifecycle visibility  
**Author**: Jeremy Fowler  
**License**: MIT  
**Version**: 0.6.1  

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

### Comprehensive Automated Semver Workflow System

This repository implements a **complete automated semantic versioning workflow** that handles the entire lifecycle from feature development to NPM publication.

#### Workflow Architecture (8 GitHub Actions)
- **`test-validation.yml`** - Performance validation and CI checks
- **`comprehensive-testing.yml`** - Multi-layered testing strategy
- **`promote.yml`** - Feature → test branch with version analysis
- **`release.yml`** - Test → main with automated semver and NPM publication
- **`pr-validation.yml`** - PR quality gates
- **`issue-management.yml`** - Issue automation and labeling
- **`pr-issue-linking.yml`** - PR-issue integration
- **`stale-issues.yml`** - Stale issue lifecycle management

#### Automated Semantic Versioning
```bash
# Version bump script with CI/CD integration
node scripts/bump-version.cjs              # Analyze and bump version
node scripts/bump-version.cjs --dry-run    # Preview changes only
node scripts/bump-version.cjs --force-type=major  # Force version type
node scripts/bump-version.cjs --no-commit --no-tag  # Skip git operations
```

**Conventional Commit Detection:**
- `feat:` → Minor version bump (unless CI/CD related)
- `fix:` → Patch version bump  
- `BREAKING CHANGE` or `!:` → Major version bump (→ Minor in beta 0.x.x)
- `chore/docs/test/style/refactor/ci:` → No version bump

**Beta Versioning (0.x.x):**
- Breaking changes and features → **Minor bump** (prevents 1.0.0 until ready)
- Bug fixes → Patch bump
- Major version (1.0.0) → Only with explicit `--force-type=major` or production readiness

**Smart CI/CD Detection:**
CI/CD "features" are automatically treated as chores:
- Keywords: `workflow`, `CI`, `CD`, `github action`, `semver`, `branch`, `automation`, `pipeline`, `deployment`, `release`, `promotion`
- Example: `feat: implement GitHub Actions workflow` → Treated as chore (no version bump)

**Manual Version Override:**
Force specific version bump with commit message tags:
```bash
git commit -m "fix: resolve critical issue [force-patch]"    # Forces patch
git commit -m "feat: new feature [force-minor]"            # Forces minor  
git commit -m "feat!: breaking change [force-major]"       # Forces major
```

**Workflow Override:**
```bash
gh workflow run release.yml --ref main -f force_type=patch  # Manual dispatch
```

#### Complete Release Flow (Two-Stage Architecture)
```
Feature Branch → Test Branch → Main Branch → NPM Publication
     ↓              ↓             ↓              ↓
  promote.yml   release.yml   Stage 1: PR   Stage 2: Publish
                              Creation      NPM + GitHub Release
```

**Two-Stage Workflow Design:**
- **Stage 1 (release.yml)**: Creates version bump PR instead of direct push to main
- **Stage 2 (publish.yml)**: Triggers on main branch changes to publish NPM + create GitHub release
- **Critical Fix**: Uses `[skip release]` instead of `[skip ci]` to allow Stage 2 to run

**Key Features:**
- ✅ **Automated version analysis** based on conventional commits
- ✅ **CHANGELOG.md generation** with categorized changes  
- ✅ **Version consistency** across package.json, CHANGELOG.md, and git tags
- ✅ **GitHub release creation** with automated notes
- ✅ **NPM publication** with provenance (requires `NPM_TOKEN` secret)
- ✅ **Branch protection compliance** - no direct pushes to main
- ✅ **Version badges** in README.md for visibility

#### Workflow Verification
```bash
# Manual verification commands
node scripts/bump-version.cjs --dry-run     # Test version detection
npm run ci                                  # Full CI pipeline
gh workflow run promote.yml --ref test     # Test promotion workflow
gh workflow run release.yml --ref main     # Test release workflow
```

**Verification Command:** `.claude/commands/verify-workflow.yaml`
- Validates all 8 GitHub Actions workflows
- Tests version bump script functionality
- Confirms version consistency across files
- Checks workflow status and recent runs

#### NPM Publishing Setup Requirements

**Required Secret Configuration:**
```bash
# 1. Create NPM access token at npmjs.com:
# Account → Access Tokens → Generate New Token → Automation

# 2. Add to GitHub repository secrets:
# Repository Settings → Secrets and variables → Actions → New repository secret
# Name: NPM_TOKEN
# Value: [your-npm-token]

# 3. Retry failed publication (if needed):
gh workflow run publish.yml --ref main
```

**Testing Results (v0.6.1 Pipeline):**
- ✅ **Stage 1**: Version bump PR created and merged successfully
- ✅ **Version Detection**: Correctly detected 0.6.0 → 0.6.1 change
- ✅ **Package Build**: Generated 460.3 kB package with 127 files
- ✅ **Git Tagging**: v0.6.1 tag created and pushed
- ✅ **NPM Publish**: Successfully published with NPM_TOKEN authentication
- ✅ **GitHub Release**: v0.6.1 release created with automated changelog
- ✅ **Architecture Validation**: Complete two-stage workflow operational
- ✅ **End-to-End Validation**: Full pipeline tested and verified working

#### Implementation Lessons Learned

#### YAML Syntax in GitHub Actions
- **Problem**: Template literals with newlines cause YAML parsing errors
- **Solution**: Use array `.join('\n')` approach for multiline strings
- **Pattern**: Always validate YAML syntax before deploying workflows
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/file.yml'))"
```

#### Performance Validation Fixes
- **Problem**: MCP server startup failures in CI environment
- **Solution**: Replace memory tests with simple binary execution tests using `--help` flag
- **Pattern**: MCP servers require stdin connections not available in GitHub Actions

#### Two-Stage Workflow Critical Fix
- **Problem**: `[skip ci]` in release.yml prevented publish.yml from running
- **Root Cause**: Stage 1 (release.yml) used `[skip ci]` to prevent re-triggering itself, but this also blocked Stage 2 (publish.yml)
- **Solution**: Use `[skip release]` instead of `[skip ci]` to allow Stage 2 publication workflow to run
- **Pattern**: Use workflow-specific skip tags to avoid blocking dependent workflows

#### GitHub Actions Permissions
- **Problem**: Workflows failed without explicit permissions
- **Solution**: Add `permissions:` block to all workflow files
- **Required**: `contents: write`, `id-token: write`, `issues: read`, `pull-requests: read`

#### Single-Developer Workflow Adaptation
- **Challenge**: GitHub doesn't allow self-approval by default
- **Solution**: Admin can use `--admin` flag to merge: `gh pr merge --squash --delete-branch --admin`
- **Branch Protection**: Configured to allow admin bypass for single-developer repository

#### Issue Automation Validation
- **Testing**: Issue #8 validates complete automation pipeline
- **Results**: Auto-assignment ✅, priority labeling ✅, category detection ✅
- **Keywords**: "critical" → `priority:high`, "testing" → `category:testing`

#### Automated Semver Status
- **Current State**: v0.6.1 successfully released (full end-to-end validation complete)
- **Version Detection**: Fully functional with conventional commits and beta versioning
- **CI/CD Pipeline**: All 8 workflows operational and tested
- **NPM Publishing**: Live and verified - package available on NPM registry
- **Two-Stage Architecture**: Proven working with branch protection compliance
- **Ready for Production**: Complete automated release workflow operational

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
- **Version**: 0.6.1
- **Published**: ✅ Available on NPM registry
- **Ready**: ✅ All tests passing, build clean, two-stage workflow operational

### Publishing Steps (Automated)
```bash
# Automated via two-stage workflow:
# 1. Stage 1: Create version bump PR via release.yml
# 2. Stage 2: NPM publication via publish.yml after PR merge

# Manual publishing (if needed):
npm login                              # Browser-based authentication
npm publish --access public           # Publish to npm registry
gh release create v0.6.1             # Create GitHub release
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

# Publishing
npm run clean && npm run build && npm test:all  # Pre-publish verification
npm publish --access public                     # Publish to npm
```

This MCP server is designed to make AI agent coordination simple, transparent, and powerful. Focus on the context-based tools for the best user experience.