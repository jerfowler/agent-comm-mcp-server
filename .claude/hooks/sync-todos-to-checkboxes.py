#!/usr/bin/env python3
"""
Minimal TodoWrite PostToolUse hook
Reminds Claude to sync todos via agent-comm MCP
"""

import json
import sys

def main():
    """
    Parse TodoWrite result and remind to sync if needed
    Exit codes: 0 - No action needed, 2 - Reminder to sync
    """
    try:
        hook_data = json.loads(sys.stdin.read())
        
        # Check if TodoWrite with todos
        if hook_data.get('tool', {}).get('name') != 'TodoWrite':
            sys.exit(0)
        
        if hook_data.get('error'):
            sys.exit(0)
        
        todos = hook_data.get('result', {}).get('todos', [])
        if not todos:
            sys.exit(0)
        
        # Count states for context
        states = {'pending': 0, 'in_progress': 0, 'completed': 0}
        for todo in todos:
            if isinstance(todo, dict) and 'status' in todo:
                status = todo.get('status')
                if status in states:
                    states[status] += 1
                # Skip counting unknown statuses to avoid incorrect totals
        
        # Simple reminder
        total = sum(states.values())
        print(f"TodoWrite updated {total} todo{'s' if total != 1 else ''}: {states['completed']} completed, {states['in_progress']} in-progress, {states['pending']} pending.\n\nRemember to sync to your task checkboxes using the agent-comm MCP if you have an active task.")
        sys.exit(2)
        
    except Exception as e:
        # Log error to stderr but exit cleanly to avoid disrupting Claude
        print(f"TodoWrite hook error: {e}", file=sys.stderr)
        sys.exit(0)  # Silent failure - don't block Claude workflow

if __name__ == '__main__':
    main()