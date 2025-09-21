# JSON-Based Task System - Comprehensive Plan

## Executive Summary

This document outlines a complete migration from markdown-based task files (INIT.md, PLAN.md, DONE.md, ERROR.md) to a structured JSON system (TASK.json, PLAN.json, DONE.json, ERROR.json). This change eliminates parsing ambiguities, enables precise validation, and provides deterministic field access for all task operations.

## Problem Statement

Current markdown-based task files suffer from:
- **Parsing Fragility**: Regex-based extraction is error-prone and brittle
- **Ambiguous Structure**: No enforced schema leads to inconsistent formats
- **Limited Validation**: Cannot validate complex relationships between requirements and steps
- **Poor Type Safety**: String-based parsing lacks TypeScript type guarantees
- **Tracking Limitations**: Difficult to track completion of specific criteria

## Solution Architecture

### Core Design Principles

1. **Structured Data First**: JSON schemas with full TypeScript interfaces
2. **Validation at Write Time**: Zod schemas prevent invalid data entry
3. **Traceable Relationships**: Explicit links between requirements → criteria → steps → results
4. **Lightweight Public API**: Minimal input required, server adds metadata
5. **Progressive Enhancement**: Server enriches data with version, timestamps, IDs

## Detailed Schema Specifications

### TASK.json Schema

```typescript
interface TaskSchema {
  // Auto-populated by server
  version: string;              // From package.json version
  taskId: string;               // Generated UUID
  agent: string;                // Agent name
  createdAt: string;            // ISO timestamp

  // Required user input
  objective: string;            // Clear goal statement (min 20 chars)

  criticalRequirements: Array<{
    id: string;                 // Unique identifier (auto-generated if not provided)
    description: string;        // What must be accomplished
    validation: string;         // How to verify completion
  }>;

  // Optional user input
  instructions?: string[];      // Step-by-step guidance

  requiredContext?: Array<{
    type: 'file' | 'resource' | 'knowledge';
    path?: string;              // For files
    description: string;        // What's needed
  }>;

  successCriteria: Array<{
    id: string;                 // Unique identifier (auto-generated if not provided)
    description: string;        // What success looks like
    measurable: string;         // How to measure
  }>;

  constraints?: {
    performance?: string[];     // Performance requirements
    security?: string[];        // Security considerations
    compatibility?: string[];   // Compatibility needs
  };
}
```

### PLAN.json Schema

```typescript
interface PlanSchema {
  // Auto-populated by server
  version: string;              // Matches server version
  taskId: string;               // Links to TASK.json
  agent: string;                // Agent name
  createdAt: string;            // ISO timestamp

  // Required user input
  overview: string;             // High-level approach (min 50 chars)

  implementationSteps: Array<{
    id: string;                 // Step identifier
    phase: string;              // Used to group steps together in phases
    description: string;        // Detailed explanation
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    meetsRequirements: string[]; // Maps to TASK.criticalRequirements
    successCriteriaIds: string[]; // Maps to TASK.successCriteria
    dependencies?: string[];     // Other step IDs or phases
    notes?: string[];             // Implementation insights & context
  }>;

  commonPatterns?: Array<{
    category: 'code' | 'testing' | 'interface' | 'architecture';
    pattern: string;            // Pattern name
    usage: string;              // When to use
    example?: string;           // Code example
  }>;
}
```

### DONE.json Schema

```typescript
interface DoneSchema {
  // Auto-populated
  version: string;
  taskId: string;
  agent: string;
  completedAt: string;

  // Required completion data
  completionSummary: string;    // What was accomplished

  implementedSteps: Array<{
    id: string;                 // Step ID from PLAN
    status: 'completed' | 'partial' | 'skipped';
    notes?: string;             // Implementation notes
  }>;

  successCriteriaResults: Array<{
    id: string;                 // Criteria ID from TASK
    achieved: boolean;
    evidence: string;           // Proof of completion
    verificationMethod: string; // How it was verified
  }>;

  // Deliverables and metrics
  deliverables: Array<{
    type: 'file' | 'feature' | 'fix' | 'documentation';
    path?: string;              // For files
    description: string;
  }>;

  metrics?: {
    performance?: Record<string, any>;
    coverage?: number;
    testsAdded?: number;
    linesChanged?: number;
  };

  lessonsLearned?: string[];
}
```

### ERROR.json Schema

