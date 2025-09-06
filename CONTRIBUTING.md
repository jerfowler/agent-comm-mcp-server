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