#!/usr/bin/env node

/**
 * Automated Semantic Versioning Script
 * 
 * Analyzes commits since last version tag to determine version bump type.
 * Updates package.json, generates CHANGELOG entries, and creates git tags.
 * 
 * Usage: node scripts/bump-version.js [--dry-run] [--force-type=major|minor|patch]
 * 
 * Conventional Commit Types:
 * - feat: minor version bump
 * - fix: patch version bump  
 * - BREAKING CHANGE: major version bump
 * - chore/docs/test/style/refactor: no version bump
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_TYPE = process.argv.find(arg => arg.startsWith('--force-type='))?.split('=')[1];
const PACKAGE_PATH = path.join(__dirname, '../package.json');
const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');

// Utility functions
function log(message, color = '\x1b[0m') {
  console.log(`${color}${message}\x1b[0m`);
}

function success(message) { log(`✓ ${message}`, '\x1b[32m'); }
function error(message) { log(`✗ ${message}`, '\x1b[31m'); }
function info(message) { log(`ℹ ${message}`, '\x1b[34m'); }
function warn(message) { log(`⚠ ${message}`, '\x1b[33m'); }

function execCommand(command, options = {}) {
  try {
    const result = execSync(command, { encoding: 'utf8', ...options });
    return result.trim();
  } catch (err) {
    if (!options.allowFailure) {
      error(`Command failed: ${command}`);
      error(err.message);
      process.exit(1);
    }
    return null;
  }
}

function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  return packageJson.version;
}

function getLastTag() {
  const result = execCommand('git tag --sort=-version:refname', { allowFailure: true });
  if (result) {
    return result.split('\n')[0];
  }
  return null;
}

function getCommitsSinceTag(tag) {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  const result = execCommand(`git log ${range} --pretty=format:"%s|||%b|||%an|||%ad" --date=short`, { allowFailure: true });
  if (!result) return [];
  
  return result.split('\n').map(line => {
    const [subject, body, author, date] = line.split('|||');
    return { subject: subject || '', body: body || '', author, date };
  }).filter(commit => commit.subject);
}

function analyzeCommits(commits) {
  const analysis = {
    hasBreaking: false,
    hasFeatures: false,
    hasFixes: false,
    features: [],
    fixes: [],
    breaking: [],
    chores: []
  };

  for (const commit of commits) {
    const { subject, body } = commit;
    const fullMessage = `${subject}\n${body}`.toLowerCase();
    
    // Check for breaking changes
    if (fullMessage.includes('breaking change') || subject.includes('!:')) {
      analysis.hasBreaking = true;
      analysis.breaking.push(commit);
    }
    // Check commit type
    else if (subject.startsWith('feat:') || subject.startsWith('feature:')) {
      analysis.hasFeatures = true;
      analysis.features.push(commit);
    }
    else if (subject.startsWith('fix:')) {
      analysis.hasFixes = true;
      analysis.fixes.push(commit);
    }
    else if (subject.match(/^(chore|docs|test|style|refactor|perf):/)) {
      analysis.chores.push(commit);
    }
  }

  return analysis;
}

function determineVersionBump(analysis) {
  if (FORCE_TYPE) {
    info(`Force version type: ${FORCE_TYPE}`);
    return FORCE_TYPE;
  }

  if (analysis.hasBreaking) return 'major';
  if (analysis.hasFeatures) return 'minor';
  if (analysis.hasFixes) return 'patch';
  return 'none';
}

function bumpVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (type) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: return currentVersion;
  }
}

function generateChangelogEntry(newVersion, analysis) {
  const date = new Date().toISOString().split('T')[0];
  let entry = `## [${newVersion}] - ${date}\n\n`;
  
  if (analysis.breaking.length > 0) {
    entry += `### 💥 BREAKING CHANGES\n\n`;
    analysis.breaking.forEach(commit => {
      const cleanSubject = commit.subject.replace(/^[^:]+:\s*/, '');
      entry += `- **Breaking**: ${cleanSubject}\n`;
    });
    entry += '\n';
  }
  
  if (analysis.features.length > 0) {
    entry += `### ✨ Features\n\n`;
    analysis.features.forEach(commit => {
      const cleanSubject = commit.subject.replace(/^feat:\s*/, '');
      entry += `- ${cleanSubject}\n`;
    });
    entry += '\n';
  }
  
  if (analysis.fixes.length > 0) {
    entry += `### 🐛 Bug Fixes\n\n`;
    analysis.fixes.forEach(commit => {
      const cleanSubject = commit.subject.replace(/^fix:\s*/, '');
      entry += `- ${cleanSubject}\n`;
    });
    entry += '\n';
  }
  
  if (analysis.chores.length > 0) {
    entry += `### 🔧 Other Changes\n\n`;
    analysis.chores.forEach(commit => {
      const cleanSubject = commit.subject.replace(/^[^:]+:\s*/, '');
      entry += `- ${cleanSubject}\n`;
    });
    entry += '\n';
  }
  
  return entry;
}

