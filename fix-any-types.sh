#!/bin/bash

# Script to fix all 'any' type violations in test files
# Following TEST-ERROR-PATTERNS.md guidelines

echo "Fixing 'any' type violations in test files..."

# List of common replacements
# Pattern: 'as any' -> 'as unknown as <SpecificType>'
# Pattern: ': any' -> ': unknown' or specific type

# Fix patterns in test files
find tests/unit -name "*.test.ts" -exec sed -i \
  -e 's/} as any/} as unknown as MockedObject/g' \
  -e 's/as any;/as unknown as jest.MockedObject;/g' \
  -e 's/let mockConnection: any/let mockConnection: unknown/g' \
  -e 's/_connection: any/_connection: unknown/g' \
  -e 's/const obj: any/const obj: Record<string, unknown>/g' \
  -e 's/const mockedFs = fs as any/const mockedFs = fs as unknown as jest.Mocked<typeof fs>/g' \
  {} \;

# Fix specific patterns for ServerResourceProvider.test.ts
sed -i 's/const mockedFs = fs as any/const mockedFs = fs as unknown as jest.Mocked<typeof fs>/' tests/unit/resources/providers/ServerResourceProvider.test.ts

# Fix specific patterns for task-id-parameter.test.ts  
sed -i 's/} as any)/} as unknown as ServerConfig)/' tests/unit/features/task-id-parameter.test.ts

# Fix ResourceManager patterns
sed -i 's/} as any/} as unknown as ResourceManagerConfig/g' tests/unit/resources/ResourceManager.test.ts

# Fix TaskResourceProvider patterns
sed -i 's/} as any/} as unknown as TaskResourceProviderConfig/g' tests/unit/resources/providers/TaskResourceProvider.test.ts

echo "Completed fixing 'any' type violations"