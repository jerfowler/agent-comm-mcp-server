#!/usr/bin/env python3
"""
Claude Code Write Tool Validator Hook
Real-time TypeScript strict mode and ESLint validation

This hook intercepts Write tool operations to validate TypeScript/JavaScript files
before they are written, catching violations immediately rather than at commit time.

Triggered on: Write tool operations
Exit codes:
  0 = Allow write operation
  1 = Block write operation (validation failed)
  2 = Allow with warning message
"""

import sys
import json
import re
import subprocess
import tempfile
import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional

def log_debug(message: str) -> None:
    """Debug logging when AGENT_COMM_HOOK_DEBUG is enabled"""
    if os.environ.get('AGENT_COMM_HOOK_DEBUG') == 'true':
        print(f"[DEBUG] Write Validator: {message}", file=sys.stderr)

def is_typescript_file(file_path: str) -> bool:
    """Check if file is a TypeScript/JavaScript file that needs validation"""
    return file_path.endswith(('.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'))

def check_banned_patterns(content: str, file_path: str) -> List[str]:
    """Check for banned patterns in file content"""
    violations = []
    
    # Check for direct fs-extra imports
    fs_extra_pattern = r"from\s+['\"]fs-extra['\"]"
    if re.search(fs_extra_pattern, content):
        violations.append(f"❌ Direct fs-extra import detected - use '../utils/fs-extra-safe.js' instead")
    
    # Check for 'any' types (basic patterns)
    any_patterns = [
        (r":\s*any\b", "Type annotation with 'any'"),
        (r"<any>", "Generic type 'any'"),
        (r"as\s+any\b", "Type assertion to 'any'"),
        (r"\bany\[\]", "Array type 'any[]'"),
    ]
    
    for pattern, description in any_patterns:
        if re.search(pattern, content):
            violations.append(f"❌ {description} detected - use specific types or 'unknown'")
    
    # Check for common TypeScript strict mode violations
    unsafe_patterns = [
        (r"@ts-ignore", "TypeScript ignore comment - fix the underlying issue"),
        (r"@ts-nocheck", "TypeScript nocheck comment - not allowed in strict mode"),
        (r"Object\.prototype\.hasOwnProperty\.call\([^,]+,\s*[^)]+\)", "Use 'in' operator or proper type guards"),
    ]
    
    for pattern, description in unsafe_patterns:
        if re.search(pattern, content):
            violations.append(f"⚠️  {description}")
    
    return violations

def run_typescript_check(file_path: str, content: str) -> Tuple[bool, List[str]]:
    """Run TypeScript compiler check on file content"""
    try:
        # Create temporary file with content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Run TypeScript compiler check
        result = subprocess.run([
            'npx', 'tsc', '--noEmit', '--strict', '--exactOptionalPropertyTypes', 
            '--skipLibCheck', temp_path
        ], capture_output=True, text=True, cwd=os.path.dirname(file_path))
        
        # Clean up temp file
        os.unlink(temp_path)
        
        if result.returncode == 0:
            return True, []
        
        # Parse TypeScript errors
        errors = []
        for line in result.stdout.split('\n') + result.stderr.split('\n'):
            if line.strip() and 'error TS' in line:
                errors.append(f"TypeScript: {line.strip()}")
        
        return False, errors
        
    except Exception as e:
        log_debug(f"TypeScript check failed: {e}")
        return True, [f"Warning: TypeScript check failed: {e}"]

def run_eslint_check(file_path: str, content: str) -> Tuple[bool, List[str]]:
    """Run ESLint check on file content"""
    try:
        # Create temporary file with content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Run ESLint
        result = subprocess.run([
            'npx', 'eslint', '--format', 'json', temp_path
        ], capture_output=True, text=True, cwd=os.path.dirname(file_path))
        
        # Clean up temp file
        os.unlink(temp_path)
        
        if result.returncode == 0:
            return True, []
        
        # Parse ESLint JSON output
        try:
            eslint_output = json.loads(result.stdout)
            errors = []
            
            for file_result in eslint_output:
                for message in file_result.get('messages', []):
                    severity = 'Error' if message['severity'] == 2 else 'Warning'
                    rule_id = message.get('ruleId', 'unknown')
                    line = message.get('line', '?')
                    errors.append(f"ESLint {severity} (line {line}): {message['message']} [{rule_id}]")
            
            return len([e for e in errors if 'Error' in e]) == 0, errors
            
        except json.JSONDecodeError:
            # Fallback to text parsing
            errors = []
            for line in result.stdout.split('\n'):
                if 'error' in line.lower() or 'warning' in line.lower():
                    errors.append(f"ESLint: {line.strip()}")
            return False, errors
        
    except Exception as e:
        log_debug(f"ESLint check failed: {e}")
        return True, [f"Warning: ESLint check failed: {e}"]

def validate_write_operation(hook_data: Dict) -> Tuple[int, str]:
    """
    Validate Write tool operation
    Returns: (exit_code, message)
    """
    try:
        # Extract Write tool parameters
        tool_data = hook_data.get('tool', {})
        if tool_data.get('name') != 'Write':
            return 0, ""  # Not a Write operation, allow
        
        parameters = tool_data.get('parameters', {})
        file_path = parameters.get('file_path', '')
        content = parameters.get('content', '')
        
        if not file_path or not content:
            return 0, ""  # Missing data, allow (will likely fail anyway)
        
        log_debug(f"Validating Write operation for: {file_path}")
        
        # Only validate TypeScript/JavaScript files
        if not is_typescript_file(file_path):
            log_debug(f"Skipping non-TypeScript file: {file_path}")
            return 0, ""
        
        # Check for banned patterns
        pattern_violations = check_banned_patterns(content, file_path)
        
        # Run TypeScript check
        ts_passed, ts_errors = run_typescript_check(file_path, content)
        
        # Run ESLint check
        eslint_passed, eslint_errors = run_eslint_check(file_path, content)
        
        # Collect all violations
        all_violations = pattern_violations + ts_errors + eslint_errors
        
        if not ts_passed or not eslint_passed or pattern_violations:
            # Block the write operation
            message = f"""🚫 Write operation blocked for {os.path.basename(file_path)}

VALIDATION FAILURES:
{chr(10).join(f"  • {violation}" for violation in all_violations)}

FIX REQUIRED:
  • Remove all 'any' types - use specific types or 'unknown'
  • Replace fs-extra imports with fs-extra-safe utility
  • Fix TypeScript strict mode violations
  • Address ESLint errors

The Write operation has been prevented to maintain code quality.
Fix the violations above and try again."""
            
            return 1, message
        
        # All validations passed
        log_debug(f"All validations passed for: {file_path}")
        return 0, ""
        
    except Exception as e:
        log_debug(f"Validation error: {e}")
        # Allow operation with warning on unexpected errors
        return 2, f"⚠️  Write validation error: {e}"

def main() -> None:
    """Main hook entry point"""
    try:
        # Read JSON input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            sys.exit(0)  # No input, allow
        
        hook_data = json.loads(input_data)
        log_debug(f"Received hook data: {json.dumps(hook_data, indent=2)}")
        
        # Validate the write operation
        exit_code, message = validate_write_operation(hook_data)
        
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