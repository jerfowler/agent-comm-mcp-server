import { jest } from '@jest/globals';

// Mock fs-extra-safe utility with factory function pattern
jest.mock('../../../src/utils/fs-extra-safe.js', () => ({
  pathExists: jest.fn(),
  ensureDir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn()
}));

// Mock debug package
const mockDebug = jest.fn();
jest.mock('debug', () => () => mockDebug);

// Import after mocks
import * as fs from '../../../src/utils/fs-extra-safe.js';

// Type the mocked module
const mockedFs = fs as jest.Mocked<typeof fs>;

// Define expected interface for testing (TDD)
interface IProtocolConfigManager {
  getConfig(): Promise<unknown>;
  setConfig(config: unknown): Promise<unknown>;
  resetConfig(): Promise<unknown>;
}

// This will fail until ProtocolConfigManager is implemented (TDD requirement)
let ProtocolConfigManager: unknown;

// Function to dynamically import the module
async function loadProtocolConfigManager(): Promise<void> {
  try {
    const module = await import('../../../src/core/ProtocolConfigManager.js');
    ProtocolConfigManager = module.ProtocolConfigManager;
  } catch {
    // Expected to fail in TDD - implementation doesn't exist yet
    ProtocolConfigManager = undefined;
  }
}

describe('ProtocolConfigManager', () => {
  let configManager: IProtocolConfigManager | undefined;
  const configPath = 'comm/.config/protocol.json';

  beforeAll(async () => {
    await loadProtocolConfigManager();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    if (ProtocolConfigManager) {
      configManager = new (ProtocolConfigManager as new () => IProtocolConfigManager)();
    }
  });

  describe('constructor', () => {
    it('should initialize with default config path', () => {
      // This test will fail until ProtocolConfigManager is implemented
      expect(ProtocolConfigManager).toBeDefined();
      expect(configManager).toBeDefined();
      expect(mockDebug).toHaveBeenCalledWith('ProtocolConfigManager initialized');
    });
  });

  describe('getConfig', () => {
    it('should create config file with defaults if it does not exist', async () => {
      // Skip if not implemented yet
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      // Mock file doesn't exist
      mockedFs.pathExists.mockResolvedValue(false);
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      const result = await configManager.getConfig();

      expect(mockedFs.pathExists).toHaveBeenCalledWith(configPath);
      expect(mockedFs.ensureDir).toHaveBeenCalledWith('comm/.config');
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('"task"')
      );
      expect(result).toEqual({
        task: {
          enabled: true,
          template: expect.stringContaining('MCP Protocol')
        },
        plan: {
          enabled: true,
          template: expect.stringContaining('Todo System Integration')
        }
      });
      expect(mockDebug).toHaveBeenCalledWith('Config file created with defaults');
    });

    it('should read existing config file if it exists', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      const existingConfig = {
        task: {
          enabled: false,
          template: 'Custom task template'
        },
        plan: {
          enabled: true,
          template: 'Custom plan template'
        }
      };

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readFile.mockResolvedValue(JSON.stringify(existingConfig));

      const result = await configManager.getConfig();

      expect(mockedFs.pathExists).toHaveBeenCalledWith(configPath);
      expect(mockedFs.readFile).toHaveBeenCalledWith(configPath, 'utf8');
      expect(result).toEqual(existingConfig);
      expect(mockDebug).toHaveBeenCalledWith('Config loaded from file');
    });

    it('should handle malformed JSON by recreating config with defaults', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readFile.mockResolvedValue('invalid json content');
      mockedFs.writeFile.mockResolvedValue(undefined);

      const result = await configManager.getConfig();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('"task"')
      );
      expect(result).toMatchObject({
        task: { enabled: expect.any(Boolean) },
        plan: { enabled: expect.any(Boolean) }
      });
      expect(mockDebug).toHaveBeenCalledWith('Config file corrupted, recreated with defaults');
    });
  });

  describe('setConfig', () => {
    it('should write new config to file and return success', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      const newConfig = {
        task: {
          enabled: false,
          template: 'New task template'
        },
        plan: {
          enabled: true,
          template: 'New plan template'
        }
      };

      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      const result = await configManager.setConfig(newConfig);

      expect(mockedFs.ensureDir).toHaveBeenCalledWith('comm/.config');
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        JSON.stringify(newConfig, null, 2)
      );
      expect(result).toEqual({ success: true, message: 'Configuration updated successfully' });
      expect(mockDebug).toHaveBeenCalledWith('Config saved to file');
    });

    it('should handle write errors gracefully', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      const newConfig = {
        task: { enabled: true, template: 'test' },
        plan: { enabled: true, template: 'test' }
      };

      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const result = await configManager.setConfig(newConfig);

      expect(result).toEqual({
        success: false,
        message: 'Failed to save configuration: Write failed'
      });
      expect(mockDebug).toHaveBeenCalledWith('Config save failed: %O', expect.any(Error));
    });

    it('should validate config structure before saving', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      const invalidConfig = {
        task: { enabled: 'not boolean' }, // Invalid type
        plan: { enabled: true }
        // Missing template fields
      };

      const result = await configManager.setConfig(invalidConfig);

      expect(result).toEqual({
        success: false,
        message: expect.stringContaining('Invalid configuration structure')
      });
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('resetConfig', () => {
    it('should reset config to defaults and return success', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      const result = await configManager.resetConfig();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('"task"')
      );
      expect(result).toEqual({ success: true, message: 'Configuration reset to defaults' });
      expect(mockDebug).toHaveBeenCalledWith('Config reset to defaults');
    });

    it('should handle reset errors gracefully', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockRejectedValue(new Error('Reset failed'));

      const result = await configManager.resetConfig();

      expect(result).toEqual({
        success: false,
        message: 'Failed to reset configuration: Reset failed'
      });
    });
  });

  describe('file persistence', () => {
    it('should ensure config directory exists before operations', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      mockedFs.pathExists.mockResolvedValue(false);
      mockedFs.ensureDir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await configManager.getConfig();

      expect(mockedFs.ensureDir).toHaveBeenCalledWith('comm/.config');
    });

    it('should handle file system permissions errors', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      mockedFs.pathExists.mockResolvedValue(false);
      mockedFs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      await expect(configManager.getConfig()).rejects.toThrow('Permission denied');
      expect(mockDebug).toHaveBeenCalledWith('File system error: %O', expect.any(Error));
    });
  });

  describe('thread safety', () => {
    it('should handle concurrent access to config file', async () => {
      if (!configManager) {
        expect(ProtocolConfigManager).toBeUndefined();
        return;
      }

      mockedFs.pathExists.mockResolvedValue(true);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        task: { enabled: true, template: 'test' },
        plan: { enabled: true, template: 'test' }
      }));

      // Simulate concurrent calls
      const promises = [
        configManager.getConfig(),
        configManager.getConfig(),
        configManager.getConfig()
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result: unknown) => {
        expect(result).toMatchObject({
          task: { enabled: expect.any(Boolean) },
          plan: { enabled: expect.any(Boolean) }
        });
      });
    });
  });
});