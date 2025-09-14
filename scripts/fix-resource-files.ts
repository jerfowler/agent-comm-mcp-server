#!/usr/bin/env node

/**
 * Script to fix debug imports in resource files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const filesToFix = [
  'src/resources/handlers/list-resources.ts',
  'src/resources/handlers/read-resource.ts',
  'src/resources/providers/AgentResourceProvider.ts',
  'src/resources/providers/ServerResourceProvider.ts',
  'src/resources/providers/TaskResourceProvider.ts',
  'src/tools/archive-completed-tasks.ts',
  'src/tools/archive-tasks.ts'
];

async function fixFile(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Fix the broken import pattern
  let fixed = content.replace(
    /import type \{\s*\nimport debug from 'debug';\s*\n\s*const log = debug\([^)]+\);\s*([^}]+)\} from/g,
    "import debug from 'debug';\nimport type {\n$1} from"
  );

  // Add log declaration after imports if missing
  if (!fixed.includes('const log = debug(')) {
    const lines = fixed.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex !== -1) {
      // Generate namespace
      const fileName = path.basename(filePath, '.ts').toLowerCase().replace(/-/g, '');
      const dirName = path.basename(path.dirname(filePath));

      let namespace = 'agent-comm:';
      if (dirName === 'handlers') {
        namespace += `resources:handlers:${fileName}`;
      } else if (dirName === 'providers') {
        namespace += `resources:providers:${fileName}`;
      } else if (dirName === 'tools') {
        namespace += `tools:${fileName}`;
      } else {
        namespace += fileName;
      }

      // Find the line after imports
      let insertIndex = lastImportIndex + 1;
      while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
        insertIndex++;
      }

      lines.splice(insertIndex, 0, `const log = debug('${namespace}');`, '');
      fixed = lines.join('\n');
    }
  }

  await fs.writeFile(filePath, fixed, 'utf-8');
  console.log(`✓ Fixed ${path.relative(projectRoot, filePath)}`);
}

async function main(): Promise<void> {
  console.log('Fixing resource file imports...\n');

  for (const file of filesToFix) {
    const filePath = path.join(projectRoot, file);
    try {
      await fixFile(filePath);
    } catch (error) {
      console.error(`✗ Error fixing ${file}:`, error);
    }
  }

  console.log('\n✅ Done fixing resource files');
}

main().catch(console.error);