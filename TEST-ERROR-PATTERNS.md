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

**Last Updated**: 2025-09-09  
**Next Review**: Add patterns from any future test failures immediately