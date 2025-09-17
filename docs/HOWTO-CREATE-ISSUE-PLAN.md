# HOWTO: Create GitHub Issue Plan - Comprehensive Guide

## 📋 OVERVIEW

This guide provides step-by-step instructions for creating comprehensive GitHub issue plans using the MCP orchestration pattern. Each issue plan enables Claude to orchestrate implementation via specialized agents with zero-trust verification and evidence-based completion.

## 🎯 CORE PRINCIPLES

### Test-Driven Development (TDD) - NON-NEGOTIABLE
- **Tests FIRST**: Write failing tests before ANY implementation
- **Implementation SECOND**: Write code to make tests pass
- **Refactor THIRD**: Clean up while keeping tests green
- **Verify CONSTANTLY**: Lint/type-check after EVERY file write
- **Documentation**: Keep TEST-ERROR-PATTERNS.md updated with new violations

### MCP Orchestration Pattern
- **Claude (Orchestrator)**: Creates MCP tasks, monitors progress, updates checklists
- **Agents (Implementers)**: Execute tasks with strict TDD, lint/type-check constantly, report progress
- **Separation of Concerns**: Orchestrator never implements; agents never orchestrate

### Zero-Trust Verification
- No claims without evidence
- Verification scripts must pass
- Lint/type-check after EVERY file write
- Progress reporting mandatory after each phase
- TEST-GUIDELINES.md compliance required
- TEST-DEBUGGING.md patterns must be followed
- TEST-ERROR-PATTERNS.md violations result in immediate failure

## 📁 PROJECT STRUCTURE

### Required Files (ALL issues must have these)

```
tmp/issue-{NUMBER}/
├── README.md                         # Main entry point with issue overview
├── requirements.md                   # Detailed technical specifications
├── existing-tests-to-update.md      # List of tests requiring updates
├── claude-implementation-prompt.md   # Copy-pasteable orchestration prompt
├── CHECKLIST.md                      # Comprehensive tracking checklist (CRITICAL)
└── verify-{descriptive-name}.sh     # Automated verification script (MUST align with CHECKLIST.md)
```

**IMPORTANT**: File creation order matters! Create in the sequence shown in Step-by-Step Process below.

### Optional Files (Based on Issue Complexity)

```
tmp/issue-{NUMBER}/
├── [REQUIRED FILES - see above]
├── {feature-name}-spec.md           # Detailed technical specifications for complex features
├── {feature-name}-plan.md           # Implementation strategy and architecture
├── migration-strategy.md            # Plan for migrating existing code/data
├── PLAN-SUMMARY.md                  # Executive summary of implementation approach
├── environment-suggestions.md       # External file modifications needed
├── implementation-log.md            # Created DURING implementation to track work
├── evidence-report.md               # Created AFTER implementation with proof
├── baseline-verification.log        # Output of verification script BEFORE work
└── final-verification.log           # Output of verification script AFTER work
```

## 📖 STEP-BY-STEP CREATION PROCESS

### Phase 1: Initial Setup & Analysis (10 minutes)

#### Step 1.1: Research GitHub Issue
```bash
# Access the GitHub issue
gh issue view {ISSUE_NUMBER} --repo {OWNER/REPO}

# Analyze and determine:
# - Issue title and description
# - Requirements and acceptance criteria
# - Technical complexity
# - Number of implementation phases needed (1-2 simple, 2-4 medium, 4-6 complex, 6+ epic)
# - Files that need modification
# - Tests that need updates
```

#### Step 1.2: Create Project Directory
```bash
# Create the issue directory
mkdir -p tmp/issue-{NUMBER}
cd tmp/issue-{NUMBER}

# NOTE: DO NOT use 'touch' to create empty files
# Each file will be created with complete content in subsequent phases
# Empty files can mislead Claude into thinking work is complete
```

### Phase 2: Create README.md (20 minutes)

Write the complete README.md file with all sections filled in:

```bash
# Create README.md with full content
Write("tmp/issue-{NUMBER}/README.md",
  content=`
# Issue #{NUMBER}: {TITLE}

## ⚠️ CRITICAL: {MAIN_PROBLEM_STATEMENT}

### What's Broken/Missing
1. **{Problem 1}**: {Description}
2. **{Problem 2}**: {Description}
3. **{Problem 3}**: {Description}

