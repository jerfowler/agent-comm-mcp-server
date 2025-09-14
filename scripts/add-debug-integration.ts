#!/usr/bin/env node

/**
 * Script to add debug integration to all source files
 * Issue #50 - Comprehensive Debug Integration
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

interface FileUpdate {
  path: string;
  namespace: string;
  loggerName: string;
}

async function main(): Promise<void> {
  console.log('Adding debug integration to all source files...\n');

  const sourceFiles = await getAllTypeScriptFiles(srcDir);
  const updates: FileUpdate[] = [];

  for (const file of sourceFiles) {
    const content = await fs.readFile(file, 'utf-8');

    // Skip if already has debug import
    if (content.includes("import debug from 'debug'")) {
      console.log(`✓ ${path.relative(projectRoot, file)} - already has debug`);
      continue;
    }

    // Skip index.ts (main entry point) and type-only files
    const fileName = path.basename(file);
    if (fileName === 'index.ts' || fileName.endsWith('.types.ts')) {
      console.log(`⊘ ${path.relative(projectRoot, file)} - skipped (${fileName})`);
      continue;
    }

    const update = generateDebugIntegration(file);
    updates.push(update);

    // Add debug import and logger creation
    const updatedContent = addDebugToFile(content, update);
    await fs.writeFile(file, updatedContent, 'utf-8');

    console.log(`✓ ${path.relative(projectRoot, file)} - added debug (${update.namespace})`);
  }

  console.log(`\n✅ Updated ${updates.length} files with debug integration`);
  console.log(`Total source files: ${sourceFiles.length}`);
  console.log(`Coverage: ${((sourceFiles.length - updates.length) / sourceFiles.length * 100).toFixed(1)}% already had debug`);
}

function generateDebugIntegration(filePath: string): FileUpdate {
  const relativePath = path.relative(srcDir, filePath);
  const parts = relativePath.split(path.sep);
  const fileName = path.basename(filePath, '.ts');

  // Generate namespace based on file location
  let namespace = 'agent-comm:';
  if (parts[0] === 'logging') {
    namespace += `logging:${fileName.toLowerCase().replace(/-/g, '')}`;
  } else if (parts[0] === 'core') {
    namespace += `core:${fileName.toLowerCase().replace(/-/g, '')}`;
  } else if (parts[0] === 'tools') {
    namespace += `tools:${fileName.toLowerCase().replace(/-/g, '')}`;
  } else if (parts[0] === 'utils') {
    namespace += `utils:${fileName.toLowerCase().replace(/-/g, '')}`;
  } else {
    namespace += fileName.toLowerCase().replace(/-/g, '');
  }

  // Generate logger variable name
  const loggerName = 'log';

  return {
    path: filePath,
    namespace,
    loggerName
  };
}

function addDebugToFile(content: string, update: FileUpdate): string {
  const lines = content.split('\n');
  let importInsertIndex = -1;
  let lastImportIndex = -1;
  let hasImports = false;

  // Find where to insert the debug import
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('import ')) {
      hasImports = true;
      lastImportIndex = i;

      // Insert after the last path import but before type imports
      if (!line.includes('type ') && !line.includes('{ type')) {
        importInsertIndex = i;
      }
    } else if (hasImports && line.trim() !== '' && !line.startsWith('import ')) {
      // We've passed all imports
      break;
    }
  }

  // Determine where to insert
  if (importInsertIndex === -1) {
    if (lastImportIndex !== -1) {
      importInsertIndex = lastImportIndex;
    } else {
      // No imports found, add at the beginning after any header comments
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('/**') && !lines[i].startsWith(' *') &&
            !lines[i].startsWith('//') && lines[i].trim() !== '') {
          importInsertIndex = i - 1;
          break;
        }
      }
      if (importInsertIndex === -1) {
        importInsertIndex = 0;
      }
    }
  }

  // Add debug import
  const debugImport = "import debug from 'debug';";
  const loggerCreation = `\nconst ${update.loggerName} = debug('${update.namespace}');`;

  // Insert the import after the determined position
  lines.splice(importInsertIndex + 1, 0, debugImport);

  // Find where to add the logger creation (after imports)
  let loggerInsertIndex = importInsertIndex + 2;
  for (let i = loggerInsertIndex; i < lines.length; i++) {
    if (!lines[i].startsWith('import ') && lines[i].trim() !== '') {
      loggerInsertIndex = i;
      break;
    }
  }

  // Add logger creation
  lines.splice(loggerInsertIndex, 0, loggerCreation);

  // Add sample debug calls in key methods (if we can identify them)
  const updatedContent = lines.join('\n');
  return addDebugCalls(updatedContent, update.loggerName);
}

function addDebugCalls(content: string, loggerName: string): string {
  // Add debug calls to common method patterns
  const patterns = [
    {
      // Constructor pattern
      regex: /(constructor\([^)]*\)\s*{)/g,
      replacement: `$1\n    ${loggerName}('Initializing %s', this.constructor.name);`
    },
    {
      // Async method pattern (only public methods)
      regex: /(async\s+(\w+)\([^)]*\):[^{]*{)(\s*\n)(?!.*${loggerName})/g,
      replacement: `$1$3    ${loggerName}('Executing $2');$3`
    },
    {
      // Error handling pattern
      regex: /(catch\s*\([^)]*\)\s*{)/g,
      replacement: `$1\n      ${loggerName}('Error caught: %O', error);`
    }
  ];

  let result = content;

  // Only add debug calls to files that have substantial logic
  const hasSubstantialLogic = content.includes('async ') ||
                              content.includes('constructor') ||
                              content.includes('try {');

  if (hasSubstantialLogic) {
    // Add a sample debug call to the first major function
    const functionMatch = result.match(/(export\s+async\s+function\s+(\w+)[^{]*{)/);
    if (functionMatch) {
      const functionName = functionMatch[2];
      result = result.replace(
        functionMatch[1],
        `${functionMatch[1]}\n  ${loggerName}('${functionName} called with args: %O', arguments);`
      );
    }

    // Add debug to class methods (but be conservative)
    const classMethodMatch = result.match(/(async\s+(\w+)\([^)]*\):[^{]*{)(\s*\n)/);
    if (classMethodMatch && !classMethodMatch[0].includes('test')) {
      const methodName = classMethodMatch[2];
      if (!result.includes(`${loggerName}('${methodName}`)) {
        result = result.replace(
          classMethodMatch[0],
          `${classMethodMatch[1]}${classMethodMatch[3]}    ${loggerName}('${methodName} called');${classMethodMatch[3]}`
        );
      }
    }
  }

  return result;
}

async function getAllTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

// Run the script
main().catch(error => {
  console.error('Error adding debug integration:', error);
  process.exit(1);
});