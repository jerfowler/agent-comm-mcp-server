/**
 * Version consistency test - ensures all version references use package.json
 * TDD: This test should fail initially, then pass after implementation
 */

import { describe, it, expect } from '@jest/globals';
import { getServerInfo } from '../../../src/config.js';

describe('Version Consistency', () => {
  it('should use version from package.json', async () => {
    // This test will fail initially since config.ts hardcodes "2.0.0"
    const packageJson = await import('../../../package.json', { assert: { type: 'json' } });
    const serverInfo = getServerInfo();
    
    expect(serverInfo.version).toBe(packageJson.default.version);
  });
  
  it('should match semantic versioning pattern', () => {
    const serverInfo = getServerInfo();
    expect(serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
  
  it('should not have hardcoded version strings', () => {
    // Verify we're not using hardcoded versions like "2.0.0"
    const serverInfo = getServerInfo();
    expect(serverInfo.version).not.toBe('2.0.0');
  });
});