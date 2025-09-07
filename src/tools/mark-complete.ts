/**
 * Mark complete tool - Task completion without file path exposure
 * Marks task as complete or error without exposing file operations
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager, CompletionResult } from '../core/TaskContextManager.js';
import { validateRequiredString } from '../utils/validation.js';

export interface MarkCompleteArgs {
  agent: string;
  status: 'DONE' | 'ERROR';
  summary: string;
  reconciliation_mode?: 'strict' | 'auto_complete' | 'reconcile' | 'force';
  reconciliation_explanations?: Record<string, string>;
}

export interface MarkCompleteResult {
  success: boolean;
  message: string;
  taskId: string;
  completionResult: CompletionResult;
}

/**
 * Mark task as complete (DONE or ERROR) with intelligent reconciliation
 */
export async function markComplete(
  args: MarkCompleteArgs,
  config?: ServerConfig,
  taskContextManager?: TaskContextManager
): Promise<MarkCompleteResult> {
  const { agent, status, summary, reconciliation_mode = 'strict', reconciliation_explanations } = args;

  // Validate inputs
  validateRequiredString(agent, 'agent');
  validateRequiredString(status, 'status');
  validateRequiredString(summary?.trim(), 'summary');

  if (!['DONE', 'ERROR'].includes(status)) {
    throw new Error('Status must be either "DONE" or "ERROR"');
  }

  if (summary.trim().length < 10) {
    throw new Error('Summary must be at least 10 characters long');
  }

  // Create default configuration if not provided
  if (!config) {
    config = {
      commDir: './comm',
      archiveDir: './comm/.archive',
      logDir: './comm/.logs'
    };
  }

  // Create task context manager if not provided
  if (!taskContextManager) {
    taskContextManager = new TaskContextManager(config);
  }

  try {
    // Generate unique connection ID for this operation
    const connectionId = `mark-complete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Mark task as complete using TaskContextManager
    const completionResult = await taskContextManager.markTaskComplete(
      agent,
      connectionId,
      status,
      summary.trim()
    );

    return {
      success: true,
      message: `Task marked as ${status} successfully`,
      taskId: completionResult.taskId || 'unknown',
      completionResult
    };

  } catch (error) {
    throw new Error(`Failed to mark task complete: ${error instanceof Error ? error.message : String(error)}`);
  }
}