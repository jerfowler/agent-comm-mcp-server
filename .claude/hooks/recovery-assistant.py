#!/usr/bin/env python3
"""
Recovery Assistant - Automatic Recovery and Rollback System
Provides automatic detection and recovery from data loss scenarios

This system provides:
1. Automatic detection of data loss situations
2. Recovery point discovery and analysis
3. Guided recovery procedures with step-by-step instructions
4. Rollback mechanisms for various operation types
5. Integration with existing backup systems
6. Emergency recovery protocols for critical data loss

Usage:
  ./recovery-assistant.py detect                    # Detect data loss situations
  ./recovery-assistant.py recover --auto            # Automatic recovery attempt
  ./recovery-assistant.py recover --interactive     # Interactive recovery guidance
  ./recovery-assistant.py rollback --operation=reset # Rollback specific operation
  ./recovery-assistant.py emergency                 # Emergency recovery protocol
  ./recovery-assistant.py list-recovery-points      # Show available recovery options
"""

import sys
import json
import os
import subprocess
import re
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from enum import Enum
from dataclasses import dataclass

class DataLossType(Enum):
    """Types of data loss that can be detected"""
    UNCOMMITTED_CHANGES_LOST = "uncommitted_changes_lost"
    FILES_DELETED = "files_deleted"
    BRANCH_DELETED = "branch_deleted"
    STASH_LOST = "stash_lost"
    REPOSITORY_CORRUPTED = "repository_corrupted"
    CONFIG_FILES_MISSING = "config_files_missing"
    BUILD_ARTIFACTS_MISSING = "build_artifacts_missing"
    WORK_DIRECTORY_EMPTY = "work_directory_empty"

class RecoveryPointType(Enum):
    """Types of recovery points available"""
    GIT_STASH = "git_stash"
    GIT_BRANCH = "git_branch"
    GIT_REFLOG = "git_reflog"
    BACKUP_DIRECTORY = "backup_directory"
    DESTRUCTIVE_GUARD_BACKUP = "destructive_guard_backup"
    RECENT_COMMITS = "recent_commits"
    AUTO_SAVE = "auto_save"

class RecoveryStrategy(Enum):
    """Recovery strategies available"""
    AUTOMATIC = "automatic"
    GUIDED = "guided"
    MANUAL = "manual"
    EMERGENCY = "emergency"

@dataclass
class RecoveryPoint:
    """Represents a point in time that can be recovered to"""
    point_type: RecoveryPointType
    identifier: str
    timestamp: datetime
    description: str
    confidence: float  # 0.0 to 1.0 - confidence this recovery point is useful
    files_affected: List[str]
    recovery_command: str
    verification_command: str

@dataclass
class DataLossIncident:
    """Represents a detected data loss incident"""
    loss_type: DataLossType
    detected_at: datetime
    description: str
    affected_files: List[str]
    severity: float  # 0.0 to 1.0 - severity of data loss
    recovery_points: List[RecoveryPoint]
    recommended_strategy: RecoveryStrategy

def log_debug(message: str) -> None:
    """Debug logging when enabled"""
    if os.environ.get('AGENT_COMM_HOOK_DEBUG') == 'true':
        print(f"[DEBUG] Recovery Assistant: {message}", file=sys.stderr)

def log_info(message: str) -> None:
    """Info logging to stderr"""
    print(f"[INFO] Recovery Assistant: {message}", file=sys.stderr)

def log_warning(message: str) -> None:
    """Warning logging to stderr"""  
    print(f"[WARNING] Recovery Assistant: {message}", file=sys.stderr)

def log_error(message: str) -> None:
    """Error logging to stderr"""
    print(f"[ERROR] Recovery Assistant: {message}", file=sys.stderr)

def run_git_command(args: List[str], cwd: str = None) -> Tuple[bool, str, str]:
    """Run a git command and return success, stdout, stderr"""
    try:
        result = subprocess.run(['git'] + args, capture_output=True, text=True, 
                              cwd=cwd or os.getcwd(), timeout=30)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", "Git command timed out"
    except Exception as e:
        return False, "", f"Git command failed: {e}"

