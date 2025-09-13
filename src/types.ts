/**
 * Core types and interfaces for the Agent Communication MCP Server
 */

export interface TaskMetadata {
  agent: string;
  created: string;
  source: string;
  parentTask?: string;
}

export interface TaskFile {
  type: 'INIT' | 'PLAN' | 'DONE' | 'ERROR';
  content: string;
  metadata?: TaskMetadata;
}

export interface Task {
  name: string;
  agent: string;
  path: string;
  isNew?: boolean;
  hasInit: boolean;
  hasPlan: boolean;
  hasDone: boolean;
  hasError: boolean;
  created?: Date;
  updated?: Date;
}

export interface Agent {
  name: string;
  taskCount: number;
  completedCount: number;
  pendingCount: number;
  errorCount: number;
}

export interface PlanStep {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED';
  description: string;
  index: number;
}

export interface ArchiveOptions {
  mode: 'completed' | 'all' | 'by-agent' | 'by-date';
  agent?: string;
  olderThan?: number; // days
  dryRun?: boolean;
}

export interface ArchiveResult {
  archived: {
    completed: number;
    pending: number;
    total: number;
    agents?: string[];
  } | null;
  timestamp: string;
  archivePath?: string;
}

export interface RestoreOptions {
  timestamp?: string;
  agent?: string;
  taskName?: string;
}

export interface RestoreResult {
  restored: {
    completed: number;
    pending: number;
    total: number;
  };
  timestamp: string;
}

export interface BaseServerConfig {
  commDir: string;
  archiveDir: string;
  logDir: string;
  autoArchiveDays?: number;
  maxTaskAge?: number; // days
  enableArchiving: boolean;
}

export interface ServerConfig extends BaseServerConfig {
  // Core Components - injected at runtime
  connectionManager: import('./core/ConnectionManager.js').ConnectionManager;
  eventLogger: import('./logging/EventLogger.js').EventLogger;
  
  // Smart Response System Components (Issue #12)
  responseEnhancer?: import('./core/ResponseEnhancer.js').ResponseEnhancer;
  complianceTracker?: import('./core/ComplianceTracker.js').ComplianceTracker;
  delegationTracker?: import('./core/DelegationTracker.js').DelegationTracker;
  promptManager?: import('./prompts/PromptManager.js').PromptManager;
  smartResponseConfig?: SmartResponseConfig;
}

export interface ToolResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  path?: string;
}

export interface CheckTasksResponse {
  tasks: Task[];
  totalCount: number;
  newCount: number;
  activeCount: number;
}

export interface ReadTaskResponse {
  content: string;
  metadata?: TaskMetadata;
  lastModified: Date;
}

export interface WriteTaskResponse {
  success: boolean;
  bytesWritten: number;
}

export interface InitTaskResponse {
  success: boolean;
  taskId: string;  // Changed from task_id to camelCase
}

export interface DelegateTaskResponse {
  success: boolean;
  targetAgent: string;
  taskCreated: boolean;
  message: string;
  taskId: string;  // Changed from task_id to camelCase
  tracking: {
    progress_command: string;
    lifecycle_command: string;
  };
}

export interface CreateTaskResponse {
  success: boolean;
  taskCreated: boolean;
  taskId: string;
  message: string;
  targetAgent?: string;  // For delegation tasks
  tracking: {
    progress_command: string;
    lifecycle_command: string;
  };
  guidance?: {
    next_steps: string;
    contextual_reminder: string;
    compliance_level?: number;
    actionable_command?: string;
    delegation_template?: string;
  };
}

export interface ListAgentsResponse {
  agents: Agent[];
  totalAgents: number;
  totalTasks: number;
}

// Error types
export class AgentCommError extends Error {
  constructor(message: string, public code: string, public details?: unknown) {
    super(message);
    this.name = 'AgentCommError';
  }
}

export class FileNotFoundError extends AgentCommError {
  constructor(path: string) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND', { path });
  }
}

export class InvalidTaskError extends AgentCommError {
  constructor(message: string, task?: string) {
    super(message, 'INVALID_TASK', { task });
  }
}

export class ArchiveError extends AgentCommError {
  constructor(message: string, operation: string) {
    super(message, 'ARCHIVE_ERROR', { operation });
  }
}

