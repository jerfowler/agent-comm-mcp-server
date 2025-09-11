# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled with `exactOptionalPropertyTypes: true`
- **Target**: ES2022 with ES modules
- **Module Resolution**: Node16
- **No Implicit**: Any, Returns, Override
- **Unused Detection**: No unused locals or parameters

## Code Patterns
### Tool Implementation Pattern
```typescript
// 1. Define interfaces
interface ToolArgs { /* parameters */ }
interface ToolResponse { /* response */ }

// 2. Implement validation
export function validateToolArgs(args: any): ToolArgs {
  return { /* validated args */ };
}

// 3. Implement tool logic
export async function toolName(
  args: ToolArgs,
  config: ServerConfig
): Promise<ToolResponse> {
  const validatedArgs = validateToolArgs(args);
  // Core implementation
  await config.eventLogger.logOperation('tool_name', {...});
  return result;
}
```

### Testing Patterns
- Mock fs-extra with factory functions returning Promises
- Use `jest.Mock` type assertions for mocks
- Test both success and error paths
- Maintain 95%+ coverage

### Naming Conventions
- **Files**: kebab-case (e.g., `prompt-manager.ts`)
- **Classes**: PascalCase (e.g., `PromptManager`)
- **Functions**: camelCase (e.g., `getPromptContent`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Interfaces**: PascalCase with 'I' prefix optional

## Documentation
- JSDoc comments for public APIs
- Inline comments for complex logic
- README updates for new features
- PROTOCOL.md for API changes