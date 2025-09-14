/**
 * Comprehensive unit tests for ResponseEnhancer integration across ALL 17 MCP tools
 * Tests the complete Smart Response System implementation for issues #49 and #12
 *
 * CRITICAL: Following TEST-GUIDELINES.md and TEST-ERROR-PATTERNS.md
 * - NO 'any' types - using 'as unknown as SpecificType' pattern
 * - Using nullish coalescing (??) not logical OR (||)
 * - Complete mock setup for all dependencies
 * - Test plans >50 chars with proper structure
 */

import { jest } from '@jest/globals';
import { ResponseEnhancer } from '../../../src/core/ResponseEnhancer.js';
import { ComplianceTracker } from '../../../src/core/ComplianceTracker.js';
import { DelegationTracker } from '../../../src/core/DelegationTracker.js';
import { PromptManager } from '../../../src/prompts/PromptManager.js';
import type {
  EnhancementContext,
  ServerConfig
} from '../../../src/types.js';
import type { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import type { EventLogger } from '../../../src/logging/EventLogger.js';
import { AccountabilityTracker } from '../../../src/core/AccountabilityTracker.js';

// Mock dependencies
jest.mock('../../../src/core/ComplianceTracker.js');
jest.mock('../../../src/core/DelegationTracker.js');
jest.mock('../../../src/prompts/PromptManager.js');

describe('ResponseEnhancer - All Tools Integration', () => {
  let responseEnhancer: ResponseEnhancer;
  let mockComplianceTracker: jest.Mocked<ComplianceTracker>;
  let mockDelegationTracker: jest.Mocked<DelegationTracker>;
  let mockPromptManager: jest.Mocked<PromptManager>;
  let mockConfig: ServerConfig;
  let mockAccountabilityTracker: jest.Mocked<AccountabilityTracker>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances with proper typing
    mockComplianceTracker = new ComplianceTracker({} as ServerConfig) as jest.Mocked<ComplianceTracker>;
    mockDelegationTracker = new DelegationTracker({} as ServerConfig) as jest.Mocked<DelegationTracker>;
    mockPromptManager = new PromptManager({} as ServerConfig) as jest.Mocked<PromptManager>;

    // Create mock AccountabilityTracker
    mockAccountabilityTracker = {
      detectRedFlags: jest.fn().mockReturnValue([]),
      recordClaim: jest.fn(),
      recordProgress: jest.fn(),
      getCompletionScore: jest.fn().mockReturnValue(100),
      canAcceptCompletion: jest.fn().mockReturnValue(true),
      generateEvidenceReport: jest.fn().mockReturnValue('Evidence report'),
      generateErrorResponse: jest.fn()
    } as unknown as jest.Mocked<AccountabilityTracker>;

    // Setup mock config with proper type assertions (not 'any')
    mockConfig = {
      complianceTracker: mockComplianceTracker,
      delegationTracker: mockDelegationTracker,
      promptManager: mockPromptManager,
      commDir: './comm',
      archiveDir: './comm/.archive',
      logDir: './comm/.logs',
      disableArchive: false,
      enableArchiving: true,
      connectionManager: {} as unknown as ConnectionManager,
      eventLogger: {} as unknown as EventLogger
    } as unknown as ServerConfig;

    // Setup default mock behaviors
    mockComplianceTracker.getComplianceLevel.mockResolvedValue(85);
    mockComplianceTracker.getPersonalizedGuidance.mockResolvedValue('Continue following MCP protocol');
    mockDelegationTracker.checkIncompleteDelegations.mockResolvedValue([]);
    mockDelegationTracker.generateDelegationReminder.mockResolvedValue('');
    // Mock generateTaskToolInvocation method with proper typing
    mockDelegationTracker.generateTaskToolInvocation = jest.fn((targetAgent: string, taskId: string, content: string) =>
      `Task(subagent_type="${targetAgent}", prompt="Check and complete MCP task ${taskId}: ${content}")`
    ) as jest.MockedFunction<(targetAgent: string, taskId: string, taskContent: string) => string>;

    // Create ResponseEnhancer instance with mocked accountability tracker
    responseEnhancer = new ResponseEnhancer(mockConfig, mockAccountabilityTracker);
  });

  describe('Tool Coverage Tests - All 17 Tools', () => {
    describe('Context-Based Tools (5)', () => {
      it('should enhance get_task_context with contextual guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'get_task_context',
          agent: 'test-agent',
          toolResponse: {
            title: 'Test Task',
            objective: 'Complete the implementation',
            requirements: ['Requirement 1', 'Requirement 2'],
            currentAgent: 'test-agent'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker,
          delegationTracker: mockDelegationTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced).toBeDefined();
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
        expect(enhanced.guidance?.compliance_level).toBe(85);
      });

      it('should enhance submit_plan with TodoWrite integration reminder', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'submit_plan',
          agent: 'test-agent',
          toolResponse: {
            success: true,
            checkboxCount: 10,
            message: 'Plan submitted successfully'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance?.next_steps).toContain('TodoWrite');
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
      });

      it('should enhance report_progress with completion guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'report_progress',
          agent: 'test-agent',
          toolResponse: {
            success: true,
            updatedSteps: 5,
            summary: {
              completed: 3,
              inProgress: 1,
              pending: 1,
              blocked: 0
            }
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance?.next_steps).toBeDefined();
        // The reminder should contain 'Progress updated' as configured in the enhancer
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
        expect(enhanced.guidance?.contextual_reminder).toMatch(/progress|updated/i);
      });

      it('should enhance mark_complete with archive guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'mark_complete',
          agent: 'test-agent',
          toolResponse: {
            success: true,
            status: 'DONE',
            message: 'Task completed successfully'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance?.next_steps).toContain('Archive');
        expect(enhanced.guidance?.contextual_reminder).toContain('completed successfully');
      });

      it('should enhance archive_completed_tasks with next task guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'archive_completed_tasks',
          agent: 'test-agent',
          toolResponse: {
            success: true,
            archivedCount: 3,
            message: 'Archived 3 completed tasks'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
      });
    });

    describe('Traditional Task Tools (7)', () => {
      it('should enhance create_task with delegation detection (issue #12)', async () => {
        // Arrange - delegation scenario
        const context: EnhancementContext = {
          toolName: 'create_task',
          agent: 'delegating-agent',
          toolResponse: {
            taskId: '2025-01-10T10-00-00-delegation',
            status: 'created',
            taskType: 'delegation',
            targetAgent: 'senior-backend-engineer',
            content: 'Implement the new API endpoint with full testing'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker,
          delegationTracker: mockDelegationTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert - Must include Task tool invocation guidance
        expect(enhanced.guidance?.actionable_command).toBeDefined();
        expect(enhanced.guidance?.actionable_command).toContain('Task(');
        expect(enhanced.guidance?.actionable_command).toContain('senior-backend-engineer');
        expect(enhanced.guidance?.contextual_reminder).toContain('2-Phase Delegation');
        expect(enhanced.guidance?.delegation_template).toBeDefined();
      });

      it('should enhance check_tasks with prioritization guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'check_tasks',
          agent: 'test-agent',
          toolResponse: {
            tasks: [
              { taskId: 'task-1', title: 'Task 1', status: 'new' },
              { taskId: 'task-2', title: 'Task 2', status: 'in_progress' }
            ],
            totalCount: 2,
            newCount: 1,
            activeCount: 1
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
      });

      it('should enhance read_task with workflow guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'read_task',
          agent: 'test-agent',
          toolResponse: {
            content: '# Task Plan\n\n- [ ] Step 1\n- [ ] Step 2',
            lastModified: '2025-01-10T10:00:00Z'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
      });

      it('should enhance write_task with validation guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'write_task',
          agent: 'test-agent',
          toolResponse: {
            success: true,
            file: 'PLAN',
            message: 'Plan written successfully'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
      });

      it('should enhance list_agents with workload distribution guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'list_agents',
          agent: 'test-agent',
          toolResponse: {
            agents: [
              { name: 'agent-1', taskCount: 5, completedCount: 2 },
              { name: 'agent-2', taskCount: 3, completedCount: 3 }
            ],
            totalAgents: 2
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
      });

      it('should enhance archive_tasks with restoration guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'archive_tasks',
          agent: 'test-agent',
          toolResponse: {
            success: true,
            archivedCount: 5,
            archiveTimestamp: '2025-01-10T10-00-00'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
      });

      it('should enhance restore_tasks with verification guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'restore_tasks',
          agent: 'test-agent',
          toolResponse: {
            success: true,
            restoredCount: 3,
            restoredTasks: ['task-1', 'task-2', 'task-3']
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
      });
    });

    describe('Diagnostic Tools (2)', () => {
      it('should enhance get_full_lifecycle with analysis insights', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'get_full_lifecycle',
          agent: 'test-agent',
          toolResponse: {
            taskId: 'test-task',
            lifecycle: {
              created: '2025-01-10T09:00:00Z',
              planSubmitted: '2025-01-10T09:10:00Z',
              completed: '2025-01-10T10:00:00Z'
            },
            duration: '1 hour',
            progressAnalysis: {
              totalSteps: 10,
              completedSteps: 10,
              efficiency: 0.95
            }
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
      });

      it('should enhance track_task_progress with monitoring guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'track_task_progress',
          agent: 'test-agent',
          toolResponse: {
            taskId: 'test-task',
            currentProgress: {
              completed: 5,
              inProgress: 2,
              pending: 3,
              blocked: 0
            },
            estimatedCompletion: '30 minutes'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
      });
    });

    describe('Utility Tools (3)', () => {
      it('should enhance sync_todo_checkboxes with synchronization guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'sync_todo_checkboxes',
          agent: 'test-agent',
          toolResponse: {
            success: true,
            updatedCount: 5,
            message: 'Synchronized 5 checkboxes'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
      });

      it('should enhance get_server_info with minimal guidance', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'get_server_info',
          agent: 'test-agent',
          toolResponse: {
            name: 'agent-comm-mcp-server',
            version: '0.8.0',
            uptime: '2 hours',
            capabilities: {
              tools: 17,
              features: ['delegation', 'archiving', 'diagnostics']
            }
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.next_steps).toBeDefined();
      });

      it('should enhance ping with connection status', async () => {
        // Arrange
        const context: EnhancementContext = {
          toolName: 'ping',
          agent: 'test-agent',
          toolResponse: {
            status: 'healthy',
            timestamp: '2025-01-10T10:00:00Z'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance).toBeDefined();
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
      });
    });
  });

  describe('Delegation Pattern Detection (Issue #12)', () => {
    it('should detect incomplete delegations and provide alerts', async () => {
      // Arrange - simulate incomplete delegation scenario
      const incompleteDelegations = [
        {
          taskId: '2025-01-10T09-00-00-incomplete',
          targetAgent: 'backend-engineer',
          createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          taskToolInvoked: false,
          subagentStarted: false,
          completionStatus: 'pending' as const
        }
      ];

      mockDelegationTracker.checkIncompleteDelegations.mockResolvedValue(incompleteDelegations);
      mockDelegationTracker.generateDelegationReminder.mockResolvedValue(
        '⚠️ INCOMPLETE DELEGATION: Task 2025-01-10T09-00-00-incomplete delegated to backend-engineer but Task tool not invoked!'
      );

      // Generate Task tool invocation template
      const generateTaskToolInvocation = jest.fn().mockReturnValue(
        'Task(subagent_type="backend-engineer", prompt="Check and complete MCP task 2025-01-10T09-00-00-incomplete")'
      ) as jest.MockedFunction<(targetAgent: string, taskId: string, taskContent: string) => string>;
      mockDelegationTracker.generateTaskToolInvocation = generateTaskToolInvocation;

      const context: EnhancementContext = {
        toolName: 'check_tasks',
        agent: 'test-agent',
        toolResponse: {
          tasks: [{ taskId: 'new-task', title: 'New Task', status: 'new' }],
          totalCount: 1
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.contextual_reminder).toContain('INCOMPLETE DELEGATION');
      expect(mockDelegationTracker.checkIncompleteDelegations).toHaveBeenCalledWith('test-agent');
      expect(mockDelegationTracker.generateDelegationReminder).toHaveBeenCalledWith('test-agent');
    });

    it('should track new delegations for future detection', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: '2025-01-10T10-00-00-new-delegation',
          status: 'created',
          taskType: 'delegation',
          targetAgent: 'frontend-engineer',
          content: 'Build the user interface components'
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      await responseEnhancer.enhance(context);

      // Assert
      expect(mockDelegationTracker.recordDelegationCreated).toHaveBeenCalledWith(
        '2025-01-10T10-00-00-new-delegation',
        'frontend-engineer'
      );
    });

    it('should provide escalating guidance based on compliance level', async () => {
      // Test different compliance levels and expected guidance escalation
      const testCases = [
        { level: 95, expectedUrgency: 'friendly', expectedIcon: '✅' },
        { level: 75, expectedUrgency: 'warning', expectedIcon: '⚠️' },
        { level: 55, expectedUrgency: 'critical', expectedIcon: '⚠️' },  // ResponseEnhancer uses ⚠️ [FIRM] for this level
        { level: 25, expectedUrgency: 'blocking', expectedIcon: '🚨' }  // ResponseEnhancer uses 🚨 [CRITICAL] for low compliance
      ];

      for (const testCase of testCases) {
        // Arrange
        mockComplianceTracker.getComplianceLevel.mockResolvedValue(testCase.level);
        mockComplianceTracker.getPersonalizedGuidance.mockResolvedValue(
          `${testCase.expectedIcon} Guidance with ${testCase.expectedUrgency} tone`
        );

        const context: EnhancementContext = {
          toolName: 'create_task',
          agent: 'test-agent',
          toolResponse: {
            taskId: 'test-task',
            status: 'created',
            taskType: 'delegation',
            targetAgent: 'backend-engineer'
          },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker,
          delegationTracker: mockDelegationTracker
        };

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance?.compliance_level).toBe(testCase.level);
        expect(enhanced.guidance?.contextual_reminder).toContain(testCase.expectedIcon);
      }
    });
  });

  describe('Parallel Execution Support (Issue #49)', () => {
    it('should suggest parallel operations for independent tools', async () => {
      // Arrange - checking multiple tasks scenario
      const context: EnhancementContext = {
        toolName: 'check_tasks',
        agent: 'test-agent',
        toolResponse: {
          tasks: [
            { taskId: 'task-1', title: 'Backend API', status: 'new' },
            { taskId: 'task-2', title: 'Frontend UI', status: 'new' },
            { taskId: 'task-3', title: 'Database Schema', status: 'new' }
          ],
          totalCount: 3,
          newCount: 3
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Mock parallel execution detection
      mockComplianceTracker.getPersonalizedGuidance.mockResolvedValue(
        '💡 TIP: These tasks appear independent. Consider parallel execution for efficiency.'
      );

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.contextual_reminder).toContain('parallel');
      // Note: parallel_operations would be added as enhancement feature
    });

    it('should provide batch command examples for multiple operations', async () => {
      // Arrange - archive multiple tasks scenario
      const context: EnhancementContext = {
        toolName: 'list_agents',
        agent: 'test-agent',
        toolResponse: {
          agents: [
            { name: 'agent-1', taskCount: 10, completedCount: 10 },
            { name: 'agent-2', taskCount: 8, completedCount: 8 },
            { name: 'agent-3', taskCount: 5, completedCount: 5 }
          ],
          totalAgents: 3
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance).toBeDefined();
      // Note: batch_operations would be added as enhancement feature
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null responses gracefully', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'unknown_tool',
        agent: 'test-agent',
        toolResponse: null,
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced).toBeNull();
    });

    it('should handle enhancement failures without crashing', async () => {
      // Arrange
      mockComplianceTracker.getComplianceLevel.mockRejectedValue(
        new Error('Database connection failed')
      );

      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: { taskId: 'test', status: 'created' },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert - should return original response
      expect(enhanced).toMatchObject({ taskId: 'test', status: 'created' });
      expect(enhanced.guidance).toBeUndefined();
    });

    it('should handle missing trackers gracefully', async () => {
      // Arrange - config without trackers
      const minimalConfig = {
        commDir: './comm',
        archiveDir: './comm/.archive',
        logDir: './comm/.logs',
        disableArchive: false,
        enableArchiving: true
      } as unknown as ServerConfig;

      const minimalEnhancer = new ResponseEnhancer(minimalConfig);

      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: { taskId: 'test', status: 'created' },
        promptManager: undefined as unknown as PromptManager,
        complianceTracker: undefined as unknown as ComplianceTracker
      };

      // Act
      const enhanced = await minimalEnhancer.enhance(context);

      // Assert - should still provide basic enhancement
      expect(enhanced.guidance).toBeDefined();
      expect(enhanced.guidance?.next_steps).toBeDefined();
      expect(enhanced.guidance?.compliance_level).toBeUndefined();
    });

    it('should handle malformed tool responses', async () => {
      // Arrange - response missing expected fields
      const context: EnhancementContext = {
        toolName: 'report_progress',
        agent: 'test-agent',
        toolResponse: {
          // Missing completedSteps and totalSteps
          success: true
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert - should still provide guidance
      expect(enhanced.guidance).toBeDefined();
      expect(enhanced.guidance?.next_steps).toBeDefined();
    });
  });

  describe('Custom Enhancer Registration', () => {
    it('should allow registering custom enhancers for specific tools', async () => {
      // Arrange
      const customGuidance = {
        next_steps: 'Custom next steps for special tool',
        contextual_reminder: 'Custom reminder message',
        custom_field: 'Additional custom data'
      };

      responseEnhancer.registerEnhancer('custom_special_tool', {
        enhance: async () => customGuidance
      });

      const context: EnhancementContext = {
        toolName: 'custom_special_tool',
        agent: 'test-agent',
        toolResponse: { result: 'success' },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance).toMatchObject(customGuidance);
    });

    it('should override default enhancers when custom ones are registered', () => {
      // Arrange
      responseEnhancer.registerEnhancer('create_task', {
        enhance: async () => ({
          next_steps: 'Overridden next steps',
          contextual_reminder: 'Overridden reminder'
        })
      });

      // Assert
      expect(responseEnhancer.hasEnhancer('create_task')).toBe(true);
    });
  });

  describe('Parallel Execution Features (Issue #49)', () => {
    it('should generate parallel Task commands for check_tasks with multiple tasks', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'check_tasks',
        agent: 'test-agent',
        toolResponse: {
          newCount: 3,
          tasks: [
            { id: 'task-1', targetAgent: 'senior-frontend-engineer' },
            { id: 'task-2', targetAgent: 'senior-backend-engineer' },
            { id: 'task-3', targetAgent: 'senior-dba-advisor' }
          ]
        },
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.contextual_reminder).toContain('PARALLEL EXECUTION OPPORTUNITY');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-frontend-engineer", prompt="Handle task: task-1")');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-backend-engineer", prompt="Handle task: task-2")');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-dba-advisor", prompt="Handle task: task-3")');
    });

    it('should generate example parallel commands when task details not available', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'check_tasks',
        agent: 'test-agent',
        toolResponse: {
          newCount: 5 // Multiple tasks but no details
        },
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.contextual_reminder).toContain('PARALLEL EXECUTION OPPORTUNITY');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-frontend-engineer", prompt="Check for frontend tasks")');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-backend-engineer", prompt="Check for backend tasks")');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-dba-advisor", prompt="Check for database tasks")');
    });

    it('should suggest parallel delegation for list_agents with available agents', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'list_agents',
        agent: 'test-agent',
        toolResponse: {
          agents: [
            { name: 'senior-frontend-engineer', pendingTasks: 0 },
            { name: 'senior-backend-engineer', pendingTasks: 0 },
            { name: 'senior-dba-advisor', pendingTasks: 0 },
            { name: 'qa-test-automation-engineer', pendingTasks: 0 }
          ]
        },
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.contextual_reminder).toContain('PARALLEL DELEGATION OPPORTUNITY');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-frontend-engineer", prompt="Implement UI components');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-backend-engineer", prompt="Create API endpoints');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="senior-dba-advisor", prompt="Design database schema');
      expect(enhanced.guidance?.actionable_command).toContain('Task(subagent_type="qa-test-automation-engineer", prompt="Create test suite');
    });
  });

  describe('Delegation Escalation with Urgency Levels (Issue #12)', () => {
    it('should use gentle urgency for high compliance (80-100%)', async () => {
      // Arrange
      mockComplianceTracker.getComplianceLevel.mockResolvedValue(90);

      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: 'test-task',
          status: 'created',
          taskType: 'delegation',
          targetAgent: 'backend-engineer',
          content: 'Implement feature'
        },
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.urgency_level).toBe('gentle');
      expect(enhanced.guidance?.contextual_reminder).toContain('[GENTLE]');
      expect(enhanced.guidance?.contextual_reminder).toContain('✅');
      expect(enhanced.guidance?.contextual_reminder).toContain('2-Phase Delegation: Task Created → NEXT: Start Subagent');
    });

    it('should use firm urgency for medium compliance (50-80%)', async () => {
      // Arrange
      mockComplianceTracker.getComplianceLevel.mockResolvedValue(65);

      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: 'test-task',
          status: 'created',
          taskType: 'delegation',
          targetAgent: 'backend-engineer',
          content: 'Fix bug'
        },
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.urgency_level).toBe('firm');
      expect(enhanced.guidance?.contextual_reminder).toContain('[FIRM]');
      expect(enhanced.guidance?.contextual_reminder).toContain('⚠️');
      expect(enhanced.guidance?.contextual_reminder).toContain('WARNING: You MUST invoke the Task tool');
    });

    it('should use critical urgency for low compliance (<50%)', async () => {
      // Arrange
      mockComplianceTracker.getComplianceLevel.mockResolvedValue(30);

      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: 'test-task',
          status: 'created',
          taskType: 'delegation',
          targetAgent: 'backend-engineer',
          content: 'Critical task'
        },
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.urgency_level).toBe('critical');
      expect(enhanced.guidance?.contextual_reminder).toContain('[CRITICAL]');
      expect(enhanced.guidance?.contextual_reminder).toContain('🚨');
      expect(enhanced.guidance?.contextual_reminder).toContain('CRITICAL: Delegation incomplete! Execute Task tool IMMEDIATELY');
    });
  });
});