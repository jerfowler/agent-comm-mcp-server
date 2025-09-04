/**
 * Task management utilities for the Agent Communication MCP Server
 */

import * as path from 'path';
import { Task, Agent, ServerConfig, ArchiveResult, RestoreResult, ArchiveOptions } from '../types.js';
import * as fs from './file-system.js';
import { validateAgentName, validateTaskName } from './file-system.js';

/**
 * Get all tasks for an agent
 */
export async function getAgentTasks(config: ServerConfig, agentName: string): Promise<Task[]> {
  validateAgentName(agentName);
  
  const agentDir = path.join(config.commDir, agentName);
  if (!await fs.pathExists(agentDir)) {
    return [];
  }

  const entries = await fs.listDirectory(agentDir);
  const tasks: Task[] = [];

  for (const entry of entries) {
    const entryPath = path.join(agentDir, entry);
    
    if (await fs.isDirectory(entryPath)) {
      // This is a task directory
      const task = await fs.getTaskInfo(entryPath, agentName);
      tasks.push(task);
    } else if (entry.endsWith('.md')) {
      // This is a new task file
      const task: Task = {
        name: entry,
        agent: agentName,
        path: entryPath,
        isNew: true,
        hasInit: false,
        hasPlan: false,
        hasDone: false,
        hasError: false
      };
      
      try {
        const stats = await fs.getStats(entryPath);
        task.created = stats.birthtime;
        task.updated = stats.mtime;
      } catch {
        // Ignore stats errors
      }
      
      tasks.push(task);
    }
  }

  // Sort by creation date, newest first
  return tasks.sort((a, b) => {
    const timeA = a.created?.getTime() || 0;
    const timeB = b.created?.getTime() || 0;
    return timeB - timeA;
  });
}

/**
 * Get all agents with their task statistics
 */
export async function getAllAgents(config: ServerConfig): Promise<Agent[]> {
  if (!await fs.pathExists(config.commDir)) {
    return [];
  }

  const entries = await fs.listDirectory(config.commDir);
  const agents: Agent[] = [];

  for (const entry of entries) {
    const entryPath = path.join(config.commDir, entry);
    
    if (await fs.isDirectory(entryPath) && !entry.startsWith('.')) {
      const tasks = await getAgentTasks(config, entry);
      
      const agent: Agent = {
        name: entry,
        taskCount: tasks.length,
        completedCount: tasks.filter(t => t.hasDone).length,
        pendingCount: tasks.filter(t => t.hasInit && !t.hasDone && !t.hasError).length,
        errorCount: tasks.filter(t => t.hasError).length
      };
      
      agents.push(agent);
    }
  }

  // Sort by task count, highest first
  return agents.sort((a, b) => b.taskCount - a.taskCount);
}

/**
 * Initialize a new task from a task file
 */
export async function initializeTask(
  config: ServerConfig, 
  agentName: string, 
  taskId: string  // Changed from taskFileName - now takes clean taskId
): Promise<{ taskDir: string; initPath: string }> {
  validateAgentName(agentName);
  validateTaskName(taskId);  // Validate clean taskId instead of filename

  const agentDir = path.join(config.commDir, agentName);
  await fs.ensureDirectory(agentDir);

  // Generate unique timestamped directory name internally
  const timestamp = fs.generateTimestamp();
  const internalTaskDir = `${timestamp}-${taskId}`;  // Internal: timestamped directory
  const taskDir = path.join(agentDir, internalTaskDir);
  await fs.ensureDirectory(taskDir);

  // Create INIT.md placeholder (no file moving needed)
  const initPath = path.join(taskDir, 'INIT.md');
  const initContent = `# Task: ${taskId}\n\nTask initialized and ready for content.\n`;
  await fs.writeFile(initPath, initContent);

  return { taskDir: internalTaskDir, initPath };
}


/**
 * Archive tasks based on options
 */
