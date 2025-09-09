/**
 * Check tasks tool for the Agent Communication MCP Server
 * Context-based approach: Works with task IDs and content only
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager } from '../core/TaskContextManager.js';
import { validateRequiredString } from '../utils/validation.js';
import { validateAgentName } from '../utils/file-system.js';

export interface CheckTasksResponse {
  tasks: {
    taskId: string;
    title: string;
    status: 'new' | 'in_progress' | 'completed' | 'error';
    progress?: {
      completed: number;
      inProgress: number;
      pending: number;
    };
  }[];
  totalCount: number;
  newCount: number;
  activeCount: number;
  message: string;
}

/**
 * Check for tasks assigned to an agent
 * Context-based approach - no file paths exposed
 */
export async function checkTasks(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<CheckTasksResponse> {
  const agent = validateRequiredString(args['agent'], 'agent');
  validateAgentName(agent);
  
  // connectionManager and eventLogger are guaranteed by ServerConfig type
  
  // Create mock connection for the agent
  const connection = {
    id: `check-tasks-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agent,
    startTime: new Date(),
    metadata: { operation: 'check-tasks' }
  };
  
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  const tasks = await contextManager.checkAssignedTasks(connection);
  
  const newCount = tasks.filter(t => t.status === 'new').length;
  const activeCount = tasks.filter(t => t.status === 'in_progress').length;
  
  return {
    tasks,
    totalCount: tasks.length,
    newCount,
    activeCount,
    message: tasks.length === 0 ? 
      'No tasks currently assigned to this agent. Check with other team members or wait for new task assignments.' : 
      `Found ${tasks.length} assigned task${tasks.length === 1 ? '' : 's'}.`
  };
}