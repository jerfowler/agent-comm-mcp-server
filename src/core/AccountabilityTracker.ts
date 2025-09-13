/**
 * AccountabilityTracker - Track agent claims and require evidence for verification
 * Part of the Smart Response System to prevent incomplete implementations
 */

import type { EventLogger } from '../logging/EventLogger.js';

export interface TaskClaim {
  taskId: string;
  agent: string;
  timestamp: Date;
  claims: string[];
  evidence: Map<string, string>;
  verificationCommands: string[];
  completionScore: number;
}

export interface VerificationResult {
  command: string;
  success: boolean;
  output?: string;
  expectedPattern?: RegExp;
}

export interface RedFlag {
  severity: 'CRITICAL' | 'BLOCKER';
  message: string;
  evidence: string;
  recommendation: string;
}

export interface ErrorResponse {
  success: false;
  error_code: string;
  error_severity: string;
  exit_code: number;
  red_flags: string[];
  blocked?: boolean;
  trust_score?: number;
  verification_commands?: string[];
  verification_required?: boolean;
  trust_warning?: string;
}

/**
 * AccountabilityTracker ensures agents provide evidence for their claims
 * and generates verification commands to validate work completion
 */
export class AccountabilityTracker {
  private taskClaims = new Map<string, TaskClaim>();
  private verificationHistory = new Map<string, VerificationResult[]>();
  private progressReports = new Map<string, number>(); // Track progress reports per task
  private readonly minCompletionScore = 70;

  constructor(private eventLogger: EventLogger) {}

  /**
   * Record a claim made by an agent about task completion
   */
  async recordClaim(
    taskId: string,
    agent: string,
    claim: string,
    evidence?: string
  ): Promise<void> {
    let taskClaim = this.taskClaims.get(taskId);

    if (!taskClaim) {
      taskClaim = {
        taskId,
        agent,
        timestamp: new Date(),
        claims: [],
        evidence: new Map(),
        verificationCommands: [],
        completionScore: 0
      };
      this.taskClaims.set(taskId, taskClaim);
    }

    taskClaim.claims.push(claim);
    if (evidence) {
      taskClaim.evidence.set(claim, evidence);
    }

    // Generate verification commands based on claim type
    const commands = this.generateVerificationCommands(claim);
    taskClaim.verificationCommands.push(...commands);

    await this.eventLogger.logOperation('accountability_claim_recorded', agent, {
      taskId,
      claim,
      hasEvidence: !!evidence,
      verificationCommandsGenerated: commands.length
    });
  }

  /**
   * Generate verification commands based on claim type
   */
  private generateVerificationCommands(claim: string): string[] {
    const commands: string[] = [];

    // Parallel execution claims
    if (claim.toLowerCase().includes('parallel execution')) {
      commands.push(
        'grep -n "Task(subagent_type.*Task(subagent_type" src/core/ResponseEnhancer.ts',
        'grep -c "parallel.*Task\\\\(" src/core/ResponseEnhancer.ts'
      );
    }

    // Escalation levels claims
    if (claim.toLowerCase().includes('escalation') || claim.toLowerCase().includes('urgency')) {
      commands.push(
        'grep -n "urgency_level.*gentle\\|firm\\|critical" src/core/ResponseEnhancer.ts',
        'grep -c "escalation" src/core/ResponseEnhancer.ts'
      );
    }

    // Accountability integration claims
    if (claim.toLowerCase().includes('accountability')) {
      commands.push(
        'ls -la src/core/AccountabilityTracker.ts',
        'grep -n "AccountabilityTracker" src/core/ResponseEnhancer.ts',
        'grep -c "verif" src/core/AccountabilityTracker.ts'
      );
    }

    // Test claims
    if (claim.toLowerCase().includes('test')) {
      commands.push(
        'npm test tests/unit/core/response-enhancer-all-tools.test.ts 2>&1 | grep "Tests:.*passed"',
        'npm run test:coverage 2>&1 | grep "Statements"'
      );
    }

    // Documentation claims
    if (claim.toLowerCase().includes('documentation') || claim.toLowerCase().includes('protocol')) {
      commands.push(
        'grep -c "Smart Response" docs/PROTOCOL.md',
        'grep -c "parallel execution" README.md',
        'grep -c "AccountabilityTracker" docs/PROTOCOL.md'
      );
    }

    return commands;
  }

  /**
   * Verify claims with evidence requirement
   */
  async verifyClaim(
    taskId: string,
    verificationResults: VerificationResult[]
  ): Promise<boolean> {
    const taskClaim = this.taskClaims.get(taskId);
    if (!taskClaim) {
      return false;
    }

    // Store verification results
    this.verificationHistory.set(taskId, verificationResults);

    // Calculate completion score
    const totalChecks = verificationResults.length;
    const passedChecks = verificationResults.filter(r => r.success).length;
    taskClaim.completionScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

    await this.eventLogger.logOperation('accountability_verification', taskClaim.agent, {
      taskId,
      totalChecks,
      passedChecks,
      completionScore: taskClaim.completionScore,
      passed: taskClaim.completionScore >= this.minCompletionScore
    });

    return taskClaim.completionScore >= this.minCompletionScore;
  }

