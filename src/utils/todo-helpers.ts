/**
 * Helper functions for Todo management in MCP tasks
 */

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

/**
 * Create standard todo list from task requirements
 */
export function createTaskTodos(requirements: string[]): TodoItem[] {
  const todos: TodoItem[] = [
    { content: "Parse and understand requirements", status: "pending", activeForm: "Parsing requirements" },
    { content: "Create implementation plan", status: "pending", activeForm: "Creating plan" },
    { content: "Submit plan via submit_plan()", status: "pending", activeForm: "Submitting plan" }
  ];
  
  // Add todos for each requirement
  requirements.forEach((req, index) => {
    todos.push({
      content: `Implement: ${req}`,
      status: "pending",
      activeForm: `Implementing requirement ${index + 1}`
    });
  });
  
  // Add completion todos
  todos.push(
    { content: "Test implementation", status: "pending", activeForm: "Testing" },
    { content: "Report final progress", status: "pending", activeForm: "Reporting progress" },
    { content: "Mark task complete", status: "pending", activeForm: "Marking complete" }
  );
  
  return todos;
}

/**
 * Create MCP operation todos
 */
export function createMcpTodos(): TodoItem[] {
  return [
    { content: "Call submit_plan() with implementation plan", status: "pending", activeForm: "Submitting plan" },
    { content: "Call report_progress() after each major step", status: "pending", activeForm: "Reporting progress" },
    { content: "Call mark_complete() when done", status: "pending", activeForm: "Marking complete" }
  ];
}

/**
 * Create context-based workflow todos
 */
export function createContextTodos(): TodoItem[] {
  return [
    { content: "Get task context using get_task_context()", status: "pending", activeForm: "Getting task context" },
    { content: "Parse context and requirements", status: "pending", activeForm: "Parsing context" },
    { content: "Create comprehensive implementation plan", status: "pending", activeForm: "Creating plan" },
    { content: "Submit plan using submit_plan()", status: "pending", activeForm: "Submitting plan" },
    { content: "Execute plan step by step", status: "pending", activeForm: "Executing plan" },
    { content: "Report progress using report_progress()", status: "pending", activeForm: "Reporting progress" },
    { content: "Complete task using mark_complete()", status: "pending", activeForm: "Completing task" }
  ];
}

/**
 * Update todo status safely
 */
export function updateTodoStatus(
  todos: TodoItem[], 
  index: number, 
  newStatus: 'pending' | 'in_progress' | 'completed'
): TodoItem[] {
  if (index < 0 || index >= todos.length) {
    throw new Error(`Invalid todo index: ${index}`);
  }

  const updatedTodos = [...todos];
  updatedTodos[index] = { ...updatedTodos[index], status: newStatus };
  
  return updatedTodos;
}

/**
 * Mark next pending todo as in_progress
 */
export function progressToNext(todos: TodoItem[]): TodoItem[] {
  // First, mark any in_progress items as completed (assumption: they're done)
  const updatedTodos = todos.map(todo => 
    todo.status === 'in_progress' 
      ? { ...todo, status: 'completed' as const }
      : todo
  );

  // Find first pending todo and mark as in_progress
  const nextPendingIndex = updatedTodos.findIndex(todo => todo.status === 'pending');
  if (nextPendingIndex >= 0) {
    updatedTodos[nextPendingIndex] = { 
      ...updatedTodos[nextPendingIndex], 
      status: 'in_progress' 
    };
  }

  return updatedTodos;
}

/**
 * Validate all todos are complete
 */
export function validateTodosComplete(todos: TodoItem[]): boolean {
  return todos.every(todo => todo.status === 'completed');
}

/**
 * Get todos progress summary
 */
export function getTodosProgress(todos: TodoItem[]): {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
  percentComplete: number;
} {
  const completed = todos.filter(t => t.status === 'completed').length;
  const inProgress = todos.filter(t => t.status === 'in_progress').length;
  const pending = todos.filter(t => t.status === 'pending').length;
  const total = todos.length;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completed,
    inProgress,
    pending,
    total,
    percentComplete
  };
}

/**
 * Create enhanced todos with MCP operations embedded
 */
export function createEnhancedTaskTodos(
  requirements: string[], 
  includeMcpOps: boolean = true
): TodoItem[] {
  const todos: TodoItem[] = [
    { content: "Parse task context and requirements", status: "pending", activeForm: "Parsing task context" },
    { content: "Create comprehensive implementation plan", status: "pending", activeForm: "Creating implementation plan" }
  ];

  if (includeMcpOps) {
    todos.push({ 
      content: "Submit plan using submit_plan() MCP operation", 
      status: "pending", 
      activeForm: "Submitting plan via MCP" 
    });
  }

  // Add requirement-specific todos
  requirements.forEach((req, index) => {
    todos.push({
      content: `Implement requirement: ${req}`,
      status: "pending",
      activeForm: `Working on requirement ${index + 1}`
    });
  });

  // Add testing and validation
  todos.push(
    { content: "Test implementation thoroughly", status: "pending", activeForm: "Testing implementation" },
    { content: "Validate all requirements met", status: "pending", activeForm: "Validating requirements" }
  );

  if (includeMcpOps) {
    todos.push(
      { 
        content: "Report progress using report_progress() MCP operation", 
        status: "pending", 
        activeForm: "Reporting progress via MCP" 
      },
      { 
        content: "Mark task complete using mark_complete() MCP operation", 
        status: "pending", 
        activeForm: "Completing task via MCP" 
      }
    );
  }

  return todos;
}

/**
 * Validate todo structure
 */
export function validateTodoStructure(todos: TodoItem[]): { 
  isValid: boolean; 
  errors: string[]; 
} {
  const errors: string[] = [];

  if (!Array.isArray(todos)) {
    errors.push("Todos must be an array");
    return { isValid: false, errors };
  }

  if (todos.length === 0) {
    errors.push("Todo list cannot be empty");
  }

  todos.forEach((todo, index) => {
    if (!todo.content || typeof todo.content !== 'string') {
      errors.push(`Todo ${index}: content must be a non-empty string`);
    }

    if (!todo.activeForm || typeof todo.activeForm !== 'string') {
      errors.push(`Todo ${index}: activeForm must be a non-empty string`);
    }

    if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
      errors.push(`Todo ${index}: status must be pending, in_progress, or completed`);
    }
  });

  const inProgressCount = todos.filter(t => t.status === 'in_progress').length;
  if (inProgressCount > 1) {
    errors.push("Only one todo can be 'in_progress' at a time");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}