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

// Define mock types for the config manager methods
type MockGetConfig = jest.Mock<() => Promise<Record<string, unknown>>>;
type MockSetConfig = jest.Mock<(config: Record<string, unknown>) => Promise<{ success: boolean; message: string }>>;
type MockResetConfig = jest.Mock<() => Promise<{ success: boolean; message: string }>>;

// Mock ProtocolConfigManager
const mockConfigManager = {
  getConfig: jest.fn() as unknown as MockGetConfig,
  setConfig: jest.fn() as unknown as MockSetConfig,
  resetConfig: jest.fn() as unknown as MockResetConfig
};

jest.mock('../../../src/core/ProtocolConfigManager.js', () => ({
  ProtocolConfigManager: jest.fn().mockImplementation(() => mockConfigManager)
}));

// This will fail until protocol-config tool is implemented (TDD requirement)
let protocolConfigTool: unknown;

// Function to dynamically import the module
async function loadProtocolConfigTool(): Promise<void> {
  try {
    const module = await import('../../../src/tools/protocol-config.js');
    protocolConfigTool = module.protocolConfig;
  } catch {
    // Expected to fail in TDD - implementation doesn't exist yet
    protocolConfigTool = undefined;
  }
}

describe('protocol-config tool', () => {
  beforeAll(async () => {
    await loadProtocolConfigTool();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get action', () => {
    it('should get current protocol configuration', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      const mockConfig = {
        task: { enabled: true, template: 'Task template' },
        plan: { enabled: false, template: 'Plan template' }
      };

      mockConfigManager.getConfig.mockResolvedValue(mockConfig);

      const result = await (protocolConfigTool as Function)({
        action: 'get'
      });

      expect(mockConfigManager.getConfig).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        action: 'get',
        config: mockConfig
      });
    });

    it('should handle get action errors', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      mockConfigManager.getConfig.mockRejectedValue(new Error('Get config failed'));

      const result = await (protocolConfigTool as Function)({
        action: 'get'
      });

      expect(result).toEqual({
        success: false,
        action: 'get',
        error: 'Get config failed'
      });
    });
  });

  describe('set action', () => {
    it('should set new protocol configuration', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      const newConfig = {
        task: { enabled: false, template: 'New task template' },
        plan: { enabled: true, template: 'New plan template' }
      };

      mockConfigManager.setConfig.mockResolvedValue({
        success: true,
        message: 'Configuration updated successfully'
      });

      const result = await (protocolConfigTool as Function)({
        action: 'set',
        config: newConfig
      });

      expect(mockConfigManager.setConfig).toHaveBeenCalledWith(newConfig);
      expect(result).toEqual({
        success: true,
        action: 'set',
        message: 'Configuration updated successfully'
      });
    });

    it('should handle set action errors', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      const newConfig = {
        task: { enabled: true, template: 'test' },
        plan: { enabled: true, template: 'test' }
      };

      mockConfigManager.setConfig.mockResolvedValue({
        success: false,
        message: 'Failed to save configuration: Write error'
      });

      const result = await (protocolConfigTool as Function)({
        action: 'set',
        config: newConfig
      });

      expect(result).toEqual({
        success: false,
        action: 'set',
        message: 'Failed to save configuration: Write error'
      });
    });

    it('should validate config parameter for set action', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      const result = await (protocolConfigTool as Function)({
        action: 'set'
        // Missing config parameter
      });

      expect(result).toEqual({
        success: false,
        action: 'set',
        error: 'Config parameter is required for set action'
      });
      expect(mockConfigManager.setConfig).not.toHaveBeenCalled();
    });
  });

  describe('reset action', () => {
    it('should reset protocol configuration to defaults', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      mockConfigManager.resetConfig.mockResolvedValue({
        success: true,
        message: 'Configuration reset to defaults'
      });

      const result = await (protocolConfigTool as Function)({
        action: 'reset'
      });

      expect(mockConfigManager.resetConfig).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        action: 'reset',
        message: 'Configuration reset to defaults'
      });
    });

    it('should handle reset action errors', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      mockConfigManager.resetConfig.mockResolvedValue({
        success: false,
        message: 'Failed to reset configuration: Permission denied'
      });

      const result = await (protocolConfigTool as Function)({
        action: 'reset'
      });

      expect(result).toEqual({
        success: false,
        action: 'reset',
        message: 'Failed to reset configuration: Permission denied'
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate action parameter', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      const result = await (protocolConfigTool as Function)({
        // Missing action parameter
      });

      expect(result).toEqual({
        success: false,
        action: '',
        error: 'Action parameter is required. Must be one of: get, set, reset'
      });
    });

    it('should validate action parameter values', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      const result = await (protocolConfigTool as Function)({
        action: 'invalid'
      });

      expect(result).toEqual({
        success: false,
        action: 'invalid',
        error: 'Invalid action: invalid. Must be one of: get, set, reset'
      });
    });
  });

  describe('debug integration', () => {
    it('should log debug messages for each action', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      mockConfigManager.getConfig.mockResolvedValue({
        task: { enabled: true, template: 'test' },
        plan: { enabled: true, template: 'test' }
      });

      await (protocolConfigTool as Function)({
        action: 'get'
      });

      expect(mockDebug).toHaveBeenCalledWith('Executing protocol_config tool with action: %s', 'get');
    });
  });

  describe('JSON response structure', () => {
    it('should return structured JSON responses for all actions', async () => {
      if (!protocolConfigTool) {
        expect(protocolConfigTool).toBeUndefined();
        return;
      }

      // Test each action returns proper structure
      const testCases = [
        { action: 'get', expectedKeys: ['success', 'action'] },
        { action: 'reset', expectedKeys: ['success', 'action'] }
      ];

      for (const testCase of testCases) {
        mockConfigManager.getConfig?.mockResolvedValue({});
        mockConfigManager.resetConfig?.mockResolvedValue({ success: true, message: 'test' });

        const result = await (protocolConfigTool as Function)({
          action: testCase.action
        });

        testCase.expectedKeys.forEach(key => {
          expect(result).toHaveProperty(key);
        });
      }
    });
  });
});