/**
 * ResponseEnhancer - Core response enhancement engine for Smart Response System
 * Enhances MCP tool responses with contextual guidance to improve agent compliance
 */

import debug from 'debug';
import type {
  EnhancementContext,
  EnhancedResponse,
  ToolEnhancer,
  ServerConfig,
  ContextUsageData,
  ContextAlert
} from '../types.js';
import { AccountabilityTracker } from './AccountabilityTracker.js';
import { EventLogger } from '../logging/EventLogger.js';
import { ErrorLogger } from '../logging/ErrorLogger.js';
import { ContextThresholdDetector } from './ContextThresholdDetector.js';
import { generateUniversalGuidance } from './orchestration-templates.js';

const log = debug('agent-comm:core:responseenhancer');

/**
 * ResponseEnhancer class manages the enhancement of tool responses
 * with contextual guidance, compliance tracking, and delegation detection
 */
export class ResponseEnhancer {
  private enhancers = new Map<string, ToolEnhancer>();
  private accountabilityTracker: AccountabilityTracker;
  private errorLogger: ErrorLogger | null = null;
  private contextThresholdDetector: ContextThresholdDetector;

  constructor(config: ServerConfig | EventLogger, accountabilityTracker?: AccountabilityTracker) {
    // Config is passed for future extensibility, but not currently used
    void config;

    // Allow injection of AccountabilityTracker for testing
    if (accountabilityTracker) {
      this.accountabilityTracker = accountabilityTracker;
    } else {
      // Initialize AccountabilityTracker with EventLogger from config
      // Handle both ServerConfig and direct EventLogger for testing compatibility
      let eventLogger: EventLogger;
      if (config && 'logOperation' in config && typeof config.logOperation === 'function') {
        // Direct EventLogger passed (for tests)
        eventLogger = config;
      } else if (config && 'eventLogger' in config && config.eventLogger) {
        // ServerConfig passed
        eventLogger = config.eventLogger;
      } else {
        // Fallback
        eventLogger = new EventLogger('./logs');
      }
      this.accountabilityTracker = new AccountabilityTracker(eventLogger);

      // Initialize ErrorLogger for error tracking
      if (config && 'errorLogger' in config && config.errorLogger) {
        this.errorLogger = config.errorLogger;
      }
    }

    // Initialize context threshold detector
    this.contextThresholdDetector = new ContextThresholdDetector();

    this.registerDefaultEnhancers();
  }

  /**
   * Check context usage and generate alerts if needed
   */
  private checkContextUsage(usage: ContextUsageData): ContextAlert | null {
    return this.contextThresholdDetector.checkUsage(usage);
  }

  /**
   * Get context recommendations based on usage
   */
  getContextRecommendations(usage: ContextUsageData): string[] {
    return this.contextThresholdDetector.getRecommendations(usage);
  }

