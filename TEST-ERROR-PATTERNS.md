# Test Error Patterns Database

This document tracks all recurring test error patterns to prevent agents from repeating the same mistakes. **Every time a test error occurs, it must be documented here.**

## **Critical Principle: Zero Tolerance for Pattern Repetition**

Once an error pattern is identified and documented, it becomes **BANNED** across all future work. Agents must check this database before making any test changes.

---

## **Session: 2025-09-09 - Comprehensive Pre-commit Hook Implementation**

### **Pattern 1: 'any' Types in Test Files**

**Status**: 🚫 **BANNED** - Zero tolerance  
**Frequency**: 14 instances in single session  
**Impact**: TypeScript strict mode violations, ESLint failures, undermines type safety

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERNS
const serverPrivate = server as any;
const handlers = (server as any)._requestHandlers;
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED PATTERNS
interface ServerWithPrivates {
  _requestHandlers: Record<string, Function>;
}
const serverPrivate = server as unknown as ServerWithPrivates;
const handlers = (server as unknown as ServerWithPrivates)._requestHandlers;
```

#### **Prevention Rules:**
- **NO 'any' types anywhere in test files**
- Create proper interfaces for accessing private properties  
- Use `as unknown as SpecificType` for type-safe assertions
- Use bracket notation for optional properties: `capabilities?.['prompts']`

---

### **Pattern 2: ESLint Violations - Logical OR vs Nullish Coalescing**

**Status**: 🚫 **BANNED**  
**Frequency**: 10+ instances across multiple files  
**Impact**: Pre-commit hook failures, code quality issues

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERN
const value = someValue || defaultValue;

// ❌ BANNED PATTERN  
if (condition || defaultCondition) { ... }
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED PATTERNS
const value = someValue ?? defaultValue;

// ✅ REQUIRED PATTERNS
if (condition ?? defaultCondition) { ... }
```

#### **Prevention Rules:**
- Always use nullish coalescing (`??`) instead of logical OR (`||`) for default values
- Logical OR only for boolean logic, not for fallbacks
- ESLint rule: `@typescript-eslint/prefer-nullish-coalescing`

---

### **Pattern 3: Unnecessary Conditional Checks**

**Status**: 🚫 **BANNED**  
**Frequency**: Multiple files (EventLogger, TaskContextManager, agent-work-verifier)  
**Impact**: ESLint failures, redundant code

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERNS
if (this.writeQueue.length || this.isWriting) { return; }  // value always falsy
if (mtime && mtime > 0) { ... }  // types have no overlap
```

#### **Correct Patterns:**
```typescript  
// ✅ REQUIRED PATTERNS
this.writeQueue ??= [];  // Use nullish coalescing assignment
if (mtime) { ... }  // Remove redundant checks
```

#### **Prevention Rules:**
- Remove unnecessary null/undefined checks where TypeScript guarantees values
- Use nullish coalescing assignment (`??=`) for initialization
- Trust TypeScript's type system - don't double-check what it guarantees

---

### **Pattern 4: Configuration Validation Test Failures**

**Status**: 🚫 **BANNED**  
**Frequency**: 7 failing tests across 4 files  
**Impact**: Integration test suite failures

#### **Examples Found:**
```typescript
// ❌ PROBLEM: Tests expected errors but promises resolved
expect(markComplete(invalidConfig)).rejects.toThrow();
// But the tool wasn't actually validating required config components
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED: Add actual runtime validation
export const validateRequiredConfig = (config: any): void => {
  if (!config.connectionManager || !config.eventLogger) {
    throw new Error('Configuration missing required components');
  }
};

