/**
 * PromptManager - Core prompt management system for MCP server
 * Manages prompt definitions and coordinates with DynamicPromptEngine
 */

import { ServerConfig } from '../types.js';
import { DynamicPromptEngine } from './DynamicPromptEngine.js';
import debug from 'debug';
import type {
  PromptMetadata,
  PromptListResponse,
  PromptGetResponse,
  PromptName,
  PromptDefinition
} from './types.js';

const log = debug('agent-comm:prompts:promptmanager');

/**
 * Core prompt manager for MCP server
 */
export class PromptManager {
  private engine: DynamicPromptEngine;
  private prompts: Map<PromptName, PromptDefinition>;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.engine = new DynamicPromptEngine(config);
    this.prompts = new Map();
    
    // Initialize all core prompts
    this.initializePrompts();
  }

  /**
   * Initialize all core prompt definitions
   */
  private initializePrompts(): void {
    // Task Workflow Guide
    this.prompts.set('task-workflow-guide', {
      name: 'task-workflow-guide',
      description: 'Complete guide for task management workflow with context-aware instructions',
      arguments: [
        {
          name: 'agent',
          description: 'The agent name to provide context-specific guidance for',
          required: false
        },
        {
          name: 'taskId',
          description: 'Specific task ID to focus the workflow guidance on',
          required: false
        }
      ],
      generateContent: async (args: Record<string, unknown>) => this.engine.generatePromptContent('task-workflow-guide', args)
    });

    // Agent Validation Requirements
    this.prompts.set('agent-validation-requirements', {
      name: 'agent-validation-requirements',
      description: 'Agent ownership validation requirements and best practices',
      arguments: [
        {
          name: 'agent',
          description: 'The agent name to validate and provide requirements for',
          required: true
        }
      ],
      generateContent: async (args: Record<string, unknown>) => this.engine.generatePromptContent('agent-validation-requirements', args)
    });

    // Flexible Task Operations
    this.prompts.set('flexible-task-operations', {
      name: 'flexible-task-operations',
      description: 'Guide for working with multiple tasks in flexible order',
      arguments: [
        {
          name: 'agent',
          description: 'The agent to show multi-task operations for',
          required: false
        }
      ],
      generateContent: async (args: Record<string, unknown>) => this.engine.generatePromptContent('flexible-task-operations', args)
    });

    // Troubleshooting Common Errors
    this.prompts.set('troubleshooting-common-errors', {
      name: 'troubleshooting-common-errors',
      description: 'Solutions for common errors and issues in agent communication',
      arguments: [
        {
          name: 'errorType',
          description: 'Specific error type to troubleshoot',
          required: false
        },
        {
          name: 'agent',
          description: 'Agent experiencing the error',
          required: false
        }
      ],
      generateContent: async (args: Record<string, unknown>) => this.engine.generatePromptContent('troubleshooting-common-errors', args)
    });

    // Protocol Compliance Checklist
    this.prompts.set('protocol-compliance-checklist', {
      name: 'protocol-compliance-checklist',
      description: 'Verification checklist for MCP protocol compliance',
      arguments: [
        {
          name: 'agent',
          description: 'Agent to check compliance for',
          required: false
        }
      ],
      generateContent: async (args: Record<string, unknown>) => this.engine.generatePromptContent('protocol-compliance-checklist', args)
    });
  }

  /**
   * List all available prompts
   */
  async listPrompts(): Promise<PromptListResponse> {
    log('listPrompts called');
    const prompts: PromptMetadata[] = Array.from(this.prompts.values()).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }));

    // Log operation
    await this.config.eventLogger.logOperation('prompts_list', 'system', {
      timestamp: new Date().toISOString(),
      promptCount: prompts.length
    });

    return { prompts };
  }

  /**
   * Get specific prompt content
   */
  async getPrompt(name: string, args: Record<string, unknown> = {}): Promise<PromptGetResponse> {
    const prompt = this.prompts.get(name as PromptName);
    
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    // Validate required arguments
    this.validateArguments(prompt, args);

    try {
      // Generate dynamic content
      const content = await prompt.generateContent(args);

      // Log operation
      await this.config.eventLogger.logOperation('prompts_get', 'system', {
        timestamp: new Date().toISOString(),
        promptName: name,
        arguments: args
      });

      return {
        description: prompt.description,
        messages: content.messages
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate prompt content: ${message}`);
    }
  }

  /**
   * Validate prompt arguments
   */
  private validateArguments(prompt: PromptDefinition, args: Record<string, unknown>): void {
    // Check required arguments
    for (const arg of prompt.arguments) {
      if (arg.required && !(arg.name in args)) {
        throw new Error(`Missing required argument: ${arg.name}`);
      }

      // Validate argument types
      if (arg.name in args) {
        const value = args[arg.name];
        
        // Basic type validation (extend as needed)
        if (value !== undefined && value !== null) {
          if (arg.name === 'agent' || arg.name === 'taskId' || arg.name === 'errorType') {
            if (typeof value !== 'string') {
              throw new Error(`Invalid argument type for ${arg.name}: expected string`);
            }
          }
        }
      }
    }
  }
}