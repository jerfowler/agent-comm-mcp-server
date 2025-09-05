/**
 * Jest test setup file
 * Global test configuration and utilities
 */

import { jest } from '@jest/globals';
import { ConnectionManager } from '../src/core/ConnectionManager.js';

// Extend Jest timeout for slower operations
jest.setTimeout(10000);

// Global test utilities
(global as any).testUtils = {
  // Create mock ServerConfig
  createMockConfig: (overrides = {}) => ({
    commDir: '/test/comm',
    archiveDir: '/test/archive',
    logDir: '/test/logs',
    enableArchiving: true,
    // Core components - mocked for testing
    connectionManager: new ConnectionManager(),
    eventLogger: {
      logOperation: jest.fn() as any,
      getLogEntries: jest.fn() as any,
      getOperationStatistics: jest.fn() as any,
      clearLogs: jest.fn() as any
    },
    ...overrides
  }),

  // Create mock Task
  createMockTask: (overrides = {}) => ({
    name: 'test-task',
    agent: 'test-agent',
    path: '/test/comm/test-agent/test-task',
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

// Mock console methods in test environment
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Reset console mocks
  (console.log as jest.Mock).mockClear();
  (console.error as jest.Mock).mockClear();
  (console.warn as jest.Mock).mockClear();
  (console.info as jest.Mock).mockClear();
  (console.debug as jest.Mock).mockClear();
});

// Global error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

