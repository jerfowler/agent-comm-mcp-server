/**
 * Enhanced context management types for agent context reporting
 * Issue #51: Enhanced Agent Context Reporting and Proactive Task Management
 *
 * IMPORTANT: These are NEW interfaces that EXTEND existing functionality.
 * They do NOT replace any existing types and all properties are OPTIONAL
 * for backward compatibility.
 */

/**
 * Context usage tracking data for monitoring token consumption
 */
export interface ContextUsageData {
  /** Current number of tokens used */
  currentTokens: number;

  /** Maximum tokens available */
  maxTokens: number;

  /** Percentage of context used (0-100) */
  percentageUsed: number;

  /** Estimated tokens remaining */
  estimatedRemaining: number;

  /** Trend indicator for context usage */
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

/**
 * Agent identity information for enhanced reporting
 */
export interface AgentIdentity {
  /** Agent name/identifier */
  agentName: string;

  /** Agent specialization/role */
  specialization: string;

  /** Core goals and objectives */
  coreGoals: string[];

  /** Current directives being followed */
  currentDirectives: string[];
}

/**
 * Agent capabilities and constraints
 */
export interface AgentCapabilities {
  /** Available tools and resources */
  availableTools: string[];

  /** Known resource constraints */
  resourceConstraints: string[];

  /** Tool effectiveness metrics */
  toolEffectiveness?: Record<string, number>;
}

/**
 * Agent working context and priorities
 */
export interface AgentWorkingContext {
  /** Previous tasks completed */
  previousTasks: string[];

  /** Current priorities */
  currentPriorities: string[];

  /** Discovered limitations */
  discoveredLimitations?: string[];

  /** Adaptations made */
  adaptations?: string[];
}

/**
 * Complete agent context data for enhanced reporting
 */
export interface AgentContextData {
  /** Agent identity information */
  identity: AgentIdentity;

  /** Current capabilities */
  currentCapabilities: AgentCapabilities;

  /** Working context */
  workingContext: AgentWorkingContext;
}

/**
 * Context estimate for task planning
 */
export interface ContextEstimate {
  /** Estimated tokens required for task */
  estimatedTokensRequired: number;

  /** Confidence level in estimate (0-1) */
  confidenceLevel: number;

  /** Critical sections that require most context */
  criticalSections: string[];
}

/**
 * Enhanced plan submission with context awareness
 */
export interface EnhancedPlanSubmission {
  /** Standard plan content */
  content: string;

  /** Agent name */
  agent: string;

  /** Optional: Agent context data */
  agentContext?: AgentContextData;

  /** Optional: Context estimate for plan */
  contextEstimate?: ContextEstimate;
}

/**
 * Capability changes discovered during execution
 */
export interface CapabilityChanges {
  /** Discovered limitations */
  discoveredLimitations?: string[];

  /** Tool effectiveness updates */
  toolEffectiveness?: Record<string, number>;

  /** Adaptations made */
  adaptations?: string[];
}

/**
 * Context status for progress reporting
 */
export interface ContextStatus {
  /** Current context usage */
  currentUsage: number;

  /** Usage trend */
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';

  /** Estimated remaining capacity */
  estimatedRemaining: number;
}

/**
 * Enhanced progress update with context tracking
 */
export interface EnhancedProgressUpdate {
  /** Step number being updated */
  step: number;

  /** New status for this step */
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED';

  /** Description of work done or current state */
  description: string;

  /** Optional: Time spent in minutes */
  timeSpent?: number;

  /** Optional: Estimated time remaining in minutes */
  estimatedTimeRemaining?: number;
}

/**
 * Enhanced progress report with context awareness
 */
export interface EnhancedProgressReport {
  /** Agent name */
  agent: string;

  /** Array of progress updates */
  updates: EnhancedProgressUpdate[];

  /** Context usage status */
  contextStatus: ContextStatus;

  /** Optional: Capability changes discovered */
  capabilityChanges?: CapabilityChanges;
}

/**
 * Context threshold levels for monitoring
 */
export interface ContextThresholds {
  /** Warning threshold (default: 70%) */
  warningThreshold: number;

  /** Critical threshold (default: 85%) */
  criticalThreshold: number;

  /** Emergency threshold (default: 95%) */
  emergencyThreshold: number;
}

/**
 * Alert severity levels for context warnings
 */
export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

/**
 * Context alert generated when thresholds are exceeded
 */
export interface ContextAlert {
  /** Severity level of the alert */
  severity: AlertSeverity;

  /** Current usage percentage */
  currentUsage: number;

  /** Threshold that was exceeded */
  thresholdExceeded: number;

  /** Recommended action */
  recommendation: string;

  /** Timestamp of alert */
  timestamp: string;
}

/**
 * Task splitting recommendation when context is high
 */
export interface TaskSplitRecommendation {
  /** Should the task be split */
  shouldSplit: boolean;

  /** Reason for recommendation */
  reason: string;

  /** Suggested split point */
  suggestedSplitPoint?: string;

  /** Estimated context needed for remaining work */
  estimatedRemainingContext?: number;

  /** Priority items to complete first */
  priorityItems?: string[];
}

/**
 * Context handoff data for task transitions
 */
export interface HandoffContext {
  /** Critical context to preserve */
  criticalContext: string[];

  /** Work completed so far */
  completedWork: string[];

  /** Next steps to take */
  nextSteps: string[];

  /** Key decisions made */
  keyDecisions: Record<string, string>;

  /** Dependencies and blockers */
  dependencies: string[];

  /** Estimated context for continuation */
  estimatedContinuationContext: number;
}

/**
 * Context transfer validation result
 */
export interface ContextTransferValidation {
  /** Is the transfer valid */
  isValid: boolean;

  /** Validation errors if any */
  errors?: string[];

  /** Warnings about potential issues */
  warnings?: string[];

  /** Completeness score (0-100) */
  completenessScore: number;
}

/**
 * Context evolution tracking over time
 */
export interface ContextEvolution {
  /** Initial context state */
  initialState: ContextUsageData;

  /** Current context state */
  currentState: ContextUsageData;

  /** Key milestones in context usage */
  milestones: {
    timestamp: string;
    usage: number;
    event: string;
  }[];

  /** Efficiency metrics */
  efficiency: {
    tokensPerTask: number;
    averageUsageRate: number;
    peakUsage: number;
  };
}