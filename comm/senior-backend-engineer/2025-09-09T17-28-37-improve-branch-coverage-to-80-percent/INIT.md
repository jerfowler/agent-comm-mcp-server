# Task: Improve Branch Coverage to 80%+ to Fix CI Failures

## Context
CI is failing because branch coverage is 78.12% but the threshold is 80%. We need to add missing test cases to reach the required 80% branch coverage WITHOUT lowering thresholds.

## Current Status
- Local tests: 82.4% branch coverage ✅
- CI tests: 78.12% branch coverage ❌ (fails threshold)
- All other coverage metrics are passing

## Files with Lowest Branch Coverage (Target for Improvement)

**Priority 1 - Critical Files:**
1. **TaskContextManager.ts**: 62.73% branches (Lines: 204,213,269-288,320-333,405-417,430,438,546,650,658,668,708,717,815,823,831,848,940,1120,1170-1172,1179-1181,1223-1235,1339-1402)
2. **ResourceManager.ts**: 60% branches (Lines: 146-151,190-212,222-227,244-245,257,277,336-344,376,393,458)
3. **metadata-handler.ts**: 56.25% branches (Lines: 169,178,181,184,187,190,193)

**Priority 2 - Medium Impact:**
4. **TaskResourceProvider.ts**: 66.66% branches (Lines: 72,93-95,158-164,194)
5. **lock-manager.ts**: 69.76% branches (Lines: 141-142,164,176,216,228,245,261-263,278)

## Required Actions

### 1. Focus on TaskContextManager.ts (Biggest Impact)
- Current: 62.73% branches
- Target: 80%+ branches
- This file has the most uncovered branches and will have the biggest impact

**Missing Branch Coverage Areas:**
- Lines 269-288: Error handling branches
- Lines 320-333: Edge case handling  
- Lines 405-417: Validation branches
- Lines 1170-1172, 1179-1181: Error path branches
- Lines 1223-1235: Configuration handling
- Lines 1339-1402: Advanced error scenarios

### 2. ResourceManager.ts Improvements
- Current: 60% branches
- Focus on lines 190-212, 222-227, 336-344
- Add tests for error conditions and edge cases

### 3. Add Missing Test Cases
For each target file:
- Identify uncovered branches from the line numbers above
- Add test cases that exercise error paths, edge cases, and validation branches
- Focus on conditional statements, error handling, and configuration edge cases

### 4. Verification Requirements
- Run `npm run test:unit` to verify coverage improvement
- Ensure branch coverage reaches 80%+ globally
- Maintain all existing test functionality
- Ensure no tests are broken in the process

## Success Criteria
- ✅ **Global branch coverage ≥ 80%**
- ✅ All existing tests continue to pass
- ✅ No decrease in other coverage metrics (lines, functions, statements)
- ✅ CI pipeline passes with the improved coverage

## Strategy Notes
- Focus on the files with the lowest percentages first (TaskContextManager, ResourceManager)
- Look for uncovered error paths, edge cases, and conditional branches
- Add realistic test scenarios that would naturally hit these branches
- Don't add artificial or contrived tests - ensure they test real functionality

## Timeline
This is blocking both PRs from merging, so please prioritize this task for immediate completion.

## Metadata
- Agent: senior-backend-engineer
- Created: 2025-09-09T17:28:37.963Z


## MCP Task Management Protocol

### IMPORTANT: Creating Tasks
**ALWAYS** use `create_task` for ANY new task:
```javascript
create_task({
  agent: "target-agent",      // Required: target agent name
  taskName: "task-name",      // Required: clean name (NO timestamps)
  content: "task details",    // Optional: include for delegation
  taskType: "delegation",     // Optional: delegation|self|subtask
  parentTask: "parent-id"     // Optional: for subtasks only
})
```

### CRITICAL: Task Workflow
**YOU MUST** follow this exact sequence:
1. `check_assigned_tasks()` - **ALWAYS** start here
2. `start_task(taskId)` - **REQUIRED** before any work
3. `submit_plan(content)` - **MANDATORY** before implementation
4. `report_progress(updates)` - **UPDATE** after each step
5. `mark_complete(status, summary, reconciliation_options)` - **ONLY** when fully done

### MANDATORY: Todo Integration
**YOU MUST ALWAYS:**
- **CREATE** TodoWrite items for EVERY task step
- **UPDATE** todos to 'in_progress' BEFORE starting work
- **MARK** todos 'completed' IMMEDIATELY after finishing
- **NEVER** have more than ONE 'in_progress' item
- **INCLUDE** MCP operations as todo items

