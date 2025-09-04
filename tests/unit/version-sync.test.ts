/**
 * Test to ensure the hardcoded server version stays in sync with package.json
 */

import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getServerInfo } from '../../src/config.js';

describe('Version Synchronization', () => {
  test('server version matches package.json version', () => {
    // Read package.json from the project root
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Get the server version from config
    const serverInfo = getServerInfo();
    
    // Ensure they match
    expect(serverInfo.version).toBe(packageJson.version);
    expect(serverInfo.version).toBe('0.5.0'); // Also verify current expected version
  });
  
  test('server info contains required fields', () => {
    const serverInfo = getServerInfo();
    
    expect(serverInfo.name).toBe('agent-comm');
    expect(serverInfo.version).toBeDefined();
    expect(serverInfo.description).toBeDefined();
    expect(typeof serverInfo.version).toBe('string');
    expect(typeof serverInfo.description).toBe('string');
  });
});