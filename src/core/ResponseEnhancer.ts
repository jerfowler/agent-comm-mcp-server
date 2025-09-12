/**
 * ResponseEnhancer - Core response enhancement engine for Smart Response System
 * Enhances MCP tool responses with contextual guidance to improve agent compliance
 */

import type { 
  EnhancementContext, 
  EnhancedResponse,
  ToolEnhancer,
  ServerConfig 
} from '../types.js';

/**
 * ResponseEnhancer class manages the enhancement of tool responses
 * with contextual guidance, compliance tracking, and delegation detection
 */
export class ResponseEnhancer {
  private enhancers = new Map<string, ToolEnhancer>();

  constructor(config: ServerConfig) {
    // Config is passed for future extensibility, but not currently used
    void config;
    this.registerDefaultEnhancers();
  }

  /**
   * Register default enhancers for core tools
   */
  private registerDefaultEnhancers(): void {
    // Register default enhancers for key tools
    this.registerEnhancer('create_task', {
      enhance: async (context) => this.enhanceCreateTask(context)
    });

    this.registerEnhancer('submit_plan', {
      enhance: async (context) => this.enhanceSubmitPlan(context)
    });

    this.registerEnhancer('report_progress', {
      enhance: async (context) => this.enhanceReportProgress(context)
    });

    this.registerEnhancer('mark_complete', {
      enhance: async (context) => this.enhanceMarkComplete(context)
    });
  }

  /**
   * Enhance a tool response with contextual guidance
   */
  async enhance(context: EnhancementContext): Promise<EnhancedResponse> {
    // Handle null responses
    if (context.toolResponse === null) {
      return null as unknown as EnhancedResponse;
    }

    try {
      // Get compliance level if tracker is available
      let complianceLevel: number | undefined;
      if (context.complianceTracker) {
        complianceLevel = await context.complianceTracker.getComplianceLevel(context.agent);
      }

      // Check for incomplete delegations if tracker is available
      if (context.delegationTracker) {
        // Note: Checking but not using here, actual usage is below
        await context.delegationTracker.checkIncompleteDelegations(context.agent);
        
        // Track new delegation if this is a create_task call
        if (context.toolName === 'create_task' && 
            context.toolResponse && 
            typeof context.toolResponse === 'object' &&
            'taskType' in context.toolResponse &&
            context.toolResponse.taskType === 'delegation' &&
            'targetAgent' in context.toolResponse &&
            typeof context.toolResponse.targetAgent === 'string' &&
            'taskId' in context.toolResponse &&
            typeof context.toolResponse.taskId === 'string') {
          await context.delegationTracker.recordDelegationCreated(
            context.toolResponse.taskId,
            context.toolResponse.targetAgent
          );
        }
      }

      // Get tool-specific enhancer
      const enhancer = this.enhancers.get(context.toolName);
      let guidance: EnhancedResponse['guidance'];

      if (enhancer) {
        guidance = await enhancer.enhance(context);
      } else {
        // Default enhancement for unregistered tools
        guidance = await this.defaultEnhancement(context);
      }

      // Add compliance level if available
      if (guidance && complianceLevel !== undefined) {
        guidance.compliance_level = complianceLevel;
      }

      // Add delegation alerts if needed
      if (context.delegationTracker) {
        const incompleteDelegations = await context.delegationTracker.checkIncompleteDelegations(context.agent);
        if (incompleteDelegations.length > 0 && guidance) {
          const delegationReminder = await context.delegationTracker.generateDelegationReminder(context.agent);
          if (delegationReminder) {
            guidance.contextual_reminder = `${guidance.contextual_reminder}\n\n${delegationReminder}`;
          }
        }
      }

      // Return enhanced response
      return {
        ...(context.toolResponse as Record<string, unknown>),
        guidance
      } as EnhancedResponse;
    } catch (error) {
      // On error, return original response without enhancement
      // Note: Logging removed - should use EventLogger if needed
      return context.toolResponse as EnhancedResponse;
    }
  }

  /**
   * Register a custom tool enhancer
   */
  registerEnhancer(toolName: string, enhancer: ToolEnhancer): void {
    this.enhancers.set(toolName, enhancer);
  }

  /**
   * Check if an enhancer is registered for a tool
   */
  hasEnhancer(toolName: string): boolean {
    return this.enhancers.has(toolName);
  }