### Evidence of Issues
\`\`\`bash
# Commands showing current broken state
{command}
# Current output: {actual output}
# Expected output: {expected output}
\`\`\`

## Current State Analysis

### What Exists
- {Component 1}: {Current state}
- {Component 2}: {Current state}

### What's MISSING (Critical)
- **NO {Feature}**: {Why this is critical}
- **NO {Component}**: {Impact of missing}

## The Solution - Implementation Phases

**IMPORTANT**: The number of phases depends on issue complexity:
- **Simple Issues (1-2 phases)**: Single component changes, bug fixes
- **Medium Issues (2-4 phases)**: Multiple components, new features
- **Complex Issues (4-6 phases)**: System-wide changes, major features
- **Epic Issues (6+ phases)**: Complete subsystem rewrites

### Phase Examples (Adjust based on actual issue requirements):

#### For Bug Fix (2 phases):
- **Phase 1: Test & Fix** - Write tests, implement fix
- **Phase 2: Validation** - Update related tests, verify

#### For New Feature (3-4 phases):
- **Phase 1: Foundation** - Tests & core implementation
- **Phase 2: Integration** - Connect with existing systems
- **Phase 3: Polish** - Error handling, edge cases
- **Phase 4: Documentation** - API docs, examples

#### For Major Refactor (5-6 phases):
- **Phase 1: Test Coverage** - Establish baseline tests
- **Phase 2: Core Refactor** - Main architectural changes
- **Phase 3: Migration** - Update dependent systems
- **Phase 4: Performance** - Optimization and tuning
- **Phase 5: Integration** - Full system integration
- **Phase 6: Validation** - Complete verification

## Success Criteria
- [ ] All {N} phases complete with evidence
- [ ] Verification script passes 100%
- [ ] TypeScript/ESLint: Zero violations
- [ ] Test coverage: 95%+ maintained
- [ ] Performance: {specific metric}

## Red Flags to Watch For
1. **"It's done"** without running verification script
2. **"Tests updated"** without showing test output
3. **"No issues"** without running lint/type-check
4. **"Complete"** without evidence

## Quick Start
1. Read this README completely
2. Review CHECKLIST.md for detailed tasks
3. Copy claude-implementation-prompt.md and paste to Claude
4. Monitor progress via MCP tools
5. Verify completion with ./verify-{name}.sh`
)
```

### Phase 3: Create requirements.md (20 minutes)

Write the complete technical requirements file:

```bash
# Create requirements.md with full content
Write("tmp/issue-{NUMBER}/requirements.md",
  content=`
# Issue #{NUMBER} Technical Requirements

## Overview
{Brief technical overview of what needs to be implemented}

## Phase 1: {Name} (PRIORITY: HIGH)

### Requirement 1.1: {Specific Requirement}
**What**: {Detailed description}
**Why**: {Business/technical justification}
**Acceptance Criteria**:
- {Specific measurable criterion}
- {Specific measurable criterion}

**Verification**:
\`\`\`bash
# Command to verify this requirement
{command}
# Expected output
{expected result}
\`\`\`

### Requirement 1.2: {Specific Requirement}
{Continue pattern...}

## Phase 2: {Name} (PRIORITY: HIGH)

### Requirement 2.1: {Specific Requirement}
{Continue pattern...}

## Phase 3: {Name} (PRIORITY: MEDIUM)

### Requirement 3.1: {Specific Requirement}
{Continue pattern...}

## Technical Constraints

### Performance Requirements
- {Metric 1}: {Target value}
- {Metric 2}: {Target value}

### Quality Requirements
- Test Coverage: 95%+ maintained
- TypeScript: Strict mode, zero errors
- ESLint: Zero warnings
- Build Time: {Target}

### Integration Requirements
- Must integrate with {existing system}
- Must maintain backward compatibility
- Must follow existing patterns

## Risk Mitigation
- **Risk 1**: {Description} → **Mitigation**: {Strategy}
- **Risk 2**: {Description} → **Mitigation**: {Strategy}`
)
```

### Phase 4: Create existing-tests-to-update.md (15 minutes)

Write the complete test update documentation:

```bash
# Create existing-tests-to-update.md with full content
Write("tmp/issue-{NUMBER}/existing-tests-to-update.md",
  content=`
# Existing Tests Requiring Updates - Issue #{NUMBER}

## Summary
Total test files requiring updates: {count}
Estimated effort: {time estimate}

## Test Update Pattern

### Pattern for {Update Type}
\`\`\`typescript
// BEFORE (current code)
{existing code}

// AFTER (required update)
{updated code with changes highlighted}
\`\`\`

## Priority 1: Core Tool Tests (MUST update first)

### 1. tests/unit/tools/{tool1}.test.ts
**Updates Required**:
- Add {specific change}
- Update mock for {component}
- Add test case for {scenario}

### 2. tests/unit/tools/{tool2}.test.ts
**Updates Required**:
- {specific changes}

## Priority 2: Integration Tests

### 3. tests/integration/{test1}.test.ts
**Updates Required**:
- {specific changes}

## Priority 3: Module Tests

### 4-15. Core Module Tests
{List each file with specific update requirements}

## Priority 4: Other Tests

### 16+. Additional Tests
{List remaining tests}

## Verification Commands

\`\`\`bash
# Count tests needing updates
grep -r "{old-pattern}" tests/ | wc -l
# Expected: {number}

# Verify all updated
grep -r "{new-pattern}" tests/ | wc -l
# Expected: {number}

# Run updated tests
npm test -- --testPathPattern="{pattern}"
\`\`\`

## Common Update Patterns

### Adding New Parameters
\`\`\`typescript
// Add to all submitPlan calls:
stepCount: {calculated-value},

// Add to all mocks:
if (path.includes('PLAN.metadata.json')) {
  return Promise.resolve({...});
}
\`\`\``
)
```

### Phase 5: Create claude-implementation-prompt.md (30 minutes)

Write the complete copy-pasteable orchestration prompt following the MCP pattern:

```bash
# Create claude-implementation-prompt.md with full content
Write("tmp/issue-{NUMBER}/claude-implementation-prompt.md",
  content=`
# Implement Issue #{NUMBER}: {Title}

## Your Mission

Orchestrate the implementation of Issue #{NUMBER} using MCP task delegation. Create tasks FIRST via MCP, then launch agents to complete them. Update CHECKLIST.md methodically after each step.

## Step 1: Read and Understand Requirements

\`\`\`javascript
// Read ALL documentation to understand the full scope
Read("tmp/issue-{NUMBER}/README.md")
Read("tmp/issue-{NUMBER}/requirements.md")
Read("tmp/issue-{NUMBER}/CHECKLIST.md")
Read("tmp/issue-{NUMBER}/existing-tests-to-update.md")
Read("TEST-GUIDELINES.md")
Read("TEST-DEBUGGING.md")
Read("TEST-ERROR-PATTERNS.md")

// Update initial checklist items
Edit("tmp/issue-{NUMBER}/CHECKLIST.md",
  old_string="- [ ] Read all documentation in tmp/issue-{NUMBER}/",
  new_string="- [x] Read all documentation in tmp/issue-{NUMBER}/"
)
\`\`\`

## Step 2: Create MCP Tasks (Dynamic Based on Issue Complexity)

**CRITICAL**: Number of tasks = Number of phases in CHECKLIST.md
- Simple issues: 1-2 tasks
- Medium issues: 2-4 tasks
- Complex issues: 4-6 tasks
- Epic issues: 6+ tasks

\`\`\`javascript
// Create tasks matching the phases determined from issue analysis

// TASK 1: Phase 1 - {Phase Name}
mcp__agent_comm__create_task(
  agent="senior-backend-engineer",
  taskName="phase-1-{descriptive-name}",
  content=\`# Phase 1: {Phase Title}

## 🚨 CRITICAL: Test-Driven Development (TDD) is MANDATORY
You MUST follow this EXACT workflow - NO EXCEPTIONS:
1. Write FAILING tests FIRST (they MUST fail initially)
2. Run tests to CONFIRM they fail
3. Write implementation to make tests PASS
4. Verify tests pass and lint/type-check succeeds
5. Update TEST-ERROR-PATTERNS.md if new violations found

## ❌ BANNED PATTERNS (Immediate Failure)
- NO 'any' types - use 'unknown' or proper type assertions
- NO logical OR (||) for defaults - use nullish coalescing (??)
- NO skipping tests - all tests must run
- NO implementing before tests - TDD is mandatory
- NO accumulating lint/type-check errors - fix immediately

## Mandatory Reading BEFORE Starting
- TEST-GUIDELINES.md - MUST follow all patterns
- TEST-ERROR-PATTERNS.md - MUST avoid all banned patterns
- TEST-DEBUGGING.md - MUST integrate debug package correctly
- tmp/issue-{NUMBER}/requirements.md - understand requirements
- CHECKLIST.md Phase 1 - your specific tasks

## Implementation Order (STRICTLY ENFORCED)

### Step 1: Write Tests FIRST (TDD Mandatory)
{Specific test requirements from checklist}
- Write test file with FAILING tests
- NO 'any' types allowed in tests
- Use proper type assertions (as unknown as Type)
- Mock all dependencies completely

After writing EACH test file:
- npm test -- --testPathPattern={pattern}  # MUST FAIL initially
- npm run type-check  # MUST pass with ZERO errors
- npm run lint  # MUST pass with ZERO warnings
- Fix violations IMMEDIATELY - do not proceed with errors

### Step 2: Implementation (ONLY after tests written)
{Specific implementation requirements}
- Implement to make tests PASS
- Add debug package integration:
  import debug from 'debug';
  const log = debug('agent-comm:{namespace}');
- Add debug statements at all key points

After EVERY file write/update:
- npm run type-check  # Zero errors or STOP
- npm run lint  # Zero warnings or STOP
- npm test -- --testPathPattern={pattern}  # Must pass
- If any check fails, FIX before continuing

### Step 3: Integration
{Integration requirements}

### Step 4: Verification
- npm test -- --testPathPattern={pattern}  # All tests passing
- npm run type-check && npm run lint  # Zero violations
- npm run test:coverage  # 95%+ maintained
- Update TEST-ERROR-PATTERNS.md with any new patterns found

## Checklist Items to Update
After completing Phase 1, mark all Phase 1 items complete in CHECKLIST.md\`
)

// TASK 2: Phase 2 - {Phase Name}
mcp__agent_comm__create_task(
  agent="senior-backend-engineer",
  taskName="phase-2-{descriptive-name}",
  content=\`# Phase 2: {Phase Title}

## Prerequisites
- Phase 1 MUST be complete
- All Phase 1 tests passing

## Mandatory Requirements
- Follow TDD strictly (tests first)
- Lint and type-check after EVERY file write
- Read TEST-ERROR-PATTERNS.md to avoid violations
- Review CHECKLIST.md Phase 2 items

## Implementation Order

### Step 1: Update Existing Tests
{Test update requirements}

After EACH test file:
- npm run type-check  # MUST pass
- npm run lint  # MUST pass
- npm test -- --testPathPattern={specific-test}

### Step 2: Core Implementation
{Implementation requirements}

After EVERY file:
- npm run type-check && npm run lint
- Fix violations immediately
- Run relevant tests

### Step 3: Performance Verification
{Performance requirements}

## Checklist Items to Update
After completing Phase 2, mark all Phase 2 items complete\`
)

// TASK 3: Phase 3 - {Phase Name}
mcp__agent_comm__create_task(
  agent="senior-backend-engineer",
  taskName="phase-3-{descriptive-name}",
  content=\`# Phase 3: {Phase Title}

## Prerequisites
- Phases 1-2 MUST be complete
- All tests passing

## Critical Task: Update All Tests
- Read tmp/issue-{NUMBER}/existing-tests-to-update.md
- Update ALL {count} test files listed
- Follow update patterns exactly

## Implementation Order

### Step 1: Update Test Files in Priority Order
Priority 1: Core tool tests (files 1-6)
Priority 2: Integration tests (files 7-10)
Priority 3: Module tests (files 11-20)
Priority 4: Other tests (files 21+)

After EVERY test file:
- npm run type-check  # Zero errors
- npm run lint  # Zero warnings
- npm test -- --testPathPattern={test-name}

After EVERY 5 files:
- npm test  # Full test suite
- Verify coverage maintained at 95%+

### Step 2: Final Verification
- Run complete test suite
- Verify all quality gates pass

## Checklist Items to Update
After completing Phase 3, mark all Phase 3 items complete\`
)

// Add more tasks if CHECKLIST.md has more phases
\`\`\`

## Step 3: Launch Agent to Complete All Tasks

\`\`\`javascript
// Launch agent to work on all {N} tasks
Task(
  description="Implement Issue #{NUMBER} - All Phases",
  subagent_type="senior-backend-engineer",
  prompt=\`
    You have {N} pre-created tasks for implementing Issue #{NUMBER}.
    Complete them IN ORDER: phase-1, phase-2, ... phase-{N}.

    Workflow for EACH task:
    1. Check your tasks:
       mcp__agent_comm__check_tasks(agent="senior-backend-engineer")

    2. For each phase in sequence:
       a. Get task context:
          mcp__agent_comm__get_task_context(agent="senior-backend-engineer", taskId="phase-{n}-{name}")

       b. Submit your plan with checkboxes:
          mcp__agent_comm__submit_plan(agent="senior-backend-engineer", content="[plan with checkboxes]")

       c. Execute following task instructions EXACTLY:
          - Follow TDD strictly (tests FIRST)
          - After EVERY file: npm run type-check && npm run lint
          - Fix violations IMMEDIATELY

       d. Report progress frequently:
          mcp__agent_comm__report_progress(agent="senior-backend-engineer", updates=[...])

       e. When phase complete:
          mcp__agent_comm__mark_complete(agent="senior-backend-engineer", status="DONE", summary="...")

    Critical Requirements:
    - Lint and type-check after EVERY file operation
    - Zero violations allowed to accumulate
    - Report progress after each major step
    - Maintain 95%+ test coverage
    - Follow all test guidelines

    Final Verification:
    - Run: npm run ci
    - Run: ./tmp/issue-{NUMBER}/verify-{name}.sh
    - ALL checks must show GREEN
  \`
)

// NOTE: For PARALLEL execution (when needed):
// Task(
//   description="Implementation",
//   subagent_type="senior-backend-engineer",
//   prompt="[implementation instructions]"
// )
// Task(
//   description="Documentation",
//   subagent_type="qa-test-automation-engineer",
//   prompt="[documentation instructions]"
// )
// Both Task calls in SAME message for parallel
\`\`\`

## Step 4: Monitor Progress and Update Checklist

\`\`\`javascript
// Monitor each phase and update checklist accordingly

// Phase 1 Monitoring
mcp__agent_comm__track_task_progress(
  agent="senior-backend-engineer",
  taskId="phase-1-{name}"
)

// After Phase 1 completes, update all Phase 1 checklist items
Edit("tmp/issue-{NUMBER}/CHECKLIST.md",
  old_string="- [ ] {completed task from phase 1}",
  new_string="- [x] {completed task from phase 1}"
)
// ... continue for all Phase 1 items

// Phase 2 Monitoring
mcp__agent_comm__track_task_progress(
  agent="senior-backend-engineer",
  taskId="phase-2-{name}"
)

// After Phase 2 completes, update all Phase 2 checklist items
// ... continue pattern

// Phase 3 Monitoring
mcp__agent_comm__track_task_progress(
  agent="senior-backend-engineer",
  taskId="phase-3-{name}"
)

// After Phase 3 completes, update all Phase 3 checklist items
// ... continue pattern
\`\`\`

## Step 5: Final Verification and Cleanup

\`\`\`javascript
// Run comprehensive verification
Bash("./tmp/issue-{NUMBER}/verify-{name}.sh")  // MUST show ALL GREEN

// Quality verification
Bash("npm run ci")  // Type-check + Lint + All tests
Bash("npm run test:coverage")  // 95%+ coverage maintained
Bash("npm run build")  // Build successful

// Update final checklist items
Edit("tmp/issue-{NUMBER}/CHECKLIST.md",
  old_string="- [ ] Run: ./tmp/issue-{NUMBER}/verify-{name}.sh",
  new_string="- [x] Run: ./tmp/issue-{NUMBER}/verify-{name}.sh"
)
Edit("tmp/issue-{NUMBER}/CHECKLIST.md",
  old_string="- [ ] ALL checks must show GREEN/PASS",
  new_string="- [x] ALL checks must show GREEN/PASS"
)

// Archive completed tasks
mcp__agent_comm__archive_completed_tasks(agent="senior-backend-engineer")

// Success message
console.log("✅ Issue #{NUMBER} Implementation Complete!")
console.log("✅ All {N} phases successfully executed")
console.log("✅ Verification script passed 100%")
console.log("✅ Zero TypeScript/ESLint violations")
\`\`\`

## Success Criteria

✅ All {N} MCP tasks created successfully
✅ Agent follows TDD workflow (tests BEFORE implementation)
✅ Lint/type-check after EVERY file write
✅ All test guidelines followed
✅ Verification script shows ALL GREEN
✅ 95%+ test coverage maintained
✅ CHECKLIST.md fully checked (all items complete)`
)
```

### Phase 6: Create CHECKLIST.md (45 minutes)

**THIS IS THE MOST CRITICAL DOCUMENT** - it drives the entire implementation and must be created after understanding all requirements.

#### Determining Checklist Size

The number of checklist items depends on the issue's complexity:

**Analyze the issue to determine:**
- Number of files that need modification
- Number of tests that need updates
- Complexity of each change required
- Integration points affected
- Performance requirements
- Quality gates needed

**Guidelines for checklist items (TDD-focused):**
- Each file modification should have 2-5 checklist items following TDD:
  1. **Read** existing code/tests
  2. **Write/Update tests FIRST** (must fail initially)
  3. **Run tests** (confirm they fail)
  4. **Modify** implementation to make tests pass
  5. **Verify** tests pass and lint/type-check succeeds
- Each new feature should have 5-10 items:
  1. **Write failing tests** (3-4 items)
  2. **Implement** to make tests pass (2-3 items)
  3. **Integration** with existing code (1-2 items)
  4. **Documentation** updates (1-2 items)
- Each test update should have 1-3 items (update test, run, verify)
- Quality gates should have 5-10 items (type-check, lint, coverage, etc.)
- **CRITICAL**: Tests ALWAYS come before implementation - no exceptions!

Write the complete file:

```bash
# Create CHECKLIST.md with full content
Write("tmp/issue-{NUMBER}/CHECKLIST.md",
  content=`
# Implementation Checklist - Issue #{NUMBER}

## 📋 Pre-Implementation Verification
- [ ] Read all documentation in tmp/issue-{NUMBER}/
- [ ] Review existing tests in existing-tests-to-update.md
- [ ] Run baseline verification: \`./tmp/issue-{NUMBER}/verify-{name}.sh\`
- [ ] Create feature branch: \`git checkout -b issue-{NUMBER}-{description}\`
- [ ] Confirm TypeScript strict mode enabled
- [ ] Verify test coverage baseline

## 🏗️ Phase 1: {Phase Name}

### 1.1 Test Creation (TDD - MANDATORY FIRST STEP)
- [ ] Read TEST-GUIDELINES.md and TEST-ERROR-PATTERNS.md
- [ ] Identify existing tests: \`grep -r "{pattern}" tests/\`
- [ ] Create/Update test file: \`tests/unit/{feature}.test.ts\`
  - [ ] Write test for {requirement 1} - MUST FAIL initially
  - [ ] Write test for {requirement 2} - MUST FAIL initially
  - [ ] Write test for edge case {X} - MUST FAIL initially
  - [ ] NO 'any' types allowed - use proper type assertions
  - [ ] Use nullish coalescing (??) not logical OR (||)
- [ ] Run tests (MUST FAIL): \`npm test -- --testPathPattern={pattern}\`
- [ ] Confirm all new tests are FAILING (not passing by accident)
- [ ] Type-check tests: \`npm run type-check\` (zero errors)
- [ ] Lint tests: \`npm run lint\` (zero warnings)

### 1.2 Implementation (ONLY AFTER TESTS ARE WRITTEN)
- [ ] Create \`src/{path}/{file}.ts\`
  - [ ] Add interface/type definitions
  - [ ] Implement {function/class} to make tests PASS
  - [ ] Add debug integration per TEST-DEBUGGING.md:
    - [ ] \`import debug from 'debug'\`
    - [ ] \`const log = debug('agent-comm:{namespace}')\`
    - [ ] Add debug statements at entry/exit points
- [ ] After EACH file write:
  - [ ] \`npm run type-check\` (MUST pass with zero errors)
  - [ ] \`npm run lint\` (MUST pass with zero warnings)
  - [ ] Fix violations IMMEDIATELY - do not accumulate
- [ ] Run tests (should now PASS): \`npm test -- --testPathPattern={pattern}\`
- [ ] Verify coverage maintained: \`npm test -- --coverage --testPathPattern={pattern}\`
- [ ] If new error pattern found, update TEST-ERROR-PATTERNS.md

### 1.3 Integration
- [ ] Update \`src/index.ts\` to export new functionality
- [ ] Update existing files:
  - [ ] \`src/{file1}.ts\` - add {integration}
  - [ ] \`src/{file2}.ts\` - add {integration}
- [ ] After EACH update:
  - [ ] \`npm run type-check && npm run lint\`
  - [ ] \`npm test -- --testPathPattern={relevant}\`

### 1.4 Phase 1 Verification
- [ ] All Phase 1 tests passing
- [ ] TypeScript: Zero errors
- [ ] ESLint: Zero warnings
- [ ] Coverage maintained at 95%+
- [ ] Run: \`./tmp/issue-{NUMBER}/verify-{name}.sh\`
- [ ] Phase 1 checks should show PASS

## 🔧 Phase 2: {Phase Name}

### 2.1 Update Existing Tests
- [ ] Update \`tests/unit/tools/{tool1}.test.ts\`
  - [ ] Add {specific requirement}
  - [ ] Mock {new dependency}
- [ ] Update \`tests/unit/tools/{tool2}.test.ts\`
  - [ ] Add {specific requirement}
- [ ] After EACH test file:
  - [ ] \`npm run type-check\`
  - [ ] \`npm run lint\`
  - [ ] \`npm test -- --testPathPattern={specific-test}\`

### 2.2 Core Implementation
- [ ] Update \`src/tools/{tool}.ts\`:
  - [ ] Add new parameter to interface
  - [ ] Implement validation logic
  - [ ] Add debug logging
- [ ] Create \`src/utils/{utility}.ts\`:
  - [ ] Export shared functions
  - [ ] Add comprehensive JSDoc
- [ ] After EACH file:
  - [ ] \`npm run type-check && npm run lint\`
  - [ ] Fix any violations before proceeding

### 2.3 Phase 2 Verification
- [ ] All Phase 2 tests passing
- [ ] Performance metric: {measurement}
- [ ] Integration working correctly
- [ ] Run partial verification

## 🧪 Phase 3: {Phase Name}

### 3.1 Comprehensive Test Updates
- [ ] Update ALL tests listed in existing-tests-to-update.md
- [ ] Priority 1: Core tool tests (files 1-6)
- [ ] Priority 2: Integration tests (files 7-10)
- [ ] Priority 3: Module tests (files 11-20)
- [ ] Priority 4: Remaining tests (files 21+)
- [ ] After EVERY 5 test files:
  - [ ] Full type-check: \`npm run type-check\`
  - [ ] Full lint: \`npm run lint\`
  - [ ] Run updated tests: \`npm test\`

### 3.2 Performance Optimization
- [ ] Measure baseline: \`time npm test -- --testNamePattern={pattern}\`
- [ ] Implement optimization
- [ ] Measure improvement: \`time npm test -- --testNamePattern={pattern}\`
- [ ] Document: {X}ms → {Y}ms ({Z}% improvement)

## ✅ Final Validation

### Quality Gates
- [ ] TypeScript compilation: \`npm run type-check\` (0 errors)
- [ ] ESLint: \`npm run lint\` (0 warnings)
- [ ] All tests: \`npm test\` (100% pass)
- [ ] Coverage: \`npm run test:coverage\` (95%+ maintained)
- [ ] Build: \`npm run build\` (successful)
- [ ] CI pipeline: \`npm run ci\` (all checks pass)

### Verification Script
- [ ] Run: \`./tmp/issue-{NUMBER}/verify-{name}.sh\`
- [ ] ALL checks must show GREEN/PASS
- [ ] Save output as evidence

### Documentation
- [ ] Update CHANGELOG.md if applicable
- [ ] Update README.md if API changes
- [ ] Add migration notes if breaking changes

### Git Operations
- [ ] Commit with detailed message
- [ ] Push feature branch
- [ ] Create PR with evidence
- [ ] Link to Issue #{NUMBER}

## ⚠️ Critical Reminders

1. **TDD IS NON-NEGOTIABLE** - Tests BEFORE implementation, ALWAYS
   - Write FAILING tests first
   - Implementation makes tests pass
   - Never write code without tests
2. **LINT AFTER EVERY WRITE** - Zero accumulation of violations
3. **TYPE-CHECK CONSTANTLY** - Catch errors immediately
4. **FOLLOW TEST GUIDELINES**:
   - Read TEST-GUIDELINES.md before starting
   - Check TEST-ERROR-PATTERNS.md for banned patterns
   - Use TEST-DEBUGGING.md for debug integration
   - Update TEST-ERROR-PATTERNS.md with new violations
5. **NO 'any' TYPES** - Use proper type assertions always
6. **REPORT PROGRESS** - Use MCP tools after each phase
7. **VERIFY EVERYTHING** - No claims without evidence

## 📊 Progress Tracking

The total number of checklist items will vary based on issue complexity:
- **Small Issues**: 20-30 items across 2-3 phases
- **Medium Issues**: 40-60 items across 3-4 phases
- **Large Issues**: 60-100+ items across 4-6 phases

Each phase should have enough detail to guide implementation without ambiguity.
Mark items complete as you work. Report progress after each phase.`
)
```

### Phase 7: Create Verification Script (30 minutes)

Write the complete verification script that aligns with CHECKLIST.md and TEST it immediately:

```bash
# Create verify-{descriptive-name}.sh with full content
Write("tmp/issue-{NUMBER}/verify-{descriptive-name}.sh",
  content=`
#!/bin/bash

# Issue #{NUMBER} Verification Script
# Purpose: {Brief description}
# Created: {Date}
# IMPORTANT: This script MUST align with CHECKLIST.md phases

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
TOTAL=0

# Helper functions
print_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
    ((TOTAL++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
    ((TOTAL++))
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_summary() {
    echo -e "\n${BLUE}=== VERIFICATION SUMMARY ===${NC}"
    echo -e "Total Checks: $TOTAL"
    echo -e "${GREEN}Passed: $PASSED${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"

    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
        exit 0
    else
        echo -e "${RED}❌ $FAILED CHECKS FAILED${NC}"
        exit 1
    fi
}

# Verification Functions

check_file_exists() {
    local file="$1"
    local description="$2"

    print_check "Checking if $description exists"

    if [ -f "$file" ]; then
        print_pass "$description exists: $file"
    else
        print_fail "$description missing: $file"
    fi
}

check_content() {
    local file="$1"
    local pattern="$2"
    local description="$3"

    print_check "Checking $description"

    if [ -f "$file" ]; then
        if grep -q "$pattern" "$file" 2>/dev/null; then
            local count=$(grep -c "$pattern" "$file" 2>/dev/null || echo "0")
            print_pass "$description found ($count occurrences)"
        else
            print_fail "$description not found in $file"
        fi
    else
        print_fail "File not found: $file"
    fi
}

check_tests_pass() {
    local pattern="$1"
    local description="$2"

    print_check "Running tests: $description"

    if npm test -- --testPathPattern="$pattern" --silent > /dev/null 2>&1; then
        print_pass "$description tests passing"
    else
        print_fail "$description tests failing"
    fi
}

check_typescript() {
    print_check "TypeScript compilation"

    if npx tsc --noEmit 2>/dev/null; then
        print_pass "TypeScript compilation successful (0 errors)"
    else
        print_fail "TypeScript compilation failed"
    fi
}

check_lint() {
    print_check "ESLint validation"

    if npm run lint -- --quiet 2>/dev/null; then
        print_pass "ESLint validation successful (0 warnings)"
    else
        print_fail "ESLint validation failed"
    fi
}

# Main Verification - MUST match CHECKLIST.md phases

main() {
    echo -e "${BLUE}=== Issue #{NUMBER} Verification ===${NC}"
    echo -e "Description: {Brief description}"
    echo -e "Date: $(date)"
    echo ""

    # Phase 1 Checks (from CHECKLIST.md Phase 1)
    echo -e "${BLUE}Phase 1: {Phase Name}${NC}"
    check_file_exists "src/{path}/{file}.ts" "{Component} implementation"
    check_content "src/{file}.ts" "{pattern}" "{Feature} integration"
    check_file_exists "tests/unit/{test}.test.ts" "{Component} tests"

    # Phase 2 Checks (from CHECKLIST.md Phase 2)
    echo -e "\n${BLUE}Phase 2: {Phase Name}${NC}"
    check_content "src/tools/{tool}.ts" "{pattern}" "{Feature} in tool"
    check_tests_pass "{pattern}" "{Component}"

    # Phase 3 Checks (from CHECKLIST.md Phase 3)
    echo -e "\n${BLUE}Phase 3: {Phase Name}${NC}"
    # Check test updates
    local updated_tests=$(grep -r "{new-pattern}" tests/ 2>/dev/null | wc -l)
    local required_tests={number}
    print_check "Checking test updates"
    if [ "$updated_tests" -ge "$required_tests" ]; then
        print_pass "All $updated_tests tests updated"
    else
        print_fail "Only $updated_tests of $required_tests tests updated"
    fi

    # Quality Checks (from CHECKLIST.md Final Validation)
    echo -e "\n${BLUE}Quality Gates${NC}"
    check_typescript
    check_lint

    # Performance Check (if applicable)
    # print_check "Performance improvement"
    # Measure and verify performance

    print_summary
}

# Run verification
main "$@"`
)