function updatePackageJson(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  packageJson.version = newVersion;
  
  if (!DRY_RUN) {
    fs.writeFileSync(PACKAGE_PATH, JSON.stringify(packageJson, null, 2) + '\n');
  }
  success(`Updated package.json to ${newVersion}`);
}

function updateChangelog(entry) {
  const currentChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const lines = currentChangelog.split('\n');
  
  // Find the insertion point (after the header)
  const insertIndex = lines.findIndex(line => line.startsWith('## ['));
  const insertAt = insertIndex === -1 ? lines.length : insertIndex;
  
  // Insert the new entry
  const newLines = [
    ...lines.slice(0, insertAt),
    entry.trim(),
    '',
    ...lines.slice(insertAt)
  ];
  
  if (!DRY_RUN) {
    fs.writeFileSync(CHANGELOG_PATH, newLines.join('\n'));
  }
  success('Updated CHANGELOG.md');
}

function createGitTag(version) {
  const tag = `v${version}`;
  const message = `Release ${version}`;
  
  if (!DRY_RUN) {
    execCommand(`git add package.json CHANGELOG.md`);
    execCommand(`git commit -m "release: ${version}"`);
    execCommand(`git tag -a ${tag} -m "${message}"`);
  }
  success(`Created git tag: ${tag}`);
}

function main() {
  info('🚀 Starting automated version bump...');
  
  if (DRY_RUN) {
    warn('DRY RUN MODE - No changes will be made');
  }
  
  // Get current state
  const currentVersion = getCurrentVersion();
  const lastTag = getLastTag();
  
  info(`Current version: ${currentVersion}`);
  info(`Last tag: ${lastTag || 'none'}`);
  
  // Analyze commits
  const commits = getCommitsSinceTag(lastTag);
  
  if (commits.length === 0) {
    info('No commits found since last tag');
    process.exit(0);
  }
  
  info(`Found ${commits.length} commits since ${lastTag || 'start'}`);
  
  const analysis = analyzeCommits(commits);
  const versionType = determineVersionBump(analysis);
  
  if (versionType === 'none') {
    info('No version bump required (only chore commits)');
    process.exit(0);
  }
  
  const newVersion = bumpVersion(currentVersion, versionType);
  
  info(`Version bump type: ${versionType}`);
  info(`New version: ${newVersion}`);
  
  // Generate changelog entry
  const changelogEntry = generateChangelogEntry(newVersion, analysis);
  
  if (DRY_RUN) {
    log('\nChangelog entry would be:');
    log('---');
    log(changelogEntry);
    log('---');
    process.exit(0);
  }
  
  // Make changes
  updatePackageJson(newVersion);
  updateChangelog(changelogEntry);
  createGitTag(newVersion);
  
  // Regenerate version.ts with new version
  execCommand('npm run prebuild');
  success('Regenerated version.ts');
  
  success(`🎉 Successfully bumped version to ${newVersion}`);
  info('Next steps:');
  info('- Push changes: git push && git push --tags');
  info('- Publish to npm: npm publish');
}

// Run the script
if (require.main === module) {
  main();
}