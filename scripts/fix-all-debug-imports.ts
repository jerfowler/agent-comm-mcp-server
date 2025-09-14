#!/usr/bin/env node

/**
 * Script to fix all debug import placement issues comprehensively
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

interface FixResult {
  file: string;
  status: 'fixed' | 'skipped' | 'error';
  message?: string;
}

async function main(): Promise<void> {
  console.log('Fixing all debug import placement issues...\n');

  const filesToFix = [
    'src/prompts/DynamicPromptEngine.ts',
    'src/prompts/PromptManager.ts',
    'src/resources/ResourceManager.ts',
    'src/resources/handlers/list-resources.ts',
    'src/resources/handlers/read-resource.ts',
    'src/resources/providers/AgentResourceProvider.ts',
    'src/resources/providers/ServerResourceProvider.ts',
    'src/resources/providers/TaskResourceProvider.ts',
    'src/tools/archive-completed-tasks.ts',
    'src/tools/archive-tasks.ts'
  ];

  const results: FixResult[] = [];

  for (const relativePath of filesToFix) {
    const filePath = path.join(projectRoot, relativePath);
    const result = await fixFile(filePath, relativePath);
    results.push(result);

    if (result.status === 'fixed') {
      console.log(`✓ Fixed ${relativePath}`);
    } else if (result.status === 'skipped') {
      console.log(`⊘ Skipped ${relativePath} - ${result.message}`);
    } else {
      console.log(`✗ Error fixing ${relativePath}: ${result.message}`);
    }
  }

  // Summary
  const fixed = results.filter(r => r.status === 'fixed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`\n✅ Summary: ${fixed} fixed, ${skipped} skipped, ${errors} errors`);
}

async function fixFile(filePath: string, relativePath: string): Promise<FixResult> {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;

    // Extract the proper namespace from the file path
    const fileName = path.basename(filePath, '.ts');
    const dirName = path.basename(path.dirname(filePath));

    let namespace = 'agent-comm:';
    if (dirName === 'tools') {
      namespace += `tools:${fileName.toLowerCase().replace(/-/g, '')}`;
    } else if (dirName === 'prompts') {
      namespace += `prompts:${fileName.toLowerCase().replace(/-/g, '')}`;
    } else if (dirName === 'resources') {
      namespace += `resources:${fileName.toLowerCase().replace(/-/g, '')}`;
    } else if (dirName === 'handlers') {
      namespace += `resources:handlers:${fileName.toLowerCase().replace(/-/g, '')}`;
    } else if (dirName === 'providers') {
      namespace += `resources:providers:${fileName.toLowerCase().replace(/-/g, '')}`;
    } else {
      namespace += fileName.toLowerCase().replace(/-/g, '');
    }

    // Fix broken import patterns
    const lines = content.split('\n');
    const fixedLines: string[] = [];
    let skipNextLines = 0;
    let hasDebugImport = false;
    let hasLogDeclaration = false;

    for (let i = 0; i < lines.length; i++) {
      if (skipNextLines > 0) {
        skipNextLines--;
        continue;
      }

      const line = lines[i];
      const nextLine = lines[i + 1] || '';
      const nextNextLine = lines[i + 2] || '';

      // Check for broken pattern: import type { followed by empty line and const log
      if (line.startsWith('import type {') &&
          nextLine.trim() === '' &&
          nextNextLine.includes('const log = debug(')) {

        // Extract the type imports
        let typeImportContent = '';
        let j = i + 3; // Skip to line after const log
        while (j < lines.length && !lines[j].includes('} from')) {
          typeImportContent += lines[j] + '\n';
          j++;
        }
        if (j < lines.length) {
          typeImportContent += lines[j]; // Add the closing line
        }

        // Add debug import first
        if (!hasDebugImport) {
          fixedLines.push("import debug from 'debug';");
          hasDebugImport = true;
        }

        // Add the fixed type import
        fixedLines.push(`import type {`);
        const typeLines = typeImportContent.split('\n').filter(l => l.trim());
        typeLines.forEach(l => fixedLines.push(l));

        skipNextLines = j - i;
        continue;
      }

      // Check for misplaced debug import
      if (line === "import debug from 'debug';" && i > 0 && lines[i - 1].includes('import')) {
        // Skip duplicate debug import if we already added it
        if (hasDebugImport) {
          continue;
        }
      }

      // Check for broken log declaration
      if (line.includes("const log = debug('agent-comm:") && line.includes("');") && !line.includes('acknowledge')) {
        hasLogDeclaration = true;
      }

      fixedLines.push(line);
    }

    // Reconstruct the content
    content = fixedLines.join('\n');

    // Ensure debug import exists at the top (after header comments)
    if (!hasDebugImport && !content.includes("import debug from 'debug'")) {
      const importLines = content.split('\n');
      let insertIndex = 0;

      // Skip header comments
      for (let i = 0; i < importLines.length; i++) {
        if (!importLines[i].startsWith('/**') &&
            !importLines[i].startsWith(' *') &&
            !importLines[i].startsWith('//') &&
            importLines[i].trim() !== '') {
          insertIndex = i;
          break;
        }
      }

      importLines.splice(insertIndex, 0, '', "import debug from 'debug';");
      content = importLines.join('\n');
    }

    // Ensure log declaration exists (after imports)
    if (!hasLogDeclaration && !content.includes('const log = debug(')) {
      const importLines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].startsWith('import ')) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex !== -1) {
        // Find the next non-empty line after imports
        let insertIndex = lastImportIndex + 1;
        while (insertIndex < importLines.length && importLines[insertIndex].trim() === '') {
          insertIndex++;
        }

        importLines.splice(insertIndex, 0, `const log = debug('${namespace}');`, '');
        content = importLines.join('\n');
      }
    }

    // Only write if content changed
    if (content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf-8');
      return { file: relativePath, status: 'fixed' };
    } else {
      return { file: relativePath, status: 'skipped', message: 'No changes needed' };
    }
  } catch (error) {
    return {
      file: relativePath,
      status: 'error',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});