/**
 * Unit tests for sync-todo-checkboxes tool - TDD Implementation
 * Comprehensive coverage for fuzzy matching, status mapping, and error handling
 */

import { jest } from '@jest/globals';
import { syncTodoCheckboxes } from '../../../src/tools/sync-todo-checkboxes.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { AgentCommError, ServerConfig } from '../../../src/types.js';

// Mock fs-extra with factory function - proper TypeScript pattern
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  remove: jest.fn(),
  ensureDir: jest.fn()
}));

// Import fs-extra after mocking to get the mocked functions
const mockFs = fs as unknown as jest.Mocked<{
  pathExists: jest.MockedFunction<(path: string) => Promise<boolean>>;
  readFile: jest.MockedFunction<(path: string, encoding?: string) => Promise<string>>;
  writeFile: jest.MockedFunction<(path: string, data: string) => Promise<void>>;
  readdir: jest.MockedFunction<(path: string) => Promise<string[]>>;
  stat: jest.MockedFunction<(path: string) => Promise<{ isDirectory: () => boolean; mtime?: Date }>>;
  remove: jest.MockedFunction<(path: string) => Promise<void>>;
  ensureDir: jest.MockedFunction<(path: string) => Promise<void>>;
}>;

// Type for writeFile mock calls - fs-extra uses Promise-based API
type WriteFileCall = [string, string];

// Helper function to create complete ServerConfig for tests
function createMockServerConfig(): ServerConfig {
  return {
    commDir: '/test/comm',
    archiveDir: '/test/archive',
    logDir: '/test/logs',
    enableArchiving: false,
    connectionManager: {
      register: jest.fn(),
      getConnection: jest.fn(),
      updateActivity: jest.fn(),
      getActiveConnections: jest.fn(),
      unregister: jest.fn(),
      getConnectionsByAgent: jest.fn(),
      cleanupStaleConnections: jest.fn(),
      getStatistics: jest.fn(),
      getConnectionCount: jest.fn(),
      hasConnection: jest.fn()
    } as any,
    eventLogger: {
      logOperation: jest.fn(),
      logError: jest.fn(),
      getOperationStatistics: jest.fn()
    } as any
  };
}

