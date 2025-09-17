/**
 * Validation utilities for the Agent Communication MCP Server
 */

import { InvalidTaskError, ServerConfig } from '../types.js';
import debug from 'debug';
import * as os from 'os';
import * as path from 'path';
import * as fs from './fs-extra-safe.js';


const log = debug('agent-comm:utils:validation');
const logAvailability = debug('agent-comm:utils:validation:availability');

// Initialize validation utilities
log('Validation utilities initialized');

/**
 * Validate required string parameter
 */
export function validateRequiredString(value: unknown, paramName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidTaskError(`${paramName} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validate optional string parameter
 */
export function validateOptionalString(value: unknown, paramName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new InvalidTaskError(`${paramName} must be a string`);
  }
  return value.trim() || undefined;
}

/**
 * Validate number parameter
 */
export function validateNumber(value: unknown, paramName: string, min?: number, max?: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new InvalidTaskError(`${paramName} must be a valid number`);
  }
  if (min !== undefined && value < min) {
    throw new InvalidTaskError(`${paramName} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new InvalidTaskError(`${paramName} must be at most ${max}`);
  }
  return value;
}

/**
 * Validate boolean parameter
 */
export function validateBoolean(value: unknown, paramName: string, defaultValue?: boolean): boolean {
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new InvalidTaskError(`${paramName} is required`);
  }
  if (typeof value !== 'boolean') {
    throw new InvalidTaskError(`${paramName} must be a boolean`);
  }
  return value;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: unknown, 
  paramName: string, 
  validValues: readonly T[]
): T {
  if (typeof value !== 'string') {
    throw new InvalidTaskError(`${paramName} must be a string`);
  }
  if (!validValues.includes(value as T)) {
    throw new InvalidTaskError(`${paramName} must be one of: ${validValues.join(', ')}`);
  }
  return value as T;
}

/**
 * Validate task file type
 */
export function validateTaskFileType(fileType: unknown): 'INIT' | 'PLAN' | 'DONE' | 'ERROR' {
  return validateEnum(fileType, 'file', ['INIT', 'PLAN', 'DONE', 'ERROR'] as const);
}

/**
 * Validate archive mode
 */
export function validateArchiveMode(mode: unknown): 'completed' | 'all' | 'by-agent' | 'by-date' {
  return validateEnum(mode, 'mode', ['completed', 'all', 'by-agent', 'by-date'] as const);
}

/**
 * Validate file name for security
 */
export function validateFileName(fileName: string): void {
  if (!fileName || fileName.trim().length === 0) {
    throw new InvalidTaskError('File name cannot be empty');
  }
  
  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new InvalidTaskError('File name cannot contain path traversal characters');
  }
  
  // Check for system files
  if (fileName.startsWith('.') && !['INIT.md', 'PLAN.md', 'DONE.md', 'ERROR.md'].includes(fileName)) {
    throw new InvalidTaskError('Invalid file name');
  }
  
  // Check file extension
  if (!fileName.endsWith('.md')) {
    throw new InvalidTaskError('File must have .md extension');
  }
}

/**
 * Validate directory name for security
 */
export function validateDirectoryName(dirName: string): void {
  if (!dirName || dirName.trim().length === 0) {
    throw new InvalidTaskError('Directory name cannot be empty');
  }
  
  // Check for path traversal attempts
  if (dirName.includes('..') || dirName.includes('/') || dirName.includes('\\')) {
    throw new InvalidTaskError('Directory name cannot contain path traversal characters');
  }
  
  // Check for system directories
  if (dirName.startsWith('.') && dirName !== '.archive') {
    throw new InvalidTaskError('Invalid directory name');
  }
}

/**
 * Validate content is not empty
 */
export function validateContent(content: string): void {
  if (!content || content.trim().length === 0) {
    throw new InvalidTaskError('Content cannot be empty');
  }
}

/**
 * Sanitize input string
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>:"/\\|?*]/g, '') // Remove Windows invalid filename chars
    .replace(/\0/g, '') // Remove null bytes
    .substring(0, 255); // Limit length
}

/**
 * Cache for validated agent names to improve performance
 */
const agentValidationCache = new Set<string>();

/**
 * Maximum allowed length for agent names
 */
const MAX_AGENT_NAME_LENGTH = 100;

/**
 * Validate and sanitize agent name with comprehensive security protection
 * Protects against path traversal, command injection, XSS, null bytes, and other attacks
 */
