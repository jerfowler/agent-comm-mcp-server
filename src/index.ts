#!/usr/bin/env node

/**
 * Agent Communication MCP Server
 * A Model Context Protocol server for agent task communication and delegation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getConfig, validateConfig, getServerInfo, validateEnvironment } from './config.js';
import { AgentCommError, ServerConfig } from './types.js';
import * as fs from 'fs-extra';

// Import core components
import { ConnectionManager } from './core/ConnectionManager.js';
import { EventLogger } from './logging/EventLogger.js';

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
  const config: ServerConfig = {
    ...baseConfig,
    connectionManager: new ConnectionManager(),
    eventLogger: new EventLogger(baseConfig.logDir)
  };
  
  // Validate the complete config
  validateConfig(config);
  
  // Initialize server start time for uptime tracking
  initializeServerStartTime();
  
  const server = new Server(
    {
      name: serverInfo.name,
      version: serverInfo.version
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Configure server with handlers
  setupServerHandlers(server, config);
  return server;
}

/**
 * Set up server request handlers
 */
function setupServerHandlers(server: Server, config: any): void {
  // Tool call handler
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: any) => {
      try {
        const { name, arguments: args } = request.params;
        
        switch (name) {
          case 'check_tasks': {
            const result = await checkTasks(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }
            
          case 'read_task': {
            const result = await readTask(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            };
          }
            
          case 'write_task': {
            const result = await writeTask(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }
            
            
          case 'create_task': {
            const result = await createTaskTool(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }
            
          case 'list_agents': {
            const result = await listAgents(config);
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }
            
          case 'archive_tasks': {
            const result = await archiveTasksTool(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }
            
          case 'restore_tasks': {
            const result = await restoreTasksTool(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }


          // Context-based tools
          case 'get_task_context': {
            const result = await getTaskContext(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'submit_plan': {
            const result = await submitPlan(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'report_progress': {
            const result = await reportProgress(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'mark_complete': {
            const result = await markComplete(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'archive_completed_tasks': {
            const result = await archiveCompletedTasks(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          // Diagnostic tools (v0.4.0)
          case 'get_full_lifecycle': {
            const result = await getFullLifecycle(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'track_task_progress': {
            const result = await trackTaskProgress(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          // Best practice tools
          case 'get_server_info': {
            const result = await getServerInfoTool(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'ping': {
            const result = await ping(config, args || {});
            return { 
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
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
          }
        ]
      };
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