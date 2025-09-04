/**
 * Submit plan tool - Plan submission without file exposure
 * Accepts plan content and handles file creation internally
 */

import { ServerConfig } from '../types.js';
import { TaskContextManager, PlanSubmissionResult } from '../core/TaskContextManager.js';
import { validateRequiredString } from '../utils/validation.js';
import { AgentCommError } from '../types.js';

interface PlanValidationResult {
  valid: boolean;
  checkboxCount: number;
  errors: string[];
}

/**
 * Validate plan format according to checkbox requirements
 */
function validatePlanFormat(content: string): PlanValidationResult {
  const errors: string[] = [];
  
  // Check for checkbox format: - [ ] **Title**: Description
  const checkboxRegex = /^- \[ \] \*\*[^:]+\*\*:/gm;
  const checkboxes = content.match(checkboxRegex) || [];
  
  // Require at least one checkbox
  if (checkboxes.length === 0) {
    errors.push('Plan must include at least ONE trackable item with checkbox format. Example: - [ ] **Task Name**: Description');
  }
  
  // Check for forbidden status markers
  const statusMarkerRegex = /\[(PENDING|COMPLETE|IN_PROGRESS|TODO|DONE|BLOCKED)\]/gi;
  const statusMarkers = content.match(statusMarkerRegex);
  
  if (statusMarkers && statusMarkers.length > 0) {
    errors.push(`Use checkbox format only. Remove these status markers: ${statusMarkers.join(', ')}. Replace with - [ ] or - [x]`);
  }
  
  // Validate each checkbox has detail points
  if (checkboxes.length > 0) {
    const lines = content.split('\n');
    checkboxes.forEach((checkbox) => {
      const checkboxLineIndex = lines.findIndex(l => l.includes(checkbox.replace(/\*/g, '\\*')));
      if (checkboxLineIndex >= 0) {
        const nextLines = lines.slice(checkboxLineIndex + 1, checkboxLineIndex + 6);
        const hasDetails = nextLines.some(l => l.trim().startsWith('-') && !l.trim().startsWith('- [ ]'));
        
        if (!hasDetails) {
          const checkboxTitle = checkbox.match(/\*\*([^:]+)\*\*/)?.[1] || 'Unknown';
          errors.push(`Checkbox "${checkboxTitle}" missing required detail points. Each checkbox must have 2-5 detail bullets.`);
        }
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    checkboxCount: checkboxes.length,
    errors
  };
}

/**
 * Submit plan content without exposing file creation
 */
export async function submitPlan(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<PlanSubmissionResult> {
  const content = validateRequiredString(args['content'], 'content');
  const agent = validateRequiredString(args['agent'], 'agent');
  
  // Validate plan format before submission
  const validation = validatePlanFormat(content);
  
  if (!validation.valid) {
    const errorMessage = [
      'Plan format validation failed:',
      ...validation.errors,
      '',
      'Required format:',
      '- [ ] **Step Title**: Brief description',
      '  - Action: Specific command or task',
      '  - Expected: Success criteria',
      '  - Error: Handling approach if fails',
      '',
      'Example:',
      '- [ ] **Test Discovery**: Identify all test configurations',
      '  - Run: `pnpm list --filter "*" --depth 0`',
      '  - Expected: List of all test files and configurations',
      '  - Error: If no tests found, document as critical issue'
    ].join('\n');
    
    throw new AgentCommError(errorMessage, 'PLAN_FORMAT_INVALID');
  }
  
  // Create connection for the agent
  const connection = {
    id: `submit-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agent,
    startTime: new Date(),
    metadata: { 
      operation: 'submit-plan', 
      contentSize: content.length,
      checkboxCount: validation.checkboxCount
    }
  };
  
  // Ensure required components exist
  if (!config.connectionManager || !config.eventLogger) {
    throw new Error('Configuration missing required components: connectionManager and eventLogger');
  }
  
  const contextManager = new TaskContextManager({
    commDir: config.commDir,
    connectionManager: config.connectionManager,
    eventLogger: config.eventLogger
  });

  return await contextManager.submitPlan(content, connection);
}