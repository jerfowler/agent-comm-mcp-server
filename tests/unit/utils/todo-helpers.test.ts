/**
 * Unit tests for todo-helpers utility
 * Tests for Todo management in MCP tasks
 */

import { describe, it, expect } from '@jest/globals';
import {
  TodoItem,
  createTaskTodos,
  createMcpTodos,
  createContextTodos,
  updateTodoStatus,
  progressToNext,
  validateTodosComplete,
  getTodosProgress,
  createEnhancedTaskTodos,
  validateTodoStructure
} from '../../../src/utils/todo-helpers.js';

describe('Todo Helpers', () => {
  describe('createTaskTodos', () => {
    it('should create basic task todos with empty requirements', () => {
      const requirements: string[] = [];
      const todos = createTaskTodos(requirements);

      expect(todos).toHaveLength(6); // 3 base + 0 requirements + 3 completion
      
      expect(todos[0]).toEqual({
        content: "Parse and understand requirements",
        status: "pending",
        activeForm: "Parsing requirements"
      });

      expect(todos[1]).toEqual({
        content: "Create implementation plan",
        status: "pending",
        activeForm: "Creating plan"
      });

      expect(todos[2]).toEqual({
        content: "Submit plan via submit_plan()",
        status: "pending",
        activeForm: "Submitting plan"
      });

      expect(todos[3]).toEqual({
        content: "Test implementation",
        status: "pending",
        activeForm: "Testing"
      });

      expect(todos[4]).toEqual({
        content: "Report final progress",
        status: "pending",
        activeForm: "Reporting progress"
      });

      expect(todos[5]).toEqual({
        content: "Mark task complete",
        status: "pending",
        activeForm: "Marking complete"
      });
    });

    it('should create task todos with single requirement', () => {
      const requirements = ["Implement user authentication"];
      const todos = createTaskTodos(requirements);

      expect(todos).toHaveLength(7); // 3 base + 1 requirement + 3 completion
      
      expect(todos[3]).toEqual({
        content: "Implement: Implement user authentication",
        status: "pending",
        activeForm: "Implementing requirement 1"
      });
    });

    it('should create task todos with multiple requirements', () => {
      const requirements = [
        "Set up database schema",
        "Create API endpoints",
        "Add input validation",
        "Write unit tests"
      ];
      const todos = createTaskTodos(requirements);

      expect(todos).toHaveLength(10); // 3 base + 4 requirements + 3 completion
      
      expect(todos[3]).toEqual({
        content: "Implement: Set up database schema",
        status: "pending",
        activeForm: "Implementing requirement 1"
      });

      expect(todos[4]).toEqual({
        content: "Implement: Create API endpoints",
        status: "pending",
        activeForm: "Implementing requirement 2"
      });

      expect(todos[5]).toEqual({
        content: "Implement: Add input validation",
        status: "pending",
        activeForm: "Implementing requirement 3"
      });

      expect(todos[6]).toEqual({
        content: "Implement: Write unit tests",
        status: "pending",
        activeForm: "Implementing requirement 4"
      });
    });

    it('should handle empty string requirements', () => {
      const requirements = ["", "Valid requirement", ""];
      const todos = createTaskTodos(requirements);

      expect(todos).toHaveLength(9); // 3 base + 3 requirements + 3 completion
      
      expect(todos[3]).toEqual({
        content: "Implement: ",
        status: "pending",
        activeForm: "Implementing requirement 1"
      });

      expect(todos[4]).toEqual({
        content: "Implement: Valid requirement",
        status: "pending",
        activeForm: "Implementing requirement 2"
      });

      expect(todos[5]).toEqual({
        content: "Implement: ",
        status: "pending",
        activeForm: "Implementing requirement 3"
      });
    });

    it('should handle special characters in requirements', () => {
      const requirements = [
        "Handle user input with <script> tags",
        "Process data with \"quotes\" and 'apostrophes'",
        "Support file paths like C:\\Windows\\System32"
      ];
      const todos = createTaskTodos(requirements);

      expect(todos).toHaveLength(9); // 3 base + 3 requirements + 3 completion
      
      expect(todos[3].content).toBe("Implement: Handle user input with <script> tags");
      expect(todos[4].content).toBe("Implement: Process data with \"quotes\" and 'apostrophes'");
      expect(todos[5].content).toBe("Implement: Support file paths like C:\\Windows\\System32");
    });
  });

  describe('createMcpTodos', () => {
    it('should create MCP operation todos', () => {
      const todos = createMcpTodos();

      expect(todos).toHaveLength(3);
      
      expect(todos[0]).toEqual({
        content: "Call submit_plan() with implementation plan",
        status: "pending",
        activeForm: "Submitting plan"
      });

      expect(todos[1]).toEqual({
        content: "Call report_progress() after each major step",
        status: "pending",
        activeForm: "Reporting progress"
      });

      expect(todos[2]).toEqual({
        content: "Call mark_complete() when done",
        status: "pending",
        activeForm: "Marking complete"
      });
    });

    it('should always return the same structure', () => {
      const todos1 = createMcpTodos();
      const todos2 = createMcpTodos();

      expect(todos1).toEqual(todos2);
      expect(todos1).not.toBe(todos2); // Different instances
    });
  });

  describe('createContextTodos', () => {
    it('should create context-based workflow todos', () => {
      const todos = createContextTodos();

      expect(todos).toHaveLength(7);
      
      expect(todos[0]).toEqual({
        content: "Get task context using get_task_context()",
        status: "pending",
        activeForm: "Getting task context"
      });

      expect(todos[1]).toEqual({
        content: "Parse context and requirements",
        status: "pending",
        activeForm: "Parsing context"
      });

      expect(todos[2]).toEqual({
        content: "Create comprehensive implementation plan",
        status: "pending",
        activeForm: "Creating plan"
      });

      expect(todos[3]).toEqual({
        content: "Submit plan using submit_plan()",
        status: "pending",
        activeForm: "Submitting plan"
      });

      expect(todos[4]).toEqual({
        content: "Execute plan step by step",
        status: "pending",
        activeForm: "Executing plan"
      });

      expect(todos[5]).toEqual({
        content: "Report progress using report_progress()",
        status: "pending",
        activeForm: "Reporting progress"
      });

      expect(todos[6]).toEqual({
        content: "Complete task using mark_complete()",
        status: "pending",
        activeForm: "Completing task"
      });
    });

    it('should always return the same structure', () => {
      const todos1 = createContextTodos();
      const todos2 = createContextTodos();

      expect(todos1).toEqual(todos2);
      expect(todos1).not.toBe(todos2); // Different instances
    });
  });

  describe('updateTodoStatus', () => {
    let sampleTodos: TodoItem[];

    beforeEach(() => {
      sampleTodos = [
        { content: "First task", status: "pending", activeForm: "Working on first" },
        { content: "Second task", status: "pending", activeForm: "Working on second" },
        { content: "Third task", status: "pending", activeForm: "Working on third" }
      ];
    });

    it('should update todo status at valid index', () => {
      const updated = updateTodoStatus(sampleTodos, 1, 'in_progress');

      expect(updated).toHaveLength(3);
      expect(updated[0]).toEqual(sampleTodos[0]); // Unchanged
      expect(updated[1]).toEqual({
        content: "Second task",
        status: "in_progress",
        activeForm: "Working on second"
      });
      expect(updated[2]).toEqual(sampleTodos[2]); // Unchanged
      
      // Original should be unchanged
      expect(sampleTodos[1].status).toBe("pending");
    });

    it('should update first todo', () => {
      const updated = updateTodoStatus(sampleTodos, 0, 'completed');

      expect(updated[0]).toEqual({
        content: "First task",
        status: "completed",
        activeForm: "Working on first"
      });
    });

    it('should update last todo', () => {
      const updated = updateTodoStatus(sampleTodos, 2, 'completed');

      expect(updated[2]).toEqual({
        content: "Third task",
        status: "completed",
        activeForm: "Working on third"
      });
    });

    it('should throw error for negative index', () => {
      expect(() => updateTodoStatus(sampleTodos, -1, 'completed'))
        .toThrow('Invalid todo index: -1');
    });

    it('should throw error for index beyond array length', () => {
      expect(() => updateTodoStatus(sampleTodos, 3, 'completed'))
        .toThrow('Invalid todo index: 3');
    });

    it('should throw error for index equal to array length', () => {
      expect(() => updateTodoStatus(sampleTodos, sampleTodos.length, 'completed'))
        .toThrow(`Invalid todo index: ${sampleTodos.length}`);
    });

    it('should handle all valid status types', () => {
      const pending = updateTodoStatus(sampleTodos, 0, 'pending');
      const inProgress = updateTodoStatus(sampleTodos, 0, 'in_progress');
      const completed = updateTodoStatus(sampleTodos, 0, 'completed');

      expect(pending[0].status).toBe('pending');
      expect(inProgress[0].status).toBe('in_progress');
      expect(completed[0].status).toBe('completed');
    });

    it('should handle empty todos array', () => {
      const emptyTodos: TodoItem[] = [];
      
      expect(() => updateTodoStatus(emptyTodos, 0, 'completed'))
        .toThrow('Invalid todo index: 0');
    });
  });

  describe('progressToNext', () => {
    it('should mark first pending todo as in_progress when no todos are in_progress', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "pending", activeForm: "First form" },
        { content: "Second", status: "pending", activeForm: "Second form" },
        { content: "Third", status: "pending", activeForm: "Third form" }
      ];

      const result = progressToNext(todos);

      expect(result[0].status).toBe('in_progress');
      expect(result[1].status).toBe('pending');
      expect(result[2].status).toBe('pending');
    });

    it('should complete current in_progress todo and start next pending', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "in_progress", activeForm: "Second form" },
        { content: "Third", status: "pending", activeForm: "Third form" }
      ];

      const result = progressToNext(todos);

      expect(result[0].status).toBe('completed'); // Unchanged
      expect(result[1].status).toBe('completed'); // Changed from in_progress
      expect(result[2].status).toBe('in_progress'); // Changed from pending
    });

    it('should complete multiple in_progress todos and start next pending', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "in_progress", activeForm: "First form" },
        { content: "Second", status: "in_progress", activeForm: "Second form" },
        { content: "Third", status: "pending", activeForm: "Third form" },
        { content: "Fourth", status: "pending", activeForm: "Fourth form" }
      ];

      const result = progressToNext(todos);

      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('completed');
      expect(result[2].status).toBe('in_progress'); // First pending becomes in_progress
      expect(result[3].status).toBe('pending'); // Remains pending
    });

    it('should handle case with no pending todos left', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "in_progress", activeForm: "Second form" },
        { content: "Third", status: "completed", activeForm: "Third form" }
      ];

      const result = progressToNext(todos);

      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('completed'); // Was in_progress, now completed
      expect(result[2].status).toBe('completed');
    });

    it('should handle all todos already completed', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "completed", activeForm: "Second form" },
        { content: "Third", status: "completed", activeForm: "Third form" }
      ];

      const result = progressToNext(todos);

      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('completed');
      expect(result[2].status).toBe('completed');
    });

    it('should handle empty todos array', () => {
      const todos: TodoItem[] = [];
      const result = progressToNext(todos);

      expect(result).toEqual([]);
    });

    it('should not mutate original array', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "in_progress", activeForm: "First form" },
        { content: "Second", status: "pending", activeForm: "Second form" }
      ];

      const originalFirst = { ...todos[0] };
      const originalSecond = { ...todos[1] };

      const result = progressToNext(todos);

      expect(todos[0]).toEqual(originalFirst);
      expect(todos[1]).toEqual(originalSecond);
      expect(result).not.toBe(todos);
    });
  });

  describe('validateTodosComplete', () => {
    it('should return true when all todos are completed', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "completed", activeForm: "Second form" },
        { content: "Third", status: "completed", activeForm: "Third form" }
      ];

      expect(validateTodosComplete(todos)).toBe(true);
    });

    it('should return false when some todos are not completed', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "in_progress", activeForm: "Second form" },
        { content: "Third", status: "completed", activeForm: "Third form" }
      ];

      expect(validateTodosComplete(todos)).toBe(false);
    });

    it('should return false when some todos are pending', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "pending", activeForm: "Second form" }
      ];

      expect(validateTodosComplete(todos)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(validateTodosComplete([])).toBe(true);
    });

    it('should return true for single completed todo', () => {
      const todos: TodoItem[] = [
        { content: "Only", status: "completed", activeForm: "Only form" }
      ];

      expect(validateTodosComplete(todos)).toBe(true);
    });

    it('should return false for single non-completed todo', () => {
      const todos: TodoItem[] = [
        { content: "Only", status: "pending", activeForm: "Only form" }
      ];

      expect(validateTodosComplete(todos)).toBe(false);
    });
  });

  describe('getTodosProgress', () => {
    it('should calculate progress for mixed status todos', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "completed", activeForm: "Second form" },
        { content: "Third", status: "in_progress", activeForm: "Third form" },
        { content: "Fourth", status: "pending", activeForm: "Fourth form" },
        { content: "Fifth", status: "pending", activeForm: "Fifth form" }
      ];

      const progress = getTodosProgress(todos);

      expect(progress).toEqual({
        completed: 2,
        inProgress: 1,
        pending: 2,
        total: 5,
        percentComplete: 40 // 2/5 = 0.4 = 40%
      });
    });

    it('should calculate 100% for all completed todos', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "completed", activeForm: "Second form" },
        { content: "Third", status: "completed", activeForm: "Third form" }
      ];

      const progress = getTodosProgress(todos);

      expect(progress).toEqual({
        completed: 3,
        inProgress: 0,
        pending: 0,
        total: 3,
        percentComplete: 100
      });
    });

    it('should calculate 0% for all pending todos', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "pending", activeForm: "First form" },
        { content: "Second", status: "pending", activeForm: "Second form" }
      ];

      const progress = getTodosProgress(todos);

      expect(progress).toEqual({
        completed: 0,
        inProgress: 0,
        pending: 2,
        total: 2,
        percentComplete: 0
      });
    });

    it('should handle empty todos array', () => {
      const progress = getTodosProgress([]);

      expect(progress).toEqual({
        completed: 0,
        inProgress: 0,
        pending: 0,
        total: 0,
        percentComplete: 0
      });
    });

    it('should round percentage correctly', () => {
      const todos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "First form" },
        { content: "Second", status: "pending", activeForm: "Second form" },
        { content: "Third", status: "pending", activeForm: "Third form" }
      ];

      const progress = getTodosProgress(todos);

      expect(progress).toEqual({
        completed: 1,
        inProgress: 0,
        pending: 2,
        total: 3,
        percentComplete: 33 // 1/3 = 0.333... rounded to 33
      });
    });

    it('should handle single todo scenarios', () => {
      const completedTodo: TodoItem[] = [
        { content: "Only", status: "completed", activeForm: "Only form" }
      ];

      const progress = getTodosProgress(completedTodo);

      expect(progress.percentComplete).toBe(100);
      expect(progress.total).toBe(1);
      expect(progress.completed).toBe(1);
    });
  });

  describe('createEnhancedTaskTodos', () => {
    it('should create enhanced todos without MCP operations', () => {
      const requirements = ["Requirement 1", "Requirement 2"];
      const todos = createEnhancedTaskTodos(requirements, false);

      expect(todos).toHaveLength(6); // 2 base + 2 requirements + 2 completion (no MCP)
      
      expect(todos[0]).toEqual({
        content: "Parse task context and requirements",
        status: "pending",
        activeForm: "Parsing task context"
      });

      expect(todos[1]).toEqual({
        content: "Create comprehensive implementation plan",
        status: "pending",
        activeForm: "Creating implementation plan"
      });

      // No MCP submit_plan todo when includeMcpOps is false
      expect(todos[2]).toEqual({
        content: "Implement requirement: Requirement 1",
        status: "pending",
        activeForm: "Working on requirement 1"
      });

      expect(todos[3]).toEqual({
        content: "Implement requirement: Requirement 2",
        status: "pending",
        activeForm: "Working on requirement 2"
      });

      expect(todos[4]).toEqual({
        content: "Test implementation thoroughly",
        status: "pending",
        activeForm: "Testing implementation"
      });

      expect(todos[5]).toEqual({
        content: "Validate all requirements met",
        status: "pending",
        activeForm: "Validating requirements"
      });
    });

    it('should create enhanced todos with MCP operations (default)', () => {
      const requirements = ["Single requirement"];
      const todos = createEnhancedTaskTodos(requirements); // Default is true

      expect(todos).toHaveLength(8); // 2 base + 1 MCP submit + 1 requirement + 2 validation + 2 MCP completion
      
      expect(todos[2]).toEqual({
        content: "Submit plan using submit_plan() MCP operation",
        status: "pending",
        activeForm: "Submitting plan via MCP"
      });

      expect(todos[6]).toEqual({
        content: "Report progress using report_progress() MCP operation",
        status: "pending",
        activeForm: "Reporting progress via MCP"
      });

      expect(todos[7]).toEqual({
        content: "Mark task complete using mark_complete() MCP operation",
        status: "pending",
        activeForm: "Completing task via MCP"
      });
    });

    it('should create enhanced todos with MCP operations explicitly enabled', () => {
      const requirements = ["Test requirement"];
      const todos = createEnhancedTaskTodos(requirements, true);

      expect(todos).toHaveLength(8);
      
      // Check that MCP operations are included
      const mcpTodos = todos.filter(todo => todo.content.includes('MCP operation'));
      expect(mcpTodos).toHaveLength(3); // submit_plan, report_progress, mark_complete
    });

    it('should handle empty requirements with MCP operations', () => {
      const todos = createEnhancedTaskTodos([], true);

      expect(todos).toHaveLength(7); // 2 base + 1 MCP submit + 0 requirements + 2 validation + 2 MCP completion
      
      expect(todos[2]).toEqual({
        content: "Submit plan using submit_plan() MCP operation",
        status: "pending",
        activeForm: "Submitting plan via MCP"
      });
    });

    it('should handle empty requirements without MCP operations', () => {
      const todos = createEnhancedTaskTodos([], false);

      expect(todos).toHaveLength(4); // 2 base + 0 requirements + 2 validation (no MCP)
      
      expect(todos[2]).toEqual({
        content: "Test implementation thoroughly",
        status: "pending",
        activeForm: "Testing implementation"
      });

      expect(todos[3]).toEqual({
        content: "Validate all requirements met",
        status: "pending",
        activeForm: "Validating requirements"
      });
    });

    it('should handle multiple requirements with proper indexing', () => {
      const requirements = ["First req", "Second req", "Third req"];
      const todos = createEnhancedTaskTodos(requirements, false);

      expect(todos[2].content).toBe("Implement requirement: First req");
      expect(todos[2].activeForm).toBe("Working on requirement 1");
      
      expect(todos[3].content).toBe("Implement requirement: Second req");
      expect(todos[3].activeForm).toBe("Working on requirement 2");
      
      expect(todos[4].content).toBe("Implement requirement: Third req");
      expect(todos[4].activeForm).toBe("Working on requirement 3");
    });
  });

  describe('validateTodoStructure', () => {
    it('should validate correct todo structure', () => {
      const validTodos: TodoItem[] = [
        { content: "First task", status: "pending", activeForm: "Working on first" },
        { content: "Second task", status: "in_progress", activeForm: "Working on second" },
        { content: "Third task", status: "completed", activeForm: "Working on third" }
      ];

      const result = validateTodoStructure(validTodos);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject non-array input', () => {
      const result = validateTodoStructure("not an array" as unknown as TodoItem[]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["Todos must be an array"]);
    });

    it('should reject null input', () => {
      const result = validateTodoStructure(null as unknown as TodoItem[]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["Todos must be an array"]);
    });

    it('should reject undefined input', () => {
      const result = validateTodoStructure(undefined as unknown as TodoItem[]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["Todos must be an array"]);
    });

    it('should reject empty array', () => {
      const result = validateTodoStructure([]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(["Todo list cannot be empty"]);
    });

    it('should validate todo content field', () => {
      const invalidTodos = [
        { status: "pending", activeForm: "Working" }, // Missing content
        { content: "", status: "pending", activeForm: "Working" }, // Empty content
        { content: 123, status: "pending", activeForm: "Working" } // Non-string content
      ] as unknown;

      const result = validateTodoStructure(invalidTodos);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Todo 0: content must be a non-empty string");
      expect(result.errors).toContain("Todo 1: content must be a non-empty string");
      expect(result.errors).toContain("Todo 2: content must be a non-empty string");
    });

    it('should validate todo activeForm field', () => {
      const invalidTodos = [
        { content: "Valid", status: "pending" }, // Missing activeForm
        { content: "Valid", status: "pending", activeForm: "" }, // Empty activeForm
        { content: "Valid", status: "pending", activeForm: 123 } // Non-string activeForm
      ] as unknown;

      const result = validateTodoStructure(invalidTodos);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Todo 0: activeForm must be a non-empty string");
      expect(result.errors).toContain("Todo 1: activeForm must be a non-empty string");
      expect(result.errors).toContain("Todo 2: activeForm must be a non-empty string");
    });

    it('should validate todo status field', () => {
      const invalidTodos = [
        { content: "Valid", activeForm: "Working" }, // Missing status
        { content: "Valid", status: "invalid_status", activeForm: "Working" }, // Invalid status
        { content: "Valid", status: 123, activeForm: "Working" } // Non-string status
      ] as unknown;

      const result = validateTodoStructure(invalidTodos);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Todo 0: status must be pending, in_progress, or completed");
      expect(result.errors).toContain("Todo 1: status must be pending, in_progress, or completed");
      expect(result.errors).toContain("Todo 2: status must be pending, in_progress, or completed");
    });

    it('should allow only one todo to be in_progress', () => {
      const invalidTodos: TodoItem[] = [
        { content: "First", status: "in_progress", activeForm: "Working on first" },
        { content: "Second", status: "in_progress", activeForm: "Working on second" },
        { content: "Third", status: "pending", activeForm: "Working on third" }
      ];

      const result = validateTodoStructure(invalidTodos);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Only one todo can be 'in_progress' at a time");
    });

    it('should allow zero todos in_progress', () => {
      const validTodos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "Working on first" },
        { content: "Second", status: "pending", activeForm: "Working on second" },
        { content: "Third", status: "pending", activeForm: "Working on third" }
      ];

      const result = validateTodoStructure(validTodos);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should allow exactly one todo in_progress', () => {
      const validTodos: TodoItem[] = [
        { content: "First", status: "completed", activeForm: "Working on first" },
        { content: "Second", status: "in_progress", activeForm: "Working on second" },
        { content: "Third", status: "pending", activeForm: "Working on third" }
      ];

      const result = validateTodoStructure(validTodos);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accumulate multiple errors', () => {
      const invalidTodos = [
        { content: "", activeForm: "", status: "invalid" }, // Multiple errors
        { content: "Valid", status: "in_progress", activeForm: "Valid" }, // Valid
        { content: "Valid", status: "in_progress", activeForm: "Valid" } // Duplicate in_progress
      ] as unknown;

      const result = validateTodoStructure(invalidTodos);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain("Todo 0: content must be a non-empty string");
      expect(result.errors).toContain("Todo 0: activeForm must be a non-empty string");
      expect(result.errors).toContain("Todo 0: status must be pending, in_progress, or completed");
      expect(result.errors).toContain("Only one todo can be 'in_progress' at a time");
    });

    it('should handle edge case with whitespace-only strings', () => {
      const invalidTodos = [
        { content: "   ", status: "pending", activeForm: "   " }
      ] as unknown;

      const result = validateTodoStructure(invalidTodos);

      // The validation function treats whitespace strings as valid strings
      // because it only checks if (!todo.content) not if (todo.content.trim())
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('integration scenarios', () => {
    it('should work with full workflow: create -> progress -> validate', () => {
      // Create initial todos
      let todos = createTaskTodos(["Requirement 1", "Requirement 2"]);
      expect(todos).toHaveLength(8);

      // Progress through first few steps
      todos = progressToNext(todos); // Start first
      expect(todos[0].status).toBe('in_progress');

      todos = progressToNext(todos); // Complete first, start second
      expect(todos[0].status).toBe('completed');
      expect(todos[1].status).toBe('in_progress');

      // Check progress
      let progress = getTodosProgress(todos);
      expect(progress.completed).toBe(1);
      expect(progress.inProgress).toBe(1);
      expect(progress.pending).toBe(6);

      // Continue progressing
      while (!validateTodosComplete(todos)) {
        todos = progressToNext(todos);
      }

      // Final validation
      expect(validateTodosComplete(todos)).toBe(true);
      progress = getTodosProgress(todos);
      expect(progress.completed).toBe(8);
      expect(progress.percentComplete).toBe(100);

      const validation = validateTodoStructure(todos);
      expect(validation.isValid).toBe(true);
    });

    it('should handle manual status updates with validation', () => {
      let todos = createMcpTodos();

      // Update specific todo
      todos = updateTodoStatus(todos, 1, 'in_progress');

      // Validate structure
      const validation = validateTodoStructure(todos);
      expect(validation.isValid).toBe(true);

      // Check progress
      const progress = getTodosProgress(todos);
      expect(progress.inProgress).toBe(1);
      expect(progress.pending).toBe(2);
    });

    it('should handle error scenarios gracefully', () => {
      const todos = createContextTodos();

      // Try invalid operations
      expect(() => updateTodoStatus(todos, -1, 'completed')).toThrow();
      expect(() => updateTodoStatus(todos, 100, 'completed')).toThrow();

      // Validate error cases
      const invalidTodos = [
        { content: "Valid", status: "in_progress", activeForm: "Working" },
        { content: "Invalid", status: "in_progress", activeForm: "Working" }
      ] as unknown;

      const validation = validateTodoStructure(invalidTodos);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Only one todo can be 'in_progress' at a time");
    });
  });
});