## Plan: Improve Branch Coverage to 80%+ to Fix CI Failures

### Objective
Increase branch coverage from 78.12% to ≥80% by adding comprehensive tests for uncovered branches in critical files, prioritizing TaskContextManager.ts and ResourceManager.ts.

### Testing Strategy

- [x] **Analyze Coverage Reports**: Review detailed branch coverage for priority files
  - Action: Examine uncovered lines in TaskContextManager.ts (62.73% branches)
  - Expected: Identify specific conditional branches and error paths missing tests
  - Error: If coverage report unavailable, run `npm run test:unit` locally
  - Notes: Focus on lines 269-288, 320-333, 405-417, 1170-1181, 1223-1235, 1339-1402

- [x] **TaskContextManager.ts Error Handling Tests**: Add tests for error branches (lines 269-288)
  - Action: Create tests for error conditions in task creation and validation
  - Expected: Cover exception throwing and error recovery paths
  - Error: Ensure tests are realistic and not contrived
  - Notes: Target ~15% branch coverage improvement in this file

- [x] **TaskContextManager.ts Edge Cases**: Add tests for validation branches (lines 405-417, 1170-1181)
  - Action: Test boundary conditions, null values, and invalid inputs
  - Expected: Cover all validation branches and conditional logic
  - Error: If tests fail, review logic to understand expected behavior
  - Notes: Focus on parameter validation and state checking

- [x] **TaskContextManager.ts Configuration Tests**: Add tests for config handling (lines 1223-1235)
  - Action: Test different configuration scenarios and defaults
  - Expected: Cover all configuration branches and fallback logic
  - Error: Verify configuration precedence is correctly tested
  - Notes: Test both valid and invalid configurations

- [x] **TaskContextManager.ts Advanced Scenarios**: Add tests for complex error paths (lines 1339-1402)
  - Action: Test concurrent operations, race conditions, and failure recovery
  - Expected: Cover remaining uncovered branches in advanced scenarios
  - Error: Use proper async testing patterns with proper cleanup
  - Notes: May require mock timing and concurrent operation simulation

- [x] **ResourceManager.ts Error Paths**: Add tests for error handling (lines 190-212, 336-344)
  - Action: Test resource loading failures, invalid resources, and error recovery
  - Expected: Cover all error handling branches
  - Error: Ensure proper error propagation is tested
  - Notes: Target ~20% branch coverage improvement in this file

- [x] **ResourceManager.ts Edge Cases**: Add tests for boundary conditions (lines 222-227, 244-245)
  - Action: Test empty resources, malformed data, and edge conditions
  - Expected: Cover validation and conditional branches
  - Error: Verify edge case handling matches intended behavior
  - Notes: Focus on input validation and state transitions

- [x] **Coverage Verification**: Run test suite and verify 80%+ branch coverage
  - Action: Execute `npm run test:unit` and review coverage report
  - Expected: Global branch coverage ≥ 80%, all tests passing
  - Error: If below 80%, analyze remaining uncovered branches and add more tests
  - Notes: Ensure no regression in other coverage metrics

### Success Metrics
- Global branch coverage reaches 80% or higher
- TaskContextManager.ts branch coverage improves from 62.73% to ~75%+
- ResourceManager.ts branch coverage improves from 60% to ~75%+
- All existing tests continue to pass without modification
- No decrease in lines, functions, or statements coverage