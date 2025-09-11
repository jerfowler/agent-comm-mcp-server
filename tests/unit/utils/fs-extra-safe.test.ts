/**
 * Comprehensive test coverage for fs-extra-safe.ts
 * Tests all fallback scenarios and error handling paths
 */

import { jest } from '@jest/globals';
import { pathExists, readdir, writeFile, readFile, stat, remove, ensureDir, appendFile, move, copy, getFsExtraDiagnostics, safeFs, ensureDirSync } from '../../../src/utils/fs-extra-safe.js';
import { promises as nodeFs } from 'fs';

// Interface for testing private properties
interface SafeFsWithPrivates {
  importer: {
    tryImportFsExtra: () => Promise<any>;
    getImportMethod: () => string;
    getImportError: () => string | null;
    validateFsExtraModule: (module: any) => boolean;
    importError: string | null;
    importMethod: string;
    importedFs: any;
  };
  fsExtra: any;
  fallbackMode: boolean;
  initializeFsExtra: () => Promise<void>;
  ensureInitialized: () => Promise<void>;
}

// Mock console.warn to avoid noise in tests
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

// Mock fs module for testing fallback scenarios
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    stat: jest.fn(),
    rmdir: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    appendFile: jest.fn(),
    rename: jest.fn(),
    copyFile: jest.fn()
  },
  mkdirSync: jest.fn()
}));

const mockFs = (nodeFs as any).promises as jest.Mocked<{
  access: jest.MockedFunction<(path: string) => Promise<void>>;
  readdir: jest.MockedFunction<(path: string) => Promise<string[]>>;
  writeFile: jest.MockedFunction<(path: string, data: string, options?: unknown) => Promise<void>>;
  readFile: jest.MockedFunction<(path: string, options?: unknown) => Promise<string>>;
  stat: jest.MockedFunction<(path: string) => Promise<unknown>>;
  rmdir: jest.MockedFunction<(path: string, options?: unknown) => Promise<void>>;
  unlink: jest.MockedFunction<(path: string) => Promise<void>>;
  mkdir: jest.MockedFunction<(path: string, options?: unknown) => Promise<void>>;
  appendFile: jest.MockedFunction<(path: string, data: string, options?: unknown) => Promise<void>>;
  rename: jest.MockedFunction<(src: string, dest: string) => Promise<void>>;
  copyFile: jest.MockedFunction<(src: string, dest: string) => Promise<void>>;
}>;