export function validateAgent(value: unknown, paramName: string): string {
  // Basic type and emptiness validation
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidTaskError(`${paramName} must be a non-empty string`);
  }

  const trimmedValue = value.trim();

  // Check cache for performance optimization
  if (agentValidationCache.has(trimmedValue)) {
    return trimmedValue;
  }

  // Length validation
  if (trimmedValue.length > MAX_AGENT_NAME_LENGTH) {
    throw new InvalidTaskError(`Invalid agent name: exceeds maximum length of ${MAX_AGENT_NAME_LENGTH} characters`);
  }

  // Path traversal protection
  if (trimmedValue.includes('..') || trimmedValue.includes('/') || trimmedValue.includes('\\')) {
    throw new InvalidTaskError('Invalid agent name: path traversal characters not allowed');
  }

  // Command injection protection
  const commandInjectionChars = [';', '|', '&', '`', '$', '(', ')', '{', '}'];
  for (const char of commandInjectionChars) {
    if (trimmedValue.includes(char)) {
      throw new InvalidTaskError('Invalid agent name: command injection characters not allowed');
    }
  }

  // Script injection protection (XSS, JavaScript, etc.)
  const scriptPatterns = [
    '<script',
    '</script>',
    'javascript:',
    'data:',
    '<img',
    'onerror=',
    'onload=',
    'onclick=',
    'onmouseover=',
    'alert(',
    'eval(',
    'document.',
    'window.'
  ];

  const lowerValue = trimmedValue.toLowerCase();
  for (const pattern of scriptPatterns) {
    if (lowerValue.includes(pattern.toLowerCase())) {
      throw new InvalidTaskError('Invalid agent name: script injection patterns not allowed');
    }
  }

  // Null byte and control character protection
  if (trimmedValue.includes('\0') || trimmedValue.includes('%00')) {
    throw new InvalidTaskError('Invalid agent name: null bytes not allowed');
  }

  // Control characters (newlines, tabs, etc.)
  if (/[\r\n\t\f\v]/.test(trimmedValue)) {
    throw new InvalidTaskError('Invalid agent name: control characters not allowed');
  }

  // SQL injection protection
  const sqlPatterns = [
    'drop table',
    'delete from',
    'insert into',
    'update set',
    'union select',
    '--',
    '/*',
    '*/',
    'xp_',
    'sp_'
  ];

  for (const pattern of sqlPatterns) {
    if (lowerValue.includes(pattern)) {
      throw new InvalidTaskError('Invalid agent name: SQL injection patterns not allowed');
    }
  }

  // URL encoding protection
  if (trimmedValue.includes('%') && /(%[0-9a-fA-F]{2})/.test(trimmedValue)) {
    throw new InvalidTaskError('Invalid agent name: URL encoded characters not allowed');
  }

  // Valid agent name pattern: alphanumeric, hyphens, underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedValue)) {
    throw new InvalidTaskError('Invalid agent name: only alphanumeric characters, hyphens, and underscores are allowed');
  }

  // Cache the validated agent name for performance
  agentValidationCache.add(trimmedValue);

  return trimmedValue;
}

/**
 * Validate required configuration components
 * Ensures connectionManager and eventLogger are present
 * Note: This validation is primarily for runtime safety when config might be malformed
 */
export function validateRequiredConfig(config: ServerConfig): void {
  // Runtime validation for required components
  // This handles test scenarios where these might be undefined
  // ESLint is disabled here because we need runtime validation for potentially malformed configs in tests
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  const hasConnectionManager = Object.prototype.hasOwnProperty.call(config, 'connectionManager') &&
                               config.connectionManager != null;
  const hasEventLogger = Object.prototype.hasOwnProperty.call(config, 'eventLogger') &&
                        config.eventLogger != null;
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  if (!hasConnectionManager || !hasEventLogger) {
    throw new Error('Configuration missing required components: connectionManager and eventLogger');
  }
}

// ===========================
// AGENT AVAILABILITY VALIDATION
// ===========================

/**
 * Interface for agent availability cache entries
 */
interface AgentCacheEntry {
  available: boolean;
  timestamp: number;
  source: 'user' | 'project' | 'static';
}

/**
 * Interface for agent discovery results
 */
interface AgentDiscoveryResult {
  agents: string[];
  sources: Record<string, 'user' | 'project' | 'static'>;
  lastScanned: number;
}

/**
 * Static registry of known Claude Code agents (fallback mechanism)
 */
