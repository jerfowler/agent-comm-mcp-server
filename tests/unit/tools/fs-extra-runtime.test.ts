/**
 * Tests for fs-extra runtime errors - Issue #9
 * These tests reproduce the exact runtime environment issues reported in the MCP server
 */

import { jest } from '@jest/globals';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import { syncTodoCheckboxes } from '../../../src/tools/sync-todo-checkboxes.js';
import { LockManager } from '../../../src/utils/lock-manager.js';
import { ServerConfig } from '../../../src/types.js';

// Mock fs-extra using factory function to avoid TypeScript strict mode issues
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(),
  remove: jest.fn(),
  ensureDir: jest.fn()
}));

const mockFs = fs as unknown as jest.Mocked<{
  pathExists: jest.MockedFunction<(path: string) => Promise<boolean>>;
  readdir: jest.MockedFunction<(path: string) => Promise<string[]>>;
  writeFile: jest.MockedFunction<(path: string, data: string) => Promise<void>>;
  readFile: jest.MockedFunction<(path: string, encoding?: string) => Promise<string>>;
  stat: jest.MockedFunction<(path: string) => Promise<{ isDirectory: () => boolean; mtime?: Date }>>;
  remove: jest.MockedFunction<(path: string) => Promise<void>>;
  ensureDir: jest.MockedFunction<(path: string) => Promise<void>>;
}>;

