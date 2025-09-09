#!/usr/bin/env python3
"""
Claude Code Pre-Compact State Capture Hook
Preserves session context before compact operations

This hook captures comprehensive session state before Claude Code performs
context compaction, ensuring critical information is preserved for recovery.

Triggered on: Auto-compact events (before compaction)
Exit codes:
  0 = State captured successfully
  2 = Warning with state capture details
"""

import sys
import json
import os
import datetime
from pathlib import Path
from typing import Dict, Any, Optional

def log_debug(message: str) -> None:
    """Debug logging when AGENT_COMM_HOOK_DEBUG is enabled"""
    if os.environ.get('AGENT_COMM_HOOK_DEBUG') == 'true':
        print(f"[DEBUG] Pre-Compact: {message}", file=sys.stderr)

def get_state_file_path() -> Path:
    """Get the path for the state capture file"""
    # Store in .claude directory for easy access
    claude_dir = Path.cwd() / '.claude'
    claude_dir.mkdir(exist_ok=True)
    
    # Use timestamp in filename for uniqueness
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    return claude_dir / f"pre-compact-state-{timestamp}.json"

def capture_session_context(hook_data: Dict) -> Dict[str, Any]:
    """Capture comprehensive session context"""
    context = {
        "timestamp": datetime.datetime.now().isoformat(),
        "event_type": "pre-compact",
        "hook_data": hook_data,
    }
    
    # Capture current working directory context
    cwd = Path.cwd()
    context["working_directory"] = {
        "path": str(cwd),
        "name": cwd.name,
        "is_git_repo": (cwd / '.git').exists(),
    }
    
    # Capture git context if available
    try:
        import subprocess
        
        # Get current branch
        result = subprocess.run(['git', 'branch', '--show-current'], 
                              capture_output=True, text=True, cwd=cwd)
        if result.returncode == 0:
            context["git_context"] = {
                "current_branch": result.stdout.strip(),
            }
            
            # Get recent commits
            result = subprocess.run(['git', 'log', '--oneline', '-5'], 
                                  capture_output=True, text=True, cwd=cwd)
            if result.returncode == 0:
                context["git_context"]["recent_commits"] = result.stdout.strip().split('\n')
            
            # Get git status
            result = subprocess.run(['git', 'status', '--porcelain'], 
                                  capture_output=True, text=True, cwd=cwd)
            if result.returncode == 0:
                context["git_context"]["status"] = result.stdout.strip()
                
    except Exception as e:
        log_debug(f"Git context capture failed: {e}")
        context["git_context"] = {"error": str(e)}
    
    # Capture project context
    try:
        # Package.json info
        package_json = cwd / 'package.json'
        if package_json.exists():
            with open(package_json, 'r') as f:
                package_data = json.load(f)
                context["project_context"] = {
                    "name": package_data.get("name"),
                    "version": package_data.get("version"),
                    "description": package_data.get("description"),
                }
        
        # Todo list if available
        todo_indicators = ['.claude/todo.json', 'TODO.md', '.todo']
        for todo_file in todo_indicators:
            todo_path = cwd / todo_file
            if todo_path.exists():
                try:
                    with open(todo_path, 'r') as f:
                        if todo_file.endswith('.json'):
                            context["todo_context"] = json.load(f)
                        else:
                            context["todo_context"] = {"content": f.read()}
                    break
                except Exception as e:
                    log_debug(f"Todo capture failed for {todo_file}: {e}")
        
    except Exception as e:
        log_debug(f"Project context capture failed: {e}")
        context["project_context"] = {"error": str(e)}
    
    # Capture environment context
    context["environment"] = {
        "user": os.environ.get("USER", "unknown"),
        "pwd": os.environ.get("PWD"),
        "shell": os.environ.get("SHELL"),
        "node_version": os.environ.get("NODE_VERSION"),
        "npm_version": os.environ.get("NPM_VERSION"),
    }
    
    # Capture agent communication context if available
    try:
        comm_dir = cwd / 'comm'
        if comm_dir.exists():
            context["agent_comm"] = {
                "comm_dir_exists": True,
                "agents": [],
            }
            
            # List active agents
            for agent_dir in comm_dir.iterdir():
                if agent_dir.is_dir() and not agent_dir.name.startswith('.'):
                    agent_info = {"name": agent_dir.name, "tasks": []}
                    
                    # Count tasks for each agent
                    for task_dir in agent_dir.iterdir():
                        if task_dir.is_dir():
                            task_info = {"id": task_dir.name}
                            
                            # Check for task status files
                            status_files = ['INIT.md', 'PLAN.md', 'DONE.md', 'ERROR.md']
                            for status_file in status_files:
                                if (task_dir / status_file).exists():
                                    task_info["status"] = status_file.replace('.md', '')
                                    break
                            
                            agent_info["tasks"].append(task_info)
                    
                    context["agent_comm"]["agents"].append(agent_info)
    
    except Exception as e:
        log_debug(f"Agent comm context capture failed: {e}")
        context["agent_comm"] = {"error": str(e)}
    
    return context

def save_state_capture(context: Dict[str, Any]) -> Path:
    """Save the captured state to file"""
    state_file = get_state_file_path()
    
    try:
        with open(state_file, 'w') as f:
            json.dump(context, f, indent=2, ensure_ascii=False)
        
        log_debug(f"State captured to: {state_file}")
        return state_file
        
    except Exception as e:
        log_debug(f"Failed to save state capture: {e}")
        raise

def handle_pre_compact_event(hook_data: Dict) -> tuple[int, str]:
    """Handle pre-compact event and capture state"""
    try:
        # Capture comprehensive session context
        context = capture_session_context(hook_data)
        
        # Save state to file
        state_file = save_state_capture(context)
        
        # Create summary message
        summary_items = []
        
        if "project_context" in context:
            proj = context["project_context"]
            if "name" in proj:
                summary_items.append(f"Project: {proj['name']} v{proj.get('version', '?')}")
        
        if "git_context" in context and "current_branch" in context["git_context"]:
            summary_items.append(f"Branch: {context['git_context']['current_branch']}")
        
        if "agent_comm" in context and "agents" in context["agent_comm"]:
            agent_count = len(context["agent_comm"]["agents"])
            if agent_count > 0:
                summary_items.append(f"Active agents: {agent_count}")
        
        if "todo_context" in context:
            summary_items.append("Todo list captured")
        
        summary = " | ".join(summary_items) if summary_items else "Basic context"
        
        message = f"""💾 Pre-compact state captured successfully

📄 State file: {state_file.name}
📋 Context: {summary}
🕒 Timestamp: {context['timestamp']}

This state will be available for recovery after compaction."""
        
        return 2, message  # Success with message
        
    except Exception as e:
        log_debug(f"Pre-compact state capture failed: {e}")
        return 2, f"⚠️  Pre-compact state capture failed: {e}"

def main() -> None:
    """Main hook entry point"""
    try:
        # Read JSON input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            sys.exit(0)  # No input, nothing to capture
        
        hook_data = json.loads(input_data)
        log_debug(f"Received pre-compact hook data")
        
        # Handle the pre-compact event
        exit_code, message = handle_pre_compact_event(hook_data)
        
        if message:
            print(message, file=sys.stderr)
        
        sys.exit(exit_code)
        
    except json.JSONDecodeError:
        log_debug("Invalid JSON input")
        sys.exit(0)  # Allow operation on JSON parse error
    except Exception as e:
        log_debug(f"Hook error: {e}")
        sys.exit(0)  # Allow operation on unexpected error

if __name__ == "__main__":
    main()