// In tool implementation:
validateRequiredConfig(config);
```

#### **Prevention Rules:**
- **All tools must validate required configuration components**
- Tests that expect errors must have corresponding runtime validation
- Never change tests to match broken code - fix the validation logic
- Use consistent validation patterns across all tools

---

### **Pattern 5: Integration Test Plan Format Issues**

**Status**: 🚫 **BANNED**  
**Frequency**: 4 failing tests in flexible-workflow.test.ts  
**Impact**: Plan validation failures

#### **Examples Found:**
```typescript
// ❌ PROBLEM: Test plans too short/simple
const plan = "Simple task plan";
// Failed: isValidPlanFormat() requires detailed content with progress markers
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED: Detailed plans with proper structure
const plan = `# Task Implementation Plan

## Overview
Complete implementation of the requested functionality.

## Steps
- [ ] Step 1: Initialize task components
- [ ] Step 2: Implement core functionality  
- [ ] Step 3: Add comprehensive testing
- [ ] Step 4: Validate and complete

## Acceptance Criteria
- All functionality working as expected
- Full test coverage maintained
- Documentation updated accordingly`;
```

#### **Prevention Rules:**
- **All test plans must meet minimum 50-character requirement**
- Include proper markdown structure with headers and sections
- Use checkbox format for progress markers
- Plans must be realistic and detailed, not just placeholders

---

### **Pattern 6: Missing Test Mocks and Setup**

**Status**: 🚫 **BANNED**  
**Frequency**: 1 critical failure in tool-coordination.test.ts  
**Impact**: Lock mechanism test failures

#### **Examples Found:**
```typescript
// ❌ PROBLEM: Missing required INIT.md mock
// Test failed because task wasn't properly initialized
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED: Complete task setup mocks
beforeEach(async () => {
  // Mock all required task files
  (mockedFs.pathExists as jest.Mock).mockImplementation((path: string) => {
    if (path.includes('INIT.md')) return Promise.resolve(true);
    if (path.includes('PLAN.md')) return Promise.resolve(true);
    return Promise.resolve(false);
  });
  
  (mockedFs.readFile as jest.Mock).mockImplementation((path: string) => {
    if (path.includes('INIT.md')) return Promise.resolve('Task initialized');
    if (path.includes('PLAN.md')) return Promise.resolve('# Plan\n- [ ] Step 1');
    return Promise.resolve('');
  });
});
```

#### **Prevention Rules:**
- **Mock ALL required files for proper task initialization**
- Include INIT.md, PLAN.md, and any other dependencies
- Test setup must mirror real task lifecycle
- Never skip required setup steps

---

## **Pattern Detection Checklist**

Before any test work, agents must verify:

- [ ] **No 'any' types used anywhere in test files**
- [ ] **All logical OR operators (`||`) replaced with nullish coalescing (`??`)**  
- [ ] **No unnecessary conditional checks - trust TypeScript types**
- [ ] **All tools validate required configuration components**
- [ ] **Test plans meet minimum format requirements (50+ chars, checkboxes, structure)**
- [ ] **All required mocks and setup included (INIT.md, PLAN.md, etc.)**
- [ ] **ESLint passes with zero warnings on all test files**
- [ ] **TypeScript strict mode compilation succeeds**

---

## **Escalation Process**

If a pattern occurs that's not in this database:

1. **STOP** - Do not proceed with the work
2. **Document** the new pattern immediately  
3. **Add prevention rules** to this database
4. **Update agent constraints** to prevent recurrence
5. **Only then** fix the specific instance

---

## **Success Metrics**

- **Zero repeated patterns** from this database
- **Pre-commit hook passes on first attempt**
- **No ESLint violations in any test files**
- **95%+ test coverage maintained**
- **All test suites pass: unit, smoke, integration, lifecycle, e2e**

---

---

## **Session: 2025-09-16 - ErrorLogger Integration & Coverage Improvements**

### **Pattern 7: Function Parameter Order Mismatches**

**Status**: 🚫 **BANNED**
**Frequency**: Multiple instances in report-progress tests
**Impact**: TypeScript compilation failures, test execution errors

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERN - Wrong parameter order
const result = await reportProgress(
  { agent: 'test-agent', updates: [...] },  // args first
  mockConfig  // config second
);
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED PATTERN - Config always first
const result = await reportProgress(
  mockConfig,  // config first
  { agent: 'test-agent', updates: [...] }  // args second
);
```

#### **Prevention Rules:**
- **Always check function signatures before writing tests**
- Configuration objects come before argument objects
- Use TypeScript IntelliSense to verify parameter order
- Never guess parameter positions - check the implementation

---

### **Pattern 8: Incorrect Result Object Property Access**

**Status**: 🚫 **BANNED**
**Frequency**: Found in report-progress test expectations
**Impact**: Test failures due to accessing non-existent properties

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERN - Wrong property names
expect(result.content).toContain('Progress updated');
expect(result.data).toBeDefined();
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED PATTERN - Use actual interface properties
expect(result.success).toBe(true);
expect(result.updatedSteps).toBeDefined();
expect(result.summary).toContain('Progress updated');
```

#### **Prevention Rules:**
- **Check TypeScript interfaces before accessing properties**
- Use autocomplete to verify property names exist
- Never assume property names - verify against types
- Run TypeScript compilation to catch property errors early

---

### **Pattern 9: Test Expectations Not Matching Implementation Behavior**

**Status**: 🚫 **BANNED**
**Frequency**: Multiple tests expecting throws when tool returns success
**Impact**: False test failures, incorrect error handling assumptions

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERN - Expecting throws when tool is permissive
await expect(reportProgress(config, {
  agent: 'test',
  updates: [{ step: 999, ... }]
})).rejects.toThrow();
// But tool logs warning and returns success
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED PATTERN - Match actual behavior
const result = await reportProgress(config, {
  agent: 'test',
  updates: [{ step: 999, ... }]
});
expect(result.success).toBe(true);  // Tool is permissive
expect(mockErrorLogger.logError).toHaveBeenCalledWith(
  expect.objectContaining({
    code: 'UNUSUAL_STEP_NUMBER'
  })
);
```

