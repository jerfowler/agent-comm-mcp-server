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
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<MarkCompleteResult> {
  const agent = validateRequiredString(args['agent'], 'agent');
  const status = validateRequiredString(args['status'], 'status') as 'DONE' | 'ERROR';
  const summary = validateRequiredString(args['summary'], 'summary');

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

  // Create task context manager with the provided config
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  try {
    // Generate unique connection ID for this operation
    const connectionId = `mark-complete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create and register connection for this completion
    const connection = {
      id: connectionId,
      agent,
      startTime: new Date(),
      metadata: { operation: 'mark-complete' }
    };
    config.connectionManager.register(connection);
    
    // Mark task as complete using TaskContextManager
    const completionResult = await contextManager.markComplete(
      status,
      summary.trim(),
      connection
    );

    return {
      success: true,
      message: `Task marked as ${status} successfully`,
      taskId: connectionId,
      completionResult
    };

  } catch (error) {
    throw new Error(`Failed to mark task complete: ${error instanceof Error ? error.message : String(error)}`);
  }
}