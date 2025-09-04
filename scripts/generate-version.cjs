/**
 * Build-time version injection script
 * Reads package.json and generates src/generated/version.ts with package info constants
 * This ensures package.json remains the single source of truth while providing
 * compile-time constants for efficient runtime access.
 */

const fs = require('fs');
const path = require('path');

try {
  // Read package.json
  const packagePath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  // Generate TypeScript content with proper typing
  const content = `/**
 * Auto-generated file - DO NOT EDIT
 * Generated from package.json at build time
 * Source: ${packageJson.name}@${packageJson.version}
 */

export const PACKAGE_INFO = {
  name: '${packageJson.name}',
  version: '${packageJson.version}',
  description: '${packageJson.description}',
  author: '${packageJson.author}',
  repository: ${JSON.stringify(packageJson.repository, null, 2)}
} as const;

export const SERVER_NAME = 'agent-comm';
export const SERVER_VERSION = PACKAGE_INFO.version;
export const SERVER_DESCRIPTION = PACKAGE_INFO.description;
`;

  // Ensure directory exists
  const genDir = path.join(__dirname, '../src/generated');
  if (!fs.existsSync(genDir)) {
    fs.mkdirSync(genDir, { recursive: true });
  }

  // Write the generated file
  const outputPath = path.join(genDir, 'version.ts');
  fs.writeFileSync(outputPath, content);
  
  console.log('✓ Generated src/generated/version.ts');
  console.log(`  Package: ${packageJson.name}@${packageJson.version}`);
  
} catch (error) {
  console.error('✗ Failed to generate version file:', error.message);
  process.exit(1);
}