/**
 * Archive tasks tool for the Agent Communication MCP Server
 */

import { ServerConfig, ArchiveResult, ArchiveOptions } from '../types.js';
import { archiveTasks } from '../utils/task-manager.js';
import { 
  validateArchiveMode, 
  validateOptionalString, 
  validateNumber, 
  validateBoolean 
} from '../utils/validation.js';

/**
 * Archive tasks (clear comms functionality)
 */
export async function archiveTasksTool(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<ArchiveResult> {
  const mode = validateArchiveMode(args['mode'] || 'completed');
  const agent = validateOptionalString(args['agent'], 'agent');
  const dryRun = validateBoolean(args['dryRun'], 'dryRun', false);
  
  let olderThan: number | undefined;
  if (args['olderThan'] !== undefined) {
    olderThan = validateNumber(args['olderThan'], 'olderThan', 1);
  }
  
  // Validate mode-specific parameters
  if (mode === 'by-agent' && !agent) {
    throw new Error('Agent name is required for by-agent mode');
  }
  
  if (mode === 'by-date' && olderThan === undefined) {
    throw new Error('olderThan parameter is required for by-date mode');
  }
  
  const options: ArchiveOptions = {
    mode,
    dryRun,
    ...(agent && { agent }),
    ...(olderThan && { olderThan })
  };
  
  return await archiveTasks(config, options);
}