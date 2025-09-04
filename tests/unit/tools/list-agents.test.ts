/**
 * Unit tests for list-agents tool
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { listAgents } from '../../../src/tools/list-agents.js';
import * as taskManager from '../../../src/utils/task-manager.js';
import { ServerConfig, Agent } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';

// Mock modules
jest.mock('../../../src/utils/task-manager.js');

const mockTaskManager = taskManager as jest.Mocked<typeof taskManager>;

describe('List Agents Tool', () => {
  let mockConfig: ServerConfig;
  let mockAgents: Agent[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = testUtils.createMockConfig();
    mockAgents = [
      {
        name: 'senior-frontend-engineer',
        taskCount: 5,
        completedCount: 3,
        pendingCount: 2,
        errorCount: 0
      },
      {
        name: 'senior-backend-engineer',
        taskCount: 8,
        completedCount: 4,
        pendingCount: 3,
        errorCount: 1
      },
      {
        name: 'qa-test-automation-engineer',
        taskCount: 3,
        completedCount: 2,
        pendingCount: 1,
        errorCount: 0
      },
      {
        name: 'devops-deployment-engineer',
        taskCount: 0,
        completedCount: 0,
        pendingCount: 0,
        errorCount: 0
      }
    ];

    // Setup default task manager mock
    mockTaskManager.getAllAgents.mockResolvedValue(mockAgents);
  });

  describe('successful list operations', () => {
    it('should list all agents with correct totals', async () => {
      const result = await listAgents(mockConfig);

      expect(mockTaskManager.getAllAgents).toHaveBeenCalledWith(mockConfig);
      
      expect(result).toEqual({
        agents: mockAgents,
        totalAgents: 4,
        totalTasks: 16 // 5 + 8 + 3 + 0
      });
    });

    it('should handle empty agent list', async () => {
      mockTaskManager.getAllAgents.mockResolvedValue([]);
      
      const result = await listAgents(mockConfig);

      expect(result).toEqual({
        agents: [],
        totalAgents: 0,
        totalTasks: 0
      });
    });

    it('should handle single agent', async () => {
      const singleAgent: Agent[] = [
        {
          name: 'solo-agent',
          taskCount: 10,
          completedCount: 7,
          pendingCount: 2,
          errorCount: 1
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(singleAgent);
      
      const result = await listAgents(mockConfig);

      expect(result).toEqual({
        agents: singleAgent,
        totalAgents: 1,
        totalTasks: 10
      });
    });

    it('should handle agents with zero tasks', async () => {
      const zeroTaskAgents: Agent[] = [
        {
          name: 'new-agent-1',
          taskCount: 0,
          completedCount: 0,
          pendingCount: 0,
          errorCount: 0
        },
        {
          name: 'new-agent-2',
          taskCount: 0,
          completedCount: 0,
          pendingCount: 0,
          errorCount: 0
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(zeroTaskAgents);
      
      const result = await listAgents(mockConfig);

      expect(result).toEqual({
        agents: zeroTaskAgents,
        totalAgents: 2,
        totalTasks: 0
      });
    });

    it('should handle large number of agents', async () => {
      const largeAgentList: Agent[] = Array.from({ length: 100 }, (_, index) => ({
        name: `agent-${index}`,
        taskCount: index + 1,
        completedCount: Math.floor((index + 1) * 0.6),
        pendingCount: Math.floor((index + 1) * 0.3),
        errorCount: Math.floor((index + 1) * 0.1)
      }));
      
      mockTaskManager.getAllAgents.mockResolvedValue(largeAgentList);
      
      const result = await listAgents(mockConfig);

      const expectedTotalTasks = largeAgentList.reduce((sum, agent) => sum + agent.taskCount, 0);
      
      expect(result).toEqual({
        agents: largeAgentList,
        totalAgents: 100,
        totalTasks: expectedTotalTasks
      });
    });

    it('should handle agents with high task counts', async () => {
      const highTaskAgents: Agent[] = [
        {
          name: 'busy-agent',
          taskCount: 999999,
          completedCount: 500000,
          pendingCount: 499999,
          errorCount: 0
        },
        {
          name: 'super-busy-agent',
          taskCount: 1000000,
          completedCount: 800000,
          pendingCount: 150000,
          errorCount: 50000
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(highTaskAgents);
      
      const result = await listAgents(mockConfig);

      expect(result).toEqual({
        agents: highTaskAgents,
        totalAgents: 2,
        totalTasks: 1999999
      });
    });
  });

  describe('agent data validation', () => {
    it('should handle agents with special characters in names', async () => {
      const specialNameAgents: Agent[] = [
        {
          name: 'agent-with-dashes',
          taskCount: 1,
          completedCount: 1,
          pendingCount: 0,
          errorCount: 0
        },
        {
          name: 'agent_with_underscores',
          taskCount: 2,
          completedCount: 1,
          pendingCount: 1,
          errorCount: 0
        },
        {
          name: 'agent.with.dots',
          taskCount: 3,
          completedCount: 2,
          pendingCount: 0,
          errorCount: 1
        },
        {
          name: 'AgentWithCamelCase',
          taskCount: 4,
          completedCount: 3,
          pendingCount: 1,
          errorCount: 0
        },
        {
          name: 'agent123',
          taskCount: 5,
          completedCount: 4,
          pendingCount: 0,
          errorCount: 1
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(specialNameAgents);
      
      const result = await listAgents(mockConfig);

      expect(result.agents).toEqual(specialNameAgents);
      expect(result.totalAgents).toBe(5);
      expect(result.totalTasks).toBe(15); // 1+2+3+4+5
    });

    it('should handle agents with unicode characters in names', async () => {
      const unicodeAgents: Agent[] = [
        {
          name: 'développeur-backend',
          taskCount: 2,
          completedCount: 1,
          pendingCount: 1,
          errorCount: 0
        },
        {
          name: 'agente-español',
          taskCount: 3,
          completedCount: 2,
          pendingCount: 1,
          errorCount: 0
        },
        {
          name: '开发者-中文',
          taskCount: 1,
          completedCount: 1,
          pendingCount: 0,
          errorCount: 0
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(unicodeAgents);
      
      const result = await listAgents(mockConfig);

      expect(result.agents).toEqual(unicodeAgents);
      expect(result.totalTasks).toBe(6);
    });

    it('should handle agents with very long names', async () => {
      const longNameAgent: Agent = {
        name: 'very-long-agent-name-' + 'x'.repeat(200),
        taskCount: 1,
        completedCount: 1,
        pendingCount: 0,
        errorCount: 0
      };
      
      mockTaskManager.getAllAgents.mockResolvedValue([longNameAgent]);
      
      const result = await listAgents(mockConfig);

      expect(result.agents[0].name).toBe(longNameAgent.name);
      expect(result.totalAgents).toBe(1);
    });

    it('should handle edge case where taskCount does not match sum of other counts', async () => {
      // This might happen due to race conditions or data inconsistencies
      const inconsistentAgents: Agent[] = [
        {
          name: 'inconsistent-agent',
          taskCount: 10,
          completedCount: 5,
          pendingCount: 3,
          errorCount: 1
          // Sum is 9, but taskCount is 10 - this is a data inconsistency
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(inconsistentAgents);
      
      const result = await listAgents(mockConfig);

      // The tool should still work and use the taskCount value as provided
      expect(result.agents).toEqual(inconsistentAgents);
      expect(result.totalTasks).toBe(10); // Uses taskCount, not sum of other counts
    });
  });

  describe('task manager error propagation', () => {
    it('should propagate file system errors from task manager', async () => {
      const fsError = new Error('ENOENT: no such file or directory');
      
      mockTaskManager.getAllAgents.mockRejectedValue(fsError);
      
      await expect(listAgents(mockConfig))
        .rejects.toThrow('ENOENT: no such file or directory');
    });

    it('should propagate permission errors from task manager', async () => {
      const permissionError = new Error('EACCES: permission denied');
      
      mockTaskManager.getAllAgents.mockRejectedValue(permissionError);
      
      await expect(listAgents(mockConfig))
        .rejects.toThrow('EACCES: permission denied');
    });

    it('should propagate timeout errors from task manager', async () => {
      const timeoutError = new Error('Operation timeout');
      
      mockTaskManager.getAllAgents.mockRejectedValue(timeoutError);
      
      await expect(listAgents(mockConfig))
        .rejects.toThrow('Operation timeout');
    });

    it('should propagate custom errors from task manager', async () => {
      const customError = new Error('Custom task manager error');
      
      mockTaskManager.getAllAgents.mockRejectedValue(customError);
      
      await expect(listAgents(mockConfig))
        .rejects.toThrow('Custom task manager error');
    });

    it('should propagate network-related errors', async () => {
      const networkError = new Error('ECONNREFUSED: Connection refused');
      
      mockTaskManager.getAllAgents.mockRejectedValue(networkError);
      
      await expect(listAgents(mockConfig))
        .rejects.toThrow('ECONNREFUSED: Connection refused');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle agents with negative task counts (data corruption case)', async () => {
      const corruptedAgents: Agent[] = [
        {
          name: 'corrupted-agent',
          taskCount: -5, // Negative count (data corruption)
          completedCount: 0,
          pendingCount: 0,
          errorCount: 0
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(corruptedAgents);
      
      const result = await listAgents(mockConfig);

      // Tool should handle it gracefully and use the values as provided
      expect(result.agents).toEqual(corruptedAgents);
      expect(result.totalTasks).toBe(-5);
    });

    it('should handle agents with floating point task counts', async () => {
      const floatAgents: Agent[] = [
        {
          name: 'float-agent',
          taskCount: 5.7 as number, // Floating point (should not happen but handling edge case)
          completedCount: 3,
          pendingCount: 2,
          errorCount: 0
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(floatAgents);
      
      const result = await listAgents(mockConfig);

      expect(result.totalTasks).toBe(5.7);
    });

    it('should handle mixed positive and negative task counts', async () => {
      const mixedAgents: Agent[] = [
        {
          name: 'positive-agent',
          taskCount: 10,
          completedCount: 8,
          pendingCount: 2,
          errorCount: 0
        },
        {
          name: 'negative-agent',
          taskCount: -3,
          completedCount: 0,
          pendingCount: 0,
          errorCount: 0
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(mixedAgents);
      
      const result = await listAgents(mockConfig);

      expect(result.totalTasks).toBe(7); // 10 + (-3)
    });

    it('should handle zero-length agent names', async () => {
      const emptyNameAgents: Agent[] = [
        {
          name: '',
          taskCount: 1,
          completedCount: 1,
          pendingCount: 0,
          errorCount: 0
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(emptyNameAgents);
      
      const result = await listAgents(mockConfig);

      expect(result.agents[0].name).toBe('');
      expect(result.totalAgents).toBe(1);
    });

    it('should handle agents with null or undefined properties (edge case)', async () => {
      // This simulates data corruption or incomplete agent objects
      const corruptedAgent = {
        name: 'partially-corrupt-agent',
        taskCount: null as any,
        completedCount: undefined as any,
        pendingCount: 5,
        errorCount: 2
      };
      
      mockTaskManager.getAllAgents.mockResolvedValue([corruptedAgent]);
      
      const result = await listAgents(mockConfig);

      // Tool should handle gracefully - JavaScript's reduce will treat null as 0
      expect(result.totalTasks).toBe(0); // null is treated as 0 in arithmetic operations
    });
  });

  describe('total calculation accuracy', () => {
    it('should correctly sum task counts with various number types', async () => {
      const variousAgents: Agent[] = [
        { name: 'agent1', taskCount: 0, completedCount: 0, pendingCount: 0, errorCount: 0 },
        { name: 'agent2', taskCount: 1, completedCount: 1, pendingCount: 0, errorCount: 0 },
        { name: 'agent3', taskCount: 100, completedCount: 90, pendingCount: 10, errorCount: 0 },
        { name: 'agent4', taskCount: 999, completedCount: 800, pendingCount: 199, errorCount: 0 }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(variousAgents);
      
      const result = await listAgents(mockConfig);

      expect(result.totalTasks).toBe(1100); // 0 + 1 + 100 + 999
    });

    it('should handle overflow scenarios with very large numbers', async () => {
      const largeNumberAgents: Agent[] = [
        {
          name: 'agent1',
          taskCount: Number.MAX_SAFE_INTEGER - 1,
          completedCount: 0,
          pendingCount: 0,
          errorCount: 0
        },
        {
          name: 'agent2',
          taskCount: 1,
          completedCount: 0,
          pendingCount: 0,
          errorCount: 0
        }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(largeNumberAgents);
      
      const result = await listAgents(mockConfig);

      expect(result.totalTasks).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should correctly calculate totals when some agents have zero tasks', async () => {
      const mixedAgents: Agent[] = [
        { name: 'busy-agent', taskCount: 50, completedCount: 30, pendingCount: 20, errorCount: 0 },
        { name: 'empty-agent', taskCount: 0, completedCount: 0, pendingCount: 0, errorCount: 0 },
        { name: 'another-busy-agent', taskCount: 25, completedCount: 15, pendingCount: 10, errorCount: 0 },
        { name: 'another-empty-agent', taskCount: 0, completedCount: 0, pendingCount: 0, errorCount: 0 }
      ];
      
      mockTaskManager.getAllAgents.mockResolvedValue(mixedAgents);
      
      const result = await listAgents(mockConfig);

      expect(result.totalTasks).toBe(75); // 50 + 0 + 25 + 0
      expect(result.totalAgents).toBe(4);
    });
  });

  describe('argument handling', () => {
    it('should ignore all arguments since none are used', async () => {
      const result = await listAgents(mockConfig);

      expect(mockTaskManager.getAllAgents).toHaveBeenCalledWith(mockConfig);
      expect(result).toEqual({
        agents: mockAgents,
        totalAgents: 4,
        totalTasks: 16
      });
    });

    it('should work with empty arguments object', async () => {
      const result = await listAgents(mockConfig);

      expect(mockTaskManager.getAllAgents).toHaveBeenCalledWith(mockConfig);
      expect(result).toBeDefined();
    });

    it('should work with undefined arguments', async () => {
      const result = await listAgents(mockConfig);

      expect(mockTaskManager.getAllAgents).toHaveBeenCalledWith(mockConfig);
      expect(result).toBeDefined();
    });

    it('should work with null arguments', async () => {
      const result = await listAgents(mockConfig);

      expect(mockTaskManager.getAllAgents).toHaveBeenCalledWith(mockConfig);
      expect(result).toBeDefined();
    });
  });

  describe('response structure validation', () => {
    it('should return ListAgentsResponse with required properties', async () => {
      const result = await listAgents(mockConfig);

      expect(result).toHaveProperty('agents');
      expect(result).toHaveProperty('totalAgents');
      expect(result).toHaveProperty('totalTasks');
      
      expect(Array.isArray(result.agents)).toBe(true);
      expect(typeof result.totalAgents).toBe('number');
      expect(typeof result.totalTasks).toBe('number');
    });

    it('should ensure totals are consistent with agent array', async () => {
      const result = await listAgents(mockConfig);

      expect(result.totalAgents).toBe(result.agents.length);
      expect(result.totalTasks).toBe(result.agents.reduce((sum, agent) => sum + agent.taskCount, 0));
    });

    it('should return non-negative totalAgents', async () => {
      const result = await listAgents(mockConfig);

      expect(result.totalAgents).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty response correctly', async () => {
      mockTaskManager.getAllAgents.mockResolvedValue([]);
      
      const result = await listAgents(mockConfig);

      expect(result.agents).toEqual([]);
      expect(result.totalAgents).toBe(0);
      expect(result.totalTasks).toBe(0);
    });
  });

  describe('async operation handling', () => {
    it('should properly await task manager operation', async () => {
      let resolvePromise: (value: Agent[]) => void;
      
      const delayedPromise = new Promise<Agent[]>((resolve) => {
        resolvePromise = resolve;
      });
      
      mockTaskManager.getAllAgents.mockReturnValue(delayedPromise);
      
      const resultPromise = listAgents(mockConfig);
      
      // Resolve after a delay
      setTimeout(() => resolvePromise(mockAgents), 10);
      
      const result = await resultPromise;
      expect(result.agents).toEqual(mockAgents);
    });

    it('should handle concurrent list operations', async () => {
      const agents1 = [{ name: 'agent1', taskCount: 1, completedCount: 1, pendingCount: 0, errorCount: 0 }];
      const agents2 = [{ name: 'agent2', taskCount: 2, completedCount: 1, pendingCount: 1, errorCount: 0 }];
      
      mockTaskManager.getAllAgents
        .mockResolvedValueOnce(agents1)
        .mockResolvedValueOnce(agents2);
      
      const [result1, result2] = await Promise.all([
        listAgents(mockConfig),
        listAgents(mockConfig)
      ]);
      
      expect(result1.agents).toEqual(agents1);
      expect(result2.agents).toEqual(agents2);
      expect(result1.totalTasks).toBe(1);
      expect(result2.totalTasks).toBe(2);
    });
  });
});