# Agent Process Isolation Guidelines

This document defines process isolation requirements to prevent validation system bypasses like the one that occurred in PR #34.

## Critical Isolation Requirements

### 1. Pre-commit Hook Isolation
**Problem**: Backend engineers bypassed 'any' type validation hooks that worked locally
**Solution**: Multi-layer validation with server-side enforcement

#### Local Hook Validation
```bash
# .git/hooks/pre-commit must be executable and comprehensive
#!/bin/bash
# CRITICAL: Never allow bypassing with --no-verify without explicit approval

# Phase 1: TypeScript strict mode validation
if ! npm run type-check; then
    echo "❌ TypeScript strict mode validation failed"
    exit 1
fi

# Phase 2: 'any' type detection in staged files
ANY_COUNT=$(git diff --cached --name-only | grep '\.ts$' | xargs grep -l "\bany\b" | wc -l)
if [ "$ANY_COUNT" -gt 0 ]; then
    echo "❌ 'any' types detected in staged files"
    echo "Use specific types or 'unknown' instead"
    exit 1
fi

# Phase 3: ESLint strict enforcement
if ! npm run lint; then
    echo "❌ ESLint validation failed"
    exit 1
fi
```

#### Server-side Validation (GitHub Actions)
- **Required status checks** cannot be bypassed
- **Branch protection** enforces validation for all users including admins
- **PR size validation** prevents massive changes that hide violations

### 2. Agent Work Environment Isolation

#### Backend Engineer Constraints
```yaml
# .claude/agent-constraints/senior-backend-engineer.yml
constraints:
  pre_work_validation:
    - "Review TEST-ERROR-PATTERNS.md for banned patterns"
    - "Confirm TypeScript strict mode requirements understood"
    - "Verify no 'any' types will be introduced"
    
  prohibited_actions:
    - "Bypass pre-commit hooks with --no-verify"
    - "Disable TypeScript strict mode checks"
    - "Add 'any' types to production code"
    - "Skip ESLint validation"
    
  required_verification:
    - "npm run type-check before any commit"
    - "npm run lint before any commit"
    - "npm run test:smoke for critical changes"
    
  escalation_triggers:
    - "Any 'any' type addition requires architecture review"
    - "TypeScript strict mode violations require senior review"
    - "Test failures require QA engineer consultation"
```

#### QA Engineer Validation Authority
```yaml
# .claude/agent-constraints/qa-test-automation-engineer.yml
authority:
  validation_override:
    - "Can reject PRs with insufficient test coverage"
    - "Can block merges with failing quality gates"
    - "Can require additional testing for large changes"
    
  quality_enforcement:
    - "Minimum 95% test coverage on new code"
    - "Zero TypeScript strict mode violations"
    - "Comprehensive test error pattern prevention"
    
  review_requirements:
    - "Must approve all PRs affecting test infrastructure"
    - "Must validate all test pattern changes"
    - "Must sign off on quality gate modifications"
```

### 3. Process Isolation Architecture

#### Validation Chain of Command
```
Developer → Pre-commit Hooks → PR Creation → GitHub Actions → Branch Protection → QA Review → Merge
    ↓              ↓               ↓              ↓                ↓             ↓        ↓
  Local Check → Git Hooks → PR Size Check → CI Pipeline → Status Checks → Human Review → Archive
```

#### Failure Isolation Points
1. **Local Development**: Pre-commit hooks catch violations immediately
2. **PR Creation**: Size validation prevents massive changes
3. **CI Pipeline**: Comprehensive testing validates all changes
4. **Branch Protection**: Required status checks cannot be bypassed
5. **Code Review**: Human validation for business logic and architecture
6. **Post-merge**: Archive cleanup and monitoring

### 4. Communication Protocol Isolation

#### Task Delegation Boundaries
```typescript
// Agent communication must follow isolation protocol
interface AgentIsolationProtocol {
  validation_authority: {
    backend_engineer: ['implementation', 'business_logic'];
    qa_engineer: ['testing', 'quality_gates', 'validation_rules'];
    security_analyst: ['vulnerability_assessment', 'compliance_review'];
  };
  
  escalation_paths: {
    type_violations: 'qa_engineer';
    test_failures: 'qa_engineer';
    security_issues: 'security_analyst';
    architecture_changes: 'senior_system_architect';
  };
  
  bypass_prevention: {
    no_self_approval: true;
    required_status_checks: true;
    branch_protection_enforced: true;
    admin_override_logged: true;
  };
}
```

