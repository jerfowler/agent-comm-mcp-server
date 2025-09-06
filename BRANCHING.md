# Git Branching Strategy

This document outlines the Git branching strategy for the Agent Communication MCP Server project.

## 🌳 Branch Structure

### Main Branch (`main`)
- **Protected** - No direct commits allowed
- **Deployable** - Always contains production-ready code
- **Stable** - All tests pass, security scans clean
- **Tagged** - Release versions tagged from this branch

### Feature Branches
All development work happens in feature branches that merge back to `main` via pull requests.

## 🏷 Branch Naming Conventions

### Format
```
<type>/<short-description>
```

### Types and Examples

#### `feature/` - New Features
New functionality or enhancements:
- `feature/task-delegation-tool`
- `feature/progress-tracking-api`
- `feature/webhook-integration`
- `feature/performance-monitoring`

#### `fix/` - Bug Fixes
Correcting defects or issues:
- `fix/context-manager-null-ref`
- `fix/typescript-strict-mode`
- `fix/ci-pipeline-timeout`
- `fix/memory-leak-lifecycle`

#### `docs/` - Documentation Updates
Documentation improvements:
- `docs/api-reference-update`
- `docs/contribution-guide`
- `docs/installation-simplification`
- `docs/troubleshooting-section`

#### `refactor/` - Code Refactoring
Code improvements without feature changes:
- `refactor/task-context-abstraction`
- `refactor/error-handling-consistency`
- `refactor/test-utilities-consolidation`
- `refactor/logging-infrastructure`

#### `test/` - Test Additions/Improvements
Test-focused changes:
- `test/integration-coverage-improvement`
- `test/e2e-workflow-validation`
- `test/performance-benchmarking`
- `test/mock-patterns-standardization`

#### `chore/` - Maintenance Tasks
Dependencies, build tools, configuration:
- `chore/upgrade-node-lts`
- `chore/eslint-config-update`
- `chore/github-actions-optimization`
- `chore/dependency-security-patches`

#### `perf/` - Performance Improvements
Performance optimizations:
- `perf/task-lookup-optimization`
- `perf/file-io-batching`
- `perf/memory-usage-reduction`
- `perf/concurrent-processing`

#### `ci/` - CI/CD Pipeline Changes
Continuous integration improvements:
- `ci/parallel-test-execution`
- `ci/deployment-automation`
- `ci/security-scanning-enhancement`
- `ci/coverage-reporting`

### Branch Naming Best Practices

#### ✅ Good Names
- `feature/mcp-protocol-validation`
- `fix/task-completion-race-condition`
- `docs/api-response-examples`
- `test/edge-case-validation`

#### ❌ Avoid These
- `my-branch` (no type or description)
- `feature/123` (numbers without context)  
- `urgent-fix` (no type prefix)
- `feature/add-new-stuff` (too generic)

## 🔄 Branching Workflow

### 1. Create Feature Branch
```bash
# From main branch
git checkout main
git pull origin main

# Create and switch to feature branch
git checkout -b feature/your-feature-name

# Or use GitHub CLI with issue linking
gh issue develop 123 --name feature/your-feature-name
```

### 2. Develop and Commit
```bash
# Make changes
npm run test:watch  # Keep tests running

# Stage and commit using conventional commits
git add .
git commit -m "feat: implement task delegation tool

- Add create_task MCP tool with duplicate prevention
- Implement comprehensive validation and error handling  
- Add unit tests achieving 95%+ coverage
- Update API documentation with usage examples

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 3. Keep Branch Up-to-Date
```bash
# Regularly sync with main
git checkout main
git pull origin main
git checkout feature/your-feature-name
git rebase main  # or git merge main
```

### 4. Push and Create PR
```bash
# First push
git push -u origin feature/your-feature-name