  /**
   * Generate next steps based on tool and context
   */
  generateNextSteps(context: EnhancementContext): string {
    const { toolName, toolResponse } = context;

    switch (toolName) {
      case 'create_task': {
        if (toolResponse && 
            typeof toolResponse === 'object' &&
            'taskType' in toolResponse &&
            toolResponse.taskType === 'delegation') {
          return 'Complete delegation by invoking the Task tool';
        }
        return 'Submit your implementation plan with checkboxes';
      }

      case 'submit_plan':
        return 'Begin implementation and sync with TodoWrite';

      case 'report_progress': {
        const completed = (toolResponse && 
                          typeof toolResponse === 'object' &&
                          'completedSteps' in toolResponse &&
                          typeof toolResponse.completedSteps === 'number') ? 
                          toolResponse.completedSteps : 0;
        const total = (toolResponse && 
                       typeof toolResponse === 'object' &&
                       'totalSteps' in toolResponse &&
                       typeof toolResponse.totalSteps === 'number') ? 
                       toolResponse.totalSteps : 1;
        if (completed < total) {
          return 'Continue with remaining steps';
        }
        return 'Consider marking task complete';
      }

      case 'mark_complete':
        return 'Archive completed tasks and check for new assignments';

      default:
        return 'Continue with your workflow';
    }
  }

  /**
   * Default enhancement for tools without specific enhancers
   */
  private async defaultEnhancement(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const nextSteps = this.generateNextSteps(context);
    
    let contextualReminder = 'Continue following MCP protocol';
    if (context.complianceTracker) {
      contextualReminder = await context.complianceTracker.getPersonalizedGuidance(
        context.agent,
        context.toolName
      );
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };
  }

  /**
   * Enhance create_task tool responses
   */
  private async enhanceCreateTask(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { toolResponse, agent } = context;
    
    // Generate base guidance
    const nextSteps = this.generateNextSteps(context);
    
    // Get personalized guidance if available
    let contextualReminder = '✅ Task created successfully';
    if (context.complianceTracker) {
      contextualReminder = await context.complianceTracker.getPersonalizedGuidance(agent, 'create_task');
    }

    // Special handling for delegation tasks
    const guidance: EnhancedResponse['guidance'] = {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };

    if (toolResponse && 
        typeof toolResponse === 'object' &&
        'taskType' in toolResponse &&
        toolResponse.taskType === 'delegation' &&
        'targetAgent' in toolResponse &&
        typeof toolResponse.targetAgent === 'string' &&
        'taskId' in toolResponse &&
        typeof toolResponse.taskId === 'string') {
      // Add actionable command for delegation
      const taskId = toolResponse.taskId;
      const targetAgent = toolResponse.targetAgent;
      
      guidance.actionable_command = `Task(subagent_type="${targetAgent}", prompt="Check MCP task: ${taskId}")`;
      guidance.contextual_reminder = '📋 2-Phase Delegation: ✅ Task Created → ❗ NEXT: Start Subagent';
      
      // Generate full delegation template if DelegationTracker is available
      if (context.delegationTracker) {
        const content = ('content' in toolResponse && typeof toolResponse.content === 'string') ? 
                        toolResponse.content : 'Complete the assigned task';
        guidance.delegation_template = context.delegationTracker.generateTaskToolInvocation(
          targetAgent,
          taskId,
          content
        );
      }
    }

    return guidance;
  }

  /**
   * Enhance submit_plan tool responses
   */
  private async enhanceSubmitPlan(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;
    
    const nextSteps = this.generateNextSteps(context);
    
    let contextualReminder = '📝 Plan submitted! Remember to use TodoWrite for tracking';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'submit_plan');
      if (guidance) {
        contextualReminder = guidance;
      }
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };
  }

  /**
   * Enhance report_progress tool responses
   */
  private async enhanceReportProgress(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;
    
    const nextSteps = this.generateNextSteps(context);
    
    let contextualReminder = '📊 Progress updated! Keep TodoWrite synchronized';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'report_progress');
      if (guidance) {
        contextualReminder = guidance;
      }
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };
  }

  /**
   * Enhance mark_complete tool responses
   */
  private async enhanceMarkComplete(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent, toolResponse } = context;
    
    const nextSteps = this.generateNextSteps(context);
    
    let contextualReminder = '✅ Task completed successfully!';
    if (toolResponse && 
        typeof toolResponse === 'object' &&
        'status' in toolResponse &&
        toolResponse.status === 'ERROR') {
      contextualReminder = '❌ Task marked with error status';
    }
    
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'mark_complete');
      if (guidance) {
        contextualReminder = `${contextualReminder} ${guidance}`;
      }
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };
  }
}