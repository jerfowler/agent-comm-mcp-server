/**
 * Safe fs-extra wrapper with fallback mechanisms
 * Resolves Issue #9: fs-extra runtime errors in MCP tools
 * 
 * This module provides a robust interface to filesystem operations that works
 * regardless of ESM/CJS import issues or module resolution conflicts.
 * 
 * ESLint disabled for 'any' types - required for dynamic module loading fallback
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-restricted-syntax */

import { Stats, MakeDirectoryOptions, Mode } from 'fs';
import debug from 'debug';

const log = debug('agent-comm:utils:fsextrasafe');
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */

import { promises as nodeFs, mkdirSync } from 'fs';

// Type definitions for our safe filesystem interface
export interface SafeFsInterface {
  pathExists(filePath: string): Promise<boolean>;
  readdir(dirPath: string): Promise<string[]>;
  writeFile(filePath: string, data: string): Promise<void>;
  readFile(filePath: string, encoding?: string): Promise<string>;
  stat(filePath: string): Promise<Stats>;
  remove(filePath: string): Promise<void>;
  ensureDir(dirPath: string): Promise<void>;
}

/**
 * Diagnostic information about fs-extra availability
 */
export interface FsExtraDiagnostics {
  fsExtraImported: boolean;
  methodsAvailable: {
    pathExists: boolean;
    readdir: boolean;
    writeFile: boolean;
    readFile: boolean;
    stat: boolean;
    remove: boolean;
    ensureDir: boolean;
  };
  fallbackMode: boolean;
  importMethod: 'es-module' | 'dynamic-import' | 'require' | 'node-builtin';
  error: string | undefined;
}

// Type for fs-extra module interface
interface FsExtraModule {
  pathExists: (filePath: string) => Promise<boolean>;
  readdir: (dirPath: string) => Promise<string[]>;
  writeFile: (filePath: string, data: string) => Promise<void>;
  readFile: (filePath: string, encoding?: string) => Promise<string>;
  stat: (filePath: string) => Promise<Stats>;
  remove: (filePath: string) => Promise<void>;
  ensureDir: (dirPath: string) => Promise<void>;
  appendFile?: (filePath: string, data: string) => Promise<void>;
  move?: (src: string, dest: string, options?: Record<string, unknown>) => Promise<void>;
  copy?: (src: string, dest: string, options?: Record<string, unknown>) => Promise<void>;
  mkdtemp?: (prefix: string) => Promise<string>;
  mkdir?: (dirPath: string, options?: Mode | MakeDirectoryOptions | null) => Promise<void>;
  chmod?: (filePath: string, mode: string | number) => Promise<void>;
  utimes?: (filePath: string, atime: Date | number, mtime: Date | number) => Promise<void>;
}

/**
 * Internal class to handle multiple import strategies for fs-extra
 */
class FsExtraImporter {
  private importedFs: FsExtraModule | null = null;
  private importMethod: FsExtraDiagnostics['importMethod'] = 'node-builtin';
  private importError: string | undefined;

  /**
   * Try multiple import strategies to get fs-extra
   */
  async tryImportFsExtra(): Promise<FsExtraModule | null> {
    log('tryImportFsExtra called');
    // Strategy 1: Try ES module import (current approach)
    try {
      const fsExtra = await import('fs-extra');
      if (this.validateFsExtraModule(fsExtra)) {
        this.importedFs = fsExtra;
        this.importMethod = 'es-module';
        return fsExtra;
      }
    } catch (error) {
      this.importError = `ES module import failed: ${(error as Error).message}`;
    }

    // Strategy 2: Try dynamic import with default
    try {
      const fsExtra = await import('fs-extra');
      const fsExtraDefault = (fsExtra as { default?: FsExtraModule }).default ?? fsExtra;
      if (this.validateFsExtraModule(fsExtraDefault)) {
        this.importedFs = fsExtraDefault;
        this.importMethod = 'dynamic-import';
        return fsExtraDefault;
      }
    } catch (error) {
      this.importError = `Dynamic import failed: ${(error as Error).message}`;
    }

    // Strategy 3: Try require (CommonJS fallback)
    try {
      // Only try require in Node.js environment
      if (typeof require !== 'undefined') {
        const fsExtra = require('fs-extra');
        if (this.validateFsExtraModule(fsExtra)) {
          this.importedFs = fsExtra;
          this.importMethod = 'require';
          return fsExtra;
        }
      }
    } catch (error) {
      this.importError = `CommonJS require failed: ${(error as Error).message}`;
    }

    // All fs-extra import strategies failed - will use Node.js built-ins
    return null;
  }

  /**
   * Validate that an fs-extra module has the required methods
   */
  private validateFsExtraModule(fsModule: unknown): fsModule is FsExtraModule {
    if (!fsModule || typeof fsModule !== 'object') {
      return false;
    }

    const requiredMethods = ['pathExists', 'readdir', 'writeFile', 'readFile', 'stat', 'remove', 'ensureDir'];
    
    for (const method of requiredMethods) {
      if (typeof (fsModule as Record<string, unknown>)[method] !== 'function') {
        return false;
      }
    }

    return true;
  }