# Make the script executable
Bash("chmod +x tmp/issue-{NUMBER}/verify-{descriptive-name}.sh")
```

**CRITICAL: Test the script immediately**:
```bash
# Test it right now to ensure it works
./tmp/issue-{NUMBER}/verify-{name}.sh

# Save baseline (should show failures initially)
./tmp/issue-{NUMBER}/verify-{name}.sh > tmp/issue-{NUMBER}/baseline-verification.log 2>&1
```

### Phase 8: Create Optional Files (As Needed)

Based on issue complexity, create additional documentation files:

#### For Complex Features - Create {feature-name}-spec.md
```bash
# Only if feature requires detailed technical specification
Write("tmp/issue-{NUMBER}/{feature-name}-spec.md",
  content=`# {Feature Name} Specification - Issue #{NUMBER}

## Overview
{Detailed technical overview of the feature}

## Architecture
### Core Components
- **{Component 1}**: {Description and responsibilities}
- **{Component 2}**: {Description and responsibilities}

### Data Flow
{Describe how data flows through the system}

### Integration Points
- {Integration 1}: {How it integrates}
- {Integration 2}: {How it integrates}

## Interface Definitions
\`\`\`typescript
interface {InterfaceName} {
  // Complete interface specification
  {property}: {type};
}

class {ClassName} {
  // Complete class definition with methods
  {method}({params}): {returnType};
}
\`\`\`

## Implementation Requirements
### Performance
- {Metric 1}: {Target}
- {Metric 2}: {Target}

### Security
- {Requirement 1}
- {Requirement 2}

### Testing
- Unit test coverage: {X}% minimum
- Integration test requirements
- Performance test requirements`
)
```

#### For Migration Scenarios - Create migration-strategy.md
```bash
# Only if migrating existing code/data
Write("tmp/issue-{NUMBER}/migration-strategy.md",
  content=`# Migration Strategy - Issue #{NUMBER}

## Current State
### Existing Implementation
- {Component 1}: {Current implementation details}
- {Component 2}: {Current implementation details}

### Data Structures
\`\`\`typescript
// Current data structure
{existing structure}
\`\`\`

## Target State
### New Implementation
- {Component 1}: {New implementation details}
- {Component 2}: {New implementation details}

### New Data Structures
\`\`\`typescript
// Target data structure
{new structure}
\`\`\`

## Migration Plan
### Phase 1: Preparation
1. {Step 1}
2. {Step 2}

### Phase 2: Migration
1. {Step 1}
2. {Step 2}

### Phase 3: Validation
1. {Verification step}
2. {Verification step}

## Rollback Plan
### Triggers
- {Condition 1 that triggers rollback}
- {Condition 2 that triggers rollback}

### Rollback Steps
1. {Step 1}
2. {Step 2}

## Risk Mitigation
- **Risk**: {Description} → **Mitigation**: {Strategy}
- **Risk**: {Description} → **Mitigation**: {Strategy}`
)
```

#### For Multi-Agent Coordination - Create {feature-name}-plan.md
```bash
# Only for complex multi-phase implementations
Write("tmp/issue-{NUMBER}/{feature-name}-plan.md",
  content=`# {Feature Name} Implementation Plan - Issue #{NUMBER}

## Overview
{High-level implementation strategy}

## Phase Breakdown
### Phase 1: {Name} ({Agent Type})
**Deliverables**:
- {Deliverable 1}
- {Deliverable 2}

**Files to Modify**:
- \`src/{path}/{file}.ts\` - {changes needed}
- \`tests/{path}/{file}.test.ts\` - {changes needed}

### Phase 2: {Name} ({Agent Type})
**Deliverables**:
- {Deliverable 1}
- {Deliverable 2}

**Dependencies**:
- Requires Phase 1 completion
- {Other dependency}

## Integration Strategy
### Step 1: {Integration Step}
{Detailed instructions}

### Step 2: {Integration Step}
{Detailed instructions}

## Testing Strategy
### Unit Testing
- {Test requirement 1}
- {Test requirement 2}

### Integration Testing
- {Test requirement 1}
- {Test requirement 2}

## Performance Considerations
- {Consideration 1}: {Impact and mitigation}
- {Consideration 2}: {Impact and mitigation}`
)
```

## 📊 QUALITY CHECKLIST

Before considering your issue plan complete:

### Documentation Quality
- [ ] README.md clearly states the problem and solution
- [ ] requirements.md has specific, measurable requirements
- [ ] CHECKLIST.md has appropriate number of items for issue complexity
- [ ] CHECKLIST.md created AFTER all requirements are understood
- [ ] existing-tests-to-update.md lists all affected tests
- [ ] Verification script created and TESTED
- [ ] Verification script aligns with CHECKLIST.md phases
- [ ] claude-implementation-prompt.md is copy-pasteable

### Technical Quality
- [ ] Task count matches checklist phases
- [ ] Each task includes TDD requirements
- [ ] Lint/type-check after EVERY write is emphasized
- [ ] Debug integration requirements included
- [ ] Performance metrics specified

### Process Quality
- [ ] Clear separation: orchestrator vs agent roles
- [ ] MCP task creation before agent launch
- [ ] Progress reporting requirements clear
- [ ] Verification commands throughout
- [ ] Evidence requirements specified

## ⚠️ COMMON PITFALLS TO AVOID

1. **Creating CHECKLIST.md too early**
   - Must be created AFTER understanding all requirements
   - Should be second-to-last file created

2. **Creating verification script before CHECKLIST.md**
   - Script MUST align with checklist phases
   - Always create checklist first, then script

3. **Violating TDD principles**
   - NEVER write implementation before tests
   - Tests MUST fail initially (not accidentally pass)
   - Implementation should make tests pass

4. **Using banned patterns from TEST-ERROR-PATTERNS.md**
   - NO 'any' types - immediate failure
   - NO logical OR (||) for defaults - use ??
   - NO skipping or disabling tests

5. **Mixing orchestrator and agent responsibilities**
   - Claude orchestrates; agents implement
   - Orchestrator never writes code directly

6. **Forgetting lint/type-check requirements**
   - Must be after EVERY file write, not just phase end
   - Fix violations immediately, don't accumulate

7. **Not integrating debug package**
   - All new code MUST use debug package
   - Follow TEST-DEBUGGING.md namespace patterns
   - No console.log statements allowed

8. **Vague task content**
   - Each task needs specific file paths and requirements
   - Include exact test patterns and commands

9. **Not testing verification script**
   - Script must be tested immediately after creation
   - Must capture baseline state before implementation

10. **Not updating TEST-ERROR-PATTERNS.md**
    - Any new error pattern discovered must be documented
    - Prevents future occurrences of same error

## 🎯 SUCCESS METRICS

A properly created issue plan enables:
- **TDD Compliance**: 100% of code has tests written FIRST
- **Zero Violations**: No 'any' types, no ESLint warnings, no TypeScript errors
- **Pattern Prevention**: No violations from TEST-ERROR-PATTERNS.md
- **Debug Integration**: All new code uses debug package correctly
- **Zero-trust Implementation**: Evidence required for all claims
- **Automatic Detection**: Incomplete work caught by verification
- **Clear Progress Tracking**: MCP tools show real-time status
- **Consistent Quality**: 95%+ test coverage maintained
- **No Ambiguity**: Clear requirements and verification

**Remember**:
- **TDD is LAW**: Tests BEFORE implementation, ALWAYS
- **CHECKLIST.md is KING**: Created near the end, drives everything
- **Verification script is QUEEN**: Must align perfectly with CHECKLIST.md
- **The orchestrator orchestrates**: Claude manages, agents implement
- **Evidence proves everything**: No claims without proof
- **TEST-ERROR-PATTERNS.md is your shield**: Keep it updated to prevent repeated mistakes