#!/usr/bin/env python3
"""
Destructive Operation Guard - Comprehensive Data Loss Prevention System
Proactive protection system for preventing accidental data loss during development

This system provides:
1. Pre-operation safety checks and validations
2. Automatic backup creation for risky operations
3. Recovery point establishment
4. User confirmation with detailed risk assessment
5. Safe operation alternatives and guidance
6. Rollback mechanisms for failed operations

Usage:
  ./destructive-operation-guard.py check "git reset --hard"
  ./destructive-operation-guard.py protect "rm -rf src/"
  ./destructive-operation-guard.py create-backup
  ./destructive-operation-guard.py verify-safety "git clean -fd"
"""

import sys
import json
import os
import subprocess
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from enum import Enum

class RiskLevel(Enum):
    """Risk levels for operations"""
    SAFE = "safe"
    RISKY = "risky"
    DANGEROUS = "dangerous"
    CRITICAL = "critical"

class BackupType(Enum):
    """Types of backups that can be created"""
    GIT_STASH = "git_stash"
    GIT_BRANCH = "git_branch"
    DIRECTORY_COPY = "directory_copy"
    FILE_COPY = "file_copy"
    FULL_REPOSITORY = "full_repository"

def log_debug(message: str) -> None:
    """Debug logging when enabled"""
    if os.environ.get('AGENT_COMM_HOOK_DEBUG') == 'true':
        print(f"[DEBUG] Destructive Guard: {message}", file=sys.stderr)

def log_info(message: str) -> None:
    """Info logging to stderr"""
    print(f"[INFO] Destructive Guard: {message}", file=sys.stderr)

def log_warning(message: str) -> None:
    """Warning logging to stderr"""
    print(f"[WARNING] Destructive Guard: {message}", file=sys.stderr)

def log_error(message: str) -> None:
    """Error logging to stderr"""
    print(f"[ERROR] Destructive Guard: {message}", file=sys.stderr)

