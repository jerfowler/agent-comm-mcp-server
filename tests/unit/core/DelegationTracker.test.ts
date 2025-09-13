/**
 * Unit tests for DelegationTracker class
 * Tests delegation pattern detection for addressing Issue #12
 */

import { jest } from '@jest/globals';
import { DelegationTracker } from '../../../src/core/DelegationTracker.js';
import type { 
  DelegationRecord,
  ServerConfig 
} from '../../../src/types.js';
import type { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import type { EventLogger } from '../../../src/logging/EventLogger.js';
import * as fs from '../../../src/utils/fs-extra-safe.js';
import * as path from 'path';

// Mock fs-extra-safe
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  ensureDir: jest.fn(),
  readJson: jest.fn(),
  writeJson: jest.fn(),
  remove: jest.fn(),
  readdir: jest.fn()
}));

describe('DelegationTracker', () => {
  let delegationTracker: DelegationTracker;
  let mockConfig: ServerConfig;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      commDir: './comm',
      archiveDir: './comm/.archive',
      logDir: './comm/.logs',
      enableArchiving: true,
      connectionManager: {} as unknown as ConnectionManager,
      eventLogger: {} as unknown as EventLogger
    } as ServerConfig;

    // Default mock implementations
    mockFs.pathExists.mockResolvedValue(false);
    mockFs.ensureDir.mockResolvedValue(undefined);
    mockFs.readJson.mockResolvedValue({});
    mockFs.writeJson.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);

    // Create DelegationTracker instance
    delegationTracker = new DelegationTracker(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(delegationTracker).toBeDefined();
      expect(delegationTracker).toBeInstanceOf(DelegationTracker);
    });

    it('should ensure delegation tracking directory exists on initialization', async () => {
      // Act
      await delegationTracker.initialize();

      // Assert
      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, '.delegations')
      );
    });
  });

  describe('recordDelegationCreated', () => {
    it('should record a new delegation task', async () => {
      // Arrange
      const taskId = '2025-01-10T10-00-00-test-delegation';
      const targetAgent = 'senior-backend-engineer';

      // Act
      await delegationTracker.recordDelegationCreated(taskId, targetAgent);

      // Assert
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, '.delegations', `${taskId}.json`),
        expect.objectContaining({
          taskId,
          targetAgent,
          taskToolInvoked: false,
          subagentStarted: false,
          completionStatus: 'pending'
        }),
        { spaces: 2 }
      );
    });

    it('should set createdAt timestamp', async () => {
      // Arrange
      const taskId = 'test-task';
      const targetAgent = 'test-agent';
      const beforeTime = Date.now();

      // Act
      await delegationTracker.recordDelegationCreated(taskId, targetAgent);

      // Assert
      const afterTime = Date.now();
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          createdAt: expect.any(Date)
        }),
        expect.any(Object)
      );

      // Verify timestamp is within expected range
      const callArgs = (mockFs.writeJson as jest.Mock).mock.calls[0][1] as DelegationRecord;
      const timestamp = new Date(callArgs.createdAt).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should not overwrite existing delegation record', async () => {
      // Arrange
      const taskId = 'existing-delegation';
      const existingRecord: DelegationRecord = {
        taskId,
        targetAgent: 'original-agent',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
        taskToolInvoked: true,
        subagentStarted: true,
        completionStatus: 'complete'
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(existingRecord);

      // Act
      await delegationTracker.recordDelegationCreated(taskId, 'new-agent');

      // Assert
      expect(mockFs.writeJson).not.toHaveBeenCalled();
    });
  });

  describe('recordDelegation', () => {
    it('should record a delegation using DelegationRecord parameter', async () => {
      // Arrange
      const delegationRecord: DelegationRecord = {
        taskId: '2025-01-12T10-00-00-test-task',
        targetAgent: 'senior-backend-engineer',
        createdAt: new Date(),
        taskToolInvoked: true,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      // Act
      await delegationTracker.recordDelegation(delegationRecord);

      // Assert
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, '.delegations', `${delegationRecord.taskId}.json`),
        delegationRecord,
        { spaces: 2 }
      );
    });

    it('should overwrite existing delegation when updating', async () => {
      // Arrange
      const existingRecord: DelegationRecord = {
        taskId: 'existing-task',
        targetAgent: 'original-agent',
        createdAt: new Date(Date.now() - 3600000),
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      const updatedRecord: DelegationRecord = {
        ...existingRecord,
        taskToolInvoked: true,
        subagentStarted: true,
        completionStatus: 'complete'
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(existingRecord);

      // Act
      await delegationTracker.recordDelegation(updatedRecord);

      // Assert
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, '.delegations', `${updatedRecord.taskId}.json`),
        updatedRecord,
        { spaces: 2 }
      );
    });

    it('should handle write errors gracefully', async () => {
      // Arrange
      const delegationRecord: DelegationRecord = {
        taskId: 'error-task',
        targetAgent: 'test-agent',
        createdAt: new Date(),
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      mockFs.writeJson.mockRejectedValue(new Error('Write error'));

      // Act & Assert - Should not throw
      await expect(
        delegationTracker.recordDelegation(delegationRecord)
      ).resolves.not.toThrow();
    });
  });

  describe('recordTaskToolInvoked', () => {
    it('should update delegation record when Task tool is invoked', async () => {
      // Arrange
      const taskId = 'test-delegation';
      const existingRecord: DelegationRecord = {
        taskId,
        targetAgent: 'backend-engineer',
        createdAt: new Date(),
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(existingRecord);

      // Act
      await delegationTracker.recordTaskToolInvoked(taskId);

      // Assert
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          taskToolInvoked: true,
          subagentStarted: true,
          completionStatus: 'complete'
        }),
        { spaces: 2 }
      );
    });

    it('should handle non-existent delegation gracefully', async () => {
      // Arrange
      mockFs.pathExists.mockResolvedValue(false);

      // Act & Assert - Should not throw
      await expect(
        delegationTracker.recordTaskToolInvoked('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('checkIncompleteDelegations', () => {
    it('should return empty array for agent with no delegations', async () => {
      // Arrange
      mockFs.readdir.mockResolvedValue([]);

      // Act
      const incomplete = await delegationTracker.checkIncompleteDelegations('test-agent');

      // Assert
      expect(incomplete).toEqual([]);
    });

    it('should identify incomplete delegations for an agent', async () => {
      // Arrange
      const incompleteDelegation: DelegationRecord = {
        taskId: 'incomplete-task',
        targetAgent: 'backend-engineer',
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      const completeDelegation: DelegationRecord = {
        taskId: 'complete-task',
        targetAgent: 'backend-engineer',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        taskToolInvoked: true,
        subagentStarted: true,
        completionStatus: 'complete'
      };

      // Mock pathExists to return true for delegations directory
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['incomplete-task.json', 'complete-task.json']);
      mockFs.readJson
        .mockResolvedValueOnce(incompleteDelegation)
        .mockResolvedValueOnce(completeDelegation);

      // Act
      const incomplete = await delegationTracker.checkIncompleteDelegations('test-agent');

      // Assert
      expect(incomplete).toHaveLength(1);
      expect(incomplete[0].taskId).toBe('incomplete-task');
    });

    it('should only return delegations older than 10 minutes', async () => {
      // Arrange
      const recentDelegation: DelegationRecord = {
        taskId: 'recent-task',
        targetAgent: 'backend-engineer',
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      const oldDelegation: DelegationRecord = {
        taskId: 'old-task',
        targetAgent: 'backend-engineer',
        createdAt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      // Mock pathExists to return true for delegations directory
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['recent-task.json', 'old-task.json']);
      mockFs.readJson
        .mockResolvedValueOnce(recentDelegation)
        .mockResolvedValueOnce(oldDelegation);

      // Act
      const incomplete = await delegationTracker.checkIncompleteDelegations('test-agent');

      // Assert
      expect(incomplete).toHaveLength(1);
      expect(incomplete[0].taskId).toBe('old-task');
    });

    it('should handle abandoned delegations', async () => {
      // Arrange
      const abandonedDelegation: DelegationRecord = {
        taskId: 'abandoned-task',
        targetAgent: 'backend-engineer',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'abandoned'
      };

      mockFs.readdir.mockResolvedValue(['abandoned-task.json']);
      mockFs.readJson.mockResolvedValue(abandonedDelegation);

      // Act
      const incomplete = await delegationTracker.checkIncompleteDelegations('test-agent');

      // Assert
      expect(incomplete).toHaveLength(0); // Abandoned tasks are not returned as incomplete
    });
  });

  describe('generateDelegationReminder', () => {
    it('should generate reminder for agent with incomplete delegations', async () => {
      // Arrange
      const incompleteDelegations = [
        {
          taskId: 'task-1',
          targetAgent: 'backend-engineer',
          createdAt: new Date(Date.now() - 30 * 60 * 1000),
          taskToolInvoked: false,
          subagentStarted: false,
          completionStatus: 'pending' as const
        },
        {
          taskId: 'task-2',
          targetAgent: 'frontend-engineer',
          createdAt: new Date(Date.now() - 45 * 60 * 1000),
          taskToolInvoked: false,
          subagentStarted: false,
          completionStatus: 'pending' as const
        }
      ];

      jest.spyOn(delegationTracker, 'checkIncompleteDelegations')
        .mockResolvedValue(incompleteDelegations);

      // Act
      const reminder = await delegationTracker.generateDelegationReminder('test-agent');

      // Assert
      expect(reminder).toContain('⚠️ You have 2 incomplete delegations');
      expect(reminder).toContain('task-1');
      expect(reminder).toContain('task-2');
      expect(reminder).toContain('Task tool');
    });

    it('should escalate reminder for very old delegations', async () => {
      // Arrange
      const veryOldDelegation = [
        {
          taskId: 'ancient-task',
          targetAgent: 'backend-engineer',
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
          taskToolInvoked: false,
          subagentStarted: false,
          completionStatus: 'pending' as const
        }
      ];

      jest.spyOn(delegationTracker, 'checkIncompleteDelegations')
        .mockResolvedValue(veryOldDelegation);

      // Act
      const reminder = await delegationTracker.generateDelegationReminder('test-agent');

      // Assert
      expect(reminder).toContain('🚨 CRITICAL');
      expect(reminder).toContain('3 hours ago');
    });

    it('should return empty string for agent with no incomplete delegations', async () => {
      // Arrange
      jest.spyOn(delegationTracker, 'checkIncompleteDelegations')
        .mockResolvedValue([]);

      // Act
      const reminder = await delegationTracker.generateDelegationReminder('test-agent');

      // Assert
      expect(reminder).toBe('');
    });
  });

  describe('generateTaskToolInvocation', () => {
    it('should generate proper Task tool invocation command', () => {
      // Act
      const command = delegationTracker.generateTaskToolInvocation(
        'backend-engineer',
        '2025-01-10T10-00-00-fix-bugs',
        'Fix critical bugs in the authentication system'
      );

      // Assert
      expect(command).toContain('Task(');
      expect(command).toContain('subagent_type="backend-engineer"');
      expect(command).toContain('2025-01-10T10-00-00-fix-bugs');
      expect(command).toContain('mcp__agent_comm__check_tasks');
      expect(command).toContain('Fix critical bugs');
    });

    it('should escape quotes in task content', () => {
      // Act
      const command = delegationTracker.generateTaskToolInvocation(
        'test-agent',
        'test-task',
        'Task with "quoted" content and \'single quotes\''
      );

      // Assert
      expect(command).toContain('Task with \\"quoted\\" content');
      expect(command).not.toContain('Task with "quoted" content'); // Original quotes should be escaped
    });
  });

  describe('markDelegationAbandoned', () => {
    it('should mark old incomplete delegations as abandoned', async () => {
      // Arrange
      const oldDelegation: DelegationRecord = {
        taskId: 'old-task',
        targetAgent: 'backend-engineer',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        taskToolInvoked: false,
        subagentStarted: false,
        completionStatus: 'pending'
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(oldDelegation);

      // Act
      await delegationTracker.markDelegationAbandoned('old-task');

      // Assert
      expect(mockFs.writeJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          completionStatus: 'abandoned'
        }),
        { spaces: 2 }
      );
    });
  });

  describe('getDelegationStats', () => {
    it('should calculate delegation statistics for an agent', async () => {
      // Arrange
      const delegations: DelegationRecord[] = [
        {
          taskId: 'complete-1',
          targetAgent: 'backend-engineer',
          createdAt: new Date(),
          taskToolInvoked: true,
          subagentStarted: true,
          completionStatus: 'complete'
        },
        {
          taskId: 'complete-2',
          targetAgent: 'backend-engineer',
          createdAt: new Date(),
          taskToolInvoked: true,
          subagentStarted: true,
          completionStatus: 'complete'
        },
        {
          taskId: 'pending-1',
          targetAgent: 'backend-engineer',
          createdAt: new Date(),
          taskToolInvoked: false,
          subagentStarted: false,
          completionStatus: 'pending'
        },
        {
          taskId: 'abandoned-1',
          targetAgent: 'backend-engineer',
          createdAt: new Date(),
          taskToolInvoked: false,
          subagentStarted: false,
          completionStatus: 'abandoned'
        }
      ];

      // Mock pathExists to return true for delegations directory
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(delegations.map(d => `${d.taskId}.json`));
      // Need to mock readJson twice for each delegation (once for initial load, once for stats)
      for (const delegation of delegations) {
        mockFs.readJson.mockResolvedValueOnce(delegation);
      }
      for (const delegation of delegations) {
        mockFs.readJson.mockResolvedValueOnce(delegation);
      }

      // Act - use the agent name from the delegations
      const stats = await delegationTracker.getDelegationStats('backend-engineer');

      // Assert
      expect(stats).toEqual({
        totalDelegations: 4,
        completedDelegations: 2,
        pendingDelegations: 1,
        abandonedDelegations: 1,
        completionRate: 50,
        averageCompletionTime: expect.any(Number)
      });
    });
  });

  describe('cleanupOldDelegations', () => {
    it.skip('should remove delegation records older than 7 days', async () => {
      // Arrange
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);

      const oldDelegation: DelegationRecord = {
        taskId: 'old-delegation',
        targetAgent: 'test-agent',
        createdAt: oldDate,
        taskToolInvoked: true,
        subagentStarted: true,
        completionStatus: 'complete'
      };

      // Mock pathExists to return true for delegations directory
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readdir.mockResolvedValue(['old-delegation.json'] as unknown as string[]);
      mockFs.readJson.mockResolvedValue(oldDelegation);
      mockFs.remove.mockResolvedValue(undefined);

      // Act
      await delegationTracker.cleanupOldDelegations();

      // Assert
      expect(mockFs.remove).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, '.delegations', 'old-delegation.json')
      );
    });

    it('should keep recent delegation records', async () => {
      // Arrange
      const recentDelegation: DelegationRecord = {
        taskId: 'recent-delegation',
        targetAgent: 'test-agent',
        createdAt: new Date(),
        taskToolInvoked: true,
        subagentStarted: true,
        completionStatus: 'complete'
      };

      mockFs.readdir.mockResolvedValue(['recent-delegation.json']);
      mockFs.readJson.mockResolvedValue(recentDelegation);

      // Act
      await delegationTracker.cleanupOldDelegations();

      // Assert
      expect(mockFs.remove).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Arrange
      mockFs.readJson.mockRejectedValue(new Error('File read error'));
      mockFs.readdir.mockResolvedValue(['error-task.json']);

      // Act
      const incomplete = await delegationTracker.checkIncompleteDelegations('test-agent');

      // Assert
      expect(incomplete).toEqual([]);
    });

    it('should handle file write errors gracefully', async () => {
      // Arrange
      mockFs.writeJson.mockRejectedValue(new Error('File write error'));

      // Act & Assert - Should not throw
      await expect(
        delegationTracker.recordDelegationCreated('test-task', 'test-agent')
      ).resolves.not.toThrow();
    });

    it('should handle directory read errors gracefully', async () => {
      // Arrange
      mockFs.readdir.mockRejectedValue(new Error('Directory read error'));

      // Act
      const incomplete = await delegationTracker.checkIncompleteDelegations('test-agent');

      // Assert
      expect(incomplete).toEqual([]);
    });
  });
});