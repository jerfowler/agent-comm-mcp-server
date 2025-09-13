/**
 * Sync Todo Checkboxes tool - TodoWrite integration for automatic checkbox updates
 * Accepts todo updates from Claude Code hooks and syncs them to PLAN.md checkboxes
 */

import { ServerConfig } from '../types.js';
import { validateRequiredString } from '../utils/validation.js';
import { AgentCommError } from '../types.js';
import { LockManager } from '../utils/lock-manager.js';
import { pathExists, readFile, writeFile } from '../utils/file-system.js';
import { readdir, stat } from '../utils/fs-extra-safe.js';
import * as path from 'path';

interface TodoUpdate {
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// Note: SyncTodoCheckboxesArgs interface moved inline to function parameter for better type safety

interface SyncTodoCheckboxesResult {
  success: boolean;
  matchedUpdates: number;
  totalUpdates: number;
  unmatchedTodos: string[];
  updatedCheckboxes: string[];
  message: string;
}

/**
 * Calculate fuzzy match score between two strings (0-1, higher is better)
 * Enhanced algorithm optimized for todo-to-checkbox matching
 */
function fuzzyMatchScore(str1: string, str2: string): number {
  // Normalize strings: lowercase, remove special chars, trim whitespace
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);
  
  // Exact match gets perfect score
  if (norm1 === norm2) return 1.0;
  
  // Empty strings get no score
  if (!norm1 || !norm2) return 0.0;
  
  // Split into words for analysis
  const words1 = norm1.split(' ').filter(w => w.length > 0);
  const words2 = norm2.split(' ').filter(w => w.length > 0);
  
  // Calculate exact word matches
  const commonWords = words1.filter(w => words2.includes(w)).length;
  
  // Calculate semantic similarity based on concept matching
  let semanticScore = 0;
  
  // Major boost for any exact word matches, but penalize very short queries
  if (commonWords > 0) {
    let baseSemanticScore = Math.max(0.4, commonWords / Math.min(words1.length, words2.length));
    
    // Penalize very short queries that match much longer texts
    const minWords = Math.min(words1.length, words2.length);
    const maxWords = Math.max(words1.length, words2.length);
    
    // If query is very short (1 word) and target is much longer (3+ words), reduce score significantly
    if (minWords === 1 && maxWords >= 3) {
      baseSemanticScore *= 0.3; // Heavily penalize very short queries against long texts
    }
    
    semanticScore = baseSemanticScore;
  }
  
  // Enhanced abbreviation and partial word matching
  let abbreviationScore = 0;
  
  // Only proceed with abbreviation matching if we have reasonable word coverage
  // Avoid matching very short queries against long texts
  const minWords = Math.min(words1.length, words2.length);
  const maxWords = Math.max(words1.length, words2.length);
  const wordLengthRatio = minWords / maxWords;
  
  // Skip abbreviation matching for cases like "API" vs "Build API Endpoints" (1/3 ratio)
  if (wordLengthRatio >= 0.4 || commonWords > 0) {
    for (const word1 of words1) {
      for (const word2 of words2) {
        const shorter = word1.length < word2.length ? word1 : word2;
        const longer = word1.length < word2.length ? word2 : word1;
        
        // Perfect match already counted above
        if (word1 === word2) continue;
        
        // Check for abbreviation patterns with stricter requirements
        if (shorter.length >= 3 && longer.length >= 4) {
          // Prefix match (e.g., "auth" -> "authentication")
          if (longer.startsWith(shorter)) {
            abbreviationScore = Math.max(abbreviationScore, 0.6);
          }
          // Contains match with significant overlap
          else if (longer.includes(shorter) && shorter.length >= 4) {
            abbreviationScore = Math.max(abbreviationScore, 0.4);
          }
        }
        // Special case for 2-letter abbreviations only if very close match
        else if (shorter.length === 2 && longer.length >= 4) {
          if (longer.startsWith(shorter)) {
            const commonPrefix = longer.substring(0, shorter.length);
            if (levenshteinDistance(shorter, commonPrefix) === 0) {
              abbreviationScore = Math.max(abbreviationScore, 0.5);
            }
          }
        }
      }
    }
  }
  
  // Substring bonus for complete phrase matches
  let substringScore = 0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    substringScore = 0.3;
  }
  
  // Character similarity as baseline
  const maxLength = Math.max(norm1.length, norm2.length);
  const distance = levenshteinDistance(norm1, norm2);
  const charSimilarity = 1 - (distance / maxLength);
  
  // Combine scores with appropriate weighting for todo matching
  // Boost semantic matches and abbreviations to reach 60% threshold for reasonable matches
  const finalScore = Math.min(1.0, Math.max(
    semanticScore >= 0.4 ? Math.min(0.75, semanticScore + 0.15) : semanticScore * 0.7,  // Boost good semantic matches
    abbreviationScore >= 0.5 ? Math.min(0.85, abbreviationScore + 0.25) : abbreviationScore * 0.8, // Boost abbreviations
    (charSimilarity * 0.4 + substringScore * 0.6), // Character + substring fallback
    charSimilarity * 0.3                    // Minimum baseline from character similarity
  ));
  
  return finalScore;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  for (let j = 0; j <= str2.length; j++) {
    matrix[j] = new Array<number>(str1.length + 1).fill(0);
  }
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Find best matching checkbox for a todo title
 */