#### MCP Agent Communication Isolation
```bash
# Agent task creation with validation requirements
mcp__agent_comm__create_task({
  agent: "senior-backend-engineer",
  taskName: "fix-typescript-violations",
  content: `
## Validation Requirements
- [ ] Zero 'any' types in solution
- [ ] TypeScript strict mode compliance
- [ ] ESLint validation passing
- [ ] Test coverage maintained at 95%+

## Isolation Protocol
- This task requires QA engineer validation before completion
- No pre-commit hook bypassing allowed
- All changes must pass CI pipeline before submission
  `,
  taskType: "delegation"
});
```

## Enforcement Mechanisms

### 1. Automated Prevention
```bash
# .claude/hooks/validation-enforcer.py
def enforce_agent_isolation(tool_use, agent_context):
    """Prevent agents from bypassing validation systems"""
    
    if tool_use.tool == "Bash" and "--no-verify" in tool_use.command:
        if agent_context.agent_type == "senior-backend-engineer":
            return {
                "allow": False,
                "message": "Backend engineers cannot bypass pre-commit validation",
                "alternative": "Use 'npm run ci' to validate before commit"
            }
    
    if tool_use.tool == "Edit" and "any" in tool_use.new_string:
        return {
            "allow": False, 
            "message": "'any' types are prohibited in TypeScript files",
            "alternative": "Use specific types or 'unknown' instead"
        }
    
    return {"allow": True}
```

### 2. Process Monitoring
```bash
# .github/workflows/process-isolation-monitor.yml
name: Process Isolation Monitor

on:
  pull_request:
  push:
    branches: [main, test]

jobs:
  isolation-compliance:
    runs-on: ubuntu-latest
    steps:
      - name: Check for validation bypasses
        run: |
          # Monitor for common bypass attempts
          if git log --oneline -10 | grep -i "skip.*ci\|no.*verify\|bypass"; then
            echo "⚠️ Potential validation bypass detected"
          fi
          
          # Check for admin overrides
          if git log --format="%an %s" -10 | grep -i "admin\|override\|force"; then
            echo "🔍 Admin override detected - logging for audit"
          fi
```

### 3. Agent Education System
```typescript
// .claude/agent-education/validation-requirements.ts
export const VALIDATION_EDUCATION = {
  backend_engineer: {
    before_work: [
      "Review current TypeScript strict mode requirements",
      "Check TEST-ERROR-PATTERNS.md for prohibited patterns", 
      "Understand 'any' type ban and alternatives",
      "Verify test coverage requirements (95%+)"
    ],
    
    during_work: [
      "Run 'npm run type-check' frequently during development",
      "Use ESLint integration in IDE for real-time feedback",
      "Write tests before implementing features (TDD)",
      "Validate changes with 'npm run ci' before commit"
    ],
    
    after_work: [
      "Confirm all validation passes locally",
      "Ensure PR size is reasonable (< 5,000 changes)",
      "Request QA review for test infrastructure changes",
      "Monitor CI pipeline for any failures"
    ]
  },
  
  escalation_education: {
    when_to_escalate: [
      "TypeScript strict mode violations cannot be resolved",
      "Test coverage drops below 95% threshold",
      "ESLint rules conflict with business requirements",
      "Architecture changes affect multiple domains"
    ],
    
    how_to_escalate: [
      "Use MCP agent communication for task delegation",
      "Include full context and error messages",
      "Specify validation requirements clearly",
      "Follow up with progress tracking tools"
    ]
  }
};
```

## Implementation Verification

### Validation Checklist
- [ ] Pre-commit hooks prevent 'any' type additions
- [ ] GitHub Actions enforce comprehensive validation
- [ ] Branch protection requires all status checks
- [ ] PR size validation prevents massive changes
- [ ] Agent constraints prevent validation bypassing
- [ ] Communication protocol enforces isolation boundaries
- [ ] Education system prevents accidental violations
- [ ] Monitoring detects bypass attempts

### Testing Isolation Effectiveness
```bash
# Test pre-commit hook isolation
echo "const test: any = 'violation';" > test-violation.ts
git add test-violation.ts
git commit -m "test: validation isolation" # Should fail

# Test GitHub Actions isolation
# Create PR with 'any' types - should be blocked by CI

# Test agent communication isolation
# Attempt to bypass validation through MCP tools - should be prevented
```

This isolation system ensures that validation failures like PR #34 cannot recur by implementing defense in depth across multiple layers of the development process.