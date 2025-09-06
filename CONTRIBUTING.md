# Contributing to Agent Communication MCP Server

Thank you for your interest in contributing to the Agent Communication MCP Server! This guide will help you get started with our Git Feature Branch Workflow.

## 🔒 Branch Protection Policy

The `main` branch is protected and enforces the following rules:
- ✅ **No direct commits** - All changes must go through pull requests
- ✅ **Required code reviews** - At least 1 approval required
- ✅ **Status checks must pass** - All CI/CD tests must pass
- ✅ **Up-to-date branches** - Branches must be current before merging
- ✅ **Admin enforcement** - Even admins must follow the workflow

## 🚀 Quick Start

### 1. Fork and Clone (External Contributors)
```bash
gh repo fork jerfowler/agent-comm-mcp-server --clone
cd agent-comm-mcp-server
```

### 2. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
# or use GitHub CLI to link with an issue:
gh issue develop 123 --name feature/your-feature-name
```

### 3. Make Changes and Test
```bash
# Install dependencies
npm ci

# Run tests during development
npm run test:watch

# Ensure all quality checks pass before committing
npm run ci
```

### 4. Commit Using Conventional Commits
We use [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

#### Commit Format
```
type(scope): description

[optional body]

[optional footer(s)]
```

#### Commit Types
- **feat**: New features (triggers minor version bump)
- **fix**: Bug fixes (triggers patch version bump) 
- **docs**: Documentation changes only
- **style**: Code style changes (formatting, no logic changes)
- **refactor**: Code restructuring without functionality changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, tooling, dependencies
- **ci**: CI/CD configuration changes
- **build**: Build system changes

#### Breaking Changes
For breaking changes, add `!` after type or include `BREAKING CHANGE:` in footer:
```bash
feat!: redesign MCP protocol interface

BREAKING CHANGE: The task creation API now requires explicit agent names
```

#### Examples
```bash
git add .
git commit -m "feat: add new MCP tool for task delegation

- Implement create_task tool with duplicate prevention
- Add comprehensive test coverage (95%+ maintained)
- Update documentation with usage examples

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 5. Push and Create Pull Request
```bash
git push -u origin feature/your-feature-name
gh pr create --fill --assignee @me
```

## 📋 Pull Request Requirements

Before your PR can be merged, ensure:

### Code Quality ✅
- [ ] All tests pass (`npm test`)
- [ ] Code coverage maintained at 95%+
- [ ] TypeScript compilation with no errors (`npm run type-check`)
- [ ] ESLint passes with no warnings (`npm run lint`)
- [ ] Code follows existing patterns and conventions

### Testing ✅
- [ ] Unit tests added/updated for new functionality
- [ ] Integration tests updated if applicable
- [ ] End-to-end tests pass for PR changes
- [ ] Performance tests show no significant regressions

### Documentation ✅
- [ ] README.md updated for new features
- [ ] PROTOCOL.md updated for API changes
- [ ] JSDoc comments added for new functions/classes
- [ ] CHANGELOG.md entry added (if applicable)

### Security & Dependencies ✅
- [ ] No security vulnerabilities introduced (`npm audit`)
- [ ] Dependencies are up-to-date and justified
- [ ] No credentials or sensitive information in code
- [ ] Proper input validation for new endpoints

## 🎯 Commit Message Convention