# Create pull request
gh pr create --fill --assignee @me
```

### 5. Merge Strategy
- **Squash and Merge** (preferred) - Clean linear history
- **Merge Commit** - Only for multi-commit features that need history
- **Rebase and Merge** - For well-structured commit sequences

## 🚦 Branch Protection Rules

### Main Branch Protection
- ✅ Require pull request reviews (min 1 approval)
- ✅ Dismiss stale PR approvals when new commits pushed
- ✅ Require status checks to pass:
  - `Comprehensive Testing / Quick Validation`
  - `Comprehensive Testing / Server Lifecycle Testing`
  - `Comprehensive Testing / MCP Protocol Integration` (all Node versions)
  - `Comprehensive Testing / Security & Dependency Scan`
- ✅ Require branches to be up to date before merging
- ✅ Include administrators in restrictions
- ✅ Restrict pushes to main branch

### Status Check Requirements
All branches must pass comprehensive testing:

1. **Quick Validation** (10 min timeout)
   - TypeScript compilation
   - ESLint checks
   - Unit tests
   - Smoke tests

2. **Server Lifecycle Testing** (15 min timeout)
   - Server startup/shutdown validation
   - Connection handling tests

3. **Integration Testing** (20 min timeout)
   - Multi-Node version testing (18, 20, 22)
   - MCP protocol compliance
   - Real communication scenarios

4. **Security Scanning** (10 min timeout)
   - npm audit (high severity only)
   - Dependency vulnerability checks

5. **E2E Testing** (30 min timeout, PR only)
   - Complete system validation
   - Performance regression testing

## 🎯 Branch Lifecycle

### Short-lived Branches (Preferred)
- **Duration**: 1-3 days
- **Commits**: 1-5 focused commits
- **Scope**: Single feature or bug fix
- **Merge**: Squash and merge

### Medium-lived Branches (Occasional)
- **Duration**: 3-7 days  
- **Commits**: 5-15 well-structured commits
- **Scope**: Complex feature with sub-components
- **Merge**: Merge commit to preserve history

### Avoid Long-lived Branches
- **Duration**: >1 week
- **Problems**: Merge conflicts, outdated dependencies
- **Solution**: Break into smaller features

## 📊 Branch Management

### Regular Cleanup
```bash
# List merged branches
git branch --merged

# Delete local merged branches
git branch --merged | grep -v "main" | xargs -n 1 git branch -d

# Delete remote tracking branches
git remote prune origin
```

### Automated Cleanup
GitHub automatically deletes feature branches after PR merge when using "Delete branch" option.

## 🔀 Merge Strategies by Branch Type

| Branch Type | Merge Strategy | Rationale |
|------------|----------------|-----------|
| `feature/` | Squash and Merge | Clean history, single logical change |
| `fix/` | Squash and Merge | Atomic fix, easy to revert |
| `docs/` | Squash and Merge | Documentation updates are atomic |
| `refactor/` | Merge Commit | Preserve refactoring steps |
| `test/` | Squash and Merge | Test improvements are atomic |
| `chore/` | Squash and Merge | Maintenance changes are atomic |
| `perf/` | Merge Commit | Show performance optimization steps |
| `ci/` | Squash and Merge | Pipeline changes are atomic |

## 🚨 Emergency Procedures

### Hotfix Process
For critical production issues:

```bash
# Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b fix/critical-security-issue

# Make minimal fix
# Test thoroughly
# Create PR with "urgent" label
gh pr create --label urgent --assignee @me --reviewer @jerfowler
```

### Rollback Process
If a merged PR causes issues:

```bash
# Create revert PR
gh pr create --title "Revert: problematic change" --body "Reverts #123 due to production issue"

# Or use git revert
git revert <commit-hash>
git push origin main
```

## 📈 Branch Metrics

### Healthy Branch Metrics
- **Average lifetime**: 2-3 days
- **Average commits per branch**: 2-4
- **Merge success rate**: >95%
- **CI pass rate**: >90%

### Monitoring
Track via GitHub Insights:
- Branch creation/deletion patterns
- PR merge times
- CI/CD success rates
- Code review turnaround

## 🎓 Best Practices Summary

### ✅ Do This
- Use descriptive branch names with type prefixes
- Keep branches short-lived and focused
- Regularly sync with main branch
- Write clear commit messages
- Run tests before pushing
- Delete branches after merge

### ❌ Avoid This
- Long-lived feature branches
- Generic branch names
- Committing broken code
- Skipping CI checks
- Force pushing to shared branches
- Leaving stale branches

---

**This branching strategy ensures code quality, maintainability, and team collaboration efficiency.** 🌟