  getImportMethod(): FsExtraDiagnostics['importMethod'] {
    return this.importMethod;
  }

  getImportError(): string | undefined {
    return this.importError;
  }

  getImportedFs(): FsExtraModule | null {
    return this.importedFs;
  }
}

/**
 * Safe filesystem implementation with Node.js built-in fallbacks
 */
class SafeFileSystem implements SafeFsInterface {
  private fsExtra: FsExtraModule | null = null;
  private fallbackMode = false;
  private importer = new FsExtraImporter();

  constructor() {
    // Initialize fs-extra import attempt
    this.initializeFsExtra();
  }

  private async initializeFsExtra(): Promise<void> {
    try {
      this.fsExtra = await this.importer.tryImportFsExtra();
      this.fallbackMode = this.fsExtra === null;
    } catch (error) {
      this.fallbackMode = true;
    }
  }

  /**
   * Ensure fs-extra is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.fsExtra === null && !this.fallbackMode) {
      await this.initializeFsExtra();
    }
  }

  async pathExists(filePath: string): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.pathExists) {
      try {
        return await this.fsExtra.pathExists(filePath);
      } catch (error) {
        // Fallback to Node.js implementation if fs-extra fails
        console.warn(`fs-extra.pathExists failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    try {
      await nodeFs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readdir(dirPath: string): Promise<string[]> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.readdir) {
      try {
        return await this.fsExtra.readdir(dirPath);
      } catch (error) {
        // Fallback to Node.js implementation if fs-extra fails
        console.warn(`fs-extra.readdir failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    return await nodeFs.readdir(dirPath);
  }

  async writeFile(filePath: string, data: string): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.writeFile) {
      try {
        await this.fsExtra.writeFile(filePath, data);
        return;
      } catch (error) {
        // Fallback to Node.js implementation if fs-extra fails
        console.warn(`fs-extra.writeFile failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    await nodeFs.writeFile(filePath, data, 'utf8');
  }

  async readFile(filePath: string, encoding = 'utf8'): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.readFile) {
      try {
        return await this.fsExtra.readFile(filePath, encoding);
      } catch (error) {
        // Fallback to Node.js implementation if fs-extra fails
        console.warn(`fs-extra.readFile failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    return await nodeFs.readFile(filePath, { encoding: encoding as BufferEncoding });
  }

  async stat(filePath: string): Promise<Stats> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.stat) {
      try {
        return await this.fsExtra.stat(filePath);
      } catch (error) {
        // Fallback to Node.js implementation if fs-extra fails
        console.warn(`fs-extra.stat failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    return await nodeFs.stat(filePath);
  }

  async remove(filePath: string): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.remove) {
      try {
        await this.fsExtra.remove(filePath);
        return;
      } catch (error) {
        // Fallback to Node.js implementation if fs-extra fails
        console.warn(`fs-extra.remove failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback - handle both files and directories
    try {
      const stats = await nodeFs.stat(filePath);
      if (stats.isDirectory()) {
        await nodeFs.rmdir(filePath, { recursive: true });
      } else {
        await nodeFs.unlink(filePath);
      }
    } catch (error) {
      // If file doesn't exist, that's fine for remove operation
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.ensureDir) {
      try {
        await this.fsExtra.ensureDir(dirPath);
        return;
      } catch (error) {
        // Fallback to Node.js implementation if fs-extra fails
        console.warn(`fs-extra.ensureDir failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    try {
      await nodeFs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // EEXIST is fine - directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async appendFile(filePath: string, data: string): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.appendFile) {
      try {
        await this.fsExtra.appendFile(filePath, data);
        return;
      } catch (error) {
        console.warn(`fs-extra.appendFile failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    await nodeFs.appendFile(filePath, data, 'utf8');
  }

  async move(src: string, dest: string, options?: Record<string, unknown>): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.move) {
      try {
        await this.fsExtra.move(src, dest, options);
        return;
      } catch (error) {
        console.warn(`fs-extra.move failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback - rename is atomic move operation
    try {
      await nodeFs.rename(src, dest);
    } catch (error) {
      // If cross-device link error, fallback to copy + remove
      if ((error as NodeJS.ErrnoException).code === 'EXDEV') {
        await nodeFs.copyFile(src, dest);
        await nodeFs.unlink(src);
      } else {
        throw error;
      }
    }
  }

  async copy(src: string, dest: string, options?: Record<string, unknown>): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.copy) {
      try {
        await this.fsExtra.copy(src, dest, options);
        return;
      } catch (error) {
        console.warn(`fs-extra.copy failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback - copy file
    try {
      await nodeFs.copyFile(src, dest);
    } catch (error) {
      // EISDIR means we're trying to copy a directory - re-throw with clear message
      if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
        throw error; // Directory copying not supported in Node.js fallback
      }
      throw error;
    }
  }


  async mkdtemp(prefix: string): Promise<string> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.mkdtemp) {
      try {
        return await this.fsExtra.mkdtemp(prefix);
      } catch (error) {
        console.warn(`fs-extra.mkdtemp failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    return await nodeFs.mkdtemp(prefix);
  }

  async mkdir(dirPath: string, options?: Mode | MakeDirectoryOptions | null): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.mkdir) {
      try {
        await this.fsExtra.mkdir(dirPath, options);
        return;
      } catch (error) {
        console.warn(`fs-extra.mkdir failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    if (typeof options === 'object' && options !== null) {
      // options is MakeDirectoryOptions
      await nodeFs.mkdir(dirPath, { recursive: true, ...options });
    } else if (options !== null && options !== undefined) {
      // options is a Mode (string/number)
      await nodeFs.mkdir(dirPath, { recursive: true, mode: options });
    } else {
      // options is null/undefined
      await nodeFs.mkdir(dirPath, { recursive: true });
    }
  }

  async chmod(filePath: string, mode: string | number): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.chmod) {
      try {
        await this.fsExtra.chmod(filePath, mode);
        return;
      } catch (error) {
        console.warn(`fs-extra.chmod failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    await nodeFs.chmod(filePath, mode);
  }

  async utimes(filePath: string, atime: Date | number, mtime: Date | number): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.fallbackMode && this.fsExtra?.utimes) {
      try {
        await this.fsExtra.utimes(filePath, atime, mtime);
        return;
      } catch (error) {
        console.warn(`fs-extra.utimes failed, using Node.js fallback: ${(error as Error).message}`);
      }
    }

    // Node.js built-in fallback
    await nodeFs.utimes(filePath, atime, mtime);
  }

  /**
   * Get diagnostic information about fs-extra availability
   */
  async getDiagnostics(): Promise<FsExtraDiagnostics> {
    await this.ensureInitialized();

    const diagnostics: FsExtraDiagnostics = {
      fsExtraImported: !!this.fsExtra,
      methodsAvailable: {
        pathExists: typeof this.fsExtra?.pathExists === 'function',
        readdir: typeof this.fsExtra?.readdir === 'function',
        writeFile: typeof this.fsExtra?.writeFile === 'function',
        readFile: typeof this.fsExtra?.readFile === 'function',
        stat: typeof this.fsExtra?.stat === 'function',
        remove: typeof this.fsExtra?.remove === 'function',
        ensureDir: typeof this.fsExtra?.ensureDir === 'function'
      },
      fallbackMode: this.fallbackMode,
      importMethod: this.importer.getImportMethod(),
      error: this.importer.getImportError()
    };

    return diagnostics;
  }
}

