#!/usr/bin/env node

/**
 * Agent Communication MCP Server
 * A Model Context Protocol server for agent task communication and delegation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CallToolRequest,
  ListResourcesRequest,
  ReadResourceRequest,
  GetPromptRequest
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig, validateConfig, getServerInfo, validateEnvironment } from './config.js';
import { AgentCommError, ServerConfig, GetFullLifecycleArgs, TrackTaskProgressArgs } from './types.js';
import * as fs from './utils/fs-extra-safe.js';

// Import core components
import { ConnectionManager } from './core/ConnectionManager.js';
import { EventLogger } from './logging/EventLogger.js';
import { ErrorLogger } from './logging/ErrorLogger.js';
import { TaskContextManager } from './core/TaskContextManager.js';
import { ResourceManager } from './resources/ResourceManager.js';
import { PromptManager } from './prompts/PromptManager.js';
import { ResponseEnhancer } from './core/ResponseEnhancer.js';
import { ComplianceTracker } from './core/ComplianceTracker.js';
import { DelegationTracker } from './core/DelegationTracker.js';

// Import tools
import { checkTasks } from './tools/check-tasks.js';
import { readTask } from './tools/read-task.js';
import { writeTask } from './tools/write-task.js';
import { createTaskTool } from './tools/create-task.js';
import { listAgents } from './tools/list-agents.js';
import { archiveTasksTool } from './tools/archive-tasks.js';
import { restoreTasksTool } from './tools/restore-tasks.js';

// Import diagnostic tools (v0.4.0)
import { getFullLifecycle } from './tools/get-full-lifecycle.js';
import { trackTaskProgress } from './tools/track-task-progress.js';


// Import context-based tools
import { getTaskContext } from './tools/get-task-context.js';
import { submitPlan } from './tools/submit-plan.js';
import { reportProgress } from './tools/report-progress.js';
import { markComplete } from './tools/mark-complete.js';
import { archiveCompletedTasks } from './tools/archive-completed-tasks.js';

// Import best practice tools
import { getServerInfo as getServerInfoTool, initializeServerStartTime } from './tools/get-server-info.js';
import { ping } from './tools/ping.js';

// Import integration tools
import { syncTodoCheckboxes } from './tools/sync-todo-checkboxes.js';

/**
 * Create MCP server instance (exported for testing)
 */
export function createMCPServer(): Server {
  // Validate environment first
  validateEnvironment();
  
  const baseConfig = getConfig();
  const serverInfo = getServerInfo();
  
  // Ensure required directories exist
  fs.ensureDirSync(baseConfig.commDir);
  if (baseConfig.enableArchiving) {
    fs.ensureDirSync(baseConfig.archiveDir);
  }
  fs.ensureDirSync(baseConfig.logDir);
  
  // Initialize core components - extend BaseServerConfig to ServerConfig
  const connectionManager = new ConnectionManager();
  const eventLogger = new EventLogger(baseConfig.logDir);
  const errorLogger = new ErrorLogger(baseConfig.logDir);

  // Create initial config for components that need it
  const initialConfig: ServerConfig = {
    ...baseConfig,
    connectionManager,
    eventLogger,
    errorLogger
  } as ServerConfig;

  // Initialize Smart Response System components
  const promptManager = new PromptManager(initialConfig);
  const complianceTracker = new ComplianceTracker(initialConfig);
  const delegationTracker = new DelegationTracker(initialConfig);
  const responseEnhancer = new ResponseEnhancer(initialConfig);

  // Create complete config with all components
  const config: ServerConfig = {
    ...baseConfig,
    connectionManager,
    eventLogger,
    errorLogger,
    promptManager,
    complianceTracker,
    delegationTracker,
    responseEnhancer
  };

  // Validate the complete config
  validateConfig(config);

  // Initialize TaskContextManager and ResourceManager
  const taskContextManager = new TaskContextManager(config);
  const resourceManager = new ResourceManager({
    taskContextManager,
    eventLogger,
    connectionManager
  });
  
  // Initialize server start time for uptime tracking
  initializeServerStartTime();
  
  const server = new Server(
    {
      name: serverInfo.name,
      version: serverInfo.version
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    }
  );

  // Configure server with handlers
  setupServerHandlers(server, config, resourceManager);
  return server;
}

