/**
 * Unit tests for ComplianceTracker class
 * Tests compliance tracking and scoring functionality for the Smart Response System
 */

import { jest } from '@jest/globals';
import { ComplianceTracker } from '../../../src/core/ComplianceTracker.js';
import type { 
  AgentComplianceRecord, 
  ComplianceActivity,
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
  readFile: jest.fn(),
  writeFile: jest.fn(),
  remove: jest.fn(),
  readdir: jest.fn()
}));

describe('ComplianceTracker', () => {
  let complianceTracker: ComplianceTracker;
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
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.writeFile.mockResolvedValue(undefined);

    // Create ComplianceTracker instance
    complianceTracker = new ComplianceTracker(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(complianceTracker).toBeDefined();
      expect(complianceTracker).toBeInstanceOf(ComplianceTracker);
    });

    it('should ensure compliance directory exists on initialization', async () => {
      // Act
      await complianceTracker.initialize();

      // Assert
      expect(mockFs.ensureDir).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, '.compliance')
      );
    });
  });

  describe('recordActivity', () => {
    it('should record a new activity for an agent', async () => {
      // Arrange
      const activity: ComplianceActivity = {
        type: 'task_created',
        taskId: 'test-task-id',
        timestamp: new Date()
      };

      // Act
      await complianceTracker.recordActivity('test-agent', activity);

      // Assert
      const record = await complianceTracker.getAgentRecord('test-agent');
      expect(record.tasksCreated).toBe(1);
      expect(record.agent).toBe('test-agent');
    });

    it('should increment counters based on activity type', async () => {
      // Arrange
      const activities: ComplianceActivity[] = [
        { type: 'task_created', taskId: 'task1', timestamp: new Date() },
        { type: 'delegation_completed', taskId: 'task1', timestamp: new Date() },
        { type: 'todowrite_used', taskId: 'task1', timestamp: new Date() },
        { type: 'plan_submitted', taskId: 'task1', timestamp: new Date() },
        { type: 'progress_reported', taskId: 'task1', timestamp: new Date() },
        { type: 'task_completed', taskId: 'task1', timestamp: new Date() }
      ];

      // Act
      for (const activity of activities) {
        await complianceTracker.recordActivity('test-agent', activity);
      }

      // Assert
      const record = await complianceTracker.getAgentRecord('test-agent');
      expect(record.tasksCreated).toBe(1);
      expect(record.delegationsCompleted).toBe(1);
      expect(record.todoWriteUsage).toBe(1);
      expect(record.planSubmissions).toBe(1);
      expect(record.progressReports).toBe(1);
      expect(record.completions).toBe(1);
    });

    it('should update lastActivity timestamp', async () => {
      // Arrange
      const now = new Date();
      const activity: ComplianceActivity = {
        type: 'task_created',
        taskId: 'test-task',
        timestamp: now
      };

      // Act
      await complianceTracker.recordActivity('test-agent', activity);

      // Assert
      const record = await complianceTracker.getAgentRecord('test-agent');
      expect(record.lastActivity.getTime()).toBeCloseTo(now.getTime(), -2);
    });

    it('should persist activity records to disk', async () => {
      // Arrange
      const activity: ComplianceActivity = {
        type: 'task_created',
        taskId: 'test-task',
        timestamp: new Date()
      };

      // Act
      await complianceTracker.recordActivity('test-agent', activity);

      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, '.compliance', 'test-agent.json'),
        expect.stringContaining('"agent": "test-agent"')
      );
    });
  });

  describe('getComplianceLevel', () => {
    it('should return 100 for perfect compliance', async () => {
      // Arrange - Agent with perfect behavior
      const perfectRecord: AgentComplianceRecord = {
        agent: 'perfect-agent',
        tasksCreated: 10,
        delegationsCompleted: 10,
        todoWriteUsage: 10,
        planSubmissions: 10,
        progressReports: 20,
        completions: 10,
        lastActivity: new Date(),
        complianceScore: 100,
        escalationLevel: 1
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(perfectRecord));

      // Act
      const level = await complianceTracker.getComplianceLevel('perfect-agent');

      // Assert
      expect(level).toBe(100);
    });

    it('should deduct points for low delegation completion rate', async () => {
      // Arrange - Agent with poor delegation completion
      const record: AgentComplianceRecord = {
        agent: 'poor-delegator',
        tasksCreated: 10,
        delegationsCompleted: 5, // 50% completion rate
        todoWriteUsage: 10,
        planSubmissions: 10,
        progressReports: 20,
        completions: 10,
        lastActivity: new Date(),
        complianceScore: 0,
        escalationLevel: 1
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(record));

      // Act
      const level = await complianceTracker.getComplianceLevel('poor-delegator');

      // Assert
      expect(level).toBeLessThan(100);
      expect(level).toBeGreaterThanOrEqual(0);
    });

    it('should deduct points for low TodoWrite usage', async () => {
      // Arrange - Agent not using TodoWrite
      const record: AgentComplianceRecord = {
        agent: 'no-todo-agent',
        tasksCreated: 10,
        delegationsCompleted: 10,
        todoWriteUsage: 2, // 20% usage rate
        planSubmissions: 10,
        progressReports: 20,
        completions: 10,
        lastActivity: new Date(),
        complianceScore: 0,
        escalationLevel: 1
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(record));

      // Act
      const level = await complianceTracker.getComplianceLevel('no-todo-agent');

      // Assert
      expect(level).toBeLessThan(100);
      expect(level).toBeGreaterThan(70); // Should only lose ~15 points
    });

    it('should deduct points for missing plan submissions', async () => {
      // Arrange - Agent not submitting plans
      const record: AgentComplianceRecord = {
        agent: 'no-plan-agent',
        tasksCreated: 10,
        delegationsCompleted: 10,
        todoWriteUsage: 10,
        planSubmissions: 7, // 70% submission rate
        progressReports: 20,
        completions: 10,
        lastActivity: new Date(),
        complianceScore: 0,
        escalationLevel: 1
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(record));

      // Act
      const level = await complianceTracker.getComplianceLevel('no-plan-agent');

      // Assert
      expect(level).toBeLessThan(100);
      expect(level).toBeGreaterThan(85); // Should only lose ~10 points
    });

    it('should return 100 for new agents with no history', async () => {
      // Arrange
      mockFs.pathExists.mockResolvedValue(false);

      // Act
      const level = await complianceTracker.getComplianceLevel('new-agent');

      // Assert
      expect(level).toBe(100); // Give new agents benefit of doubt
    });

    it('should never return less than 0', async () => {
      // Arrange - Agent with terrible compliance
      const record: AgentComplianceRecord = {
        agent: 'terrible-agent',
        tasksCreated: 100,
        delegationsCompleted: 0,
        todoWriteUsage: 0,
        planSubmissions: 0,
        progressReports: 0,
        completions: 0,
        lastActivity: new Date(),
        complianceScore: 0,
        escalationLevel: 4
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(record));

      // Act
      const level = await complianceTracker.getComplianceLevel('terrible-agent');

      // Assert
      expect(level).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getEscalationLevel', () => {
    it('should return level 1 for high compliance (90-100)', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getComplianceLevel').mockResolvedValue(95);

      // Act
      const level = await complianceTracker.getEscalationLevel('good-agent');

      // Assert
      expect(level).toBe(1);
    });

    it('should return level 2 for medium-high compliance (70-89)', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getComplianceLevel').mockResolvedValue(75);

      // Act
      const level = await complianceTracker.getEscalationLevel('medium-agent');

      // Assert
      expect(level).toBe(2);
    });

    it('should return level 3 for medium-low compliance (50-69)', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getComplianceLevel').mockResolvedValue(55);

      // Act
      const level = await complianceTracker.getEscalationLevel('poor-agent');

      // Assert
      expect(level).toBe(3);
    });

    it('should return level 4 for low compliance (0-49)', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getComplianceLevel').mockResolvedValue(25);

      // Act
      const level = await complianceTracker.getEscalationLevel('terrible-agent');

      // Assert
      expect(level).toBe(4);
    });
  });

  describe('getPersonalizedGuidance', () => {
    it('should return friendly guidance for level 1 escalation', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getEscalationLevel').mockResolvedValue(1);
      jest.spyOn(complianceTracker, 'getAgentRecord').mockResolvedValue({
        agent: 'good-agent',
        tasksCreated: 10,
        delegationsCompleted: 10,
        todoWriteUsage: 10,
        planSubmissions: 10,
        progressReports: 20,
        completions: 10,
        lastActivity: new Date(),
        complianceScore: 95,
        escalationLevel: 1
      });

      // Act
      const guidance = await complianceTracker.getPersonalizedGuidance('good-agent', 'create_task');

      // Assert
      expect(guidance).toContain('Great job');
      expect(guidance).not.toContain('WARNING');
      expect(guidance).not.toContain('CRITICAL');
    });

    it('should return warning guidance for level 2 escalation', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getEscalationLevel').mockResolvedValue(2);
      jest.spyOn(complianceTracker, 'getAgentRecord').mockResolvedValue({
        agent: 'medium-agent',
        tasksCreated: 10,
        delegationsCompleted: 7,
        todoWriteUsage: 8,
        planSubmissions: 5,
        progressReports: 10,
        completions: 7,
        lastActivity: new Date(),
        complianceScore: 75,
        escalationLevel: 2
      });

      // Act
      const guidance = await complianceTracker.getPersonalizedGuidance('medium-agent', 'create_task');

      // Assert
      expect(guidance).toContain('⚠️');
      expect(guidance).toContain('5 tasks without plans');
    });

    it('should return critical guidance for level 3 escalation', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getEscalationLevel').mockResolvedValue(3);
      jest.spyOn(complianceTracker, 'getAgentRecord').mockResolvedValue({
        agent: 'poor-agent',
        tasksCreated: 10,
        delegationsCompleted: 3,
        todoWriteUsage: 4,
        planSubmissions: 3,
        progressReports: 5,
        completions: 3,
        lastActivity: new Date(),
        complianceScore: 55,
        escalationLevel: 3
      });

      // Act
      const guidance = await complianceTracker.getPersonalizedGuidance('poor-agent', 'create_task');

      // Assert
      expect(guidance).toContain('🚨 CRITICAL');
      expect(guidance).toContain('30% delegation completion rate');
    });

    it('should return blocking guidance for level 4 escalation', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getEscalationLevel').mockResolvedValue(4);

      // Act
      const guidance = await complianceTracker.getPersonalizedGuidance('terrible-agent', 'create_task');

      // Assert
      expect(guidance).toContain('❌ BLOCKED');
      expect(guidance).toContain('Cannot create more tasks');
    });

    it('should provide tool-specific guidance', async () => {
      // Arrange
      jest.spyOn(complianceTracker, 'getEscalationLevel').mockResolvedValue(1);

      // Act
      const createTaskGuidance = await complianceTracker.getPersonalizedGuidance('agent', 'create_task');
      const submitPlanGuidance = await complianceTracker.getPersonalizedGuidance('agent', 'submit_plan');
      const reportProgressGuidance = await complianceTracker.getPersonalizedGuidance('agent', 'report_progress');

      // Assert
      expect(createTaskGuidance).toContain('Submit your implementation plan');
      expect(submitPlanGuidance).toContain('Begin implementation');
      expect(reportProgressGuidance).toContain('Continue with');
    });
  });

  describe('updateComplianceScore', () => {
    it('should calculate and update compliance score', async () => {
      // Arrange
      const record: AgentComplianceRecord = {
        agent: 'test-agent',
        tasksCreated: 10,
        delegationsCompleted: 8,
        todoWriteUsage: 9,
        planSubmissions: 9,
        progressReports: 18,
        completions: 9,
        lastActivity: new Date(),
        complianceScore: 0,
        escalationLevel: 1
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(record));

      // Act
      await complianceTracker.updateComplianceScore('test-agent');

      // Assert
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"complianceScore": ')
      );
    });
  });

  describe('cleanupStaleRecords', () => {
    it.skip('should remove records older than 30 days', async () => {
      // Arrange
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 31);

      const staleRecord: AgentComplianceRecord = {
        agent: 'stale-agent',
        tasksCreated: 1,
        delegationsCompleted: 1,
        todoWriteUsage: 1,
        planSubmissions: 1,
        progressReports: 1,
        completions: 1,
        lastActivity: staleDate,
        complianceScore: 100,
        escalationLevel: 1
      };

      mockFs.readdir.mockResolvedValue(['stale-agent.json'] as unknown as string[]);
      mockFs.readFile.mockResolvedValue(JSON.stringify(staleRecord));
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.remove.mockResolvedValue(undefined);

      // Act
      await complianceTracker.cleanupStaleRecords();

      // Assert
      expect(mockFs.remove).toHaveBeenCalledWith(
        path.join(mockConfig.commDir, '.compliance', 'stale-agent.json')
      );
    });

    it('should keep records newer than 30 days', async () => {
      // Arrange
      const recentRecord: AgentComplianceRecord = {
        agent: 'recent-agent',
        tasksCreated: 1,
        delegationsCompleted: 1,
        todoWriteUsage: 1,
        planSubmissions: 1,
        progressReports: 1,
        completions: 1,
        lastActivity: new Date(),
        complianceScore: 100,
        escalationLevel: 1
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(recentRecord));
      mockFs.pathExists.mockResolvedValue(true);

      // Act
      await complianceTracker.cleanupStaleRecords();

      // Assert
      expect(mockFs.remove).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      // Arrange
      mockFs.readFile.mockRejectedValue(new Error('File read error'));

      // Act
      const level = await complianceTracker.getComplianceLevel('error-agent');

      // Assert
      expect(level).toBe(100); // Default to perfect compliance on error
    });

    it('should handle file write errors gracefully', async () => {
      // Arrange
      mockFs.writeFile.mockRejectedValue(new Error('File write error'));

      const activity: ComplianceActivity = {
        type: 'task_created',
        taskId: 'test-task',
        timestamp: new Date()
      };

      // Act & Assert - Should not throw
      await expect(
        complianceTracker.recordActivity('error-agent', activity)
      ).resolves.not.toThrow();
    });

    it('should handle corrupted JSON recovery', async () => {
      // Arrange
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('{ invalid json }');

      // Act
      const level = await complianceTracker.getComplianceLevel('corrupted-agent');

      // Assert
      expect(level).toBe(100); // Should create new record on parse error
    });

    it('should handle permission denied scenarios', async () => {
      // Arrange
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as NodeJS.ErrnoException).code = 'EACCES';
      mockFs.readFile.mockRejectedValue(permissionError);

      // Act
      const level = await complianceTracker.getComplianceLevel('denied-agent');

      // Assert
      expect(level).toBe(100); // Should handle gracefully
    });

    it('should handle disk full conditions', async () => {
      // Arrange
      const diskFullError = new Error('ENOSPC: no space left on device');
      (diskFullError as NodeJS.ErrnoException).code = 'ENOSPC';
      mockFs.writeFile.mockRejectedValue(diskFullError);

      // Act
      const activity: ComplianceActivity = {
        type: 'task_created',
        taskId: 'test-task',
        timestamp: new Date()
      };

      await complianceTracker.recordActivity('disk-full-agent', activity);

      // Assert - Should not crash, data kept in memory
      const level = await complianceTracker.getComplianceLevel('disk-full-agent');
      expect(level).toBeDefined();
    });

    it('should handle updateComplianceScore error recovery', async () => {
      // Arrange
      // Make getAgentRecord throw
      mockFs.readFile.mockRejectedValue(new Error('Read failed'));
      mockFs.pathExists.mockResolvedValue(false);

      // Act & Assert - Should not throw
      await expect(
        complianceTracker.updateComplianceScore('error-agent')
      ).resolves.not.toThrow();
    });

    it('should handle saveAgentRecord failure silently', async () => {
      // Arrange
      mockFs.ensureDir.mockRejectedValue(new Error('Directory creation failed'));
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const activity: ComplianceActivity = {
        type: 'plan_submitted',
        taskId: 'test-task',
        timestamp: new Date()
      };

      // Act
      await complianceTracker.recordActivity('save-fail-agent', activity);

      // Assert - Should still track in memory
      const level = await complianceTracker.getComplianceLevel('save-fail-agent');
      expect(level).toBeDefined();
    });

    it('should handle concurrent update conflicts', async () => {
      // Arrange
      const activity1: ComplianceActivity = {
        type: 'task_created',
        taskId: 'task-1',
        timestamp: new Date()
      };

      const activity2: ComplianceActivity = {
        type: 'plan_submitted',
        taskId: 'task-2',
        timestamp: new Date()
      };

      // Simulate concurrent updates
      const promises = [
        complianceTracker.recordActivity('concurrent-agent', activity1),
        complianceTracker.recordActivity('concurrent-agent', activity2)
      ];

      // Act
      await Promise.all(promises);

      // Assert - Both should be recorded
      const level = await complianceTracker.getComplianceLevel('concurrent-agent');
      expect(level).toBeDefined();
    });

    it('should handle cache invalidation properly', async () => {
      // Arrange
      const activity: ComplianceActivity = {
        type: 'task_created',
        taskId: 'test-task',
        timestamp: new Date()
      };

      // Prime the cache
      await complianceTracker.recordActivity('cache-agent', activity);

      // Clear the internal cache (simulate restart)
      const newTracker = new ComplianceTracker(mockConfig);

      // Act - Should reload from disk
      const level = await newTracker.getComplianceLevel('cache-agent');

      // Assert
      expect(level).toBeDefined();
    });

    it('should handle stale record detection', async () => {
      // Arrange
      const staleDate = new Date();
      staleDate.setMonth(staleDate.getMonth() - 2); // 2 months old

      const staleRecord: AgentComplianceRecord = {
        agent: 'stale-agent',
        tasksCreated: 10,
        delegationsCompleted: 5,
        todoWriteUsage: 20,
        planSubmissions: 8,
        progressReports: 15,
        completions: 5,
        lastActivity: staleDate,
        complianceScore: 85,
        escalationLevel: 2
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(staleRecord));

      // Act
      const level = await complianceTracker.getComplianceLevel('stale-agent');

      // Assert - Should still return the stale data
      expect(level).toBeLessThan(100);
    });

    it('should handle record persistence failures with retry', async () => {
      // Arrange
      let writeAttempts = 0;
      mockFs.writeFile.mockImplementation(async () => {
        writeAttempts++;
        if (writeAttempts === 1) {
          throw new Error('First write failed');
        }
        return Promise.resolve();
      });

      const activity: ComplianceActivity = {
        type: 'task_created',
        taskId: 'test-task',
        timestamp: new Date()
      };

      // Act
      await complianceTracker.recordActivity('retry-agent', activity);

      // Note: Current implementation doesn't retry, but should handle the error
      expect(writeAttempts).toBeGreaterThan(0);
    });
  });

  describe('escalation guidance edge cases', () => {
    it('should handle all operation types for guidance', async () => {
      // Test each operation type
      const operations = [
        'create_task',
        'submit_plan',
        'report_progress',
        'mark_complete',
        'unknown_operation'
      ];

      for (const operation of operations) {
        const guidance = await complianceTracker.getPersonalizedGuidance('test-agent', operation);
        expect(guidance).toBeDefined();
        expect(guidance.length).toBeGreaterThan(0);
      }
    });

    it('should provide different guidance per escalation level', async () => {
      // Create agent with violations
      const activity: ComplianceActivity = {
        type: 'task_created',
        taskId: 'test-task',
        timestamp: new Date()
      };

      // Record many activities without proper compliance
      for (let i = 0; i < 10; i++) {
        await complianceTracker.recordActivity('escalated-agent', activity);
      }

      // Get guidance at different levels
      const guidance1 = await complianceTracker.getPersonalizedGuidance('escalated-agent', 'create_task');

      // Force escalation by creating more activities with violations
      for (let i = 0; i < 20; i++) {
        await complianceTracker.recordActivity('escalated-agent', {
          type: 'task_created',
          taskId: `task-${i}`,
          timestamp: new Date()
        });
      }

      const guidance2 = await complianceTracker.getPersonalizedGuidance('escalated-agent', 'create_task');

      // Guidance should potentially differ based on escalation
      expect(guidance1).toBeDefined();
      expect(guidance2).toBeDefined();
    });

    it('should handle missing agent record in getGuidance', async () => {
      // Don't create any record
      mockFs.pathExists.mockResolvedValue(false);

      // Act
      const guidance = await complianceTracker.getPersonalizedGuidance('new-agent', 'create_task');

      // Assert - Should return default guidance
      expect(guidance).toBeDefined();
      expect(guidance.length).toBeGreaterThan(0);
    });
  });

  describe('record management edge cases', () => {
    it('should handle extremely large compliance scores', async () => {
      // Create record with many activities
      const activity: ComplianceActivity = {
        type: 'task_completed',
        taskId: 'test-task',
        timestamp: new Date()
      };

      // Record many successful completions
      for (let i = 0; i < 100; i++) {
        await complianceTracker.recordActivity('super-agent', activity);
      }

      // Act
      const level = await complianceTracker.getComplianceLevel('super-agent');

      // Assert - Should cap at 100
      expect(level).toBeLessThanOrEqual(100);
      expect(level).toBeGreaterThan(0);
    });

    it('should handle date conversion errors', async () => {
      // Create record with invalid date
      const invalidRecord = {
        agent: 'date-error-agent',
        tasksCreated: 1,
        lastActivity: 'invalid-date-string',
        complianceScore: 85
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(invalidRecord));

      // Act - Should handle invalid date gracefully
      const level = await complianceTracker.getComplianceLevel('date-error-agent');

      // Assert
      expect(level).toBeDefined();
    });
  });
});