/**
 * Sample task data for tests
 */

export const sampleTaskFiles = {
  newTask: `# Task: Implement Login Form
## Metadata
- Agent: senior-frontend-engineer
- Created: 2025-01-01T12:00:00Z
- Source: product-manager

## Objective
Create a responsive login form component

## Requirements
- Email/password fields
- Validation
- Error handling`,

  sampleTask: `# Task: Fix Navigation Bug
## Metadata
- Agent: senior-frontend-engineer
- Created: 2025-01-01T13:00:00Z
- Source: qa-engineer

## Objective
Fix navigation menu not showing on mobile devices

## Requirements
- Test on mobile viewports
- Ensure accessibility compliance`,

  planTask: `# Implementation Plan: Implement Login Form
## Task Analysis
- Core objective: Create login form component
- Success criteria: Form validates and submits correctly

## Detailed Steps
1. [PENDING] Create form component structure
2. [PENDING] Implement validation logic
3. [PENDING] Add error handling
4. [PENDING] Style with CSS
5. [PENDING] Write tests

## Required Resources
- MCP servers: none
- File access: src/components/
- Tools: React, TypeScript

## Dependencies and Order
- Prerequisites: none
- Parallel work: styling and logic can be done separately
- Blocking dependencies: component structure must be first`,

  doneTask: `# Task Complete: Implement Login Form
## Results
Login form component implemented successfully

## Deliverables
- src/components/LoginForm.tsx
- src/components/LoginForm.test.tsx
- Updated authentication flow

## Next Steps
- Integration testing with backend API`,

  errorTask: `# Task Error: Fix Navigation Bug
## Issue
Cannot reproduce the bug on available test devices

## Recommendations
- Need access to specific mobile device models
- Consider using device emulation tools
- Delegate to QA team for further investigation`
};

export const sampleMetadata = {
  agent: 'senior-frontend-engineer',
  created: '2025-01-01T12:00:00Z',
  source: 'product-manager'
};

export const sampleArchiveStructure = {
  timestamp: '2025-01-01T12-00-00',
  completedTasks: ['implement-login-form', 'fix-header-styling'],
  pendingTasks: ['update-navigation-menu']
};

export const createMockTask = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'implement-login-form',
  agent: 'senior-frontend-engineer',
  path: '/test/comm/senior-frontend-engineer/implement-login-form',
  hasInit: true,
  hasPlan: false,
  hasDone: false,
  hasError: false,
  created: new Date('2025-01-01T12:00:00Z'),
  updated: new Date('2025-01-01T12:00:00Z'),
  ...overrides
});

export const createMockAgent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'senior-frontend-engineer',
  taskCount: 3,
  completedCount: 1,
  pendingCount: 1,
  errorCount: 1,
  ...overrides
});