const KNOWN_CLAUDE_CODE_AGENTS = [
  'senior-frontend-engineer',
  'senior-backend-engineer',
  'senior-system-architect',
  'devops-deployment-engineer',
  'senior-ai-ml-engineer',
  'senior-dba-advisor',
  'qa-test-automation-engineer',
  'security-analyst',
  'debug-investigator',
  'ux-ui-designer',
  'product-docs-manager',
  'product-manager',
  'product-owner-agile',
  'scrum-master-coach'
] as const;

/**
 * Cache for agent availability results with TTL (5 minutes)
 */
const agentAvailabilityCache = new Map<string, AgentCacheEntry>();

/**
 * Cache for complete agent discovery results with TTL (5 minutes)
 */
let agentDiscoveryCache: AgentDiscoveryResult | null = null;

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const AGENT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Clear all agent availability caches - used for testing
 * @internal
 */
export function clearAgentAvailabilityCache(): void {
  agentAvailabilityCache.clear();
  agentDiscoveryCache = null;
}

/**
 * Helper function to parse YAML frontmatter from markdown files
 * @param content - File content to parse
 * @returns Agent name if found, null otherwise
 */
function parseAgentNameFromYaml(content: string): string | null {
  logAvailability('Parsing YAML frontmatter for agent name');

  try {
    // Check if content starts with YAML frontmatter
    if (!content.startsWith('---')) {
      logAvailability('No YAML frontmatter found (does not start with ---)');
      return null;
    }

    // Find the end of YAML frontmatter
    const endIndex = content.indexOf('\n---', 3);
    if (endIndex === -1) {
      logAvailability('No YAML frontmatter end found');
      return null;
    }

    // Extract YAML content
    const yamlContent = content.substring(3, endIndex);
    logAvailability('Extracted YAML content: %s', yamlContent.substring(0, 100));

    // Simple YAML parsing for name field
    const nameMatch = yamlContent.match(/^name:\s*(.+)$/m);
    if (!nameMatch) {
      logAvailability('No name field found in YAML frontmatter');
      return null;
    }

    const agentName = nameMatch[1].trim();
    logAvailability('Found agent name in YAML: %s', agentName);
    return agentName;
  } catch (error) {
    logAvailability('Error parsing YAML frontmatter: %s', (error as Error).message);
    return null;
  }
}

/**
 * Helper function to scan directory for agent files
 * @param dirPath - Directory path to scan
 * @returns Array of agent names found
 */
async function scanDirectoryForAgents(dirPath: string): Promise<string[]> {
  logAvailability('Scanning directory for agents: %s', dirPath);
  const agents: string[] = [];

  try {
    const exists = await fs.pathExists(dirPath);
    if (!exists) {
      logAvailability('Directory does not exist: %s', dirPath);
      return agents;
    }

    const files = await fs.readdir(dirPath);
    logAvailability('Found %d files in directory %s', files.length, dirPath);

    for (const file of files) {
      if (!file.endsWith('.md')) {
        logAvailability('Skipping non-markdown file: %s', file);
        continue;
      }

      try {
        const filePath = path.join(dirPath, file);
        const content = await fs.readFile(filePath, 'utf8');
        const agentName = parseAgentNameFromYaml(content);

        if (agentName) {
          agents.push(agentName);
          logAvailability('Found agent %s in file %s', agentName, file);
        } else {
          logAvailability('No valid agent name found in file %s', file);
        }
      } catch (error) {
        logAvailability('Error reading file %s: %s', file, (error as Error).message);
        // Continue with other files
      }
    }

    logAvailability('Scan complete: found %d agents in %s', agents.length, dirPath);
    return agents;
  } catch (error) {
    logAvailability('Error scanning directory %s: %s', dirPath, (error as Error).message);
    return agents;
  }
}

/**
 * Helper function to check if cache entry is valid
 * @param entry - Cache entry to check
 * @returns True if cache entry is still valid
 */
function isCacheValid(entry: AgentCacheEntry): boolean {
  const now = Date.now();
  const isValid = (now - entry.timestamp) < AGENT_CACHE_TTL;
  logAvailability('Cache entry age: %dms, valid: %s', now - entry.timestamp, isValid);
  return isValid;
}

