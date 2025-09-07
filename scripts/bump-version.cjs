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
const NO_COMMIT = process.argv.includes('--no-commit');
const NO_TAG = process.argv.includes('--no-tag');
const FORCE_TYPE = process.argv.find(arg => arg.startsWith('--force-type='))?.split('=')[1];
const PACKAGE_PATH = path.join(__dirname, '../package.json');
const CHANGELOG_PATH = path.join(__dirname, '../CHANGELOG.md');

// Utility functions
const isCI = process.env.CI || process.env.GITHUB_ACTIONS;

function log(message, color = '\x1b[0m') {
  // Disable colors in CI environment to prevent parsing issues
  console.log(isCI ? message : `${color}${message}\x1b[0m`);
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
    // Check for breaking changes using conventional commit format
    // Must be either:
    // 1. Subject contains !: (e.g., "feat!: breaking change")
    // 2. Body contains "BREAKING CHANGE:" at start of line
    const hasBreakingInSubject = subject.includes('!:');
    const hasBreakingInBody = /^BREAKING[ -]CHANGE:/im.test(body);
    
    if (hasBreakingInSubject || hasBreakingInBody) {
      analysis.hasBreaking = true;
      analysis.breaking.push(commit);
    }
    // Check commit type
    else if (subject.startsWith('feat:') || subject.startsWith('feature:')) {
      // Check if this is a CI/CD or workflow "feature" that should be treated as chore
      const isCIFeature = subject.match(/feat:.*(?:workflow|CI|CD|github action|semver|branch|issue automation|pipeline|deployment|release|promotion)/i);
      
      if (isCIFeature) {
        // Treat workflow/CI features as chores to prevent version bumps
        analysis.chores.push(commit);
      } else {
        // Real features that add functionality to the MCP server
        analysis.hasFeatures = true;
        analysis.features.push(commit);
      }
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

function determineVersionBump(analysis, currentVersion) {
  if (FORCE_TYPE) {
    info(`Force version type: ${FORCE_TYPE}`);
    return FORCE_TYPE;
  }

  const [major] = currentVersion.split('.').map(Number);
  const isBeta = major === 0;
  
  if (isBeta) {
    // Beta versioning (0.x.x): breaking changes and features both bump minor
    // This prevents accidental jumps to 1.0.0 until explicitly ready
    if (analysis.hasBreaking || analysis.hasFeatures) {
      info('Beta version detected - using minor bump for breaking changes/features');
      return 'minor';
    }
    if (analysis.hasFixes) return 'patch';
  } else {
    // Standard semver for production versions (1.0.0+)
    if (analysis.hasBreaking) return 'major';
    if (analysis.hasFeatures) return 'minor';
    if (analysis.hasFixes) return 'patch';
  }
  
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
    // Only commit if not disabled
    if (!NO_COMMIT) {
      execCommand(`git add package.json CHANGELOG.md`);
      execCommand(`git commit -m "release: ${version}

- Automated version bump
- Updated CHANGELOG.md with release notes"`);
    }
    
    // Only tag if not disabled
    if (!NO_TAG) {
      execCommand(`git tag -a ${tag} -m "${message}"`);
    }
  }
  
  if (!NO_TAG) {
    success(`Created git tag: ${tag}`);
  }
  if (!NO_COMMIT) {
    success(`Committed version changes`);
  }
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
  const versionType = determineVersionBump(analysis, currentVersion);
  
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
    log('');
    log('Changelog entry would be:');
    log('');
    log('---');
    log(changelogEntry);
    log('---');
    log('');
    
    // Output for GitHub Actions consumption
    log('📊 Summary:');
    log(`Current version: ${currentVersion}`);
    log(`New version: ${newVersion}`);
    log(`Version bump type: ${versionType}`);
    log(`Commits analyzed: ${commits.length}`);
    log(`Features: ${analysis.features.length}`);
    log(`Fixes: ${analysis.fixes.length}`);
    log(`Breaking changes: ${analysis.breaking.length}`);
    
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