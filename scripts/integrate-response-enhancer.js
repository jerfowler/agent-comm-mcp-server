#!/usr/bin/env node

/**
 * Script to integrate ResponseEnhancer into all tool handlers in index.ts
 * This automates the pattern of extracting agent, calling tool, and enhancing response
 */

import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'src', 'index.ts');
const content = fs.readFileSync(indexPath, 'utf-8');

// Define all tools that need enhancement
const toolsToEnhance = [
  'check_tasks',
  'read_task',
  'write_task',
  'create_task',
  'list_agents',
  'archive_tasks',
  'restore_tasks',
  'get_task_context',
  'submit_plan',
  'report_progress',
  'mark_complete',
  'archive_completed_tasks',
  'get_full_lifecycle',
  'track_task_progress',
  'sync_todo_checkboxes',
  'get_server_info',
  'ping'
];

// Helper to find and replace tool case statements
function enhanceToolCase(content, toolName) {
  // Match the case statement for this tool
  const caseRegex = new RegExp(
    `case '${toolName}': \\{[\\s\\S]*?return \\{[\\s\\S]*?\\};[\\s\\S]*?\\}`,
    'g'
  );

  const matches = content.match(caseRegex);
  if (!matches || matches.length === 0) {
    console.log(`Warning: Could not find case for tool: ${toolName}`);
    return content;
  }

  const originalCase = matches[0];

  // Check if already enhanced
  if (originalCase.includes('enhanceToolResponse')) {
    console.log(`Tool ${toolName} is already enhanced, skipping...`);
    return content;
  }

  // Extract the tool function call
  const functionCallMatch = originalCase.match(/const result = await (\w+)\(config(?:, args \?\? \{\})?\);/);
  if (!functionCallMatch) {
    console.log(`Warning: Could not find function call for tool: ${toolName}`);
    return content;
  }

  // Build the enhanced case
  let enhancedCase = originalCase;

  // Add agent extraction before the result
  const agentExtraction = `            const agent = (args && typeof args === 'object' && 'agent' in args && typeof args.agent === 'string')
              ? args.agent : 'default-agent';`;

  // Add enhancement after the result
  const enhancement = `            const enhanced = await enhanceToolResponse('${toolName}', result, agent, config);`;

  // Replace JSON.stringify(result with JSON.stringify(enhanced
  enhancedCase = enhancedCase.replace(
    /const result = await/,
    `${agentExtraction}\n            const result = await`
  );
  enhancedCase = enhancedCase.replace(
    /return \{/,
    `${enhancement}\n            return {`
  );
  enhancedCase = enhancedCase.replace(
    /JSON\.stringify\(result/g,
    'JSON.stringify(enhanced'
  );
  enhancedCase = enhancedCase.replace(
    /text: typeof result === 'string' \? result :/,
    `text: typeof enhanced === 'string' ? enhanced :`
  );

  // Replace in content
  content = content.replace(originalCase, enhancedCase);
  console.log(`Enhanced tool: ${toolName}`);

  return content;
}

// Process all tools
let updatedContent = content;
for (const tool of toolsToEnhance) {
  updatedContent = enhanceToolCase(updatedContent, tool);
}

// Write back the updated content
fs.writeFileSync(indexPath, updatedContent);
console.log('\nResponseEnhancer integration complete!');
console.log(`Updated ${toolsToEnhance.length} tools in index.ts`);