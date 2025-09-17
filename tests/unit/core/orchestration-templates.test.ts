import { generateUniversalGuidance } from '../../../src/core/orchestration-templates.js';

describe('orchestration-templates', () => {
  describe('generateUniversalGuidance', () => {
    it('should generate complete orchestration guidance', () => {
      const guidance = generateUniversalGuidance('test-agent');

      expect(guidance).toHaveProperty('workflow');
      expect(guidance).toHaveProperty('orchestration');
      expect(guidance).toHaveProperty('example_invocations');
      expect(guidance).toHaveProperty('critical_note');
    });

    it('should include workflow steps', () => {
      const guidance = generateUniversalGuidance('senior-backend-engineer');

      expect(guidance.workflow).toHaveProperty('step1');
      expect(guidance.workflow).toHaveProperty('step2');
      expect(guidance.workflow).toHaveProperty('step3');

      expect(guidance.workflow.step1).toContain('Task created');
      expect(guidance.workflow.step2).toContain('Continue creating');
      expect(guidance.workflow.step3).toContain('launch agent');
    });

    it('should include PARALLEL execution instructions prominently', () => {
      const guidance = generateUniversalGuidance('test-agent');

      expect(guidance.orchestration.parallel_instruction).toContain('PARALLEL');
      expect(guidance.orchestration.parallel_instruction).toContain('Multiple Task() calls in SAME message');

      expect(guidance.critical_note).toContain('⚡');
      expect(guidance.critical_note).toContain('PARALLEL EXECUTION');
      expect(guidance.critical_note).toContain('simultaneously');
    });

    it('should explain single vs multiple agent patterns', () => {
      const guidance = generateUniversalGuidance('test-agent');

      expect(guidance.orchestration).toHaveProperty('pattern');
      expect(guidance.orchestration).toHaveProperty('single_agent');
      expect(guidance.orchestration).toHaveProperty('multiple_agents_parallel');
      expect(guidance.orchestration).toHaveProperty('multiple_agents_sequential');

      expect(guidance.orchestration.pattern).toContain('check_tasks()');
      expect(guidance.orchestration.multiple_agents_parallel).toContain('ONE message');
      expect(guidance.orchestration.multiple_agents_sequential).toContain('separate messages');
    });

    it('should provide example invocations', () => {
      const guidance = generateUniversalGuidance('senior-backend-engineer');

      expect(guidance.example_invocations).toHaveProperty('single');
      expect(guidance.example_invocations).toHaveProperty('parallel');

      expect(guidance.example_invocations.single).toContain('Task(');
      expect(guidance.example_invocations.single).toContain('subagent_type');
      expect(guidance.example_invocations.single).toContain('senior-backend-engineer');

      expect(guidance.example_invocations.parallel).toContain('// For parallel execution');
      expect(guidance.example_invocations.parallel).toContain('Multiple Task() calls');
    });

    it('should customize examples for the specific agent', () => {
      const guidanceFrontend = generateUniversalGuidance('senior-frontend-engineer');
      const guidanceBackend = generateUniversalGuidance('senior-backend-engineer');

      expect(guidanceFrontend.example_invocations.single).toContain('senior-frontend-engineer');
      expect(guidanceBackend.example_invocations.single).toContain('senior-backend-engineer');
    });

    it('should have clear instructions about MCP discovery', () => {
      const guidance = generateUniversalGuidance('test-agent');

      expect(guidance.orchestration.pattern).toContain('Agents discover');
      expect(guidance.orchestration.pattern).toContain('check_tasks()');
      expect(guidance.example_invocations.single).toContain('mcp__agent_comm__check_tasks');
    });
  });
});