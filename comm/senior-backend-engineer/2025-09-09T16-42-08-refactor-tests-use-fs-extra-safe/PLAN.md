## Implementation Plan: Refactor Tests to Use fs-extra-safe

### Overview
Replace all direct fs-extra imports in test files with fs-extra-safe imports to resolve TypeScript strict mode violations and ensure reliable test execution.

### Implementation Steps

- [x] **Audit Test Files**: Find all test files using fs-extra directly
  - Action: Search for `from 'fs-extra'` pattern in test files
  - Expected: List of all test files needing refactoring
  - Error: If no files found, verify search pattern
  - Notes: Focus on `.test.ts` and `.spec.ts` files

- [x] **Fix ServerResourceProvider.test.ts**: Refactor critical failing test
  - Action: Replace fs-extra import with fs-extra-safe
  - Expected: TypeScript errors resolved, test passes
  - Error: Document specific error if refactoring fails
  - Notes: This is blocking PR #30

- [x] **Refactor Remaining Test Files**: Update all other test files
  - Action: Replace fs-extra imports with fs-extra-safe
  - Expected: All test files using safe wrapper
  - Error: Track any files with unique patterns
  - Notes: Maintain existing test logic

- [x] **Update Mock Patterns**: Fix mocking to work with fs-extra-safe
  - Action: Update jest.mock calls for fs-extra-safe
  - Expected: Mocks work with TypeScript strict mode
  - Error: Document specific mock patterns that fail
  - Notes: Use factory function pattern for mocking

- [x] **Verify TypeScript Compilation**: Ensure no strict mode violations
  - Action: Run `npm run type-check`
  - Expected: Zero TypeScript errors
  - Error: Document and fix any remaining violations
  - Notes: Must pass for CI to succeed

- [x] **Run Test Suite**: Validate all tests pass
  - Action: Run `npm test`
  - Expected: All tests passing
  - Error: Fix any broken tests from refactoring
  - Notes: Maintain existing test behavior

- [x] **Verify Test Coverage**: Ensure 95%+ coverage maintained
  - Action: Check coverage report from test run
  - Expected: Coverage ≥ 95%
  - Error: Add tests if coverage drops
  - Notes: Coverage is a project requirement

### Success Criteria
- Zero TypeScript strict mode violations
- All tests passing with fs-extra-safe
- 95%+ test coverage maintained
- PR #30 CI pipeline passing