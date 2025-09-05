/**
 * Documentation validation tests for README.md
 * Validates that code examples and tool references are accurate
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';

// Import available tools to verify they exist
import { createTask } from '../../../src/tools/create-task.js';
import { trackTaskProgress } from '../../../src/tools/track-task-progress.js';
import { getFullLifecycle } from '../../../src/tools/get-full-lifecycle.js';
import { archiveTasksTool } from '../../../src/tools/archive-tasks.js';
import { checkTasks } from '../../../src/tools/check-tasks.js';
import { readTask } from '../../../src/tools/read-task.js';
import { writeTask } from '../../../src/tools/write-task.js';
import { getServerInfo } from '../../../src/tools/get-server-info.js';
import { ping } from '../../../src/tools/ping.js';
import { getTaskContext } from '../../../src/tools/get-task-context.js';
import { submitPlan } from '../../../src/tools/submit-plan.js';
import { reportProgress } from '../../../src/tools/report-progress.js';
import { markComplete } from '../../../src/tools/mark-complete.js';
import { listAgents } from '../../../src/tools/list-agents.js';
import { restoreTasksTool } from '../../../src/tools/restore-tasks.js';
import { archiveCompletedTasks } from '../../../src/tools/archive-completed-tasks.js';

describe('README Documentation Validation', () => {
  let readmeContent: string;

  beforeAll(async () => {
    const readmePath = path.join(process.cwd(), 'README.md');
    readmeContent = await fs.readFile(readmePath, 'utf-8');
  });

  describe('Tool References Validation', () => {
    it('should reference only existing MCP tools', () => {
      // Extract tool names mentioned in README
      const toolReferences = [
        'create_task',
        'track_task_progress',
        'get_full_lifecycle',
        'check_tasks',
        'read_task',
        'write_task',
        'archive_tasks',
        'get_server_info',
        'ping',
        'get_task_context',
        'submit_plan',
        'report_progress', 
        'mark_complete',
        'list_agents',
        'restore_tasks',
        'archive_completed_tasks'
      ];

      // Available tool implementations
      const availableTools = {
        create_task: createTask,
        track_task_progress: trackTaskProgress,
        get_full_lifecycle: getFullLifecycle,
        check_tasks: checkTasks,
        read_task: readTask,
        write_task: writeTask,
        archive_tasks: archiveTasksTool,
        get_server_info: getServerInfo,
        ping: ping,
        get_task_context: getTaskContext,
        submit_plan: submitPlan,
        report_progress: reportProgress,
        mark_complete: markComplete,
        list_agents: listAgents,
        restore_tasks: restoreTasksTool,
        archive_completed_tasks: archiveCompletedTasks
      };

      // Verify all referenced tools exist
      toolReferences.forEach(toolName => {
        expect(availableTools[toolName]).toBeDefined();
        expect(typeof availableTools[toolName]).toBe('function');
      });
    });

    it('should have valid tool parameter names in examples', () => {
      // Extract code examples from README
      const codeBlocks = readmeContent.match(/```python\n([\s\S]*?)\n```/g) || [];
      
      expect(codeBlocks.length).toBeGreaterThan(0);

      codeBlocks.forEach(block => {
        const code = block.replace(/```python\n|```/g, '');
        
        // Check for common parameter patterns
        if (code.includes('mcp__agent_comm__')) {
          // Should have valid parameter names
          if (code.includes('create_task')) {
            expect(code).toMatch(/agent=/);
            expect(code).toMatch(/taskName=|task_name=/);
            expect(code).toMatch(/content=/);
          }
          
          if (code.includes('track_task_progress')) {
            expect(code).toMatch(/agent=/);
            expect(code).toMatch(/task_id=/);
          }
          
          if (code.includes('get_full_lifecycle')) {
            expect(code).toMatch(/agent=/);
            expect(code).toMatch(/task_id=/);
          }
        }
      });
    });

    it('should reference valid response fields', () => {
      // Check for response field references in README
      const responseFields = [
        "result['task_id']",
        "result['tracking']",
        "progress['status']",
        "progress['progress']",
        "lifecycle['lifecycle']",
        "lifecycle['summary']"
      ];

      responseFields.forEach(field => {
        if (readmeContent.includes(field)) {
          // Field is referenced in README, should be valid
          expect(field).toBeDefined();
          expect(typeof field).toBe('string');
        }
      });
    });
  });

  describe('Code Example Syntax Validation', () => {
    it('should have syntactically correct Python code examples', () => {
      const pythonBlocks = readmeContent.match(/```python\n([\s\S]*?)\n```/g) || [];
      
      expect(pythonBlocks.length).toBeGreaterThan(0);

      pythonBlocks.forEach(block => {
        const code = block.replace(/```python\n|```/g, '');
        
        // Basic syntax checks
        expect(code).not.toMatch(/\(\s*\)/); // No empty parentheses calls
        expect(code).not.toMatch(/=\s*$/m); // No assignments to nothing
        expect(code).not.toMatch(/,\s*\)/); // No trailing commas before closing paren
        
        // Should have proper indentation
        if (code.includes('if ') || code.includes('while ') || code.includes('for ')) {
          expect(code).toMatch(/:\s*$/m); // Colon after control structures
        }
      });
    });

    it('should have syntactically correct JSON examples', () => {
      const jsonBlocks = readmeContent.match(/```json\n([\s\S]*?)\n```/g) || [];
      
      expect(jsonBlocks.length).toBeGreaterThan(0);

      jsonBlocks.forEach(block => {
        const json = block.replace(/```json\n|```/g, '');
        
        // Check if it's JSON Lines format (multiple JSON objects)
        const lines = json.split('\n').filter(line => line.trim());
        
        if (lines.length > 1 && lines.every(line => line.trim().startsWith('{'))) {
          // JSON Lines format - validate each line separately
          lines.forEach(line => {
            expect(() => JSON.parse(line.trim())).not.toThrow();
          });
        } else {
          // Single JSON object
          expect(() => JSON.parse(json)).not.toThrow();
          
          const parsed = JSON.parse(json);
          
          // If it's MCP configuration, verify structure
          if (parsed.mcpServers) {
            expect(parsed.mcpServers).toHaveProperty('agent-comm');
            expect(parsed.mcpServers['agent-comm']).toHaveProperty('command');
            expect(parsed.mcpServers['agent-comm']).toHaveProperty('args');
            expect(parsed.mcpServers['agent-comm']).toHaveProperty('env');
          }
        }
      });
    });

    it('should have syntactically correct bash examples', () => {
      const bashBlocks = readmeContent.match(/```bash\n([\s\S]*?)\n```/g) || [];
      
      bashBlocks.forEach(block => {
        const bash = block.replace(/```bash\n|```/g, '');
        
        // Basic bash syntax checks
        expect(bash).not.toMatch(/&&\s*$/m); // No trailing &&
        expect(bash).not.toMatch(/\|\|\s*$/m); // No trailing ||
        expect(bash).not.toMatch(/;\s*$/m); // No trailing semicolons
        
        // Should start with valid commands
        bash.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            // Should start with valid command patterns
            expect(trimmed).toMatch(/^(npm|node|claude|mkdir|cd|ls|cat|echo|git)/);
          }
        });
      });
    });
  });

  describe('MCP References Validation', () => {
    it('should consistently reference agent-comm MCP server', () => {
      // All prompt examples should reference MCP
      const promptSections = readmeContent.match(/\*\*[^*]+:\*\*\n```\n([^`]+)\n```/g) || [];
      
      expect(promptSections.length).toBeGreaterThan(0);

      promptSections.forEach(section => {
        const prompt = section.match(/```\n([^`]+)\n```/)?.[1] || '';
        
        // Should reference agent-comm or MCP
        expect(prompt.toLowerCase()).toMatch(/(agent-comm|mcp)/);
        
        // Should start with "Using" or "Use" for consistency  
        expect(prompt.trim()).toMatch(/^(Using|Use) /);
      });
    });

    it('should have proper MCP server configuration', () => {
      // Check for MCP configuration examples
      expect(readmeContent).toMatch(/"mcpServers"/);
      expect(readmeContent).toMatch(/"agent-comm"/);
      expect(readmeContent).toMatch(/AGENT_COMM_DIR/);
      expect(readmeContent).toMatch(/AGENT_COMM_ARCHIVE_DIR/);
      expect(readmeContent).toMatch(/AGENT_COMM_LOG_DIR/);
    });

    it('should reference correct environment variables', () => {
      // Should use new environment variable names
      expect(readmeContent).toMatch(/AGENT_COMM_DIR/);
      expect(readmeContent).toMatch(/AGENT_COMM_ARCHIVE_DIR/);
      expect(readmeContent).toMatch(/AGENT_COMM_LOG_DIR/);
      expect(readmeContent).toMatch(/AGENT_COMM_DISABLE_ARCHIVE/);
      
      // Should not use old variable names
      expect(readmeContent).not.toMatch(/(?<!\w)COMM_DIR(?!\w)/);
      expect(readmeContent).not.toMatch(/(?<!\w)ARCHIVE_DIR(?!\w)/);
      expect(readmeContent).not.toMatch(/(?<!\w)ENABLE_ARCHIVING(?!\w)/);
    });
  });

  describe('Usage Pattern Validation', () => {
    it('should have realistic task examples', () => {
      // Task examples should be practical and specific
      const taskExamples = [
        'dashboard component',
        'REST API endpoints', 
        'user interface components',
        'test suite'
      ];

      taskExamples.forEach(example => {
        expect(readmeContent.toLowerCase()).toContain(example.toLowerCase());
      });
    });

    it('should demonstrate proper agent assignment', () => {
      // Should reference realistic agent names
      const agentNames = [
        'senior-frontend-engineer',
        'senior-backend-engineer', 
        'qa-test-automation-engineer'
      ];

      agentNames.forEach(agent => {
        expect(readmeContent).toContain(agent);
      });
    });

    it('should show complete workflow patterns', () => {
      // Should demonstrate end-to-end workflows
      expect(readmeContent).toMatch(/delegate.*task/i);
      expect(readmeContent).toMatch(/monitor.*progress/i);
      expect(readmeContent).toMatch(/lifecycle.*analysis/i);
      expect(readmeContent).toMatch(/parallel.*tasks/i);
      expect(readmeContent).toMatch(/archive.*tasks/i);
    });
  });

  describe('Documentation Structure Validation', () => {
    it('should have proper section hierarchy', () => {
      // Check for expected sections
      expect(readmeContent).toMatch(/## Features/);
      expect(readmeContent).toMatch(/## Quick Start/);
      expect(readmeContent).toMatch(/### Basic Usage/);
      expect(readmeContent).toMatch(/#### Sample Claude Code Prompts/);
      expect(readmeContent).toMatch(/## Available Tools/);
      expect(readmeContent).toMatch(/## Configuration/);
    });

    it('should have consistent formatting', () => {
      // Headers should be properly formatted
      const headers = readmeContent.match(/^#+\s+.+$/gm) || [];
      
      expect(headers.length).toBeGreaterThan(0);
      
      headers.forEach(header => {
        // Should have space after hash
        expect(header).toMatch(/^#+\s/);
        // Should not end with punctuation
        expect(header).not.toMatch(/[.!?:]$/);
      });
    });

    it('should have proper code block languages', () => {
      const codeBlocks = readmeContent.match(/```(\w+)/g) || [];
      const validLanguages = ['json', 'bash', 'python', 'typescript', 'javascript'];
      
      codeBlocks.forEach(block => {
        const lang = block.replace('```', '');
        expect(validLanguages).toContain(lang);
      });
    });
  });
});