/**
 * File system utilities for the Agent Communication MCP Server
 */

import fs from 'fs-extra';
import * as path from 'path';
import { Task, TaskMetadata, FileNotFoundError, InvalidTaskError } from '../types.js';

/**
 * Ensure directory exists
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

/**
 * Check if path exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  return await fs.pathExists(filePath);
}

/**
 * Read file content
 */
export async function readFile(filePath: string): Promise<string> {
  if (!await pathExists(filePath)) {
    throw new FileNotFoundError(filePath);
  }
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Write file content
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Move file from source to destination
 */
export async function moveFile(sourcePath: string, destPath: string): Promise<void> {
  if (!await pathExists(sourcePath)) {
    throw new FileNotFoundError(sourcePath);
  }
  await ensureDirectory(path.dirname(destPath));
  await fs.move(sourcePath, destPath, { overwrite: true });
}

/**
 * Copy file from source to destination
 */
export async function copyFile(sourcePath: string, destPath: string): Promise<void> {
  if (!await pathExists(sourcePath)) {
    throw new FileNotFoundError(sourcePath);
  }
  await ensureDirectory(path.dirname(destPath));
  await fs.copy(sourcePath, destPath, { overwrite: true });
}

/**
 * Remove file or directory
 */
export async function remove(targetPath: string): Promise<void> {
  if (await pathExists(targetPath)) {
    await fs.remove(targetPath);
  }
}

/**
 * List directory contents
 */
export async function listDirectory(dirPath: string): Promise<string[]> {
  if (!await pathExists(dirPath)) {
    return [];
  }
  return await fs.readdir(dirPath);
}

/**
 * Get file stats
 */
export async function getStats(filePath: string): Promise<fs.Stats> {
  return await fs.stat(filePath);
}

/**
 * Check if path is a directory
 */
export async function isDirectory(dirPath: string): Promise<boolean> {
  if (!await pathExists(dirPath)) {
    return false;
  }
  const stats = await getStats(dirPath);
  return stats.isDirectory();
}

/**
 * Check if path is a file
 */
export async function isFile(filePath: string): Promise<boolean> {
  if (!await pathExists(filePath)) {
    return false;
  }
  const stats = await getStats(filePath);
  return stats.isFile();
}

/**
 * Get task information from directory
 */
export async function getTaskInfo(taskPath: string, agent: string): Promise<Task> {
  const taskName = path.basename(taskPath);
  const initPath = path.join(taskPath, 'INIT.md');
  const planPath = path.join(taskPath, 'PLAN.md');
  const donePath = path.join(taskPath, 'DONE.md');
  const errorPath = path.join(taskPath, 'ERROR.md');

  const task: Task = {
    name: taskName,
    agent,
    path: taskPath,
    hasInit: await pathExists(initPath),
    hasPlan: await pathExists(planPath),
    hasDone: await pathExists(donePath),
    hasError: await pathExists(errorPath)
  };

  // Get creation time from INIT.md if it exists
  if (task.hasInit) {
    try {
      const initStats = await getStats(initPath);
      task.created = initStats.mtime;
      task.updated = initStats.mtime;
    } catch {
      // Ignore stats errors
    }
  }

  return task;
}

/**
 * Parse task metadata from content
 */
export function parseTaskMetadata(content: string): TaskMetadata | undefined {
  const metadataMatch = content.match(/## Metadata\s*\n((?:- .+\n?)*)/);
  if (!metadataMatch) {
    return undefined;
  }

  const metadataSection = metadataMatch[1];
  const lines = metadataSection.split('\n').filter(line => line.trim().startsWith('- '));
  
  const metadata: Partial<TaskMetadata> = {};
  
  for (const line of lines) {
    const match = line.match(/^- ([^:]+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      switch (key.toLowerCase()) {
        case 'agent':
          metadata.agent = value.trim();
          break;
        case 'created':
          metadata.created = value.trim();
          break;
        case 'source':
          metadata.source = value.trim();
          break;
        case 'parent task':
          metadata.parentTask = value.trim();
          break;
      }
    }
  }

  if (!metadata.agent || !metadata.created || !metadata.source) {
    return undefined;
  }

  return metadata as TaskMetadata;
}

/**
 * Generate timestamp string for file names
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/**
 * Validate task name
 */
export function validateTaskName(taskName: string): void {
  if (!taskName || taskName.trim().length === 0) {
    throw new InvalidTaskError('Task name cannot be empty');
  }
  
  if (taskName.includes('/') || taskName.includes('\\')) {
    throw new InvalidTaskError('Task name cannot contain path separators');
  }
  
  if (taskName.startsWith('.')) {
    throw new InvalidTaskError('Task name cannot start with a dot');
  }
}

/**
 * Validate agent name
 */
export function validateAgentName(agentName: string): void {
  if (!agentName || agentName.trim().length === 0) {
    throw new InvalidTaskError('Agent name cannot be empty');
  }
  
  if (agentName.includes('/') || agentName.includes('\\')) {
    throw new InvalidTaskError('Agent name cannot contain path separators');
  }
  
  if (agentName.startsWith('.')) {
    throw new InvalidTaskError('Agent name cannot start with a dot');
  }
}