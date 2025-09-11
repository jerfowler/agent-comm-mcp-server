# Comprehensive Test Guidelines

**CRITICAL**: This document contains **mandatory requirements** for all test-related work. Violation of these guidelines will result in immediate pre-commit hook failure and CI/CD pipeline rejection.

## **Core Principles**

### **1. Zero Tolerance Policy**
- **NO 'any' types** in any test files - use specific types or 'unknown'
- **NO ESLint violations** - all tests must pass strict linting
- **NO TypeScript strict mode violations** - 100% compliance required
- **NO skipped or disabled tests** without explicit justification
- **NO reduced test coverage** - maintain 95%+ at all times

### **2. Test-First Development (TDD)**
```bash
# REQUIRED WORKFLOW
1. Write failing tests FIRST
2. Update documentation SECOND  
3. Write implementation code LAST
4. Verify all tests pass FINALLY
```

### **3. Quality Gates**
Every test change must pass:
- ✅ TypeScript compilation (`npm run type-check`)
- ✅ ESLint strict enforcement (`npm run lint`)  
- ✅ All test suites (`npm run test` - unit, smoke, integration, lifecycle, e2e)
- ✅ 95%+ coverage requirement
- ✅ Pre-commit hook validation

---

## **MANDATORY PATTERNS**

### **Type Safety in Tests**

#### ❌ BANNED: 'any' Types
```typescript
// NEVER DO THIS
const server = mockServer as any;
const result = (response as any).data;
const handlers = (server as any)._requestHandlers;
```

#### ✅ REQUIRED: Proper Type Assertions
```typescript
// ALWAYS DO THIS
interface ServerWithPrivates {
  _requestHandlers: Record<string, Function>;
}

const server = mockServer as unknown as ServerWithPrivates;
const result = response as ResponseType;
const handlers = server._requestHandlers;
```

### **ESLint Compliance**

#### ❌ BANNED: Logical OR for Defaults
```typescript
// NEVER DO THIS
const value = someValue || defaultValue;
const config = userConfig || {};
```

#### ✅ REQUIRED: Nullish Coalescing
```typescript
// ALWAYS DO THIS  
const value = someValue ?? defaultValue;
const config = userConfig ?? {};
```

### **Configuration Validation Tests**

#### ❌ BANNED: Tests Without Runtime Validation
```typescript
// NEVER DO THIS - test expects error but no validation exists
it('should reject missing config', async () => {
  expect(tool({/* missing required fields */})).rejects.toThrow();
  // But the tool doesn't actually validate!
});
```

#### ✅ REQUIRED: Tests With Actual Validation
```typescript  
// ALWAYS DO THIS - implement validation that tests expect
// In tool implementation:
const validateConfig = (config: any): void => {
  if (!config.connectionManager) {
    throw new Error('Missing connectionManager');
  }
};

// In test:
it('should reject missing config', async () => {
  expect(tool({})).rejects.toThrow('Missing connectionManager');
});
```

### **Test Plan Formats**

#### ❌ BANNED: Minimal/Invalid Plans
```typescript
// NEVER DO THIS
const plan = "Simple task";
const plan = "Do something"; // Too short, no structure
```

#### ✅ REQUIRED: Detailed Plan Structure  
```typescript
// ALWAYS DO THIS
const plan = `# Implementation Plan

## Overview
Detailed description of what needs to be accomplished.

## Steps
- [ ] Step 1: Initialize components and dependencies
- [ ] Step 2: Implement core functionality with error handling
- [ ] Step 3: Add comprehensive test coverage
- [ ] Step 4: Validate integration points
- [ ] Step 5: Complete documentation and cleanup

## Acceptance Criteria
- All functionality works as specified
- Test coverage remains above 95%
- No ESLint or TypeScript violations
- Integration tests pass successfully

## Dependencies
- Required files: INIT.md, existing configuration
- External dependencies: database, file system access

This plan meets all format requirements with >50 characters, proper structure, and clear progress markers.`;
```

### **Test Setup and Mocking**

#### ❌ BANNED: Incomplete Mock Setup
```typescript
// NEVER DO THIS - missing required mocks
beforeEach(() => {
  (fs.readFile as jest.Mock).mockResolvedValue('some content');
  // Missing INIT.md, PLAN.md, and other required files!
});
```

#### ✅ REQUIRED: Complete Mock Setup
```typescript
// ALWAYS DO THIS - mock ALL required dependencies
beforeEach(async () => {
  // Mock all file operations
  (fs.pathExists as jest.Mock).mockImplementation((path: string) => {
    if (path.includes('INIT.md')) return Promise.resolve(true);
    if (path.includes('PLAN.md')) return Promise.resolve(true);
    if (path.includes('task-folder')) return Promise.resolve(true);
    return Promise.resolve(false);
  });
  
  (fs.readFile as jest.Mock).mockImplementation((path: string) => {
    if (path.includes('INIT.md')) {
      return Promise.resolve('# Task Initialization\nTask created successfully');
    }
    if (path.includes('PLAN.md')) {
      return Promise.resolve('# Plan\n- [ ] Step 1: Complete task\n- [ ] Step 2: Verify results');
    }
    return Promise.resolve('');
  });
  
  // Mock all required services
  mockEventLogger = {
    logOperation: jest.fn(),
    waitForWriteQueueEmpty: jest.fn().mockResolvedValue(undefined)
  };
  
  mockConnectionManager = {
    setCurrentTask: jest.fn(),
    getCurrentTask: jest.fn().mockReturnValue('current-task-id')
  };
});
```

