#!/usr/bin/env node
/**
 * MCP Configuration Setup Script
 * 
 * Sets up the MCP configuration file for development by:
 * 1. Checking if .mcp.json already exists
 * 2. If not, copying from .mcp.json.example
 * 3. Optionally prompting for API keys (Ref.tools)
 * 4. Validating the final configuration
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MCP_CONFIG_PATH = path.join(__dirname, '../.mcp.json');
const MCP_EXAMPLE_PATH = path.join(__dirname, '../.mcp.json.example');

function log(message) {
  console.log(`📋 ${message}`);
}

function success(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️  ${message}`);
}

function error(message) {
  console.log(`❌ ${message}`);
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function validateMcpConfig(config) {
  if (!config.mcpServers) {
    throw new Error('Missing mcpServers section in configuration');
  }
  
  const requiredServers = ['agent-comm'];
  for (const serverName of requiredServers) {
    if (!config.mcpServers[serverName]) {
      throw new Error(`Missing required server: ${serverName}`);
    }
  }
  
  return true;
}

async function setupRefApiKey(config) {
  if (!config.mcpServers.Ref) {
    return config;
  }
  
  const currentUrl = config.mcpServers.Ref.url;
  if (currentUrl.includes('YOUR_REF_API_KEY_HERE')) {
    log('Ref.tools MCP server detected but no API key configured.');
    log('You can get a free API key at: https://ref.tools');
    
    const wantApiKey = await promptUser('Would you like to configure your Ref.tools API key now? (y/n): ');
    
    if (wantApiKey.toLowerCase() === 'y' || wantApiKey.toLowerCase() === 'yes') {
      const apiKey = await promptUser('Enter your Ref.tools API key (or press Enter to skip): ');
      
      if (apiKey) {
        config.mcpServers.Ref.url = currentUrl.replace('YOUR_REF_API_KEY_HERE', apiKey);
        success('Ref.tools API key configured!');
      } else {
        warn('Skipping Ref.tools API key configuration. You can add it later to .mcp.json');
      }
    } else {
      warn('Skipping Ref.tools API key configuration. You can add it later to .mcp.json');
    }
  } else {
    success('Ref.tools API key already configured');
  }
  
  return config;
}

async function main() {
  try {
    log('MCP Configuration Setup');
    log('======================');
    
    // Check if .mcp.json already exists
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      success('.mcp.json already exists - no setup needed!');
      
      // Validate existing configuration
      try {
        const existingConfig = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf8'));
        validateMcpConfig(existingConfig);
        success('Existing configuration is valid');
      } catch (validationError) {
        warn(`Configuration validation warning: ${validationError.message}`);
      }
      
      return;
    }
    
    // Check if example exists
    if (!fs.existsSync(MCP_EXAMPLE_PATH)) {
      throw new Error('.mcp.json.example not found. This file is required for setup.');
    }
    
    log('Creating .mcp.json from example template...');
    
    // Read the example configuration
    const exampleConfig = JSON.parse(fs.readFileSync(MCP_EXAMPLE_PATH, 'utf8'));
    
    // Setup API keys if needed
    const configWithKeys = await setupRefApiKey(exampleConfig);
    
    // Validate the configuration
    validateMcpConfig(configWithKeys);
    
    // Write the final configuration
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(configWithKeys, null, 2) + '\n');
    
    success('.mcp.json created successfully!');
    
    log('');
    log('📋 MCP Servers Configured:');
    Object.keys(configWithKeys.mcpServers).forEach(serverName => {
      const server = configWithKeys.mcpServers[serverName];
      if (server.type === 'stdio') {
        log(`   • ${serverName}: ${server.command} ${server.args ? server.args.join(' ') : ''}`);
      } else if (server.type === 'http') {
        const url = server.url.includes('YOUR_') ? '(needs API key)' : '(configured)';
        log(`   • ${serverName}: HTTP ${url}`);
      }
    });
    
    log('');
    success('Setup complete! You can now use Claude Code with the configured MCP servers.');
    
    if (configWithKeys.mcpServers.Ref && configWithKeys.mcpServers.Ref.url.includes('YOUR_')) {
      log('');
      warn('Note: To use Ref.tools, add your API key to .mcp.json or run this script again.');
    }
    
  } catch (err) {
    error(`Setup failed: ${err.message}`);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateMcpConfig };