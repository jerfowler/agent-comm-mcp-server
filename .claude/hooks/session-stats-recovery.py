#!/usr/bin/env python3
"""
Claude Code Session Stats Recovery Hook
Restores context from pre-compact state captures

This hook looks for pre-compact state files and provides context recovery
information to help restore session continuity after compaction events.

Triggered on: Session start/stats events
Exit codes:
  0 = No recovery needed or completed
  2 = Recovery information displayed
"""

import sys
import json
import os
import datetime
import glob
from pathlib import Path
from typing import Dict, Any, List, Optional

def log_debug(message: str) -> None:
    """Debug logging when AGENT_COMM_HOOK_DEBUG is enabled"""
    if os.environ.get('AGENT_COMM_HOOK_DEBUG') == 'true':
        print(f"[DEBUG] Session Recovery: {message}", file=sys.stderr)

def find_state_files() -> List[Path]:
    """Find all pre-compact state files in .claude directory"""
    claude_dir = Path.cwd() / '.claude'
    if not claude_dir.exists():
        return []
    
    # Look for pre-compact state files
    pattern = str(claude_dir / "pre-compact-state-*.json")
    state_files = [Path(f) for f in glob.glob(pattern)]
    
    # Sort by modification time (newest first)
    state_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    
    return state_files

def load_state_file(state_file: Path) -> Optional[Dict[str, Any]]:
    """Load and parse a state file"""
    try:
        with open(state_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        log_debug(f"Failed to load state file {state_file}: {e}")
        return None

def format_timestamp(iso_timestamp: str) -> str:
    """Format ISO timestamp for display"""
    try:
        dt = datetime.datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        now = datetime.datetime.now(dt.tzinfo) if dt.tzinfo else datetime.datetime.now()
        
        # Calculate time difference
        diff = now - dt
        
        if diff.days > 0:
            return f"{diff.days} day(s) ago"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} hour(s) ago"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} minute(s) ago"
        else:
            return "Just now"
            
    except Exception:
        return iso_timestamp

def create_recovery_summary(state_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a recovery summary from state data"""
    summary = {
        "timestamp": state_data.get("timestamp"),
        "age": format_timestamp(state_data.get("timestamp", "")),
        "context_items": []
    }
    
    # Project information
    if "project_context" in state_data and "name" in state_data["project_context"]:
        proj = state_data["project_context"]
        summary["project"] = {
            "name": proj.get("name"),
            "version": proj.get("version"),
            "description": proj.get("description")
        }
        summary["context_items"].append("Project details")
    
    # Git context
    if "git_context" in state_data:
        git = state_data["git_context"]
        if "current_branch" in git:
            summary["git"] = {
                "branch": git["current_branch"],
                "recent_commits": git.get("recent_commits", [])[:3],  # Top 3
                "has_changes": bool(git.get("status", "").strip())
            }
            summary["context_items"].append("Git status")
    
    # Agent communication context
    if "agent_comm" in state_data and "agents" in state_data["agent_comm"]:
        agents = state_data["agent_comm"]["agents"]
        active_agents = [a for a in agents if a.get("tasks")]
        
        if active_agents:
            summary["agents"] = {
                "count": len(active_agents),
                "details": []
            }
            
            for agent in active_agents[:5]:  # Top 5 agents
                task_count = len(agent.get("tasks", []))
                in_progress = len([t for t in agent.get("tasks", []) if t.get("status") == "PLAN"])
                completed = len([t for t in agent.get("tasks", []) if t.get("status") == "DONE"])
                
                summary["agents"]["details"].append({
                    "name": agent["name"],
                    "total_tasks": task_count,
                    "in_progress": in_progress,
                    "completed": completed
                })
            
            summary["context_items"].append("Agent tasks")
    
    # Todo context
    if "todo_context" in state_data:
        summary["context_items"].append("Todo list")
    
    # Working directory
    if "working_directory" in state_data:
        wd = state_data["working_directory"]
        summary["working_directory"] = {
            "name": wd.get("name"),
            "path": wd.get("path"),
            "is_git_repo": wd.get("is_git_repo", False)
        }
        summary["context_items"].append("Directory context")
    
    return summary

def generate_recovery_message(summaries: List[Dict[str, Any]], newest_file: Path) -> str:
    """Generate recovery information message"""
    if not summaries:
        return ""
    
    newest = summaries[0]
    total_files = len(summaries)
    
    message_lines = [
        "🔄 Session recovery information available",
        "",
        f"📄 Found {total_files} state capture(s), newest from {newest['age']}"
    ]
    
    # Project context
    if "project" in newest:
        proj = newest["project"]
        project_line = f"📦 Project: {proj['name']}"
        if proj.get("version"):
            project_line += f" v{proj['version']}"
        message_lines.append(project_line)
    
    # Git context
    if "git" in newest:
        git = newest["git"]
        git_line = f"🌿 Branch: {git['branch']}"
        if git.get("has_changes"):
            git_line += " (with uncommitted changes)"
        message_lines.append(git_line)
        
        if git.get("recent_commits"):
            message_lines.append("📝 Recent commits:")
            for commit in git["recent_commits"]:
                message_lines.append(f"   • {commit}")
    
    # Agent context
    if "agents" in newest:
        agents = newest["agents"]
        message_lines.append(f"🤖 Active agents: {agents['count']}")
        
        if agents.get("details"):
            message_lines.append("📊 Agent status:")
            for agent in agents["details"]:
                status_parts = []
                if agent["in_progress"]:
                    status_parts.append(f"{agent['in_progress']} in progress")
                if agent["completed"]:
                    status_parts.append(f"{agent['completed']} completed")
                
                status_text = f" ({', '.join(status_parts)})" if status_parts else ""
                message_lines.append(f"   • {agent['name']}: {agent['total_tasks']} task(s){status_text}")
    
    # Available context
    if newest.get("context_items"):
        context_list = ", ".join(newest["context_items"])
        message_lines.append(f"💾 Captured: {context_list}")
    
    message_lines.extend([
        "",
        f"🗃️  State file: {newest_file.name}",
        "ℹ️  Use this information to restore your working context."
    ])
    
    return "\n".join(message_lines)

def cleanup_old_state_files(state_files: List[Path], keep_count: int = 5) -> None:
    """Clean up old state files, keeping only the most recent ones"""
    if len(state_files) <= keep_count:
        return
    
    files_to_remove = state_files[keep_count:]
    for file_path in files_to_remove:
        try:
            file_path.unlink()
            log_debug(f"Cleaned up old state file: {file_path.name}")
        except Exception as e:
            log_debug(f"Failed to clean up {file_path.name}: {e}")

def handle_session_stats_event(hook_data: Dict) -> tuple[int, str]:
    """Handle session stats event and provide recovery info"""
    try:
        # Find available state files
        state_files = find_state_files()
        
        if not state_files:
            log_debug("No state files found")
            return 0, ""  # No recovery needed
        
        # Load and process state files
        summaries = []
        for state_file in state_files[:3]:  # Process top 3 files
            state_data = load_state_file(state_file)
            if state_data:
                summary = create_recovery_summary(state_data)
                summaries.append(summary)
        
        if not summaries:
            log_debug("No valid state files found")
            return 0, ""
        
        # Generate recovery message
        message = generate_recovery_message(summaries, state_files[0])
        
        # Clean up old files (keep 5 most recent)
        cleanup_old_state_files(state_files)
        
        return 2, message if message else ""
        
    except Exception as e:
        log_debug(f"Session recovery failed: {e}")
        return 0, ""  # Don't block session on recovery failure

def main() -> None:
    """Main hook entry point"""
    try:
        # Read JSON input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            # Also check for state files on empty input (session start)
            exit_code, message = handle_session_stats_event({})
        else:
            hook_data = json.loads(input_data)
            log_debug("Received session stats hook data")
            exit_code, message = handle_session_stats_event(hook_data)
        
        if message:
            print(message, file=sys.stderr)
        
        sys.exit(exit_code)
        
    except json.JSONDecodeError:
        log_debug("Invalid JSON input, checking for state files anyway")
        exit_code, message = handle_session_stats_event({})
        if message:
            print(message, file=sys.stderr)
        sys.exit(exit_code)
    except Exception as e:
        log_debug(f"Hook error: {e}")
        sys.exit(0)  # Allow operation on unexpected error

if __name__ == "__main__":
    main()