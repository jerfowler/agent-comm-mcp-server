/**
 * Unit tests for check-tasks tool
 * Updated for context-based TaskContextManager approach
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { checkTasks } from '../../../src/tools/check-tasks.js';
import * as validation from '../../../src/utils/validation.js';
import { TaskContextManager, TaskSummary } from '../../../src/core/TaskContextManager.js';
import { ServerConfig, InvalidTaskError } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';

// Mock modules
jest.mock('../../../src/utils/validation.js');
jest.mock('../../../src/core/TaskContextManager.js');

const mockValidation = validation as jest.Mocked<typeof validation>;
const MockTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;

describe('Check Tasks Tool', () => {
  let mockConfig: ServerConfig;
  let mockContextManager: jest.Mocked<TaskContextManager>;
  let mockTaskSummaries: TaskSummary[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = testUtils.createMockConfig();
    
    // Create mock TaskSummary objects
    mockTaskSummaries = [
      {
        taskId: 'new-task-1',
        title: 'New Task 1',
        status: 'new'
      },
      {
        taskId: 'active-task-1', 
        title: 'Active Task 1',
        status: 'in_progress',
        progress: {
          completed: 2,
          inProgress: 1,
          pending: 3
        }
      },
      {
        taskId: 'completed-task-1',
        title: 'Completed Task 1', 
        status: 'completed',
        progress: {
          completed: 5,
          inProgress: 0,
          pending: 0
        }
      },
      {
        taskId: 'error-task-1',
        title: 'Error Task 1',
        status: 'error'
      },
      {
        taskId: 'new-task-2',
        title: 'New Task 2',
        status: 'new'
      }
    ];

    // Setup default validation mocks
    mockValidation.validateRequiredString.mockImplementation((value) => value as string);
    
    // Setup TaskContextManager mock
    mockContextManager = {
      checkAssignedTasks: jest.fn<() => Promise<TaskSummary[]>>().mockResolvedValue(mockTaskSummaries)
    } as unknown as jest.Mocked<TaskContextManager>;
    
    MockTaskContextManager.mockImplementation(() => mockContextManager);
  });

  describe('successful check operations', () => {
    it('should check tasks for valid agent and return correct counts with message', async () => {
      const args = { agent: 'test-agent' };
      
      const result = await checkTasks(mockConfig, args);

      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith('test-agent', 'agent');
      expect(MockTaskContextManager).toHaveBeenCalledWith({
        commDir: mockConfig.commDir,
        connectionManager: mockConfig.connectionManager,
        eventLogger: mockConfig.eventLogger
      });
      expect(mockContextManager.checkAssignedTasks).toHaveBeenCalled();
      
      expect(result).toEqual({
        tasks: mockTaskSummaries,
        totalCount: 5,
        newCount: 2, // new-task-1 and new-task-2 
        activeCount: 1, // active-task-1 (status: 'in_progress')
        message: 'Found 5 assigned tasks.'
      });
    });

    it('should handle empty task list', async () => {
      const args = { agent: 'empty-agent' };
      mockContextManager.checkAssignedTasks.mockResolvedValue([]);
      
      const result = await checkTasks(mockConfig, args);

      expect(result).toEqual({
        tasks: [],
        totalCount: 0,
        newCount: 0,
        activeCount: 0,
        message: 'No tasks currently assigned to this agent. Check with other team members or wait for new task assignments.'
      });
    });

    it('should handle tasks with only completed tasks', async () => {
      const completedTaskSummaries = [
        {
          taskId: 'completed-1',
          title: 'Completed Task 1', 
          status: 'completed' as const
        },
        {
          taskId: 'completed-2',
          title: 'Completed Task 2',
          status: 'completed' as const
        }
      ];
      
      const args = { agent: 'completed-agent' };
      mockContextManager.checkAssignedTasks.mockResolvedValue(completedTaskSummaries);
      
      const result = await checkTasks(mockConfig, args);

      expect(result).toEqual({
        tasks: completedTaskSummaries,
        totalCount: 2,
        newCount: 0,
        activeCount: 0,
        message: 'Found 2 assigned tasks.'
      });
    });

    it('should handle tasks with only new tasks', async () => {
      const newTaskSummaries = [
        {
          taskId: 'new-1',
          title: 'New Task 1',
          status: 'new' as const
        },
        {
          taskId: 'new-2', 
          title: 'New Task 2',
          status: 'new' as const
        }
      ];
      
      const args = { agent: 'new-agent' };
      mockContextManager.checkAssignedTasks.mockResolvedValue(newTaskSummaries);
      
      const result = await checkTasks(mockConfig, args);

      expect(result).toEqual({
        tasks: newTaskSummaries,
        totalCount: 2,
        newCount: 2,
        activeCount: 0,
        message: 'Found 2 assigned tasks.'
      });
    });

    it('should correctly identify active tasks (status: in_progress)', async () => {
      const taskSummaries = [
        {
          taskId: 'active-1',
          title: 'Active Task 1',
          status: 'in_progress' as const,
          progress: {
            completed: 2,
            inProgress: 1,
            pending: 2
          }
        },
        {
          taskId: 'active-2', 
          title: 'Active Task 2',
          status: 'in_progress' as const,
          progress: {
            completed: 1,
            inProgress: 0,
            pending: 4
          }
        },
        {
          taskId: 'not-active',
          title: 'Not Active Task',
          status: 'new' as const
        }
      ];
      
      const args = { agent: 'active-agent' };
      mockContextManager.checkAssignedTasks.mockResolvedValue(taskSummaries);
      
      const result = await checkTasks(mockConfig, args);

      expect(result).toEqual({
        tasks: taskSummaries,
        totalCount: 3,
        newCount: 1, // not-active task
        activeCount: 2, // Both active tasks have status 'in_progress'
        message: 'Found 3 assigned tasks.'
      });
    });
  });

  describe('input validation failures', () => {
    it('should propagate validation error for missing agent', async () => {
      const args = {};
      
      mockValidation.validateRequiredString.mockImplementation(() => {
        throw new InvalidTaskError('agent must be a non-empty string', 'agent');
      });
      
      await expect(checkTasks(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
      
      expect(MockTaskContextManager).not.toHaveBeenCalled();
    });

    it('should propagate validation error for empty agent string', async () => {
      const args = { agent: '' };
      
      mockValidation.validateRequiredString.mockImplementation(() => {
        throw new InvalidTaskError('agent must be a non-empty string', 'agent');
      });
      
      await expect(checkTasks(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
      
      expect(MockTaskContextManager).not.toHaveBeenCalled();
    });

    it('should handle null agent parameter', async () => {
      const args = { agent: null };
      
      mockValidation.validateRequiredString.mockImplementation(() => {
        throw new InvalidTaskError('agent must be a non-empty string', 'agent');
      });
      
      await expect(checkTasks(mockConfig, args))
        .rejects.toThrow('agent must be a non-empty string');
    });
  });

  describe('TaskContextManager error propagation', () => {
    it('should propagate file system errors from TaskContextManager', async () => {
      const args = { agent: 'test-agent' };
      const fsError = new Error('ENOENT: no such file or directory');
      
      mockContextManager.checkAssignedTasks.mockRejectedValue(fsError);
      
      await expect(checkTasks(mockConfig, args))
        .rejects.toThrow('ENOENT: no such file or directory');
    });

    it('should propagate permission errors from TaskContextManager', async () => {
      const args = { agent: 'test-agent' };
      const permissionError = new Error('EACCES: permission denied');
      
      mockContextManager.checkAssignedTasks.mockRejectedValue(permissionError);
      
      await expect(checkTasks(mockConfig, args))
        .rejects.toThrow('EACCES: permission denied');
    });

    it('should propagate custom TaskContextManager errors', async () => {
      const args = { agent: 'test-agent' };
      const customError = new InvalidTaskError('Custom task context error', 'task');

      mockContextManager.checkAssignedTasks.mockRejectedValue(customError);

      await expect(checkTasks(mockConfig, args))
        .rejects.toThrow('Custom task context error');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle large number of tasks', async () => {
      const largeTasks = Array.from({ length: 1000 }, (_, index) => ({
        taskId: `task-${index}`,
        title: `Task ${index}`,
        status: index % 4 === 0 ? 'new' : index % 4 === 1 ? 'in_progress' : index % 4 === 2 ? 'completed' : 'error'
      })) as TaskSummary[];
      
      const args = { agent: 'large-agent' };
      mockContextManager.checkAssignedTasks.mockResolvedValue(largeTasks);
      
      const result = await checkTasks(mockConfig, args);

      expect(result.totalCount).toBe(1000);
      expect(result.newCount).toBe(250); // Every 4th task starting at 0
      expect(result.activeCount).toBe(250); // Every 4th task starting at 1
      expect(result.message).toBe('Found 1000 assigned tasks.');
    });

    it('should handle agent names with special characters', async () => {
      const args = { agent: 'test-agent-with-special-chars_123' };
      
      mockValidation.validateRequiredString.mockReturnValue('test-agent-with-special-chars_123');
      
      const result = await checkTasks(mockConfig, args);

      expect(mockValidation.validateRequiredString).toHaveBeenCalledWith(
        'test-agent-with-special-chars_123', 
        'agent'
      );
      expect(mockContextManager.checkAssignedTasks).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle trimmed agent names from validation', async () => {
      const args = { agent: '  test-agent  ' };
      
      mockValidation.validateRequiredString.mockReturnValue('test-agent');
      
      const result = await checkTasks(mockConfig, args);

      expect(mockContextManager.checkAssignedTasks).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('task counting logic', () => {
    it('should correctly count new tasks (status: new)', async () => {
      const countingTasks = [
        { taskId: 'task-1', title: 'Task 1', status: 'new' as const },
        { taskId: 'task-2', title: 'Task 2', status: 'in_progress' as const },
        { taskId: 'task-3', title: 'Task 3', status: 'new' as const },
        { taskId: 'task-4', title: 'Task 4', status: 'completed' as const }
      ];
      
      const args = { agent: 'counting-agent' };
      mockContextManager.checkAssignedTasks.mockResolvedValue(countingTasks);
      
      const result = await checkTasks(mockConfig, args);

      expect(result.newCount).toBe(2); // Only tasks with status: 'new'
    });

    it('should correctly count active tasks (status: in_progress)', async () => {
      const countingTasks = [
        { taskId: 'task-1', title: 'Task 1', status: 'in_progress' as const }, // Active
        { taskId: 'task-2', title: 'Task 2', status: 'new' as const }, // Not active
        { taskId: 'task-3', title: 'Task 3', status: 'completed' as const }, // Not active (done)
        { taskId: 'task-4', title: 'Task 4', status: 'in_progress' as const }, // Active  
        { taskId: 'task-5', title: 'Task 5', status: 'error' as const } // Not active
      ];
      
      const args = { agent: 'counting-agent' };
      mockContextManager.checkAssignedTasks.mockResolvedValue(countingTasks);
      
      const result = await checkTasks(mockConfig, args);

      expect(result.activeCount).toBe(2); // Only tasks with status: 'in_progress'
    });
  });

  describe('async operation handling', () => {
    it('should properly await TaskContextManager operation', async () => {
      const args = { agent: 'async-agent' };
      let resolvePromise: (value: TaskSummary[]) => void;
      
      const delayedPromise = new Promise<TaskSummary[]>((resolve) => {
        resolvePromise = resolve;
      });
      
      mockContextManager.checkAssignedTasks.mockReturnValue(delayedPromise);
      
      const resultPromise = checkTasks(mockConfig, args);
      
      // Resolve after a delay
      setTimeout(() => resolvePromise(mockTaskSummaries), 10);
      
      const result = await resultPromise;
      expect(result.tasks).toEqual(mockTaskSummaries);
    });

    it('should handle concurrent check operations', async () => {
      const args1 = { agent: 'agent-1' };
      const args2 = { agent: 'agent-2' };
      
      const tasks1 = [{ taskId: 'task-1', title: 'Task 1', status: 'new' as const }];
      const tasks2 = [{ taskId: 'task-2', title: 'Task 2', status: 'new' as const }];
      
      mockContextManager.checkAssignedTasks
        .mockResolvedValueOnce(tasks1)
        .mockResolvedValueOnce(tasks2);
      
      const [result1, result2] = await Promise.all([
        checkTasks(mockConfig, args1),
        checkTasks(mockConfig, args2)
      ]);
      
      expect(result1.tasks).toEqual(tasks1);
      expect(result2.tasks).toEqual(tasks2);
      expect(MockTaskContextManager).toHaveBeenCalledTimes(2);
    });
  });

  describe('response structure validation', () => {
    it('should return CheckTasksResponse with required properties', async () => {
      const args = { agent: 'structure-agent' };
      
      const result = await checkTasks(mockConfig, args);

      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('newCount');
      expect(result).toHaveProperty('activeCount');
      expect(result).toHaveProperty('message');
      
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(typeof result.totalCount).toBe('number');
      expect(typeof result.newCount).toBe('number');
      expect(typeof result.activeCount).toBe('number');
      expect(typeof result.message).toBe('string');
    });

    it('should ensure counts are consistent with task array', async () => {
      const args = { agent: 'consistency-agent' };
      
      const result = await checkTasks(mockConfig, args);

      expect(result.totalCount).toBe(result.tasks.length);
      expect(result.newCount).toBeLessThanOrEqual(result.totalCount);
      expect(result.activeCount).toBeLessThanOrEqual(result.totalCount);
      expect(result.newCount).toBeGreaterThanOrEqual(0);
      expect(result.activeCount).toBeGreaterThanOrEqual(0);
    });

    it('should ensure message field is always present', async () => {
      const args = { agent: 'message-agent' };
      
      // Test with tasks
      const result1 = await checkTasks(mockConfig, args);
      expect(result1.message).toBe('Found 5 assigned tasks.');
      
      // Test with no tasks
      mockContextManager.checkAssignedTasks.mockResolvedValue([]);
      const result2 = await checkTasks(mockConfig, args);
      expect(result2.message).toBe('No tasks currently assigned to this agent. Check with other team members or wait for new task assignments.');
    });
  });
});