class OperationAnalyzer:
    """Analyze operations for destructive patterns and risk levels"""
    
    def __init__(self):
        self.critical_patterns = [
            # Git operations that will definitely lose data
            (r'git\s+reset\s+--hard', "Git hard reset - WILL LOSE all uncommitted changes", 
             ["git stash push -m 'backup before reset'", "git branch backup-$(date +%Y%m%d-%H%M%S)"]),
            (r'git\s+clean\s+-[fF]*d', "Git clean -fd - WILL DELETE all untracked files and directories", 
             ["git add . && git stash push -m 'backup untracked'", "cp -r . ../backup-$(basename $PWD)"]),
            (r'git\s+push\s+.*--force', "Force push - WILL OVERWRITE remote history", 
             ["git push --force-with-lease", "git log --oneline origin/main..HEAD (check commits)"]),
            
            # File system operations that will definitely lose data
            (r'rm\s+-rf\s+(?:\./)?(?:src|lib|tests?|docs?|\.git)(?:/|\s|$)', 
             "Recursive deletion of critical directories", 
             ["mv src/ src.backup.$(date +%Y%m%d-%H%M%S)", "git status (check if tracked)"]),
            (r'rm\s+-rf\s+\*', "Recursive deletion of all files in current directory", 
             ["ls -la (review what will be deleted)", "cp -r . ../full-backup-$(basename $PWD)"]),
            (r'>\s*(?:\./)?(?:src|lib|tests?|docs?)/[^/]+\.(?:js|ts|py|md|json|yaml|yml)', 
             "File overwrite without backup", 
             ["cp file.ext file.ext.backup.$(date +%Y%m%d-%H%M%S)", "git status file.ext"]),
            (r'truncate\s+-s\s*0', "File truncation - WILL EMPTY files", 
             ["cp file file.backup", "wc -l file (check size first)"]),
        ]
        
        self.dangerous_patterns = [
            # Git operations that could lose unsaved work
            (r'git\s+checkout\s+--\s*\.', "Git checkout -- . discards ALL working directory changes", 
             ["git diff > changes.patch", "git stash push -m 'backup before checkout'"]),
            (r'git\s+checkout\s+--\s+[^/\s]+', "Git checkout -- file discards specific file changes", 
             ["git diff file > file.changes.patch", "cp file file.backup"]),
            (r'git\s+stash\s+drop', "Permanent stash deletion - may lose changes", 
             ["git stash show -p > stash-backup.patch", "git stash list (review stashes)"]),
            (r'git\s+stash\s+clear', "Clear all stashes - WILL LOSE all stashed changes", 
             ["git stash list", "for s in $(git stash list | cut -d: -f1); do git stash show -p $s > $s.patch; done"]),
            (r'git\s+branch\s+-D', "Force deletion of git branches - may lose commits", 
             ["git log branch-name --oneline", "git tag backup-branch-$(date +%Y%m%d-%H%M%S) branch-name"]),
            
            # Build/dependency operations
            (r'npm\s+run\s+clean', "Build clean - may remove important generated files", 
             ["ls -la dist/ build/ (check what exists)", "cp -r dist/ dist.backup/ || true"]),
            (r'rm\s+.*(?:package(?:-lock)?\.json|tsconfig\.json|\.gitignore)', 
             "Deletion of critical config files", 
             ["cp file file.backup.$(date +%Y%m%d-%H%M%S)", "git status file"]),
            
            # File operations
            (r'mv\s+(?:\./)?(?:src|lib|tests?)\s+', "Moving critical directories", 
             ["cp -r src/ src.backup/", "git status src/"]),
            (r'cp\s+.*>\s*[^>\s]+', "File copy with overwrite", 
             ["cp target target.backup.$(date +%Y%m%d-%H%M%S)", "diff source target || true"]),
        ]
        
        self.risky_patterns = [
            # Git operations that need careful consideration
            (r'git\s+reset\s+HEAD[~^]', "Git reset to previous commits - may lose commits", 
             ["git log --oneline -5", "git reflog", "git tag backup-head-$(date +%Y%m%d-%H%M%S)"]),
            (r'git\s+revert\s+HEAD', "Git revert - creates new commit, safer but check impact", 
             ["git show HEAD", "git log --oneline -3"]),
            (r'git\s+merge\s+.*--no-ff', "Force merge commit - check for conflicts", 
             ["git status", "git diff HEAD..branch-to-merge"]),
            (r'git\s+rebase\s+.*-i', "Interactive rebase - can modify commit history", 
             ["git log --oneline -10", "git branch backup-pre-rebase-$(date +%Y%m%d-%H%M%S)"]),
            
            # File operations
            (r'chmod\s+000', "Removing all permissions - may make files inaccessible", 
             ["ls -la file", "cp file file.backup"]),
            (r'find\s+.*-delete', "Find with delete - bulk file removal", 
             ["find ... -print (dry run first)", "find ... | head -10"]),
            (r'sed\s+-i[^.]+(?:\s|$)', "In-place file editing without backup", 
             ["sed -i.backup ...", "cp file file.backup"]),
            
            # Environment operations
            (r'rm\s+.*\.env', "Deletion of environment files", 
             ["cp .env .env.backup", "cat .env | head -5"]),
            (r'node_modules.*rm', "Node modules manipulation", 
             ["npm list --depth=0", "ls -la node_modules/"]),
        ]

    def analyze_operation(self, command: str) -> Tuple[RiskLevel, List[str], List[str]]:
        """
        Analyze a command for destructive patterns
        Returns: (risk_level, violations, alternatives)
        """
        violations = []
        alternatives = []
        
        command_lower = command.lower()
        
        # Check critical patterns first
        for pattern, description, alts in self.critical_patterns:
            if re.search(pattern, command_lower, re.IGNORECASE):
                violations.append(description)
                alternatives.extend(alts)
        
        if violations:
            return RiskLevel.CRITICAL, violations, alternatives
        
        # Check dangerous patterns
        for pattern, description, alts in self.dangerous_patterns:
            if re.search(pattern, command_lower, re.IGNORECASE):
                violations.append(description)
                alternatives.extend(alts)
        
        if violations:
            return RiskLevel.DANGEROUS, violations, alternatives
        
        # Check risky patterns
        for pattern, description, alts in self.risky_patterns:
            if re.search(pattern, command_lower, re.IGNORECASE):
                violations.append(description)
                alternatives.extend(alts)
        
        if violations:
            return RiskLevel.RISKY, violations, alternatives
        
        return RiskLevel.SAFE, [], []