/**
 * Validates agent availability by scanning Claude Code agent directories
 *
 * This function performs filesystem scanning of both user-level (~/.claude/agents/)
 * and project-level (.claude/agents/) directories to verify that the specified
 * agent exists and is properly configured.
 *
 * **Performance Characteristics:**
 * - Target response time: <100ms including filesystem operations
 * - Implements TTL-based caching (5 minutes) for optimal performance
 * - Cache hit ratio target: >90% in typical usage patterns
 *
 * **Directory Scanning:**
 * - User directory: `~/.claude/agents/` (takes precedence)
 * - Project directory: `.claude/agents/` (fallback)
 * - File pattern: `*.md` files with YAML frontmatter
 * - YAML requirement: Must contain `name` field matching agent parameter
 *
 * **Error Handling:**
 * - Filesystem errors: Graceful degradation (returns false, logs warning)
 * - Permission errors: Silently handled, does not throw
 * - Malformed YAML: Skipped gracefully, continues scanning
 * - Missing directories: Handled gracefully, continues with fallback
 *
 * @param agent - Agent name to validate (must pass security validation first)
 * @returns Promise resolving to true if agent exists in filesystem, false otherwise
 *
 * @throws Never throws - all errors are handled gracefully
 *
 * @example
 * ```typescript
 * const isAvailable = await validateAgentAvailability('senior-backend-engineer');
 * if (isAvailable) {
 *   console.log('Agent found in filesystem');
 * } else {
 *   console.log('Agent not found, using fallback behavior');
 * }
 * ```
 *
 * @see {@link validateAgent} for security validation
 * @see {@link validateAgentWithAvailability} for combined security + availability validation
 * @see {@link getAvailableAgents} for complete agent discovery
 *
 * @since 1.0.0
 */
export async function validateAgentAvailability(agent: string): Promise<boolean> {
  logAvailability('Starting agent availability validation for: %s', agent);
  const startTime = Date.now();

  try {
    // Check cache first
    const cacheEntry = agentAvailabilityCache.get(agent);
    if (cacheEntry && isCacheValid(cacheEntry)) {
      logAvailability('Cache hit for agent %s (available: %s)', agent, cacheEntry.available);
      return cacheEntry.available;
    }

    logAvailability('Cache miss for agent %s, performing filesystem scan', agent);

    // Get user home directory
    const homeDir = os.homedir();
    const userAgentsDir = path.join(homeDir, '.claude', 'agents');
    const projectAgentsDir = path.join(process.cwd(), '.claude', 'agents');

    logAvailability('Scanning directories: user=%s, project=%s', userAgentsDir, projectAgentsDir);

    // Scan both directories
    const userAgents = await scanDirectoryForAgents(userAgentsDir);
    const projectAgents = await scanDirectoryForAgents(projectAgentsDir);

    // Check if agent is found in either directory
    const isAvailable = userAgents.includes(agent) || projectAgents.includes(agent);
    const source = userAgents.includes(agent) ? 'user' : projectAgents.includes(agent) ? 'project' : 'static';

    // Cache the result
    agentAvailabilityCache.set(agent, {
      available: isAvailable,
      timestamp: Date.now(),
      source: source as 'user' | 'project' | 'static'
    });

    const duration = Date.now() - startTime;
    logAvailability('Agent availability validation complete for %s in %dms: %s (source: %s)',
      agent, duration, isAvailable, source);

    return isAvailable;
  } catch (error) {
    const duration = Date.now() - startTime;
    logAvailability('Error during agent availability validation for %s after %dms: %s',
      agent, duration, (error as Error).message);

    // Cache negative result to avoid repeated errors
    agentAvailabilityCache.set(agent, {
      available: false,
      timestamp: Date.now(),
      source: 'static'
    });

    // Never throw - graceful degradation
    return false;
  }
}

/**
 * Gets complete list of available Claude Code agents
 *
 * This function performs comprehensive agent discovery by scanning both user-level
 * and project-level agent directories, parsing YAML frontmatter, and applying
 * proper precedence rules for agent resolution.
 *
 * **Discovery Process:**
 * 1. Scan user directory: `~/.claude/agents/` (highest precedence)
 * 2. Scan project directory: `.claude/agents/` (secondary precedence)
 * 3. Parse YAML frontmatter from `*.md` files
 * 4. Extract `name` field from frontmatter
 * 5. Apply precedence: user-level agents override project-level
 * 6. Fallback to static registry on filesystem errors
 *
 * **Precedence Rules:**
 * - User-level agents (`~/.claude/agents/`) take precedence over project-level
 * - Project-level agents (`.claude/agents/`) are included if not overridden
 * - Static registry provides fallback when filesystem scanning fails
 * - No duplicate agent names in returned array
 *
 * **Performance Optimization:**
 * - Results cached for 5 minutes (TTL-based caching)
 * - Filesystem operations optimized for minimal I/O
 * - Parallel directory scanning where possible
 * - Cache hit ratio target: >90% in typical usage
 *
 * **Error Handling:**
 * - Filesystem errors: Fallback to static registry with warning logs
 * - Permission errors: Graceful degradation, partial results returned
 * - Malformed YAML: Individual files skipped, scanning continues
 * - Missing name field: Files skipped silently
 *
 * @returns Promise resolving to array of available agent names
 *
 * @throws Never throws - all errors result in graceful fallback behavior
 *
 * @example
 * ```typescript
 * const agents = await getAvailableAgents();
 * console.log(`Found ${agents.length} available agents:`, agents);
 *
 * // Example output:
 * // Found 14 available agents: [
 * //   'senior-backend-engineer',
 * //   'senior-frontend-engineer',
 * //   'product-manager',
 * //   ...
 * // ]
 * ```
 *
 * @see {@link validateAgentAvailability} for single agent availability check
 * @see {@link validateAgentWithAvailability} for combined validation
 * @see {@link KNOWN_CLAUDE_CODE_AGENTS} for static registry content
 *
 * @since 1.0.0
 */
