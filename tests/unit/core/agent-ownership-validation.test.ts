/**
 * Agent Ownership Validation Tests
 * Comprehensive test suite for strict agent ownership validation
 */

import { jest } from '@jest/globals';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import path from 'path';
import { TaskContextManager } from '../../../src/core/TaskContextManager.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { AgentOwnershipError } from '../../../src/types.js';

// Mock fs-extra-safe
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  ensureDir: jest.fn()
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Agent Ownership Validation', () => {
  let taskContextManager: TaskContextManager;
  let connectionManager: ConnectionManager;
  let eventLogger: EventLogger;
  const commDir = '/test/comm';

  beforeEach(() => {
    jest.clearAllMocks();
    
    connectionManager = new ConnectionManager();
    eventLogger = new EventLogger('/test/logs');

    // Mock eventLogger to prevent actual file writes
    jest.spyOn(eventLogger, 'logOperation').mockResolvedValue();
    // EventLogger doesn't have a close method, so don't spy on it

    taskContextManager = new TaskContextManager({
      commDir,
      connectionManager,
      eventLogger
    });
  });

  afterEach(async () => {
    // No cleanup needed for mocked eventLogger
    jest.clearAllMocks();
  });

  describe('validateAgentOwnership', () => {
    it('should validate ownership when agent owns the task', async () => {
      const agent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';
      const taskPath = path.join(commDir, agent, taskId);

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === taskPath) return Promise.resolve(true);
        if (p === path.join(taskPath, 'INIT.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date()
      } as any);

      // This should not throw
      await expect(
        taskContextManager.validateAgentOwnership(taskId, agent)
      ).resolves.toEqual({
        valid: true,
        agent,
        taskId,
        taskPath
      });
    });

    it('should reject when agent does not own the task', async () => {
      const ownerAgent = 'backend-engineer';
      const attemptingAgent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';
      
      // Task exists for owner but not for attempting agent
      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === commDir) return Promise.resolve(true);
        if (p === path.join(commDir, ownerAgent, taskId)) return Promise.resolve(true);
        if (p === path.join(commDir, attemptingAgent, taskId)) return Promise.resolve(false);
        if (p.includes('INIT.md') && p.includes(ownerAgent)) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      // Mock readdir to find the actual owner
      mockedFs.readdir.mockResolvedValue([ownerAgent, attemptingAgent]);
      
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date()
      } as any);

      await expect(
        taskContextManager.validateAgentOwnership(taskId, attemptingAgent)
      ).rejects.toThrow(AgentOwnershipError);

      await expect(
        taskContextManager.validateAgentOwnership(taskId, attemptingAgent)
      ).rejects.toThrow(
        `Agent '${attemptingAgent}' does not own task '${taskId}'. This task belongs to '${ownerAgent}'.`
      );
    });

    it('should reject when task does not exist', async () => {
      const agent = 'frontend-engineer';
      const taskId = 'non-existent-task';

      mockedFs.pathExists.mockResolvedValue(false);

      await expect(
        taskContextManager.validateAgentOwnership(taskId, agent)
      ).rejects.toThrow(AgentOwnershipError);

      await expect(
        taskContextManager.validateAgentOwnership(taskId, agent)
      ).rejects.toThrow(
        `Task '${taskId}' not found for agent '${agent}'.`
      );
    });

    it('should provide helpful error message when task exists for different agent', async () => {
      const ownerAgent = 'backend-engineer';
      const attemptingAgent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';

      // Mock that we can detect the actual owner
      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === commDir) return Promise.resolve(true);
        if (p === path.join(commDir, ownerAgent)) return Promise.resolve(true);
        if (p === path.join(commDir, ownerAgent, taskId)) return Promise.resolve(true);
        if (p === path.join(commDir, attemptingAgent, taskId)) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      mockedFs.readdir.mockImplementation((p: string) => {
        if (p === commDir) return Promise.resolve([ownerAgent, attemptingAgent]);
        return Promise.resolve([]);
      });

      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date()
      } as any);

      await expect(
        taskContextManager.validateAgentOwnership(taskId, attemptingAgent)
      ).rejects.toThrow(
        `Agent '${attemptingAgent}' does not own task '${taskId}'. This task belongs to '${ownerAgent}'.`
      );
    });

    it('should log ownership validation attempts', async () => {
      const agent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';
      const taskPath = path.join(commDir, agent, taskId);

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === taskPath) return Promise.resolve(true);
        if (p === path.join(taskPath, 'INIT.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      await taskContextManager.validateAgentOwnership(taskId, agent);

      expect(eventLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validate_ownership',
          agent,
          taskId,
          success: true
        })
      );
    });

    it('should log failed ownership validation attempts', async () => {
      const agent = 'frontend-engineer';
      const taskId = 'non-existent-task';

      mockedFs.pathExists.mockResolvedValue(false);

      await expect(
        taskContextManager.validateAgentOwnership(taskId, agent)
      ).rejects.toThrow();

      expect(eventLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validate_ownership',
          agent,
          taskId,
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('not found')
          })
        })
      );
    });
  });

  describe('submitPlan with ownership validation', () => {
    it('should allow plan submission when agent owns task', async () => {
      const agent = 'backend-engineer';
      const taskId = 'task-20250109-123456';
      const taskPath = path.join(commDir, agent, taskId);
      
      const connection = {
        id: 'test-conn-1',
        agent,
        startTime: new Date(),
        metadata: { taskId }
      };

      const planContent = `# Implementation Plan

## Phase 1: Setup
- [ ] Initialize project structure
- [ ] Configure dependencies

## Phase 2: Development
- [ ] Implement core features
- [ ] Add unit tests`;

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === taskPath) return Promise.resolve(true);
        if (p === path.join(taskPath, 'INIT.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.writeFile.mockResolvedValue();

      const result = await taskContextManager.submitPlan(planContent, connection);
      
      expect(result.success).toBe(true);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        path.join(taskPath, 'PLAN.md'),
        planContent
      );
    });

    it('should reject plan submission when agent does not own task', async () => {
      const ownerAgent = 'backend-engineer';
      const attemptingAgent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';
      
      const connection = {
        id: 'test-conn-1',
        agent: attemptingAgent,
        startTime: new Date(),
        metadata: { taskId }
      };

      const planContent = `# Implementation Plan

## Phase 1: Setup
- [ ] Initialize project structure
- [ ] Configure dependencies`;

      // Task exists for owner but not for attempting agent
      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === path.join(commDir, ownerAgent, taskId)) return Promise.resolve(true);
        if (p === path.join(commDir, attemptingAgent, taskId)) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      await expect(
        taskContextManager.submitPlan(planContent, connection)
      ).rejects.toThrow(AgentOwnershipError);

      expect(mockedFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('reportProgress with ownership validation', () => {
    it('should allow progress reporting when agent owns task', async () => {
      const agent = 'backend-engineer';
      const taskId = 'task-20250109-123456';
      const taskPath = path.join(commDir, agent, taskId);
      
      const connection = {
        id: 'test-conn-1',
        agent,
        startTime: new Date(),
        metadata: { taskId }
      };

      const updates = [{
        step: 1,
        status: 'COMPLETE' as const,
        description: 'Setup complete'
      }];

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === taskPath) return Promise.resolve(true);
        if (p === path.join(taskPath, 'INIT.md')) return Promise.resolve(true);
        if (p === path.join(taskPath, 'PLAN.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.readFile.mockResolvedValue('# Plan\n- [ ] Step 1');
      mockedFs.writeFile.mockResolvedValue();

      const result = await taskContextManager.reportProgress(updates, connection);
      
      expect(result.success).toBe(true);
      expect(result.updatedSteps).toBe(1);
    });

    it('should reject progress reporting when agent does not own task', async () => {
      const ownerAgent = 'backend-engineer';
      const attemptingAgent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';
      
      const connection = {
        id: 'test-conn-1',
        agent: attemptingAgent,
        startTime: new Date(),
        metadata: { taskId }
      };

      const updates = [{
        step: 1,
        status: 'COMPLETE' as const,
        description: 'Setup complete'
      }];

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === path.join(commDir, ownerAgent, taskId)) return Promise.resolve(true);
        if (p === path.join(commDir, attemptingAgent, taskId)) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      await expect(
        taskContextManager.reportProgress(updates, connection)
      ).rejects.toThrow(AgentOwnershipError);
    });
  });

  describe('markComplete with ownership validation', () => {
    it('should allow task completion when agent owns task', async () => {
      const agent = 'backend-engineer';
      const taskId = 'task-20250109-123456';
      const taskPath = path.join(commDir, agent, taskId);
      
      const connection = {
        id: 'test-conn-1',
        agent,
        startTime: new Date(),
        metadata: { taskId }
      };

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === taskPath) return Promise.resolve(true);
        if (p === path.join(taskPath, 'INIT.md')) return Promise.resolve(true);
        if (p === path.join(taskPath, 'PLAN.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.readFile.mockResolvedValue('# Plan\n- [x] All steps complete');
      mockedFs.writeFile.mockResolvedValue();

      const result = await taskContextManager.markComplete('DONE', 'Task completed successfully', connection);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('DONE');
    });

    it('should reject task completion when agent does not own task', async () => {
      const ownerAgent = 'backend-engineer';
      const attemptingAgent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';
      
      const connection = {
        id: 'test-conn-1',
        agent: attemptingAgent,
        startTime: new Date(),
        metadata: { taskId }
      };

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === path.join(commDir, ownerAgent, taskId)) return Promise.resolve(true);
        if (p === path.join(commDir, attemptingAgent, taskId)) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      await expect(
        taskContextManager.markComplete('DONE', 'Task completed', connection)
      ).rejects.toThrow(AgentOwnershipError);
    });
  });

  describe('getTaskContext with ownership validation', () => {
    it('should return task context when agent owns task', async () => {
      const agent = 'backend-engineer';
      const taskId = 'task-20250109-123456';
      const taskPath = path.join(commDir, agent, taskId);
      
      const connection = {
        id: 'test-conn-1',
        agent,
        startTime: new Date(),
        metadata: {}
      };

      const initContent = `# Task: Implement Feature X

## Objective
Implement the new feature X with proper testing

## Requirements
- Requirement 1
- Requirement 2
- Requirement 3

## Additional Context
This is a high-priority task for the current sprint.`;

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === taskPath) return Promise.resolve(true);
        if (p === path.join(taskPath, 'INIT.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.readFile.mockResolvedValue(initContent);

      const context = await taskContextManager.getTaskContext(taskId, connection);
      
      expect(context.title).toBe('Implement Feature X');
      expect(context.objective).toBe('Implement the new feature X with proper testing');
      expect(context.requirements).toHaveLength(3);
    });

    it('should return error context when agent does not own task', async () => {
      const ownerAgent = 'backend-engineer';
      const attemptingAgent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';
      
      const connection = {
        id: 'test-conn-1',
        agent: attemptingAgent,
        startTime: new Date(),
        metadata: {}
      };

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === path.join(commDir, ownerAgent, taskId)) return Promise.resolve(true);
        if (p === path.join(commDir, attemptingAgent, taskId)) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      const context = await taskContextManager.getTaskContext(taskId, connection);
      
      expect(context.title).toBe('Task Not Found');
      expect(context.additionalContext).toContain('not found or not accessible');
      expect(context.additionalContext).toContain(taskId);
    });
  });

  describe('Default Agent Prevention', () => {
    it('should reject operations with default-agent', async () => {
      const connection = {
        id: 'test-conn-1',
        agent: 'default-agent',
        startTime: new Date(),
        metadata: { taskId: 'some-task' }
      };

      await expect(
        taskContextManager.submitPlan('# Plan', connection)
      ).rejects.toThrow(
        "Invalid agent specification: 'default-agent' is not allowed. Please specify the actual agent name."
      );
    });

    it('should provide clear error message for missing agent', async () => {
      const connection = {
        id: 'test-conn-1',
        agent: '',
        startTime: new Date(),
        metadata: { taskId: 'some-task' }
      };

      await expect(
        taskContextManager.submitPlan('# Plan', connection)
      ).rejects.toThrow(
        "Agent name is required. Please specify the agent performing this operation."
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility for valid agent operations', async () => {
      const agent = 'backend-engineer';
      const taskId = 'task-20250109-123456';
      const taskPath = path.join(commDir, agent, taskId);
      
      // Test without taskId in metadata (backward compatibility)
      const connection = {
        id: 'test-conn-1',
        agent,
        startTime: new Date(),
        metadata: {}
      };

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === path.join(commDir, agent)) return Promise.resolve(true);
        if (p === taskPath) return Promise.resolve(true);
        if (p === path.join(taskPath, 'INIT.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockedFs.readdir.mockResolvedValue([taskId]);
      
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date()
      } as any);

      mockedFs.writeFile.mockResolvedValue();

      // Should find the task in agent's directory
      const validPlan = `# Implementation Plan
      
## Phase 1: Setup
- [ ] Initialize project
- [ ] Configure settings`;
      
      const result = await taskContextManager.submitPlan(validPlan, connection);
      expect(result.success).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    it('should log all ownership validation attempts with details', async () => {
      const agent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';
      const taskPath = path.join(commDir, agent, taskId);

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === taskPath) return Promise.resolve(true);
        if (p === path.join(taskPath, 'INIT.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      await taskContextManager.validateAgentOwnership(taskId, agent);

      expect(eventLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validate_ownership',
          agent,
          taskId,
          success: true,
          metadata: expect.objectContaining({
            taskPath,
            validationResult: 'authorized'
          })
        })
      );
    });

    it('should log ownership violation attempts with security flag', async () => {
      const ownerAgent = 'backend-engineer';
      const attemptingAgent = 'frontend-engineer';
      const taskId = 'task-20250109-123456';

      mockedFs.pathExists.mockImplementation((p: string) => {
        if (p === path.join(commDir, ownerAgent, taskId)) return Promise.resolve(true);
        if (p === path.join(commDir, attemptingAgent, taskId)) return Promise.resolve(false);
        return Promise.resolve(false);
      });

      await expect(
        taskContextManager.validateAgentOwnership(taskId, attemptingAgent)
      ).rejects.toThrow();

      expect(eventLogger.logOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'validate_ownership',
          agent: attemptingAgent,
          taskId,
          success: false,
          metadata: expect.objectContaining({
            validationResult: 'unauthorized',
            securityFlag: 'ownership_violation'
          })
        })
      );
    });
  });
});