function findBestCheckboxMatch(todoTitle: string, checkboxTitles: string[]): { title: string; score: number } | null {
  let bestMatch: { title: string; score: number } | null = null;
  let bestScore = 0;
  
  for (const checkboxTitle of checkboxTitles) {
    const score = fuzzyMatchScore(todoTitle, checkboxTitle);
    if (score > bestScore && score >= 0.6) { // Minimum 60% similarity threshold
      bestScore = score;
      bestMatch = { title: checkboxTitle, score };
    }
  }
  
  return bestMatch;
}

/**
 * Extract checkbox titles from plan content
 * Updated to support three-state checkboxes: [ ], [~], [x]
 */
function extractCheckboxTitles(planContent: string): string[] {
  const checkboxRegex = /^- \[[ ~x]\] \*\*([^:*]+)\*\*/gm;
  const titles: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = checkboxRegex.exec(planContent)) !== null) {
    const title = match[1];
    if (title) {
      titles.push(title.trim());
    }
  }
  
  return titles;
}

/**
 * Update checkbox status in plan content
 * Updated to support three-state checkboxes: pending, in_progress, completed
 */
function updateCheckboxInPlan(planContent: string, checkboxTitle: string, newStatus: 'pending' | 'in_progress' | 'completed'): string {
  const lines = planContent.split('\n');
  let checkbox: string;
  
  switch (newStatus) {
    case 'pending':
      checkbox = '[ ]';
      break;
    case 'in_progress':
      checkbox = '[~]';
      break;
    case 'completed':
      checkbox = '[x]';
      break;
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const checkboxMatch = line.match(/^- \[[ ~x]\] \*\*([^:*]+)\*\*/);
    
    if (checkboxMatch && checkboxMatch[1].trim() === checkboxTitle) {
      lines[i] = line.replace(/^- \[[ ~x]\]/, `- ${checkbox}`);
      break;
    }
  }
  
  return lines.join('\n');
}

/**
 * Sync TodoWrite updates to PLAN.md checkboxes
 */
