/**
 * Tests for create-task protocol injection of reconciliation information
 * Ensures agents receive proper guidance about mark_complete reconciliation options
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTask } from '../../../src/tools/create-task.js';
import { ServerConfig } from '../../../src/types.js';
import { testUtils } from '../../utils/testUtils.js';

describe('Create Task Reconciliation Protocol Context', () => {
  let mockConfig: ServerConfig;

  beforeEach(() => {
    mockConfig = testUtils.createMockConfig();
  });

  describe('Protocol Context Content', () => {
    it('should inject COMPLETE protocol context with all sections', async () => {
      const os = require('os');
      const fs = require('fs-extra');
      const path = require('path');
      
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'complete-protocol-test-'));
      const testConfig = {
        ...mockConfig,
        commDir: testDir
      };
      
      try {
        const args = {
          agent: 'test-agent',
          taskName: 'complete-protocol-test',
          content: 'Test task content',
          taskType: 'delegation' as const
        };

        const result = await createTask(testConfig, args);
        expect(result.success).toBe(true);
        
        // Read the actual INIT.md file
        const agentDir = path.join(testDir, 'test-agent');
        const taskDirs = await fs.readdir(agentDir);
        const taskDir = taskDirs.find((dir: string) => dir.includes('complete-protocol-test'));
        const initPath = path.join(agentDir, taskDir!, 'INIT.md');
        const initContent = await fs.readFile(initPath, 'utf8');
        
        // Count tokens (rough estimate: ~4 chars per token)
        const estimatedTokens = Math.ceil(initContent.length / 4);
        console.log(`Protocol context size: ${initContent.length} characters (~${estimatedTokens} tokens)`);
        
        // Validate ALL major sections are present
        
        // 1. MCP Task Management Protocol header
        expect(initContent).toContain('## MCP Task Management Protocol');
        
        // 2. IMPORTANT: Creating Tasks section
        expect(initContent).toContain('### IMPORTANT: Creating Tasks');
        expect(initContent).toContain('create_task({');
        expect(initContent).toContain('agent: "target-agent"');
        expect(initContent).toContain('taskName: "task-name"');
        expect(initContent).toContain('taskType: "delegation"');
        expect(initContent).toContain('parentTask: "parent-id"');
        
        // 3. CRITICAL: Task Workflow section
        expect(initContent).toContain('### CRITICAL: Task Workflow');
        expect(initContent).toContain('check_assigned_tasks()');
        expect(initContent).toContain('start_task(taskId)');
        expect(initContent).toContain('submit_plan(content)');
        expect(initContent).toContain('report_progress(updates)');
        expect(initContent).toContain('mark_complete(status, summary, reconciliation_options)');
        
        // 4. MANDATORY: Todo Integration section
        expect(initContent).toContain('### MANDATORY: Todo Integration');
        expect(initContent).toContain('TodoWrite items');
        expect(initContent).toContain("'in_progress'");
        expect(initContent).toContain("'completed'");
        expect(initContent).toContain('NEVER** have more than ONE');
        
        // 5. REQUIRED Plan Format section
        expect(initContent).toContain('### REQUIRED Plan Format');
        expect(initContent).toContain('CHECKBOX FORMAT');
        expect(initContent).toContain('- [ ] **Step Title**');
        expect(initContent).toContain('- Action: Specific command');
        expect(initContent).toContain('- Expected: Success criteria');
        expect(initContent).toContain('- Error: Handling approach');
        
        // 6. Example Plan Format
        expect(initContent).toContain('**Example Plan Format:**');
        expect(initContent).toContain('## Testing Plan');
        expect(initContent).toContain('**Test Discovery**');
        expect(initContent).toContain('**Test Execution**');
        expect(initContent).toContain('pnpm test:all --coverage');
        
        // 7. VALIDATION RULES
        expect(initContent).toContain('**VALIDATION RULES:**');
        expect(initContent).toContain('Minimum ONE checkbox required');
        expect(initContent).toContain('use `- [ ]` format exactly');
        expect(initContent).toContain('bold title: `**Title**:`');
        expect(initContent).toContain('2-5 detail bullets');
        expect(initContent).toContain('NO [PENDING]/[COMPLETE] status markers');
        
        // 8. CRITICAL RULES - NEVER VIOLATE
        expect(initContent).toContain('### CRITICAL RULES - NEVER VIOLATE');
        expect(initContent).toContain('NEVER** create duplicate tasks');
        expect(initContent).toContain('NEVER** add timestamps');
        expect(initContent).toContain('ALWAYS** update progress');
        expect(initContent).toContain('NEVER** skip submit_plan');
        expect(initContent).toContain('ONLY** mark complete when 100%');
        
        // 9. Task Completion Reconciliation (FULL SECTION)
        expect(initContent).toContain('### Task Completion Reconciliation');
        expect(initContent).toContain('intelligent reconciliation when plan checkboxes remain unchecked');
        expect(initContent).toContain('**4 Reconciliation Modes:**');
        
        // 10. All 4 reconciliation modes with details
        expect(initContent).toContain('1. **`strict`** (default)');
        expect(initContent).toContain('Plan adherence is critical');
        expect(initContent).toContain('Rejects DONE with unchecked items');
        
        expect(initContent).toContain('2. **`auto_complete`**');
        expect(initContent).toContain('Work is done but forgot to check boxes');
        expect(initContent).toContain('Updates PLAN.md with all items checked');
        
        expect(initContent).toContain('3. **`reconcile`**');
        expect(initContent).toContain('Accept completion with explanations');
        expect(initContent).toContain('reconciliation_explanations object');
        expect(initContent).toContain('Creates variance report');
        
        expect(initContent).toContain('4. **`force`**');
        expect(initContent).toContain('Emergency completion, plan became obsolete');
        expect(initContent).toContain('Documents forced override with warnings');
        
        // 11. Reconciliation Examples (ALL 4 examples)
        expect(initContent).toContain('**Reconciliation Examples (Essential Examples for Proper Usage):**');
        expect(initContent).toContain('// Example 1: Default strict mode (recommended example)');
        expect(initContent).toContain('// Example 3: Auto-complete forgotten checkboxes example');
        expect(initContent).toContain('// Example 4: Reconcile with explanations (detailed example)');
        expect(initContent).toContain('// Force completion in emergency');
        
        // Verify specific example content
        expect(initContent).toContain("reconciliation_mode: 'auto_complete'");
        expect(initContent).toContain("reconciliation_mode: 'reconcile'");
        expect(initContent).toContain("reconciliation_mode: 'force'");
        expect(initContent).toContain('reconciliation_explanations: {');
        expect(initContent).toContain("'Database Setup': 'Used existing schema, setup not needed'");
        expect(initContent).toContain("'Performance Testing': 'Deferred to next sprint per stakeholder decision'");
        
        // 12. BEST PRACTICES section
        expect(initContent).toContain('**BEST PRACTICES:**');
        expect(initContent).toContain('Update checkboxes** as you complete work');
        expect(initContent).toContain('Use strict mode** by default');
        expect(initContent).toContain('Provide clear explanations** when using reconcile');
        expect(initContent).toContain('Reserve force mode** for genuine emergencies');
        expect(initContent).toContain('Document reconciliation decisions** thoroughly');
        
        // 13. Diagnostic Tools section
        expect(initContent).toContain('### Diagnostic Tools');
        expect(initContent).toContain('track_task_progress(agent, taskId)');
        expect(initContent).toContain('get_full_lifecycle(agent, taskId)');
        
        // 14. Final reminder
        expect(initContent).toContain('**REMEMBER:** Update todos, use checkbox format');
        expect(initContent).toContain('report progress CONTINUOUSLY!');
        
        // 15. Verify user content is preserved
        expect(initContent).toContain('Test task content');
        
        // Token analysis - warn if too large
        if (estimatedTokens > 1500) {
          console.warn(`Warning: Protocol context is very large (~${estimatedTokens} tokens). Consider optimization.`);
        }
        
        // Ensure the protocol context is substantial but not excessive
        expect(estimatedTokens).toBeGreaterThan(800); // Should be comprehensive
        expect(estimatedTokens).toBeLessThan(2000); // Should not be excessive
        
      } finally {
        await fs.remove(testDir);
      }
    });
    it('should inject reconciliation information into actual task content', async () => {
      // Create a temporary directory for this test
      const os = require('os');
      const fs = require('fs-extra');
      const path = require('path');
      
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-task-test-'));
      const testConfig = {
        ...mockConfig,
        commDir: testDir
      };
      
      try {
        const args = {
          agent: 'test-agent',
          taskName: 'test-reconciliation-protocol',
          content: 'Test task for protocol validation',
          taskType: 'delegation' as const
        };

        const result = await createTask(testConfig, args);
        expect(result.success).toBe(true);
        
        // Read the actual INIT.md file that was created
        const agentDir = path.join(testDir, 'test-agent');
        const taskDirs = await fs.readdir(agentDir);
        const taskDir = taskDirs.find((dir: string) => dir.includes('test-reconciliation-protocol'));
        expect(taskDir).toBeDefined();
        
        const initPath = path.join(agentDir, taskDir!, 'INIT.md');
        const initContent = await fs.readFile(initPath, 'utf8');
        
        // Verify reconciliation information was injected into the actual task
        expect(initContent).toContain('Task Completion Reconciliation');
        expect(initContent).toContain('4 Reconciliation Modes');
        expect(initContent).toContain('strict');
        expect(initContent).toContain('auto_complete');
        expect(initContent).toContain('reconcile');
        expect(initContent).toContain('force');
        expect(initContent).toContain('reconciliation_explanations');
        
      } finally {
        // Clean up
        await fs.remove(testDir);
      }
    });

    it('should include reconciliation modes in protocol instructions', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');

      // The protocol context should include reconciliation information
      expect(PROTOCOL_CONTEXT).toContain('reconciliation_mode');
      expect(PROTOCOL_CONTEXT).toContain('Reconciliation');
    });

    it('should document all 4 reconciliation modes in protocol context', () => {
      // Test that the PROTOCOL_CONTEXT constant includes all reconciliation modes
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      expect(PROTOCOL_CONTEXT).toContain('reconciliation_mode');
      expect(PROTOCOL_CONTEXT).toContain('strict');
      expect(PROTOCOL_CONTEXT).toContain('auto_complete');
      expect(PROTOCOL_CONTEXT).toContain('reconcile');
      expect(PROTOCOL_CONTEXT).toContain('force');
    });

    it('should explain when to use each reconciliation mode', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      // Should explain strict mode (default)
      expect(PROTOCOL_CONTEXT).toContain('strict');
      expect(PROTOCOL_CONTEXT).toMatch(/strict.*default|default.*strict/i);
      
      // Should explain auto_complete for forgotten checkboxes
      expect(PROTOCOL_CONTEXT).toContain('auto_complete');
      expect(PROTOCOL_CONTEXT).toMatch(/auto_complete.*forgot|forgot.*auto_complete|auto.*complete.*checkbox/i);
      
      // Should explain reconcile for alternative approaches
      expect(PROTOCOL_CONTEXT).toContain('reconcile');
      expect(PROTOCOL_CONTEXT).toMatch(/reconcile.*variances|variances.*reconcile|different.*planned/i);
      
      // Should explain force for emergency situations
      expect(PROTOCOL_CONTEXT).toContain('force');
      expect(PROTOCOL_CONTEXT).toMatch(/force.*emergency|emergency.*force|force.*override/i);
    });

    it('should provide examples of reconciliation usage', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      // Should have examples showing how to use reconciliation
      expect(PROTOCOL_CONTEXT).toContain('reconciliation_explanations');
      expect(PROTOCOL_CONTEXT).toMatch(/example.*reconcil|reconcil.*example/i);
    });

    it('should emphasize checkbox format requirements for reconciliation', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      // Should connect checkbox format to reconciliation functionality
      expect(PROTOCOL_CONTEXT).toContain('checkbox');
      expect(PROTOCOL_CONTEXT).toContain('- [ ]');
      expect(PROTOCOL_CONTEXT).toContain('**Title**:');
      
      // Should explain that reconciliation works on checkbox format
      expect(PROTOCOL_CONTEXT).toMatch(/checkbox.*reconcil|reconcil.*checkbox/i);
    });

    it('should warn about proper completion practices', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      // Should emphasize checking off items as work progresses
      expect(PROTOCOL_CONTEXT).toMatch(/check.*progress|progress.*check|update.*checkbox/i);
      
      // Should warn about not marking complete prematurely
      expect(PROTOCOL_CONTEXT).toMatch(/complete.*all|all.*complete|100%.*done/i);
    });

    it('should inject reconciliation information for all task types', async () => {
      const os = require('os');
      const fs = require('fs-extra');
      const path = require('path');
      
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-task-types-test-'));
      const testConfig = {
        ...mockConfig,
        commDir: testDir
      };
      
      try {
        // Test delegation task
        const delegationResult = await createTask(testConfig, {
          agent: 'test-agent-1',
          taskName: 'delegation-task',
          content: 'Delegation task content',
          taskType: 'delegation'
        });
        expect(delegationResult.success).toBe(true);
        
        // Test self-organization task
        const selfResult = await createTask(testConfig, {
          agent: 'test-agent-2',
          taskName: 'self-task',
          taskType: 'self'
        });
        expect(selfResult.success).toBe(true);
        
        // Test subtask
        const subtaskResult = await createTask(testConfig, {
          agent: 'test-agent-3',
          taskName: 'subtask',
          content: 'Subtask content',
          taskType: 'subtask',
          parentTask: 'parent-task-id'
        });
        expect(subtaskResult.success).toBe(true);
        
        // Verify reconciliation info is present in all task types
        const agents = ['test-agent-1', 'test-agent-2', 'test-agent-3'];
        const taskNames = ['delegation-task', 'self-task', 'subtask'];
        
        for (let i = 0; i < agents.length; i++) {
          const agentDir = path.join(testDir, agents[i]);
          const taskDirs = await fs.readdir(agentDir);
          const taskDir = taskDirs.find((dir: string) => dir.includes(taskNames[i]));
          expect(taskDir).toBeDefined();
          
          const initPath = path.join(agentDir, taskDir!, 'INIT.md');
          const initContent = await fs.readFile(initPath, 'utf8');
          
          // All task types should have reconciliation information
          expect(initContent).toContain('Task Completion Reconciliation');
          expect(initContent).toContain('reconciliation_mode');
          expect(initContent).toContain('strict');
          expect(initContent).toContain('auto_complete');
          expect(initContent).toContain('reconcile');
          expect(initContent).toContain('force');
        }
        
      } finally {
        await fs.remove(testDir);
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing protocol structure', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      // Should still include all existing required elements
      expect(PROTOCOL_CONTEXT).toContain('check_assigned_tasks()');
      expect(PROTOCOL_CONTEXT).toContain('start_task(taskId)');
      expect(PROTOCOL_CONTEXT).toContain('submit_plan(content)');
      expect(PROTOCOL_CONTEXT).toContain('report_progress(updates)');
      expect(PROTOCOL_CONTEXT).toContain('mark_complete(status, summary');
    });

    it('should preserve todo integration requirements', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      expect(PROTOCOL_CONTEXT).toContain('TodoWrite');
      expect(PROTOCOL_CONTEXT).toContain('in_progress');
      expect(PROTOCOL_CONTEXT).toContain('completed');
    });
  });

  describe('Protocol Context Size Analysis', () => {
    it('should measure and validate protocol context token count', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      const charCount = PROTOCOL_CONTEXT.length;
      const estimatedTokens = Math.ceil(charCount / 4); // Rough estimate: ~4 chars per token
      const lineCount = PROTOCOL_CONTEXT.split('\n').length;
      
      console.log('\n=== PROTOCOL CONTEXT SIZE ANALYSIS ===');
      console.log(`Characters: ${charCount}`);
      console.log(`Estimated tokens: ${estimatedTokens}`);
      console.log(`Lines: ${lineCount}`);
      console.log(`Average chars per line: ${Math.round(charCount / lineCount)}`);
      
      // Validate size constraints
      expect(charCount).toBeGreaterThan(5000); // Should be comprehensive
      expect(charCount).toBeLessThan(8000); // Should not be excessive
      expect(estimatedTokens).toBeGreaterThan(1200); // Substantial guidance
      expect(estimatedTokens).toBeLessThan(2000); // Within reasonable limits
      expect(lineCount).toBeGreaterThan(140); // Detailed structure
      expect(lineCount).toBeLessThan(170); // Not overly verbose
      
      // Performance impact analysis
      const sizeCategory = estimatedTokens > 1500 ? 'LARGE' : 
                          estimatedTokens > 1000 ? 'MEDIUM' : 'SMALL';
      console.log(`Size category: ${sizeCategory}`);
      
      if (estimatedTokens > 1500) {
        console.warn('⚠️  Large protocol context may impact performance');
      }
      
      // Section breakdown analysis
      const sections = PROTOCOL_CONTEXT.split('###').length - 1;
      const codeBlocks = (PROTOCOL_CONTEXT.match(/```/g) || []).length / 2;
      const examples = (PROTOCOL_CONTEXT.match(/\/\//g) || []).length;
      
      console.log(`Major sections: ${sections}`);
      console.log(`Code blocks: ${codeBlocks}`);
      console.log(`Code examples: ${examples}`);
      console.log('=====================================\n');
      
      expect(sections).toBeGreaterThanOrEqual(6); // Should have all major sections
      expect(codeBlocks).toBeGreaterThanOrEqual(3); // Should have examples
      expect(examples).toBeGreaterThanOrEqual(4); // Should have comment examples
    });

    it('should validate protocol context efficiency metrics', () => {
      const { PROTOCOL_CONTEXT } = require('../../../src/tools/create-task.js');
      
      // Count important elements
      const reconciliationMentions = (PROTOCOL_CONTEXT.match(/reconcil/gi) || []).length;
      const exampleMentions = (PROTOCOL_CONTEXT.match(/example/gi) || []).length;
      const checkboxMentions = (PROTOCOL_CONTEXT.match(/checkbox/gi) || []).length;
      const criticalMentions = (PROTOCOL_CONTEXT.match(/\*\*[A-Z][^*]*\*\*/g) || []).length;
      
      console.log('\n=== CONTENT DENSITY ANALYSIS ===');
      console.log(`Reconciliation mentions: ${reconciliationMentions}`);
      console.log(`Example mentions: ${exampleMentions}`);
      console.log(`Checkbox mentions: ${checkboxMentions}`);
      console.log(`Critical/Important markers: ${criticalMentions}`);
      
      // Content density expectations
      expect(reconciliationMentions).toBeGreaterThanOrEqual(15); // Thorough reconciliation coverage
      expect(exampleMentions).toBeGreaterThanOrEqual(5); // Good example coverage
      expect(checkboxMentions).toBeGreaterThanOrEqual(8); // Checkbox format emphasis
      expect(criticalMentions).toBeGreaterThanOrEqual(20); // Proper emphasis on key points
      
      console.log('Content density: VALIDATED ✓');
      console.log('================================\n');
    });
  });
});