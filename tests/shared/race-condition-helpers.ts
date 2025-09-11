/**
 * Race Condition Helpers
 * Utilities to handle file system race conditions in tests
 */

import * as fs from '../../src/utils/fs-extra-safe.js';
import * as path from 'path';

/**
 * File system test helper with retry logic and race condition protection
 */
export const FileSystemTestHelper = {
  /**
   * Retry an operation with exponential backoff
   */
  async waitForFileSystem<T>(
    operation: () => Promise<T>, 
    maxRetries = 5,
    baseDelay = 100
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (i === maxRetries - 1) {
          throw new Error(`Operation failed after ${maxRetries} retries. Last error: ${lastError.message}`);
        }
        
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new Error('Operation failed');
  },

  /**
   * Ensure directory exists with retry logic
   */
  async ensureDirectoryExists(dir: string): Promise<void> {
    await FileSystemTestHelper.waitForFileSystem(async () => {
      await fs.ensureDir(dir);
      
      // Verify directory actually exists
      const exists = await fs.pathExists(dir);
      if (!exists) {
        throw new Error(`Directory ${dir} was not created successfully`);
      }
      
      // Verify we can write to it
      const testFile = path.join(dir, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
    });
  },

  /**
   * Atomic file write with verification
   */
  async writeFileAtomic(filePath: string, content: string): Promise<void> {
    await FileSystemTestHelper.waitForFileSystem(async () => {
      const dir = path.dirname(filePath);
      await fs.ensureDir(dir);
      
      const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36)}`;
      
      try {
        await fs.writeFile(tempPath, content);
        await fs.move(tempPath, filePath);
        
        // Verify file exists and has correct content
        const written = await fs.readFile(filePath, 'utf-8');
        if (written !== content) {
          throw new Error('File content mismatch after atomic write');
        }
      } catch (error) {
        // Cleanup temp file if it exists
        try {
          await fs.remove(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    });
  },

  /**
   * Safe file read with retry
   */
  async readFileSafe(filePath: string): Promise<string> {
    return await FileSystemTestHelper.waitForFileSystem(async () => {
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File ${filePath} does not exist`);
      }
      
      return await fs.readFile(filePath, 'utf-8');
    });
  },

  /**
   * Safe JSON read with retry
   */
  async readJsonSafe<T = unknown>(filePath: string): Promise<T> {
    return await FileSystemTestHelper.waitForFileSystem(async () => {
      if (!await fs.pathExists(filePath)) {
        throw new Error(`JSON file ${filePath} does not exist`);
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      try {
        return JSON.parse(content) as T;
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`Failed to parse JSON from ${filePath}: ${errorMessage}`);
      }
    });
  },

  /**
   * Safe directory removal with retry
   */
  async removeSafe(dirPath: string): Promise<void> {
    if (!await fs.pathExists(dirPath)) {
      return; // Already removed
    }

    await FileSystemTestHelper.waitForFileSystem(async () => {
      await fs.remove(dirPath);
      
      // Verify removal
      const exists = await fs.pathExists(dirPath);
      if (exists) {
        throw new Error(`Failed to remove ${dirPath}`);
      }
    });
  },

  /**
   * Create test directory structure with retry
   */
  async createTestStructure(baseDir: string, structure: Record<string, unknown>): Promise<void> {
    await FileSystemTestHelper.ensureDirectoryExists(baseDir);

    for (const [name, content] of Object.entries(structure)) {
      const fullPath = path.join(baseDir, name);

      if (typeof content === 'object' && content !== null) {
        // It's a directory
        await FileSystemTestHelper.createTestStructure(fullPath, content as Record<string, unknown>);
      } else {
        // It's a file
        await FileSystemTestHelper.writeFileAtomic(fullPath, String(content));
      }
    }
  },

  /**
   * Wait for condition to be true with timeout
   */
  async waitForCondition(
    condition: () => Promise<boolean> | boolean,
    timeout = 5000,
    checkInterval = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition();
        if (result) {
          return;
        }
      } catch {
        // Continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Copy directory with retry logic
   */
  async copyDirectorySafe(src: string, dest: string): Promise<void> {
    await FileSystemTestHelper.waitForFileSystem(async () => {
      await fs.copy(src, dest);
      
      // Verify copy was successful
      const srcExists = await fs.pathExists(src);
      const destExists = await fs.pathExists(dest);
      
      if (!srcExists) {
        throw new Error(`Source directory ${src} does not exist`);
      }
      if (!destExists) {
        throw new Error(`Copy failed: destination ${dest} does not exist`);
      }
    });
  },

  /**
   * Move file/directory with retry logic
   */
  async moveSafe(src: string, dest: string): Promise<void> {
    await FileSystemTestHelper.waitForFileSystem(async () => {
      await fs.move(src, dest);
      
      // Verify move was successful
      const srcExists = await fs.pathExists(src);
      const destExists = await fs.pathExists(dest);
      
      if (srcExists) {
        throw new Error(`Move failed: source ${src} still exists`);
      }
      if (!destExists) {
        throw new Error(`Move failed: destination ${dest} does not exist`);
      }
    });
  }
};