  /**
   * Get completion score for a task
   */
  getCompletionScore(taskId: string): number {
    const taskClaim = this.taskClaims.get(taskId);
    return taskClaim?.completionScore ?? 0;
  }

  /**
   * Check if task completion can be accepted
   */
  canAcceptCompletion(taskId: string): boolean {
    const score = this.getCompletionScore(taskId);
    return score >= this.minCompletionScore;
  }

  /**
   * Generate evidence report for a task
   */
  generateEvidenceReport(taskId: string): string {
    const taskClaim = this.taskClaims.get(taskId);
    if (!taskClaim) {
      return 'No claims recorded for this task';
    }

    const verificationResults = this.verificationHistory.get(taskId) ?? [];

    let report = `# Evidence Report for Task ${taskId}\n\n`;
    report += `Agent: ${taskClaim.agent}\n`;
    report += `Timestamp: ${taskClaim.timestamp.toISOString()}\n`;
    report += `Completion Score: ${taskClaim.completionScore}%\n`;
    report += `Status: ${this.canAcceptCompletion(taskId) ? '✅ ACCEPTABLE' : '❌ INSUFFICIENT EVIDENCE'}\n\n`;

    report += `## Claims (${taskClaim.claims.length})\n`;
    for (const claim of taskClaim.claims) {
      const evidence = taskClaim.evidence.get(claim);
      report += `- ${claim}\n`;
      if (evidence) {
        report += `  Evidence: ${evidence}\n`;
      }
    }

    report += `\n## Verification Results (${verificationResults.length})\n`;
    for (const result of verificationResults) {
      const icon = result.success ? '✅' : '❌';
      report += `${icon} \`${result.command}\`\n`;
      if (result.output) {
        report += `   Output: ${result.output.substring(0, 100)}...\n`;
      }
    }

    report += `\n## Verification Commands\n`;
    report += '```bash\n';
    for (const cmd of taskClaim.verificationCommands) {
      report += `${cmd}\n`;
    }
    report += '```\n';

    return report;
  }

  /**
   * Generate actionable verification guidance
   */
  generateVerificationGuidance(taskId: string): string {
    const taskClaim = this.taskClaims.get(taskId);
    if (!taskClaim) {
      return 'Start by recording your implementation claims';
    }

    const score = this.getCompletionScore(taskId);

    if (score >= this.minCompletionScore) {
      return `✅ Evidence verified (${score}%). Task completion acceptable.`;
    } else if (score > 0) {
      const missing = this.minCompletionScore - score;
      return `⚠️ Evidence insufficient (${score}%). Need ${missing}% more verification. Run: ${taskClaim.verificationCommands[0] ?? 'verification commands'}`;
    } else {
      return `🚨 NO EVIDENCE PROVIDED. Must provide verification: ${taskClaim.verificationCommands.join(' && ')}`;
    }
  }

  /**
   * Reset tracker for a task
   */
  resetTask(taskId: string): void {
    this.taskClaims.delete(taskId);
    this.verificationHistory.delete(taskId);
  }

  /**
   * Get all pending verifications
   */
  getPendingVerifications(): string[] {
    const pending: string[] = [];
    for (const [taskId, claim] of this.taskClaims.entries()) {
      if (claim.completionScore < this.minCompletionScore) {
        pending.push(taskId);
      }
    }
    return pending;
  }

  /**
   * Record a progress report for tracking
   */
  async recordProgressReport(agent: string, taskId: string): Promise<void> {
    const key = `${agent}:${taskId}`;
    const current = this.progressReports.get(key) ?? 0;
    this.progressReports.set(key, current + 1);

    await this.eventLogger.logOperation('progress_report_recorded', agent, {
      taskId,
      reportCount: current + 1
    });
  }

