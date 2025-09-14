#!/usr/bin/env node

/**
 * Script to fix debug import placement issues
 * Fixes syntax errors from incorrect import placement
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

async function main(): Promise<void> {
  console.log('Fixing debug import placement issues...\n');

  const filesToFix = [
    'src/core/ComplianceTracker.ts',
    'src/core/DelegationTracker.ts',
    'src/prompts/DynamicPromptEngine.ts',
    'src/prompts/PromptManager.ts',
    'src/resources/ResourceManager.ts',
    'src/resources/handlers/list-resources.ts',
    'src/resources/handlers/read-resource.ts',
    'src/resources/providers/AgentResourceProvider.ts',
    'src/resources/providers/ResourceProvider.ts',
    'src/resources/providers/ServerResourceProvider.ts',
    'src/resources/providers/TaskResourceProvider.ts'
  ];

  for (const relativePath of filesToFix) {
    const filePath = path.join(projectRoot, relativePath);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Check if file has the broken pattern
      if (content.includes('import type {\nimport debug from')) {
        const fixed = fixBrokenImport(content);
        await fs.writeFile(filePath, fixed, 'utf-8');
        console.log(`✓ Fixed ${relativePath}`);
      } else if (content.includes('import {\nimport debug from')) {
        const fixed = fixBrokenImport(content);
        await fs.writeFile(filePath, fixed, 'utf-8');
        console.log(`✓ Fixed ${relativePath}`);
      } else {
        console.log(`⊘ ${relativePath} - no fix needed`);
      }
    } catch (error) {
      console.error(`✗ Error fixing ${relativePath}:`, error);
    }
  }

  console.log('\n✅ Import fixes complete');
}

function fixBrokenImport(content: string): string {
  // Pattern 1: import type { followed by import debug
  let fixed = content.replace(
    /import type \{\nimport debug from 'debug';\n\nconst log = debug\('agent-comm:[^']+'\);\n([^}]+)\} from/g,
    "import debug from 'debug';\nimport type {\n$1} from"
  );

  // Pattern 2: import { followed by import debug
  fixed = fixed.replace(
    /import \{\nimport debug from 'debug';\n\nconst log = debug\('agent-comm:[^']+'\);\n([^}]+)\} from/g,
    "import debug from 'debug';\nimport {\n$1} from"
  );

  // Add the logger declaration after imports if it's missing
  const lines = fixed.split('\n');
  let hasLogDeclaration = false;
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      lastImportIndex = i;
    }
    if (lines[i].includes('const log = debug(')) {
      hasLogDeclaration = true;
      break;
    }
  }

  if (!hasLogDeclaration && lastImportIndex !== -1) {
    // Extract namespace from filename
    const fileName = path.basename(content).replace('.ts', '').toLowerCase().replace(/-/g, '');
    const namespace = `agent-comm:${fileName}`;

    // Find the right place to insert (after all imports)
    for (let i = lastImportIndex + 1; i < lines.length; i++) {
      if (!lines[i].startsWith('import ') && lines[i].trim() !== '') {
        lines.splice(i, 0, '', `const log = debug('${namespace}');`);
        break;
      }
    }

    fixed = lines.join('\n');
  }

  return fixed;
}

// Run the script
main().catch(error => {
  console.error('Error fixing imports:', error);
  process.exit(1);
});