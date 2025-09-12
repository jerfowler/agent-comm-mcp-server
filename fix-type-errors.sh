#!/bin/bash

echo "Fixing TypeScript errors in test files..."

# Fix 1: Fix Stats type assertions in agent-work-verifier.test.ts
echo "Fixing Stats type assertions in agent-work-verifier.test.ts..."
sed -i 's/) as unknown);/) as fs.Stats);/g' tests/unit/core/agent-work-verifier.test.ts
sed -i 's/) as unknown\]/)) as fs.Stats\]/g' tests/unit/core/agent-work-verifier.test.ts

# Fix 2: Fix testUtils.createMockStats to return Stats
echo "Fixing createMockStats type returns..."
find tests -name "*.test.ts" -exec sed -i 's/testUtils\.createMockStats({/testUtils.createMockStats({/g; s/}) as fs\.Stats)/}) as fs.Stats)/g' {} \;

# Fix 3: Fix object type assertions
echo "Fixing object type assertions..."
sed -i 's/\(obj\) is of type .unknown./\1 as Record<string, unknown>/g' tests/unit/compliance/metadata-handler.test.ts

echo "Type error fixes complete!"