  /**
   * Register default enhancers for core tools
   */
  private registerDefaultEnhancers(): void {
    // Context-Based Tools (5)
    this.registerEnhancer('get_task_context', {
      enhance: async (context) => this.enhanceGetTaskContext(context)
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
    this.registerEnhancer('archive_completed_tasks', {
      enhance: async (context) => this.enhanceArchiveCompletedTasks(context)
    });

    // Traditional Task Tools (7)
    this.registerEnhancer('create_task', {
      enhance: async (context) => this.enhanceCreateTask(context)
    });
    this.registerEnhancer('check_tasks', {
      enhance: async (context) => this.enhanceCheckTasks(context)
    });
    this.registerEnhancer('read_task', {
      enhance: async (context) => this.enhanceReadTask(context)
    });
    this.registerEnhancer('write_task', {
      enhance: async (context) => this.enhanceWriteTask(context)
    });
    this.registerEnhancer('list_agents', {
      enhance: async (context) => this.enhanceListAgents(context)
    });
    this.registerEnhancer('archive_tasks', {
      enhance: async (context) => this.enhanceArchiveTasks(context)
    });
    this.registerEnhancer('restore_tasks', {
      enhance: async (context) => this.enhanceRestoreTasks(context)
    });

    // Diagnostic Tools (2)
    this.registerEnhancer('get_full_lifecycle', {
      enhance: async (context) => this.enhanceGetFullLifecycle(context)
    });
    this.registerEnhancer('track_task_progress', {
      enhance: async (context) => this.enhanceTrackTaskProgress(context)
    });

    // Utility Tools (3)
    this.registerEnhancer('sync_todo_checkboxes', {
      enhance: async (context) => this.enhanceSyncTodoCheckboxes(context)
    });
    this.registerEnhancer('get_server_info', {
      enhance: async (context) => this.enhanceGetServerInfo(context)
    });
    this.registerEnhancer('ping', {
      enhance: async (context) => this.enhancePing(context)
    });
  }

  /**
   * Set AccountabilityTracker for testing purposes
   */
  setAccountabilityTracker(tracker: AccountabilityTracker): void {
    this.accountabilityTracker = tracker;
  }

  /**
   * Enhance a tool response with contextual guidance
   * Alias for enhance() to maintain test compatibility
   */
  async enhanceToolResponse(context: EnhancementContext): Promise<EnhancedResponse> {
    log('enhanceToolResponse called');
    return this.enhance(context);
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
      // Check for red flags on mark_complete BEFORE processing
      if (context.toolName === 'mark_complete' &&
          context.toolResponse &&
          typeof context.toolResponse === 'object') {
        // Use taskId if available, otherwise use a default for testing
        const taskId = 'taskId' in context.toolResponse && typeof context.toolResponse.taskId === 'string'
          ? context.toolResponse.taskId
          : 'test-task-id';

        const redFlags = this.accountabilityTracker.detectRedFlags(
          context.agent,
          taskId
        );

        if (redFlags.length > 0) {
          // Generate and return error response directly
          const errorResponse = this.accountabilityTracker.generateErrorResponse(redFlags);
          return {
            success: false,
            error_code: errorResponse.error_code,
            error_severity: errorResponse.error_severity,
            exit_code: errorResponse.exit_code,
            red_flags: errorResponse.red_flags,
            blocked: errorResponse.blocked,
            trust_score: errorResponse.trust_score,
            verification_commands: errorResponse.verification_commands,
            verification_required: errorResponse.verification_required,
            guidance: {
              next_steps: '⛔ STOP! Red flags detected - completion blocked',
              contextual_reminder: '🚨 DO NOT PROCEED WITHOUT EVIDENCE',
              urgency_level: 'critical',
              trust_level: 'ZERO_TRUST',
              actionable_command: errorResponse.verification_commands?.join(' && ') ?? './tmp/issue-49/verify-all.sh'
            }
          } as EnhancedResponse;
        }
      }

      // Validate report_progress tool
      if (context.toolName === 'report_progress' &&
          context.toolResponse &&
          typeof context.toolResponse === 'object') {
        // Check for empty progress reports
        if ('success' in context.toolResponse && !context.toolResponse.success &&
            'error' in context.toolResponse &&
            typeof context.toolResponse.error === 'string' &&
            context.toolResponse.error.includes('No updates provided')) {
          return {
            success: false,
            error_code: 'NO_EVIDENCE_PROVIDED',
            exit_code: 2,
            red_flags: ['Empty progress report'],
            guidance: {
              error_handling: 'NO_EVIDENCE_PROVIDED - Progress reports cannot be empty',
              next_steps: 'Provide detailed progress updates',
              contextual_reminder: 'Evidence is required for accountability'
            }
          } as EnhancedResponse;
        }

        // Track progress for evidence
        if ('success' in context.toolResponse && context.toolResponse.success && 'updates' in context.toolResponse) {
          void this.accountabilityTracker.recordClaim(
            ('taskId' in context.toolResponse ? context.toolResponse.taskId as string : null) ?? 'unknown',
            context.agent,
            'Progress update provided',
            'Progress tracking evidence'
          );
        }
      }

      // Validate submit_plan tool
      if (context.toolName === 'submit_plan' &&
          context.toolResponse &&
          typeof context.toolResponse === 'object') {

        // Check for failed plan submission with specific errors
        if ('success' in context.toolResponse && !context.toolResponse.success && 'error' in context.toolResponse) {
          const errorMessage = context.toolResponse.error;

          if (typeof errorMessage === 'string' && errorMessage.includes('Plan too short')) {
            return {
              success: false,
              error_code: 'INVALID_PLAN',
              exit_code: 1,
              red_flags: ['Plan too short'],
              guidance: {
                error_handling: 'INVALID_PLAN - Plan must be detailed and comprehensive',
                next_steps: 'Provide a detailed implementation plan',
                contextual_reminder: 'Plans must include specific steps and checkboxes'
              }
            } as EnhancedResponse;
          }

          if (typeof errorMessage === 'string' && errorMessage.includes('Missing checkboxes')) {
            return {
              success: false,
              error_code: 'MISSING_CHECKBOXES',
              exit_code: 1,
              red_flags: ['Missing checkboxes'],
              guidance: {
                requirement: 'Valid checkboxes required - use "- [ ]" format',
                next_steps: 'Add proper checkbox format to plan',
                contextual_reminder: 'Plans must include trackable progress markers'
              }
            } as EnhancedResponse;
          }
        }

        // Check for invalid plans (too short) on successful submissions
        if ('content' in context.toolResponse &&
            typeof context.toolResponse.content === 'string' &&
            context.toolResponse.content.length < 50) {
          return {
            success: false,
            error_code: 'INVALID_PLAN',
            exit_code: 1,
            red_flags: ['Plan too short'],
            guidance: {
              error_handling: 'INVALID_PLAN - Plan must be detailed and comprehensive',
              next_steps: 'Provide a detailed implementation plan',
              contextual_reminder: 'Plans must include specific steps and checkboxes'
            }
          } as EnhancedResponse;
        }

        // Check for missing checkboxes on successful submissions
        if ('content' in context.toolResponse &&
            typeof context.toolResponse.content === 'string' &&
            !context.toolResponse.content.includes('- [ ]')) {
          return {
            success: false,
            error_code: 'MISSING_CHECKBOXES',
            exit_code: 1,
            red_flags: ['Missing checkboxes'],
            guidance: {
              requirement: 'Valid checkboxes required - use "- [ ]" format',
              next_steps: 'Add proper checkbox format to plan',
              contextual_reminder: 'Plans must include trackable progress markers'
            }
          } as EnhancedResponse;
        }
      }

      // Detect Task tool deception for create_task
      if (context.toolName === 'create_task' &&
          context.toolResponse &&
          typeof context.toolResponse === 'object' &&
          'response' in context.toolResponse &&
          typeof context.toolResponse.response === 'string' &&
          context.toolResponse.response.includes('completed successfully')) {
        // Add warning fields to the response but don't block it
        const baseResponse = { ...context.toolResponse };
        return {
          ...baseResponse,
          trust_warning: '⚠️ Task tool "completion" means NOTHING. Always verify.',
          verification_required: true,
          guidance: {
            next_steps: 'Verify actual completion with evidence',
            contextual_reminder: 'Task tool responses are meaningless without verification',
            verification_protocol: {
              required: true,
              trust_level: 'NEVER_TRUST_WITHOUT_EVIDENCE',
              commands: ['Verify actual completion with evidence']
            }
          }
        } as EnhancedResponse;
      }

      // Get compliance level if tracker is available
      let complianceLevel: number | undefined;
      if (context.complianceTracker) {
        complianceLevel = await context.complianceTracker.getComplianceLevel(context.agent);
      }

      // Check for incomplete delegations if tracker is available
      if (context.delegationTracker) {
        // Note: Checking but not using here, actual usage is below
        await context.delegationTracker.checkIncompleteDelegations(context.agent);
        
        // Track new task if this is a create_task call
        if (context.toolName === 'create_task' &&
            context.toolResponse &&
            typeof context.toolResponse === 'object' &&
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

      // Add context usage alerts if provided
      if (context.contextUsage && guidance) {
        const contextAlert = this.checkContextUsage(context.contextUsage);
        if (contextAlert) {
          const alertMessage = `\n\n⚠️ CONTEXT ALERT: ${contextAlert.recommendation}`;
          guidance.contextual_reminder = guidance.contextual_reminder
            ? `${guidance.contextual_reminder}${alertMessage}`
            : alertMessage;

          // Add alert to guidance for visibility
          if (!guidance.context_alert) {
            guidance.context_alert = contextAlert;
          }
        }
      }

      // Return enhanced response
      return {
        ...(context.toolResponse as Record<string, unknown>),
        guidance
      } as EnhancedResponse;
    } catch (error) {
      // Log error if ErrorLogger is available
      if (this.errorLogger) {
        const errorEntry = {
          timestamp: new Date(),
          source: 'mcp_server' as const,
          operation: `enhance_${context.toolName}`,
          agent: context.agent,
          error: {
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : 'UnknownError',
            stack: error instanceof Error ? error.stack : undefined
          },
          context: {
            tool: context.toolName
          },
          severity: 'medium' as const,
          metadata: {
            enhancementPhase: 'response_enhancement',
            toolResponse: context.toolResponse
          }
        };

        // Fire and forget - don't await to avoid blocking
        this.errorLogger.logError(errorEntry).catch(() => {
          // Silently ignore logging errors to prevent cascading failures
        });
      }

      // On error, return original response without enhancement
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
      // Context-Based Tools
      case 'get_task_context':
        return 'Review context and submit your implementation plan';

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

      case 'archive_completed_tasks':
        return 'Check for new task assignments';

      // Traditional Task Tools
      case 'create_task': {
        if (toolResponse &&
            typeof toolResponse === 'object' &&
            'targetAgent' in toolResponse) {
          return 'Complete delegation by invoking the Task tool';
        }
        return 'Submit your implementation plan with checkboxes';
      }

      case 'check_tasks':
        return 'Select a task to work on or create new delegations';

      case 'read_task':
        return 'Process task content and proceed with workflow';

      case 'write_task':
        return 'Continue with task implementation';

      case 'list_agents':
        return 'Review agent workloads and delegate appropriately';

      case 'archive_tasks':
        return 'Tasks archived - continue with active work';

      case 'restore_tasks':
        return 'Review restored tasks and resume work';

      // Diagnostic Tools
      case 'get_full_lifecycle':
        return 'Analyze lifecycle patterns for improvements';

      case 'track_task_progress':
        return 'Monitor progress and adjust strategy if needed';

      // Utility Tools
      case 'sync_todo_checkboxes':
        return 'Continue with task implementation';

      case 'get_server_info':
        return 'Server information retrieved';

      case 'ping':
        return 'Connection verified';

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
   * Enhance create_task tool responses with universal orchestration guidance
   */
  private async enhanceCreateTask(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { toolResponse, agent } = context;

    // Generate universal orchestration guidance
    const orchestration = generateUniversalGuidance(agent);

    // Generate base guidance
    const nextSteps = this.generateNextSteps(context);

    // Get personalized guidance if available
    let contextualReminder = '✅ Task created successfully';
    if (context.complianceTracker) {
      contextualReminder = await context.complianceTracker.getPersonalizedGuidance(agent, 'create_task');
    }

    // Special handling for delegation tasks with orchestration guidance
    const guidance: EnhancedResponse['guidance'] = {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder,
      // Add orchestration guidance
      workflow: orchestration.workflow,
      orchestration: orchestration.orchestration,
      example_invocations: orchestration.example_invocations,
      critical_note: orchestration.critical_note,
      // Add critical warning about Task tool meaninglessness
      critical_warning: '⚠️ CRITICAL: Task tool response means NOTHING!\n"Completed" does NOT mean work was done\nZERO TRUST - verify EVERYTHING',
      verification_protocol: {
        required: true,
        trust_level: 'NEVER_TRUST_WITHOUT_EVIDENCE',
        commands: [
          'mcp__agent_comm__track_task_progress(agent, taskId)',
          'Check for red flags in response',
          'Run verification script',
          'Demand evidence for all claims'
        ]
      }
    };

    if (toolResponse &&
        typeof toolResponse === 'object' &&
        'targetAgent' in toolResponse &&
        typeof toolResponse.targetAgent === 'string' &&
        'taskId' in toolResponse &&
        typeof toolResponse.taskId === 'string') {
      // Add actionable command for delegation
      const taskId = toolResponse.taskId;
      const targetAgent = toolResponse.targetAgent;

      if (guidance) {
        guidance.actionable_command = `Task(subagent_type="${targetAgent}", prompt="Check MCP task: ${taskId}")`;

        // Get compliance level from the guidance which is already populated
        const complianceLevel = context.complianceTracker
          ? await context.complianceTracker.getComplianceLevel(context.agent)
          : 100;

        // Set reminder with escalating urgency levels based on compliance
        let urgencyLevel: 'gentle' | 'firm' | 'critical';
        let icon: string;
        let reminderText: string;

        if (complianceLevel >= 80) {
          // Level 1: Gentle reminder (80-100% compliance)
          urgencyLevel = 'gentle';
          icon = '✅';
          reminderText = '2-Phase Delegation: Task Created → NEXT: Start Subagent';
        } else if (complianceLevel >= 50) {
          // Level 2: Firm warning (50-80% compliance)
          urgencyLevel = 'firm';
          icon = '⚠️';
          reminderText = 'WARNING: You MUST invoke the Task tool now to complete delegation!';
        } else {
          // Level 3: Critical alert (<50% compliance)
          urgencyLevel = 'critical';
          icon = '🚨';
          reminderText = 'CRITICAL: Delegation incomplete! Execute Task tool IMMEDIATELY or work will be lost!';
        }

        guidance.contextual_reminder = `${icon} [${urgencyLevel.toUpperCase()}] ${reminderText}`;
        guidance.urgency_level = urgencyLevel;

        // Generate full delegation template
        const content = ('content' in toolResponse && typeof toolResponse.content === 'string') ?
                        toolResponse.content : 'Complete the assigned task';

        // Always provide delegation template for delegation tasks
        guidance.delegation_template = `Task(subagent_type="${targetAgent}", prompt="Check and complete MCP task ${taskId}: ${content}")`;

        // Use DelegationTracker's template if available
        if (context.delegationTracker && typeof context.delegationTracker.generateTaskToolInvocation === 'function') {
          guidance.delegation_template = context.delegationTracker.generateTaskToolInvocation(
            targetAgent,
            taskId,
            content
          );
        }
      }
    }

    return guidance;
  }

  /**
   * Enhance submit_plan tool responses
   */
  private async enhanceSubmitPlan(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent, toolResponse } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '📝 Plan submitted! Remember to use TodoWrite for tracking';

    // Add stepCount optimization guidance for successful submissions
    if (toolResponse && typeof toolResponse === 'object' && 'success' in toolResponse && toolResponse.success) {
      contextualReminder += '\n⚡ PERFORMANCE TIP: Use stepCount parameter for 90% faster validation (100ms → <10ms)';
      contextualReminder += '\n📊 Example: stepCount=5 for plans with 5 checkboxes enhances report_progress speed';
    }

    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'submit_plan');
      if (guidance) {
        contextualReminder = `${contextualReminder}\n${guidance}`;
      }
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder,
      performance_optimization: {
        stepCount_benefit: '90% faster validation when provided',
        creates_metadata: 'PLAN.metadata.json for caching',
        improves_tools: ['report_progress', 'track_task_progress']
      }
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
      if (guidance && !guidance.includes('Progress updated')) {
        // Only replace if compliance tracker doesn't mention progress
        contextualReminder = `📊 Progress updated! ${guidance}`;
      } else if (guidance) {
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
    const { toolResponse } = context;

    // Note: Red flag detection is handled in the main enhance() method
    // This method now only provides normal guidance for successful completions

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '✅ Task completed successfully!';
    let actionableCommand: string | undefined;

    if (toolResponse &&
        typeof toolResponse === 'object' &&
        'status' in toolResponse &&
        toolResponse.status === 'ERROR') {
      contextualReminder = '❌ Task marked with error status';
    }

    // Check accountability if tracker is available (fallback for non-blocking checks)
    if (context.accountabilityTracker &&
        toolResponse &&
        typeof toolResponse === 'object' &&
        'taskId' in toolResponse &&
        typeof toolResponse.taskId === 'string') {
      const taskId = toolResponse.taskId;
      const canComplete = context.accountabilityTracker.canAcceptCompletion(taskId);

      if (!canComplete) {
        const score = context.accountabilityTracker.getCompletionScore(taskId);
        contextualReminder = `⚠️ VERIFICATION REQUIRED: Completion score ${score}% (need 70%)`;

        // Generate verification commands
        const verificationGuidance = context.accountabilityTracker.generateVerificationGuidance(taskId);
        contextualReminder = `${contextualReminder}\n${verificationGuidance}`;

        // Provide actionable verification command
        actionableCommand = `# Run these verification commands before marking complete:
./tmp/issue-49/verify-all.sh
grep -n "Task(subagent_type.*Task(subagent_type" src/core/ResponseEnhancer.ts
npm test tests/unit/core/response-enhancer-all-tools.test.ts`;
      }
    }

    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(context.agent, 'mark_complete');
      if (guidance) {
        contextualReminder = `${contextualReminder} ${guidance}`;
      }
    }

    const result: EnhancedResponse['guidance'] = {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };

    if (actionableCommand) {
      result.actionable_command = actionableCommand;
    }

    return result;
  }

  // Context-Based Tool Enhancers

  /**
   * Enhance get_task_context tool responses
   */
  private async enhanceGetTaskContext(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '📋 Task context retrieved - review and plan your approach';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'get_task_context');
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
   * Enhance archive_completed_tasks tool responses
   */
  private async enhanceArchiveCompletedTasks(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '🗂️ Completed tasks archived - workspace clean';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'archive_completed_tasks');
      if (guidance) {
        contextualReminder = guidance;
      }
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };
  }

  // Traditional Task Tool Enhancers

  /**
   * Enhance check_tasks tool responses
   */
  private async enhanceCheckTasks(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent, toolResponse } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '📋 Tasks retrieved - review and prioritize';
    let actionableCommand: string | undefined;

    // Check for multiple new tasks (parallel opportunity)
    if (toolResponse &&
        typeof toolResponse === 'object' &&
        'newCount' in toolResponse &&
        typeof toolResponse.newCount === 'number' &&
        toolResponse.newCount > 1) {
      contextualReminder = '🚀 PARALLEL EXECUTION OPPORTUNITY: Multiple independent tasks detected!';

      // Generate specific parallel execution commands
      if ('tasks' in toolResponse && Array.isArray(toolResponse.tasks)) {
        const tasks = toolResponse.tasks.slice(0, 3); // Take up to 3 tasks for parallel example
        const parallelCommands: string[] = [];

        for (const task of tasks) {
          if (typeof task === 'object' && task !== null &&
              'id' in task && 'targetAgent' in task) {
            const typedTask = task as { id: unknown; targetAgent: unknown };
            if (typeof typedTask.id === 'string' && typeof typedTask.targetAgent === 'string') {
              parallelCommands.push(
                `Task(subagent_type="${typedTask.targetAgent}", prompt="Handle task: ${typedTask.id}")`
              );
            }
          }
        }

        if (parallelCommands.length > 1) {
          actionableCommand = `# Execute these agents in parallel for maximum efficiency:\n${parallelCommands.join('\n')}`;
        }
      } else {
        // Generate example parallel commands when task details aren't available
        actionableCommand = `# Execute these agents in parallel for maximum efficiency:
Task(subagent_type="senior-frontend-engineer", prompt="Check for frontend tasks")
Task(subagent_type="senior-backend-engineer", prompt="Check for backend tasks")
Task(subagent_type="senior-dba-advisor", prompt="Check for database tasks")`;
      }
    }

    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'check_tasks');
      if (guidance) {
        contextualReminder = `${contextualReminder}\n${guidance}`;
      }
    }

    const result: EnhancedResponse['guidance'] = {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };

    if (actionableCommand) {
      result.actionable_command = actionableCommand;
    }

    return result;
  }

  /**
   * Enhance read_task tool responses
   */
  private async enhanceReadTask(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '📖 Task content retrieved - analyze requirements';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'read_task');
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
   * Enhance write_task tool responses
   */
  private async enhanceWriteTask(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '✍️ Task content written successfully';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'write_task');
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
   * Enhance list_agents tool responses
   */
  private async enhanceListAgents(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent, toolResponse } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '👥 Agent workloads retrieved - delegate wisely';
    let actionableCommand: string | undefined;

    // Check for multiple available agents (parallel delegation opportunity)
    if (toolResponse &&
        typeof toolResponse === 'object' &&
        'agents' in toolResponse &&
        Array.isArray(toolResponse.agents)) {
      const availableAgents = toolResponse.agents.filter((a: unknown) =>
        typeof a === 'object' && a !== null &&
        'pendingTasks' in a && typeof (a as Record<string, unknown>)['pendingTasks'] === 'number' &&
        (a as Record<string, unknown>)['pendingTasks'] === 0
      );

      if (availableAgents.length >= 3) {
        contextualReminder = '🚀 PARALLEL DELEGATION OPPORTUNITY: Multiple agents available for concurrent work!';

        // Generate parallel delegation commands for common scenarios
        actionableCommand = `# Delegate tasks in parallel to available agents:
Task(subagent_type="senior-frontend-engineer", prompt="Implement UI components for feature X")
Task(subagent_type="senior-backend-engineer", prompt="Create API endpoints for feature X")
Task(subagent_type="senior-dba-advisor", prompt="Design database schema for feature X")
Task(subagent_type="qa-test-automation-engineer", prompt="Create test suite for feature X")`;
      } else if (availableAgents.length >= 2) {
        contextualReminder = '💡 TIP: Multiple agents available - consider parallel delegation';

        // Generate example for 2 agents
        actionableCommand = `# Delegate tasks in parallel to optimize throughput:
Task(subagent_type="senior-frontend-engineer", prompt="Handle UI tasks")
Task(subagent_type="senior-backend-engineer", prompt="Handle API tasks")`;
      }
    }

    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'list_agents');
      if (guidance) {
        contextualReminder = `${contextualReminder}\n${guidance}`;
      }
    }

    const result: EnhancedResponse['guidance'] = {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };

    if (actionableCommand) {
      result.actionable_command = actionableCommand;
    }

    return result;
  }

  /**
   * Enhance archive_tasks tool responses
   */
  private async enhanceArchiveTasks(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '🗄️ Tasks archived successfully';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'archive_tasks');
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
   * Enhance restore_tasks tool responses
   */
  private async enhanceRestoreTasks(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '🔄 Tasks restored - review and continue';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'restore_tasks');
      if (guidance) {
        contextualReminder = guidance;
      }
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };
  }

  // Diagnostic Tool Enhancers

  /**
   * Enhance get_full_lifecycle tool responses
   */
  private async enhanceGetFullLifecycle(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '🔍 Task lifecycle analyzed - insights available';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'get_full_lifecycle');
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
   * Enhance track_task_progress tool responses
   */
  private async enhanceTrackTaskProgress(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '📈 Progress tracking active - monitor and adjust';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'track_task_progress');
      if (guidance) {
        contextualReminder = guidance;
      }
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };
  }

  // Utility Tool Enhancers

  /**
   * Enhance sync_todo_checkboxes tool responses
   */
  private async enhanceSyncTodoCheckboxes(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '✅ TodoWrite synchronized with task checkboxes';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'sync_todo_checkboxes');
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
   * Enhance get_server_info tool responses
   */
  private async enhanceGetServerInfo(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = 'ℹ️ Server information retrieved';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'get_server_info');
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
   * Enhance ping tool responses
   */
  private async enhancePing(context: EnhancementContext): Promise<EnhancedResponse['guidance']> {
    const { agent } = context;

    const nextSteps = this.generateNextSteps(context);

    let contextualReminder = '🟢 Connection healthy';
    if (context.complianceTracker) {
      const guidance = await context.complianceTracker.getPersonalizedGuidance(agent, 'ping');
      if (guidance) {
        contextualReminder = guidance;
      }
    }

    return {
      next_steps: nextSteps,
      contextual_reminder: contextualReminder
    };
  }
}