```typescript
interface ErrorSchema {
  // Auto-populated
  version: string;
  taskId: string;
  agent: string;
  failedAt: string;

  // Error details
  errorSummary: string;         // What went wrong

  failurePoint: {
    stepId?: string;            // Which step failed
    criteriaId?: string;        // Which criteria couldn't be met
    phase: 'planning' | 'implementation' | 'validation' | 'completion';
  };

  rootCause: string;            // Why it failed

  attemptedSolutions: Array<{
    approach: string;
    result: string;
    whyFailed: string;
  }>;

  blockers: Array<{
    type: 'technical' | 'access' | 'knowledge' | 'dependency';
    description: string;
    requiresAction: string;     // What's needed to unblock
  }>;

  recommendedActions: string[];

  partialProgress?: {
    completedSteps: string[];   // Step IDs that were completed
    completedCriteria: string[]; // Criteria IDs that were met
    filesModified: string[];
  };
}
```

**Server Enrichment**:
- Generates IDs for requirements and criteria
- Adds version from package.json
- Creates taskId and timestamps
- Links criteria to requirements automatically
- Sets initial status to 'pending'
- Links to current task context
- Validates criteria IDs exist
- Ensures stepId exists in PLAN.json
- Validates status transitions
- Updates PLAN.json atomically
- For DONE: Validates all must-have criteria are met
- For ERROR: Requires failure analysis
- Creates appropriate JSON file
- Saves JSON to disk in a clear and easy to read format with newlines and spaces

## Implementation Strategy

### Phase 1: Schema Definition (Week 1)
- [ ] Create TypeScript interfaces for all schemas
- [ ] Implement Zod validation schemas
- [ ] Add JSON Schema generation for documentation
- [ ] Create comprehensive test fixtures

### Phase 2: Core Infrastructure (Week 2)
- [ ] Update TaskContextManager for JSON operations
- [ ] Implement JSON file readers/writers with validation
- [ ] Add migration utilities for existing markdown tasks
- [ ] Update file system utilities for JSON handling

### Phase 3: Tool Migration (Week 3)
- [ ] Update create_task for JSON output
- [ ] Update submit_plan for JSON output
- [ ] Update report_progress for JSON manipulation
- [ ] Update mark_complete for JSON generation
- [ ] Remove sync_todo_checkboxes (redundant)

### Phase 4: Testing & Documentation (Week 4)
- [ ] Comprehensive unit tests for JSON operations
- [ ] Integration tests for tool workflows
- [ ] Update PROTOCOL.md documentation
- [ ] Update README.md with new examples
- [ ] Create migration guide

## Breaking Changes

This is a release with these breaking changes:

1. **File Format**: All task files change from `.md` to `.json`
2. **Tool Parameters**: Some tools have new required parameters
3. **Response Format**: Tools return structured JSON instead of strings
4. **Removed Tool**: `sync_todo_checkboxes` is removed
5. **Validation**: Stricter validation on all inputs

## Benefits

### Immediate Benefits
- **Zero Parsing Errors**: Direct JSON field access
- **Type Safety**: Full TypeScript types throughout
- **Validation**: Schema validation at write time
- **Deterministic**: No regex ambiguity
- **Performance**: Faster than regex parsing

### Long-term Benefits
- **Observability**: Query specific fields directly
- **Traceability**: Clear links between all entities
- **Extensibility**: Easy to add new fields
- **Tool Integration**: JSON works with all tools
- **Analytics**: Can aggregate metrics across tasks

## Migration Strategy
- No Strategy Required

### Backward Compatibility
- No Backward compatibility needed

## Success Metrics

### Technical Metrics
- [ ] 100% elimination of parsing errors
- [ ] <10ms validation time per operation
- [ ] 100% type coverage in TypeScript
- [ ] Zero runtime type errors

### User Experience Metrics
- [ ] Simplified tool APIs (fewer required fields)
- [ ] Clear validation messages
- [ ] Improved progress tracking accuracy
- [ ] Better error diagnostics

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing workflows | High | Provide migration utilities and clear upgrade guide |
| JSON verbosity | Medium | Tools abstract complexity, humans use tools not raw JSON |
| Learning curve | Low | JSON is familiar, better than regex patterns |
| File size increase | Low | JSON compression, archival of completed tasks |

## Conclusion

This migration to JSON-based task files represents a fundamental improvement in reliability, maintainability, and functionality. By eliminating text parsing ambiguities and providing structured schemas, we enable precise task tracking, validation, and observability while simplifying the tool APIs.

The implementation follows our established patterns for breaking changes, includes comprehensive migration support, and aligns with our long-term vision for deterministic, observable agent task management.