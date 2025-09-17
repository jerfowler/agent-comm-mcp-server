import debug from 'debug';

const log = debug('agent-comm:core:orchestration');

export interface OrchestrationGuidance {
  workflow: {
    step1: string;
    step2: string;
    step3: string;
  };
  orchestration: {
    pattern: string;
    single_agent: string;
    multiple_agents_parallel: string;
    multiple_agents_sequential: string;
    parallel_instruction: string;
  };
  example_invocations: {
    single: string;
    parallel: string;
  };
  critical_note: string;
}

/**
 * Generates universal orchestration guidance for task execution
 * Provides clear instructions for parallel vs sequential execution
 * @param agent - The agent name for customized examples
 * @returns Complete orchestration guidance with parallel execution instructions
 */
export function generateUniversalGuidance(agent: string): OrchestrationGuidance {
  log('Generating universal orchestration guidance for agent: %s', agent);

  const guidance: OrchestrationGuidance = {
    workflow: {
      step1: '✅ Task created and queued for processing',
      step2: 'Continue creating any additional tasks needed',
      step3: 'When done creating tasks, launch agent(s) to process all work'
    },
    orchestration: {
      pattern: 'Agents discover their own tasks via check_tasks()',
      single_agent: `Task(subagent_type="${agent}", prompt="...")`,
      multiple_agents_parallel: 'Put all Task() calls in ONE message for parallel execution',
      multiple_agents_sequential: 'Use separate messages for sequential execution',
      parallel_instruction: '⚡ PARALLEL: Multiple Task() calls in SAME message run simultaneously'
    },
    example_invocations: {
      single: generateSingleAgentExample(agent),
      parallel: generateParallelExample()
    },
    critical_note: '⚡ PARALLEL EXECUTION: Multiple Task() calls in SAME message run simultaneously'
  };

  log('Generated orchestration guidance with parallel instructions');
  return guidance;
}

function generateSingleAgentExample(agent: string): string {
  return `Task(
  subagent_type="${agent}",
  prompt="You have MCP tasks assigned.\\nStart: mcp__agent_comm__check_tasks(agent=\\"${agent}\\")\\nThis discovers ALL your tasks. For each task:\\n1. Get context 2. Submit plan 3. Execute 4. Report progress 5. Mark complete"
)`;
}

function generateParallelExample(): string {
  return `// For parallel execution, put ALL in ONE message:
Task(subagent_type="frontend-engineer", prompt="Check your MCP tasks...")
Task(subagent_type="backend-engineer", prompt="Check your MCP tasks...")
Task(subagent_type="qa-engineer", prompt="Check your MCP tasks...")
// All three agents work simultaneously! Multiple Task() calls in ONE message = PARALLEL`;
}