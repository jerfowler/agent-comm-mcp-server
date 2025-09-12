/**
 * @fileoverview Test suite for submit-plan tool
 */

import { jest } from '@jest/globals';
import { submitPlan } from '../../../src/tools/submit-plan.js';
import { TaskContextManager, PlanSubmissionResult } from '../../../src/core/TaskContextManager.js';
import { AgentCommError, ServerConfig } from '../../../src/types.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';

// Mock dependencies
jest.mock('../../../src/core/TaskContextManager.js');

const MockedTaskContextManager = TaskContextManager as jest.MockedClass<typeof TaskContextManager>;

describe('submit-plan tool', () => {
  const mockConfig = {
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
      } as unknown as ConnectionManager,
    eventLogger: {
      logOperation: jest.fn(),
      logError: jest.fn(),
        getOperationStatistics: jest.fn()
      } as unknown as EventLogger
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should submit plan successfully', async () => {
    const mockResult: PlanSubmissionResult = {
      success: true,
      message: 'Plan submitted successfully',
      stepsIdentified: 5,
      phases: 3,
      initialProgress: {
        completed: 0,
        inProgress: 1,
        pending: 4,
        blocked: 0
      }
    };

    const mockInstance = {
      submitPlan: jest.fn().mockResolvedValue(mockResult as never)
    };
    (MockedTaskContextManager as unknown as jest.Mock).mockImplementation(() => mockInstance);

    const args = {
      content: `# Test Plan

## Phase 1

- [ ] **Setup Environment**: Configure test environment
  - Action: Install dependencies
  - Expected: All packages installed  
  - Error: Check package.json for conflicts

- [ ] **Run Tests**: Execute test suite
  - Action: Run npm test
  - Expected: All tests pass
  - Error: Fix failing tests`,
      agent: 'test-agent'
    };

    const result = await submitPlan(mockConfig, args);

    expect(result).toEqual(mockResult);
    expect(MockedTaskContextManager).toHaveBeenCalledWith(expect.objectContaining({
      commDir: mockConfig.commDir
    }));
    expect(mockInstance.submitPlan).toHaveBeenCalledWith(
      expect.stringContaining('# Test Plan'),
      expect.objectContaining({
        agent: 'test-agent'
      })
    );
  });

  it('should throw error for missing content', async () => {
    const args = {
      agent: 'test-agent'
      // content missing
    };

    await expect(submitPlan(mockConfig, args))
      .rejects.toThrow(AgentCommError);
  });

  it('should throw error for missing agent', async () => {
    const args = {
      content: '# Test Plan'
      // agent missing
    };

    await expect(submitPlan(mockConfig, args))
      .rejects.toThrow(AgentCommError);
  });

  it('should throw error for plan with no checkboxes', async () => {
    const args = {
      content: `# Test Plan

This plan has no checkboxes at all.
Just some regular text without any trackable items.`,
      agent: 'test-agent'
    };

    await expect(submitPlan(mockConfig, args))
      .rejects.toThrow(/Plan must include at least ONE trackable item/);
  });

  it('should throw error for plan with forbidden status markers', async () => {
    const args = {
      content: `# Test Plan

- [ ] **Valid Task**: This is valid
  - Action: Do something
  - Expected: Success

[PENDING] This should not be here
[COMPLETE] Neither should this`,
      agent: 'test-agent'
    };

    await expect(submitPlan(mockConfig, args))
      .rejects.toThrow(/Use checkbox format only.*Remove these status markers/);
  });

  it('should throw error for checkbox without detail points', async () => {
    const args = {
      content: `# Test Plan

- [ ] **Missing Details**: This checkbox has no detail points

Some regular text here that is not a detail point.

Another paragraph that doesn't count as details.`,
      agent: 'test-agent'
    };

    await expect(submitPlan(mockConfig, args))
      .rejects.toThrow(/Checkbox "Missing Details" missing required detail points/);
  });

  it('should handle missing configuration components', async () => {
    const badConfig = {
      commDir: '/test/comm',
      archiveDir: '/test/archive',
      logDir: '/test/logs',
      enableArchiving: false
      // Missing connectionManager and eventLogger
    };

    const args = {
      content: `# Test Plan

- [ ] **Test Task**: Test configuration validation
  - Action: Validate config
  - Expected: Config validation should happen after format validation
  - Error: Show configuration error`,
      agent: 'test-agent'
    };

    await expect(submitPlan(badConfig as unknown as ServerConfig, args))
      .rejects.toThrow('Configuration missing required components');
  });
});