#!/usr/bin/env python3
"""
Claude Code Reasoning Validation Hook with Destructive Operation Protection
Enforces proper problem-solving approach and prevents data loss operations

This hook intercepts:
1. Shortcuts and bypass attempts that undermine quality gates
2. Destructive operations that could lose uncommitted work or critical files
3. Dangerous git operations without proper safeguards

Triggered on: Command suggestions, tool usage patterns, destructive operations
Exit codes:
  0 = Safe operation approved
  1 = Dangerous operation blocked - requires confirmation
  2 = Warning with guidance for safer alternatives
  3 = Critical data loss risk - operation forbidden
"""

import sys
import json
import re
import os
from typing import Dict, List, Tuple, Optional

def log_debug(message: str) -> None:
    """Debug logging when AGENT_COMM_HOOK_DEBUG is enabled"""
    if os.environ.get('AGENT_COMM_HOOK_DEBUG') == 'true':
        print(f"[DEBUG] Reasoning Validator: {message}", file=sys.stderr)

def detect_bypass_patterns(content: str) -> List[str]:
    """Detect bypass patterns in command suggestions or tool usage"""
    bypass_patterns = [
        # Git bypass patterns
        (r'git.*--no-verify', "Git commit bypassing pre-commit hooks"),
        (r'git.*-n\b', "Git commit with --no-verify flag"),
        (r'SKIP.*HOOK', "Explicit hook skipping"),
        
        # ESLint bypass patterns  
        (r'eslint-disable', "ESLint rule disabling"),
        (r'eslint.*--fix.*--quiet', "ESLint auto-fix without verification"),
        (r'//\s*eslint-disable', "Inline ESLint disabling"),
        (r'/\*\s*eslint-disable', "Block ESLint disabling"),
        
        # Test bypass patterns
        (r'\.skip\(', "Test skipping"),
        (r'\.only\(', "Test isolation without fixing others"),
        (r'jest.*--passWithNoTests', "Jest bypassing test requirements"),
        (r'npm.*test.*--', "Test command modification"),
        
        # Threshold lowering patterns
        (r'lower.*threshold', "Quality threshold reduction"),
        (r'reduce.*coverage', "Coverage requirement reduction"),
        (r'disable.*coverage', "Coverage checking disabled"),
        (r'threshold.*down', "Threshold lowering"),
        
        # TypeScript bypass patterns
        (r'@ts-ignore', "TypeScript error suppression"),
        (r'@ts-nocheck', "TypeScript checking disabled"),
        (r'skipLibCheck', "TypeScript library checking bypassed"),
        (r'as\s+any', "Unsafe type casting to any"),
        
        # Workaround language patterns
        (r'workaround', "Workaround approach instead of fix"),
        (r'quick.*fix', "Quick fix instead of proper solution"),
        (r'temporary.*disable', "Temporary disabling of quality controls"),
        (r'for now.*skip', "Temporary skipping approach"),
        (r'bypass.*for', "Explicit bypass language"),
        
        # Quality standard relaxation
        (r'relax.*rule', "Quality rule relaxation"),
        (r'turn.*off.*lint', "Linting turned off"),
        (r'ignore.*warning', "Warning suppression"),
        (r'suppress.*error', "Error suppression"),
    ]
    
    violations = []
    content_lower = content.lower()
    
    for pattern, description in bypass_patterns:
        if re.search(pattern, content_lower, re.IGNORECASE | re.MULTILINE):
            violations.append(description)
    
    return violations

