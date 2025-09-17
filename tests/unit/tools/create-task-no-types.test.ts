/**
 * Tests for create-task tool without taskType parameter
 * This test file validates that taskType has been removed from the create-task tool
 */

import { createTask, CreateTaskOptions } from '../../../src/tools/create-task.js';
import * as fs from '../../../src/utils/file-system.js';
import * as taskManager from '../../../src/utils/task-manager.js';
import { EventLogger } from '../../../src/logging/EventLogger.js';
import { ErrorLogger } from '../../../src/logging/ErrorLogger.js';
import { ResponseEnhancer } from '../../../src/core/ResponseEnhancer.js';
import { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import { jest } from '@jest/globals';
import type { ServerConfig } from '../../../src/types.js';

// Mock the dependencies
jest.mock('../../../src/utils/file-system.js');
jest.mock('../../../src/utils/task-manager.js');
jest.mock('../../../src/logging/EventLogger.js');
jest.mock('../../../src/logging/ErrorLogger.js');
jest.mock('../../../src/core/ResponseEnhancer.js');
jest.mock('../../../src/core/ConnectionManager.js');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedTaskManager = taskManager as jest.Mocked<typeof taskManager>;

describe('create-task without taskType', () => {
  let mockConfig: ServerConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup config with mocked dependencies
    mockConfig = {
      commDir: './comm',
      archiveDir: './comm/.archive',
      logDir: './logs',
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
        logToolExecution: jest.fn(),
        waitForWriteQueueEmpty: jest.fn(),
        getOperationStatistics: jest.fn()
      } as unknown as EventLogger,
      errorLogger: new ErrorLogger('./logs') as ErrorLogger,
      responseEnhancer: {
        enhanceCreateTask: jest.fn().mockReturnValue({
          guidance: {
            next_steps: 'Continue working',
            contextual_reminder: 'Use MCP protocol',
            compliance_level: 100
          }
        })
      } as unknown as ResponseEnhancer
    };

    // Setup file system mocks
    mockedFs.pathExists.mockResolvedValue(false); // No existing tasks by default
    mockedFs.listDirectory.mockResolvedValue([]);
    mockedFs.isDirectory.mockResolvedValue(true);
    mockedFs.writeFile.mockResolvedValue(undefined);

    // Default successful mock for initializeTask
    mockedTaskManager.initializeTask.mockResolvedValue({
      taskDir: '2025-09-17T10-00-00-test-task',
      initPath: './comm/test-agent/2025-09-17T10-00-00-test-task/INIT.md'
    });
  });

  describe('Interface without taskType', () => {
    it('should accept create-task options without taskType parameter', async () => {
      // This test validates that the CreateTaskOptions interface no longer includes taskType
      const options: CreateTaskOptions = {
        agent: 'test-agent',
        taskName: 'test-task',
        content: 'Test content'
        // Notice: no taskType parameter here
      };

      const result = await createTask(mockConfig, options);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(true);
      expect(result.taskId).toBeDefined();

      // Verify that no taskType is referenced in the result
      expect(result).not.toHaveProperty('taskType');
    });

    it('should not accept taskType parameter even if provided', async () => {
      // TypeScript should prevent this at compile time
      const options = {
        agent: 'test-agent',
        taskName: 'test-task',
        content: 'Test content',
        taskType: 'delegation' // This should cause a TypeScript error
      } as unknown as CreateTaskOptions;

      // The function should ignore the taskType parameter
      const result = await createTask(mockConfig, options);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(true);
      // Result should not include taskType
      expect(result).not.toHaveProperty('taskType');
    });
  });

  describe('Clean task creation', () => {
    it('should create task without any taskType logic', async () => {
      const options: CreateTaskOptions = {
        agent: 'backend-engineer',
        taskName: 'implement-feature',
        content: 'Implement new authentication feature'
      };

      const result = await createTask(mockConfig, options);

      expect(result.taskCreated).toBe(true);
      expect(result.taskId).toBeDefined();

      // Verify INIT.md content doesn't contain taskType metadata
      const writeFileCalls = mockedFs.writeFile.mock.calls;
      const initFileCall = writeFileCalls.find(call =>
        (call[0] as string).includes('INIT.md')
      );

      expect(initFileCall).toBeDefined();
      const initContent = initFileCall?.[1] as string ?? '';
      expect(initContent).not.toContain('taskType');
    });

    it('should handle parent task reference without taskType', async () => {
      const options: CreateTaskOptions = {
        agent: 'test-agent',
        taskName: 'sub-task',
        content: 'This is a sub-task',
        parentTask: 'parent-task-123'
      };

      const result = await createTask(mockConfig, options);

      expect(result.taskCreated).toBe(true);

      // Verify parent task is still handled
      const writeFileCalls = mockedFs.writeFile.mock.calls;
      const initFileCall = writeFileCalls.find(call =>
        (call[0] as string).includes('INIT.md')
      );

      const initContent = initFileCall?.[1] as string ?? '';
      // Parent task reference should still work
      expect(initContent).toContain('parent-task-123');
      // But no taskType references
      expect(initContent).not.toContain('taskType');
    });

    it('should create task without content and not use self-task logic', async () => {
      const options: CreateTaskOptions = {
        agent: 'test-agent',
        taskName: 'empty-task'
        // No content provided
      };

      const result = await createTask(mockConfig, options);

      expect(result.taskCreated).toBe(true);

      // Verify INIT.md doesn't have self-task template
      const writeFileCalls = mockedFs.writeFile.mock.calls;
      const initFileCall = writeFileCalls.find(call =>
        (call[0] as string).includes('INIT.md')
      );

      const initContent = initFileCall?.[1] as string ?? '';
      // Should not contain self-task template
      expect(initContent).not.toContain('Task initialized and ready for content');
      expect(initContent).not.toContain('Define requirements');
      expect(initContent).not.toContain('Create implementation plan');
    });
  });

  describe('EventLogger integration', () => {
    it('should create task successfully without taskType (EventLogger called at MCP level)', async () => {
      const options: CreateTaskOptions = {
        agent: 'test-agent',
        taskName: 'test-task',
        content: 'Test content'
      };

      const result = await createTask(mockConfig, options);

      // Verify task creation succeeded without taskType
      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(true);
      expect(result).not.toHaveProperty('taskType');
      
      // EventLogger is called at the MCP server level, not in createTask function
      // So we don't expect it to be called directly here
    });
  });

  describe('ResponseEnhancer integration', () => {
    it('should create task response without taskType (ResponseEnhancer called at MCP level)', async () => {
      const options: CreateTaskOptions = {
        agent: 'test-agent',
        taskName: 'test-task',
        content: 'Test content'
      };

      const result = await createTask(mockConfig, options);

      // Verify response structure doesn't include taskType
      expect(result.success).toBe(true);
      expect(result.taskCreated).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(result).not.toHaveProperty('taskType');
      
      // ResponseEnhancer is called at the MCP server level, not in createTask function
      // So we don't expect it to be called directly here
    });
  });
});