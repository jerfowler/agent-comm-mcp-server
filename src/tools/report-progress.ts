/**
 * Report progress tool - Progress updates without file exposure
 * Updates progress markers without exposing file operations
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager, ProgressUpdate, ProgressReportResult } from '../core/TaskContextManager.js';
import { validateRequiredString, validateRequiredConfig } from '../utils/validation.js';

/**
 * Report progress updates without file exposure
 */
export async function reportProgress(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<ProgressReportResult> {
  // Validate configuration has required components
  validateRequiredConfig(config);
  
  const agent = validateRequiredString(args['agent'], 'agent');
  const updatesArray = args['updates'];
  const taskId = args['taskId'] as string | undefined; // Optional taskId parameter
  
  if (!Array.isArray(updatesArray)) {
    throw new Error('Progress updates must be an array');
  }
  
  // Validate and convert updates
  const updates: ProgressUpdate[] = updatesArray.map((update, index) => {
    if (typeof update !== 'object' || update === null) {
      throw new Error(`Update at index ${index} must be an object`);
    }
    
    const updateObj = update as Record<string, unknown>;
    
    const step = updateObj['step'];
    const status = updateObj['status'];
    const description = updateObj['description'];
    const timeSpent = updateObj['timeSpent'];
    const estimatedTimeRemaining = updateObj['estimatedTimeRemaining'];
    const blocker = updateObj['blocker'];
    
    if (typeof step !== 'number') {
      throw new Error(`Update at index ${index}: step must be a number`);
    }
    
    if (typeof status !== 'string' || !['COMPLETE', 'IN_PROGRESS', 'PENDING', 'BLOCKED'].includes(status)) {
      throw new Error(`Update at index ${index}: status must be one of COMPLETE, IN_PROGRESS, PENDING, BLOCKED`);
    }
    
    if (typeof description !== 'string' || description.trim() === '') {
      throw new Error(`Update at index ${index}: description must be a non-empty string`);
    }
    
    return {
      step,
      status: status as 'COMPLETE' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED',
      description: description.trim(),
      ...(typeof timeSpent === 'number' && { timeSpent }),
      ...(typeof estimatedTimeRemaining === 'number' && { estimatedTimeRemaining }),
      ...(typeof blocker === 'string' && blocker.trim() && { blocker: blocker.trim() })
    };
  });
  
  // Create connection for the agent with optional taskId
  const connection = {
    id: `report-progress-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    agent,
    startTime: new Date(),
    metadata: { 
      operation: 'report-progress', 
      updatesCount: updates.length,
      ...(taskId && { taskId }) // Include taskId if provided
    }
  };
  
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  return await contextManager.reportProgress(updates, connection);
}