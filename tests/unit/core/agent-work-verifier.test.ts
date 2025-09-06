/**
 * Comprehensive test coverage for agent-work-verifier.ts
 * Tests all verification logic, evidence collection, and confidence scoring
 */

import { jest } from '@jest/globals';
import { 
  verifyAgentWork, 
  DEFAULT_CONFIDENCE_THRESHOLD
} from '../../../src/core/agent-work-verifier.js';
import { ServerConfig } from '../../../src/types.js';
import * as fs from '../../../src/utils/file-system.js';
import { testUtils } from '../../utils/testUtils.js';

// Mock the file-system module
jest.mock('../../../src/utils/file-system.js', () => ({
  pathExists: jest.fn(),
  listDirectory: jest.fn(),
  getStats: jest.fn(),
  readFile: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Agent Work Verifier', () => {
  let mockConfig: ServerConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = testUtils.createMockConfig({
      commDir: '/test/comm',
      archiveDir: '/test/archive',
      logDir: '/test/logs'
    });
  });

  describe('verifyAgentWork', () => {
    it('should return failure when no active task found', async () => {
      // Mock no agent directory exists
      mockFs.pathExists.mockResolvedValue(false);

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.warnings).toContain('No active task found for agent');
      expect(result.recommendation).toBe('Cannot verify work - no task context available');
    });

    it('should return failure when specific task not found', async () => {
      // Mock agent directory exists but task doesn't
      mockFs.pathExists
        .mockResolvedValueOnce(true)  // agent dir exists
        .mockResolvedValueOnce(false); // task dir doesn't exist

      const result = await verifyAgentWork(mockConfig, 'test-agent', 'nonexistent-task');

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.warnings).toContain('No active task found for agent');
    });

    it('should find and verify specific task when taskId provided', async () => {
      const recentTime = new Date();
      
      // Mock specific task exists and has good evidence
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path === '/test/comm/test-agent/specific-task') return Promise.resolve(true);
        if (path.includes('specific-task/PLAN.md')) return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      mockFs.listDirectory.mockResolvedValue(['PLAN.md', 'INIT.md', 'file1.js']);

      mockFs.getStats.mockImplementation((_path: string) => {
        return Promise.resolve(testUtils.createMockStats({
          mtime: recentTime
        }) as any);
      });

      mockFs.readFile.mockResolvedValue('- [x] Task completed\n- [x] Another task\n- [ ] Remaining task');

      const result = await verifyAgentWork(mockConfig, 'test-agent', 'specific-task');

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(DEFAULT_CONFIDENCE_THRESHOLD);
    });

    it('should handle verification system errors gracefully', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('File system error'));

      await expect(verifyAgentWork(mockConfig, 'test-agent')).rejects.toThrow('Verification system error: File system error');
    });

    it('should find most recent active task when no taskId provided', async () => {
      const recentTime = new Date();
      
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        return Promise.resolve(true);
      });

      mockFs.listDirectory
        .mockResolvedValueOnce(['task1', 'task2']) // agent tasks
        .mockResolvedValueOnce(['PLAN.md', 'file1.js']); // task files

      mockFs.getStats
        .mockImplementation((path: string) => {
          if (path.includes('task1')) {
            return Promise.resolve(testUtils.createMockStats({
              mtime: new Date(Date.now() - 60 * 60 * 1000),
              isDirectory: () => true,
              isFile: () => false
            }) as any);
          }
          if (path.includes('task2')) {
            return Promise.resolve(testUtils.createMockStats({
              mtime: recentTime,
              isDirectory: () => true,
              isFile: () => false
            }) as any);
          }
          return Promise.resolve(testUtils.createMockStats({
            mtime: recentTime
          }) as any);
        });

      mockFs.readFile.mockResolvedValue('- [x] Task completed');

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.success).toBe(true);
    });

    it('should calculate high confidence score with comprehensive evidence', async () => {
      const recentTime = new Date();
      
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      mockFs.listDirectory
        .mockResolvedValueOnce(['active-task'])
        .mockResolvedValueOnce(['PLAN.md', 'file1.js', 'file2.js', 'file3.js']);

      // Mock different timestamps for time tracking
      const baseTime = Date.now();
      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task') && !path.includes('.md') && !path.includes('.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: recentTime,
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for task files with different timestamps
        if (path.includes('PLAN.md')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(baseTime - 45 * 60 * 1000) // 45 min ago
          }) as any);
        }
        if (path.includes('file1.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(baseTime - 30 * 60 * 1000) // 30 min ago
          }) as any);
        }
        if (path.includes('file2.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(baseTime - 15 * 60 * 1000) // 15 min ago
          }) as any);
        }
        if (path.includes('file3.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(baseTime - 5 * 60 * 1000) // 5 min ago
          }) as any);
        }
        
        // Default file stats
        return Promise.resolve(testUtils.createMockStats({
          mtime: recentTime
        }) as any);
      });

      mockFs.readFile.mockResolvedValue(`
# Task Plan
- [x] Step 1 completed
- [x] Step 2 completed
- [x] Step 3 completed
- [ ] Step 4 pending
`);

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.evidence.filesModified).toBeGreaterThan(2);
      expect(result.evidence.mcpProgress).toBe(true);
      expect(result.evidence.timeSpent).toBeGreaterThan(0);
    });

    it('should calculate low confidence with minimal evidence', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(false);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      mockFs.listDirectory
        .mockResolvedValueOnce(['active-task'])
        .mockResolvedValueOnce(['INIT.md']);

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task') && !path.includes('.md')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago, not recent
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for files
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago, not recent
        }) as any);
      });

      mockFs.readFile.mockResolvedValue('# Initial setup');

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.success).toBe(false);
      expect(result.confidence).toBeLessThan(DEFAULT_CONFIDENCE_THRESHOLD);
      expect(result.warnings).toContain('No PLAN.md found - progress tracking missing');
      expect(result.warnings).toContain('No file modifications detected - no actual work evidence');
      expect(result.warnings).toContain('No recent file activity detected');
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory
        .mockResolvedValueOnce(['active-task'])
        .mockRejectedValue(new Error('Permission denied'));

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('-task') && !path.includes('.')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(),
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for files
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date()
        }) as any);
      });

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.success).toBe(false);
      expect(result.evidence.filesModified).toBe(0);
    });

    it('should generate appropriate warnings for missing evidence', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFs.listDirectory
        .mockResolvedValueOnce(['active-task'])
        .mockResolvedValueOnce([]);

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(),
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for other paths
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date()
        }) as any);
      });

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.warnings).toContain('No PLAN.md found - progress tracking missing');
      expect(result.warnings).toContain('No progress updates recorded - use report_progress tool');
      expect(result.warnings).toContain('No file modifications detected - no actual work evidence');
      expect(result.warnings).toContain('No time tracking evidence - task completion appears instant');
      expect(result.warnings).toContain('No recent file activity detected');
    });

    it('should provide specific recommendations based on confidence', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path === '/test/comm/test-agent/active-task') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      mockFs.listDirectory.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') {
          return Promise.resolve(['active-task']);
        }
        return Promise.resolve(['file1.js']);
      });

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task') && !path.includes('.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(),
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for files
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date()
        }) as any);
      });

      mockFs.readFile.mockResolvedValue('# Plan without progress markers');

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.recommendation).toContain('report_progress tool');
    });

    it('should parse progress markers from PLAN.md correctly', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFs.listDirectory
        .mockResolvedValueOnce(['active-task'])
        .mockResolvedValueOnce(['PLAN.md']);

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task') && !path.includes('.md')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(),
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for files
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date()
        }) as any);
      });

      mockFs.readFile.mockResolvedValue(`
# Task Plan
- [x] Completed step 1
- [x] Completed step 2
- [ ] Pending step 3
- [ ] Pending step 4
`);

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.evidence.mcpProgress).toBe(true);
      expect(result.confidence).toBeGreaterThan(30);
    });

    it('should handle time calculation with multiple files', async () => {
      const baseTime = Date.now();
      
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path === '/test/comm/test-agent/active-task') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      mockFs.listDirectory.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') {
          return Promise.resolve(['active-task']);
        }
        return Promise.resolve(['file1.js', 'file2.js', 'file3.js']);
      });

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task') && !path.includes('.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(baseTime),
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats with specific timestamps for each file
        if (path.includes('file1.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(baseTime - 45 * 60 * 1000) // 45 min ago
          }) as any);
        }
        if (path.includes('file2.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(baseTime - 30 * 60 * 1000) // 30 min ago
          }) as any);
        }
        if (path.includes('file3.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(baseTime - 5 * 60 * 1000) // 5 min ago
          }) as any);
        }
        
        // Default file stats
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date(baseTime)
        }) as any);
      });

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.evidence.timeSpent).toBeGreaterThan(30 * 60); // At least 30 minutes
      expect(result.evidence.timeSpent).toBeLessThan(50 * 60);   // Less than 50 minutes
    });

    it('should cap time tracking at maximum', async () => {
      const baseTime = Date.now();
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.listDirectory
        .mockResolvedValueOnce(['active-task'])
        .mockResolvedValueOnce(['file1.js', 'file2.js']);

      let fileCounter = 0;
      mockFs.getStats.mockImplementation(() => {
        fileCounter++;
        const times = [
          new Date(baseTime),                    // directory
          new Date(baseTime - 5 * 60 * 60 * 1000), // 5 hours ago
          new Date(baseTime)                     // now
        ];
        
        return Promise.resolve(testUtils.createMockStats({
          mtime: times[fileCounter - 1]
        }) as any);
      });

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.evidence.timeSpent).toBeLessThanOrEqual(180 * 60); // Max 3 hours
    });

    it('should handle empty or malformed PLAN.md', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path === '/test/comm/test-agent/active-task') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      mockFs.listDirectory.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') {
          return Promise.resolve(['active-task']);
        }
        return Promise.resolve(['PLAN.md']);
      });

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task') && !path.includes('.md')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(),
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for files
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date()
        }) as any);
      });

      mockFs.readFile.mockResolvedValue(''); // Empty plan

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.evidence.mcpProgress).toBe(false);
      expect(result.warnings).toContain('No progress updates recorded - use report_progress tool');
    });

    it('should handle tasks without mtime in stats', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path === '/test/comm/test-agent/active-task') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });
      mockFs.listDirectory.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') {
          return Promise.resolve(['active-task']);
        }
        return Promise.resolve(['file1.js']);
      });

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task') && !path.includes('.js')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: undefined as any, // No modification time
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for files
        return Promise.resolve(testUtils.createMockStats({
          mtime: undefined as any // No modification time
        }) as any);
      });

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.evidence.timeSpent).toBe(0);
      expect(result.warnings).toContain('No time tracking evidence - task completion appears instant');
    });

    it('should skip non-directory entries when finding active tasks', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path === '/test/comm/test-agent/task-dir') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });
      mockFs.listDirectory.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') {
          return Promise.resolve(['task-dir', 'some-file.txt']);
        }
        return Promise.resolve(['PLAN.md']);
      });

      let getStatsCallCount = 0;
      mockFs.getStats.mockImplementation((path: string) => {
        getStatsCallCount++;
        
        // 'task-dir' should be a directory, 'some-file.txt' should not
        const isDirectory = path.includes('task-dir') && !path.includes('some-file.txt');
        
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date(),
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory
        }) as any);
      });

      mockFs.readFile.mockResolvedValue('- [x] Some work');

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      expect(result.success).toBe(true);
    });
  });

  describe('DEFAULT_CONFIDENCE_THRESHOLD', () => {
    it('should be set to 70', () => {
      expect(DEFAULT_CONFIDENCE_THRESHOLD).toBe(70);
    });
  });

  describe('Confidence scoring', () => {
    it('should award points for plan existence', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        return Promise.resolve(false);
      });

      mockFs.listDirectory
        .mockResolvedValueOnce(['active-task'])
        .mockResolvedValueOnce(['PLAN.md']);

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('-task') && !path.includes('.')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(),
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for files
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date()
        }) as any);
      });

      mockFs.readFile.mockResolvedValue('# Plan exists');

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      // Should have some confidence just for having a plan file
      expect(result.confidence).toBeGreaterThan(15);
    });

    it('should award additional points for progress updates', async () => {
      mockFs.pathExists.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') return Promise.resolve(true);
        if (path === '/test/comm/test-agent/active-task') return Promise.resolve(true);
        if (path.includes('PLAN.md')) return Promise.resolve(true);
        if (path.includes('DONE.md') || path.includes('ERROR.md')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      mockFs.listDirectory.mockImplementation((path: string) => {
        if (path === '/test/comm/test-agent') {
          return Promise.resolve(['active-task']);
        }
        return Promise.resolve(['PLAN.md']);
      });

      mockFs.getStats.mockImplementation((path: string) => {
        // Return directory stats for task directory
        if (path.includes('active-task') && !path.includes('.md')) {
          return Promise.resolve(testUtils.createMockStats({
            mtime: new Date(),
            isDirectory: () => true,
            isFile: () => false
          }) as any);
        }
        
        // Return file stats for files
        return Promise.resolve(testUtils.createMockStats({
          mtime: new Date()
        }) as any);
      });

      mockFs.readFile.mockResolvedValue('- [x] Step 1\n- [x] Step 2\n- [ ] Step 3');

      const result = await verifyAgentWork(mockConfig, 'test-agent');

      // Should have higher confidence with progress markers
      expect(result.confidence).toBeGreaterThan(40);
    });
  });
});