export class AgentOwnershipError extends AgentCommError {
  constructor(
    message: string, 
    public attemptingAgent: string, 
    public taskId: string,
    public actualOwner?: string
  ) {
    const details = {
      attemptingAgent,
      taskId,
      actualOwner,
      securityFlag: 'ownership_violation'
    };
    super(message, 'AGENT_OWNERSHIP_ERROR', details);
    this.name = 'AgentOwnershipError';
  }
}

// ========================
// Diagnostic Tools Types (v0.4.0)
// ========================


export interface GetFullLifecycleArgs {
  agent: string;
  taskId: string;  // Changed to camelCase for consistency
  include_progress?: boolean; // Default: true
}

export interface ProgressMarkers {
  completed: string[];
  in_progress?: string;
  pending: string[];
}

export interface GetFullLifecycleResult {
  taskId: string;  // Changed to camelCase for consistency
  agent: string;
  lifecycle: {
    init: { exists: boolean; content?: string; created_at?: string; };
    plan: { exists: boolean; content?: string; progress_markers?: ProgressMarkers; last_updated?: string; };
    outcome: { type: 'done' | 'error' | 'pending'; content?: string; completed_at?: string; };
  };
  summary: {
    duration_seconds?: number;
    progress_percentage?: number;
    final_status: string;
  };
}

export interface TrackTaskProgressArgs {
  agent: string;
  taskId: string;  // Changed to camelCase for consistency
}

export interface TrackTaskProgressResult {
  taskId: string;  // Changed to camelCase for consistency
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: { 
    total_steps: number; 
    completed_steps: number; 
    percentage: number; 
    current_step?: string;
  };
  last_updated: string;
}

// ========================
// Multi-Task Workflow Types (Issue #25)
// ========================

export interface TaskState {
  taskId: string;
  status: 'new' | 'in_progress' | 'completed' | 'error';
  title?: string;
  lastModified: Date;
  progress?: {
    completed: number;
    inProgress: number;
    pending: number;
  };
}

export interface MultiTaskState {
  agent: string;
  tasks: TaskState[];
  activeTasks: TaskState[]; // Tasks with plans but not completed
  currentTask: string | null;
  taskCount: {
    total: number;
    new: number;
    inProgress: number;
    completed: number;
    error: number;
  };
}

// ========================
// Smart Response System Types (Issue #12)
// ========================

export interface EnhancementContext {
  toolName: string;
  agent: string;
  toolResponse: unknown;
  promptManager?: import('./prompts/PromptManager.js').PromptManager;
  complianceTracker?: import('./core/ComplianceTracker.js').ComplianceTracker;
  delegationTracker?: import('./core/DelegationTracker.js').DelegationTracker;
  accountabilityTracker?: import('./core/AccountabilityTracker.js').AccountabilityTracker;
}

export interface EnhancedResponse {
  [key: string]: unknown; // Original response fields
  guidance?: {
    next_steps: string;
    contextual_reminder: string;
    compliance_level?: number;
    actionable_command?: string;
    delegation_template?: string;
    urgency_level?: 'gentle' | 'firm' | 'critical';
  };
}

export interface ToolEnhancer {
  enhance(context: EnhancementContext): Promise<EnhancedResponse['guidance']>;
}

export interface AgentComplianceRecord {
  agent: string;
  tasksCreated: number;
  delegationsCompleted: number;
  todoWriteUsage: number;
  planSubmissions: number;
  progressReports: number;
  completions: number;
  lastActivity: Date;
  complianceScore: number; // 0-100
  escalationLevel: number; // 1-4
}

export interface ComplianceActivity {
  type: 'task_created' | 'delegation_completed' | 'todowrite_used' | 
        'plan_submitted' | 'progress_reported' | 'task_completed';
  taskId: string;
  taskType?: string;
  timestamp: Date;
}

export interface DelegationRecord {
  taskId: string;
  targetAgent: string;
  createdAt: Date;
  taskToolInvoked: boolean;
  subagentStarted: boolean;
  completionStatus: 'pending' | 'complete' | 'abandoned';
}

export interface DelegationStats {
  totalDelegations: number;
  completedDelegations: number;
  pendingDelegations: number;
  abandonedDelegations: number;
  completionRate: number;
  averageCompletionTime?: number;
}

export interface SmartResponseConfig {
  enabled: boolean;
  enhancementLevel: 'none' | 'basic' | 'full';
  complianceTracking: boolean;
  delegationTracking: boolean;
}

// ========================
// End of Types - Unused orchestration interfaces removed
// ========================