export async function getAvailableAgents(): Promise<string[]> {
  logAvailability('Starting agent discovery');
  const startTime = Date.now();

  try {
    // Check cache first
    if (agentDiscoveryCache && isCacheValid({
      available: true,
      timestamp: agentDiscoveryCache.lastScanned,
      source: 'user'
    })) {
      logAvailability('Cache hit for agent discovery, returning %d agents', agentDiscoveryCache.agents.length);
      return agentDiscoveryCache.agents;
    }

    logAvailability('Cache miss for agent discovery, performing full scan');

    // Get directories
    const homeDir = os.homedir();
    const userAgentsDir = path.join(homeDir, '.claude', 'agents');
    const projectAgentsDir = path.join(process.cwd(), '.claude', 'agents');

    // Scan both directories
    const userAgents = await scanDirectoryForAgents(userAgentsDir);
    const projectAgents = await scanDirectoryForAgents(projectAgentsDir);

    // Apply precedence: user agents override project agents
    const allAgents = new Set<string>();
    const sources: Record<string, 'user' | 'project' | 'static'> = {};

    // Add user agents first (highest precedence)
    for (const agent of userAgents) {
      allAgents.add(agent);
      sources[agent] = 'user';
    }

    // Add project agents if not already present
    for (const agent of projectAgents) {
      if (!allAgents.has(agent)) {
        allAgents.add(agent);
        sources[agent] = 'project';
      } else {
        logAvailability('User agent %s overrides project agent', agent);
      }
    }

    // Fallback to static registry if no agents found
    if (allAgents.size === 0) {
      logAvailability('No agents found in filesystem, using static registry');
      for (const agent of KNOWN_CLAUDE_CODE_AGENTS) {
        allAgents.add(agent);
        sources[agent] = 'static';
      }
    }

    const agentList = Array.from(allAgents).sort();

    // Cache the results
    agentDiscoveryCache = {
      agents: agentList,
      sources,
      lastScanned: Date.now()
    };

    const duration = Date.now() - startTime;
    logAvailability('Agent discovery complete in %dms: found %d agents', duration, agentList.length);
    logAvailability('Agents by source: user=%d, project=%d, static=%d',
      Object.values(sources).filter(s => s === 'user').length,
      Object.values(sources).filter(s => s === 'project').length,
      Object.values(sources).filter(s => s === 'static').length
    );

    return agentList;
  } catch (error) {
    const duration = Date.now() - startTime;
    logAvailability('Error during agent discovery after %dms: %s', duration, (error as Error).message);

    // Fallback to static registry
    logAvailability('Falling back to static registry due to error');
    const staticAgents = Array.from(KNOWN_CLAUDE_CODE_AGENTS);

    // Cache fallback result
    agentDiscoveryCache = {
      agents: staticAgents,
      sources: Object.fromEntries(staticAgents.map(agent => [agent, 'static' as const])),
      lastScanned: Date.now()
    };

    return staticAgents;
  }
}

