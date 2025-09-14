# TEST-DEBUGGING.md - Debug Module Usage and Best Practices

## Overview

This document provides comprehensive guidance on using the `debug` npm package (4.4.3) for enhanced debugging and testing within the agent-comm-mcp-server project. The debug package provides namespace-based, color-coded debugging output with environment variable control and performance timing capabilities.

## Table of Contents

1. [Debug Module Overview](#debug-module-overview)
2. [Namespace Hierarchy](#namespace-hierarchy)
3. [Environment Variable Usage](#environment-variable-usage)
4. [Adding Debug Statements to New Code](#adding-debug-statements-to-new-code)
5. [Performance Timing Best Practices](#performance-timing-best-practices)
6. [Testing with Debug Enabled/Disabled](#testing-with-debug-enabled-disabled)
7. [Troubleshooting Common Issues](#troubleshooting-common-issues)
8. [Integration with Existing Logging](#integration-with-existing-logging)
9. [Production vs Development Usage](#production-vs-development-usage)
10. [Code Examples for Each Namespace](#code-examples-for-each-namespace)

## Debug Module Overview

The `debug` package provides a lightweight debugging utility that enables conditional console output based on environment variables. Key features include:

- **Namespace-based filtering**: Control output by component or functionality
- **Color-coded output**: Visual distinction between different namespaces
- **Performance timing**: Millisecond differences between debug calls
- **Zero runtime cost**: Debug statements are compiled out in production when not enabled
- **Custom formatters**: Structured object inspection and formatting

### Installation and Setup

```bash
npm install debug @types/debug
```

### Basic Usage Pattern

```typescript
import debug from 'debug';

// Create debug instance with namespace
const log = debug('agent-comm:core:accountability');

// Use debug instance
log('Processing accountability check for agent: %s', agentId);
log('Compliance score: %d%%', complianceScore);
```

## Namespace Hierarchy

The project uses a hierarchical namespace structure to organize debug output:

### Core Namespaces
- `agent-comm:core:accountability` - AccountabilityTracker operations
- `agent-comm:core:compliance` - ComplianceTracker operations
- `agent-comm:core:connection` - ConnectionManager operations
- `agent-comm:core:delegation` - DelegationTracker operations
- `agent-comm:core:response` - ResponseEnhancer operations
- `agent-comm:core:context` - TaskContextManager operations

### Tool Namespaces
- `agent-comm:tools:create-task` - Task creation operations
- `agent-comm:tools:archive` - Task archival operations
- `agent-comm:tools:progress` - Progress tracking operations
- `agent-comm:tools:sync` - Synchronization operations
- `agent-comm:tools:verification` - Verification operations

### Logging Namespaces
- `agent-comm:logging:event` - EventLogger operations
- `agent-comm:logging:error` - ErrorLogger operations
- `agent-comm:logging:audit` - Audit trail operations

### Resource Namespaces
- `agent-comm:resources:task` - Task resource operations
- `agent-comm:resources:agent` - Agent resource operations
- `agent-comm:resources:server` - Server resource operations

### Utility Namespaces
- `agent-comm:utils:fs` - File system operations
- `agent-comm:utils:validation` - Input validation
- `agent-comm:utils:lock` - Lock management

## Environment Variable Usage

### Basic Filtering

```bash
# Enable all agent-comm debug output
DEBUG=agent-comm:* npm test

# Enable only core module debug output
DEBUG=agent-comm:core:* npm test

# Enable specific component
DEBUG=agent-comm:core:accountability npm test

# Enable multiple specific namespaces
DEBUG=agent-comm:core:accountability,agent-comm:tools:create-task npm test
```

### Advanced Filtering

```bash
# Enable everything except network-related debug
DEBUG=*,-agent-comm:network npm test

# Enable all debug output (including external packages)
DEBUG=* npm test

# Disable all debug output
DEBUG= npm test
# or
unset DEBUG
```

### Example: Debug Output in Different Environments

```bash
# Development - verbose output for core components
export DEBUG=agent-comm:core:*,agent-comm:tools:*

# Testing - focus on specific functionality
export DEBUG=agent-comm:core:accountability,agent-comm:logging:error

# Production troubleshooting - minimal but critical
export DEBUG=agent-comm:logging:error,agent-comm:core:response
```

## Adding Debug Statements to New Code

### Best Practice #1: Create Debug Instance at Module Level

```typescript
// ✅ Good: Create debug instance at module level
import debug from 'debug';

const log = debug('agent-comm:tools:my-new-tool');

export class MyNewTool {
  async execute(): Promise<void> {
    log('Starting tool execution');
    // ... implementation
  }
}
```

### Best Practice #2: Use Descriptive Debug Messages

```typescript
// ✅ Good: Descriptive messages with context
log('Processing task %s for agent %s', taskId, agentId);
log('Validation failed for input: %O', inputData);
log('Retrying operation %d/%d after %dms delay', attempt, maxAttempts, delay);

// ❌ Bad: Vague messages
log('Processing');
log('Failed');
log('Retrying');
```

### Best Practice #3: Include Relevant Data

```typescript
// ✅ Good: Include structured data
log('Task created successfully: %O', {
  taskId,
  agent: agentId,
  timestamp: new Date().toISOString(),
  priority: taskPriority
});

// ✅ Good: Use format specifiers
log('Performance metrics: %d operations in %dms', count, duration);
```

### Best Practice #4: Debug at Key Decision Points

```typescript
export class TaskProcessor {
  async processTask(task: Task): Promise<ProcessResult> {
    log('Starting task processing for ID: %s', task.id);

    // Debug before critical decisions
    if (task.priority === 'high') {
      log('High priority task detected, using expedited processing');
      return this.expeditedProcess(task);
    }

    log('Using standard processing workflow');
    return this.standardProcess(task);
  }
}
```

### Best Practice #5: Debug Error Conditions

```typescript
try {
  await this.performOperation();
  log('Operation completed successfully');
} catch (error) {
  log('Operation failed with error: %O', {
    message: error.message,
    stack: error.stack,
    context: this.getOperationContext()
  });
  throw error;
}
```

## Performance Timing Best Practices

### Timing Individual Operations

```typescript
const log = debug('agent-comm:core:response');

export class ResponseEnhancer {
  async enhance(response: Response): Promise<EnhancedResponse> {
    const startTime = Date.now();
    log('Starting response enhancement for tool: %s', response.toolName);

    try {
      const result = await this.performEnhancement(response);
      const duration = Date.now() - startTime;
      
      log('Response enhancement completed in %dms', duration);
      
      // Log performance warnings for slow operations
      if (duration > 1000) {
        log('SLOW OPERATION WARNING: Enhancement took %dms (>1000ms)', duration);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      log('Response enhancement failed after %dms: %s', duration, error.message);
      throw error;
    }
  }
}
```

### Example: Batch Operation Timing

```typescript
const log = debug('agent-comm:tools:archive');

export class ArchiveManager {
  async archiveMultipleTasks(taskIds: string[]): Promise<ArchiveResult[]> {
    const overallStart = Date.now();
    log('Starting batch archive of %d tasks', taskIds.length);
    
    const results: ArchiveResult[] = [];
    
    for (const taskId of taskIds) {
      const taskStart = Date.now();
      
      try {
        const result = await this.archiveTask(taskId);
        const taskDuration = Date.now() - taskStart;
        
        log('Task %s archived in %dms', taskId, taskDuration);
        results.push(result);
        
      } catch (error) {
        const taskDuration = Date.now() - taskStart;
        log('Task %s archive failed after %dms: %s', taskId, taskDuration, error.message);
        results.push({ taskId, success: false, error: error.message });
      }
    }
    
    const overallDuration = Date.now() - overallStart;
    log('Batch archive completed: %d tasks in %dms (avg: %dms per task)', 
        taskIds.length, overallDuration, overallDuration / taskIds.length);
    
    return results;
  }
}
```

## Testing with Debug Enabled/Disabled

### Jest Configuration for Debug Testing

```javascript
// jest.config.mjs
export default {
  // ... other config
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Handle debug environment variables
  testEnvironmentOptions: {
    DEBUG: process.env.DEBUG || ''
  }
};
```

### Test Setup for Debug

```typescript
// tests/setup.ts
import debug from 'debug';

// Configure debug for testing
if (process.env.NODE_ENV === 'test') {
  // Enable debug output in CI if DEBUG is set
  if (process.env.DEBUG) {
    debug.enabled = () => true;
  } else {
    // Disable debug in normal test runs for cleaner output
    debug.enabled = () => false;
  }
}
```

### Example: Testing with Debug Assertions

```typescript
// tests/unit/core/response-enhancer.test.ts
import debug from 'debug';
import { ResponseEnhancer } from '../../../src/core/ResponseEnhancer';

// Mock debug for testing
const mockDebug = jest.fn();
jest.mock('debug', () => ({
  __esModule: true,
  default: () => mockDebug
}));

describe('ResponseEnhancer Debug Output', () => {
  beforeEach(() => {
    mockDebug.mockClear();
  });

  test('should log enhancement start and completion', async () => {
    const enhancer = new ResponseEnhancer();
    const response = { toolName: 'test-tool', result: {} };

    await enhancer.enhance(response);

    expect(mockDebug).toHaveBeenCalledWith(
      'Starting response enhancement for tool: %s', 
      'test-tool'
    );
    expect(mockDebug).toHaveBeenCalledWith(
      expect.stringMatching(/Response enhancement completed in \d+ms/)
    );
  });
});
```

### Running Tests with Debug Output

```bash
# Run tests with all debug output
DEBUG=agent-comm:* npm test

# Run specific test with debug
DEBUG=agent-comm:core:* npm test -- --testNamePattern="ResponseEnhancer"

# Run tests silently (no debug output)
npm test

# Run tests with debug output saved to file
DEBUG=agent-comm:* npm test 2>&1 | tee debug-output.log
```

## Troubleshooting Common Issues

### Issue 1: Debug Output Not Appearing

**Problem**: Debug statements don't produce output even with DEBUG environment variable set.

**Solutions**:
```bash
# Check if DEBUG variable is set correctly
echo $DEBUG

# Verify namespace matches exactly
DEBUG=agent-comm:core:accountability npm test

# Check for typos in namespace
grep -r "debug(" src/core/AccountabilityTracker.ts
```

### Issue 2: Too Much Debug Output

**Problem**: Debug output is overwhelming and hard to read.

**Solutions**:
```bash
# Use more specific namespaces
DEBUG=agent-comm:core:response npm test

# Exclude noisy namespaces
DEBUG=agent-comm:*,-agent-comm:utils:* npm test

# Filter output with grep
DEBUG=agent-comm:* npm test 2>&1 | grep "ERROR"
```

### Issue 3: Debug Affecting Performance

**Problem**: Debug statements slow down tests or operations.

**Solutions**:
```typescript
// Use lazy evaluation for expensive debug operations
log('Complex object: %O', () => JSON.stringify(complexObject));

// Conditionally enable expensive debugging
if (log.enabled) {
  log('Expensive operation result: %O', performExpensiveCalculation());
}
```

### Issue 4: Debug Not Working in Production

**Problem**: Need debug output in production environment.

**Solutions**:
```bash
# Set DEBUG in production environment
export DEBUG=agent-comm:logging:error
node dist/index.js

# Use PM2 with environment variables
pm2 start dist/index.js --env production --update-env DEBUG=agent-comm:logging:error
```

## Integration with Existing Logging

### Coordinating Debug with EventLogger

The debug package works alongside the existing EventLogger system. Here's how to integrate them effectively:

```typescript
import debug from 'debug';
import { EventLogger } from '../logging/EventLogger';

const log = debug('agent-comm:core:response');

export class ResponseEnhancer {
  private eventLogger: EventLogger;
  
  constructor(eventLogger: EventLogger) {
    this.eventLogger = eventLogger;
  }

  async enhance(response: Response): Promise<EnhancedResponse> {
    // Debug: Detailed development info
    log('Starting response enhancement for tool: %s', response.toolName);
    
    try {
      const result = await this.performEnhancement(response);
      
      // EventLogger: Permanent audit trail
      await this.eventLogger.logEvent('response_enhanced', {
        toolName: response.toolName,
        agent: response.agent,
        timestamp: new Date().toISOString()
      });
      
      // Debug: Development timing info
      log('Response enhancement completed successfully');
      
      return result;
    } catch (error) {
      // EventLogger: Critical error tracking
      await this.eventLogger.logEvent('response_enhancement_failed', {
        toolName: response.toolName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Debug: Detailed error context for developers
      log('Enhancement failed: %O', {
        error: error.message,
        stack: error.stack,
        context: response
      });
      
      throw error;
    }
  }
}
```

### When to Use Debug vs EventLogger

**Use Debug for:**
- Development debugging and troubleshooting
- Performance timing and optimization
- Detailed object inspection
- Conditional development-time logging
- Component-specific tracing

**Use EventLogger for:**
- Production audit trails
- Critical error tracking
- Compliance and accountability records
- Permanent operational logs
- Integration with external monitoring

**Example: Combined Usage Pattern**

```typescript
const log = debug('agent-comm:tools:create-task');

export class TaskCreator {
  async createTask(params: TaskParams): Promise<Task> {
    // Debug: Development tracing
    log('Creating task with params: %O', params);
    
    const task = await this.buildTask(params);
    
    // EventLogger: Permanent record
    await this.eventLogger.logEvent('task_created', {
      taskId: task.id,
      agent: params.agent,
      priority: params.priority
    });
    
    // Debug: Success confirmation
    log('Task created successfully: %s', task.id);
    
    return task;
  }
}
```

## Production vs Development Usage

### Development Environment Setup

```bash
# ~/.bashrc or ~/.zshrc
export DEBUG=agent-comm:core:*,agent-comm:tools:*

# Package.json scripts
{
  "scripts": {
    "dev": "DEBUG=agent-comm:* nodemon src/index.ts",
    "dev:core": "DEBUG=agent-comm:core:* nodemon src/index.ts",
    "dev:tools": "DEBUG=agent-comm:tools:* nodemon src/index.ts"
  }
}
```

### Production Environment Considerations

**Selective Debug Output in Production:**
```bash
# Only critical error debugging
export DEBUG=agent-comm:logging:error

# Performance monitoring
export DEBUG=agent-comm:core:response,agent-comm:utils:lock

# Specific troubleshooting
export DEBUG=agent-comm:tools:create-task
```

**Production-Safe Debug Patterns:**

```typescript
const log = debug('agent-comm:core:accountability');

export class AccountabilityTracker {
  detectRedFlags(context: TaskContext): RedFlag[] {
    const startTime = Date.now();
    
    // Safe for production: minimal overhead when DEBUG not set
    log('Starting red flag detection for task: %s', context.taskId);
    
    const redFlags = this.performDetection(context);
    
    // Production performance monitoring
    const duration = Date.now() - startTime;
    if (duration > 500) {
      log('PERFORMANCE ALERT: Red flag detection took %dms', duration);
    }
    
    log('Red flag detection completed: %d flags found', redFlags.length);
    return redFlags;
  }
}
```

### Docker Production Setup

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist

# Allow runtime debug control
ENV DEBUG=""
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

```bash
# Docker run with debug
docker run -e DEBUG=agent-comm:logging:error myapp
```

## Code Examples for Each Namespace

### Core Namespace Examples

#### agent-comm:core:accountability

```typescript
import debug from 'debug';

const log = debug('agent-comm:core:accountability');

export class AccountabilityTracker {
  async trackProgress(agent: string, taskId: string): Promise<ProgressReport> {
    log('Tracking progress for agent %s, task %s', agent, taskId);
    
    const report = await this.generateReport(agent, taskId);
    
    log('Progress report generated: %O', {
      agent,
      taskId,
      completionPercentage: report.completion,
      evidenceScore: report.evidenceScore
    });
    
    if (report.evidenceScore < 70) {
      log('LOW EVIDENCE SCORE WARNING: %d%% for task %s', 
          report.evidenceScore, taskId);
    }
    
    return report;
  }
}
```

#### agent-comm:core:response

```typescript
import debug from 'debug';

const log = debug('agent-comm:core:response');

export class ResponseEnhancer {
  async enhanceToolResponse(toolName: string, response: any): Promise<EnhancedResponse> {
    const startTime = Date.now();
    log('Enhancing %s response', toolName);
    
    // Log response size for performance monitoring
    const responseSize = JSON.stringify(response).length;
    log('Response size: %d bytes', responseSize);
    
    const enhanced = await this.applyEnhancements(toolName, response);
    
    const duration = Date.now() - startTime;
    log('%s enhancement completed in %dms', toolName, duration);
    
    return enhanced;
  }
}
```

### Tool Namespace Examples

#### agent-comm:tools:create-task

```typescript
import debug from 'debug';

const log = debug('agent-comm:tools:create-task');

export async function createTask(params: CreateTaskParams): Promise<TaskResult> {
  log('Creating task for agent: %s', params.agent);
  log('Task parameters: %O', {
    agent: params.agent,
    priority: params.priority,
    hasDeadline: !!params.deadline
  });
  
  try {
    const taskId = await generateTaskId();
    log('Generated task ID: %s', taskId);
    
    const task = await persistTask(taskId, params);
    log('Task persisted successfully');
    
    await notifyAgent(params.agent, taskId);
    log('Agent notification sent');
    
    return { success: true, taskId };
  } catch (error) {
    log('Task creation failed: %s', error.message);
    throw error;
  }
}
```

#### agent-comm:tools:progress

```typescript
import debug from 'debug';

const log = debug('agent-comm:tools:progress');

export class ProgressTracker {
  async updateProgress(taskId: string, progress: ProgressUpdate): Promise<void> {
    log('Updating progress for task %s: %d%%', taskId, progress.percentage);
    
    const previousProgress = await this.getCurrentProgress(taskId);
    const progressDelta = progress.percentage - previousProgress.percentage;
    
    log('Progress delta: %+d%%', progressDelta);
    
    if (progressDelta < 0) {
      log('WARNING: Progress decreased by %d%% for task %s', 
          Math.abs(progressDelta), taskId);
    }
    
    await this.saveProgress(taskId, progress);
    log('Progress update saved');
  }
}
```

### Logging Namespace Examples

#### agent-comm:logging:error

```typescript
import debug from 'debug';

const log = debug('agent-comm:logging:error');

export class ErrorLogger {
  async logError(entry: ErrorLogEntry): Promise<void> {
    log('Logging error from %s: %s', entry.source, entry.error.message);
    
    // Log error severity distribution
    log('Error severity: %s', entry.severity);
    
    try {
      await this.writeErrorLog(entry);
      log('Error logged successfully to disk');
      
      if (entry.severity === 'critical') {
        log('CRITICAL ERROR - triggering alerts');
        await this.triggerAlerts(entry);
      }
      
    } catch (writeError) {
      log('FAILED TO LOG ERROR: %s', writeError.message);
      // Fallback to console in this critical case
      console.error('ErrorLogger failure:', writeError);
    }
  }
}
```

### Resource Namespace Examples

#### agent-comm:resources:task

```typescript
import debug from 'debug';

const log = debug('agent-comm:resources:task');

export class TaskResourceProvider {
  async getTaskResource(taskId: string): Promise<TaskResource> {
    log('Retrieving resource for task: %s', taskId);
    
    const startTime = Date.now();
    const resource = await this.loadTask(taskId);
    const loadTime = Date.now() - startTime;
    
    log('Task loaded in %dms, size: %d bytes', 
        loadTime, JSON.stringify(resource).length);
    
    if (loadTime > 1000) {
      log('SLOW TASK LOAD WARNING: %dms for task %s', loadTime, taskId);
    }
    
    return resource;
  }
}
```

### Utility Namespace Examples

#### agent-comm:utils:validation

```typescript
import debug from 'debug';

const log = debug('agent-comm:utils:validation');

export class InputValidator {
  validateTaskParams(params: any): ValidationResult {
    log('Validating task parameters');
    log('Parameter keys: %O', Object.keys(params));
    
    const errors: string[] = [];
    
    if (!params.agent) {
      errors.push('Missing required agent field');
      log('Validation error: missing agent');
    }
    
    if (!params.taskType) {
      errors.push('Missing required taskType field');
      log('Validation error: missing taskType');
    }
    
    const isValid = errors.length === 0;
    log('Validation result: %s (%d errors)', 
        isValid ? 'PASS' : 'FAIL', errors.length);
    
    return { isValid, errors };
  }
}
```

## Summary

The debug package integration provides powerful development and troubleshooting capabilities:

1. **Namespace Organization**: Hierarchical structure for granular control
2. **Environment Control**: Flexible filtering via DEBUG environment variable
3. **Performance Timing**: Built-in timing for optimization insights
4. **Production Safety**: Zero overhead when disabled
5. **Testing Integration**: Compatible with Jest and CI/CD pipelines

### Quick Reference Commands

```bash
# Common debug patterns
DEBUG=agent-comm:* npm start                    # All debug output
DEBUG=agent-comm:core:* npm test               # Core components only
DEBUG=agent-comm:tools:create-task npm start   # Specific tool
DEBUG=*,-agent-comm:utils:* npm start          # Exclude utilities

# Performance monitoring
DEBUG=agent-comm:core:response npm start | grep "took.*ms"

# Error tracking
DEBUG=agent-comm:logging:error npm start
```

Remember: Use debug for development insights, EventLogger for production records!
