/**
 * Read task tool for the Agent Communication MCP Server
 */

import * as path from 'path';
import { ServerConfig, ReadTaskResponse } from '../types.js';
import { readFile, getStats, parseTaskMetadata } from '../utils/file-system.js';
import { validateRequiredString, validateTaskFileType } from '../utils/validation.js';
import debug from 'debug';


const log = debug('agent-comm:tools:readtask');
/**
 * Read a task file by type (init, plan, done, error)
 */
export async function readTask(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<ReadTaskResponse> {
  log('readTask called with args: %O', { config, args });
  const agent = validateRequiredString(args['agent'], 'agent');
  const task = validateRequiredString(args['task'], 'task');
  const fileType = validateTaskFileType(args['file']);
  
  const fileName = `${fileType}.md`;
  const filePath = path.join(config.commDir, agent, task, fileName);
  
  const content = await readFile(filePath);
  const stats = await getStats(filePath);
  const metadata = parseTaskMetadata(content);
  
  return {
    content,
    lastModified: stats.mtime,
    ...(metadata && { metadata })
  };
}