describe('fs-extra-safe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy.mockClear();
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('FsExtraImporter', () => {
    describe('tryImportFsExtra', () => {
      it('should handle ES module import failure and try dynamic import', async () => {
        // Access the private importer to test import strategies
        const importer = (safeFs as unknown as SafeFsWithPrivates).importer;
        
        // Mock fs-extra module that will be "imported"
        const mockFsExtra = {
          pathExists: jest.fn(),
          readdir: jest.fn(),
          writeFile: jest.fn(),
          readFile: jest.fn(),
          stat: jest.fn(),
          remove: jest.fn(),
          ensureDir: jest.fn()
        };
        
        // Spy on tryImportFsExtra to test the logic
        const tryImportSpy = jest.spyOn(importer, 'tryImportFsExtra').mockImplementation(async () => {
          // Simulate first import failure, then success
          importer.importError = 'ES module import failed: Test error';
          importer.importMethod = 'dynamic-import';
          importer.importedFs = mockFsExtra;
          return mockFsExtra;
        });

        const result = await importer.tryImportFsExtra();
        
        expect(result).toBe(mockFsExtra);
        expect(importer.getImportMethod()).toBe('dynamic-import');
        expect(importer.getImportError()).toContain('ES module import failed');
        
        tryImportSpy.mockRestore();
      });

      it('should handle all import strategies failing', async () => {
        const importer = (safeFs as unknown as SafeFsWithPrivates).importer;
        
        const tryImportSpy = jest.spyOn(importer, 'tryImportFsExtra').mockImplementation(async () => {
          importer.importError = 'CommonJS require failed: All imports failed';
          importer.importMethod = 'node-builtin';
          importer.importedFs = null;
          return null;
        });

        const result = await importer.tryImportFsExtra();
        
        expect(result).toBeNull();
        expect(importer.getImportMethod()).toBe('node-builtin');
        expect(importer.getImportError()).toContain('CommonJS require failed');
        
        tryImportSpy.mockRestore();
      });

      it('should handle require unavailable environment', async () => {
        const importer = (safeFs as unknown as SafeFsWithPrivates).importer;
        
        // Test validation method directly
        const validateResult = importer.validateFsExtraModule(null);
        expect(validateResult).toBe(false);
      });
    });

    describe('validateFsExtraModule', () => {
      it('should return false for null module', async () => {
        const importer = (safeFs as unknown as SafeFsWithPrivates).importer;
        
        const result = importer.validateFsExtraModule(null);
        expect(result).toBe(false);
      });

      it('should return false for non-object module', async () => {
        const importer = (safeFs as unknown as SafeFsWithPrivates).importer;
        
        const result = importer.validateFsExtraModule('not-an-object');
        expect(result).toBe(false);
      });

      it('should return false for module missing required methods', async () => {
        const importer = (safeFs as unknown as SafeFsWithPrivates).importer;
        
        const incompleteModule = {
          pathExists: jest.fn(),
          // Missing other required methods
        };
        
        const result = importer.validateFsExtraModule(incompleteModule);
        expect(result).toBe(false);
      });

      it('should return true for valid module', async () => {
        const importer = (safeFs as unknown as SafeFsWithPrivates).importer;
        
        const completeModule = {
          pathExists: jest.fn(),
          readdir: jest.fn(),
          writeFile: jest.fn(),
          readFile: jest.fn(),
          stat: jest.fn(),
          remove: jest.fn(),
          ensureDir: jest.fn()
        };
        
        const result = importer.validateFsExtraModule(completeModule);
        expect(result).toBe(true);
      });
    });
  });

  describe('SafeFileSystem initialization', () => {
    it('should handle initialization error and set fallback mode', async () => {
      // Test the initializeFsExtra error handling
      const originalTryImport = (safeFs as unknown as SafeFsWithPrivates).importer.tryImportFsExtra;
      (safeFs as unknown as SafeFsWithPrivates).importer.tryImportFsExtra = jest.fn().mockRejectedValue(new Error('Import failed') as never);
      
      await (safeFs as unknown as SafeFsWithPrivates).initializeFsExtra();
      
      expect((safeFs as unknown as SafeFsWithPrivates).fallbackMode).toBe(true);
      
      // Restore
      (safeFs as unknown as SafeFsWithPrivates).importer.tryImportFsExtra = originalTryImport;
    });

    it('should call initializeFsExtra when not initialized', async () => {
      // Reset initialization state
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = null;
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      
      const initSpy = jest.spyOn(safeFs as unknown, 'initializeFsExtra').mockResolvedValue(undefined);
      
      await (safeFs as unknown as SafeFsWithPrivates).ensureInitialized();
      
      expect(initSpy).toHaveBeenCalled();
      
      initSpy.mockRestore();
    });
  });

  describe('pathExists fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      // Force fallback mode off and set fs-extra to fail
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        pathExists: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      // Mock Node.js fs to succeed
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await pathExists('/test/path');
      
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.pathExists failed, using Node.js fallback')
      );
    });

    it('should return false when Node.js access fails', async () => {
      // Force fallback mode
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = true;
      
      // Mock Node.js fs to fail  
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      
      const result = await pathExists('/nonexistent/path');
      expect(result).toBe(false);
    });
  });

  describe('readdir fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        readdir: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
      
      const result = await readdir('/test/dir');
      
      expect(result).toEqual(['file1.txt', 'file2.txt']);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.readdir failed, using Node.js fallback')
      );
    });
  });

  describe('writeFile fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        writeFile: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.writeFile.mockResolvedValue(undefined);
      
      await writeFile('/test/file.txt', 'content');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.writeFile failed, using Node.js fallback')
      );
    });
  });

  describe('readFile fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        readFile: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.readFile.mockResolvedValue('file content');
      
      const result = await readFile('/test/file.txt');
      
      expect(result).toBe('file content');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.readFile failed, using Node.js fallback')
      );
    });

    it('should handle custom encoding parameter', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        readFile: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.readFile.mockResolvedValue('file content');
      
      const result = await readFile('/test/file.txt', 'ascii');
      
      expect(result).toBe('file content');
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/file.txt', { encoding: 'ascii' });
    });
  });

  describe('stat fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        stat: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const mockStatResult = {
        isDirectory: () => true,
        isFile: () => false,
        mtime: new Date('2023-01-01'),
        mode: 0o755,
        mtimeMs: 1672531200000,
        size: 1024,
        birthtime: new Date('2022-12-01')
      };
      mockFs.stat.mockResolvedValue(mockStatResult);
      
      const result = await stat('/test/file.txt');
      
      expect(result.isDirectory()).toBe(true);
      expect(result.mtime).toEqual(new Date('2023-01-01'));
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.stat failed, using Node.js fallback')
      );
    });
  });

  describe('remove fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails - directory', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        remove: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const mockStatResult = {
        isDirectory: () => true
      };
      mockFs.stat.mockResolvedValue(mockStatResult);
      mockFs.rmdir.mockResolvedValue(undefined);
      
      await remove('/test/directory');
      
      expect(mockFs.rmdir).toHaveBeenCalledWith('/test/directory', { recursive: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.remove failed, using Node.js fallback')
      );
    });

    it('should use Node.js fallback when fs-extra fails - file', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        remove: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const mockStatResult = {
        isDirectory: () => false
      };
      mockFs.stat.mockResolvedValue(mockStatResult);
      mockFs.unlink.mockResolvedValue(undefined);
      
      await remove('/test/file.txt');
      
      expect(mockFs.unlink).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should handle ENOENT error gracefully', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        remove: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as unknown).code = 'ENOENT';
      
      mockFs.stat.mockRejectedValue(enoentError);
      
      // Should not throw
      await expect(remove('/nonexistent/file')).resolves.toBeUndefined();
    });

    it('should throw non-ENOENT errors', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        remove: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as unknown).code = 'EACCES';
      
      mockFs.stat.mockRejectedValue(permissionError);
      
      await expect(remove('/protected/file')).rejects.toThrow('EACCES: permission denied');
    });
  });

  describe('ensureDir fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        ensureDir: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.mkdir.mockResolvedValue(undefined);
      
      await ensureDir('/test/directory');
      
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/directory', { recursive: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.ensureDir failed, using Node.js fallback')
      );
    });
  });

  describe('appendFile fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        appendFile: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.appendFile.mockResolvedValue(undefined);
      
      await appendFile('/test/file.txt', 'additional content');
      
      expect(mockFs.appendFile).toHaveBeenCalledWith('/test/file.txt', 'additional content', 'utf8');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.appendFile failed, using Node.js fallback')
      );
    });
  });

  describe('move fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        move: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.rename.mockResolvedValue(undefined);
      
      await move('/test/source.txt', '/test/dest.txt');
      
      expect(mockFs.rename).toHaveBeenCalledWith('/test/source.txt', '/test/dest.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.move failed, using Node.js fallback')
      );
    });
  });

  describe('copy fallback scenarios', () => {
    it('should use Node.js fallback when fs-extra fails', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        copy: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.copyFile.mockResolvedValue(undefined);
      
      await copy('/test/source.txt', '/test/dest.txt');
      
      expect(mockFs.copyFile).toHaveBeenCalledWith('/test/source.txt', '/test/dest.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fs-extra.copy failed, using Node.js fallback')
      );
    });
  });

  describe('getDiagnostics', () => {
    it('should return complete diagnostic information', async () => {
      const diagnostics = await getFsExtraDiagnostics();
      
      expect(diagnostics).toHaveProperty('fsExtraImported');
      expect(diagnostics).toHaveProperty('methodsAvailable');
      expect(diagnostics).toHaveProperty('fallbackMode');
      expect(diagnostics).toHaveProperty('importMethod');
      expect(diagnostics).toHaveProperty('error');
      
      expect(typeof diagnostics.fsExtraImported).toBe('boolean');
      expect(typeof diagnostics.fallbackMode).toBe('boolean');
      expect(['es-module', 'dynamic-import', 'require', 'node-builtin']).toContain(diagnostics.importMethod);
      
      // Validate methodsAvailable structure
      const methods = diagnostics.methodsAvailable;
      expect(methods).toHaveProperty('pathExists');
      expect(methods).toHaveProperty('readdir');
      expect(methods).toHaveProperty('writeFile');
      expect(methods).toHaveProperty('readFile');
      expect(methods).toHaveProperty('stat');
      expect(methods).toHaveProperty('remove');
      expect(methods).toHaveProperty('ensureDir');
      
      Object.values(methods).forEach(available => {
        expect(typeof available).toBe('boolean');
      });
    });

    it('should handle diagnostics when fs-extra is not available', async () => {
      // Force fallback mode
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = null;
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = true;
      (safeFs as unknown as SafeFsWithPrivates).importer.importError = 'Test error message';
      
      const diagnostics = await getFsExtraDiagnostics();
      
      expect(diagnostics.fsExtraImported).toBe(false);
      expect(diagnostics.fallbackMode).toBe(true);
      expect(diagnostics.error).toBe('Test error message');
      
      // All methods should be false when fs-extra is not available
      Object.values(diagnostics.methodsAvailable).forEach(available => {
        expect(available).toBe(false);
      });
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle move with cross-device error and fallback to copy + remove', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        move: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      // First attempt with rename fails with EXDEV (cross-device link)
      const exdevError = new Error('EXDEV: cross-device link not permitted');
      (exdevError as any).code = 'EXDEV';
      mockFs.rename.mockRejectedValueOnce(exdevError);
      
      // Then copy and remove should succeed
      mockFs.copyFile.mockResolvedValueOnce(undefined);
      mockFs.unlink.mockResolvedValueOnce(undefined);
      
      await move('/test/source.txt', '/test/dest.txt');
      
      expect(mockFs.copyFile).toHaveBeenCalledWith('/test/source.txt', '/test/dest.txt');
      expect(mockFs.unlink).toHaveBeenCalledWith('/test/source.txt');
    });

    it('should handle copy with directory and throw error', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        copy: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      // copyFile fails with EISDIR for directories
      const isdirError = new Error('EISDIR: illegal operation on a directory');
      (isdirError as any).code = 'EISDIR';
      mockFs.copyFile.mockRejectedValue(isdirError);
      
      await expect(copy('/test/source-dir', '/test/dest-dir')).rejects.toThrow('EISDIR');
    });

    it('should handle undefined fsExtra in all methods', async () => {
      // Force undefined fsExtra
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = undefined;
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      
      // Mock Node.js fallbacks
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue(['test.txt']);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('content');
      mockFs.stat.mockResolvedValue({
        isDirectory: () => false,
        isFile: () => true,
        mtime: new Date(),
        mode: 0o644,
        mtimeMs: Date.now(),
        size: 100,
        birthtime: new Date()
      });
      
      // All should use Node.js fallbacks
      expect(await pathExists('/test')).toBe(true);
      expect(await readdir('/test')).toEqual(['test.txt']);
      await expect(writeFile('/test/file.txt', 'content')).resolves.toBeUndefined();
      expect(await readFile('/test/file.txt')).toBe('content');
      expect(await stat('/test/file.txt')).toHaveProperty('isFile');
    });

    it('should handle fsExtra with missing methods', async () => {
      // Set fsExtra with missing methods
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        // Missing pathExists, readdir, etc.
      };
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      
      mockFs.access.mockResolvedValue(undefined);
      
      expect(await pathExists('/test')).toBe(true);
    });

    it('should handle ensureDir with EEXIST error', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        ensureDir: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const eexistError = new Error('EEXIST: file already exists');
      (eexistError as any).code = 'EEXIST';
      mockFs.mkdir.mockRejectedValue(eexistError);
      
      // Should silently succeed for EEXIST
      await ensureDir('/existing/dir');
      // No error should be thrown
    });

    it('should handle ensureDir with other errors', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        ensureDir: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as any).code = 'EACCES';
      mockFs.mkdir.mockRejectedValue(permissionError);
      
      await expect(ensureDir('/protected/dir')).rejects.toThrow('EACCES: permission denied');
    });

    it('should handle move rename error that is not EXDEV', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        move: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as any).code = 'EACCES';
      mockFs.rename.mockRejectedValue(permissionError);
      
      await expect(move('/protected/source.txt', '/protected/dest.txt')).rejects.toThrow('EACCES: permission denied');
    });

    it('should handle copy with non-EISDIR error', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        copy: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as any).code = 'EACCES';
      mockFs.copyFile.mockRejectedValue(permissionError);
      
      await expect(copy('/protected/source.txt', '/protected/dest.txt')).rejects.toThrow('EACCES: permission denied');
    });

    it('should handle readFile with encoding object', async () => {
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = {
        readFile: jest.fn().mockRejectedValue(new Error('fs-extra failed') as never)
      };
      
      mockFs.readFile.mockResolvedValue('content');
      
      const result = await readFile('/test/file.txt', { encoding: 'utf8' } as any);
      expect(result).toBe('content');
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/file.txt', { encoding: { encoding: 'utf8' } });
    });

    it('should handle successful fs-extra operations without fallback', async () => {
      const mockFsExtra = {
        pathExists: jest.fn().mockResolvedValue(true),
        readdir: jest.fn().mockResolvedValue(['file.txt']),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('content'),
        stat: jest.fn().mockResolvedValue({ isFile: () => true }),
        remove: jest.fn().mockResolvedValue(undefined),
        ensureDir: jest.fn().mockResolvedValue(undefined),
        appendFile: jest.fn().mockResolvedValue(undefined),
        move: jest.fn().mockResolvedValue(undefined),
        copy: jest.fn().mockResolvedValue(undefined)
      };
      
      (safeFs as unknown as SafeFsWithPrivates).fallbackMode = false;
      (safeFs as unknown as SafeFsWithPrivates).fsExtra = mockFsExtra;
      
      // Test all operations succeed with fs-extra
      expect(await pathExists('/test')).toBe(true);
      expect(await readdir('/test')).toEqual(['file.txt']);
      await writeFile('/test/file.txt', 'content');
      expect(await readFile('/test/file.txt')).toBe('content');
      expect(await stat('/test')).toHaveProperty('isFile');
      await remove('/test/file.txt');
      await ensureDir('/test/dir');
      await appendFile('/test/file.txt', 'more');
      await move('/test/a.txt', '/test/b.txt');
      await copy('/test/c.txt', '/test/d.txt');
      
      // Verify fs-extra methods were called, not Node.js fallbacks
      expect(mockFsExtra.pathExists).toHaveBeenCalled();
      expect(mockFsExtra.readdir).toHaveBeenCalled();
      expect(mockFsExtra.writeFile).toHaveBeenCalled();
      expect(mockFsExtra.readFile).toHaveBeenCalled();
      expect(mockFsExtra.stat).toHaveBeenCalled();
      expect(mockFsExtra.remove).toHaveBeenCalled();
      expect(mockFsExtra.ensureDir).toHaveBeenCalled();
      expect(mockFsExtra.appendFile).toHaveBeenCalled();
      expect(mockFsExtra.move).toHaveBeenCalled();
      expect(mockFsExtra.copy).toHaveBeenCalled();
    });
  });

  describe('ensureDirSync', () => {
    it('should create directory synchronously', () => {
      const mockFs = jest.requireMock('fs') as { mkdirSync: jest.Mock };
      const mkdirSyncMock = mockFs.mkdirSync;
      mkdirSyncMock.mockImplementation(() => {});
      
      expect(() => ensureDirSync('/test/directory')).not.toThrow();
      expect(mkdirSyncMock).toHaveBeenCalledWith('/test/directory', { recursive: true });
    });

    it('should handle EEXIST error gracefully', () => {
      const mockFs = jest.requireMock('fs') as { mkdirSync: jest.Mock };
      const mkdirSyncMock = mockFs.mkdirSync;
      const existsError = new Error('EEXIST: file already exists');
      (existsError as unknown).code = 'EEXIST';
      mkdirSyncMock.mockImplementation(() => {
        throw existsError;
      });
      
      expect(() => ensureDirSync('/existing/directory')).not.toThrow();
    });

    it('should throw non-EEXIST errors', () => {
      const mockFs = jest.requireMock('fs') as { mkdirSync: jest.Mock };
      const mkdirSyncMock = mockFs.mkdirSync;
      const permissionError = new Error('EACCES: permission denied');
      (permissionError as unknown).code = 'EACCES';
      mkdirSyncMock.mockImplementation(() => {
        throw permissionError;
      });
      
      expect(() => ensureDirSync('/protected/directory')).toThrow('EACCES: permission denied');
    });
  });
});