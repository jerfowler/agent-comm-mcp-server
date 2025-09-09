/**
 * Get task context tool - Context retrieval without file exposure
 * Returns pure context for specified or current task
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager, TaskContext } from '../core/TaskContextManager.js';
import { validateOptionalString } from '../utils/validation.js';

/**
 * Get task context without exposing file operations
 */
export async function getTaskContext(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<TaskContext> {
  const taskId = validateOptionalString(args['taskId'], 'taskId') ?? '';
  const agent = validateOptionalString(args['agent'], 'agent');
  
  // Require explicit agent specification - no default fallback
  if (!agent || agent.trim() === '') {
    throw new Error("Agent name is required. Please specify the agent performing this operation.");
  }
  
  // Create connection for the agent
  const connection = {
    id: `get-context-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agent,
    startTime: new Date(),
    metadata: { operation: 'get-task-context', taskId }
  };
  
  // connectionManager and eventLogger are guaranteed by ServerConfig type
  
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  return await contextManager.getTaskContext(taskId, connection);
}