def detect_destructive_operations(content: str) -> Tuple[List[str], List[str], List[str]]:
    """
    Detect destructive operations that could lose work or critical files
    Returns: (critical_operations, dangerous_operations, risky_operations)
    """
    critical_operations = []
    dangerous_operations = []
    risky_operations = []
    
    content_lower = content.lower()
    
    # CRITICAL: Operations that will definitely lose data
    critical_patterns = [
        (r'git\s+reset\s+--hard', "Git hard reset - WILL LOSE all uncommitted changes"),
        (r'git\s+clean\s+-[fF]*d', "Git clean -fd - WILL DELETE all untracked files and directories"),
        (r'rm\s+-rf\s+[^/\s]*[/]?(?:src|lib|tests?|docs?|\.git)', "Recursive deletion of critical directories"),
        (r'rm\s+-rf\s+\*', "Recursive deletion of all files in current directory"),
        (r'rmdir\s+[^/\s]*(?:src|lib|tests?|docs?)', "Removal of critical directories"),
        (r'git\s+branch\s+-D', "Force deletion of git branches - may lose commits"),
        (r'git\s+push\s+.*--force(?:-with-lease)?', "Force push - WILL OVERWRITE remote history"),
        (r'truncate\s+-s\s*0', "File truncation - WILL EMPTY files"),
        (r'>\s*[^>\s]+\.(js|ts|py|md|json|yaml|yml)', "File overwrite without backup"),
    ]
    
    # DANGEROUS: Operations that could lose unsaved work
    dangerous_patterns = [
        (r'git\s+checkout\s+--\s*\.', "Git checkout -- . discards ALL working directory changes"),
        (r'git\s+checkout\s+--\s+[^/\s]+', "Git checkout -- file discards specific file changes"),
        (r'git\s+stash\s+drop', "Permanent stash deletion - may lose changes"),
        (r'git\s+stash\s+clear', "Clear all stashes - WILL LOSE all stashed changes"),
        (r'git\s+rebase\s+.*-i.*--autosquash', "Interactive rebase with autosquash - may lose commits"),
        (r'npm\s+run\s+clean', "Build clean - may remove important generated files"),
        (r'yarn\s+clean', "Yarn clean - removes cached dependencies"),
        (r'rm\s+[^/\s]*(?:package(?:-lock)?\.json|tsconfig\.json|\.gitignore)', "Deletion of critical config files"),
        (r'mv\s+[^/\s]*(?:src|lib|tests?)\s+', "Moving critical directories"),
        (r'cp\s+.*>\s*[^>\s]+', "File copy with overwrite"),
    ]
    
    # RISKY: Operations that need careful consideration
    risky_patterns = [
        (r'git\s+reset\s+HEAD[~^]', "Git reset to previous commits - may lose commits"),
        (r'git\s+revert\s+HEAD', "Git revert - creates new commit, safer but check impact"),
        (r'git\s+merge\s+.*--no-ff', "Force merge commit - check for conflicts"),
        (r'rm\s+[^/\s]*(?:\.env|\.secret|\.key)', "Deletion of sensitive config files"),
        (r'chmod\s+000', "Removing all permissions - may make files inaccessible"),
        (r'find\s+.*-delete', "Find with delete - bulk file removal"),
        (r'sed\s+-i.*>', "In-place file editing without backup"),
        (r'node_modules.*rm', "Node modules manipulation"),
        (r'\.git.*rm', "Git internals manipulation"),
    ]
    
    # Check critical operations
    for pattern, description in critical_patterns:
        if re.search(pattern, content_lower, re.IGNORECASE | re.MULTILINE):
            critical_operations.append(description)
    
    # Check dangerous operations  
    for pattern, description in dangerous_patterns:
        if re.search(pattern, content_lower, re.IGNORECASE | re.MULTILINE):
            dangerous_operations.append(description)
    
    # Check risky operations
    for pattern, description in risky_patterns:
        if re.search(pattern, content_lower, re.IGNORECASE | re.MULTILINE):
            risky_operations.append(description)
    
    return critical_operations, dangerous_operations, risky_operations

