#!/usr/bin/env python3
"""
Fix all 'any' type violations in TypeScript test files
Following TEST-ERROR-PATTERNS.md guidelines
"""

import os
import re
import sys
from pathlib import Path

def fix_any_types_in_file(filepath):
    """Fix 'any' type violations in a single file"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: Fix "as any" at end of objects
    # Replace "} as any" with proper type assertion
    content = re.sub(
        r'\} as any([;,\)])',
        r'} as unknown as MockedObject\1',
        content
    )
    
    # Pattern 2: Fix standalone "as any"
    content = re.sub(
        r'(\w+) as any;',
        r'\1 as unknown as jest.MockedObject;',
        content
    )
    
    # Pattern 3: Fix "mockedFs = fs as any"
    content = re.sub(
        r'const mockedFs = (\w+) as any',
        r'const mockedFs = \1 as unknown as jest.Mocked<typeof \1>',
        content
    )
    
    # Pattern 4: Fix mock connection types
    content = re.sub(
        r'let mockConnection: any',
        r'let mockConnection: unknown',
        content
    )
    
    # Pattern 5: Fix connection parameter types
    content = re.sub(
        r'_connection: any',
        r'_connection: unknown',
        content
    )
    
    # Pattern 6: Fix object declarations
    content = re.sub(
        r'const obj: any =',
        r'const obj: Record<string, unknown> =',
        content
    )
    
    # Pattern 7: Fix mock objects that are cast to any
    # This is more complex - need to determine the correct type
    
    # Special case for ResourceManager mock
    if 'mockResourceManager' in content:
        content = re.sub(
            r'(\s+)mockResourceManager = \{([^}]+)\} as any',
            r'\1mockResourceManager = {\2} as unknown as jest.Mocked<ResourceManager>',
            content
        )
    
    # Special case for stats mock
    if 'isDirectory' in content and '} as any' in content:
        content = re.sub(
            r'(\s+return Promise\.resolve\(\{[^}]*isDirectory[^}]*\}) as any\)',
            r'\1 as unknown as fs.Stats)',
            content
        )
    
    # Pattern 8: Fix EventLogger mock casts
    content = re.sub(
        r'logOperation: jest\.fn\(\) as any',
        r'logOperation: jest.fn()',
        content
    )
    content = re.sub(
        r'getLogEntries: jest\.fn\(\) as any',
        r'getLogEntries: jest.fn()',
        content
    )
    content = re.sub(
        r'getOperationStatistics: jest\.fn\(\) as any',
        r'getOperationStatistics: jest.fn()',
        content
    )
    content = re.sub(
        r'clearLogs: jest\.fn\(\) as any',
        r'clearLogs: jest.fn()',
        content
    )
    
    # Pattern 9: Fix config objects cast as any (ServerConfig pattern)
    if 'ServerConfig' in content or 'eventLogger' in content:
        # Look for patterns like } as any); at end of function calls
        content = re.sub(
            r'(\s+eventLogger:[^}]+)\} as any\)',
            r'\1} as unknown as ServerConfig)',
            content
        )
    
    # Write back if changed
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    """Find and fix all test files with 'any' violations"""
    test_dir = Path('tests/unit')
    
    if not test_dir.exists():
        print(f"Error: {test_dir} does not exist")
        sys.exit(1)
    
    fixed_files = []
    for test_file in test_dir.rglob('*.test.ts'):
        if fix_any_types_in_file(test_file):
            fixed_files.append(test_file)
    
    # Also fix setup.ts
    setup_file = Path('tests/setup.ts')
    if setup_file.exists():
        if fix_any_types_in_file(setup_file):
            fixed_files.append(setup_file)
    
    print(f"Fixed {len(fixed_files)} files:")
    for f in fixed_files:
        print(f"  - {f}")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())