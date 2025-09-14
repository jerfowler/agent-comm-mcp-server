/**
 * Write task tool for the Agent Communication MCP Server
 */

import * as path from 'path';
import { ServerConfig, WriteTaskResponse } from '../types.js';
import { writeFile, ensureDirectory } from '../utils/file-system.js';
import { validateRequiredString, validateEnum, validateContent } from '../utils/validation.js';
import debug from 'debug';


const log = debug('agent-comm:tools:writetask');
/**
 * Write a task file by type (plan, done, error)
 */
export async function writeTask(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<WriteTaskResponse> {
  log('writeTask called with args: %O', { config, args });
  const agent = validateRequiredString(args['agent'], 'agent');
  const task = validateRequiredString(args['task'], 'task');
  const fileType = validateEnum(args['file'], 'file', ['PLAN', 'DONE', 'ERROR'] as const);
  const content = validateRequiredString(args['content'], 'content');
  
  validateContent(content);
  
  const taskDir = path.join(config.commDir, agent, task);
  await ensureDirectory(taskDir);
  
  const fileName = `${fileType}.md`;
  const filePath = path.join(taskDir, fileName);
  
  await writeFile(filePath, content);
  
  return {
    success: true,
    bytesWritten: Buffer.byteLength(content, 'utf8')
  };
}