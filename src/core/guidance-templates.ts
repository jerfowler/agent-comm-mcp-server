/**
 * Guidance Templates for Smart Response System
 * Provides contextual messages based on tool and escalation level
 */

import debug from 'debug';

const log = debug('agent-comm:core:guidancetemplates');

// Initialize guidance templates
log('Guidance templates for smart response system loaded');

export interface GuidanceTemplate {
  level_1: string;  // Friendly reminder (90-100 compliance)
  level_2: string;  // Warning message (70-89 compliance)
  level_3: string;  // Critical notification (50-69 compliance)
  level_4: string;  // Blocking intervention (0-49 compliance)
}

/**
 * Tool-specific guidance templates with variable substitution
 */
export const GUIDANCE_TEMPLATES: Record<string, GuidanceTemplate> = {
  create_task: {
    level_1: "✅ Task created! NEXT: Submit your implementation plan with checkboxes using submit_plan()",
    level_2: "⚠️ Task created. You have {unsubmittedPlans} tasks without plans. Submit plan now using submit_plan()",
    level_3: "🚨 CRITICAL: Task created but {delegationRate}% delegation completion rate. You MUST complete the full workflow!",
    level_4: "❌ BLOCKED: Cannot create more tasks until existing delegation workflow completed. Complete pending tasks first."
  },

  submit_plan: {
    level_1: "✅ Excellent plan! NEXT: Begin implementation with TodoWrite for progress tracking",
    level_2: "⚠️ Plan submitted. IMPORTANT: You must use TodoWrite to track your progress through the plan",
    level_3: "🚨 CRITICAL: Plan submitted but your TodoWrite usage is only {todoUsageRate}%. This is REQUIRED!",
    level_4: "❌ WARNING: Plan submitted but severe compliance issues detected. Follow ALL protocol steps or tasks will be blocked."
  },

  report_progress: {
    level_1: "✅ Progress updated! Keep going with the remaining {remainingSteps} steps",
    level_2: "⚠️ Progress reported. Remember to keep TodoWrite synchronized with your progress",
    level_3: "🚨 IMPORTANT: Progress reported but compliance is low. Ensure ALL steps are properly tracked",
    level_4: "❌ Progress reported but critical compliance violations detected. Review protocol immediately."
  },

  mark_complete: {
    level_1: "🎉 Excellent work! Task completed successfully. NEXT: Archive completed tasks and check for new assignments",
    level_2: "✅ Task complete. Consider archiving with archive_completed_tasks() and improving workflow compliance",
    level_3: "⚠️ Task marked complete but compliance score is {complianceScore}%. Review and improve your workflow",
    level_4: "❌ Task complete but CRITICAL compliance issues. Your future tasks may be restricted."
  },

  archive_tasks: {
    level_1: "✅ Tasks archived successfully! Your workspace is clean and organized",
    level_2: "⚠️ Tasks archived. Remember to maintain regular cleanup habits",
    level_3: "🚨 Tasks archived but you have {pendingCount} incomplete tasks. Complete them soon",
    level_4: "❌ Archive complete but severe backlog detected. Focus on completing pending work."
  },

  check_tasks: {
    level_1: "✅ Found {taskCount} tasks. Remember to process them systematically",
    level_2: "⚠️ You have {newCount} new tasks and {activeCount} active tasks. Don't let them pile up",
    level_3: "🚨 WARNING: {taskCount} tasks found with {errorCount} errors. Address errors immediately",
    level_4: "❌ CRITICAL: Too many pending tasks ({pendingCount}). Stop creating new tasks and complete existing ones."
  }
};

/**
 * Delegation-specific templates for Issue #12
 */
export const DELEGATION_TEMPLATES: GuidanceTemplate = {
  level_1: "📋 Delegation task created! NEXT STEP: Invoke Task tool to start the subagent",
  level_2: "⚠️ REMINDER: Delegation is a 2-step process. You've done step 1 (create task). Now do step 2 (invoke Task tool)!",
  level_3: "🚨 CRITICAL: You frequently forget to complete delegations! After creating task, you MUST invoke Task tool!",
  level_4: "❌ BLOCKED: Your delegation completion rate is too low. You MUST invoke Task tool after creating delegation tasks!"
};

/**
 * TodoWrite integration reminders
 */
export const TODOWRITE_REMINDERS: GuidanceTemplate = {
  level_1: "💡 Tip: Use TodoWrite to track your progress through this task",
  level_2: "⚠️ Remember: TodoWrite integration is expected for all tasks",
  level_3: "🚨 WARNING: Your TodoWrite usage is below requirements. This is not optional!",
  level_4: "❌ CRITICAL: TodoWrite is MANDATORY. Your compliance will affect future capabilities."
};

/**
 * Process a template with variable substitution
 */
export function processTemplate(template: string, variables: Record<string, unknown>): string {
  let processed = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    processed = processed.replace(regex, String(value));
  }
  
  return processed;
}

/**
 * Get the appropriate template based on escalation level
 */
export function getTemplateForLevel(
  templates: GuidanceTemplate,
  level: number
): string {
  switch (level) {
    case 1:
      return templates.level_1;
    case 2:
      return templates.level_2;
    case 3:
      return templates.level_3;
    case 4:
      return templates.level_4;
    default:
      return templates.level_1;
  }
}

/**
 * Generate a complete guidance message
 */
export function generateGuidanceMessage(
  toolName: string,
  escalationLevel: number,
  variables: Record<string, unknown>,
  isDelegation = false
): string {
  // Get the appropriate template
  const templates = isDelegation ? DELEGATION_TEMPLATES : 
                   (toolName in GUIDANCE_TEMPLATES ? GUIDANCE_TEMPLATES[toolName] : null);
  
  if (!templates) {
    return "Continue following MCP protocol.";
  }
  
  // Get template for escalation level
  const template = getTemplateForLevel(templates, escalationLevel);
  
  // Process variables
  return processTemplate(template, variables);
}

/**
 * Generate actionable next steps
 */
interface TaskContext {
  completedSteps?: number;
  totalSteps?: number;
}

export function generateNextSteps(toolName: string, _context: TaskContext): string[] {
  const steps: string[] = [];
  
  switch (toolName) {
    case 'create_task':
      // Always provide consistent steps for all tasks
      steps.push('1. Copy the Task tool invocation command below');
      steps.push('2. Execute it to start the subagent');
      steps.push('3. Monitor progress with track_task_progress()');
      break;
      
    case 'submit_plan':
      steps.push('1. Initialize TodoWrite with your plan items');
      steps.push('2. Mark first item as in_progress');
      steps.push('3. Begin implementation');
      steps.push('4. Update todos as you complete each step');
      break;
      
    case 'report_progress':
      steps.push('1. Sync TodoWrite with current progress');
      steps.push('2. Continue with next uncompleted step');
      steps.push('3. Report progress again when significant work is done');
      break;
      
    case 'mark_complete':
      steps.push('1. Run archive_completed_tasks() to clean workspace');
      steps.push('2. Check for new tasks with check_tasks()');
      steps.push('3. Begin next priority task');
      break;
      
    default:
      steps.push('Continue with your current workflow');
  }
  
  return steps;
}