describe('syncTodoCheckboxes tool', () => {
  const mockConfig = createMockServerConfig();
  const testAgent = 'test-agent';
  const testActiveTaskDir = '2025-09-05T07-49-48-test-task';
  const testAgentPath = path.join(mockConfig.commDir, testAgent);
  const testTaskPath = path.join(testAgentPath, testActiveTaskDir);
  const testPlanPath = path.join(testTaskPath, 'PLAN.md');

  // Sample plan content with various checkbox formats
  const samplePlanContent = `# Test Task Plan

## Phase 1: Initial Setup

- [ ] **Setup Environment**: Configure development environment
  - Action: Install dependencies and setup workspace
  - Expected: All tools installed correctly
  - Error: Retry with different package manager

- [x] **Create Database**: Setup PostgreSQL database
  - Action: Run database creation scripts
  - Expected: Database accessible and seeded
  - Error: Check connection string and permissions

- [ ] **Implement Authentication**: Add user authentication system
  - Action: Integrate Auth0 with secure tokens
  - Expected: Users can login and logout securely
  - Error: Verify Auth0 configuration

## Phase 2: Core Features

- [ ] **Build API Endpoints**: Create REST API
  - Action: Implement CRUD operations for all entities
  - Expected: All endpoints return correct responses
  - Error: Debug with Postman and check logs

- [ ] **Frontend Components**: Develop user interface
  - Action: Create React components with TypeScript
  - Expected: Components render correctly and are responsive
  - Error: Check component props and state management
`;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks for successful scenarios
    mockFs.pathExists.mockImplementation(async (filePath: string) => {
      if (filePath === testAgentPath) return true;
      if (filePath === testPlanPath) return true;
      if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return false;
      return false;
    });
    
    mockFs.readdir.mockResolvedValue([testActiveTaskDir]);
    mockFs.stat.mockResolvedValue({ isDirectory: () => true });
    mockFs.readFile.mockResolvedValue(samplePlanContent);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  describe('Input Validation', () => {
    it('should validate required agent parameter', async () => {
      const args = {
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      };

      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow(AgentCommError);
    });

    it('should validate todoUpdates is an array', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: 'not-an-array'
      };

      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow('todoUpdates must be an array');
    });

    it('should validate todo update object structure', async () => {
      const invalidUpdates = [
        // Missing title
        { status: 'pending' },
        // Invalid status
        { title: 'Test', status: 'invalid' },
        // Empty title
        { title: '', status: 'pending' },
        // Non-string title
        { title: 123, status: 'pending' }
      ];

      for (let i = 0; i < invalidUpdates.length; i++) {
        const args = {
          agent: testAgent,
          todoUpdates: [invalidUpdates[i]]
        };

        await expect(syncTodoCheckboxes(mockConfig, args))
          .rejects.toThrow(AgentCommError);
      }
    });

    it('should accept valid status values', async () => {
      const validStatuses = ['pending', 'in_progress', 'completed'];
      
      for (const status of validStatuses) {
        const args = {
          agent: testAgent,
          todoUpdates: [{ title: 'Test Task', status }]
        };

        // Should not throw validation error
        const result = await syncTodoCheckboxes(mockConfig, args);
        expect(result).toBeDefined();
      }
    });

    it('should handle empty todoUpdates array', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: []
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.totalUpdates).toBe(0);
      expect(result.matchedUpdates).toBe(0);
      expect(result.message).toBe('No todo updates to process');
    });
  });

  describe('Agent and Task Discovery', () => {
    it('should throw error for non-existent agent', async () => {
      mockFs.pathExists.mockResolvedValueOnce(false);

      const args = {
        agent: 'non-existent-agent',
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      };

      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow('Agent directory not found');
    });

    it('should handle no active tasks', async () => {
      // Mock all tasks as completed (have DONE.md)
      mockFs.pathExists.mockImplementation(async (filePath: string) => {
        if (filePath === testAgentPath) return true;
        if (filePath.endsWith('DONE.md')) return true;
        return false;
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No active task found');
      expect(result.unmatchedTodos).toEqual(['Test']);
    });

    it('should find active task (without DONE.md or ERROR.md)', async () => {
      const inactiveTask = '2025-09-04T12-00-00-completed-task';
      mockFs.readdir.mockResolvedValue([inactiveTask, testActiveTaskDir]);
      
      mockFs.pathExists.mockImplementation(async (filePath: string) => {
        if (filePath === testAgentPath) return true;
        if (filePath === testPlanPath) return true;
        if (filePath.includes(inactiveTask) && filePath.endsWith('DONE.md')) return true;
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return false;
        return false;
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
    });

    it('should handle missing PLAN.md file', async () => {
      mockFs.pathExists.mockImplementation(async (filePath: string) => {
        if (filePath === testAgentPath) return true;
        if (filePath === testPlanPath) return false; // PLAN.md missing
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return false;
        return false;
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(false);
      expect(result.message).toContain('PLAN.md not found');
    });

    it('should handle PLAN.md with no checkboxes', async () => {
      mockFs.readFile.mockResolvedValue('# Plan without checkboxes\n\nJust some text content.');

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No checkboxes found in PLAN.md');
    });
  });

  describe('Fuzzy Matching Algorithm', () => {
    describe('Exact Matches', () => {
      it('should match exact titles perfectly', async () => {
        const args = {
          agent: testAgent,
          todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
        };

        const result = await syncTodoCheckboxes(mockConfig, args);

        expect(result.success).toBe(true);
        expect(result.matchedUpdates).toBe(1);
        expect(result.updatedCheckboxes).toContain('Setup Environment (completed)');
      });

      it('should handle case insensitive matches', async () => {
        const args = {
          agent: testAgent,
          todoUpdates: [{ title: 'setup environment', status: 'completed' }]
        };

        const result = await syncTodoCheckboxes(mockConfig, args);

        expect(result.success).toBe(true);
        expect(result.matchedUpdates).toBe(1);
      });
    });

    describe('Fuzzy Matching with 60%+ Threshold', () => {
      it('should match similar titles above 60% threshold', async () => {
        const testCases = [
          { todo: 'Setup Env', checkbox: 'Setup Environment', shouldMatch: true },
          { todo: 'Create DB', checkbox: 'Create Database', shouldMatch: true },
          { todo: 'Auth System', checkbox: 'Implement Authentication', shouldMatch: true },
          { todo: 'API', checkbox: 'Build API Endpoints', shouldMatch: false }, // Too short
          { todo: 'Setup Development Environment', checkbox: 'Setup Environment', shouldMatch: true },
        ];

        for (const testCase of testCases) {
          const args = {
            agent: testAgent,
            todoUpdates: [{ title: testCase.todo, status: 'completed' }]
          };

          const result = await syncTodoCheckboxes(mockConfig, args);

          if (testCase.shouldMatch) {
            expect(result.matchedUpdates).toBeGreaterThan(0);
            expect(result.success).toBe(true);
          } else {
            expect(result.matchedUpdates).toBe(0);
            expect(result.unmatchedTodos).toContain(testCase.todo);
          }
        }
      });

      it('should apply substring and word bonuses correctly', async () => {
        const args = {
          agent: testAgent,
          todoUpdates: [
            { title: 'Database Setup', status: 'completed' }, // Should match "Create Database"
            { title: 'Environment Configuration', status: 'pending' } // Should match "Setup Environment"
          ]
        };

        const result = await syncTodoCheckboxes(mockConfig, args);

        expect(result.matchedUpdates).toBe(2);
        expect(result.success).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle special characters and normalization', async () => {
        const args = {
          agent: testAgent,
          todoUpdates: [{ title: 'Setup Environment!!!', status: 'completed' }]
        };

        const result = await syncTodoCheckboxes(mockConfig, args);

        expect(result.success).toBe(true);
        expect(result.matchedUpdates).toBe(1);
      });

      it('should handle titles with extra whitespace', async () => {
        const args = {
          agent: testAgent,
          todoUpdates: [{ title: '  Setup   Environment  ', status: 'completed' }]
        };

        const result = await syncTodoCheckboxes(mockConfig, args);

        expect(result.success).toBe(true);
        expect(result.matchedUpdates).toBe(1);
      });

      it('should reject matches below 60% threshold', async () => {
        const args = {
          agent: testAgent,
          todoUpdates: [{ title: 'Completely Different Task Name', status: 'completed' }]
        };

        const result = await syncTodoCheckboxes(mockConfig, args);

        expect(result.success).toBe(false);
        expect(result.matchedUpdates).toBe(0);
        expect(result.unmatchedTodos).toContain('Completely Different Task Name');
      });
    });
  });

  describe('Status Mapping and Checkbox Updates', () => {
    it('should map pending status to unchecked checkbox', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'pending' }]
      };

      await syncTodoCheckboxes(mockConfig, args);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [ ] **Setup Environment**');
    });

    it('should map in_progress status to in_progress checkbox', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'in_progress' }]
      };

      await syncTodoCheckboxes(mockConfig, args);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [~] **Setup Environment**');
    });

    it('should map completed status to checked checkbox', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      await syncTodoCheckboxes(mockConfig, args);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [x] **Setup Environment**');
    });

    it('should handle multiple status updates in single call', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [
          { title: 'Setup Environment', status: 'completed' },
          { title: 'Create Database', status: 'pending' },
          { title: 'Implement Authentication', status: 'in_progress' }
        ]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(3);
      expect(result.totalUpdates).toBe(3);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [x] **Setup Environment**');
      expect(writtenContent).toContain('- [ ] **Create Database**'); // Changed from [x] to [ ] due to pending status
      expect(writtenContent).toContain('- [~] **Implement Authentication**'); // in_progress should be [~]
    });

    it('should preserve other plan content unchanged', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      await syncTodoCheckboxes(mockConfig, args);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      
      // Should preserve plan structure and other content
      expect(writtenContent).toContain('# Test Task Plan');
      expect(writtenContent).toContain('## Phase 1: Initial Setup');
      expect(writtenContent).toContain('- Action: Install dependencies');
      expect(writtenContent).toContain('- Expected: All tools installed');
    });
  });

  describe('Partial Matches and Error Handling', () => {
    it('should handle mix of matched and unmatched todos', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [
          { title: 'Setup Environment', status: 'completed' }, // Should match
          { title: 'Non Existent Task', status: 'pending' },   // Should not match
          { title: 'Create Database', status: 'pending' }      // Should match
        ]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(2);
      expect(result.totalUpdates).toBe(3);
      expect(result.unmatchedTodos).toEqual(['Non Existent Task']);
      expect(result.updatedCheckboxes).toHaveLength(2);
    });

    it('should not write file if no matches found', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [
          { title: 'Non Existent Task 1', status: 'pending' },
          { title: 'Non Existent Task 2', status: 'completed' }
        ]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(false);
      expect(result.matchedUpdates).toBe(0);
      expect(result.unmatchedTodos).toHaveLength(2);
      
      // Should not call writeFile for PLAN.md (only lock files are OK)
      const writeFileCalls = mockFs.writeFile.mock.calls;
      const planWriteCalls = writeFileCalls.filter(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCalls).toHaveLength(0);
    });

    it('should only write file once when matches are found', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [
          { title: 'Setup Environment', status: 'completed' },
          { title: 'Create Database', status: 'pending' }
        ]
      };

      await syncTodoCheckboxes(mockConfig, args);

      // Should write PLAN.md file exactly once (plus lock files)
      const writeFileCalls = mockFs.writeFile.mock.calls;
      const planWriteCalls = writeFileCalls.filter(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCalls).toHaveLength(1);
      expect(planWriteCalls[0][0]).toBe(testPlanPath);
      expect(planWriteCalls[0][1]).toEqual(expect.any(String));
    });
  });

  describe('Return Value Structure', () => {
    it('should return complete result structure for successful updates', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [
          { title: 'Setup Environment', status: 'completed' },
          { title: 'Unknown Task', status: 'pending' }
        ]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result).toEqual({
        success: true,
        matchedUpdates: 1,
        totalUpdates: 2,
        unmatchedTodos: ['Unknown Task'],
        updatedCheckboxes: ['Setup Environment (completed)'],
        message: expect.stringContaining('Successfully updated 1/2 checkboxes')
      });
    });

    it('should return complete result structure for no matches', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Non Existent Task', status: 'pending' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result).toEqual({
        success: false,
        matchedUpdates: 0,
        totalUpdates: 1,
        unmatchedTodos: ['Non Existent Task'],
        updatedCheckboxes: [],
        message: 'No matching checkboxes found for any of 1 todo updates'
      });
    });
  });

  describe('File System Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied') as never);

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      };

      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow('Permission denied');
    });

    it('should handle file write errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Disk full') as never);

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow('Disk full');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large number of todo updates efficiently', async () => {
      const largeTodoSet: Array<{ title: string, status: 'pending' | 'completed' | 'in_progress' }> = Array.from({ length: 50 }, (_, i) => ({
        title: `Task ${i}`,
        status: 'pending' as const
      }));

      // Add a few that will match
      largeTodoSet.push(
        { title: 'Setup Environment', status: 'completed' as const },
        { title: 'Create Database', status: 'pending' as const }
      );

      const args = {
        agent: testAgent,
        todoUpdates: largeTodoSet
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.totalUpdates).toBe(52);
      expect(result.matchedUpdates).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should handle plan with many checkboxes efficiently', async () => {
      const largeContent = `# Large Plan\n\n${Array.from({ length: 100 }, (_, i) => 
        `- [ ] **Task ${i}**: Description for task ${i}\n`
      ).join('')}`;
      
      mockFs.readFile.mockResolvedValue(largeContent as never);

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Task 50', status: 'completed' as const }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
    });
  });

  // TDD Phase 1: New Tests for Critical Issues
  describe('TaskId Parameter Support (TDD)', () => {
    const testActiveTaskDir1 = '2025-09-05T07-49-48-test-task-1';
    const testActiveTaskDir2 = '2025-09-05T08-30-15-test-task-2';
    
    beforeEach(() => {
      // Mock multiple active tasks for taskId testing
      mockFs.readdir.mockResolvedValue([testActiveTaskDir1, testActiveTaskDir2] as never);
      
      mockFs.pathExists.mockImplementation(async (filePath: string) => {
        if (filePath === testAgentPath) return true;
        // Both task directories exist
        if (filePath === path.join(testAgentPath, testActiveTaskDir1)) return true;
        if (filePath === path.join(testAgentPath, testActiveTaskDir2)) return true;
        // Both tasks have PLAN.md files
        if (filePath === path.join(testAgentPath, testActiveTaskDir1, 'PLAN.md')) return true;
        if (filePath === path.join(testAgentPath, testActiveTaskDir2, 'PLAN.md')) return true;
        // Neither task has DONE.md or ERROR.md (both are active)
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return false;
        return false;
      });
    });

    it('should process first active task when no taskId provided (backward compatibility)', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
      expect(result.message).toContain(testActiveTaskDir1); // Should use first task
    });

    it('should process specific task when taskId provided', async () => {
      const args = {
        agent: testAgent,
        taskId: testActiveTaskDir2,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
      expect(result.message).toContain(testActiveTaskDir2); // Should use specified task
    });

    it('should handle invalid taskId gracefully', async () => {
      const args = {
        agent: testAgent,
        taskId: 'non-existent-task-id',
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Task not found');
      expect(result.unmatchedTodos).toEqual(['Setup Environment']);
    });

    it('should handle taskId for completed task (inactive task)', async () => {
      const completedTask = '2025-09-04T12-00-00-completed-task';
      
      mockFs.pathExists.mockImplementation(async (filePath: string) => {
        if (filePath === testAgentPath) return true;
        if (filePath === path.join(testAgentPath, completedTask)) return true;
        if (filePath === path.join(testAgentPath, completedTask, 'PLAN.md')) return true;
        if (filePath.includes(completedTask) && filePath.endsWith('DONE.md')) return true;
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return false;
        return false;
      });

      const args = {
        agent: testAgent,
        taskId: completedTask,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(false);
      expect(result.message).toContain('inactive');
    });

    it('should validate taskId parameter type', async () => {
      const args = {
        agent: testAgent,
        taskId: 123, // Invalid type
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      };

      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow('taskId must be a string');
    });
  });

  describe('Three-State Checkbox Support (TDD)', () => {
    const planContentWithThreeStates = `# Test Task Plan

## Phase 1: Initial Setup

- [ ] **Setup Environment**: Configure development environment
  - Action: Install dependencies and setup workspace

- [~] **Create Database**: Setup PostgreSQL database  
  - Action: Run database creation scripts

- [x] **Implement Authentication**: Add user authentication system
  - Action: Integrate Auth0 with secure tokens
`;

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(planContentWithThreeStates as never);
    });

    it('should preserve in_progress state with [~] checkbox marker', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'in_progress' }]
      };

      await syncTodoCheckboxes(mockConfig, args);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [~] **Setup Environment**');
    });

    it('should map pending status to [ ] checkbox', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Create Database', status: 'pending' }]
      };

      await syncTodoCheckboxes(mockConfig, args);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [ ] **Create Database**');
    });

    it('should map completed status to [x] checkbox', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' }]
      };

      await syncTodoCheckboxes(mockConfig, args);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [x] **Setup Environment**');
    });

    it('should handle all three state transitions in single update', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [
          { title: 'Setup Environment', status: 'in_progress' },
          { title: 'Create Database', status: 'pending' },
          { title: 'Implement Authentication', status: 'completed' }
        ]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(3);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [~] **Setup Environment**');
      expect(writtenContent).toContain('- [ ] **Create Database**');
      expect(writtenContent).toContain('- [x] **Implement Authentication**');
    });

    it('should correctly parse existing three-state checkboxes', async () => {
      // This tests that the extractCheckboxTitles function recognizes [~] checkboxes
      const args = {
        agent: testAgent,
        todoUpdates: [
          { title: 'Create Database', status: 'completed' } // Should find [~] checkbox and update it
        ]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
      expect(result.updatedCheckboxes).toContain('Create Database (completed)');
    });

    it('should maintain backward compatibility with two-state checkboxes', async () => {
      // Reset to original two-state content for this test
      mockFs.readFile.mockResolvedValue(samplePlanContent as never);

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'in_progress' }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);

      // Find the PLAN.md write call (not lock file)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md'));
      expect(planWriteCall).toBeDefined();
      if (!planWriteCall) throw new Error('planWriteCall not found');
      
      const writtenContent = planWriteCall[1];
      expect(writtenContent).toContain('- [~] **Setup Environment**'); // Should create [~] even from [ ]
    });
  });

  describe('Lock Coordination Mechanism (TDD Implementation)', () => {
    beforeEach(() => {
      // The lock mechanism uses real file system operations but we mock fs-extra
      // so the lock files are also mocked. This is fine for testing the basic flow.
    });

    it('should successfully process when no lock exists', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' as const }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
      
      // Verify that we attempted to write both lock file and PLAN.md
      const writeFileCalls = mockFs.writeFile.mock.calls;
      expect(writeFileCalls.length).toBeGreaterThanOrEqual(1);
      
      // Check that PLAN.md was written with the correct content
      const planWriteCall = writeFileCalls.find(call => (call as [string, string])[0].endsWith('PLAN.md')) as [string, string];
      expect(planWriteCall).toBeDefined();
      expect(planWriteCall[1]).toContain('- [x] **Setup Environment**');
    });

    it('should handle lock file operations correctly', async () => {
      // Mock a scenario where a lock file exists but is stale (test that lock cleanup works)
      const lockFilePath = `/test/comm/test-agent/${testActiveTaskDir}/.sync.lock`;
      const staleLockContent = JSON.stringify({
        tool: 'report-progress',
        pid: 99999, // Non-existent process
        timestamp: Date.now() - 60000, // 1 minute ago (stale)
        lockId: 'stale-lock-id'
      });
      
      // Mock file system to simulate stale lock file
      mockFs.pathExists.mockImplementation(async (filePath: string) => {
        if (filePath === testAgentPath) return true;
        if (filePath === testPlanPath) return true;
        if (filePath === lockFilePath) return true; // Lock file exists
        if (filePath.endsWith('DONE.md') || filePath.endsWith('ERROR.md')) return false;
        return false;
      });
      
      mockFs.readFile.mockImplementation(async (filePath: string) => {
        if (filePath === testPlanPath) return samplePlanContent;
        if (filePath === lockFilePath) return staleLockContent;
        throw new Error('Unexpected file read');
      });
      
      // Mock stat to return proper file stats with mtime
      mockFs.stat.mockImplementation(async (filePath: string) => {
        if (filePath.includes('task-dir') || filePath.endsWith(testActiveTaskDir)) {
          return { isDirectory: () => true };
        }
        if (filePath === lockFilePath) {
          return {
            isDirectory: () => false,
            mtime: new Date(Date.now() - 60000) // 1 minute ago
          };
        }
        return { isDirectory: () => false, mtime: new Date() };
      });
      
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' as const }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
    });

    it('should write lock files during operation', async () => {
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' as const }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      expect(result.success).toBe(true);
      
      // Verify that lock files were written (and removed)
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      const lockWriteCalls = writeFileCalls.filter(call => call[0].includes('.sync.lock'));
      expect(lockWriteCalls.length).toBeGreaterThan(0); // Should have written a lock file
    });

    it('should handle lock file write errors gracefully', async () => {
      // Mock writeFile to fail only for lock files - using proper typing
      mockFs.writeFile.mockImplementation(async (filePath: string, _content: string) => {
        if (filePath.includes('.sync.lock')) {
          throw new Error('Unable to create lock file');
        }
        // Allow PLAN.md writes to succeed
        return undefined;
      });

      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' as const }]
      };

      await expect(syncTodoCheckboxes(mockConfig, args))
        .rejects.toThrow('Failed to acquire lock');
    });

    it('should coordinate with lock mechanism during processing', async () => {
      // This test verifies that the lock coordination mechanism integrates correctly
      // with the sync-todo-checkboxes functionality
      const args = {
        agent: testAgent,
        todoUpdates: [{ title: 'Setup Environment', status: 'completed' as const }]
      };

      const result = await syncTodoCheckboxes(mockConfig, args);

      // Verify successful execution
      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
      
      // Verify that both lock operations and PLAN.md operations occurred
      const writeFileCalls = mockFs.writeFile.mock.calls as WriteFileCall[];
      expect(writeFileCalls.length).toBeGreaterThan(0);
      
      // Should have written lock file and PLAN.md
      const lockWriteCalls = writeFileCalls.filter(call => call[0].includes('.sync.lock'));
      const planWriteCalls = writeFileCalls.filter(call => (call as [string, string])[0].endsWith('PLAN.md'));
      
      expect(lockWriteCalls.length).toBeGreaterThan(0);
      expect(planWriteCalls.length).toBe(1);
      
      // Verify the PLAN.md content was updated correctly
      const planContent = planWriteCalls[0][1];
      expect(planContent).toContain('- [x] **Setup Environment**');
      
      // The lock mechanism successfully coordinated the operation
      expect(result.message).toContain('Successfully updated 1/1 checkboxes');
    });
  });
});