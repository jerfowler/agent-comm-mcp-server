# Pull Request

## 📋 Description
<!-- Provide a brief description of the changes in this PR -->

### Type of Change
<!-- Mark the appropriate option with an 'x' -->
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update (changes to documentation only)
- [ ] 🔧 Refactoring (code changes that neither fix bugs nor add features)
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test improvement/addition
- [ ] 🔨 Chore (maintenance, dependencies, build process)
- [ ] 🚀 CI/CD improvement

## 🎯 Motivation and Context
<!-- Why is this change required? What problem does it solve? -->
<!-- If it fixes an open issue, please link to the issue here -->
Fixes #<!-- issue number -->

## 🧪 Testing
<!-- Describe the tests you ran to verify your changes -->
<!-- Please also list any relevant details for your test configuration -->

### Test Categories Completed
- [ ] Unit tests (`npm run test:unit`)
- [ ] Integration tests (`npm run test:integration`)
- [ ] End-to-end tests (`npm run test:e2e`)
- [ ] Smoke tests (`npm run test:smoke`)
- [ ] Performance tests (if applicable)

### Test Coverage
- [ ] Coverage maintained at 95%+ (`npm run test:coverage`)
- [ ] New code has comprehensive test coverage
- [ ] Edge cases and error scenarios tested

### Manual Testing
<!-- Describe any manual testing performed -->
- [ ] Tested locally in development environment
- [ ] Verified MCP protocol compliance
- [ ] Tested with real Claude Code integration

## 📚 Documentation
<!-- Check all that apply -->
- [ ] Code is self-documenting with clear variable/function names
- [ ] JSDoc comments added/updated for new public APIs
- [ ] README.md updated (if applicable)
- [ ] PROTOCOL.md updated (if API changes)
- [ ] CHANGELOG.md entry added (if applicable)
- [ ] Migration guide provided (if breaking changes)

## 🔍 Code Quality Checklist

### Pre-submission
- [ ] Code follows project style guide
- [ ] TypeScript compilation passes (`npm run type-check`)
- [ ] ESLint passes with no warnings (`npm run lint`)
- [ ] All tests pass locally (`npm run ci`)
- [ ] No console.log statements left in code
- [ ] No commented-out code blocks

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation added for new endpoints
- [ ] Security audit passes (`npm audit`)
- [ ] No new high/critical vulnerabilities introduced
- [ ] Authentication/authorization properly implemented (if applicable)

### Performance
- [ ] No obvious performance regressions
- [ ] Efficient algorithms and data structures used
- [ ] Memory leaks checked and prevented
- [ ] Async operations properly handled

## 🔄 Dependencies
<!-- List any new dependencies added -->
- [ ] No new dependencies added
- [ ] New dependencies justified and documented
- [ ] Dependencies are actively maintained
- [ ] License compatibility verified

## 💥 Breaking Changes
<!-- If this is a breaking change, describe the impact and migration path -->
- [ ] No breaking changes
- [ ] Breaking changes documented
- [ ] Migration guide provided
- [ ] Backward compatibility considered

## 📸 Screenshots/Demos
<!-- If applicable, add screenshots or demo GIFs -->
<!-- For API changes, consider including example requests/responses -->

## 🔗 Related Issues
<!-- Link any related issues, PRs, or external resources -->
- Related to #
- Follows up on #
- Blocks #

## 🚀 Deployment Notes
<!-- Any special instructions for deployment -->
- [ ] No special deployment requirements
- [ ] Database migrations required
- [ ] Configuration changes needed
- [ ] Environment variables updated

## 🧠 Reviewer Focus Areas
<!-- Highlight specific areas where you want reviewer attention -->
- [ ] Algorithm correctness
- [ ] Error handling
- [ ] Performance implications
- [ ] Security considerations
- [ ] API design
- [ ] Test coverage completeness

## ✅ Final Checklist
<!-- Confirm before submitting -->
- [ ] I have read and followed the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
- [ ] I have checked that no similar PR already exists
- [ ] I have self-reviewed my code thoroughly
- [ ] I have added appropriate tests for my changes
- [ ] I have updated documentation as needed
- [ ] All CI checks are passing
- [ ] I have assigned appropriate reviewers

---

### 📝 Additional Notes
<!-- Any additional information that reviewers should know -->

### 🤖 AI Assistance
<!-- If AI tools were used in development, mention them -->
- [ ] Developed with Claude Code assistance
- [ ] Code reviewed by AI tools
- [ ] Tests generated with AI assistance