class DataLossDetector:
    """Detect various types of data loss situations"""
    
    def __init__(self, cwd: str = None):
        self.cwd = cwd or os.getcwd()
        self.git_available = self._check_git_available()
        
    def _check_git_available(self) -> bool:
        """Check if we're in a git repository"""
        success, _, _ = run_git_command(['rev-parse', '--git-dir'], self.cwd)
        return success
    
    def detect_all_incidents(self) -> List[DataLossIncident]:
        """Detect all types of data loss incidents"""
        incidents = []
        
        # Check each type of data loss
        incidents.extend(self._detect_uncommitted_changes_lost())
        incidents.extend(self._detect_files_deleted())
        incidents.extend(self._detect_branch_deleted())
        incidents.extend(self._detect_stash_lost())
        incidents.extend(self._detect_repository_corruption())
        incidents.extend(self._detect_config_files_missing())
        incidents.extend(self._detect_empty_work_directory())
        
        return incidents
    
    def _detect_uncommitted_changes_lost(self) -> List[DataLossIncident]:
        """Detect when uncommitted changes may have been lost"""
        if not self.git_available:
            return []
        
        incidents = []
        
        # Check reflog for recent resets
        success, reflog_output, _ = run_git_command(['reflog', '--oneline', '-10'], self.cwd)
        if success and reflog_output:
            reset_pattern = r'HEAD@\{(\d+)\}.*reset:'
            for line in reflog_output.split('\n'):
                match = re.search(reset_pattern, line)
                if match:
                    # Found a recent reset - check if it might have lost changes
                    reflog_index = match.group(1)
                    
                    # Check if there were changes before the reset
                    success, diff_output, _ = run_git_command([
                        'diff', f'HEAD@{{{int(reflog_index) + 1}}}', f'HEAD@{{{reflog_index}}}'
                    ], self.cwd)
                    
                    if success and diff_output:
                        incident = DataLossIncident(
                            loss_type=DataLossType.UNCOMMITTED_CHANGES_LOST,
                            detected_at=datetime.now(),
                            description=f"Git reset may have lost uncommitted changes (reflog entry {reflog_index})",
                            affected_files=self._extract_files_from_diff(diff_output),
                            severity=0.8,
                            recovery_points=[],
                            recommended_strategy=RecoveryStrategy.GUIDED
                        )
                        incidents.append(incident)
                        break  # Only report the most recent reset
        
        return incidents
    
    def _detect_files_deleted(self) -> List[DataLossIncident]:
        """Detect when important files have been deleted"""
        incidents = []
        
        # Check for missing critical files
        critical_files = [
            'package.json', 'tsconfig.json', '.eslintrc.js', '.eslintrc.cjs', 
            'jest.config.js', 'jest.config.mjs', 'README.md', '.gitignore'
        ]
        
        missing_files = []
        for file_name in critical_files:
            file_path = Path(self.cwd) / file_name
            if not file_path.exists():
                # Check if this file was recently tracked in git
                if self.git_available:
                    success, _, _ = run_git_command(['log', '--oneline', '-1', '--', file_name], self.cwd)
                    if success:  # File was in git history
                        missing_files.append(file_name)
        
        if missing_files:
            incident = DataLossIncident(
                loss_type=DataLossType.CONFIG_FILES_MISSING,
                detected_at=datetime.now(),
                description=f"Critical configuration files are missing: {', '.join(missing_files)}",
                affected_files=missing_files,
                severity=0.9,
                recovery_points=[],
                recommended_strategy=RecoveryStrategy.GUIDED
            )
            incidents.append(incident)
        
        return incidents
    
    def _detect_branch_deleted(self) -> List[DataLossIncident]:
        """Detect when branches have been deleted recently"""
        if not self.git_available:
            return []
        
        incidents = []
        
        # Check reflog for branch deletions
        success, reflog_output, _ = run_git_command(['reflog', '--oneline', '--all', '-20'], self.cwd)
        if success and reflog_output:
            delete_pattern = r'delete branch (.+)'
            for line in reflog_output.split('\n'):
                match = re.search(delete_pattern, line, re.IGNORECASE)
                if match:
                    branch_name = match.group(1).strip()
                    
                    incident = DataLossIncident(
                        loss_type=DataLossType.BRANCH_DELETED,
                        detected_at=datetime.now(),
                        description=f"Branch '{branch_name}' was recently deleted",
                        affected_files=[],
                        severity=0.6,
                        recovery_points=[],
                        recommended_strategy=RecoveryStrategy.AUTOMATIC
                    )
                    incidents.append(incident)
        
        return incidents
    
    def _detect_stash_lost(self) -> List[DataLossIncident]:
        """Detect when stashes have been dropped recently"""
        if not self.git_available:
            return []
        
        incidents = []
        
        # This is tricky to detect reliably, but we can check reflog for stash operations
        success, reflog_output, _ = run_git_command(['reflog', 'stash', '--oneline', '-10'], self.cwd)
        if success and reflog_output:
            drop_count = len([line for line in reflog_output.split('\n') if 'drop' in line.lower()])
            if drop_count > 0:
                incident = DataLossIncident(
                    loss_type=DataLossType.STASH_LOST,
                    detected_at=datetime.now(),
                    description=f"Recent stash drops detected ({drop_count} operations)",
                    affected_files=[],
                    severity=0.4,
                    recovery_points=[],
                    recommended_strategy=RecoveryStrategy.GUIDED
                )
                incidents.append(incident)
        
        return incidents
    
    def _detect_repository_corruption(self) -> List[DataLossIncident]:
        """Detect git repository corruption"""
        if not self.git_available:
            return []
        
        incidents = []
        
        # Check git fsck
        success, fsck_output, fsck_error = run_git_command(['fsck', '--full'], self.cwd)
        if not success or 'error' in fsck_error.lower():
            incident = DataLossIncident(
                loss_type=DataLossType.REPOSITORY_CORRUPTED,
                detected_at=datetime.now(),
                description=f"Git repository corruption detected: {fsck_error}",
                affected_files=[],
                severity=0.95,
                recovery_points=[],
                recommended_strategy=RecoveryStrategy.EMERGENCY
            )
            incidents.append(incident)
        
        return incidents
    
    def _detect_empty_work_directory(self) -> List[DataLossIncident]:
        """Detect when work directory is suspiciously empty"""
        incidents = []
        
        # Count important files
        important_extensions = ['.js', '.ts', '.py', '.md', '.json', '.yaml', '.yml']
        important_files = []
        
        for ext in important_extensions:
            files = list(Path(self.cwd).glob(f'**/*{ext}'))
            important_files.extend(files)
        
        # If we have very few important files but this looks like a project directory
        if len(important_files) < 3:
            # Check if this might be a project directory based on git history
            if self.git_available:
                success, log_output, _ = run_git_command(['log', '--oneline', '-5'], self.cwd)
                if success and log_output:  # Has git history
                    incident = DataLossIncident(
                        loss_type=DataLossType.WORK_DIRECTORY_EMPTY,
                        detected_at=datetime.now(),
                        description="Work directory appears unusually empty for a project with git history",
                        affected_files=[],
                        severity=0.7,
                        recovery_points=[],
                        recommended_strategy=RecoveryStrategy.GUIDED
                    )
                    incidents.append(incident)
        
        return incidents
    
    def _extract_files_from_diff(self, diff_output: str) -> List[str]:
        """Extract file names from git diff output"""
        files = []
        for line in diff_output.split('\n'):
            if line.startswith('diff --git'):
                # Extract file path from "diff --git a/file b/file"
                parts = line.split(' ')
                if len(parts) >= 4:
                    file_path = parts[3][2:]  # Remove "b/" prefix
                    files.append(file_path)
        return files