class WorkspaceState:
    """Capture and analyze current workspace state"""
    
    def __init__(self):
        self.cwd = os.getcwd()
        self.git_repo = self._is_git_repo()
        
    def _is_git_repo(self) -> bool:
        """Check if current directory is a git repository"""
        try:
            result = subprocess.run(['git', 'rev-parse', '--git-dir'], 
                                  capture_output=True, text=True, cwd=self.cwd)
            return result.returncode == 0
        except:
            return False
    
    def get_git_status(self) -> Dict[str, Any]:
        """Get comprehensive git status information"""
        if not self.git_repo:
            return {}
        
        status = {}
        
        try:
            # Current branch
            result = subprocess.run(['git', 'branch', '--show-current'], 
                                  capture_output=True, text=True, cwd=self.cwd)
            status['current_branch'] = result.stdout.strip() if result.returncode == 0 else 'unknown'
            
            # Staged changes
            result = subprocess.run(['git', 'diff', '--cached', '--name-only'], 
                                  capture_output=True, text=True, cwd=self.cwd)
            staged_files = result.stdout.strip().split('\n') if result.returncode == 0 and result.stdout.strip() else []
            status['staged_files'] = [f for f in staged_files if f]
            
            # Unstaged changes
            result = subprocess.run(['git', 'diff', '--name-only'], 
                                  capture_output=True, text=True, cwd=self.cwd)
            unstaged_files = result.stdout.strip().split('\n') if result.returncode == 0 and result.stdout.strip() else []
            status['unstaged_files'] = [f for f in unstaged_files if f]
            
            # Untracked files
            result = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'], 
                                  capture_output=True, text=True, cwd=self.cwd)
            untracked_files = result.stdout.strip().split('\n') if result.returncode == 0 and result.stdout.strip() else []
            # Filter out build artifacts and cache files
            important_untracked = [f for f in untracked_files if f and not any(
                skip in f for skip in ['node_modules', '.cache', 'dist', 'build', '.log', '.tmp']
            )]
            status['untracked_files'] = important_untracked
            
            # Recent commits
            result = subprocess.run(['git', 'log', '--oneline', '-5'], 
                                  capture_output=True, text=True, cwd=self.cwd)
            recent_commits = result.stdout.strip().split('\n') if result.returncode == 0 and result.stdout.strip() else []
            status['recent_commits'] = recent_commits
            
            # Stash list
            result = subprocess.run(['git', 'stash', 'list'], 
                                  capture_output=True, text=True, cwd=self.cwd)
            stashes = result.stdout.strip().split('\n') if result.returncode == 0 and result.stdout.strip() else []
            status['stashes'] = [s for s in stashes if s]
            
        except Exception as e:
            log_debug(f"Error getting git status: {e}")
            
        return status
    
    def has_unsaved_work(self) -> Tuple[bool, List[str]]:
        """Check if there's unsaved work that could be lost"""
        if not self.git_repo:
            return False, ["Not in a git repository - cannot detect unsaved work"]
        
        git_status = self.get_git_status()
        warnings = []
        has_work = False
        
        if git_status.get('staged_files'):
            has_work = True
            warnings.append(f"Staged changes in {len(git_status['staged_files'])} files")
        
        if git_status.get('unstaged_files'):
            has_work = True  
            warnings.append(f"Unstaged changes in {len(git_status['unstaged_files'])} files")
        
        if git_status.get('untracked_files'):
            has_work = True
            warnings.append(f"Untracked important files: {len(git_status['untracked_files'])} files")
        
        return has_work, warnings

