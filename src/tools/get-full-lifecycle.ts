/**
 * get_full_lifecycle Tool
 * 
 * Diagnostic tool that provides complete visibility into task lifecycle
 * Returns comprehensive lifecycle information including progress analysis
 */

import fs from 'fs-extra';
import path from 'path';
import { validateRequiredString } from '../utils/validation.js';
import { GetFullLifecycleArgs, GetFullLifecycleResult, ServerConfig, ProgressMarkers } from '../types.js';

export async function getFullLifecycle(
  config: ServerConfig,
  args: GetFullLifecycleArgs
): Promise<GetFullLifecycleResult> {
  // Validate parameters
  validateRequiredString(args.agent, 'agent');
  validateRequiredString(args.taskId, 'taskId');

  // Set defaults
  const includeProgress = args.include_progress !== false; // Default: true

  const taskPath = path.join(config.commDir, args.agent, args.taskId);
  
  // Initialize result structure
  const result: GetFullLifecycleResult = {
    taskId: args.taskId,
    agent: args.agent,
    lifecycle: {
      init: { exists: false },
      plan: { exists: false },
      outcome: { type: 'pending' }
    },
    summary: {
      final_status: 'not_found'
    }
  };

  // Check if task directory exists
  if (!await fs.pathExists(taskPath)) {
    return result;
  }

  let initTime: Date | undefined;
  let completionTime: Date | undefined;

  // Check INIT.md file
  const initPath = path.join(taskPath, 'INIT.md');
  if (await fs.pathExists(initPath)) {
    result.lifecycle.init.exists = true;
    result.lifecycle.init.content = await fs.readFile(initPath, 'utf-8');
    const stats = await fs.stat(initPath);
    result.lifecycle.init.created_at = stats.mtime.toISOString();
    initTime = stats.mtime;
    result.summary.final_status = 'not_started';
  }

  // Check PLAN.md file
  const planPath = path.join(taskPath, 'PLAN.md');
  if (await fs.pathExists(planPath)) {
    result.lifecycle.plan.exists = true;
    result.lifecycle.plan.content = await fs.readFile(planPath, 'utf-8');
    const stats = await fs.stat(planPath);
    result.lifecycle.plan.last_updated = stats.mtime.toISOString();
    result.summary.final_status = 'in_progress';

    // Parse progress markers if requested
    if (includeProgress) {
      result.lifecycle.plan.progress_markers = parseProgressMarkers(
        result.lifecycle.plan.content
      );
    }
  }

  // Check for completion files (DONE.md or ERROR.md)
  const donePath = path.join(taskPath, 'DONE.md');
  const errorPath = path.join(taskPath, 'ERROR.md');

  if (await fs.pathExists(donePath)) {
    result.lifecycle.outcome.type = 'done';
    result.lifecycle.outcome.content = await fs.readFile(donePath, 'utf-8');
    const stats = await fs.stat(donePath);
    result.lifecycle.outcome.completed_at = stats.mtime.toISOString();
    completionTime = stats.mtime;
    result.summary.final_status = 'completed';
  } else if (await fs.pathExists(errorPath)) {
    result.lifecycle.outcome.type = 'error';
    result.lifecycle.outcome.content = await fs.readFile(errorPath, 'utf-8');
    const stats = await fs.stat(errorPath);
    result.lifecycle.outcome.completed_at = stats.mtime.toISOString();
    completionTime = stats.mtime;
    result.summary.final_status = 'failed';
  }

  // Calculate summary metrics
  if (initTime && completionTime) {
    result.summary.duration_seconds = (completionTime.getTime() - initTime.getTime()) / 1000;
  }

  // Calculate progress percentage
  if (result.lifecycle.plan.progress_markers) {
    const markers = result.lifecycle.plan.progress_markers;
    const totalSteps = markers.completed.length + markers.pending.length + (markers.in_progress ? 1 : 0);
    
    if (totalSteps > 0) {
      result.summary.progress_percentage = Math.round((markers.completed.length / totalSteps) * 100);
    } else if (result.lifecycle.outcome.type === 'done') {
      result.summary.progress_percentage = 100;
    } else {
      result.summary.progress_percentage = 0;
    }
  } else {
    // Fallback progress calculation
    if (result.lifecycle.outcome.type === 'done') {
      result.summary.progress_percentage = 100;
    } else if (result.lifecycle.plan.exists) {
      result.summary.progress_percentage = 50; // Has plan but not completed
    } else if (result.lifecycle.init.exists) {
      result.summary.progress_percentage = 0; // Only initialized
    } else {
      result.summary.progress_percentage = 0;
    }
  }

  return result;
}

function parseProgressMarkers(planContent: string): ProgressMarkers {
  const markers: ProgressMarkers = {
    completed: [],
    pending: []
  };

  const lines = planContent.split('\n');
  
  for (const line of lines) {
    // Match progress marker patterns
    const completeMatch = line.match(/^\d+\.\s*\[✓\s*COMPLETE\]\s*(.+)$/);
    const inProgressMatch = line.match(/^\d+\.\s*\[→\s*IN PROGRESS\]\s*(.+)$/);
    const pendingMatch = line.match(/^\d+\.\s*\[(?:PENDING|BLOCKED)\]\s*(.+)$/);
    
    if (completeMatch) {
      markers.completed.push(completeMatch[1].trim());
    } else if (inProgressMatch) {
      markers.in_progress = inProgressMatch[1].trim();
    } else if (pendingMatch) {
      markers.pending.push(pendingMatch[1].trim());
    }
  }

  return markers;
}