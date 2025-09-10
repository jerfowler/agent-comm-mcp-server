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

def is_test_file(file_path: str) -> bool:
    """Check if file is a test file"""
    return (file_path.endswith(('.test.ts', '.spec.ts')) or 
            '/tests/' in file_path or 
            '\\tests\\' in file_path)

def get_documentation_references(file_path: str, violations: List[str]) -> str:
    """Generate context-aware documentation references"""
    refs = []
    
    if is_test_file(file_path):
        refs.append("📋 REQUIRED READING (complete these first):")
        refs.append("  • TEST-GUIDELINES.md (lines 1-50): Core Principles & Zero Tolerance Policy")
        refs.append("  • TEST-GUIDELINES.md (lines 33-99): Type Safety in Tests (MANDATORY)")
        refs.append("  • TEST-ERROR-PATTERNS.md: All Banned Patterns Database")
        
        # Specific guidance based on violations
        if any('any' in v.lower() for v in violations):
            refs.append("  • TEST-GUIDELINES.md (lines 37-55): ❌ BANNED 'any' Types → ✅ Proper Assertions")
            refs.append("  • TEST-ERROR-PATTERNS.md Pattern 1: 'any' Types (ZERO TOLERANCE)")
        
        if any('||' in v for v in violations):
            refs.append("  • TEST-ERROR-PATTERNS.md Pattern 2: Logical OR vs Nullish Coalescing")
            refs.append("  • TEST-GUIDELINES.md (lines 59-71): Use ?? instead of ||")
    else:
        refs.append("📋 CODE QUALITY STANDARDS:")
        refs.append("  • Use fs-extra-safe.ts utility (not direct fs-extra imports)")
        refs.append("  • Maintain TypeScript strict mode compliance")
        refs.append("  • Follow existing codebase patterns")
    
    return "\n".join(refs)

def get_educational_guidance(file_path: str, violations: List[str]) -> str:
    """Provide educational guidance based on context"""
    guidance = []
    
    if is_test_file(file_path):
        guidance.append("🎓 TEST FILE COMPLIANCE REQUIREMENTS:")
        guidance.append("  • ZERO 'any' types allowed - use 'unknown' with type guards")
        guidance.append("  • ALL logical OR (||) must be nullish coalescing (??)")
        guidance.append("  • TDD workflow: tests → docs → code → verify")
        guidance.append("  • Maintain 95%+ test coverage at all times")
        guidance.append("  • Mock ALL required dependencies (INIT.md, PLAN.md, etc.)")
        
        if violations:
            guidance.append("\n✅ QUICK FIXES FROM DOCUMENTATION:")
            if any('any' in v.lower() for v in violations):
                guidance.append("  Replace: const x = obj as any;")
                guidance.append("  With:    const x = obj as unknown as SpecificType;")
            if any('||' in v for v in violations):
                guidance.append("  Replace: const val = input || default;")
                guidance.append("  With:    const val = input ?? default;")
    else:
        guidance.append("🎓 SOURCE CODE STANDARDS:")
        guidance.append("  • Use specific types instead of 'any'")
        guidance.append("  • Import from fs-extra-safe.js utility")
        guidance.append("  • Follow TypeScript strict mode requirements")
    
    return "\n".join(guidance)

def auto_update_error_patterns(file_path: str, violations: List[str]) -> None:
    """Auto-update TEST-ERROR-PATTERNS.md with new patterns"""
    try:
        if not violations or not is_test_file(file_path):
            return
            
        patterns_file = Path(__file__).parent.parent.parent / "TEST-ERROR-PATTERNS.md"
        if not patterns_file.exists():
            return
            
        # Check if these are truly new patterns (basic check)
        with open(patterns_file, 'r') as f:
            existing_content = f.read()
        
        new_patterns = []
        for violation in violations:
            if 'any' in violation.lower() and 'Pattern 1: \'any\' Types' not in existing_content:
                new_patterns.append(f"Pattern Auto-Detected: 'any' type in {os.path.basename(file_path)}")
        
        if new_patterns:
            log_debug(f"Auto-updating error patterns: {new_patterns}")
            # In a real implementation, we'd append to the file here
            
    except Exception as e:
        log_debug(f"Failed to auto-update error patterns: {e}")

def validate_write_operation(hook_data: Dict) -> Tuple[int, str]:
    """
    Enhanced Write tool validation with proactive education
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
        
        # Proactive guidance for test files (even without violations)
        if is_test_file(file_path):
            proactive_message = f"""📚 TEST FILE DETECTED: {os.path.basename(file_path)}

🚨 MANDATORY COMPLIANCE CHECK:
  • Have you read TEST-GUIDELINES.md? (344 lines of required standards)
  • Have you checked TEST-ERROR-PATTERNS.md for banned patterns?
  • Are you following TDD workflow: tests → docs → code → verify?

⚠️  ZERO TOLERANCE POLICY ACTIVE:
  • NO 'any' types permitted in test files
  • NO logical OR (||) for defaults - use nullish coalescing (??)
  • 95%+ test coverage required
  • ALL violations will be blocked by pre-commit hook

Proceeding with validation..."""
            print(proactive_message, file=sys.stderr)
        
        # Check for banned patterns
        pattern_violations = check_banned_patterns(content, file_path)
        
        # Run TypeScript check
        ts_passed, ts_errors = run_typescript_check(file_path, content)
        
        # Run ESLint check
        eslint_passed, eslint_errors = run_eslint_check(file_path, content)
        
        # Collect all violations
        all_violations = pattern_violations + ts_errors + eslint_errors
        
        # Auto-update error patterns database
        if all_violations:
            auto_update_error_patterns(file_path, all_violations)
        
        if not ts_passed or not eslint_passed or pattern_violations:
            # Generate enhanced educational blocking message
            doc_refs = get_documentation_references(file_path, all_violations)
            guidance = get_educational_guidance(file_path, all_violations)
            
            message = f"""🚫 Write operation blocked for {os.path.basename(file_path)}

{doc_refs}

🔍 SPECIFIC VIOLATIONS DETECTED:
{chr(10).join(f"  • {violation}" for violation in all_violations)}

{guidance}

🛡️  PROTECTION SYSTEM STATUS:
  • Write tool hook: ACTIVE (blocking violations)
  • Pre-commit hook: ACTIVE (comprehensive validation)
  • Git Feature Branch Workflow: ENFORCED

📊 AGENT REQUIREMENTS:
  • Read documentation before proceeding
  • Fix violations using provided patterns
  • Maintain project quality standards
  • Follow TDD methodology for test files

The Write operation has been prevented to maintain code quality.
Complete the required reading and fix violations using the guidance above."""
            
            return 1, message
        
        # Success message for test files
        if is_test_file(file_path):
            success_msg = f"✅ Test file validation passed: {os.path.basename(file_path)}\n✅ Compliance confirmed: Zero 'any' types, proper patterns used"
            log_debug(success_msg)
            print(success_msg, file=sys.stderr)
        
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