export async function syncTodoCheckboxes(
  config: ServerConfig,
  args: Record<string, unknown>
): Promise<SyncTodoCheckboxesResult> {
  const agent = validateRequiredString(args['agent'], 'agent');
  const todoUpdatesArray = args['todoUpdates'];
  
  // Optional taskId parameter for targeting specific tasks
  const taskId = args['taskId'] as string | undefined;
  if (taskId !== undefined && (typeof taskId !== 'string' || taskId.trim() === '')) {
    throw new AgentCommError('taskId must be a string', 'INVALID_INPUT');
  }
  
  if (!Array.isArray(todoUpdatesArray)) {
    throw new AgentCommError('todoUpdates must be an array', 'INVALID_INPUT');
  }
  
  // Validate todo updates
  const todoUpdates: TodoUpdate[] = todoUpdatesArray.map((update, index) => {
    if (typeof update !== 'object' || update === null) {
      throw new AgentCommError(`Todo update at index ${index} must be an object`, 'INVALID_INPUT');
    }
    
    const updateObj = update as Record<string, unknown>;
    const title = updateObj['title'];
    const status = updateObj['status'];
    
    if (typeof title !== 'string' || title.trim() === '') {
      throw new AgentCommError(`Todo update at index ${index}: title must be a non-empty string`, 'INVALID_INPUT');
    }
    
    if (typeof status !== 'string' || !['pending', 'in_progress', 'completed'].includes(status)) {
      throw new AgentCommError(`Todo update at index ${index}: status must be one of pending, in_progress, completed`, 'INVALID_INPUT');
    }
    
    return {
      title: title.trim(),
      status: status as 'pending' | 'in_progress' | 'completed'
    };
  });
  
  if (todoUpdates.length === 0) {
    return {
      success: true,
      matchedUpdates: 0,
      totalUpdates: 0,
      unmatchedTodos: [],
      updatedCheckboxes: [],
      message: 'No todo updates to process'
    };
  }
  
  // Find the target task for this agent
  const agentDir = path.join(config.commDir, agent);
  if (!await pathExists(agentDir)) {
    throw new AgentCommError(`Agent directory not found: ${agent}`, 'AGENT_NOT_FOUND');
  }
  
  let targetTaskDir: string | null = null;
  
  if (taskId) {
    // Use specific task if taskId provided
    const taskPath = path.join(agentDir, taskId);
    if (!await pathExists(taskPath)) {
      return {
        success: false,
        matchedUpdates: 0,
        totalUpdates: todoUpdates.length,
        unmatchedTodos: todoUpdates.map(u => u.title),
        updatedCheckboxes: [],
        message: `Task not found: ${taskId}`
      };
    }
    
    // Check if task is active (for completed/error tasks, we still allow sync but warn)
    const doneExists = await pathExists(path.join(taskPath, 'DONE.md'));
    const errorExists = await pathExists(path.join(taskPath, 'ERROR.md'));
    
    if (doneExists || errorExists) {
      return {
        success: false,
        matchedUpdates: 0,
        totalUpdates: todoUpdates.length,
        unmatchedTodos: todoUpdates.map(u => u.title),
        updatedCheckboxes: [],
        message: `Task ${taskId} is inactive (completed or error)`
      };
    }
    
    targetTaskDir = taskId;
  } else {
    // Find first active task (backward compatibility)
    const taskDirs = await readdir(agentDir);
    
    for (const taskDir of taskDirs) {
      const taskPath = path.join(agentDir, taskDir);
      try {
        const statResult = await stat(taskPath);
        
        // Check if it's a directory using either method or stat mode
        const isDirectory = typeof statResult.isDirectory === 'function' 
          ? statResult.isDirectory() 
          : statResult.mode ? (statResult.mode & 0o170000) === 0o040000 : false;
        
        if (isDirectory) {
          const doneExists = await pathExists(path.join(taskPath, 'DONE.md'));
          const errorExists = await pathExists(path.join(taskPath, 'ERROR.md'));
          
          if (!doneExists && !errorExists) {
            targetTaskDir = taskDir;
            break;
          }
        }
      } catch (error) {
        // Skip if we can't stat the path
        continue;
      }
    }
  }
  
  if (!targetTaskDir) {
    return {
      success: false,
      matchedUpdates: 0,
      totalUpdates: todoUpdates.length,
      unmatchedTodos: todoUpdates.map(u => u.title),
      updatedCheckboxes: [],
      message: `No active task found for agent ${agent}`
    };
  }

  // Lock coordination - check for and acquire lock on task directory
  const lockManager = new LockManager();
  const taskPath = path.join(agentDir, targetTaskDir);
  
  // Check if task is locked by another process
  const lockStatus = await lockManager.checkLock(taskPath);
  if (lockStatus.isLocked && !lockStatus.isStale) {
    throw new AgentCommError(
      `Task is currently locked by ${lockStatus.lockInfo?.tool} (PID: ${lockStatus.lockInfo?.pid}, Lock ID: ${lockStatus.lockInfo?.lockId})`,
      'TASK_LOCKED'
    );
  }
  
  // Acquire lock for this operation
  const lockResult = await lockManager.acquireLock(taskPath, 'sync-todo-checkboxes');
  if (!lockResult.acquired) {
    throw new AgentCommError(
      `Failed to acquire lock: ${lockResult.reason}`,
      'LOCK_FAILED'
    );
  }
  
  try {
    // Read the PLAN.md file
    const planPath = path.join(agentDir, targetTaskDir, 'PLAN.md');
    if (!await pathExists(planPath)) {
      return {
        success: false,
        matchedUpdates: 0,
        totalUpdates: todoUpdates.length,
        unmatchedTodos: todoUpdates.map(u => u.title),
        updatedCheckboxes: [],
        message: `PLAN.md not found for task ${targetTaskDir}`
      };
    }
  
    let planContent = await readFile(planPath);
    const checkboxTitles = extractCheckboxTitles(planContent);
    
    if (checkboxTitles.length === 0) {
      return {
        success: false,
        matchedUpdates: 0,
        totalUpdates: todoUpdates.length,
        unmatchedTodos: todoUpdates.map(u => u.title),
        updatedCheckboxes: [],
        message: 'No checkboxes found in PLAN.md'
      };
    }
    
    // Process each todo update
    const unmatchedTodos: string[] = [];
    const updatedCheckboxes: string[] = [];
    let matchedUpdates = 0;
    
    for (const todoUpdate of todoUpdates) {
      const match = findBestCheckboxMatch(todoUpdate.title, checkboxTitles);
      
      if (match) {
        // Update checkbox status with full three-state support
        planContent = updateCheckboxInPlan(planContent, match.title, todoUpdate.status);
        updatedCheckboxes.push(`${match.title} (${todoUpdate.status})`);
        matchedUpdates++;
      } else {
        unmatchedTodos.push(todoUpdate.title);
      }
    }
    
    // Write back the updated plan if changes were made
    if (matchedUpdates > 0) {
      await writeFile(planPath, planContent);
    }
    
    return {
      success: matchedUpdates > 0,
      matchedUpdates,
      totalUpdates: todoUpdates.length,
      unmatchedTodos,
      updatedCheckboxes,
      message: matchedUpdates > 0 
        ? `Successfully updated ${matchedUpdates}/${todoUpdates.length} checkboxes in ${targetTaskDir}` 
        : `No matching checkboxes found for any of ${todoUpdates.length} todo updates`
    };
  } finally {
    // Always release the lock, even if an error occurred
    if (lockResult.lockId) {
      await lockManager.releaseLock(taskPath, lockResult.lockId);
    }
  }
}