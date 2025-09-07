/**
 * Agent Work Verifier - Prevents false success reporting
 * 
 * This module implements mandatory verification gates to prevent agents from
 * claiming work completion without actual evidence. Based on Issue #11.
 * 
 * Key features:
 * - File system evidence checking (git status, file timestamps)
 * - MCP progress tracking validation
 * - Test execution verification
 * - Confidence scoring with configurable thresholds
 * - Enhanced user feedback with specific warnings
 */

import { ServerConfig } from '../types.js';
import * as fs from '../utils/file-system.js';
import * as path from 'path';

export interface VerificationResult {
  success: boolean;
  confidence: number;
  warnings: string[];
  evidence: {
    filesModified: number;
    testsRun: boolean;
    mcpProgress: boolean;
    timeSpent: number;
  };
  recommendation: string;
}

interface FileSystemEvidence {
  planFileExists: boolean;
  doneFileExists: boolean;
  fileModificationCount: number;
  recentFileActivity: boolean;
}

interface MCPProgressEvidence {
  progressFileExists: boolean;
  hasProgressUpdates: boolean;
  completionPercentage: number;
}

interface TimeTrackingEvidence {
  timeSpentMinutes: number;
  hasTimeTracking: boolean;
}

/**
 * Default confidence threshold for DONE completion
 * Tasks with confidence below this level will be rejected
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 70;

/**
 * Verify agent work claims against actual system evidence
 * 
 * This is the main entry point for the verification gate system.
 * It analyzes multiple evidence sources to determine if claimed work actually occurred.
 */