class RecoveryPointDiscovery:
    """Discover available recovery points for data recovery"""
    
    def __init__(self, cwd: str = None):
        self.cwd = cwd or os.getcwd()
        self.git_available = self._check_git_available()
    
    def _check_git_available(self) -> bool:
        """Check if we're in a git repository"""
        success, _, _ = run_git_command(['rev-parse', '--git-dir'], self.cwd)
        return success
    
    def discover_all_recovery_points(self) -> List[RecoveryPoint]:
        """Discover all available recovery points"""
        recovery_points = []
        
        if self.git_available:
            recovery_points.extend(self._discover_git_stashes())
            recovery_points.extend(self._discover_git_branches())
            recovery_points.extend(self._discover_git_reflog())
            recovery_points.extend(self._discover_recent_commits())
        
        recovery_points.extend(self._discover_backup_directories())
        recovery_points.extend(self._discover_destructive_guard_backups())
        
        # Sort by confidence and recency
        recovery_points.sort(key=lambda rp: (rp.confidence, rp.timestamp), reverse=True)
        
        return recovery_points
    
    def _discover_git_stashes(self) -> List[RecoveryPoint]:
        """Discover git stashes"""
        recovery_points = []
        
        success, stash_output, _ = run_git_command(['stash', 'list'], self.cwd)
        if success and stash_output:
            for line in stash_output.split('\n'):
                if line.strip():
                    # Parse stash entry: "stash@{0}: WIP on main: abc123 commit message"
                    match = re.match(r'(stash@\{(\d+)\}): (.+)', line)
                    if match:
                        stash_ref = match.group(1)
                        stash_index = match.group(2)
                        stash_desc = match.group(3)
                        
                        # Get stash timestamp
                        success, timestamp_output, _ = run_git_command([
                            'stash', 'show', '--format=%ci', stash_ref
                        ], self.cwd)
                        
                        try:
                            if success and timestamp_output:
                                timestamp = datetime.fromisoformat(timestamp_output.split('\n')[0].rsplit(' ', 1)[0])
                            else:
                                timestamp = datetime.now() - timedelta(hours=int(stash_index))
                        except:
                            timestamp = datetime.now() - timedelta(hours=int(stash_index))
                        
                        # Get affected files
                        success, files_output, _ = run_git_command([
                            'stash', 'show', '--name-only', stash_ref
                        ], self.cwd)
                        affected_files = files_output.split('\n') if success and files_output else []
                        
                        recovery_point = RecoveryPoint(
                            point_type=RecoveryPointType.GIT_STASH,
                            identifier=stash_ref,
                            timestamp=timestamp,
                            description=f"Git stash: {stash_desc}",
                            confidence=0.9,  # Stashes are highly reliable
                            files_affected=affected_files,
                            recovery_command=f"git stash pop {stash_ref}",
                            verification_command=f"git stash show {stash_ref} --stat"
                        )
                        recovery_points.append(recovery_point)
        
        return recovery_points
    
    def _discover_git_branches(self) -> List[RecoveryPoint]:
        """Discover backup branches and recent branches"""
        recovery_points = []
        
        success, branch_output, _ = run_git_command(['branch', '-a', '--sort=-committerdate'], self.cwd)
        if success and branch_output:
            for line in branch_output.split('\n')[:10]:  # Check most recent 10 branches
                line = line.strip().replace('*', '').strip()
                if line and not line.startswith('origin/HEAD'):
                    branch_name = line.replace('origin/', '') if line.startswith('origin/') else line
                    
                    # Skip current branch
                    success, current_branch, _ = run_git_command(['branch', '--show-current'], self.cwd)
                    if success and current_branch == branch_name:
                        continue
                    
                    # Get branch info
                    success, commit_info, _ = run_git_command([
                        'show', '--format=%ci|%s', '--name-only', '-1', branch_name
                    ], self.cwd)
                    
                    if success and commit_info:
                        lines = commit_info.split('\n')
                        if lines:
                            timestamp_and_subject = lines[0].split('|', 1)
                            if len(timestamp_and_subject) == 2:
                                try:
                                    timestamp_str = timestamp_and_subject[0].rsplit(' ', 1)[0]
                                    timestamp = datetime.fromisoformat(timestamp_str)
                                except:
                                    timestamp = datetime.now() - timedelta(days=1)
                                
                                subject = timestamp_and_subject[1]
                                affected_files = [f for f in lines[2:] if f.strip()]
                                
                                confidence = 0.8 if 'backup' in branch_name.lower() else 0.6
                                
                                recovery_point = RecoveryPoint(
                                    point_type=RecoveryPointType.GIT_BRANCH,
                                    identifier=branch_name,
                                    timestamp=timestamp,
                                    description=f"Branch '{branch_name}': {subject}",
                                    confidence=confidence,
                                    files_affected=affected_files,
                                    recovery_command=f"git checkout {branch_name}",
                                    verification_command=f"git log --oneline -5 {branch_name}"
                                )
                                recovery_points.append(recovery_point)
        
        return recovery_points
    
    def _discover_git_reflog(self) -> List[RecoveryPoint]:
        """Discover recovery points from git reflog"""
        recovery_points = []
        
        success, reflog_output, _ = run_git_command(['reflog', '--format=%H|%gd|%ci|%gs', '-20'], self.cwd)
        if success and reflog_output:
            for line in reflog_output.split('\n'):
                if line.strip():
                    parts = line.split('|', 3)
                    if len(parts) == 4:
                        commit_hash, ref_name, timestamp_str, subject = parts
                        
                        try:
                            timestamp = datetime.fromisoformat(timestamp_str.rsplit(' ', 1)[0])
                        except:
                            continue
                        
                        # Focus on potentially useful reflog entries
                        if any(keyword in subject.lower() for keyword in ['commit', 'merge', 'checkout', 'reset']):
                            recovery_point = RecoveryPoint(
                                point_type=RecoveryPointType.GIT_REFLOG,
                                identifier=commit_hash[:8],
                                timestamp=timestamp,
                                description=f"Reflog {ref_name}: {subject}",
                                confidence=0.5,  # Lower confidence for reflog entries
                                files_affected=[],
                                recovery_command=f"git reset --hard {commit_hash}",
                                verification_command=f"git show --stat {commit_hash}"
                            )
                            recovery_points.append(recovery_point)
        
        return recovery_points[:5]  # Limit to most recent 5
    
    def _discover_recent_commits(self) -> List[RecoveryPoint]:
        """Discover recent commits as recovery points"""
        recovery_points = []
        
        success, log_output, _ = run_git_command([
            'log', '--format=%H|%ci|%s', '--name-only', '-10'
        ], self.cwd)
        
        if success and log_output:
            current_commit = None
            current_files = []
            
            for line in log_output.split('\n'):
                if not line.strip():
                    continue
                
                if '|' in line:  # Commit info line
                    if current_commit:  # Save previous commit
                        recovery_points.append(current_commit)
                    
                    parts = line.split('|', 2)
                    if len(parts) == 3:
                        commit_hash, timestamp_str, subject = parts
                        
                        try:
                            timestamp = datetime.fromisoformat(timestamp_str.rsplit(' ', 1)[0])
                        except:
                            continue
                        
                        current_commit = RecoveryPoint(
                            point_type=RecoveryPointType.RECENT_COMMITS,
                            identifier=commit_hash[:8],
                            timestamp=timestamp,
                            description=f"Commit: {subject}",
                            confidence=0.7,
                            files_affected=[],
                            recovery_command=f"git checkout {commit_hash}",
                            verification_command=f"git show --stat {commit_hash}"
                        )
                        current_files = []
                else:  # File name line
                    current_files.append(line.strip())
                    if current_commit:
                        current_commit.files_affected = current_files[:]
            
            if current_commit:  # Don't forget the last one
                recovery_points.append(current_commit)
        
        return recovery_points[:5]  # Limit to 5 most recent
    
    def _discover_backup_directories(self) -> List[RecoveryPoint]:
        """Discover backup directories"""
        recovery_points = []
        
        # Check common backup directory locations
        backup_locations = [
            Path(self.cwd).parent,  # Parent directory
            Path(self.cwd),  # Current directory
            Path.home() / 'backups',  # Home backups
        ]
        
        for location in backup_locations:
            if location.exists():
                # Look for backup directories
                for item in location.iterdir():
                    if item.is_dir() and any(keyword in item.name.lower() for keyword in 
                                           ['backup', 'bak', 'old', 'copy', 'archive']):
                        try:
                            # Get directory timestamp
                            timestamp = datetime.fromtimestamp(item.stat().st_mtime)
                            
                            # Check if it looks like our project
                            confidence = 0.3
                            if (item / 'package.json').exists() or (item / '.git').exists():
                                confidence = 0.7
                            
                            recovery_point = RecoveryPoint(
                                point_type=RecoveryPointType.BACKUP_DIRECTORY,
                                identifier=str(item),
                                timestamp=timestamp,
                                description=f"Backup directory: {item.name}",
                                confidence=confidence,
                                files_affected=[],
                                recovery_command=f"cp -r {item}/* {self.cwd}/",
                                verification_command=f"ls -la {item}"
                            )
                            recovery_points.append(recovery_point)
                        except:
                            continue
        
        return recovery_points
    
    def _discover_destructive_guard_backups(self) -> List[RecoveryPoint]:
        """Discover backups created by destructive-operation-guard"""
        recovery_points = []
        
        backup_dir = Path(self.cwd) / '.destructive-guard-backups'
        if backup_dir.exists():
            for backup_item in backup_dir.iterdir():
                if backup_item.is_dir():
                    try:
                        timestamp = datetime.fromtimestamp(backup_item.stat().st_mtime)
                        
                        recovery_point = RecoveryPoint(
                            point_type=RecoveryPointType.DESTRUCTIVE_GUARD_BACKUP,
                            identifier=str(backup_item),
                            timestamp=timestamp,
                            description=f"Destructive Guard backup: {backup_item.name}",
                            confidence=0.95,  # Very high confidence - these are deliberate backups
                            files_affected=[],
                            recovery_command=f"cp -r {backup_item}/* {self.cwd}/",
                            verification_command=f"ls -la {backup_item}"
                        )
                        recovery_points.append(recovery_point)
                    except:
                        continue
        
        return recovery_points