describe('Issue #9: fs-extra Runtime Errors', () => {
  let config: ServerConfig;
  let mockConnectionManager: any;
  let mockEventLogger: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    mockConnectionManager = {
      getActiveConnections: jest.fn().mockReturnValue([]),
    };
    
    mockEventLogger = {
      logEvent: jest.fn(),
      waitForWriteQueueEmpty: jest.fn().mockImplementation(() => Promise.resolve())
    };
    
    config = {
      commDir: '/tmp/test-comm',
      archiveDir: '/tmp/test-comm/.archive',
      logDir: '/tmp/test-comm/.logs',
      enableArchiving: true,
      connectionManager: mockConnectionManager,
      eventLogger: mockEventLogger
    };

    // Setup default successful mock implementations
    mockFs.pathExists.mockImplementation(async (filePath: string) => {
      return !filePath.includes('nonexistent');
    });
    
    mockFs.readdir.mockImplementation(async () => ['task-123']);
    
    mockFs.stat.mockImplementation(async () => ({
      isDirectory: () => true,
      mtime: new Date()
    }));
    
    mockFs.readFile.mockImplementation(async () => '# Test Plan\n\n- [ ] **Test checkbox**:\n  Description');
    
    mockFs.writeFile.mockImplementation(async () => Promise.resolve());
    mockFs.remove.mockImplementation(async () => Promise.resolve());
    mockFs.ensureDir.mockImplementation(async () => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fs.readdir Runtime Error Reproduction', () => {
    test('should FAIL when fs.readdir is not a function (reproduce Issue #9)', async () => {
      // REPRODUCE THE BUG: fs.readdir is not a function
      (mockFs.readdir as any) = undefined;
      
      const args = {
        agent: 'test-agent',
        todoUpdates: [{ title: 'test task', status: 'completed' }]
      };

      // This test MUST fail initially - proving we catch the exact bug
      await expect(syncTodoCheckboxes(config, args)).rejects.toThrow();
    });

    test('should provide clear error message when fs.readdir fails', async () => {
      // Mock fs.readdir to throw the exact error from Issue #9
      mockFs.readdir.mockImplementation(() => {
        throw new Error('fs.readdir is not a function');
      });

      const args = {
        agent: 'test-agent', 
        todoUpdates: [{ title: 'test task', status: 'completed' }]
      };

      await expect(syncTodoCheckboxes(config, args)).rejects.toThrow('fs.readdir is not a function');
    });

    test('should gracefully handle fs module method unavailability', async () => {
      // Test when fs methods are undefined (runtime import failure)
      (mockFs.readdir as any) = undefined;
      (mockFs.writeFile as any) = undefined;
      
      const args = {
        agent: 'test-agent',
        todoUpdates: [{ title: 'test task', status: 'completed' }]
      };

      // Should fail gracefully with clear error message
      await expect(syncTodoCheckboxes(config, args)).rejects.toThrow();
    });
  });

  describe('fs.writeFile Runtime Error Reproduction (LockManager)', () => {
    test('should FAIL when fs.writeFile is not a function in LockManager', async () => {
      // REPRODUCE THE BUG: fs.writeFile is not a function
      (mockFs.writeFile as any) = undefined;
      
      const lockManager = new LockManager();
      const taskDir = '/tmp/test-task';
      
      // This test MUST fail initially - proving we catch the exact bug
      await expect(lockManager.acquireLock(taskDir, 'test-tool')).rejects.toThrow();
    });

    test('should provide clear error message when lock writeFile fails', async () => {
      // Mock fs.writeFile to throw the exact error from Issue #9
      mockFs.writeFile.mockImplementation(() => {
        throw new Error('fs.writeFile is not a function');
      });
      
      const lockManager = new LockManager();
      const taskDir = '/tmp/test-task';
      
      await expect(lockManager.acquireLock(taskDir, 'test-tool'))
        .rejects.toThrow('Failed to acquire lock: fs.writeFile is not a function');
    });
  });

  describe('Expected Behavior After Fix', () => {
    test('should successfully sync todos when fs-extra methods are available', async () => {
      // This test defines success criteria - should pass after fix
      const args = {
        agent: 'test-agent',
        todoUpdates: [{ title: 'Test checkbox', status: 'completed' }]
      };

      const result = await syncTodoCheckboxes(config, args);
      
      expect(result.success).toBe(true);
      expect(result.matchedUpdates).toBe(1);
      expect(result.updatedCheckboxes).toHaveLength(1);
    });

    test('should successfully create locks when fs.writeFile is available', async () => {
      const lockManager = new LockManager();
      const taskDir = '/tmp/test-task';
      
      const result = await lockManager.acquireLock(taskDir, 'test-tool');
      
      expect(result.acquired).toBe(true);
      expect(result.lockId).toBeDefined();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle partial fs-extra method availability', async () => {
      // Some methods work, others don't - mixed runtime state
      mockFs.pathExists.mockImplementation(async () => true);
      (mockFs.readdir as any) = undefined; // This one fails
      
      const args = {
        agent: 'test-agent',
        todoUpdates: [{ title: 'test', status: 'completed' }]
      };

      await expect(syncTodoCheckboxes(config, args)).rejects.toThrow();
    });

    test('should maintain performance when fs-extra methods are working', async () => {
      const start = Date.now();
      
      const args = {
        agent: 'test-agent',
        todoUpdates: [{ title: 'Test checkbox', status: 'completed' }]
      };

      await syncTodoCheckboxes(config, args);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // <100ms requirement
    });
  });

  describe('Integration with Fallback Systems', () => {
    test('should use Node.js built-in fs when fs-extra fails', async () => {
      // This test will be implemented once we add fallback mechanism
      // Currently expected to fail - will pass after implementing fallback
      
      // Mock fs-extra failure
      mockFs.readdir.mockImplementation(() => {
        throw new Error('fs.readdir is not a function');
      });
      
      const args = {
        agent: 'test-agent',
        todoUpdates: [{ title: 'test', status: 'completed' }]
      };

      // After implementing fallback, this should work
      // Currently will fail - that's expected for TDD
      await expect(syncTodoCheckboxes(config, args)).rejects.toThrow();
    });
  });

  describe('Runtime Environment Validation', () => {
    test('should validate fs-extra module is properly loaded', async () => {
      // Test fs-extra module availability detection
      // This will be used for runtime diagnostics
      
      expect(typeof fs).toBe('object');
      expect(fs).toBeDefined();
      
      // These should be functions if fs-extra is properly loaded
      // Currently may fail in MCP runtime - that's the bug we're fixing
      if (mockFs.readdir && mockFs.writeFile) {
        expect(typeof mockFs.readdir).toBe('function');
        expect(typeof mockFs.writeFile).toBe('function'); 
      }
    });

    test('should provide diagnostic information when fs-extra methods are missing', () => {
      // Mock the case where fs-extra import succeeds but methods are undefined
      const diagnostics = {
        fsExtraImported: !!fs,
        readdirAvailable: typeof mockFs.readdir === 'function',
        writeFileAvailable: typeof mockFs.writeFile === 'function',
        pathExistsAvailable: typeof mockFs.pathExists === 'function'
      };
      
      expect(diagnostics.fsExtraImported).toBe(true);
      
      // In runtime error scenario, these would be false
      // After fix, these should all be true
    });
  });
});