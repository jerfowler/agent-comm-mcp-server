/**
 * Test utilities - properly exported for TypeScript compatibility
 */

// Removing unused import: jest
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { EventLogger, MockTimerDependency } from '../../src/logging/EventLogger.js';
import { ServerConfig } from '../../src/types.js';

export const testUtils = {
  // Create mock ServerConfig
  createMockConfig: (overrides: Partial<ServerConfig> = {}): ServerConfig => {
    const baseLogDir = overrides.logDir ?? './test/logs';
    
    const defaults: ServerConfig = {
      commDir: './test/comm',
      archiveDir: './test/archive', 
      logDir: baseLogDir,
      enableArchiving: true,
      // Core components - properly typed for testing
      connectionManager: new ConnectionManager(),
      eventLogger: new EventLogger(baseLogDir, new MockTimerDependency()),
    };
    
    // Apply overrides, but ensure eventLogger uses correct logDir
    const config: ServerConfig = { ...defaults, ...overrides };
    
    return config;
  },

  // Create mock Task
  createMockTask: (overrides = {}) => ({
    name: 'test-task',
    agent: 'test-agent',
    path: './test/comm/test-agent/test-task',
    hasInit: false,
    hasPlan: false,
    hasDone: false,
    hasError: false,
    ...overrides
  }),

  // Create mock file stats
  createMockStats: (overrides = {}) => ({
    birthtime: new Date('2025-01-01T12:00:00Z'),
    mtime: new Date('2025-01-01T12:05:00Z'),
    isDirectory: () => false,
    isFile: () => true,
    ...overrides
  }),

  // Generate test timestamp
  getTestTimestamp: () => '2025-01-01T12-00-00',

  // Common test data
  sampleTaskContent: `# Task: Test Task
## Metadata
- Agent: test-agent
- Created: 2025-01-01T12:00:00Z
- Source: test-source

## Objective
Test task for validation.

## Requirements
- Requirement 1
- Requirement 2`,

  samplePlanContent: `# Implementation Plan: Test Task

## Task Analysis
- Core objective: Complete test task
- Success criteria: All tests pass
- Complexity assessment: Simple

## Detailed Steps
1. [PENDING] Step 1 description
2. [PENDING] Step 2 description
3. [PENDING] Step 3 description

## Required Resources
- MCP servers: test-server
- File access: test files
- Tools: Jest testing framework`,

  // Validation test cases
  validationTestCases: {
    validStrings: ['valid-string', 'string123', 'String_Name'],
    invalidStrings: ['', '   ', null, undefined, 123, true, {}],
    validNumbers: [0, 1, 100, -1, 3.14],
    invalidNumbers: ['not-number', null, undefined, NaN, Infinity, {}],
    validBooleans: [true, false],
    invalidBooleans: ['true', 'false', 1, 0, null, undefined, {}],
    pathTraversalAttempts: ['../secrets', '../../etc/passwd', '../\\..\\windows', './.env'],
    specialCharacters: ['<script>', '"quotes"', '\\backslash', '|pipe|', '?question', '*asterisk'],
    longStrings: 'a'.repeat(1000),
    emptyContent: ['', '   ', '\n\n\n']
  }
};