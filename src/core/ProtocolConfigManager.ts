import debug from 'debug';
import * as fs from '../utils/fs-extra-safe.js';
import path from 'path';

const log = debug('agent-comm:core:protocol-config');

export interface ProtocolConfig {
  task: {
    enabled: boolean;
    template: string;
  };
  plan: {
    enabled: boolean;
    template: string;
  };
}

export interface ConfigResult {
  success: boolean;
  message: string;
}

export class ProtocolConfigManager {
  private readonly configPath: string;
  private readonly configDir: string;

  constructor(configPath = 'comm/.config/protocol.json') {
    this.configPath = configPath;
    this.configDir = path.dirname(configPath);
    log('ProtocolConfigManager initialized');
  }

  /**
   * Get the current protocol configuration
   * Creates default config if file doesn't exist
   */
  async getConfig(): Promise<ProtocolConfig> {
    try {
      log('Getting protocol configuration from %s', this.configPath);

      const exists = await fs.pathExists(this.configPath);
      if (!exists) {
        log('Config file does not exist, creating with defaults');
        await this.createDefaultConfig();
        log('Config file created with defaults');
        return this.getDefaultConfig();
      }

      const content = await fs.readFile(this.configPath, 'utf8');

      try {
        const config = JSON.parse(content) as ProtocolConfig;
        this.validateConfig(config);
        log('Config loaded from file');
        return config;
      } catch (parseError) {
        log('Config file corrupted, recreating with defaults');
        await this.createDefaultConfig();
        log('Config file corrupted, recreated with defaults');
        return this.getDefaultConfig();
      }
    } catch (error) {
      log('File system error: %O', error);
      throw error;
    }
  }

  /**
   * Set new protocol configuration
   */
  async setConfig(config: ProtocolConfig): Promise<ConfigResult> {
    try {
      log('Setting new protocol configuration');

      // Validate configuration structure
      this.validateConfig(config);

      await fs.ensureDir(this.configDir);
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));

      log('Config saved to file');
      return { success: true, message: 'Configuration updated successfully' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('Config save failed: %O', error);

      if (errorMessage.includes('Invalid configuration structure')) {
        return { success: false, message: errorMessage };
      }

      return { success: false, message: `Failed to save configuration: ${errorMessage}` };
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<ConfigResult> {
    try {
      log('Resetting config to defaults');

      await fs.ensureDir(this.configDir);
      const defaultConfig = this.getDefaultConfig();
      await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));

      log('Config reset to defaults');
      return { success: true, message: 'Configuration reset to defaults' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: `Failed to reset configuration: ${errorMessage}` };
    }
  }

  /**
   * Create default configuration file
   */
  private async createDefaultConfig(): Promise<void> {
    await fs.ensureDir(this.configDir);
    const defaultConfig = this.getDefaultConfig();
    await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
  }

  /**
   * Get default configuration object
   */
  private getDefaultConfig(): ProtocolConfig {
    return {
      task: {
        enabled: true,
        template: `## MCP Protocol

Use these context-based operations for all task management:

**Core Operations:**
- \`check_assigned_tasks()\` - Returns task IDs and titles only
- \`start_task(taskId)\` - Activates task, returns context
- \`get_task_context(taskId?)\` - Pure context, no file paths
- \`submit_plan(content)\` - Content only, handles planning internally
- \`report_progress(updates)\` - Updates progress markers only
- \`mark_complete(status, summary)\` - Handles completion internally
- \`archive_completed_tasks()\` - Batch cleanup operation

**Important Notes:**
- Never reference file paths or extensions
- Work with task IDs and content only
- All file operations are handled automatically
- Focus on task content and progress, not file management`
      },
      plan: {
        enabled: true,
        template: `## Todo System Integration

**CRITICAL: Use Todo System with MCP Operations**
1. **Start every task** by creating comprehensive todos from requirements
2. **Include MCP operations** as explicit todo items (submit_plan, report_progress, mark_complete)
3. **Update todos IMMEDIATELY** after completing each step - never skip this
4. **Only ONE todo** should be 'in_progress' at any time
5. **Verify all todos complete** before calling mark_complete()

**Standard Todo Flow:**
\`\`\`
// Task start
TodoWrite([
  { content: "Parse task requirements", status: "in_progress", activeForm: "Parsing requirements" },
  { content: "Submit plan using submit_plan()", status: "pending", activeForm: "Submitting plan" },
  { content: "Implement requirements", status: "pending", activeForm: "Implementing" },
  { content: "Report progress using report_progress()", status: "pending", activeForm: "Reporting progress" },
  { content: "Mark complete using mark_complete()", status: "pending", activeForm: "Marking complete" }
]);

// Update as you progress - CRITICAL
TodoWrite([...updatedTodos]); // Mark completed items, move next to in_progress
\`\`\``
      }
    };
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: unknown): asserts config is ProtocolConfig {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Invalid configuration structure: must be an object');
    }

    const configObj = config as Record<string, unknown>;

    // Validate task section
    if (!configObj['task'] || typeof configObj['task'] !== 'object') {
      throw new Error('Invalid configuration structure: missing or invalid task section');
    }

    const taskSection = configObj['task'] as Record<string, unknown>;
    if (typeof taskSection['enabled'] !== 'boolean') {
      throw new Error('Invalid configuration structure: task.enabled must be a boolean');
    }
    if (typeof taskSection['template'] !== 'string') {
      throw new Error('Invalid configuration structure: task.template must be a string');
    }

    // Validate plan section
    if (!configObj['plan'] || typeof configObj['plan'] !== 'object') {
      throw new Error('Invalid configuration structure: missing or invalid plan section');
    }

    const planSection = configObj['plan'] as Record<string, unknown>;
    if (typeof planSection['enabled'] !== 'boolean') {
      throw new Error('Invalid configuration structure: plan.enabled must be a boolean');
    }
    if (typeof planSection['template'] !== 'string') {
      throw new Error('Invalid configuration structure: plan.template must be a string');
    }
  }
}