// Create singleton instance
const safeFs = new SafeFileSystem();

// Export the safe filesystem interface
export const pathExists = (filePath: string) => safeFs.pathExists(filePath);
export const readdir = (dirPath: string) => safeFs.readdir(dirPath);
export const writeFile = (filePath: string, data: string) => safeFs.writeFile(filePath, data);
export const readFile = (filePath: string, encoding?: string) => safeFs.readFile(filePath, encoding);
export const stat = (filePath: string) => safeFs.stat(filePath);
export const remove = (filePath: string) => safeFs.remove(filePath);
export const ensureDir = (dirPath: string) => safeFs.ensureDir(dirPath);
export const appendFile = (filePath: string, data: string) => safeFs.appendFile(filePath, data);
export const move = (src: string, dest: string, options?: Record<string, unknown>) => safeFs.move(src, dest, options);
export const copy = (src: string, dest: string, options?: Record<string, unknown>) => safeFs.copy(src, dest, options);
export const mkdtemp = (prefix: string) => safeFs.mkdtemp(prefix);
export const mkdir = (dirPath: string, options?: Mode | MakeDirectoryOptions | null) => safeFs.mkdir(dirPath, options);
export const chmod = (filePath: string, mode: string | number) => safeFs.chmod(filePath, mode);
export const utimes = (filePath: string, atime: Date | number, mtime: Date | number) => safeFs.utimes(filePath, atime, mtime);

// Synchronous version for backwards compatibility (used in server initialization)
export const ensureDirSync = (dirPath: string) => {
  try {
    mkdirSync(dirPath, { recursive: true });
  } catch (error) {
    // If directory already exists, that's fine
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
};

// Export diagnostic function
export const getFsExtraDiagnostics = () => safeFs.getDiagnostics();

// Export Stats interface for compatibility - now uses Node.js built-in type
export { Stats };

// Export the safe filesystem instance for advanced usage
export { safeFs };

// Default export for compatibility
export default safeFs;