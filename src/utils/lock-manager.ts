/**
 * Lock Manager utility for coordinating concurrent tool operations
 * Provides file-based locking mechanism with timeout and cleanup capabilities
 */

import * as fs from './fs-extra-safe.js';
import * as path from 'path';
import { AgentCommError } from '../types.js';

export interface LockInfo {
  tool: string;
  pid: number;
  timestamp: number;
  lockId: string;
}

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  lockFile?: string;
  reason?: string;
  existingLock?: LockInfo;
}

export interface ReleaseResult {
  released: boolean;
  reason?: string;
}

export interface LockStatus {
  isLocked: boolean;
  lockInfo: LockInfo | null;
  isStale?: boolean;
}

export interface CleanupResult {
  cleaned: boolean;
  removedFiles: string[];
}

export class LockManager {
  private readonly lockTimeout: number; // in milliseconds
  private static readonly LOCK_FILE_NAME = '.sync.lock';

  constructor(timeoutMs: number = 30000) {
    this.lockTimeout = timeoutMs;
  }

  /**
   * Attempt to acquire a lock for the given task directory
   */
  async acquireLock(taskDir: string, toolName: string): Promise<LockResult> {
    if (!taskDir || taskDir.trim() === '') {
      throw new AgentCommError('taskDir is required', 'INVALID_INPUT');
    }

    if (!toolName || toolName.trim() === '') {
      throw new AgentCommError('toolName is required', 'INVALID_INPUT');
    }

    const lockFile = path.join(taskDir, LockManager.LOCK_FILE_NAME);

    try {
      // Check if lock already exists
      const status = await this.checkLock(taskDir);

      if (status.isLocked) {
        if (status.isStale) {
          // Cleanup stale lock first
          await this.cleanupStaleLocks(taskDir);
        } else {
          // Active lock exists
          return {
            acquired: false,
            reason: `Task is currently locked by ${status.lockInfo?.tool} (PID: ${status.lockInfo?.pid}, Lock ID: ${status.lockInfo?.lockId})`,
            existingLock: status.lockInfo!
          };
        }
      } else if (await fs.pathExists(lockFile)) {
        // Lock file exists but checkLock returned not locked (malformed file)
        // Clean up malformed file
        await fs.remove(lockFile);
      }

      // Create new lock
      const lockId = this.generateLockId();
      const lockData: LockInfo = {
        tool: toolName,
        pid: process.pid,
        timestamp: Date.now(),
        lockId
      };

      await fs.writeFile(lockFile, JSON.stringify(lockData, null, 2));

      return {
        acquired: true,
        lockId,
        lockFile
      };

    } catch (error) {
      throw new AgentCommError(
        `Failed to acquire lock: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOCK_ERROR'
      );
    }
  }

  /**
   * Release a previously acquired lock
   */
  async releaseLock(taskDir: string, lockId: string): Promise<ReleaseResult> {
    if (!taskDir || taskDir.trim() === '') {
      throw new AgentCommError('taskDir is required', 'INVALID_INPUT');
    }

    if (!lockId || lockId.trim() === '') {
      throw new AgentCommError('lockId is required', 'INVALID_INPUT');
    }

    const lockFile = path.join(taskDir, LockManager.LOCK_FILE_NAME);

    try {
      // Check if lock file exists
      if (!await fs.pathExists(lockFile)) {
        return {
          released: true,
          reason: 'Lock already released (no lock file found)'
        };
      }

      // Read and verify lock ownership
      const lockContent = await fs.readFile(lockFile, 'utf8');
      let lockData: LockInfo;

      try {
        lockData = JSON.parse(lockContent) as LockInfo;
      } catch {
        // Malformed lock file - remove it
        await fs.remove(lockFile);
        return {
          released: true,
          reason: 'Malformed lock file removed'
        };
      }

      // Verify ownership
      if (lockData.lockId !== lockId || lockData.pid !== process.pid) {
        return {
          released: false,
          reason: `Cannot release lock: not owner (expected PID: ${process.pid}, lockId: ${lockId}, found PID: ${lockData.pid}, lockId: ${lockData.lockId})`
        };
      }

      // Remove lock file
      await fs.remove(lockFile);

      return {
        released: true
      };

    } catch (error) {
      throw new AgentCommError(
        `Failed to release lock: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOCK_ERROR'
      );
    }
  }

  /**
   * Check lock status for a task directory
   */
  async checkLock(taskDir: string): Promise<LockStatus> {
    if (!taskDir || taskDir.trim() === '') {
      throw new AgentCommError('taskDir is required', 'INVALID_INPUT');
    }

    const lockFile = path.join(taskDir, LockManager.LOCK_FILE_NAME);

    try {
      if (!await fs.pathExists(lockFile)) {
        return {
          isLocked: false,
          lockInfo: null,
          isStale: false
        };
      }

      // Check lock file age
      const stats = await fs.stat(lockFile);
      const age = Date.now() - stats.mtime.getTime();
      const isStale = age > this.lockTimeout;

      // Read lock content
      let lockData: LockInfo;
      try {
        const lockContent = await fs.readFile(lockFile, 'utf8');
        lockData = JSON.parse(lockContent) as LockInfo;
      } catch {
        // Malformed lock file
        return {
          isLocked: false,
          lockInfo: null,
          isStale: false
        };
      }

      return {
        isLocked: true,
        lockInfo: lockData,
        isStale
      };

    } catch (error) {
      throw new AgentCommError(
        `Failed to check lock: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOCK_ERROR'
      );
    }
  }

  /**
   * Clean up stale locks in the task directory
   */
  async cleanupStaleLocks(taskDir: string): Promise<CleanupResult> {
    if (!taskDir || taskDir.trim() === '') {
      throw new AgentCommError('taskDir is required', 'INVALID_INPUT');
    }

    const removedFiles: string[] = [];
    const processedFiles = new Set<string>();

    try {
      // Check for other potential lock files (comprehensive cleanup)
      try {
        const files = await fs.readdir(taskDir);
        const lockFiles = files.filter(f => f.endsWith('.lock'));

        for (const file of lockFiles) {
          const filePath = path.join(taskDir, file);
          
          // Skip if already processed
          if (processedFiles.has(filePath)) {
            continue;
          }
          processedFiles.add(filePath);
          
          try {
            if (await fs.pathExists(filePath)) {
              const stats = await fs.stat(filePath);
              const age = Date.now() - stats.mtime.getTime();

              if (age > this.lockTimeout) {
                await fs.remove(filePath);
                removedFiles.push(filePath);
              }
            }
          } catch (error) {
            // Handle race conditions gracefully
            if (!(error instanceof Error && error.message.includes('ENOENT'))) {
              // Log but don't fail the entire cleanup
              continue;
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist or can't be read - not a critical error for cleanup
        // Just continue with what we could clean
      }

      return {
        cleaned: removedFiles.length > 0,
        removedFiles
      };

    } catch (error) {
      throw new AgentCommError(
        `Failed to cleanup stale locks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOCK_ERROR'
      );
    }
  }

  /**
   * Generate a unique lock ID
   */
  private generateLockId(): string {
    return `lock-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}