/**
 * Mock transport for MCP protocol testing
 */
export class MockMCPTransport {
  private responses = new Map<number, unknown>();
  private requestId = 1;

  /**
   * Send a mock MCP request and return response
   */
  async sendRequest(request: unknown): Promise<unknown> {
    const id = this.requestId++;
    const requestWithId = { ...(request as Record<string, unknown>), id };

    // Simulate processing delay  
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Return mock response
    return {
      jsonrpc: '2.0',
      id: (requestWithId as { id: number }).id,
      result: this.responses.get(id) || { success: true }
    };
  }

  /**
   * Set mock response for next request
   */
  setMockResponse(response: unknown): void {
    this.responses.set(this.requestId, response);
  }

  /**
   * Clear all mock responses
   */
  clearMockResponses(): void {
    this.responses.clear();
  }
}

/**
 * Test timeout helper
 */
export const TestTimeout = {
  /**
   * Run operation with timeout
   */
  async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    errorMessage?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMessage ?? `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  },

  /**
   * Add timeout to any function
   */
  withTimeoutWrapper<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    timeoutMs: number
  ): T {
    return ((...args: Parameters<T>) => {
      return TestTimeout.withTimeout(() => fn(...args), timeoutMs);
    }) as T;
  }
};

/**
 * Helper to create isolated test environments
 */
export class TestEnvironment {
  public tempDir = '';
  private originalEnv: Record<string, string | undefined> = {};

  /**
   * Set up isolated test environment
   */
  async setup(prefix = 'test-env-'): Promise<void> {
    // Create temp directory
    const os = await import('os');
    const path = await import('path');
    
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    
    // Backup environment variables
    this.originalEnv = { ...process.env };
    
    // Set test environment
    process.env['AGENT_COMM_DIR'] = this.tempDir;
    process.env['AGENT_COMM_ENABLE_ARCHIVING'] = 'true';
    process.env['AGENT_COMM_ARCHIVE_DIR'] = path.join(this.tempDir, '.archive');
  }

  /**
   * Clean up test environment
   */
  async cleanup(): Promise<void> {
    // Restore environment
    process.env = this.originalEnv;
    
    // Remove temp directory
    if (this.tempDir) {
      await FileSystemTestHelper.removeSafe(this.tempDir);
      this.tempDir = '';
    }
  }

  /**
   * Get path within test environment
   */
  getPath(...segments: string[]): string {
    return path.join(this.tempDir, ...segments);
  }

  /**
   * Create file in test environment
   */
  async createFile(relativePath: string, content: string): Promise<string> {
    const filePath = this.getPath(relativePath);
    await FileSystemTestHelper.writeFileAtomic(filePath, content);
    return filePath;
  }

  /**
   * Create directory in test environment
   */
  async createDirectory(relativePath: string): Promise<string> {
    const dirPath = this.getPath(relativePath);
    await FileSystemTestHelper.ensureDirectoryExists(dirPath);
    return dirPath;
  }
}