def check_for_unsaved_work() -> Tuple[bool, List[str]]:
    """Check if there are uncommitted changes or untracked files that could be lost"""
    import subprocess
    import os
    
    warnings = []
    has_unsaved_work = False
    
    try:
        # Check if we're in a git repository
        result = subprocess.run(['git', 'rev-parse', '--git-dir'], 
                              capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode != 0:
            return False, []  # Not a git repo
        
        # Check for staged changes
        result = subprocess.run(['git', 'diff', '--cached', '--name-only'], 
                              capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode == 0 and result.stdout.strip():
            has_unsaved_work = True
            warnings.append(f"Staged changes: {len(result.stdout.strip().split())} files")
        
        # Check for unstaged changes
        result = subprocess.run(['git', 'diff', '--name-only'], 
                              capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode == 0 and result.stdout.strip():
            has_unsaved_work = True
            warnings.append(f"Unstaged changes: {len(result.stdout.strip().split())} files")
        
        # Check for untracked files
        result = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'], 
                              capture_output=True, text=True, cwd=os.getcwd())
        if result.returncode == 0 and result.stdout.strip():
            untracked_files = result.stdout.strip().split('\n')
            # Filter out common build/cache files
            important_untracked = [f for f in untracked_files 
                                 if not any(skip in f for skip in ['node_modules', '.cache', 'dist', 'build', '.log'])]
            if important_untracked:
                has_unsaved_work = True
                warnings.append(f"Untracked files: {len(important_untracked)} important files")
        
    except Exception as e:
        log_debug(f"Error checking for unsaved work: {e}")
        return False, []
    
    return has_unsaved_work, warnings

def generate_destructive_operation_guidance(critical: List[str], dangerous: List[str], risky: List[str], 
                                           unsaved_work: bool, work_warnings: List[str]) -> str:
    """Generate specific guidance for destructive operations"""
    
    guidance_lines = []
    
    if critical:
        guidance_lines.extend([
            "🚨 CRITICAL DATA LOSS RISK - OPERATION FORBIDDEN",
            "",
            "The following operations WILL DEFINITELY lose data:"
        ])
        for op in critical:
            guidance_lines.append(f"  ❌ {op}")
        
        guidance_lines.extend([
            "",
            "🛡️ SAFER ALTERNATIVES:",
            "  ✅ git stash push -m 'backup before operation'  # Save work first",
            "  ✅ git branch backup-$(date +%Y%m%d-%H%M%S)     # Create backup branch",
            "  ✅ cp -r . ../backup-$(basename $PWD)           # Create directory backup",
        ])
    
    if dangerous:
        guidance_lines.extend([
            "⚠️  DANGEROUS OPERATIONS DETECTED",
            "",
            "The following operations could lose unsaved work:"
        ])
        for op in dangerous:
            guidance_lines.append(f"  ⚠️ {op}")
    
    if risky:
        guidance_lines.extend([
            "🔄 RISKY OPERATIONS - PROCEED WITH CAUTION",
            "",
            "The following operations need careful consideration:"
        ])
        for op in risky:
            guidance_lines.append(f"  🤔 {op}")
    
    if unsaved_work and work_warnings:
        guidance_lines.extend([
            "",
            "📝 UNSAVED WORK DETECTED:",
        ])
        for warning in work_warnings:
            guidance_lines.append(f"  • {warning}")
        
        guidance_lines.extend([
            "",
            "🔒 PROTECTION REQUIRED:",
            "  1. git add . && git commit -m 'WIP: backup before operation'",
            "  2. git stash push -m 'backup-$(date +%Y%m%d-%H%M%S)'",
            "  3. Create backup: cp -r . ../backup-$(basename $PWD)",
        ])
    
    if critical or (dangerous and unsaved_work):
        guidance_lines.extend([
            "",
            "🧠 MANDATORY SAFETY PROTOCOL:",
            "1. What EXACTLY will this operation delete or overwrite?",
            "2. Do I have a COMPLETE BACKUP of all affected files?", 
            "3. Can I RECOVER this work if something goes wrong?",
            "4. Is there a SAFER way to achieve the same result?",
            "",
            "⚠️  BLOCKED: Destructive operations require explicit safety measures."
        ])
    
    return "\n".join(guidance_lines)

def check_proper_reasoning(content: str) -> Tuple[bool, List[str]]:
    """Check for proper reasoning patterns in problem-solving approach"""
    proper_patterns = [
        r'root cause',
        r'fix.*properly',
        r'understand.*error',
        r'analyze.*issue',
        r'implement.*solution',
        r'meet.*standard',
        r'proper.*type',
        r'correct.*implementation',
    ]
    
    reasoning_signals = []
    content_lower = content.lower()
    
    for pattern in proper_patterns:
        if re.search(pattern, content_lower, re.IGNORECASE):
            reasoning_signals.append(pattern)
    
    # Good reasoning if multiple proper patterns found
    has_good_reasoning = len(reasoning_signals) >= 2
    
    return has_good_reasoning, reasoning_signals

def generate_reasoning_guidance(violations: List[str]) -> str:
    """Generate specific guidance for reasoning violations"""
    guidance_map = {
        "Git commit bypassing pre-commit hooks": "❌ REASONING VIOLATION: Why bypass pre-commit validation?\n   ✅ PROPER APPROACH: Fix the issues that pre-commit detected",
        "ESLint rule disabling": "❌ REASONING VIOLATION: Why disable code quality rules?\n   ✅ PROPER APPROACH: Fix the code to meet quality standards",
        "Test skipping": "❌ REASONING VIOLATION: Why skip tests instead of fixing them?\n   ✅ PROPER APPROACH: Make tests pass by fixing the underlying issues",
        "Quality threshold reduction": "❌ REASONING VIOLATION: Why lower quality standards?\n   ✅ PROPER APPROACH: Improve code quality to meet existing standards",
        "TypeScript error suppression": "❌ REASONING VIOLATION: Why ignore type safety?\n   ✅ PROPER APPROACH: Fix type issues to ensure runtime safety",
        "Workaround approach instead of fix": "❌ REASONING VIOLATION: Why create workarounds?\n   ✅ PROPER APPROACH: Solve the actual problem causing the issue",
    }
    
    guidance = []
    for violation in violations:
        if violation in guidance_map:
            guidance.append(guidance_map[violation])
        else:
            guidance.append(f"❌ BYPASS DETECTED: {violation}\n   ✅ PROPER APPROACH: Fix the root cause instead")
    
    return "\n\n".join(guidance)

def validate_reasoning_approach(hook_data: Dict) -> Tuple[int, str]:
    """
    Validate reasoning approach in tool usage or command suggestions with destructive operation protection
    Returns: (exit_code, message)
    Exit codes: 0=safe, 1=dangerous-blocked, 2=warning, 3=critical-forbidden
    """
    try:
        # Check different input types
        content = ""
        
        # Extract content from various hook data structures
        if 'tool' in hook_data:
            tool_data = hook_data['tool']
            if isinstance(tool_data, dict):
                # Check tool parameters for bypass patterns
                params = tool_data.get('parameters', {})
                if isinstance(params, dict):
                    content += " ".join(str(v) for v in params.values() if v)
                
                # Check tool name and description
                content += f" {tool_data.get('name', '')} {tool_data.get('description', '')}"
        
        # Check command content
        if 'command' in hook_data:
            content += f" {hook_data['command']}"
            
        # Check message content  
        if 'message' in hook_data:
            content += f" {hook_data['message']}"
            
        # Check general content
        if 'content' in hook_data:
            content += f" {hook_data['content']}"
        
        if not content.strip():
            log_debug("No content to analyze")
            return 0, ""
        
        log_debug(f"Analyzing content: {content[:100]}...")
        
        # Detect bypass patterns
        bypass_violations = detect_bypass_patterns(content)
        
        # Detect destructive operations (critical, dangerous, risky)
        critical_ops, dangerous_ops, risky_ops = detect_destructive_operations(content)
        
        # Check for unsaved work that could be lost
        has_unsaved_work, work_warnings = check_for_unsaved_work()
        
        # Check for proper reasoning  
        has_proper_reasoning, reasoning_signals = check_proper_reasoning(content)
        
        # CRITICAL OPERATIONS - Always forbidden (exit code 3)
        if critical_ops:
            guidance = generate_destructive_operation_guidance(
                critical_ops, dangerous_ops, risky_ops, has_unsaved_work, work_warnings
            )
            
            message = f"""🚨 CRITICAL DATA LOSS OPERATION FORBIDDEN

{guidance}

🧠 SAFETY CHECKPOINT FAILED:
This operation WILL DEFINITELY lose data or critical files.

⛔ OPERATION BLOCKED: Critical destructive operations are not permitted under any circumstances."""
            
            return 3, message
        
        # DANGEROUS OPERATIONS with unsaved work (exit code 1)
        if dangerous_ops and has_unsaved_work:
            guidance = generate_destructive_operation_guidance(
                critical_ops, dangerous_ops, risky_ops, has_unsaved_work, work_warnings
            )
            
            message = f"""⚠️  DANGEROUS OPERATION WITH UNSAVED WORK

{guidance}

🧠 MANDATORY SAFETY PROTOCOL:
You have unsaved work that could be lost by this operation.

🛑 BLOCKED: Save your work before proceeding with dangerous operations."""
            
            return 1, message
        
        # BYPASS VIOLATIONS without proper reasoning (exit code 1)
        if bypass_violations and not has_proper_reasoning:
            # Check if bypass is combined with destructive operations - escalate severity
            if dangerous_ops or risky_ops:
                guidance = generate_reasoning_guidance(bypass_violations)
                destructive_guidance = generate_destructive_operation_guidance(
                    critical_ops, dangerous_ops, risky_ops, has_unsaved_work, work_warnings
                )
                
                message = f"""🚫 COMPOUND VIOLATION: BYPASS + DESTRUCTIVE OPERATIONS

{guidance}

{destructive_guidance}

🧠 DOUBLE SAFETY FAILURE:
1. Attempting to bypass quality controls
2. Using potentially destructive operations

⛔ OPERATION BLOCKED: This combination is extremely dangerous."""
                
                return 1, message
            else:
                # Standard bypass violation
                guidance = generate_reasoning_guidance(bypass_violations)
                
                message = f"""🚫 REASONING VIOLATION DETECTED

{guidance}

🧠 MANDATORY REASONING PROTOCOL:
1. What is the ROOT CAUSE of this issue?
2. Why am I trying to BYPASS instead of FIX?
3. How do I PROPERLY SOLVE this problem?
4. Will my solution MEET ALL QUALITY STANDARDS?

⚠️  BLOCKED: Bypass attempts are not permitted. Fix the underlying issue."""
                
                return 1, message
        
        # WARNINGS for less severe issues (exit code 2)
        warning_conditions = []
        
        # Bypass with some reasoning
        if bypass_violations and has_proper_reasoning:
            warning_conditions.append(f"Bypass patterns detected but reasoning present ({len(bypass_violations)} bypasses, {len(reasoning_signals)} reasoning signals)")
        
        # Dangerous operations without unsaved work
        if dangerous_ops and not has_unsaved_work:
            warning_conditions.append(f"Dangerous operations detected but no unsaved work at risk ({len(dangerous_ops)} operations)")
        
        # Risky operations
        if risky_ops:
            warning_conditions.append(f"Risky operations that need careful consideration ({len(risky_ops)} operations)")
        
        # Unsaved work without destructive operations (info warning)
        if has_unsaved_work and not (critical_ops or dangerous_ops):
            warning_conditions.append(f"Unsaved work detected - consider committing changes ({len(work_warnings)} warnings)")
        
        if warning_conditions:
            guidance_parts = []
            
            if bypass_violations:
                guidance_parts.append("⚠️  BYPASS WARNING:\nBypass patterns detected but proper reasoning also found.")
            
            if dangerous_ops or risky_ops:
                guidance_parts.append(generate_destructive_operation_guidance(
                    critical_ops, dangerous_ops, risky_ops, has_unsaved_work, work_warnings
                ))
            
            message = f"""⚠️  OPERATION WARNING

{chr(10).join(warning_conditions)}

{chr(10).join(guidance_parts)}

🧠 RECOMMENDED ACTIONS:
• Ensure you're addressing root causes, not working around them
• Consider safer alternatives for destructive operations
• Commit unsaved work before risky operations"""
            
            return 2, message
        
        # SAFE OPERATIONS (exit code 0)
        if has_proper_reasoning:
            # Good reasoning detected
            log_debug(f"Proper reasoning detected: {reasoning_signals}")
            return 0, ""
        else:
            # No clear issues detected
            log_debug("Neutral content - no reasoning issues detected")
            return 0, ""
            
    except Exception as e:
        log_debug(f"Reasoning validation error: {e}")
        return 0, ""  # Allow operation on validation errors

def main() -> None:
    """Main hook entry point"""
    try:
        # Read JSON input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            sys.exit(0)  # No input, allow
        
        hook_data = json.loads(input_data)
        log_debug("Received reasoning validation hook data")
        
        # Validate reasoning approach
        exit_code, message = validate_reasoning_approach(hook_data)
        
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