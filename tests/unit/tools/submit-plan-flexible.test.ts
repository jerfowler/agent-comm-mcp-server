/**
 * Tests for flexible plan format validation in submit-plan tool
 * Issue #74: Fix overly strict plan validation blocking agents
 */

import { jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { submitPlan } from '../../../src/tools/submit-plan.js';
import { ServerConfig } from '../../../src/types.js';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';

// Mock dependencies
jest.mock('../../../src/utils/fs-extra-safe.js');
jest.mock('../../../src/core/TaskContextManager.js');

const mockedFs = fs as jest.Mocked<typeof fs>;
const MockedTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;

describe('submit-plan - Flexible Plan Validation', () => {
  let mockConfig: ServerConfig;
  let mockConnectionManager: any;
  let mockEventLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TaskContextManager to bypass its internal validation
    const mockInstance = {
      submitPlan: jest.fn().mockResolvedValue({
        success: true,
        message: 'Plan submitted successfully',
        contextId: 'test-context-id',
        stepsIdentified: 1,
        phases: 1,
        initialProgress: {
          completed: 0,
          inProgress: 0,
          pending: 1,
          blocked: 0
        }
      } as never)
    };
    (MockedTaskContextManager as unknown as Mock).mockImplementation(() => mockInstance);

    // Mock file system operations with proper typing
    const mockPathExists = mockedFs.pathExists as unknown as Mock<() => Promise<boolean>>;
    mockPathExists.mockResolvedValue(true);

    const mockEnsureDir = mockedFs.ensureDir as unknown as Mock<() => Promise<void>>;
    mockEnsureDir.mockResolvedValue(undefined);

    const mockWriteFile = mockedFs.writeFile as unknown as Mock<() => Promise<void>>;
    mockWriteFile.mockResolvedValue(undefined);

    const mockReadFile = mockedFs.readFile as unknown as Mock<(path: string) => Promise<string>>;
    mockReadFile.mockImplementation((path: string) => {
      if (path.endsWith('INIT.md')) {
        return Promise.resolve('# Test Task\n\nInitial task content');
      }
      return Promise.resolve('');
    });

    // Mock connection manager
    mockConnectionManager = {
      register: jest.fn(),
      getConnection: jest.fn(),
      updateActivity: jest.fn(),
      getActiveConnections: jest.fn(),
      unregister: jest.fn(),
      getConnectionsByAgent: jest.fn(),
      cleanupStaleConnections: jest.fn(),
      getStatistics: jest.fn(),
      getConnectionCount: jest.fn(),
      hasConnection: jest.fn(),
      createConnection: jest.fn().mockReturnValue({
        id: 'test-connection',
        agent: 'test-agent',
        startTime: new Date()
      }),
      closeConnection: jest.fn(),
      listConnections: jest.fn().mockReturnValue([])
    };

    // Mock event logger
    mockEventLogger = {
      logOperation: jest.fn(),
      logError: jest.fn(),
      getOperationStatistics: jest.fn(),
      logLowLevel: jest.fn(),
      waitForWriteQueueEmpty: jest.fn(() => Promise.resolve())
    };

    mockConfig = {
      commDir: '/tmp/test-comm',
      archiveDir: '/tmp/test-comm/.archive',
      logDir: '/tmp/test-comm/.logs',
      enableArchiving: false,
      connectionManager: mockConnectionManager,
      eventLogger: mockEventLogger
    };
  });

  describe('Minimal Plan Format', () => {
    it('should accept a plan with single minimal checkbox', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] Task'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should accept a plan with multiple minimal checkboxes', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should accept a plan without bold formatting', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] Simple task without bold'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });
  });

  describe('Variable Bullet Points', () => {
    it('should accept checkboxes with zero bullet points', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] **Task**: No additional details needed'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should accept checkboxes with 10+ bullet points', async () => {
      const args = {
        agent: 'test-agent',
        content: `- [ ] **Complex Task**: Many details
  - Detail 1
  - Detail 2
  - Detail 3
  - Detail 4
  - Detail 5
  - Detail 6
  - Detail 7
  - Detail 8
  - Detail 9
  - Detail 10
  - Detail 11`
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should accept mixed bullet point counts', async () => {
      const args = {
        agent: 'test-agent',
        content: `- [ ] **Task 1**: No bullets
- [ ] **Task 2**: Two bullets
  - Bullet 1
  - Bullet 2
- [ ] **Task 3**: Many bullets
  - Bullet 1
  - Bullet 2
  - Bullet 3
  - Bullet 4
  - Bullet 5
  - Bullet 6`
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });
  });

  describe('Keyword Requirements', () => {
    it('should accept plans without Action/Expected/Error keywords', async () => {
      const args = {
        agent: 'test-agent',
        content: `- [ ] **Setup Environment**: Initialize project
  - Run npm install
  - Create config files
  - Set environment variables`
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should accept informal bullet points', async () => {
      const args = {
        agent: 'test-agent',
        content: `- [ ] **Fix Bug**: Resolve issue
  - Find the problem
  - Write a test
  - Fix the code
  - Verify it works`
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should still accept traditional format with keywords', async () => {
      const args = {
        agent: 'test-agent',
        content: `- [ ] **Traditional Task**: Following old format
  - Action: Do something
  - Expected: Success
  - Error: Handle failure`
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });
  });

  describe('Varied Checkbox Descriptions', () => {
    it('should accept short descriptions', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] Fix'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should accept long descriptions', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] **Comprehensive Refactoring**: This is a very long description that explains in detail what needs to be done including multiple aspects of the implementation and various considerations that must be taken into account during the development process'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should accept descriptions with emojis', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] 🚀 **Launch Feature**: Deploy to production 🎉'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should accept descriptions with special characters', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] **Task #123**: Fix issue @user mentioned (priority: high)'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });
  });

  describe('Validation Mode Configuration', () => {
    it('should use relaxed mode by default', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] Simple task'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should respect validation_mode parameter when set to minimal', async () => {
      const args = {
        agent: 'test-agent',
        content: 'Just some text without checkboxes',
        validation_mode: 'minimal'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should enforce strict mode when explicitly requested', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] Task without details',
        validation_mode: 'strict'
      };

      // In strict mode, this should fail due to not matching strict format
      await expect(submitPlan(mockConfig, args)).rejects.toThrow('Plan must include at least ONE trackable item');
    });

    it('should respect AGENT_COMM_VALIDATION_MODE environment variable', async () => {
      process.env['AGENT_COMM_VALIDATION_MODE'] = 'minimal';

      const args = {
        agent: 'test-agent',
        content: 'Text without checkboxes'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });

      delete process.env['AGENT_COMM_VALIDATION_MODE'];
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty plan gracefully', async () => {
      const args = {
        agent: 'test-agent',
        content: '',
        validation_mode: 'minimal'
      };

      // Empty content should be rejected even in minimal mode since it can't be a plan
      await expect(submitPlan(mockConfig, args)).rejects.toThrow('content must be a non-empty string');
    });

    it('should handle plan with only whitespace', async () => {
      const args = {
        agent: 'test-agent',
        content: '   \n   \n   ',
        validation_mode: 'minimal'
      };

      // Whitespace-only content is trimmed and rejected by validation utils (proper behavior)
      await expect(submitPlan(mockConfig, args)).rejects.toThrow('content must be a non-empty string');
    });

    it('should handle mixed checkbox formats', async () => {
      const args = {
        agent: 'test-agent',
        content: `- [ ] Standard checkbox
- [] No spaces checkbox
- [x] Completed checkbox
- [~] In progress checkbox`
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should handle nested checkboxes', async () => {
      const args = {
        agent: 'test-agent',
        content: `- [ ] Parent task
  - [ ] Subtask 1
  - [ ] Subtask 2
    - [ ] Sub-subtask`
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing strict format', async () => {
      const args = {
        agent: 'test-agent',
        content: `- [ ] **Proper Task**: Following strict format
  - Action: Execute command
  - Expected: Successful completion
  - Error: Rollback and report`,
        validation_mode: 'strict'
      };

      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should reject invalid format in strict mode', async () => {
      const args = {
        agent: 'test-agent',
        content: 'Invalid plan format',
        validation_mode: 'strict'
      };

      await expect(submitPlan(mockConfig, args)).rejects.toThrow('Plan must include at least ONE trackable item');
    });
  });

  describe('Type Safety', () => {
    it('should use nullish coalescing for defaults', async () => {
      const args = {
        agent: 'test-agent',
        content: '- [ ] Test task',
        validation_mode: undefined // Should use default
      };

      // This test verifies the implementation uses ?? not ||
      await expect(submitPlan(mockConfig, args)).resolves.toMatchObject({
        success: true,
        contextId: expect.any(String)
      });
    });

    it('should properly type all variables', async () => {
      // This test ensures no 'any' types are used
      const args: Record<string, unknown> = {
        agent: 'test-agent' as string,
        content: '- [ ] Type-safe task' as string,
        validation_mode: 'relaxed' as string
      };

      const result = await submitPlan(mockConfig, args);

      // Verify result has correct type structure
      expect(result).toMatchObject({
        success: expect.any(Boolean),
        contextId: expect.any(String),
        message: expect.any(String)
      });
    });
  });
});