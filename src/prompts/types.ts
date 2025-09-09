/**
 * Type definitions for the MCP Prompts System
 * Compliant with MCP 2025-06-18 specification
 */

/**
 * Prompt argument definition
 */
export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

/**
 * Prompt metadata for listing
 */
export interface PromptMetadata {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

/**
 * Response for prompts/list
 */
export interface PromptListResponse {
  prompts: PromptMetadata[];
}

/**
 * Text content for prompt messages
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Resource content for embedded resources
 */
export interface ResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
  };
}

/**
 * Image content for visual resources
 */
export interface ImageContent {
  type: 'image';
  data: string; // base64
  mimeType: string;
}

/**
 * Union type for all content types
 */
export type MessageContent = TextContent | ResourceContent | ImageContent;

/**
 * Prompt message with role and content
 */
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: MessageContent;
}

/**
 * Prompt content with messages
 */
export interface PromptContent {
  messages: PromptMessage[];
}

/**
 * Response for prompts/get 
 */
export interface PromptGetResponse {
  description?: string;
  messages: PromptMessage[];
}

/**
 * Available prompt names
 */
export type PromptName = 
  | 'task-workflow-guide'
  | 'agent-validation-requirements'
  | 'flexible-task-operations'
  | 'troubleshooting-common-errors'
  | 'protocol-compliance-checklist';

/**
 * Prompt arguments by name
 */
export interface PromptArguments {
  'task-workflow-guide': {
    agent?: string;
    taskId?: string;
  };
  'agent-validation-requirements': {
    agent: string;
  };
  'flexible-task-operations': {
    agent?: string;
  };
  'troubleshooting-common-errors': {
    errorType?: string;
    agent?: string;
  };
  'protocol-compliance-checklist': {
    agent?: string;
  };
}

/**
 * Prompt definition with metadata and content generator
 */
export interface PromptDefinition {
  name: PromptName;
  description: string;
  arguments: PromptArgument[];
  generateContent: (args: any) => Promise<PromptContent>;
}

/**
 * Task context for dynamic content generation
 */
export interface TaskContext {
  agent: string;
  tasks: Array<{
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    hasInit: boolean;
    hasPlan: boolean;
    hasDone: boolean;
    hasError: boolean;
    progress?: Array<{
      step: string;
      status: 'complete' | 'pending' | 'in-progress';
    }>;
  }>;
  currentTask?: {
    id: string;
    content: string;
    planContent?: string;
    errorContent?: string;
  };
}

/**
 * Error types for troubleshooting
 */
export type ErrorType = 
  | 'default-agent'
  | 'ownership-validation'
  | 'task-not-found'
  | 'permission-denied'
  | 'invalid-arguments'
  | 'file-not-found';

/**
 * Compliance status for protocol checking
 */
export interface ComplianceStatus {
  agent: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  errorTasks: number;
  complianceScore: number; // 0-100
  issues: string[];
  recommendations: string[];
}