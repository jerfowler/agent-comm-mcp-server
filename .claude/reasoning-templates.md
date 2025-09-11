# Reasoning Response Templates

This document provides standardized response patterns to ensure proper problem-solving approach and prevent shortcut-seeking behavior.

## Error Response Template

When encountering ANY error, test failure, or quality gate violation:

### Phase 1: Root Cause Analysis (MANDATORY)
```
🔍 ROOT CAUSE ANALYSIS:
1. Error message: [exact error text]
2. Affected component: [specific file/function/system]
3. Underlying cause: [what's actually wrong]
4. Why it occurred: [technical reason]

❌ NOT ALLOWED: "Let's bypass this error"
✅ REQUIRED: "Let's understand and fix this error"
```

### Phase 2: Proper Solution Design
```
🛠️ SOLUTION APPROACH:
1. Fix strategy: [how to address root cause]
2. Standards compliance: [how solution meets all requirements]
3. Side effects: [what else might be impacted]
4. Verification plan: [how to confirm fix works]

❌ NOT ALLOWED: "Quick workaround"
✅ REQUIRED: "Comprehensive proper fix"
```

### Phase 3: Implementation & Verification
```
✅ IMPLEMENTATION:
1. Changes made: [specific modifications]
2. Standards verified: [ESLint, TypeScript, tests all pass]
3. Root cause eliminated: [confirmation of fix]
4. No regressions: [other functionality still works]

❌ NOT ALLOWED: Skipping verification
✅ REQUIRED: Complete validation through original quality gate
```

## Quality Gate Failure Template

For ESLint violations, test failures, TypeScript errors, etc.:

### Step 1: Understanding Phase
```
📋 QUALITY GATE ANALYSIS:
- Gate type: [ESLint/TypeScript/Test/Coverage]
- Specific violation: [exact rule/error]
- Files affected: [list of files]
- Standard being enforced: [why this matters]

🚫 BYPASS ATTEMPT DETECTED? NO - We fix the code to meet standards
```

### Step 2: Compliance Strategy  
```
🎯 COMPLIANCE APPROACH:
- Code changes needed: [specific modifications required]
- Type improvements: [if TypeScript related]
- Test additions: [if coverage related]
- Refactoring required: [if structural issues]

✅ GOAL: Meet existing standards, don't lower them
```

## Shortcut Detection & Redirection

When shortcut patterns are detected:

### Immediate Redirection
```
🚫 SHORTCUT DETECTED: [specific bypass pattern]

❌ WRONG APPROACH: [what was suggested]
✅ PROPER APPROACH: [correct solution path]

MANDATORY QUESTIONS:
1. What's the actual problem? [force root cause analysis]
2. Why avoid the proper fix? [challenge shortcut mentality]  
3. What standards apply? [ensure compliance thinking]
4. How to verify success? [require validation]
```

## Decision Tree Templates

### Problem Encountered Decision Tree
```
PROBLEM ENCOUNTERED
├── Is this a quality gate failure?
│   ├── YES → Use Quality Gate Failure Template
│   └── NO → Continue to cause analysis
├── Can I identify the root cause?
│   ├── YES → Design proper fix
│   ├── NO → Investigate further (no workarounds)
│   └── UNSURE → Research and analyze
└── Am I tempted to use a shortcut?
    ├── YES → STOP - Use Shortcut Redirection Template
    └── NO → Proceed with proper solution
```

### Solution Validation Decision Tree
```
SOLUTION PROPOSED
├── Does it address root cause?
│   ├── YES → Continue validation
│   └── NO → REJECT - Not a proper fix
├── Does it meet all quality standards?
│   ├── YES → Continue validation  
│   └── NO → REJECT - Standards must be met
├── Does it avoid bypassing any checks?
│   ├── YES → Proceed with implementation
│   └── NO → REJECT - No bypasses allowed
└── Can success be verified?
    ├── YES → Implement and verify
    └── NO → Design better verification method
```

## Success Validation Templates

### Pre-Implementation Checklist
```
✅ PRE-IMPLEMENTATION VALIDATION:
□ Root cause clearly identified
□ Solution addresses actual problem
□ All quality standards will be met
□ No bypasses or shortcuts involved
□ Verification method planned
□ Side effects considered
□ Documentation updated if needed

PROCEED ONLY IF ALL CHECKED
```

### Post-Implementation Verification
```
✅ POST-IMPLEMENTATION VERIFICATION:
□ Original error/failure resolved
□ All quality gates pass (ESLint, TypeScript, tests)
□ No new errors introduced
□ Standards maintained or improved
□ Documentation reflects changes
□ Learning documented for future

SUCCESS ONLY IF ALL VERIFIED
```

## Common Anti-Patterns & Redirections

### Pattern: "Let's disable the rule"
```
❌ DETECTED: "eslint-disable", "@ts-ignore", "skip test"
🚫 BLOCKED: Rule disabling is not a solution

✅ REDIRECT: "What is this rule protecting against?"
✅ ACTION: Fix the code to comply with the rule
✅ RESULT: Better code quality and safety
```

### Pattern: "Lower the threshold"
```
❌ DETECTED: "reduce coverage", "lower threshold", "relax requirement"
🚫 BLOCKED: Standard lowering is not acceptable

✅ REDIRECT: "How can we meet the existing standard?"
✅ ACTION: Improve code quality to reach threshold
✅ RESULT: Higher quality codebase
```

### Pattern: "Quick fix for now"
```
❌ DETECTED: "temporary", "for now", "quick fix", "workaround"
🚫 BLOCKED: Temporary fixes become permanent problems

✅ REDIRECT: "What's the proper long-term solution?"
✅ ACTION: Implement the correct fix immediately
✅ RESULT: Sustainable, maintainable code
```

## Usage Guidelines

1. **Always use templates** when encountering problems
2. **Never skip phases** in the response templates  
3. **Force root cause analysis** before any solution
4. **Validate through original quality gate** always
5. **Document the reasoning process** for future reference

These templates ensure consistent, proper problem-solving approach and prevent regression to shortcut-seeking behavior.