#### **Prevention Rules:**
- **Read implementation to understand actual behavior**
- Permissive tools log warnings but don't throw
- Test for logged errors, not thrown exceptions
- Update tests when implementation becomes more resilient

---

### **Pattern 10: Missing Required Test Function Properties**

**Status**: 🚫 **BANNED**
**Frequency**: Found in delegation-templates tests
**Impact**: Test failures due to incomplete function calls

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERN - Missing required parameters
generateDelegationChecklist('task-123');  // Missing targetAgent
generateDelegationReminder(85);  // Wrong type, expects array
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED PATTERN - Include all required parameters
generateDelegationChecklist('task-123', 'test-agent');
generateDelegationReminder([
  { taskId: 'task-123', targetAgent: 'agent', ageMinutes: 5 }
]);
```

#### **Prevention Rules:**
- **Check function signatures for ALL required parameters**
- Use TypeScript to enforce parameter requirements
- Never skip parameters even if they seem optional
- Verify parameter types match expectations

---

### **Pattern 11: String Content Expectation Mismatches**

**Status**: 🚫 **BANNED**
**Frequency**: Multiple assertion failures in template tests
**Impact**: False test failures due to wrong expected strings

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERN - Expecting wrong text
expect(result).toContain('TWO-PHASE');
// But actual text is 'Two-Phase Delegation Pattern'

expect(result).toContain('All delegations completed');
// But empty array returns empty string
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED PATTERN - Match actual implementation
expect(result).toContain('Two-Phase Delegation Pattern');
expect(generateDelegationReminder([])).toBe('');  // Empty for no delegations
```

#### **Prevention Rules:**
- **Run the function first to see actual output**
- Copy exact strings from implementation
- Don't assume text format - verify it
- Be careful with case sensitivity and punctuation

---

### **Pattern 12: Mock Setup Not Matching Implementation APIs**

**Status**: 🚫 **BANNED**
**Frequency**: Found in create-task test attempts
**Impact**: Tests fail because mocked functions don't exist

#### **Examples Found:**
```typescript
// ❌ BANNED PATTERN - Mocking wrong function names
jest.mock('../utils/validation', () => ({
  validateAgent: jest.fn()  // Wrong name
}));
// But actual export is validateAgentName
```

#### **Correct Patterns:**
```typescript
// ✅ REQUIRED PATTERN - Mock exact function names
jest.mock('../../../src/utils/validation', () => ({
  validateAgentName: jest.fn().mockReturnValue(undefined),
  validateTaskName: jest.fn().mockReturnValue(undefined),
  validateTaskType: jest.fn().mockReturnValue(undefined)
}));
```

#### **Prevention Rules:**
- **Check actual exports before mocking**
- Use exact function names from source files
- Mock all required dependencies
- Verify mock paths are correct

---

## **Updated Pattern Detection Checklist**

Before any test work, agents must verify:

- [ ] **No 'any' types used anywhere in test files**
- [ ] **All logical OR operators (`||`) replaced with nullish coalescing (`??`)**
- [ ] **No unnecessary conditional checks - trust TypeScript types**
- [ ] **All tools validate required configuration components**
- [ ] **Test plans meet minimum format requirements (50+ chars, checkboxes, structure)**
- [ ] **All required mocks and setup included (INIT.md, PLAN.md, etc.)**
- [ ] **Function parameter order matches implementation (config first, args second)**
- [ ] **Result object properties match actual interface definitions**
- [ ] **Test expectations match actual tool behavior (permissive vs strict)**
- [ ] **All required function parameters provided with correct types**
- [ ] **String expectations match exact implementation output**
- [ ] **Mock function names match actual exports exactly**
- [ ] **ESLint passes with zero warnings on all test files**
- [ ] **TypeScript strict mode compilation succeeds**

**Last Updated**: 2025-09-16
**Next Review**: Add patterns from any future test failures immediately