export async function archiveTasks(
  config: ServerConfig,
  options: ArchiveOptions
): Promise<ArchiveResult> {
  if (!config.enableArchiving) {
    throw new Error('Archiving is disabled');
  }

  const timestamp = fs.generateTimestamp();
  const archiveBasePath = path.join(config.archiveDir, timestamp);

  let archivedCompleted = 0;
  let archivedPending = 0;

  // Get all agents or filter by specific agent
  const agents = options.agent ? [options.agent] : 
    (await getAllAgents(config)).map(a => a.name);

  for (const agentName of agents) {
    const tasks = await getAgentTasks(config, agentName);
    
    for (const task of tasks) {
      if (task.isNew) continue; // Skip new task files
      
      let shouldArchive = false;
      let isCompleted = false;
      
      switch (options.mode) {
        case 'completed':
          shouldArchive = task.hasDone;
          isCompleted = true;
          break;
          
        case 'all':
          shouldArchive = true;
          isCompleted = task.hasDone;
          break;
          
        case 'by-agent':
          shouldArchive = agentName === options.agent;
          isCompleted = task.hasDone;
          break;
          
        case 'by-date':
          if (options.olderThan && task.created) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - options.olderThan);
            shouldArchive = task.created < cutoffDate;
            isCompleted = task.hasDone;
          }
          break;
      }
      
      if (shouldArchive) {
        if (!options.dryRun) {
          const archiveType = isCompleted ? 'completed' : 'pending';
          const archivePath = path.join(archiveBasePath, archiveType, agentName);
          const destPath = path.join(archivePath, path.basename(task.path));
          
          await fs.ensureDirectory(archivePath);
          await fs.moveFile(task.path, destPath);
        }
        
        if (isCompleted) {
          archivedCompleted++;
        } else {
          archivedPending++;
        }
      }
    }
  }

  return {
    archived: {
      completed: archivedCompleted,
      pending: archivedPending,
      total: archivedCompleted + archivedPending
    },
    timestamp,
    archivePath: archiveBasePath
  };
}

/**
 * Restore tasks from archive
 */
export async function restoreTasks(
  config: ServerConfig,
  timestamp: string,
  agentName?: string,
  taskName?: string
): Promise<RestoreResult> {
  if (!config.enableArchiving) {
    throw new Error('Archiving is disabled');
  }

  const archiveBasePath = path.join(config.archiveDir, timestamp);
  if (!await fs.pathExists(archiveBasePath)) {
    throw new Error(`Archive not found: ${timestamp}`);
  }

  let restoredCompleted = 0;
  let restoredPending = 0;

  const archiveTypes = ['completed', 'pending'];
  
  for (const archiveType of archiveTypes) {
    const archiveTypePath = path.join(archiveBasePath, archiveType);
    if (!await fs.pathExists(archiveTypePath)) continue;

    const archivedAgents = agentName ? [agentName] : await fs.listDirectory(archiveTypePath);
    
    for (const agent of archivedAgents) {
      const agentArchivePath = path.join(archiveTypePath, agent);
      if (!await fs.isDirectory(agentArchivePath)) continue;

      const archivedTasks = await fs.listDirectory(agentArchivePath);
      
      for (const archivedTask of archivedTasks) {
        if (taskName && !archivedTask.includes(taskName)) continue;
        
        const sourcePath = path.join(agentArchivePath, archivedTask);
        const destPath = path.join(config.commDir, agent, archivedTask);
        
        await fs.ensureDirectory(path.dirname(destPath));
        await fs.moveFile(sourcePath, destPath);
        
        if (archiveType === 'completed') {
          restoredCompleted++;
        } else {
          restoredPending++;
        }
      }
    }
  }

  return {
    restored: {
      completed: restoredCompleted,
      pending: restoredPending,
      total: restoredCompleted + restoredPending
    },
    timestamp
  };
}

/**
 * Clean up old archives
 */
export async function cleanupArchives(
  config: ServerConfig,
  maxAgeInDays: number
): Promise<number> {
  if (!config.enableArchiving) {
    return 0;
  }

  if (!await fs.pathExists(config.archiveDir)) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

  const archives = await fs.listDirectory(config.archiveDir);
  let deletedCount = 0;

  for (const archiveName of archives) {
    try {
      // Parse timestamp from archive name (format: YYYY-MM-DDTHH-mm-ss)
      const isoString = archiveName.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3') + 'Z';
      const archiveDate = new Date(isoString);
      
      if (archiveDate < cutoffDate) {
        const archivePath = path.join(config.archiveDir, archiveName);
        await fs.remove(archivePath);
        deletedCount++;
      }
    } catch {
      // Skip invalid archive names
    }
  }

  return deletedCount;
}