class RecoveryOrchestrator:
    """Orchestrate recovery operations"""
    
    def __init__(self, cwd: str = None):
        self.cwd = cwd or os.getcwd()
        self.detector = DataLossDetector(self.cwd)
        self.discovery = RecoveryPointDiscovery(self.cwd)
    
    def perform_automatic_recovery(self) -> Dict[str, Any]:
        """Attempt automatic recovery from detected data loss"""
        incidents = self.detector.detect_all_incidents()
        recovery_points = self.discovery.discover_all_recovery_points()
        
        results = {
            'incidents_detected': len(incidents),
            'recovery_points_found': len(recovery_points),
            'recovery_attempts': [],
            'success': False
        }
        
        if not incidents:
            results['message'] = "No data loss incidents detected"
            results['success'] = True
            return results
        
        if not recovery_points:
            results['message'] = "No recovery points found"
            return results
        
        # Match incidents to recovery points and attempt recovery
        for incident in incidents:
            best_recovery_point = self._find_best_recovery_point(incident, recovery_points)
            
            if best_recovery_point and best_recovery_point.confidence >= 0.8:
                # Attempt automatic recovery
                success, message = self._attempt_recovery(best_recovery_point, automatic=True)
                
                results['recovery_attempts'].append({
                    'incident': incident.description,
                    'recovery_point': best_recovery_point.description,
                    'success': success,
                    'message': message
                })
                
                if success:
                    results['success'] = True
                    log_info(f"Successfully recovered from: {incident.description}")
                else:
                    log_warning(f"Failed to recover from: {incident.description}: {message}")
        
        return results
    
    def perform_interactive_recovery(self) -> Dict[str, Any]:
        """Perform interactive recovery with user guidance"""
        incidents = self.detector.detect_all_incidents()
        recovery_points = self.discovery.discover_all_recovery_points()
        
        if not incidents:
            print("✅ No data loss incidents detected.")
            return {'success': True, 'message': 'No recovery needed'}
        
        print(f"🔍 Detected {len(incidents)} potential data loss incidents:")
        for i, incident in enumerate(incidents, 1):
            severity_indicator = "🚨" if incident.severity >= 0.8 else "⚠️" if incident.severity >= 0.5 else "ℹ️"
            print(f"  {i}. {severity_indicator} {incident.description} (severity: {incident.severity:.1f})")
        
        if not recovery_points:
            print("❌ No recovery points found.")
            return {'success': False, 'message': 'No recovery options available'}
        
        print(f"\n🛡️ Found {len(recovery_points)} potential recovery points:")
        for i, rp in enumerate(recovery_points[:10], 1):  # Show top 10
            confidence_indicator = "🔥" if rp.confidence >= 0.8 else "✅" if rp.confidence >= 0.6 else "🤔"
            print(f"  {i}. {confidence_indicator} {rp.description}")
            print(f"     Confidence: {rp.confidence:.1f}, Files: {len(rp.files_affected)}, Age: {self._format_age(rp.timestamp)}")
        
        # Interactive recovery selection
        try:
            choice = input("\nSelect a recovery point (1-10) or 'q' to quit: ")
            if choice.lower() == 'q':
                return {'success': False, 'message': 'User cancelled recovery'}
            
            choice_idx = int(choice) - 1
            if 0 <= choice_idx < len(recovery_points):
                selected_rp = recovery_points[choice_idx]
                
                print(f"\n📋 Selected recovery point: {selected_rp.description}")
                print(f"Recovery command: {selected_rp.recovery_command}")
                print(f"Verification: {selected_rp.verification_command}")
                
                confirm = input("\nProceed with recovery? (yes/no): ")
                if confirm.lower() == 'yes':
                    success, message = self._attempt_recovery(selected_rp, automatic=False)
                    return {'success': success, 'message': message}
                else:
                    return {'success': False, 'message': 'User cancelled recovery'}
            else:
                return {'success': False, 'message': 'Invalid selection'}
        
        except (ValueError, KeyboardInterrupt):
            return {'success': False, 'message': 'Invalid input or user cancelled'}
    
    def _find_best_recovery_point(self, incident: DataLossIncident, 
                                 recovery_points: List[RecoveryPoint]) -> Optional[RecoveryPoint]:
        """Find the best recovery point for a specific incident"""
        if not recovery_points:
            return None
        
        # Score recovery points based on relevance to incident
        scored_points = []
        
        for rp in recovery_points:
            score = rp.confidence
            
            # Boost score if files match
            if incident.affected_files and rp.files_affected:
                file_overlap = set(incident.affected_files) & set(rp.files_affected)
                if file_overlap:
                    score += 0.2 * (len(file_overlap) / max(len(incident.affected_files), 1))
            
            # Prefer more recent recovery points for certain incident types
            if incident.loss_type in [DataLossType.UNCOMMITTED_CHANGES_LOST, DataLossType.FILES_DELETED]:
                age_days = (datetime.now() - rp.timestamp).days
                if age_days <= 1:
                    score += 0.1
            
            # Prefer certain recovery point types for specific incidents
            type_preferences = {
                DataLossType.UNCOMMITTED_CHANGES_LOST: [RecoveryPointType.GIT_STASH, RecoveryPointType.GIT_REFLOG],
                DataLossType.FILES_DELETED: [RecoveryPointType.DESTRUCTIVE_GUARD_BACKUP, RecoveryPointType.BACKUP_DIRECTORY],
                DataLossType.BRANCH_DELETED: [RecoveryPointType.GIT_REFLOG, RecoveryPointType.GIT_BRANCH],
                DataLossType.CONFIG_FILES_MISSING: [RecoveryPointType.BACKUP_DIRECTORY, RecoveryPointType.RECENT_COMMITS]
            }
            
            if incident.loss_type in type_preferences:
                if rp.point_type in type_preferences[incident.loss_type]:
                    score += 0.15
            
            scored_points.append((score, rp))
        
        # Return the highest scored recovery point
        scored_points.sort(key=lambda x: x[0], reverse=True)
        return scored_points[0][1] if scored_points else None
    
    def _attempt_recovery(self, recovery_point: RecoveryPoint, automatic: bool = False) -> Tuple[bool, str]:
        """Attempt to execute a recovery operation"""
        log_info(f"Attempting recovery using: {recovery_point.description}")
        
        # Create backup before recovery attempt
        if not automatic:
            backup_name = f"pre-recovery-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            try:
                shutil.copytree(self.cwd, f"{self.cwd}/../{backup_name}", 
                              ignore=shutil.ignore_patterns('.git', 'node_modules', '.cache'))
                log_info(f"Created pre-recovery backup: ../{backup_name}")
            except:
                log_warning("Failed to create pre-recovery backup")
        
        # Execute recovery command
        try:
            if recovery_point.recovery_command.startswith('git '):
                # Execute git command
                git_args = recovery_point.recovery_command[4:].split()
                success, stdout, stderr = run_git_command(git_args, self.cwd)
                
                if success:
                    log_info(f"Recovery command succeeded: {stdout}")
                    return True, f"Recovery successful: {recovery_point.description}"
                else:
                    log_error(f"Recovery command failed: {stderr}")
                    return False, f"Recovery failed: {stderr}"
            
            elif recovery_point.recovery_command.startswith('cp '):
                # Execute copy command
                result = subprocess.run(recovery_point.recovery_command, shell=True, 
                                      capture_output=True, text=True, cwd=self.cwd)
                
                if result.returncode == 0:
                    log_info("File recovery successful")
                    return True, f"Recovery successful: {recovery_point.description}"
                else:
                    log_error(f"File recovery failed: {result.stderr}")
                    return False, f"File recovery failed: {result.stderr}"
            
            else:
                return False, f"Unsupported recovery command: {recovery_point.recovery_command}"
        
        except Exception as e:
            log_error(f"Recovery attempt failed with exception: {e}")
            return False, f"Recovery failed with exception: {e}"
    
    def _format_age(self, timestamp: datetime) -> str:
        """Format timestamp age in human readable format"""
        age = datetime.now() - timestamp
        
        if age.days > 0:
            return f"{age.days}d ago"
        elif age.seconds > 3600:
            return f"{age.seconds // 3600}h ago"
        elif age.seconds > 60:
            return f"{age.seconds // 60}m ago"
        else:
            return "just now"