/**
 * Enhanced validation combining security and availability checks
 *
 * This function performs two-stage validation: security validation first (mandatory),
 * followed by availability validation (advisory). Security failures always throw
 * exceptions, while availability failures result in warnings but allow operation
 * to continue.
 *
 * **Two-Stage Validation Process:**
 * 1. **Security Validation (Mandatory)**: Uses existing `validateAgent()` function
 *    - Path traversal protection
 *    - Command injection protection
 *    - Script injection protection
 *    - Null byte and control character protection
 *    - SQL injection protection
 *    - Caching for performance (existing cache reused)
 *
 * 2. **Availability Validation (Advisory)**: Uses `validateAgentAvailability()`
 *    - Filesystem scanning for agent existence
 *    - YAML frontmatter parsing
 *    - Graceful error handling
 *    - Performance caching
 *
 * **Security-First Design:**
 * - Security validation NEVER bypassed for any reason
 * - Availability validation NEVER overrides security failures
 * - Malicious agent names fail immediately without availability check
 * - All security caching mechanisms preserved and utilized
 *
 * **Performance Characteristics:**
 * - Target response time: <100ms for complete two-stage validation
 * - Leverages existing security validation cache
 * - Utilizes availability validation cache
 * - Cache hit scenarios complete in <10ms
 *
 * **Error Handling Strategy:**
 * - Security errors: Always throw `InvalidTaskError` (fail fast)
 * - Availability errors: Log warning, return validated name (graceful)
 * - Filesystem errors: Log warning, continue with validated name
 * - Cache errors: Bypass cache, perform validation
 *
 * @param agent - Agent name to validate through both security and availability checks
 * @returns Promise resolving to validated agent name if security passes
 *
 * @throws {InvalidTaskError} If security validation fails (availability not checked)
 * @throws Never throws for availability failures - warnings logged instead
 *
 * @example
 * ```typescript
 * // Successful validation (secure + available)
 * const validAgent = await validateAgentWithAvailability('senior-backend-engineer');
 * console.log(`Validated agent: ${validAgent}`);
 *
 * // Security failure (immediate throw, no availability check)
 * try {
 *   await validateAgentWithAvailability('../../../etc/passwd');
 * } catch (error) {
 *   console.error('Security validation failed:', error.message);
 * }
 *
 * // Secure but unavailable (warning logged, operation continues)
 * const unknownAgent = await validateAgentWithAvailability('unknown-but-secure-agent');
 * console.log(`Using unknown agent: ${unknownAgent}`); // Warning logged internally
 * ```
 *
 * @see {@link validateAgent} for security validation details
 * @see {@link validateAgentAvailability} for availability validation details
 * @see {@link getAvailableAgents} for complete agent discovery
 *
 * @since 1.0.0
 */
export async function validateAgentWithAvailability(agent: string): Promise<string> {
  logAvailability('Starting two-stage validation (security + availability) for: %s', agent);
  const startTime = Date.now();

  try {
    // Stage 1: Security validation (MANDATORY - never bypassed)
    logAvailability('Stage 1: Security validation for %s', agent);
    const securityStartTime = Date.now();

    // This will throw InvalidTaskError if security validation fails
    const validatedAgent = validateAgent(agent, 'agent');

    const securityDuration = Date.now() - securityStartTime;
    logAvailability('Security validation passed for %s in %dms', agent, securityDuration);

    // Stage 2: Availability validation (ADVISORY - warnings only)
    logAvailability('Stage 2: Availability validation for %s', agent);
    const availabilityStartTime = Date.now();

    const isAvailable = await validateAgentAvailability(agent);

    const availabilityDuration = Date.now() - availabilityStartTime;
    const totalDuration = Date.now() - startTime;

    if (isAvailable) {
      logAvailability('Two-stage validation PASSED for %s in %dms (security: %dms, availability: %dms)',
        agent, totalDuration, securityDuration, availabilityDuration);
    } else {
      logAvailability('Two-stage validation: security PASSED, availability WARNING for %s in %dms (security: %dms, availability: %dms)',
        agent, totalDuration, securityDuration, availabilityDuration);

      // Log warning but do not throw - availability is advisory only
      log('Warning: Agent %s passed security validation but was not found in filesystem. Using agent name as provided.', agent);
    }

    return validatedAgent;
  } catch (error) {
    const totalDuration = Date.now() - startTime;

    // Security validation failures are always thrown
    if (error instanceof InvalidTaskError) {
      logAvailability('Two-stage validation FAILED at security stage for %s in %dms: %s',
        agent, totalDuration, error.message);
      throw error;
    }

    // Other errors during availability check are logged but not thrown
    logAvailability('Two-stage validation: security PASSED, availability ERROR for %s in %dms: %s',
      agent, totalDuration, (error as Error).message);

    log('Warning: Error during availability validation for %s: %s. Proceeding with security-validated agent.',
      agent, (error as Error).message);

    // Return security-validated agent even if availability check failed
    return validateAgent(agent, 'agent');
  }
}