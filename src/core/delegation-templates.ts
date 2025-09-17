/**
 * Delegation Templates for Smart Response System
 * Provides exact Task tool invocation commands for Issue #12 resolution
 */

/**
 * Generate a complete Task tool invocation command for delegation
 * This addresses Issue #12 by providing the exact command agents need
 */
import debug from 'debug';

const log = debug('agent-comm:core:delegationtemplates');

// Initialize delegation templates module
log('Delegation templates module initialized');

export function generateTaskToolInvocation(
  targetAgent: string,
  taskId: string,
  taskContent: string
): string {
  // Escape quotes in content for proper command formatting
  const escapedContent = taskContent
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')     // Then escape quotes
    .replace(/\n/g, '\\n');   // Handle newlines

  return `Task(
  subagent_type="${targetAgent}",
  prompt="You have an assigned MCP task: ${taskId}

Start with: mcp__agent_comm__check_tasks(agent=\\"${targetAgent}\\")

Then get the full context and begin implementation.

Requirements:
${escapedContent}"
)`;
}

/**
 * Generate a simplified Task tool command (for display in guidance)
 */
export function generateSimpleTaskCommand(
  targetAgent: string,
  taskId: string
): string {
  return `Task(subagent_type="${targetAgent}", prompt="Check MCP task: ${taskId}")`;
}

/**
 * Generate delegation completion checklist
 */
export function generateDelegationChecklist(
  taskId: string,
  targetAgent: string,
  isCompleted = false
): string {
  const checklist = `
📋 Delegation Checklist for Task ${taskId}:
${isCompleted ? '✅' : '☐'} Step 1: Create MCP communication task
${isCompleted ? '✅' : '☐'} Step 2: Invoke Task tool to start ${targetAgent}
${isCompleted ? '✅' : '☐'} Step 3: Monitor progress with track_task_progress()
${isCompleted ? '✅' : '☐'} Step 4: Verify completion with get_full_lifecycle()
`;
  
  return checklist.trim();
}

/**
 * Generate a delegation reminder with escalating urgency
 */
export function generateDelegationReminder(
  incompleteDelegations: {
    taskId: string;
    targetAgent: string;
    ageMinutes: number;
  }[]
): string {
  if (incompleteDelegations.length === 0) {
    return '';
  }

  let reminder = '';
  
  // Determine urgency based on oldest delegation
  const oldestAge = Math.max(...incompleteDelegations.map(d => d.ageMinutes));
  
  if (oldestAge >= 180) { // 3+ hours
    reminder = '🚨🚨🚨 CRITICAL DELEGATION FAILURE 🚨🚨🚨\n';
  } else if (oldestAge >= 60) { // 1+ hour
    reminder = '⚠️⚠️ URGENT: INCOMPLETE DELEGATIONS ⚠️⚠️\n';
  } else if (oldestAge >= 30) { // 30+ minutes
    reminder = '⚠️ WARNING: Delegations Need Completion\n';
  } else {
    reminder = '📋 Reminder: Complete Your Delegations\n';
  }
  
  reminder += `\nYou have ${incompleteDelegations.length} incomplete delegation(s):\n`;
  
  for (const delegation of incompleteDelegations) {
    const hours = Math.floor(delegation.ageMinutes / 60);
    const minutes = delegation.ageMinutes % 60;
    const ageStr = hours > 0 
      ? `${hours}h ${minutes}m ago`
      : `${minutes} minutes ago`;
    
    reminder += `\n❗ Task: ${delegation.taskId}`;
    reminder += `\n   Target: ${delegation.targetAgent}`;
    reminder += `\n   Created: ${ageStr}`;
    reminder += `\n   Action: Task(subagent_type="${delegation.targetAgent}", prompt="Check MCP task: ${delegation.taskId}")`;
    reminder += '\n';
  }
  
  reminder += '\n' + generateTwoPhaseExplanation();
  
  return reminder;
}

/**
 * Generate explanation of two-phase delegation pattern
 */
export function generateTwoPhaseExplanation(): string {
  return `
📚 Two-Phase Delegation Pattern:
─────────────────────────────
Phase 1: Create MCP Task ✅
  └─ Sets up communication channel
  └─ Defines requirements
  └─ Establishes tracking

Phase 2: Invoke Task Tool ❗
  └─ Actually starts the subagent
  └─ Begins real work execution
  └─ Enables progress monitoring

⚡ BOTH phases are REQUIRED for delegation to work!
Without Phase 2, the task exists but no agent is working on it.`.trim();
}

/**
 * Generate success message for completed delegation
 */
export function generateDelegationSuccess(
  taskId: string,
  targetAgent: string
): string {
  return `
🎉 Delegation Successfully Completed!
────────────────────────────────────
Task ID: ${taskId}
Target Agent: ${targetAgent}
Status: ✅ Both phases complete

The subagent is now working on the task.
You can monitor progress with:
  track_task_progress(agent="${targetAgent}", taskId="${taskId}")`.trim();
}

/**
 * Generate example delegation workflow
 */
export function generateDelegationExample(): string {
  return `
📖 Complete Delegation Example:
─────────────────────────────

// Step 1: Create the MCP task
const task = await mcp__agent_comm__create_task({
  agent: "senior-backend-engineer",
  taskName: "implement-auth-system",
  content: "Implement OAuth2 authentication"
});

// Step 2: Start the subagent (CRITICAL - Don't forget!)
Task(
  subagent_type="senior-backend-engineer",
  prompt="You have an assigned MCP task: implement-auth-system
  
  Start with: mcp__agent_comm__check_tasks(agent=\\"senior-backend-engineer\\")
  Then get context and begin implementation."
);

// Step 3: Monitor progress (optional but recommended)
const progress = await track_task_progress({
  agent: "senior-backend-engineer",
  taskId: task.taskId
});`.trim();
}

/**
 * Validate if a Task tool command is properly formatted
 */
export function validateTaskToolCommand(command: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check for basic structure
  if (!command.includes('Task(')) {
    errors.push('Missing Task( function call');
  }
  
  if (!command.includes('subagent_type=')) {
    errors.push('Missing subagent_type parameter');
  }
  
  if (!command.includes('prompt=')) {
    errors.push('Missing prompt parameter');
  }
  
  // Check for MCP task reference
  if (!command.includes('mcp__agent_comm__check_tasks')) {
    errors.push('Missing MCP task check command in prompt');
  }
  
  // Check for proper quote escaping
  const promptMatch = command.match(/prompt="([^"]+)"/);
  if (promptMatch && promptMatch[1].includes('"') && !promptMatch[1].includes('\\"')) {
    errors.push('Unescaped quotes in prompt parameter');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}