def main():
    """Main CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Recovery Assistant - Automatic Recovery System')
    parser.add_argument('action', choices=['detect', 'recover', 'rollback', 'emergency', 'list-recovery-points'],
                       help='Action to perform')
    parser.add_argument('--auto', action='store_true', 
                       help='Perform automatic recovery without user interaction')
    parser.add_argument('--interactive', action='store_true', default=True,
                       help='Perform interactive recovery with user guidance (default)')
    parser.add_argument('--operation', type=str,
                       help='Specific operation to rollback')
    parser.add_argument('--json', action='store_true',
                       help='Output results in JSON format')
    
    args = parser.parse_args()
    
    orchestrator = RecoveryOrchestrator()
    
    if args.action == 'detect':
        incidents = orchestrator.detector.detect_all_incidents()
        
        if args.json:
            incidents_data = []
            for incident in incidents:
                incidents_data.append({
                    'type': incident.loss_type.value,
                    'description': incident.description,
                    'severity': incident.severity,
                    'affected_files': incident.affected_files,
                    'detected_at': incident.detected_at.isoformat()
                })
            print(json.dumps({'incidents': incidents_data}, indent=2))
        else:
            if not incidents:
                print("✅ No data loss incidents detected.")
            else:
                print(f"🔍 Detected {len(incidents)} potential data loss incidents:")
                for i, incident in enumerate(incidents, 1):
                    severity_indicator = "🚨" if incident.severity >= 0.8 else "⚠️" if incident.severity >= 0.5 else "ℹ️"
                    print(f"  {i}. {severity_indicator} {incident.description}")
                    print(f"     Severity: {incident.severity:.2f}, Files: {len(incident.affected_files)}")
        
        sys.exit(1 if incidents else 0)
    
    elif args.action == 'recover':
        if args.auto:
            results = orchestrator.perform_automatic_recovery()
        else:
            results = orchestrator.perform_interactive_recovery()
        
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            print(f"Recovery result: {results.get('message', 'Recovery completed')}")
        
        sys.exit(0 if results['success'] else 1)
    
    elif args.action == 'list-recovery-points':
        recovery_points = orchestrator.discovery.discover_all_recovery_points()
        
        if args.json:
            points_data = []
            for rp in recovery_points:
                points_data.append({
                    'type': rp.point_type.value,
                    'identifier': rp.identifier,
                    'description': rp.description,
                    'confidence': rp.confidence,
                    'timestamp': rp.timestamp.isoformat(),
                    'files_affected': rp.files_affected,
                    'recovery_command': rp.recovery_command
                })
            print(json.dumps({'recovery_points': points_data}, indent=2))
        else:
            if not recovery_points:
                print("❌ No recovery points found.")
            else:
                print(f"🛡️ Found {len(recovery_points)} recovery points:")
                for i, rp in enumerate(recovery_points, 1):
                    confidence_indicator = "🔥" if rp.confidence >= 0.8 else "✅" if rp.confidence >= 0.6 else "🤔"
                    age = orchestrator._format_age(rp.timestamp)
                    print(f"  {i}. {confidence_indicator} {rp.description}")
                    print(f"     Type: {rp.point_type.value}, Confidence: {rp.confidence:.2f}, Age: {age}")
                    print(f"     Command: {rp.recovery_command}")
        
        sys.exit(0)
    
    elif args.action == 'emergency':
        print("🚨 EMERGENCY RECOVERY PROTOCOL")
        print("This will attempt to recover from critical data loss situations.")
        print()
        
        # Detect critical incidents
        incidents = orchestrator.detector.detect_all_incidents()
        critical_incidents = [i for i in incidents if i.severity >= 0.8]
        
        if not critical_incidents:
            print("✅ No critical data loss detected.")
            sys.exit(0)
        
        print(f"🚨 {len(critical_incidents)} critical incidents detected:")
        for incident in critical_incidents:
            print(f"  • {incident.description}")
        
        # Find highest confidence recovery points
        recovery_points = orchestrator.discovery.discover_all_recovery_points()
        high_confidence_points = [rp for rp in recovery_points if rp.confidence >= 0.8]
        
        if not high_confidence_points:
            print("❌ No high-confidence recovery points available.")
            print("Manual recovery may be required.")
            sys.exit(1)
        
        print(f"\n🛡️ {len(high_confidence_points)} high-confidence recovery options:")
        for i, rp in enumerate(high_confidence_points[:5], 1):
            print(f"  {i}. {rp.description} (confidence: {rp.confidence:.2f})")
        
        if not args.auto:
            confirm = input("\nProceed with emergency recovery? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Emergency recovery cancelled.")
                sys.exit(1)
        
        # Attempt recovery with highest confidence point
        best_point = high_confidence_points[0]
        success, message = orchestrator._attempt_recovery(best_point, automatic=args.auto)
        
        print(f"\nEmergency recovery result: {message}")
        sys.exit(0 if success else 1)
    
    else:
        print(f"Unknown action: {args.action}")
        sys.exit(1)

if __name__ == "__main__":
    main()