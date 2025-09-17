import debug from 'debug';
import { ProtocolConfigManager, ProtocolConfig, ConfigResult } from '../core/ProtocolConfigManager.js';

const log = debug('agent-comm:tools:protocol-config');

interface ProtocolConfigArgs {
  action: 'get' | 'set' | 'reset';
  config?: ProtocolConfig;
}

interface ProtocolConfigResult {
  success: boolean;
  action: string;
  config?: ProtocolConfig;
  message?: string;
  error?: string;
}

/**
 * Protocol configuration management tool
 * Supports get/set/reset actions for protocol injection configuration
 */
export async function protocolConfig(args: ProtocolConfigArgs): Promise<ProtocolConfigResult> {
  try {
    log('Executing protocol_config tool with action: %s', args.action);

    // Validate action parameter
    if (!args.action) {
      return {
        success: false,
        action: '',
        error: 'Action parameter is required. Must be one of: get, set, reset'
      };
    }

    if (!['get', 'set', 'reset'].includes(args.action)) {
      return {
        success: false,
        action: args.action,
        error: `Invalid action: ${args.action}. Must be one of: get, set, reset`
      };
    }

    const configManager = new ProtocolConfigManager();

    switch (args.action) {
      case 'get': {
        const config = await configManager.getConfig();
        log('Retrieved protocol configuration successfully');
        return {
          success: true,
          action: 'get',
          config
        };
      }

      case 'set': {
        // Validate config parameter for set action
        if (!args.config) {
          return {
            success: false,
            action: 'set',
            error: 'Config parameter is required for set action'
          };
        }

        const result: ConfigResult = await configManager.setConfig(args.config);
        log('Set protocol configuration with result: %O', result);

        return {
          success: result.success,
          action: 'set',
          message: result.message
        };
      }

      case 'reset': {
        const result: ConfigResult = await configManager.resetConfig();
        log('Reset protocol configuration with result: %O', result);

        return {
          success: result.success,
          action: 'reset',
          message: result.message
        };
      }

      default: {
        // This should never happen due to validation above, but TypeScript requires it
        const actionStr = String(args.action);
        return {
          success: false,
          action: actionStr,
          error: `Unsupported action: ${actionStr}`
        };
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('Protocol config tool error: %O', error);

    return {
      success: false,
      action: args.action ?? 'unknown',
      error: errorMessage
    };
  }
}

/**
 * Tool schema for MCP registration
 */
export const protocolConfigTool = {
  name: 'protocol_config',
  description: 'Manage protocol injection configuration for task and plan templates',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'set', 'reset'],
        description: 'Action to perform: get current config, set new config, or reset to defaults'
      },
      config: {
        type: 'object',
        properties: {
          task: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                description: 'Whether to inject protocol instructions in task INIT.md files'
              },
              template: {
                type: 'string',
                description: 'Custom template for task protocol injection'
              }
            },
            required: ['enabled', 'template']
          },
          plan: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                description: 'Whether to inject protocol instructions in plan PLAN.md files'
              },
              template: {
                type: 'string',
                description: 'Custom template for plan protocol injection'
              }
            },
            required: ['enabled', 'template']
          }
        },
        required: ['task', 'plan'],
        description: 'Protocol configuration object (required for set action)'
      }
    },
    required: ['action'],
    additionalProperties: false
  }
} as const;