  /**
   * Detect red flags in task completion attempt
   */
  async detectRedFlags(agent: string, taskId: string): Promise<RedFlag[]> {
    const flags: RedFlag[] = [];
    const key = `${agent}:${taskId}`;

    // Check progress tracking
    const progressCount = this.progressReports.get(key) ?? 0;
    if (progressCount < 3) {
      flags.push({
        severity: 'CRITICAL',
        message: '🚨 INSUFFICIENT PROGRESS TRACKING',
        evidence: `Only ${progressCount} progress reports filed (minimum 3 required)`,
        recommendation: 'Reject completion without evidence'
      });
    }

    // Check evidence score
    const score = this.getCompletionScore(taskId);
    if (score < this.minCompletionScore) {
      // Always add EVIDENCE SCORE FAILING flag when score is low
      flags.push({
        severity: 'CRITICAL',
        message: '🚨 EVIDENCE SCORE FAILING',
        evidence: `Score: ${score}% (minimum 70% required)`,
        recommendation: 'Reject completion without evidence'
      });

      // Check if this is a forced completion attempt
      const taskClaim = this.taskClaims.get(taskId);
      const hasAnyClaims = taskClaim && taskClaim.claims.length > 0;

      if (hasAnyClaims && progressCount === 0) {
        flags.push({
          severity: 'BLOCKER',
          message: '🚨 COMPLETION FORCED WITHOUT EVIDENCE',
          evidence: `reconciliation_mode=force with score < 70%`,
          recommendation: 'Block completion until evidence provided'
        });
      }

      // Add specific test output flag if no test evidence
      const hasTestEvidence = taskClaim?.claims.some(c =>
        c.toLowerCase().includes('test')
      ) ?? false;

      if (!hasTestEvidence) {
        flags.push({
          severity: 'CRITICAL',
          message: '🚨 NO TEST OUTPUT PROVIDED',
          evidence: 'No test results shown',
          recommendation: 'Run: npm test'
        });
      }
    }

    return flags;
  }

  /**
   * Generate error response from red flags
   */
  async generateErrorResponse(flags: RedFlag[]): Promise<ErrorResponse> {
    // Determine error code based on flag patterns
    let errorCode = 'UNKNOWN_ERROR';
    let exitCode = 1;

    const flagMessages = flags.map(f => f.message);
    const hasBlocker = flags.some(f => f.severity === 'BLOCKER');

    // Determine error code and exit code based on flag patterns
    if (flagMessages.some(m => m.includes('INSUFFICIENT PROGRESS TRACKING'))) {
      errorCode = 'NO_PROGRESS_TRACKING';
      exitCode = 2;
    } else if (flagMessages.some(m => m.includes('COMPLETION FORCED'))) {
      errorCode = 'FORCED_COMPLETION';
      exitCode = 3;
    } else if (flagMessages.some(m => m.includes('TASK TOOL RESPONSE IS MEANINGLESS'))) {
      errorCode = 'TASK_TOOL_DECEPTION';
      exitCode = 4;
    } else if (flagMessages.some(m =>
      m.includes('EVIDENCE SCORE FAILING') ||
      m.includes('NO TEST OUTPUT') ||
      m.includes('NO PROGRESS REPORTS FILED') ||
      m.includes('EVIDENCE SCORE:') && m.includes('FAILING'))) {
      errorCode = 'INSUFFICIENT_EVIDENCE';
      exitCode = 1;
    }

    // Calculate trust score based on evidence
    const progressCount = Array.from(this.progressReports.values()).reduce((a, b) => a + b, 0);
    const trustScore = progressCount === 0 ? 0 : Math.min(progressCount * 10, 50);

    // Generate verification commands
    const verificationCommands = [
      './tmp/issue-49/verify-all.sh',
      'grep -n "Task(subagent" src/core/ResponseEnhancer.ts',
      'npm test 2>&1 | grep -E "Tests:.*passed"'
    ];

    const response: ErrorResponse = {
      success: false,
      error_code: errorCode,
      error_severity: hasBlocker ? 'BLOCKER' : 'CRITICAL',
      exit_code: exitCode,
      red_flags: flagMessages,
      blocked: hasBlocker,
      trust_score: errorCode === 'NO_PROGRESS_TRACKING' ? 0 : trustScore,
      verification_commands: verificationCommands,
      verification_required: true,
      trust_warning: 'NEVER_TRUST_WITHOUT_EVIDENCE'
    };

    return response;
  }

  /**
   * Format error response for console output
   */
  formatErrorForConsole(response: ErrorResponse): string {
    let output = '\n';
    output += '╔══════════════════════════════════════════╗\n';
    output += '║     🚨🚨🚨 RED FLAG DETECTED 🚨🚨🚨     ║\n';
    output += '╚══════════════════════════════════════════╝\n\n';

    output += `ERROR CODE: ${response.error_code}\n`;
    output += `SEVERITY: ${response.error_severity}\n`;
    output += `EXIT CODE: ${response.exit_code}\n`;

    if (response.trust_score !== undefined) {
      output += `TRUST SCORE: ${response.trust_score}%\n`;
    }

    output += '\nRED FLAGS:\n';
    for (const flag of response.red_flags) {
      output += `  • ${flag}\n`;
    }

    if (response.verification_commands && response.verification_commands.length > 0) {
      output += '\nREQUIRED VERIFICATION:\n';
      for (const cmd of response.verification_commands) {
        output += `  $ ${cmd}\n`;
      }
    }

    if (response.blocked) {
      output += '\n⛔ COMPLETION BLOCKED - Evidence required\n';
    }

    output += '\n⛔ DO NOT PROCEED WITHOUT VERIFICATION\n';

    return output;
  }
}