We follow [Conventional Commits](https://conventionalcommits.org/) with semantic prefixes:

```
<type>(<scope>): <description>

<body>

<footer>
```

### Types
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring without feature changes
- `test`: Test additions or improvements
- `chore`: Maintenance tasks (deps, build, etc.)
- `perf`: Performance improvements
- `ci`: CI/CD pipeline changes

### Examples
```bash
feat(tools): add create_task tool with duplicate prevention
fix(core): resolve TaskContextManager null reference error
docs: update README with new installation instructions
test: add integration tests for MCP protocol validation
```

## 🧪 Testing Standards

### Test Coverage Requirements
- **Minimum**: 95% line coverage
- **Branches**: 85% branch coverage  
- **Functions**: 96% function coverage

### Test Categories
1. **Unit Tests** (`npm run test:unit`) - Fast, isolated tests
2. **Integration Tests** (`npm run test:integration`) - MCP protocol tests
3. **End-to-End Tests** (`npm run test:e2e`) - Full system validation
4. **Performance Tests** - Response time and throughput validation

### Writing Tests
```typescript
// Follow existing patterns in tests/
describe('ToolName', () => {
  beforeEach(() => {
    // Setup test environment
  });

  it('should handle valid input correctly', async () => {
    // Test implementation
  });

  it('should throw error for invalid input', async () => {
    // Error case testing
  });
});
```

## 🔄 Review Process

### Automated Checks
All PRs automatically run:
1. **Quick Validation** - Type checking, linting, unit tests
2. **Lifecycle Testing** - Server startup/shutdown validation
3. **Integration Testing** - MCP protocol compliance (Node 18, 20, 22)
4. **Security Scanning** - Dependency vulnerabilities
5. **E2E Testing** - Complete system validation (PR only)
6. **Performance Testing** - Regression detection (PR only)

### Human Review
- At least 1 approving review required
- Focus on:
  - Code correctness and maintainability
  - Security implications
  - Performance impact
  - Documentation completeness
  - Test coverage adequacy

## 🔀 Merge Strategy

- **Squash and Merge** preferred for feature branches
- **Merge Commit** for release branches only
- **Delete branch after merge** to keep repository clean
- **Linear history** maintained on main branch

## 🛠 Development Workflow

### Branch Strategy

We use a **test→main** branch strategy with automated versioning:

- **`test` branch** - Integration branch for new features
- **`main` branch** - Stable release branch with automated versioning
- **Feature branches** - Created from `test` for individual features

#### Workflow Overview
```
feature/* → test (via PR) → main (automated promotion) → npm release
```

### Local Development
```bash
# Install dependencies
npm ci

# Start development mode with auto-reload
npm run dev

# Run tests in watch mode
npm run test:watch

# Run full CI pipeline locally
npm run ci
```

### Feature Development Process

1. **Create feature branch from test**:
   ```bash
   git checkout test
   git pull origin test
   git checkout -b feature/your-feature-name
   ```

2. **Work on your feature**:
   ```bash
   # Make changes with conventional commits
   git add .
   git commit -m "feat: add new functionality"
   
   # Push and create PR to test
   git push -u origin feature/your-feature-name
   gh pr create --base test --fill
   ```

3. **Integration testing**: Once merged to `test`, comprehensive validation runs

4. **Promotion to main**: Weekly automated promotion from `test` to `main`

5. **Automated release**: Merging to `main` triggers:
   - Semantic version bump (based on commit types)
   - CHANGELOG.md update
   - Git tag creation  
   - NPM package publication
   - GitHub release creation

### Manual Promotion (if needed)

Repository maintainers can trigger manual promotion:

```bash
# Trigger promotion workflow
gh workflow run promote.yml --ref test

# Or force promotion even without changes  
gh workflow run promote.yml --ref test -f force_promote=true
```

### GitHub CLI Workflow
```bash
# Create feature branch from issue
gh issue develop 123

# Check PR status
gh pr status

# Check CI status
gh pr checks

# Merge when ready
gh pr merge --squash --delete-branch
```

## 🎯 Issue Management Workflow

We use a comprehensive automated issue workflow that integrates with our Git Feature Branch Workflow.

### Issue Types and Templates

Create issues using our specialized templates:

```bash
# Create a bug report
gh bug-report

# Create a feature request  
gh feature-request

# Create a documentation issue
gh doc-issue
```

Each template automatically:
- ✅ **Applies appropriate labels** (`bug`, `enhancement`, `documentation` + `needs-triage`)
- ✅ **Assigns to repository owner** for immediate visibility
- ✅ **Generates conventional commit titles** (`bug:`, `feat:`, `docs:`)
- ✅ **Welcomes first-time contributors** with helpful information

### Automated Issue Processing

When you create an issue, our automation:

1. **Auto-labeling**: Adds priority and category labels based on content
   - Keywords like "critical", "urgent", "security" → `priority:high`
   - Performance-related content → `category:performance`
   - Security mentions → `category:security`

2. **Status tracking**: Issues progress through states:
   - `needs-triage` → `in-progress` → `has-pr` → `completed`

3. **Smart notifications**: Repository owner gets immediate notification

### Issue-to-Branch-to-PR Workflow

Our recommended workflow for addressing issues:

```bash
# 1. Find issues to work on
gh triage                    # View issues needing triage
gh my-issues                 # View your assigned issues
gh high-priority             # View high-priority issues

# 2. Start work on an issue
gh start-work 123            # Creates branch from issue #123
# or manually:
gh issue develop 123 --name feature/fix-performance-issue

# 3. Work on the fix
npm run test:watch           # Keep tests running
npm run ci                   # Validate before commit

# 4. Create PR (automatically links to issue)
gh pr-create                 # Auto-links if branch created from issue

# 5. Monitor progress
gh pr-checks                 # Check CI status

# 6. Merge (automatically closes linked issues)
gh pr-merge                  # Squash merge with cleanup
```

### Issue Commands

Repository maintainers can use commands in issue comments:

- **`/priority high`** - Set priority level (`high`, `medium`, `low`)
- **`/branch`** - Get branch creation suggestions
- **`/close [reason]`** - Close issue with optional reason

### Issue Search and Management

Efficient issue management with CLI aliases:

```bash
# Finding issues
gh issue-list               # List open issues (last 20)
gh issue-search "keyword"   # Search issues by keyword
gh triage                   # Issues needing triage
gh high-priority            # High-priority issues
gh stale-issues             # Issues marked as stale

# Status tracking
gh my-issues                # Your assigned issues
gh completed-issues         # Recently completed issues
```

### Automated Issue Lifecycle

Issues automatically progress through our workflow:

1. **Created** → Auto-assigned, labeled, welcomed
2. **In Progress** → Linked to PR, status tracked
3. **Has PR** → PR status updates posted to issue
4. **Completed** → Auto-closed when PR merges
5. **Stale** → Auto-marked after 30 days inactivity
6. **Closed** → Auto-closed after 7 days stale (unless exempt)

### Priority and Labels

**Priority Levels** (auto-detected from content):
- `priority:high` - Critical bugs, security issues, urgent features
- `priority:medium` - Important improvements, breaking changes
- `priority:low` - Nice-to-have features, minor improvements

**Status Labels** (auto-managed):
- `needs-triage` - New issue awaiting review
- `in-progress` - Actively being worked on
- `has-pr` - Pull request created
- `completed` - Issue resolved
- `stale` - Inactive for 30+ days

**Category Labels** (auto-applied):
- `category:performance` - Performance-related issues
- `category:security` - Security vulnerabilities or improvements
- `category:testing` - Test-related improvements

### Issue Exemptions

Issues are exempt from stale marking if they have:
- `priority:high` or `priority:critical` labels
- `pinned` label for important ongoing discussions
- `enhancement:approved` for approved feature requests
- `bug:confirmed` for verified bugs
- `in-progress` or `has-pr` for active work

## 🐛 Reporting Issues

### Bug Reports
Use the bug report template and include:
- Environment details (Node.js version, OS)
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or error messages
- Minimal reproduction case

### Feature Requests
Use the feature request template and include:
- Use case description
- Proposed implementation approach
- Impact assessment
- Alternative solutions considered

## 📚 Code Style Guide

### TypeScript Standards
- Strict mode enabled (`exactOptionalPropertyTypes`)
- ES2022 target with ES modules
- Proper type annotations (avoid `any`)
- Interface over type aliases for object shapes

### File Organization
```
src/
├── tools/          # MCP tool implementations
├── core/           # Core business logic
├── utils/          # Utility functions
├── types/          # Type definitions
└── logging/        # Logging infrastructure

tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/            # End-to-end tests
└── fixtures/       # Test data
```

### Error Handling
```typescript
// Use structured error responses
throw new Error(JSON.stringify({
  code: 'INVALID_REQUEST',
  message: 'Task name is required',
  details: { field: 'taskName', value: undefined }
}));
```

## 🎉 Recognition

Contributors are recognized in:
- **CHANGELOG.md** for significant contributions
- **GitHub Contributors** graph
- **Commit history** with proper attribution
- **Release notes** for feature contributions

## 🤝 Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and community support
- **Code Review** - Detailed feedback on pull requests

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to making AI agent communication more efficient and reliable!** 🚀