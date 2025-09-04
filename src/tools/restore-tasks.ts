/**
 * Restore tasks tool for the Agent Communication MCP Server
 */

import { ServerConfig, RestoreResult } from '../types.js';
import { restoreTasks } from '../utils/task-manager.js';
import { validateRequiredString, validateOptionalString } from '../utils/validation.js';

/**
 * Restore tasks from archive
 */
export async function restoreTasksTool(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<RestoreResult> {
  const timestamp = validateRequiredString(args['timestamp'], 'timestamp');
  
  // Validate timestamp format (basic check) before processing other params
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(timestamp)) {
    throw new Error('Invalid timestamp format. Expected: YYYY-MM-DDTHH-mm-ss');
  }
  
  const agent = validateOptionalString(args['agent'], 'agent');
  const taskName = validateOptionalString(args['taskName'], 'taskName');
  
  return await restoreTasks(config, timestamp, agent, taskName);
}