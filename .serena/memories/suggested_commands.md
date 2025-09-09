# Suggested Commands for Agent Communication MCP Server

## Development Commands
```bash
# Build and watch
npm run build          # TypeScript compilation with auto-generated version
npm run dev            # Watch mode with auto-reload
npm run clean          # Remove dist and generated files

# Testing (95% coverage required)
npm test               # Run all test suites (unit + smoke + integration)
npm run test:unit      # Unit tests with coverage
npm run test:watch     # Watch mode during development
npm run test:coverage  # Coverage report
npm run test:debug     # Debug with open handles detection

# Code Quality
npm run lint           # ESLint checking (zero warnings required)
npm run lint:fix       # Auto-fix ESLint issues
npm run type-check     # TypeScript validation with strict mode
npm run ci             # Complete CI pipeline (type + lint + test)

# Git Workflow
git checkout -b feature/your-feature  # Create feature branch
gh pr-create                          # Create PR with auto-fill
gh pr-checks                          # Check CI status
gh pr-merge                           # Squash merge with cleanup

# Version Management
npm run version:bump:dry              # Preview version bump
gh workflow run release.yml --ref main # Trigger release workflow
```

## System Commands (Linux)
```bash
ls -la                 # List files with details
cd <directory>         # Change directory
grep -r "pattern" .    # Search for pattern recursively
find . -name "*.ts"    # Find TypeScript files
git status             # Check git status
git diff               # View changes
```