---

## **CRITICAL VALIDATION CHECKLIST**

Before committing ANY test changes, verify:

### **Code Quality**
- [ ] **Zero 'any' types** in all test files
- [ ] **Zero ESLint warnings/errors** (`npm run lint` passes)
- [ ] **Zero TypeScript errors** (`npm run type-check` passes)
- [ ] **95%+ test coverage** maintained (`npm run test:coverage`)

### **Test Structure**  
- [ ] **All test plans** meet format requirements (>50 chars, structure, checkboxes)
- [ ] **All mocks complete** (INIT.md, PLAN.md, required services)
- [ ] **All error cases** have corresponding runtime validation
- [ ] **No skipped tests** without explicit justification

### **Integration**
- [ ] **All test suites pass**: `npm run test` (unit + smoke + integration + lifecycle + e2e)
- [ ] **Pre-commit hook passes** on first attempt
- [ ] **No --no-verify** commits (bypassing validation is banned)

---

## **SPECIFIC TOOL REQUIREMENTS**

### **MCP Tool Tests**
- Must test all tool parameters and validation
- Must test error conditions with proper error throwing  
- Must test success paths with complete response validation
- Must mock all external dependencies (file system, databases, APIs)

### **Integration Tests**
- Must use realistic test data and scenarios
- Must test complete workflows, not just individual functions
- Must validate MCP protocol compliance
- Must test error recovery and edge cases

### **Performance Tests**
- Must validate response times (<100ms for tools, <2s for workflows)
- Must test concurrent operations and race conditions
- Must validate memory usage and cleanup

---

## **ENFORCEMENT MECHANISMS**

### **Pre-commit Hook Validation**
The comprehensive pre-commit hook validates:
1. TypeScript strict mode compilation
2. ESLint strict enforcement (zero tolerance)
3. Pattern scanning for banned 'any' types
4. Complete test suite execution
5. Build validation
6. Documentation consistency

### **CI/CD Pipeline Requirements**
- **PR Validation**: Quick checks for basic compliance
- **Comprehensive Testing**: Full test suite with strict requirements
- **Branch Protection**: Cannot merge without all checks passing
- **No Force Push**: Cannot bypass validation requirements

### **Real-time Validation**
- Claude Code hooks validate content before write operations
- Pattern detection for common violations
- Immediate feedback with fix suggestions

---

## **COMMON VIOLATION REMEDIATION**

### **'any' Type Violations**
```bash
# Find all violations
grep -r "as any\|: any\|<any>" tests/

# Fix pattern:
# Replace: const x = y as any;
# With: const x = y as unknown as SpecificType;
```

### **ESLint Violations**
```bash
# Check and fix
npm run lint        # Identify issues
npm run lint:fix    # Auto-fix what's possible

# Common fixes:
# || → ?? (nullish coalescing)
# Remove unnecessary conditions
# Add missing type annotations
```

### **Test Coverage Issues**
```bash
# Check coverage
npm run test:coverage

# Identify missing coverage
npm run test:coverage -- --coverage-summary=json

# Add tests for uncovered lines/branches
```

---

## **ESCALATION PROCEDURES**

### **New Error Pattern Discovered**
1. **STOP** all work immediately
2. **Document** in `TEST-ERROR-PATTERNS.md`
3. **Update** this guidelines document
4. **Add** to pre-commit hook validation
5. **Only then** fix the specific instance

### **Persistent Test Failures**
1. **Never** disable or skip tests to fix failures
2. **Never** reduce coverage thresholds
3. **Never** use `--no-verify` to bypass validation
4. **Always** fix the root cause of the failure

### **Performance Issues**
1. **Profile** test execution to identify bottlenecks
2. **Optimize** test setup and teardown
3. **Mock** expensive operations appropriately
4. **Maintain** test isolation and independence

---

## **SUCCESS METRICS**

### **Quality Indicators**
- **Zero** pre-commit hook failures
- **Zero** CI/CD pipeline failures due to test issues  
- **95%+** test coverage maintained consistently
- **<2s** average test suite execution time
- **100%** TypeScript strict mode compliance

### **Process Indicators**
- **TDD workflow** followed for all new features
- **Pattern prevention** - no repeated violations from database
- **Documentation** updated with all test changes
- **Review process** catches issues before commit

---

## **REFERENCES**

- **Error Patterns**: `TEST-ERROR-PATTERNS.md`
- **Project Guidelines**: `CLAUDE.md`
- **Pre-commit Hook**: `.git/hooks/pre-commit`
- **ESLint Config**: `.eslintrc.cjs`
- **TypeScript Config**: `tsconfig.all.json`
- **Test Scripts**: `package.json` scripts section

---

**REMEMBER**: These guidelines are **mandatory**, not suggestions. Compliance is enforced at multiple levels and violations will prevent code from being committed or deployed.

**Last Updated**: 2025-09-09  
**Next Review**: When new patterns are discovered or guidelines need updates