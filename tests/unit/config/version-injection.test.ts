/**
 * Tests for build-time version injection functionality
 */

import { describe, it, expect } from '@jest/globals';
import { getPackageInfo, getDynamicServerInfo, getServerInfo } from '../../../src/config.js';
import { PACKAGE_INFO, SERVER_NAME, SERVER_VERSION, SERVER_DESCRIPTION } from '../../../src/generated/version.js';

describe('build-time version injection', () => {
  describe('generated version constants', () => {
    it('should have all required package info constants', () => {
      expect(PACKAGE_INFO).toBeDefined();
      expect(PACKAGE_INFO.name).toBe('@jerfowler/agent-comm-mcp-server');
      expect(PACKAGE_INFO.version).toBeDefined(); // Should match package.json
      expect(PACKAGE_INFO.version).not.toBe('unknown');
      expect(PACKAGE_INFO.description).toContain('agent task communication');
      expect(PACKAGE_INFO.author).toBeDefined();
      expect(PACKAGE_INFO.repository).toBeDefined();
    });

    it('should have derived server constants', () => {
      expect(SERVER_NAME).toBe('agent-comm');
      expect(SERVER_VERSION).toBe(PACKAGE_INFO.version);
      expect(SERVER_DESCRIPTION).toBe(PACKAGE_INFO.description);
    });

    it('should have consistent version across constants', () => {
      expect(SERVER_VERSION).toBeDefined();
      expect(SERVER_VERSION).not.toBe('unknown');
      expect(PACKAGE_INFO.version).toBe(SERVER_VERSION);
    });
  });

  describe('getPackageInfo', () => {
    it('should return package info from generated constants', () => {
      const result = getPackageInfo();

      expect(result).toEqual({
        name: PACKAGE_INFO.name,
        version: PACKAGE_INFO.version,
        description: PACKAGE_INFO.description,
        author: PACKAGE_INFO.author,
        repository: PACKAGE_INFO.repository
      });
    });

    it('should return consistent data on multiple calls', () => {
      const result1 = getPackageInfo();
      const result2 = getPackageInfo();

      expect(result1).toEqual(result2);
      expect(result1.version).toBe(PACKAGE_INFO.version);
      expect(result1.version).not.toBe('unknown');
    });

    it('should never return "unknown" version', () => {
      const result = getPackageInfo();
      expect(result.version).not.toBe('unknown');
      expect(result.version).toBe(PACKAGE_INFO.version);
    });
  });

  describe('getServerInfo', () => {
    it('should return server info with generated constants', () => {
      const result = getServerInfo();

      expect(result).toEqual({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description: SERVER_DESCRIPTION
      });
    });

    it('should return agent-comm as server name', () => {
      const result = getServerInfo();
      expect(result.name).toBe('agent-comm');
    });

    it('should return correct version from generated constants', () => {
      const result = getServerInfo();
      expect(result.version).toBe(PACKAGE_INFO.version);
      expect(result.version).not.toBe('unknown');
    });
  });

  describe('getDynamicServerInfo', () => {
    it('should return server info using generated constants', () => {
      const result = getDynamicServerInfo();

      expect(result).toEqual({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description: SERVER_DESCRIPTION
      });
    });

    it('should be identical to getServerInfo (both use constants now)', () => {
      const staticResult = getServerInfo();
      const dynamicResult = getDynamicServerInfo();

      expect(staticResult).toEqual(dynamicResult);
    });

    it('should never return fallback values', () => {
      const result = getDynamicServerInfo();
      
      // Should never return fallback values since constants are always available
      expect(result.version).not.toBe('unknown');
      expect(result.name).toBe('agent-comm');
      expect(result.version).toBe(PACKAGE_INFO.version);
    });
  });

  describe('build-time injection benefits', () => {
    it('should provide consistent version info without file system access', () => {
      // This test verifies that we get consistent results without any file system operations
      const packageInfo = getPackageInfo();
      const serverInfo = getServerInfo();
      const dynamicInfo = getDynamicServerInfo();

      // All should have the same version from generated constants
      const expectedVersion = PACKAGE_INFO.version;
      expect(packageInfo.version).toBe(expectedVersion);
      expect(serverInfo.version).toBe(expectedVersion);
      expect(dynamicInfo.version).toBe(expectedVersion);

      // All derived from the same source
      expect(serverInfo.version).toBe(PACKAGE_INFO.version);
      expect(dynamicInfo.version).toBe(PACKAGE_INFO.version);
    });

    it('should have package.json as single source of truth reflected in constants', () => {
      // The constants should reflect the current package.json values
      expect(PACKAGE_INFO.name).toBe('@jerfowler/agent-comm-mcp-server');
      expect(PACKAGE_INFO.version).toBeDefined();
      expect(PACKAGE_INFO.version).not.toBe('unknown');
      expect(PACKAGE_INFO.description).toContain('MCP server for AI agent task communication');
    });
  });
});