#!/usr/bin/env node

/**
 * TodoWrite Integration Verification Script
 * 
 * This script verifies that all components of the TodoWrite integration are properly configured:
 * 1. PostToolUse hook exists and is executable
 * 2. Hook configuration exists in Claude settings
 * 3. MCP server has correct environment variables
 * 4. sync_todo_checkboxes tool is available
 * 5. Protocol documentation is complete
 * 
 * Usage: node scripts/verify-todowrite-integration.js
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const HOOK_PATH = '.claude/hooks/sync-todos-to-checkboxes.py';
const SETTINGS_PATH = '.claude/settings.local.json';
const MCP_CONFIG_PATH = '.mcp.json';
const DOCUMENTATION_FILES = [
  'docs/PROTOCOL.md',
  'docs/TODOWRITE-INTEGRATION.md',
  'README.md'
];

class VerificationError extends Error {
  constructor(message, fix) {
    super(message);
    this.name = 'VerificationError';
    this.fix = fix;
  }
}

class TodoWriteVerifier {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    if (type === 'error') {
      this.errors.push(message);
    } else if (type === 'warning') {
      this.warnings.push(message);
    } else if (type === 'success') {
      this.results.push(message);
    }
  }

  async checkFileExists(filePath, description) {
    this.log(`Checking ${description}...`);
    
    if (await fs.pathExists(filePath)) {
      this.log(`${description} exists at ${filePath}`, 'success');
      return true;
    } else {
      throw new VerificationError(
        `${description} not found at ${filePath}`,
        `Create the file: ${filePath}`
      );
    }
  }

  async checkHookFile() {
    this.log('=== Hook File Verification ===');
    
    // Check existence
    await this.checkFileExists(HOOK_PATH, 'PostToolUse hook');
    
    // Check executable permissions
    try {
      const stats = await fs.stat(HOOK_PATH);
      const isExecutable = stats.mode & parseInt('111', 8);
      
      if (isExecutable) {
        this.log('Hook file is executable', 'success');
      } else {
        this.log('Hook file is not executable', 'warning');
        this.log('Fix: chmod +x ' + HOOK_PATH, 'info');
      }
    } catch (error) {
      throw new VerificationError('Cannot check hook file permissions', 'chmod +x ' + HOOK_PATH);
    }
    
    // Check hook content
    const hookContent = await fs.readFile(HOOK_PATH, 'utf8');
    
    // Verify essential components
    const requiredElements = [
      { pattern: /#!/, name: 'Shebang line' },
      { pattern: /import json/, name: 'JSON import' },
      { pattern: /import sys/, name: 'Sys import' },
      { pattern: /TodoWrite/, name: 'TodoWrite detection' },
      { pattern: /sys\.exit\(2\)/, name: 'Exit code 2 signal' },
      { pattern: /agent-comm MCP/, name: 'MCP reference in message' }
    ];
    
    for (const element of requiredElements) {
      if (element.pattern.test(hookContent)) {
        this.log(`Hook contains ${element.name}`, 'success');
      } else {
        throw new VerificationError(
          `Hook missing ${element.name}`,
          `Update hook file to include ${element.name}`
        );
      }
    }
    
    // Test hook execution
    try {
      const testInput = JSON.stringify({
        tool: { name: 'TodoWrite' },
        result: { todos: [{ content: 'test', status: 'pending' }] }
      });
      
      this.log('Testing hook execution...');
      try {
        const result = execSync(`echo '${testInput}' | python3 ${HOOK_PATH}`, { encoding: 'utf8' });
        // This shouldn't happen - hook should exit with code 2
        this.log('Hook executed but did not exit with expected code 2', 'warning');
      } catch (error) {
        // Check if it's the expected exit code 2
        if (error.status === 2 && error.stdout.includes('TodoWrite updated') && error.stdout.includes('agent-comm MCP')) {
          this.log('Hook executes correctly with exit code 2 and produces expected output', 'success');
        } else {
          this.log('Hook output may be incorrect', 'warning');
          this.log('Expected: TodoWrite updated message with agent-comm MCP reference and exit code 2', 'info');
          this.log('Actual exit code: ' + (error.status || 'unknown'), 'info');
          this.log('Actual output: ' + (error.stdout || '').trim(), 'info');
        }
      }
    } catch (error) {
      throw new VerificationError(
        `Hook execution test failed: ${error.message}`,
        'Check Python path and hook syntax'
      );
    }
  }

  async checkClaudeSettings() {
    this.log('=== Claude Settings Verification ===');
    
    // Check settings file exists
    if (!(await fs.pathExists(SETTINGS_PATH))) {
      this.log('Claude settings file not found - this may be normal', 'warning');
      this.log('Hook may still work if configured elsewhere', 'info');
      return;
    }
    
    await this.checkFileExists(SETTINGS_PATH, 'Claude settings file');
    
    // Check settings content
    const settingsContent = await fs.readFile(SETTINGS_PATH, 'utf8');
    let settings;
    
    try {
      settings = JSON.parse(settingsContent);
    } catch (error) {
      throw new VerificationError(
        'Claude settings file is not valid JSON',
        'Fix JSON syntax in ' + SETTINGS_PATH
      );
    }
    
    // Check hook configuration
    const hookConfig = settings?.hooks?.PostToolUse?.TodoWrite;
    
    if (hookConfig) {
      this.log('TodoWrite PostToolUse hook configuration found', 'success');
      
      if (hookConfig.command === 'python' || hookConfig.command === 'python3') {
        this.log('Hook command is configured correctly', 'success');
      } else {
        this.log(`Hook command is "${hookConfig.command}" - may need to be "python" or "python3"`, 'warning');
      }
      
      if (hookConfig.args && hookConfig.args.includes(HOOK_PATH)) {
        this.log('Hook args reference correct file path', 'success');
      } else {
        this.log('Hook args may not reference correct file path', 'warning');
      }
      
      if (hookConfig.timeout && hookConfig.timeout >= 5000) {
        this.log('Hook timeout is reasonable', 'success');
      } else {
        this.log('Hook timeout may be too short (recommended: 10000ms)', 'warning');
      }
    } else {
      this.log('TodoWrite PostToolUse hook not configured in settings', 'warning');
      this.log('Hook may be configured in global settings or may work without explicit config', 'info');
    }
  }

  async checkMcpConfiguration() {
    this.log('=== MCP Configuration Verification ===');
    
    // Check MCP config file - look in parent directory first
    const parentMcpPath = path.join('..', '.mcp.json');
    let actualMcpPath = MCP_CONFIG_PATH;
    
    if (!(await fs.pathExists(MCP_CONFIG_PATH)) && (await fs.pathExists(parentMcpPath))) {
      actualMcpPath = parentMcpPath;
      this.log(`Found MCP config in parent directory: ${parentMcpPath}`, 'success');
    } else if (!(await fs.pathExists(MCP_CONFIG_PATH))) {
      this.log('MCP configuration file not found - checking common locations...', 'info');
      
      const commonPaths = [
        path.join('..', '.mcp.json'),
        path.join(process.env.HOME || '', '.claude', 'mcp.json'),
        path.join(process.env.HOME || '', 'Library', 'Application Support', 'Claude', 'mcp.json'),
        'claude_desktop_config.json'
      ];
      
      let found = false;
      for (const commonPath of commonPaths) {
        if (await fs.pathExists(commonPath)) {
          this.log(`Found MCP config at ${commonPath}`, 'success');
          actualMcpPath = commonPath;
          found = true;
          break;
        }
      }
      
      if (!found) {
        throw new VerificationError(
          'No MCP configuration file found',
          'Create MCP configuration file with agent-comm server'
        );
      }
      return;
    }
    
    await this.checkFileExists(actualMcpPath, 'MCP configuration file');
    
    // Check MCP config content
    const mcpContent = await fs.readFile(actualMcpPath, 'utf8');
    let mcpConfig;
    
    try {
      mcpConfig = JSON.parse(mcpContent);
    } catch (error) {
      throw new VerificationError(
        'MCP configuration file is not valid JSON',
        'Fix JSON syntax in ' + actualMcpPath
      );
    }
    
    // Check agent-comm server configuration
    const agentCommServer = mcpConfig?.mcpServers?.['agent-comm'];
    
    if (agentCommServer) {
      this.log('agent-comm MCP server configuration found', 'success');
      
      // Check environment variables
      const env = agentCommServer.env || {};
      const expectedEnvVars = [
        'AGENT_COMM_DIR',
        'AGENT_COMM_ARCHIVE_DIR',
        'AGENT_COMM_DISABLE_ARCHIVE'
      ];
      
      for (const envVar of expectedEnvVars) {
        if (env[envVar] !== undefined) {
          this.log(`Environment variable ${envVar} is configured`, 'success');
        } else {
          this.log(`Environment variable ${envVar} is not configured`, 'warning');
        }
      }
      
      // Check for deprecated env vars
      const deprecatedEnvVars = ['COMM_DIR', 'ARCHIVE_DIR', 'ENABLE_ARCHIVING'];
      for (const envVar of deprecatedEnvVars) {
        if (env[envVar] !== undefined) {
          this.log(`Deprecated environment variable ${envVar} found - should be updated`, 'warning');
        }
      }
    } else {
      throw new VerificationError(
        'agent-comm MCP server not configured',
        'Add agent-comm server configuration to MCP config file'
      );
    }
  }

  async checkDocumentation() {
    this.log('=== Documentation Verification ===');
    
    for (const docFile of DOCUMENTATION_FILES) {
      await this.checkFileExists(docFile, `Documentation file ${docFile}`);
      
      const docContent = await fs.readFile(docFile, 'utf8');
      
      if (docFile === 'docs/PROTOCOL.md') {
        if (docContent.includes('sync_todo_checkboxes')) {
          this.log('PROTOCOL.md documents sync_todo_checkboxes tool', 'success');
        } else {
          throw new VerificationError(
            'PROTOCOL.md missing sync_todo_checkboxes documentation',
            'Add sync_todo_checkboxes tool documentation to PROTOCOL.md'
          );
        }
      }
      
      if (docFile === 'docs/TODOWRITE-INTEGRATION.md') {
        const requiredSections = [
          'Overview',
          'Architecture',
          'Installation & Setup',
          'Usage Guide',
          'Technical Details'
        ];
        
        for (const section of requiredSections) {
          if (docContent.includes(section)) {
            this.log(`TODOWRITE-INTEGRATION.md contains ${section} section`, 'success');
          } else {
            this.log(`TODOWRITE-INTEGRATION.md missing ${section} section`, 'warning');
          }
        }
      }
      
      if (docFile === 'README.md') {
        if (docContent.includes('TodoWrite Integration')) {
          this.log('README.md mentions TodoWrite Integration', 'success');
        } else {
          this.log('README.md does not mention TodoWrite Integration', 'warning');
        }
      }
    }
  }

  async checkMcpServerTools() {
    this.log('=== MCP Server Tools Verification ===');
    
    // Check if sync_todo_checkboxes tool exists in source
    const toolsDir = path.join(__dirname, '..', 'src', 'tools');
    const syncToolPath = path.join(toolsDir, 'sync-todo-checkboxes.ts');
    
    if (await fs.pathExists(syncToolPath)) {
      this.log('sync_todo_checkboxes tool source file exists', 'success');
      
      const toolContent = await fs.readFile(syncToolPath, 'utf8');
      
      // Check for key functionality
      const requiredElements = [
        { pattern: /sync_todo_checkboxes/, name: 'Tool name export' },
        { pattern: /fuzzyMatch/, name: 'Fuzzy matching functionality' },
        { pattern: /LockManager/, name: 'Lock coordination' },
        { pattern: /three.*state|checkbox.*state/i, name: 'Three-state checkbox support' }
      ];
      
      for (const element of requiredElements) {
        if (element.pattern.test(toolContent)) {
          this.log(`sync_todo_checkboxes tool contains ${element.name}`, 'success');
        } else {
          this.log(`sync_todo_checkboxes tool may be missing ${element.name}`, 'warning');
        }
      }
    } else {
      throw new VerificationError(
        'sync_todo_checkboxes tool source file not found',
        'Ensure sync-todo-checkboxes.ts exists in src/tools/'
      );
    }
    
    // Check if tool is registered in tools index
    const toolsIndexPath = path.join(toolsDir, 'index.ts');
    
    if (await fs.pathExists(toolsIndexPath)) {
      const indexContent = await fs.readFile(toolsIndexPath, 'utf8');
      
      if (indexContent.includes('sync-todo-checkboxes') || indexContent.includes('sync_todo_checkboxes')) {
        this.log('sync_todo_checkboxes tool is registered in tools index', 'success');
      } else {
        throw new VerificationError(
          'sync_todo_checkboxes tool is not registered in tools index',
          'Add sync_todo_checkboxes export to src/tools/index.ts'
        );
      }
    }
  }

  async runFullVerification() {
    this.log('🚀 Starting TodoWrite Integration Verification', 'info');
    this.log('================================================', 'info');
    
    const checks = [
      { name: 'Hook File', fn: () => this.checkHookFile() },
      { name: 'Claude Settings', fn: () => this.checkClaudeSettings() },
      { name: 'MCP Configuration', fn: () => this.checkMcpConfiguration() },
      { name: 'Documentation', fn: () => this.checkDocumentation() },
      { name: 'MCP Server Tools', fn: () => this.checkMcpServerTools() }
    ];
    
    let passedChecks = 0;
    let totalChecks = checks.length;
    
    for (const check of checks) {
      try {
        await check.fn();
        passedChecks++;
        this.log(`✅ ${check.name} verification passed`, 'success');
      } catch (error) {
        this.log(`❌ ${check.name} verification failed: ${error.message}`, 'error');
        if (error.fix) {
          this.log(`   Fix: ${error.fix}`, 'info');
        }
      }
      this.log(''); // Empty line for readability
    }
    
    // Summary
    this.log('================================================', 'info');
    this.log('📊 Verification Summary', 'info');
    this.log('================================================', 'info');
    
    this.log(`✅ Passed checks: ${passedChecks}/${totalChecks}`, passedChecks === totalChecks ? 'success' : 'warning');
    this.log(`⚠️  Warnings: ${this.warnings.length}`, this.warnings.length === 0 ? 'success' : 'warning');
    this.log(`❌ Errors: ${this.errors.length}`, this.errors.length === 0 ? 'success' : 'error');
    
    if (this.errors.length > 0) {
      this.log(''); 
      this.log('🔧 Issues that need fixing:', 'error');
      this.errors.forEach((error, index) => {
        this.log(`${index + 1}. ${error}`, 'error');
      });
    }
    
    if (this.warnings.length > 0) {
      this.log('');
      this.log('⚠️  Warnings (may not be critical):', 'warning');
      this.warnings.forEach((warning, index) => {
        this.log(`${index + 1}. ${warning}`, 'warning');
      });
    }
    
    if (passedChecks === totalChecks && this.errors.length === 0) {
      this.log('');
      this.log('🎉 TodoWrite integration is properly configured!', 'success');
      this.log('You can now use TodoWrite with automatic sync reminders.', 'success');
    } else {
      this.log('');
      this.log('🔧 Please address the issues above before using the integration.', 'error');
    }
    
    return {
      success: passedChecks === totalChecks && this.errors.length === 0,
      passed: passedChecks,
      total: totalChecks,
      errors: this.errors.length,
      warnings: this.warnings.length
    };
  }
}

// Main execution
async function main() {
  const verifier = new TodoWriteVerifier();
  
  try {
    const result = await verifier.runFullVerification();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    verifier.log(`Unexpected error during verification: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default TodoWriteVerifier;