class BackupManager:
    """Create and manage backups before destructive operations"""
    
    def __init__(self, workspace_state: WorkspaceState):
        self.workspace = workspace_state
        self.backup_dir = Path(os.getcwd()) / '.destructive-guard-backups'
        self.backup_dir.mkdir(exist_ok=True)
        
    def create_backup(self, backup_type: BackupType, target: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        Create a backup of the specified type
        Returns: (success, backup_location, error_message)
        """
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        
        try:
            if backup_type == BackupType.GIT_STASH:
                return self._create_git_stash_backup(timestamp)
            elif backup_type == BackupType.GIT_BRANCH:
                return self._create_git_branch_backup(timestamp)
            elif backup_type == BackupType.DIRECTORY_COPY:
                return self._create_directory_backup(timestamp, target)
            elif backup_type == BackupType.FILE_COPY:
                return self._create_file_backup(timestamp, target)
            elif backup_type == BackupType.FULL_REPOSITORY:
                return self._create_full_repository_backup(timestamp)
            else:
                return False, "", f"Unknown backup type: {backup_type}"
                
        except Exception as e:
            return False, "", f"Backup failed: {e}"
    
    def _create_git_stash_backup(self, timestamp: str) -> Tuple[bool, str, str]:
        """Create a git stash backup"""
        if not self.workspace.git_repo:
            return False, "", "Not in a git repository"
        
        stash_name = f"destructive-guard-backup-{timestamp}"
        
        result = subprocess.run(['git', 'stash', 'push', '-m', stash_name, '--include-untracked'], 
                              capture_output=True, text=True, cwd=self.workspace.cwd)
        
        if result.returncode == 0:
            return True, f"Git stash: {stash_name}", ""
        else:
            return False, "", f"Git stash failed: {result.stderr}"
    
    def _create_git_branch_backup(self, timestamp: str) -> Tuple[bool, str, str]:
        """Create a git branch backup"""
        if not self.workspace.git_repo:
            return False, "", "Not in a git repository"
        
        branch_name = f"backup-{timestamp}"
        
        result = subprocess.run(['git', 'branch', branch_name], 
                              capture_output=True, text=True, cwd=self.workspace.cwd)
        
        if result.returncode == 0:
            return True, f"Git branch: {branch_name}", ""
        else:
            return False, "", f"Git branch creation failed: {result.stderr}"
    
    def _create_directory_backup(self, timestamp: str, target: Optional[str]) -> Tuple[bool, str, str]:
        """Create a directory copy backup"""
        if not target:
            target = "."
        
        source_path = Path(self.workspace.cwd) / target
        if not source_path.exists():
            return False, "", f"Source directory does not exist: {target}"
        
        backup_name = f"{target.replace('/', '_').replace('.', 'current')}-backup-{timestamp}"
        backup_path = self.backup_dir / backup_name
        
        shutil.copytree(source_path, backup_path, ignore=shutil.ignore_patterns(
            '*.pyc', '__pycache__', '.cache', 'node_modules', 'dist', 'build', '.git'
        ))
        
        return True, str(backup_path), ""
    
    def _create_file_backup(self, timestamp: str, target: Optional[str]) -> Tuple[bool, str, str]:
        """Create a file copy backup"""
        if not target:
            return False, "", "File target required for file backup"
        
        source_path = Path(self.workspace.cwd) / target
        if not source_path.exists():
            return False, "", f"Source file does not exist: {target}"
        
        backup_name = f"{source_path.name}-backup-{timestamp}"
        backup_path = self.backup_dir / backup_name
        
        shutil.copy2(source_path, backup_path)
        
        return True, str(backup_path), ""
    
    def _create_full_repository_backup(self, timestamp: str) -> Tuple[bool, str, str]:
        """Create a full repository backup"""
        repo_name = Path(self.workspace.cwd).name
        backup_name = f"{repo_name}-full-backup-{timestamp}"
        backup_path = self.backup_dir.parent / backup_name
        
        shutil.copytree(self.workspace.cwd, backup_path, ignore=shutil.ignore_patterns(
            '*.pyc', '__pycache__', '.cache', 'node_modules', 'dist', 'build'
        ))
        
        return True, str(backup_path), ""

class SafetyProtocol:
    """Coordinate safety checks, backups, and user confirmations"""
    
    def __init__(self):
        self.analyzer = OperationAnalyzer()
        self.workspace = WorkspaceState()
        self.backup_manager = BackupManager(self.workspace)
        
    def check_operation_safety(self, command: str, interactive: bool = True) -> Dict[str, Any]:
        """
        Comprehensive safety check for a command
        Returns safety analysis and recommendations
        """
        # Analyze the operation
        risk_level, violations, alternatives = self.analyzer.analyze_operation(command)
        
        # Check workspace state
        has_unsaved_work, work_warnings = self.workspace.has_unsaved_work()
        git_status = self.workspace.get_git_status()
        
        # Determine recommended backup types
        recommended_backups = self._determine_backup_recommendations(risk_level, has_unsaved_work)
        
        safety_report = {
            'command': command,
            'risk_level': risk_level.value,
            'violations': violations,
            'alternatives': alternatives,
            'has_unsaved_work': has_unsaved_work,
            'work_warnings': work_warnings,
            'git_status': git_status,
            'recommended_backups': [bt.value for bt in recommended_backups],
            'safety_score': self._calculate_safety_score(risk_level, has_unsaved_work, len(violations)),
            'approval_required': risk_level in [RiskLevel.DANGEROUS, RiskLevel.CRITICAL],
            'backup_required': risk_level in [RiskLevel.DANGEROUS, RiskLevel.CRITICAL] or has_unsaved_work
        }
        
        return safety_report
    
    def _determine_backup_recommendations(self, risk_level: RiskLevel, has_unsaved_work: bool) -> List[BackupType]:
        """Determine which backup types are recommended"""
        recommendations = []
        
        if has_unsaved_work:
            recommendations.append(BackupType.GIT_STASH)
            recommendations.append(BackupType.GIT_BRANCH)
        
        if risk_level == RiskLevel.CRITICAL:
            recommendations.extend([
                BackupType.GIT_BRANCH,
                BackupType.FULL_REPOSITORY
            ])
        elif risk_level == RiskLevel.DANGEROUS:
            recommendations.extend([
                BackupType.GIT_STASH,
                BackupType.DIRECTORY_COPY
            ])
        elif risk_level == RiskLevel.RISKY:
            recommendations.append(BackupType.GIT_STASH)
        
        return list(set(recommendations))  # Remove duplicates
    
    def _calculate_safety_score(self, risk_level: RiskLevel, has_unsaved_work: bool, violation_count: int) -> float:
        """Calculate a safety score from 0.0 (very unsafe) to 1.0 (very safe)"""
        base_scores = {
            RiskLevel.SAFE: 1.0,
            RiskLevel.RISKY: 0.7,
            RiskLevel.DANGEROUS: 0.3,
            RiskLevel.CRITICAL: 0.0
        }
        
        score = base_scores[risk_level]
        
        # Reduce score if unsaved work is present
        if has_unsaved_work:
            score *= 0.5
        
        # Reduce score based on number of violations
        violation_penalty = min(0.1 * violation_count, 0.5)
        score *= (1.0 - violation_penalty)
        
        return max(0.0, score)
    
    def create_recommended_backups(self, recommended_backups: List[str]) -> Dict[str, Any]:
        """Create all recommended backups"""
        backup_results = {}
        
        for backup_type_str in recommended_backups:
            try:
                backup_type = BackupType(backup_type_str)
                success, location, error = self.backup_manager.create_backup(backup_type)
                
                backup_results[backup_type_str] = {
                    'success': success,
                    'location': location,
                    'error': error
                }
                
                if success:
                    log_info(f"Created {backup_type_str} backup at: {location}")
                else:
                    log_error(f"Failed to create {backup_type_str} backup: {error}")
                    
            except ValueError:
                backup_results[backup_type_str] = {
                    'success': False,
                    'location': '',
                    'error': f'Unknown backup type: {backup_type_str}'
                }
        
        return backup_results

def format_safety_report(report: Dict[str, Any]) -> str:
    """Format a safety report for display"""
    lines = []
    
    # Header with risk level
    risk_level = report['risk_level'].upper()
    risk_emoji = {'safe': '✅', 'risky': '🤔', 'dangerous': '⚠️', 'critical': '🚨'}
    emoji = risk_emoji.get(report['risk_level'], '❓')
    
    lines.append(f"{emoji} OPERATION SAFETY ANALYSIS - {risk_level} RISK")
    lines.append(f"Command: {report['command']}")
    lines.append(f"Safety Score: {report['safety_score']:.2f}/1.0")
    lines.append("")
    
    # Risk violations
    if report['violations']:
        lines.append("🚫 DETECTED RISKS:")
        for violation in report['violations']:
            lines.append(f"  • {violation}")
        lines.append("")
    
    # Workspace state
    if report['has_unsaved_work']:
        lines.append("📝 UNSAVED WORK DETECTED:")
        for warning in report['work_warnings']:
            lines.append(f"  • {warning}")
        lines.append("")
    
    # Git status details
    git_status = report.get('git_status', {})
    if git_status:
        lines.append("📊 WORKSPACE STATUS:")
        lines.append(f"  • Branch: {git_status.get('current_branch', 'unknown')}")
        lines.append(f"  • Staged files: {len(git_status.get('staged_files', []))}")
        lines.append(f"  • Unstaged files: {len(git_status.get('unstaged_files', []))}")
        lines.append(f"  • Untracked files: {len(git_status.get('untracked_files', []))}")
        lines.append(f"  • Stashes: {len(git_status.get('stashes', []))}")
        lines.append("")
    
    # Safer alternatives
    if report['alternatives']:
        lines.append("✅ SAFER ALTERNATIVES:")
        for alt in report['alternatives'][:5]:  # Show max 5 alternatives
            lines.append(f"  • {alt}")
        lines.append("")
    
    # Backup recommendations
    if report['recommended_backups']:
        lines.append("🛡️ RECOMMENDED BACKUPS:")
        for backup in report['recommended_backups']:
            lines.append(f"  • {backup.replace('_', ' ').title()}")
        lines.append("")
    
    # Final recommendation
    if report['approval_required']:
        lines.append("⚠️ APPROVAL REQUIRED: This operation requires explicit confirmation")
    if report['backup_required']:
        lines.append("📦 BACKUP REQUIRED: Create backups before proceeding")
    
    return "\n".join(lines)

def main():
    """Main CLI interface"""
    import argparse
    import re
    
    parser = argparse.ArgumentParser(description='Destructive Operation Guard - Data Loss Prevention')
    parser.add_argument('action', choices=['check', 'protect', 'create-backup', 'verify-safety'],
                       help='Action to perform')
    parser.add_argument('command', nargs='?', help='Command to analyze or protect')
    parser.add_argument('--interactive', action='store_true', default=True,
                       help='Enable interactive mode (default)')
    parser.add_argument('--json', action='store_true', 
                       help='Output results in JSON format')
    parser.add_argument('--backup-type', choices=['git_stash', 'git_branch', 'directory_copy', 'full_repository'],
                       help='Specific backup type to create')
    
    args = parser.parse_args()
    
    protocol = SafetyProtocol()
    
    if args.action == 'check':
        if not args.command:
            log_error("Command required for check action")
            sys.exit(1)
        
        safety_report = protocol.check_operation_safety(args.command, args.interactive)
        
        if args.json:
            print(json.dumps(safety_report, indent=2))
        else:
            print(format_safety_report(safety_report))
        
        # Exit with code based on safety level
        risk_level = safety_report['risk_level']
        if risk_level == 'critical':
            sys.exit(3)
        elif risk_level == 'dangerous':
            sys.exit(1)
        elif risk_level == 'risky':
            sys.exit(2)
        else:
            sys.exit(0)
    
    elif args.action == 'protect':
        if not args.command:
            log_error("Command required for protect action")
            sys.exit(1)
        
        safety_report = protocol.check_operation_safety(args.command, args.interactive)
        
        print(format_safety_report(safety_report))
        
        # Create backups if recommended
        if safety_report['recommended_backups']:
            print("\n🛡️ Creating recommended backups...")
            backup_results = protocol.create_recommended_backups(safety_report['recommended_backups'])
            
            backup_success = all(result['success'] for result in backup_results.values())
            
            if backup_success:
                print("✅ All backups created successfully")
            else:
                print("❌ Some backups failed - operation may not be safe")
                if args.json:
                    print(json.dumps(backup_results, indent=2))
                sys.exit(1)
        
        # Final confirmation for critical/dangerous operations
        if safety_report['approval_required'] and args.interactive:
            print(f"\n⚠️  CONFIRMATION REQUIRED")
            print(f"This {safety_report['risk_level'].upper()} operation could lose data.")
            print(f"Safety score: {safety_report['safety_score']:.2f}/1.0")
            
            response = input("Type 'I understand the risks' to proceed: ")
            if response != 'I understand the risks':
                print("❌ Operation cancelled for safety")
                sys.exit(1)
            else:
                print("✅ Proceeding with operation (backups created)")
        
        sys.exit(0)
    
    elif args.action == 'create-backup':
        if not args.backup_type:
            log_error("--backup-type required for create-backup action")
            sys.exit(1)
        
        try:
            backup_type = BackupType(args.backup_type)
            success, location, error = protocol.backup_manager.create_backup(backup_type)
            
            if success:
                print(f"✅ Backup created: {location}")
                sys.exit(0)
            else:
                print(f"❌ Backup failed: {error}")
                sys.exit(1)
        except ValueError:
            log_error(f"Unknown backup type: {args.backup_type}")
            sys.exit(1)
    
    elif args.action == 'verify-safety':
        if not args.command:
            log_error("Command required for verify-safety action")
            sys.exit(1)
        
        safety_report = protocol.check_operation_safety(args.command, False)
        
        # Simple verification output
        print(f"Safety Score: {safety_report['safety_score']:.2f}/1.0")
        print(f"Risk Level: {safety_report['risk_level'].upper()}")
        print(f"Violations: {len(safety_report['violations'])}")
        print(f"Unsaved Work: {'Yes' if safety_report['has_unsaved_work'] else 'No'}")
        
        if args.json:
            print(json.dumps(safety_report, indent=2))
        
        sys.exit(0 if safety_report['safety_score'] >= 0.8 else 1)

if __name__ == "__main__":
    main()