### REQUIRED Plan Format
**ALL PLANS MUST USE CHECKBOX FORMAT:**

Each trackable item MUST follow this structure:
```
- [ ] **Step Title**: Brief one-line description
  - Action: Specific command or task
  - Expected: Success criteria
  - Error: Handling approach if fails
  - Notes: Additional context (optional)
```

**Example Plan Format:**
```markdown
## Testing Plan

- [ ] **Test Discovery**: Identify all test configurations
  - Run: `pnpm list --filter "*" --depth 0`
  - Scan for: jest.config.*, *.test.ts, *.spec.ts files
  - Expected: List of all test files and configurations
  - Error handling: If no tests found, document as critical issue
  - Dependencies: Node.js and pnpm installed

- [ ] **Test Execution**: Run all test suites
  - Command: `pnpm test:all --coverage`
  - Success criteria: All tests pass with >80% coverage
  - Failure action: Document failed tests with error messages
  - Output location: ./coverage/lcov-report/index.html
```

**VALIDATION RULES:**
- Minimum ONE checkbox required (use `- [ ]` format exactly)
- Each checkbox must have bold title: `**Title**:`
- Each checkbox must have 2-5 detail bullets
- NO [PENDING]/[COMPLETE] status markers allowed
- Use ONLY checkboxes for tracking

### CRITICAL RULES - NEVER VIOLATE
- **NEVER** create duplicate tasks (auto-prevented)
- **NEVER** add timestamps to taskName
- **ALWAYS** update progress after EACH action
- **ALWAYS** sync todos with actual work
- **NEVER** skip submit_plan step
- **ONLY** mark complete when 100% done
- **ALWAYS** use checkbox format in plans
- **UNDERSTAND** reconciliation modes for mark_complete

### Task Completion Reconciliation
**mark_complete** supports intelligent reconciliation when plan checkboxes remain unchecked:

**4 Reconciliation Modes:**
1. **`strict`** (default) - Requires ALL checkboxes checked before DONE status
   - Use when: Plan adherence is critical
   - Behavior: Rejects DONE with unchecked items, allows ERROR

2. **`auto_complete`** - Automatically marks unchecked items complete
   - Use when: Work is done but forgot to check boxes
   - Behavior: Updates PLAN.md with all items checked

3. **`reconcile`** - Accept completion with explanations for variances  
   - Use when: Completed work differently than planned
   - Requires: reconciliation_explanations object
   - Behavior: Creates variance report with justifications

4. **`force`** - Override completion despite unchecked items
   - Use when: Emergency completion, plan became obsolete
   - Behavior: Documents forced override with warnings

**Reconciliation Examples (Essential Examples for Proper Usage):**
```javascript
// Example 1: Default strict mode (recommended example)
mark_complete({
  status: 'DONE',
  summary: 'All work completed as planned',
  agent: 'agent-name'
  // No reconciliation = strict mode
});

// Example 3: Auto-complete forgotten checkboxes example
mark_complete({
  status: 'DONE', 
  summary: 'Forgot to check boxes during work',
  agent: 'agent-name',
  reconciliation_mode: 'auto_complete'
});

// Example 4: Reconcile with explanations (detailed example)
mark_complete({
  status: 'DONE',
  summary: 'Core work done, some items handled differently', 
  agent: 'agent-name',
  reconciliation_mode: 'reconcile',
  reconciliation_explanations: {
    'Database Setup': 'Used existing schema, setup not needed',
    'Performance Testing': 'Deferred to next sprint per stakeholder decision'
  }
});

// Force completion in emergency  
mark_complete({
  status: 'DONE',
  summary: 'Emergency deployment, remaining items moved to backlog',
  agent: 'agent-name', 
  reconciliation_mode: 'force'
});
```

**BEST PRACTICES:**
- **Update checkboxes** as you complete work (prevents reconciliation need)
- **Use strict mode** by default (ensures plan accountability) 
- **Provide clear explanations** when using reconcile mode
- **Reserve force mode** for genuine emergencies only
- **Document reconciliation decisions** thoroughly in summary

### Diagnostic Tools
- `track_task_progress(agent, taskId)` - Monitor progress
- `get_full_lifecycle(agent, taskId)` - View task history

**REMEMBER:** Update todos, use checkbox format in plans, and report progress CONTINUOUSLY!