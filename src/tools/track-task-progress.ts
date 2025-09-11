/**
 * track_task_progress Tool
 * 
 * Real-time progress monitoring tool that provides current task status
 * and detailed progress metrics based on plan step completion
 */

import { pathExists, readFile } from '../utils/file-system.js';
import { stat } from '../utils/fs-extra-safe.js';
import path from 'path';
import { validateRequiredString } from '../utils/validation.js';
import { TrackTaskProgressArgs, TrackTaskProgressResult, ServerConfig } from '../types.js';

export async function trackTaskProgress(
  config: ServerConfig,
  args: TrackTaskProgressArgs
): Promise<TrackTaskProgressResult> {
  // Validate parameters
  validateRequiredString(args.agent, 'agent');
  validateRequiredString(args.taskId, 'taskId');

  const taskPath = path.join(config.commDir, args.agent, args.taskId);
  
  // Initialize result structure
  const result: TrackTaskProgressResult = {
    taskId: args.taskId,
    status: 'pending',
    progress: {
      total_steps: 0,
      completed_steps: 0,
      percentage: 0
    },
    last_updated: new Date().toISOString()
  };

  // Check if task directory exists
  if (!await pathExists(taskPath)) {
    return result;
  }

  // Check completion status first
  const donePath = path.join(taskPath, 'DONE.md');
  const errorPath = path.join(taskPath, 'ERROR.md');
  const planPath = path.join(taskPath, 'PLAN.md');

  if (await pathExists(donePath)) {
    result.status = 'completed';
    const stats = await stat(donePath);
    result.last_updated = stats.mtime.toISOString();
  } else if (await pathExists(errorPath)) {
    result.status = 'error';
    const stats = await stat(errorPath);
    result.last_updated = stats.mtime.toISOString();
  } else if (await pathExists(planPath)) {
    result.status = 'in_progress';
    const stats = await stat(planPath);
    result.last_updated = stats.mtime.toISOString();
  } else {
    // Only INIT file exists or task just created
    const initPath = path.join(taskPath, 'INIT.md');
    if (await pathExists(initPath)) {
      const stats = await stat(initPath);
      result.last_updated = stats.mtime.toISOString();
    }
  }

  // Parse progress from PLAN.md if it exists
  if (await pathExists(planPath)) {
    const planContent = await readFile(planPath);
    const progressInfo = parseProgressFromPlan(planContent);
    
    result.progress = {
      total_steps: progressInfo.totalSteps,
      completed_steps: progressInfo.completedSteps,
      percentage: progressInfo.percentage,
      ...(progressInfo.currentStep && { current_step: progressInfo.currentStep })
    };
  }

  return result;
}

interface ProgressInfo {
  totalSteps: number;
  completedSteps: number;
  percentage: number;
  currentStep?: string;
}

function parseProgressFromPlan(planContent: string): ProgressInfo {
  const lines = planContent.split('\n');
  let totalSteps = 0;
  let completedSteps = 0;
  let currentStep: string | undefined;

  for (const line of lines) {
    // Match progress marker patterns
    const completeMatch = line.match(/^\d+\.\s*\[✓\s*COMPLETE\]\s*(.+)$/);
    const inProgressMatch = line.match(/^\d+\.\s*\[→\s*IN PROGRESS\]\s*(.+)$/);
    const pendingMatch = line.match(/^\d+\.\s*\[(?:PENDING|BLOCKED)\]\s*(.+)$/);
    
    if (completeMatch) {
      totalSteps++;
      completedSteps++;
    } else if (inProgressMatch) {
      totalSteps++;
      currentStep = inProgressMatch[1].trim();
    } else if (pendingMatch) {
      totalSteps++;
    }
  }

  // Calculate percentage
  let percentage = 0;
  if (totalSteps > 0) {
    percentage = Math.round((completedSteps / totalSteps) * 100);
  }

  return {
    totalSteps,
    completedSteps,
    percentage,
    ...(currentStep && { currentStep })
  };
}