/**
 * Helper function to enhance tool responses with Smart Response System
 */
async function enhanceToolResponse(
  toolName: string,
  toolResponse: unknown,
  agent: string,
  config: ServerConfig
): Promise<unknown> {
  // If ResponseEnhancer is not configured, return original response
  if (!config.responseEnhancer) {
    return toolResponse;
  }

  try {
    // Create enhancement context with optional properties
    const context: Parameters<typeof config.responseEnhancer.enhance>[0] = {
      toolName,
      toolResponse,
      agent
    };

    // Add optional components if available
    if (config.promptManager) {
      context.promptManager = config.promptManager;
    }
    if (config.complianceTracker) {
      context.complianceTracker = config.complianceTracker;
    }
    if (config.delegationTracker) {
      context.delegationTracker = config.delegationTracker;
    }

    // Enhance the response
    const enhanced = await config.responseEnhancer.enhance(context);
    return enhanced;
  } catch (error) {
    // On error, return original response
    return toolResponse;
  }
}

/**
 * Set up server request handlers
 */
function setupServerHandlers(server: Server, config: ServerConfig, resourceManager: ResourceManager): void {
  // Tool call handler
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      try {
        const { name, arguments: args } = request.params;
        
        switch (name) {
          case 'check_tasks': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await checkTasks(config, args ?? {});
            const enhanced = await enhanceToolResponse('check_tasks', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }
            
          case 'read_task': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await readTask(config, args ?? {});
            const enhanced = await enhanceToolResponse('read_task', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: typeof enhanced === 'string' ? enhanced : JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }
            
          case 'write_task': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await writeTask(config, args ?? {});
            const enhanced = await enhanceToolResponse('write_task', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }
            
            
          case 'create_task': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await createTaskTool(config, args ?? {});
            const enhanced = await enhanceToolResponse('create_task', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }
            
          case 'list_agents': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await listAgents(config);
            const enhanced = await enhanceToolResponse('list_agents', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }
            
          case 'archive_tasks': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await archiveTasksTool(config, args ?? {});
            const enhanced = await enhanceToolResponse('archive_tasks', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }
            
          case 'restore_tasks': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await restoreTasksTool(config, args ?? {});
            const enhanced = await enhanceToolResponse('restore_tasks', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }


          // Context-based tools
          case 'get_task_context': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await getTaskContext(config, args ?? {});
            const enhanced = await enhanceToolResponse('get_task_context', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          case 'submit_plan': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await submitPlan(config, args ?? {});
            const enhanced = await enhanceToolResponse('submit_plan', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          case 'report_progress': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await reportProgress(config, args ?? {});
            const enhanced = await enhanceToolResponse('report_progress', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          case 'mark_complete': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await markComplete(config, args ?? {});
            const enhanced = await enhanceToolResponse('mark_complete', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          case 'archive_completed_tasks': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await archiveCompletedTasks(config, args ?? {});
            const enhanced = await enhanceToolResponse('archive_completed_tasks', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          // Diagnostic tools (v0.4.0)
          case 'get_full_lifecycle': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await getFullLifecycle(config, (args ?? {}) as unknown as GetFullLifecycleArgs);
            const enhanced = await enhanceToolResponse('get_full_lifecycle', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          case 'track_task_progress': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await trackTaskProgress(config, (args ?? {}) as unknown as TrackTaskProgressArgs);
            const enhanced = await enhanceToolResponse('track_task_progress', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          // Best practice tools
          case 'get_server_info': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await getServerInfoTool(config, args ?? {});
            const enhanced = await enhanceToolResponse('get_server_info', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          case 'ping': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await ping(config, args ?? {});
            const enhanced = await enhanceToolResponse('ping', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }

          case 'sync_todo_checkboxes': {
            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args['agent'] === 'string')
              ? args['agent'] : 'default-agent';
            const result = await syncTodoCheckboxes(config, args ?? {});
            const enhanced = await enhanceToolResponse('sync_todo_checkboxes', result, agent, config);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(enhanced, null, 2)
                }
              ]
            };
          }
            
          default:
            throw new AgentCommError(`Unknown tool: ${name}`, 'UNKNOWN_TOOL');
        }
      } catch (error) {
        if (error instanceof AgentCommError) {
          throw error;
        }
        
        const message = error instanceof Error ? error.message : String(error);
        throw new AgentCommError(`Internal Error: ${message}`, 'INTERNAL_ERROR');
      }
    }
  );

  // Tools list handler
  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => {
      return {
        tools: [
          {
            name: 'check_tasks',
            description: 'Check for tasks assigned to an agent',
            inputSchema: {
              type: 'object',
              properties: {
                agent: {
                  type: 'string',
                  description: 'Agent name (e.g., senior-frontend-engineer)'
                }
              },
              required: ['agent']
            }
          },
          {
            name: 'read_task',
            description: 'Read a task file by type (init, plan, done, error)',
            inputSchema: {
              type: 'object',
              properties: {
                agent: { 
                  type: 'string',
                  description: 'Agent name'
                },
                task: { 
                  type: 'string',
                  description: 'Task folder name'
                },
                file: { 
                  type: 'string',
                  enum: ['INIT', 'PLAN', 'DONE', 'ERROR'],
                  description: 'File type to read (init, plan, done, error)'
                }
              },
              required: ['agent', 'task', 'file']
            }
          },
          {
            name: 'write_task',
            description: 'Write a task progress file',
            inputSchema: {
              type: 'object',
              properties: {
                agent: { 
                  type: 'string',
                  description: 'Agent name'
                },
                task: { 
                  type: 'string',
                  description: 'Task folder name'
                },
                file: { 
                  type: 'string',
                  enum: ['PLAN', 'DONE', 'ERROR'],
                  description: 'File type to write (plan, done, error)'
                },
                content: { 
                  type: 'string',
                  description: 'File content to write'
                }
              },
              required: ['agent', 'task', 'file', 'content']
            }
          },
          {
            name: 'create_task',
            description: 'Unified task creation tool with duplicate prevention - replaces delegate_task and init_task',
            inputSchema: {
              type: 'object',
              properties: {
                agent: { 
                  type: 'string',
                  description: 'Target agent name'
                },
                taskName: { 
                  type: 'string',
                  description: 'Clean task name (NO timestamps) - will be auto-timestamped internally'
                },
                content: { 
                  type: 'string',
                  description: 'Task content in markdown format (optional for self tasks)'
                },
                taskType: {
                  type: 'string',
                  enum: ['delegation', 'self', 'subtask'],
                  description: 'Task type: delegation (default), self (for own organization), subtask (with parent)'
                },
                parentTask: {
                  type: 'string',
                  description: 'Parent task ID for subtasks (optional)'
                }
              },
              required: ['agent', 'taskName']
            }
          },
          {
            name: 'list_agents',
            description: 'List all agents with task counts and statistics',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: 'archive_tasks',
            description: 'Archive tasks to clean up communication directory (clear comms)',
            inputSchema: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  enum: ['completed', 'all', 'by-agent', 'by-date'],
                  description: 'Archive mode: completed tasks only, all tasks, by specific agent, or by date'
                },
                agent: {
                  type: 'string',
                  description: 'Agent name (required for by-agent mode)'
                },
                olderThan: {
                  type: 'number',
                  description: 'Archive tasks older than N days (required for by-date mode)',
                  minimum: 1
                },
                dryRun: {
                  type: 'boolean',
                  description: 'Preview changes without actually archiving'
                }
              }
            }
          },
          {
            name: 'restore_tasks',
            description: 'Restore tasks from archive',
            inputSchema: {
              type: 'object',
              properties: {
                timestamp: {
                  type: 'string',
                  description: 'Archive timestamp (YYYY-MM-DDTHH-mm-ss format)'
                },
                agent: {
                  type: 'string',
                  description: 'Restore tasks for specific agent only (optional)'
                },
                taskName: {
                  type: 'string',
                  description: 'Restore tasks matching this name pattern (optional)'
                }
              },
              required: ['timestamp']
            }
          },


          // Context-based tools
          {
            name: 'get_task_context',
            description: 'Get pure task context without file paths - for current or specified task',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: 'Optional task ID. If omitted, returns context for current active task'
                },
                agent: {
                  type: 'string',
                  description: 'Agent name (defaults to default-agent if not provided)'
                }
              },
              required: []
            }
          },
          {
            name: 'submit_plan',
            description: 'Submit implementation plan content - handles file creation internally',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Plan content in markdown format with progress markers'
                },
                agent: {
                  type: 'string',
                  description: 'Agent name submitting the plan'
                },
                agentContext: {
                  type: 'object',
                  description: 'Optional: Agent context data including identity, capabilities, and working context',
                  properties: {
                    identity: { type: 'object' },
                    currentCapabilities: { type: 'object' },
                    workingContext: { type: 'object' }
                  }
                },
                contextEstimate: {
                  type: 'object',
                  description: 'Optional: Context estimate for the plan',
                  properties: {
                    estimatedTokensRequired: { type: 'number' },
                    confidenceLevel: { type: 'number' },
                    criticalSections: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              required: ['content', 'agent']
            }
          },
          {
            name: 'report_progress',
            description: 'Report progress updates on plan steps - no file operations exposed',
            inputSchema: {
              type: 'object',
              properties: {
                updates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      step: {
                        type: 'number',
                        description: 'Step number being updated'
                      },
                      status: {
                        type: 'string',
                        enum: ['COMPLETE', 'IN_PROGRESS', 'PENDING', 'BLOCKED'],
                        description: 'New status for this step'
                      },
                      description: {
                        type: 'string',
                        description: 'Description of work done or current state'
                      },
                      timeSpent: {
                        type: 'number',
                        description: 'Optional: time spent in minutes'
                      },
                      estimatedTimeRemaining: {
                        type: 'number',
                        description: 'Optional: estimated remaining time in minutes'
                      },
                      blocker: {
                        type: 'string',
                        description: 'Optional: description of blocking issue'
                      }
                    },
                    required: ['step', 'status', 'description']
                  },
                  description: 'Array of step updates'
                },
                agent: {
                  type: 'string',
                  description: 'Agent name reporting progress'
                },
                contextStatus: {
                  type: 'object',
                  description: 'Optional: Current context usage status',
                  properties: {
                    currentUsage: { type: 'number' },
                    trend: { type: 'string', enum: ['INCREASING', 'DECREASING', 'STABLE'] },
                    estimatedRemaining: { type: 'number' }
                  }
                },
                capabilityChanges: {
                  type: 'object',
                  description: 'Optional: Capability changes discovered during execution',
                  properties: {
                    discoveredLimitations: { type: 'array', items: { type: 'string' } },
                    toolEffectiveness: { type: 'object' },
                    adaptations: { type: 'array', items: { type: 'string' } }
                  }
                }
              },
              required: ['updates', 'agent']
            }
          },
          {
            name: 'mark_complete',
            description: 'Mark task as complete or error with intelligent reconciliation for unchecked plan items',
            inputSchema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['DONE', 'ERROR'],
                  description: 'Completion status'
                },
                summary: {
                  type: 'string',
                  description: 'Completion summary with results or error details'
                },
                agent: {
                  type: 'string',
                  description: 'Agent name completing the task'
                },
                reconciliation_mode: {
                  type: 'string',
                  enum: ['strict', 'auto_complete', 'reconcile', 'force'],
                  description: 'How to handle unchecked plan items: strict (default, requires all checked), auto_complete (marks all complete), reconcile (explain variances), force (override with documentation)'
                },
                reconciliation_explanations: {
                  type: 'object',
                  description: 'For reconcile mode: mapping of unchecked item titles to explanations of why they are complete',
                  additionalProperties: {
                    type: 'string'
                  }
                }
              },
              required: ['status', 'summary', 'agent']
            }
          },
          {
            name: 'archive_completed_tasks',
            description: 'Archive all completed tasks - batch cleanup operation',
            inputSchema: {
              type: 'object',
              properties: {
                agent: {
                  type: 'string',
                  description: 'Optional: Archive tasks for specific agent only'
                }
              },
              required: []
            }
          },

          // Diagnostic tools (v0.4.0)
          {
            name: 'get_full_lifecycle',
            description: 'Get complete lifecycle visibility for a task - diagnostic tool for comprehensive task journey',
            inputSchema: {
              type: 'object',
              properties: {
                agent: {
                  type: 'string',
                  description: 'Agent name'
                },
                taskId: {
                  type: 'string',
                  description: 'Task ID to get lifecycle for'
                },
                include_progress: {
                  type: 'boolean',
                  description: 'Optional: Include progress markers analysis (default: true)'
                }
              },
              required: ['agent', 'taskId']
            }
          },
          {
            name: 'track_task_progress',
            description: 'Track real-time task progress - diagnostic tool for progress monitoring',
            inputSchema: {
              type: 'object',
              properties: {
                agent: {
                  type: 'string',
                  description: 'Agent name'
                },
                taskId: {
                  type: 'string',
                  description: 'Task ID to track progress for'
                }
              },
              required: ['agent', 'taskId']
            }
          },
          {
            name: 'get_server_info',
            description: 'Get comprehensive server information including version, capabilities, and runtime status',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: 'ping',
            description: 'Health check tool that returns server status and timestamp',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false
            }
          },
          {
            name: 'sync_todo_checkboxes',
            description: 'Sync TodoWrite updates to PLAN.md checkboxes - TodoWrite integration for automatic checkbox updates',
            inputSchema: {
              type: 'object',
              properties: {
                agent: {
                  type: 'string',
                  description: 'Agent name for which to sync todo updates'
                },
                todoUpdates: {
                  type: 'array',
                  description: 'Array of todo update objects with title and status',
                  items: {
                    type: 'object',
                    properties: {
                      title: {
                        type: 'string',
                        description: 'Todo title to match against PLAN.md checkboxes'
                      },
                      status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed'],
                        description: 'New status for the todo item'
                      }
                    },
                    required: ['title', 'status']
                  }
                },
                taskId: {
                  type: 'string',
                  description: 'Optional specific task ID to target. If not provided, uses the most recent task for the agent.'
                }
              },
              required: ['agent', 'todoUpdates']
            }
          }
        ]
      };
    }
  );
  
  // Resource handlers
  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (request: ListResourcesRequest) => {
      // Handle the optional params with proper type narrowing for exactOptionalPropertyTypes
      const options = request.params?.cursor ? { cursor: request.params.cursor } : undefined;
      return resourceManager.listResources(options);
    }
  );
  
  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      if (!request.params?.uri) {
        throw new AgentCommError('URI parameter is required', 'INVALID_PARAMS');
      }
      return resourceManager.readResource(request.params.uri);
    }
  );

  // Initialize PromptManager
  const promptManager = new PromptManager(config);

  // Prompts list handler
  server.setRequestHandler(
    ListPromptsRequestSchema,
    async () => {
      const result = await promptManager.listPrompts();
      return {
        prompts: result.prompts
      };
    }
  );

  // Prompts get handler
  server.setRequestHandler(
    GetPromptRequestSchema,
    async (request: GetPromptRequest) => {
      try {
        const { name, arguments: args } = request.params;
        const result = await promptManager.getPrompt(name, args ?? {});
        return {
          description: result.description,
          messages: result.messages
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new AgentCommError(error.message, 'PROMPT_ERROR');
        }
        throw new AgentCommError('Failed to get prompt', 'PROMPT_ERROR');
      }
    }
  );
}

async function main(): Promise<void> {
  // Create MCP server
  const server = createMCPServer();
  const config = getConfig();
  const serverInfo = getServerInfo();

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (stdout is reserved for MCP protocol)
  console.error(`Agent Communication MCP Server v${serverInfo.version} started`);
  console.error(`Communication directory: ${config.commDir}`);
  if (config.enableArchiving) {
    console.error(`Archive directory: ${config.archiveDir}`);
  } else {
    console.error('Archiving is disabled');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});