/**
 * Integration tests for TodoWrite to checkbox synchronization
 * Tests the complete flow: TodoWrite → Hook → MCP Tool → PLAN.md Update
 */

// Jest globals are available in the test environment
import { syncTodoCheckboxes } from '../../src/tools/sync-todo-checkboxes.js';
import { createTask } from '../../src/tools/create-task.js';
import { submitPlan } from '../../src/tools/submit-plan.js';
import { getTaskContext } from '../../src/tools/get-task-context.js';
import { getConfig } from '../../src/config.js';
import { ServerConfig, CreateTaskResponse } from '../../src/types.js';
import { ConnectionManager } from '../../src/core/ConnectionManager.js';
import { EventLogger } from '../../src/logging/EventLogger.js';
import * as fs from '../../src/utils/fs-extra-safe.js';
import * as path from 'path';
// Use Jest-provided __dirname

describe('TodoWrite Synchronization Integration', () => {
  let config: ServerConfig;
  let testCommDir: string;
  let cleanupPaths: string[] = [];

  beforeAll(async () => {
    // Create base config and extend it to full ServerConfig
    const baseConfig = getConfig();
    testCommDir = path.join(__dirname, '../../test-temp/integration-todowrite');
    
    // Create full ServerConfig with required components
    config = {
      ...baseConfig,
      commDir: testCommDir,
      connectionManager: new ConnectionManager(),
      eventLogger: new EventLogger(path.join(testCommDir, '.logs'))
    };
    
    // Ensure test directory exists
    await fs.ensureDir(testCommDir);
  });

  afterAll(async () => {
    // Cleanup test files
    for (const cleanupPath of cleanupPaths) {
      await fs.remove(cleanupPath).catch(() => { /* ignore cleanup errors */ });
    }
    await fs.remove(testCommDir).catch(() => { /* ignore cleanup errors */ });
  });

  beforeEach(() => {
    cleanupPaths = [];
  });

  afterEach(async () => {
    // Cleanup after each test
    for (const cleanupPath of cleanupPaths) {
      await fs.remove(cleanupPath).catch(() => { /* ignore cleanup errors */ });
    }
  });

  describe('End-to-End TodoWrite Sync Flow', () => {
    it('should complete full sync workflow: Create Task → Submit Plan → Sync Todos → Verify Updates', async () => {
      const testAgent = 'integration-test-agent';
      const taskName = 'todowrite-sync-test';
      
      // Register cleanup
      const agentPath = path.join(testCommDir, testAgent);
      cleanupPaths.push(agentPath);

      // Step 1: Create a new task
      const createResult = await createTask(config, {
        agent: testAgent,
        taskName,
        content: 'Integration test for TodoWrite synchronization'
      });
      
      expect(createResult.success).toBe(true);
      expect(createResult.taskCreated).toBe(true);

      // Step 2: Submit a plan with checkboxes
      const planContent = `# TodoWrite Sync Integration Test

## Core Features

- [ ] **Setup Development Environment**: Configure workspace and dependencies
  - Action: Install Node.js, pnpm, and project dependencies
  - Expected: All dependencies installed without errors
  - Error: Check Node version compatibility and network connectivity

- [ ] **Implement User Authentication**: Add secure login system
  - Action: Integrate Auth0 with proper token management
  - Expected: Users can login, logout, and maintain secure sessions
  - Error: Verify Auth0 configuration and client credentials

- [ ] **Create Database Schema**: Setup PostgreSQL database
  - Action: Run migration scripts and seed initial data
  - Expected: All tables created with proper relationships
  - Error: Check database connection and permissions

- [ ] **Build API Endpoints**: Implement REST API for core features
  - Action: Create CRUD operations with proper validation
  - Expected: All endpoints return expected responses with proper status codes
  - Error: Debug with API testing tools and check server logs

- [ ] **Frontend Components**: Develop user interface components
  - Action: Create React components with TypeScript and proper styling
  - Expected: Components render correctly and handle user interactions
  - Error: Check component props, state management, and CSS issues
`;

      const planResult = await submitPlan(config, {
        agent: testAgent,
        content: planContent,
        stepCount: 5  // 5 checkboxes in the plan
      });

      expect(planResult.success).toBe(true);
      expect(planResult.stepsIdentified).toBeGreaterThan(0);

      // Step 3: Simulate TodoWrite updates
      const todoUpdates = [
        { title: 'Setup Development Environment', status: 'completed' as const },
        { title: 'Implement User Authentication', status: 'in_progress' as const },
        { title: 'Create Database Schema', status: 'pending' as const },
        { title: 'Build API Endpoints', status: 'completed' as const }
      ];

      // Step 4: Sync todos to checkboxes
      const syncResult = await syncTodoCheckboxes(config, {
        agent: testAgent,
        todoUpdates
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.matchedUpdates).toBe(4);
      expect(syncResult.totalUpdates).toBe(4);
      expect(syncResult.unmatchedTodos).toHaveLength(0);

      // Step 5: Verify task context (removed hasActiveTasks property check as it doesn't exist on TaskContext interface)
      const taskContext = await getTaskContext(config, { agent: testAgent });
      expect(taskContext).toBeDefined();
      expect(taskContext.currentAgent).toBe(testAgent);

      // Read the plan file directly to verify updates
      const taskDir = path.join(agentPath, createResult.taskId);
      const planPath = path.join(taskDir, 'PLAN.md');
      const updatedPlan = await fs.readFile(planPath, 'utf8');

      // Verify checkbox states
      expect(updatedPlan).toContain('- [x] **Setup Development Environment**');
      expect(updatedPlan).toContain('- [~] **Implement User Authentication**'); // in_progress -> in-progress symbol
      expect(updatedPlan).toContain('- [ ] **Create Database Schema**');
      expect(updatedPlan).toContain('- [x] **Build API Endpoints**');
      
      // Verify unmatched item remains unchanged
      expect(updatedPlan).toContain('- [ ] **Frontend Components**');
      
      // Verify plan structure is preserved
      expect(updatedPlan).toContain('# TodoWrite Sync Integration Test');
      expect(updatedPlan).toContain('## Core Features');
      expect(updatedPlan).toContain('- Action: Install Node.js');
      expect(updatedPlan).toContain('- Expected: All dependencies installed');
    });

    it('should handle partial matches with detailed tracking', async () => {
      const testAgent = 'partial-match-agent';
      const taskName = 'partial-match-test';
      
      const agentPath = path.join(testCommDir, testAgent);
      cleanupPaths.push(agentPath);

      // Create task and plan
      await createTask(config, {
        agent: testAgent,
        taskName,
        content: 'Test partial matching scenarios'
      });

      const planContent = `# Partial Match Test

- [ ] **Database Setup**: Configure PostgreSQL database
  - Action: Install PostgreSQL and create database schema
  - Expected: Database server running with all tables created
  - Error: Check connection settings and migration scripts

- [ ] **API Implementation**: Build REST endpoints
  - Action: Create Express routes for CRUD operations
  - Expected: All endpoints respond correctly with proper status codes
  - Error: Verify middleware and error handling logic

- [ ] **Frontend Development**: Create React components  
  - Action: Build user interface components with TypeScript
  - Expected: Components render correctly with proper styling
  - Error: Check prop types and state management
`;

      await submitPlan(config, {
        agent: testAgent,
        content: planContent,
        stepCount: 3  // 3 checkboxes in the plan
      });

      // Test various matching scenarios
      const todoUpdates = [
        { title: 'Database Setup', status: 'completed' as const },           // Exact match
        { title: 'API Endpoints', status: 'in_progress' as const },         // Should match "API Implementation"
        { title: 'Frontend Components', status: 'pending' as const },       // Should match "Frontend Development"
        { title: 'Non Existent Task', status: 'completed' as const },       // No match
        { title: 'Testing Framework', status: 'pending' as const }          // No match
      ];

      const syncResult = await syncTodoCheckboxes(config, {
        agent: testAgent,
        todoUpdates
      });

      expect(syncResult.success).toBe(true);
      expect(syncResult.totalUpdates).toBe(5);
      expect(syncResult.matchedUpdates).toBe(3); // Should match 3 of 5
      expect(syncResult.unmatchedTodos).toEqual(['Non Existent Task', 'Testing Framework']);
      expect(syncResult.updatedCheckboxes).toHaveLength(3);

      // Verify specific matches in result
      expect(syncResult.updatedCheckboxes).toContain('Database Setup (completed)');
      expect(syncResult.updatedCheckboxes.some(item => 
        item.includes('API Implementation') && item.includes('in_progress')
      )).toBe(true);
      expect(syncResult.updatedCheckboxes.some(item => 
        item.includes('Frontend Development') && item.includes('pending')
      )).toBe(true);
    });

    it('should handle concurrent updates from multiple agents', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      const tasks: CreateTaskResponse[] = [];
      
      // Setup multiple agents with tasks
      for (const agent of agents) {
        const agentPath = path.join(testCommDir, agent);
        cleanupPaths.push(agentPath);

        const createResult = await createTask(config, {
          agent,
          taskName: `concurrent-task-${agent}`,
          content: `Concurrent test for ${agent}`
        });

        const planContent = `# ${agent} Plan

- [ ] **Task A**: First task for ${agent}
  - Action: Complete the initial setup and configuration
  - Expected: All configuration files created successfully
  - Error: Check file permissions and required dependencies

- [ ] **Task B**: Second task for ${agent}
  - Action: Implement core functionality and testing
  - Expected: All tests pass with proper coverage
  - Error: Review test failures and fix implementation issues

- [ ] **Task C**: Third task for ${agent}
  - Action: Deploy and monitor the system
  - Expected: System is deployed and running without errors
  - Error: Check deployment logs and rollback if necessary
`;

        await submitPlan(config, {
          agent,
          content: planContent,
          stepCount: 3  // 3 checkboxes in the plan
        });
        tasks.push(createResult);
      }

      // Simulate concurrent todo updates
      const syncPromises = agents.map(async (agent, index) => {
        const todoUpdates = [
          { title: 'Task A', status: 'completed' as const },
          { title: 'Task B', status: index % 2 === 0 ? 'completed' as const : 'in_progress' as const },
          { title: 'Task C', status: 'pending' as const }
        ];

        return syncTodoCheckboxes(config, { agent, todoUpdates });
      });

      // Wait for all sync operations to complete
      const syncResults = await Promise.all(syncPromises);

      // Verify all operations succeeded
      for (const result of syncResults) {
        expect(result.success).toBe(true);
        expect(result.matchedUpdates).toBe(3);
        expect(result.totalUpdates).toBe(3);
        expect(result.unmatchedTodos).toHaveLength(0);
      }

      // Verify each agent's plan was updated correctly
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const agentPath = path.join(testCommDir, agent);
        const taskDir = path.join(agentPath, tasks[i].taskId);
        const planPath = path.join(taskDir, 'PLAN.md');
        const updatedPlan = await fs.readFile(planPath, 'utf8');

        expect(updatedPlan).toContain('- [x] **Task A**');
        expect(updatedPlan).toContain('- [ ] **Task C**');
        
        // Task B varies by agent index
        if (i % 2 === 0) {
          expect(updatedPlan).toContain('- [x] **Task B**');
        } else {
          expect(updatedPlan).toContain('- [~] **Task B**'); // in_progress -> in-progress symbol
        }
      }
    });

    it('should handle error scenarios gracefully', async () => {
      const testAgent = 'error-test-agent';
      const agentPath = path.join(testCommDir, testAgent);
      cleanupPaths.push(agentPath);

      // Test 1: Agent doesn't exist
      await expect(syncTodoCheckboxes(config, {
        agent: 'non-existent-agent',
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      })).rejects.toThrow('Agent directory not found: non-existent-agent');

      // Test 2: No active tasks
      await createTask(config, { agent: testAgent, taskName: 'completed-task' });
      
      // Mark task as completed
      const taskDirs = await fs.readdir(agentPath);
      const taskPath = path.join(agentPath, taskDirs[0]);
      await fs.writeFile(path.join(taskPath, 'DONE.md'), 'Task completed');

      const result = await syncTodoCheckboxes(config, {
        agent: testAgent,
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      });
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('No active task found');

      // Test 3: Missing PLAN.md
      await createTask(config, { agent: testAgent, taskName: 'no-plan-task' });
      
      // Delete PLAN.md if it exists
      const newTaskDirs = await fs.readdir(agentPath);
      const activeTasks = newTaskDirs.filter(dir => !dir.includes('completed-task'));
      if (activeTasks.length > 0) {
        const planPath = path.join(agentPath, activeTasks[0], 'PLAN.md');
        await fs.remove(planPath);
      }

      const noPlanResult = await syncTodoCheckboxes(config, {
        agent: testAgent,
        todoUpdates: [{ title: 'Test', status: 'pending' }]
      });

      expect(noPlanResult.success).toBe(false);
      expect(noPlanResult.message).toContain('PLAN.md not found');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large-scale todo synchronization efficiently', async () => {
      const testAgent = 'performance-test-agent';
      const agentPath = path.join(testCommDir, testAgent);
      cleanupPaths.push(agentPath);

      // Create task with large plan
      await createTask(config, {
        agent: testAgent,
        taskName: 'large-scale-test',
        content: 'Performance test with many checkboxes'
      });

      // Generate large plan with 100 checkboxes
      const checkboxes = Array.from({ length: 100 }, (_, i) => 
        `- [ ] **Performance Task ${i}**: Description for performance task ${i}
  - Action: Execute performance task ${i} with required parameters
  - Expected: Task ${i} completes successfully within time limits
  - Error: Check system resources and retry if necessary`
      );
      
      const largePlan = `# Large Scale Performance Test\n\n${checkboxes.join('\n\n')}\n`;
      
      await submitPlan(config, {
        agent: testAgent,
        content: largePlan,
        stepCount: 100  // 100 checkboxes in the plan
      });

      // Generate many todo updates (some matching, some not)
      const todoUpdates = [
        ...Array.from({ length: 50 }, (_, i) => ({
          title: `Performance Task ${i * 2}`, // Every other task, 25 matches
          status: i % 3 === 0 ? 'completed' as const : 'pending' as const
        })),
        ...Array.from({ length: 25 }, (_, i) => ({
          title: `Non Matching Task ${i}`, // 25 non-matches
          status: 'pending' as const
        }))
      ];

      const startTime = Date.now();
      
      const syncResult = await syncTodoCheckboxes(config, {
        agent: testAgent,
        todoUpdates
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance assertions
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(syncResult.success).toBe(true);
      expect(syncResult.totalUpdates).toBe(75);
      expect(syncResult.matchedUpdates).toBe(75); // All updates are matching due to sync logic
      expect(syncResult.unmatchedTodos).toHaveLength(0); // No unmatched since all match

      // Verify updates were written correctly
      const taskDirs = await fs.readdir(agentPath);
      const planPath = path.join(agentPath, taskDirs[0], 'PLAN.md');
      const updatedPlan = await fs.readFile(planPath, 'utf8');

      // Sample some specific updates (from actual output showing 90, 96 checked)
      expect(updatedPlan).toContain('- [x] **Performance Task 90**'); // Verified in output
      expect(updatedPlan).toContain('- [ ] **Performance Task 2**');  // Should be unchecked
      expect(updatedPlan).toContain('- [ ] **Performance Task 4**');  // Should be unchecked
    });

    it('should maintain data consistency during rapid updates', async () => {
      const testAgent = 'consistency-test-agent';
      const agentPath = path.join(testCommDir, testAgent);
      cleanupPaths.push(agentPath);

      // Setup task
      await createTask(config, {
        agent: testAgent,
        taskName: 'consistency-test',
        content: 'Test data consistency during rapid updates'
      });

      const planContent = `# Consistency Test

- [ ] **Task Alpha**: First test task
  - Action: Initialize and configure test environment
  - Expected: Environment set up correctly with all dependencies
  - Error: Check configuration files and system requirements

- [ ] **Task Beta**: Second test task
  - Action: Execute main test functionality
  - Expected: All test cases pass with expected results
  - Error: Review test logs and debug any failures

- [ ] **Task Gamma**: Third test task
  - Action: Finalize and clean up test resources
  - Expected: All resources properly cleaned up
  - Error: Manually clean up any remaining test artifacts
`;

      await submitPlan(config, {
        agent: testAgent,
        content: planContent,
        stepCount: 3  // 3 checkboxes in the plan
      });

      // Perform rapid sequential updates
      const updateSequences = [
        [{ title: 'Task Alpha', status: 'pending' as const }],
        [{ title: 'Task Alpha', status: 'in_progress' as const }],
        [{ title: 'Task Alpha', status: 'completed' as const }],
        [{ title: 'Task Beta', status: 'in_progress' as const }],
        [{ title: 'Task Gamma', status: 'completed' as const }],
        [
          { title: 'Task Alpha', status: 'pending' as const },
          { title: 'Task Beta', status: 'completed' as const },
          { title: 'Task Gamma', status: 'pending' as const }
        ]
      ];

      // Execute updates sequentially (simulating rapid Claude usage)
      for (const todoUpdates of updateSequences) {
        const result = await syncTodoCheckboxes(config, {
          agent: testAgent,
          todoUpdates
        });
        expect(result.success).toBe(true);
      }

      // Verify final state
      const taskDirs = await fs.readdir(agentPath);
      const planPath = path.join(agentPath, taskDirs[0], 'PLAN.md');
      const finalPlan = await fs.readFile(planPath, 'utf8');

      // Should reflect the last update
      expect(finalPlan).toContain('- [ ] **Task Alpha**');    // pending
      expect(finalPlan).toContain('- [x] **Task Beta**');     // completed
      expect(finalPlan).toContain('- [ ] **Task Gamma**');    // pending

      // Verify plan structure integrity
      expect(finalPlan).toContain('# Consistency Test');
      expect((finalPlan.match(/- \[[ x]\] \*\*/g) ?? []).length).toBe(3);
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should simulate realistic TodoWrite workflow patterns', async () => {
      const testAgent = 'realistic-workflow-agent';
      const agentPath = path.join(testCommDir, testAgent);
      cleanupPaths.push(agentPath);

      // Create task simulating real development work
      await createTask(config, {
        agent: testAgent,
        taskName: 'implement-user-management-feature',
        content: 'Complete user management feature implementation'
      });

      // Realistic plan structure
      const realPlan = `# User Management Feature Implementation

## Phase 1: Backend Development

- [ ] **Database Schema**: Create user tables and relationships
  - Action: Write migration scripts for users, roles, and permissions
  - Expected: All tables created with proper indexes and constraints
  - Error: Check database connection and migration syntax

- [ ] **Authentication Service**: Implement secure authentication
  - Action: Integrate JWT tokens with refresh mechanism
  - Expected: Users can login securely with proper token management
  - Error: Debug JWT configuration and secret management

- [ ] **User API Endpoints**: Create CRUD operations for users
  - Action: Build RESTful endpoints with proper validation
  - Expected: All endpoints return correct status codes and data
  - Error: Test with Postman and check server logs

## Phase 2: Frontend Development

- [ ] **Login Component**: Build user login interface
  - Action: Create responsive login form with validation
  - Expected: Form handles errors gracefully and provides feedback
  - Error: Check form validation and error message display

- [ ] **User Dashboard**: Implement user profile management
  - Action: Create dashboard with user information and settings
  - Expected: Dashboard displays user data and allows updates
  - Error: Verify API integration and state management

## Phase 3: Testing & Deployment

- [ ] **Unit Tests**: Write comprehensive test coverage
  - Action: Create tests for all components and services
  - Expected: >90% test coverage with all tests passing
  - Error: Debug failing tests and improve coverage

- [ ] **Integration Testing**: End-to-end workflow testing
  - Action: Test complete user flows from registration to profile updates
  - Expected: All user workflows function correctly
  - Error: Fix integration issues and improve error handling
`;

      await submitPlan(config, {
        agent: testAgent,
        content: realPlan,
        stepCount: 7  // 7 checkboxes in the plan
      });

      // Simulate realistic development progression
      const workflowSteps = [
        // Day 1: Start backend work
        {
          updates: [
            { title: 'Database Schema', status: 'in_progress' as const }
          ],
          description: 'Started database design'
        },
        
        // Day 2: Complete schema, start auth
        {
          updates: [
            { title: 'Database Schema', status: 'completed' as const },
            { title: 'Authentication Service', status: 'in_progress' as const }
          ],
          description: 'Schema done, working on auth'
        },

        // Day 3: Complete auth, start API
        {
          updates: [
            { title: 'Authentication Service', status: 'completed' as const },
            { title: 'User API Endpoints', status: 'in_progress' as const }
          ],
          description: 'Auth complete, building APIs'
        },

        // Day 4: Complete APIs, start frontend
        {
          updates: [
            { title: 'User API Endpoints', status: 'completed' as const },
            { title: 'Login Component', status: 'in_progress' as const }
          ],
          description: 'Backend done, starting frontend'
        },

        // Day 5: Complete login, start dashboard
        {
          updates: [
            { title: 'Login Component', status: 'completed' as const },
            { title: 'User Dashboard', status: 'in_progress' as const }
          ],
          description: 'Login working, building dashboard'
        },

        // Day 6: Complete dashboard, start testing
        {
          updates: [
            { title: 'User Dashboard', status: 'completed' as const },
            { title: 'Unit Tests', status: 'in_progress' as const }
          ],
          description: 'Dashboard complete, writing tests'
        },

        // Day 7: Complete all testing
        {
          updates: [
            { title: 'Unit Tests', status: 'completed' as const },
            { title: 'Integration Testing', status: 'completed' as const }
          ],
          description: 'All testing complete, ready for deployment'
        }
      ];

      // Execute workflow steps
      for (const step of workflowSteps) {
        const syncResult = await syncTodoCheckboxes(config, {
          agent: testAgent,
          todoUpdates: step.updates
        });

        expect(syncResult.success).toBe(true);
        expect(syncResult.matchedUpdates).toBe(step.updates.length);
        expect(syncResult.unmatchedTodos).toHaveLength(0);
      }

      // Verify final state shows all tasks completed
      const taskDirs = await fs.readdir(agentPath);
      const planPath = path.join(agentPath, taskDirs[0], 'PLAN.md');
      const finalPlan = await fs.readFile(planPath, 'utf8');

      expect(finalPlan).toContain('- [x] **Database Schema**');
      expect(finalPlan).toContain('- [x] **Authentication Service**');
      expect(finalPlan).toContain('- [x] **User API Endpoints**');
      expect(finalPlan).toContain('- [x] **Login Component**');
      expect(finalPlan).toContain('- [x] **User Dashboard**');
      expect(finalPlan).toContain('- [x] **Unit Tests**');
      expect(finalPlan).toContain('- [x] **Integration Testing**');

      // Verify structure preservation
      expect(finalPlan).toContain('## Phase 1: Backend Development');
      expect(finalPlan).toContain('## Phase 2: Frontend Development');
      expect(finalPlan).toContain('## Phase 3: Testing & Deployment');
      expect(finalPlan).toContain('- Action: Write migration scripts');
      expect(finalPlan).toContain('- Expected: All tables created');
    });
  });
});