export async function verifyAgentWork(
  config: ServerConfig,
  agent: string,
  taskId?: string
): Promise<VerificationResult> {
  try {
    // Find the active task if taskId not provided
    const activeTaskPath = await findActiveTaskPath(config, agent, taskId);
    
    if (!activeTaskPath) {
      return {
        success: false,
        confidence: 0,
        warnings: ['No active task found for agent'],
        evidence: {
          filesModified: 0,
          testsRun: false,
          mcpProgress: false,
          timeSpent: 0
        },
        recommendation: 'Cannot verify work - no task context available'
      };
    }

    // Collect evidence from multiple sources
    const fileSystemEvidence = await collectFileSystemEvidence(activeTaskPath);
    const mcpProgressEvidence = await collectMCPProgressEvidence(activeTaskPath);
    const timeTrackingEvidence = await collectTimeTrackingEvidence(activeTaskPath);

    // Calculate confidence score
    const confidence = calculateConfidenceScore(
      fileSystemEvidence,
      mcpProgressEvidence,
      timeTrackingEvidence
    );

    // Generate warnings for missing evidence
    const warnings = generateWarnings(
      fileSystemEvidence,
      mcpProgressEvidence,
      timeTrackingEvidence
    );

    // Create evidence summary
    const evidence = {
      filesModified: fileSystemEvidence.fileModificationCount,
      testsRun: false, // TODO: Implement test execution detection
      mcpProgress: mcpProgressEvidence.hasProgressUpdates,
      timeSpent: timeTrackingEvidence.timeSpentMinutes * 60 // Convert to seconds
    };

    // Generate recommendation
    const recommendation = generateRecommendation(confidence, warnings);

    return {
      success: confidence >= DEFAULT_CONFIDENCE_THRESHOLD,
      confidence: Math.round(confidence),
      warnings,
      evidence,
      recommendation
    };

  } catch (error) {
    throw new Error(`Verification system error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Find the path to the active task for an agent
 */
async function findActiveTaskPath(
  config: ServerConfig,
  agent: string,
  taskId?: string
): Promise<string | null> {
  const agentDir = path.join(config.commDir, agent);
  
  if (!await fs.pathExists(agentDir)) {
    return null;
  }

  if (taskId) {
    const taskPath = path.join(agentDir, taskId);
    return await fs.pathExists(taskPath) ? taskPath : null;
  }

  // Find the most recent active task (no DONE.md or ERROR.md)
  const taskDirs = await fs.listDirectory(agentDir);
  let latestTime = 0;
  let activeTaskPath = null;

  for (const taskDir of taskDirs) {
    const taskPath = path.join(agentDir, taskDir);
    const stat = await fs.getStats(taskPath);
    
    if (stat.isDirectory()) {
      const doneExists = await fs.pathExists(path.join(taskPath, 'DONE.md'));
      const errorExists = await fs.pathExists(path.join(taskPath, 'ERROR.md'));
      
      if (!doneExists && !errorExists && stat.mtime && stat.mtime.getTime() > latestTime) {
        latestTime = stat.mtime.getTime();
        activeTaskPath = taskPath;
      }
    }
  }

  return activeTaskPath;
}

/**
 * Collect evidence from file system changes
 */
async function collectFileSystemEvidence(taskPath: string): Promise<FileSystemEvidence> {
  const planPath = path.join(taskPath, 'PLAN.md');
  const donePath = path.join(taskPath, 'DONE.md');

  const planFileExists = await fs.pathExists(planPath);
  const doneFileExists = await fs.pathExists(donePath);

  // Count files that appear to be recently modified
  let fileModificationCount = 0;
  let recentFileActivity = false;

  try {
    const files = await fs.listDirectory(taskPath);
    const recentTime = Date.now() - (60 * 60 * 1000); // 1 hour ago

    for (const file of files) {
      const filePath = path.join(taskPath, file);
      const stat = await fs.getStats(filePath);
      
      if (stat.mtime && stat.mtime.getTime() > recentTime) {
        fileModificationCount++;
        recentFileActivity = true;
      }
    }
  } catch (error) {
    // If we can't read directory, assume no recent activity
  }

  return {
    planFileExists,
    doneFileExists,
    fileModificationCount,
    recentFileActivity
  };
}

/**
 * Collect evidence from MCP progress tracking
 */
async function collectMCPProgressEvidence(taskPath: string): Promise<MCPProgressEvidence> {
  const planPath = path.join(taskPath, 'PLAN.md');
  
  let progressFileExists = false;
  let hasProgressUpdates = false;
  let completionPercentage = 0;

  try {
    if (await fs.pathExists(planPath)) {
      progressFileExists = true;
      const planContent = await fs.readFile(planPath);
      
      // Check for progress markers in the plan
      const checkedItems = (planContent.match(/^\s*-\s*\[x\]/gmi) || []).length;
      const totalItems = (planContent.match(/^\s*-\s*\[[x\s]\]/gmi) || []).length;
      
      if (totalItems > 0) {
        completionPercentage = (checkedItems / totalItems) * 100;
        hasProgressUpdates = checkedItems > 0;
      }
    }
  } catch (error) {
    // If we can't read the plan file, assume no progress
  }

  return {
    progressFileExists,
    hasProgressUpdates,
    completionPercentage
  };
}

/**
 * Collect evidence from time tracking
 */
async function collectTimeTrackingEvidence(taskPath: string): Promise<TimeTrackingEvidence> {
  // For now, estimate time based on file timestamps
  let timeSpentMinutes = 0;
  let hasTimeTracking = false;

  try {
    const files = await fs.listDirectory(taskPath);
    if (files.length > 0) {
      const stats = await Promise.all(
        files.map(file => fs.getStats(path.join(taskPath, file)))
      );
      
      const timestamps = stats
        .map(stat => stat.mtime?.getTime())
        .filter((timestamp): timestamp is number => timestamp !== undefined)
        .sort();

      if (timestamps.length >= 2) {
        const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
        timeSpentMinutes = Math.min(timeSpan / (1000 * 60), 180); // Cap at 3 hours
        hasTimeTracking = true;
      }
    }
  } catch (error) {
    // If we can't calculate time, assume no tracking
  }

  return {
    timeSpentMinutes,
    hasTimeTracking
  };
}

/**
 * Calculate confidence score based on evidence
 * 
 * Scoring breakdown:
 * - Plan file exists: 20 points
 * - Progress updates: 30 points  
 * - File modifications: 25 points
 * - Time tracking: 15 points
 * - Recent activity: 10 points
 * 
 * Total possible: 100 points
 */
function calculateConfidenceScore(
  fileSystemEvidence: FileSystemEvidence,
  mcpProgressEvidence: MCPProgressEvidence,
  timeTrackingEvidence: TimeTrackingEvidence
): number {
  let score = 0;

  // Plan file existence (20 points)
  if (fileSystemEvidence.planFileExists) {
    score += 20;
  }

  // Progress updates (30 points)
  if (mcpProgressEvidence.hasProgressUpdates) {
    score += 20;
    
    // Bonus points for completion percentage
    score += Math.min(mcpProgressEvidence.completionPercentage / 10, 10);
  }

  // File modifications (25 points)
  if (fileSystemEvidence.fileModificationCount > 0) {
    score += 15;
    
    // Bonus points for multiple modifications
    score += Math.min(fileSystemEvidence.fileModificationCount * 2, 10);
  }

  // Time tracking (15 points)
  if (timeTrackingEvidence.hasTimeTracking) {
    score += 10;
    
    // Bonus points for reasonable time spent
    if (timeTrackingEvidence.timeSpentMinutes >= 5) {
      score += 5;
    }
  }

  // Recent activity (10 points)
  if (fileSystemEvidence.recentFileActivity) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Generate specific warnings for missing evidence
 */
function generateWarnings(
  fileSystemEvidence: FileSystemEvidence,
  mcpProgressEvidence: MCPProgressEvidence,
  timeTrackingEvidence: TimeTrackingEvidence
): string[] {
  const warnings: string[] = [];

  if (!fileSystemEvidence.planFileExists) {
    warnings.push('No PLAN.md found - progress tracking missing');
  }

  if (!mcpProgressEvidence.hasProgressUpdates) {
    warnings.push('No progress updates recorded - use report_progress tool');
  }

  if (fileSystemEvidence.fileModificationCount === 0) {
    warnings.push('No file modifications detected - no actual work evidence');
  }

  if (!timeTrackingEvidence.hasTimeTracking) {
    warnings.push('No time tracking evidence - task completion appears instant');
  }

  if (!fileSystemEvidence.recentFileActivity) {
    warnings.push('No recent file activity detected');
  }

  return warnings;
}

/**
 * Generate actionable recommendation based on verification results
 */
function generateRecommendation(confidence: number, warnings: string[]): string {
  if (confidence >= DEFAULT_CONFIDENCE_THRESHOLD) {
    return 'Work verified successfully with sufficient evidence';
  }

  if (confidence < 30) {
    return 'Cannot complete with DONE status. Use ERROR status or provide evidence.';
  }

  if (warnings.some(warning => warning.includes('No progress updates recorded'))) {
    return 'Use report_progress tool to document actual work before marking DONE';
  }

  if (warnings.includes('No file modifications detected')) {
    return 'Provide evidence of actual file changes or code modifications';
  }

  return 'Insufficient evidence for DONE completion - address verification warnings above';
}