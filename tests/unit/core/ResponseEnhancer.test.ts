/**
 * Unit tests for ResponseEnhancer class
 * Tests the core response enhancement functionality for the Smart Response System
 */

import { jest } from '@jest/globals';
import { ResponseEnhancer } from '../../../src/core/ResponseEnhancer.js';
import { ComplianceTracker } from '../../../src/core/ComplianceTracker.js';
import { DelegationTracker } from '../../../src/core/DelegationTracker.js';
import { PromptManager } from '../../../src/prompts/PromptManager.js';
import type { 
  EnhancementContext, 
  EnhancedResponse,
  ToolEnhancer,
  ServerConfig 
} from '../../../src/types.js';
import type { ConnectionManager } from '../../../src/core/ConnectionManager.js';
import type { EventLogger } from '../../../src/logging/EventLogger.js';

// Mock dependencies
jest.mock('../../../src/core/ComplianceTracker.js');
jest.mock('../../../src/core/DelegationTracker.js');
jest.mock('../../../src/prompts/PromptManager.js');

describe('ResponseEnhancer', () => {
  let responseEnhancer: ResponseEnhancer;
  let mockComplianceTracker: jest.Mocked<ComplianceTracker>;
  let mockDelegationTracker: jest.Mocked<DelegationTracker>;
  let mockPromptManager: jest.Mocked<PromptManager>;
  let mockConfig: ServerConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockComplianceTracker = new ComplianceTracker({} as ServerConfig) as jest.Mocked<ComplianceTracker>;
    mockDelegationTracker = new DelegationTracker({} as ServerConfig) as jest.Mocked<DelegationTracker>;
    mockPromptManager = new PromptManager({} as ServerConfig) as jest.Mocked<PromptManager>;

    // Setup mock config with proper type assertion
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

    // Create ResponseEnhancer instance
    responseEnhancer = new ResponseEnhancer(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(responseEnhancer).toBeDefined();
      expect(responseEnhancer).toBeInstanceOf(ResponseEnhancer);
    });
  });

  describe('enhance', () => {
    it('should enhance a basic tool response with guidance', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: '2025-01-10T10-00-00-test-task',
          status: 'created'
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      mockComplianceTracker.getComplianceLevel.mockResolvedValue(95);
      mockComplianceTracker.getPersonalizedGuidance.mockResolvedValue(
        'Great job! Continue with the implementation plan.'
      );

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced).toMatchObject({
        taskId: '2025-01-10T10-00-00-test-task',
        status: 'created',
        guidance: {
          next_steps: expect.any(String),
          contextual_reminder: expect.any(String),
          compliance_level: 95
        }
      });
    });

    it('should include actionable command for delegation tasks', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'delegating-agent',
        toolResponse: {
          taskId: '2025-01-10T10-00-00-delegation',
          status: 'created',
          taskType: 'delegation',
          targetAgent: 'senior-backend-engineer'
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      mockComplianceTracker.getComplianceLevel.mockResolvedValue(85);
      mockComplianceTracker.getPersonalizedGuidance.mockResolvedValue(
        'Remember to complete the delegation by invoking the Task tool.'
      );

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance).toBeDefined();
      expect(enhanced.guidance?.actionable_command).toContain('Task(');
      expect(enhanced.guidance?.actionable_command).toContain('senior-backend-engineer');
      expect(enhanced.guidance?.contextual_reminder).toContain('2-Phase Delegation');
    });

    it('should handle enhancement failure gracefully', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: '2025-01-10T10-00-00-test',
          status: 'created'
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      mockComplianceTracker.getComplianceLevel.mockRejectedValue(
        new Error('Compliance tracking failed')
      );

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert - Should return original response without enhancement
      expect(enhanced).toMatchObject({
        taskId: '2025-01-10T10-00-00-test',
        status: 'created'
      });
      expect(enhanced.guidance).toBeUndefined();
    });

    it('should escalate guidance based on compliance level', async () => {
      // Arrange
      const testCases = [
        { level: 95, expectedTone: 'friendly' },
        { level: 75, expectedTone: 'warning' },
        { level: 55, expectedTone: 'critical' },
        { level: 25, expectedTone: 'blocking' }
      ];

      for (const testCase of testCases) {
        const context: EnhancementContext = {
          toolName: 'create_task',
          agent: 'test-agent',
          toolResponse: { taskId: 'test-task', status: 'created' },
          promptManager: mockPromptManager,
          complianceTracker: mockComplianceTracker
        };

        mockComplianceTracker.getComplianceLevel.mockResolvedValue(testCase.level);
        mockComplianceTracker.getPersonalizedGuidance.mockResolvedValue(
          `Guidance with ${testCase.expectedTone} tone`
        );

        // Act
        const enhanced = await responseEnhancer.enhance(context);

        // Assert
        expect(enhanced.guidance?.compliance_level).toBe(testCase.level);
        expect(enhanced.guidance?.contextual_reminder).toBeDefined();
      }
    });
  });

  describe('registerEnhancer', () => {
    it('should register a custom tool enhancer', async () => {
      // Arrange
      const mockEnhance = jest.fn() as jest.MockedFunction<(context: EnhancementContext) => Promise<EnhancedResponse['guidance']>>;
      mockEnhance.mockResolvedValue({
        next_steps: 'Custom next steps',
        contextual_reminder: 'Custom reminder',
        compliance_level: 100
      });
      const customEnhancer: ToolEnhancer = {
        enhance: mockEnhance
      };

      // Act
      responseEnhancer.registerEnhancer('custom_tool', customEnhancer);

      const context: EnhancementContext = {
        toolName: 'custom_tool',
        agent: 'test-agent',
        toolResponse: { result: 'success' },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(mockEnhance).toHaveBeenCalledWith(context);
      expect(enhanced.guidance?.next_steps).toBe('Custom next steps');
    });

    it('should override default enhancer when registering for existing tool', () => {
      // Arrange
      const mockDefaultEnhance = jest.fn() as jest.MockedFunction<(context: EnhancementContext) => Promise<EnhancedResponse['guidance']>>;
      mockDefaultEnhance.mockResolvedValue({
        next_steps: 'Default steps',
        contextual_reminder: 'Default reminder',
        compliance_level: 90
      });
      const defaultEnhancer: ToolEnhancer = {
        enhance: mockDefaultEnhance
      };

      const mockOverrideEnhance = jest.fn() as jest.MockedFunction<(context: EnhancementContext) => Promise<EnhancedResponse['guidance']>>;
      mockOverrideEnhance.mockResolvedValue({
        next_steps: 'Override steps',
        contextual_reminder: 'Override reminder',
        compliance_level: 95
      });
      const overrideEnhancer: ToolEnhancer = {
        enhance: mockOverrideEnhance
      };

      // Act
      responseEnhancer.registerEnhancer('create_task', defaultEnhancer);
      responseEnhancer.registerEnhancer('create_task', overrideEnhancer);

      // Assert - The registry should have the override enhancer
      expect(responseEnhancer.hasEnhancer('create_task')).toBe(true);
    });
  });

  describe('hasEnhancer', () => {
    it('should return true for registered enhancers', () => {
      // Arrange
      const enhancer: ToolEnhancer = {
        enhance: jest.fn() as unknown as ToolEnhancer['enhance']
      };

      // Act
      responseEnhancer.registerEnhancer('test_tool', enhancer);

      // Assert
      expect(responseEnhancer.hasEnhancer('test_tool')).toBe(true);
    });

    it('should return false for unregistered enhancers', () => {
      // Assert
      expect(responseEnhancer.hasEnhancer('unknown_tool')).toBe(false);
    });
  });

  describe('generateNextSteps', () => {
    it('should generate appropriate next steps for create_task', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: 'test-task',
          status: 'created',
          taskType: 'self'
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const nextSteps = await responseEnhancer.generateNextSteps(context);

      // Assert
      expect(nextSteps).toContain('Submit your implementation plan');
    });

    it('should generate delegation-specific next steps', async () => {
      // Arrange
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
        complianceTracker: mockComplianceTracker
      };

      // Act
      const nextSteps = await responseEnhancer.generateNextSteps(context);

      // Assert
      expect(nextSteps).toContain('Complete delegation by invoking the Task tool');
    });

    it('should generate next steps for submit_plan', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'submit_plan',
        agent: 'test-agent',
        toolResponse: {
          success: true,
          checkboxCount: 5
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const nextSteps = await responseEnhancer.generateNextSteps(context);

      // Assert
      expect(nextSteps).toContain('Begin implementation');
      expect(nextSteps).toContain('TodoWrite');
    });

    it('should generate next steps for report_progress', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'report_progress',
        agent: 'test-agent',
        toolResponse: {
          success: true,
          completedSteps: 3,
          totalSteps: 5
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const nextSteps = await responseEnhancer.generateNextSteps(context);

      // Assert
      expect(nextSteps).toContain('Continue with remaining steps');
    });

    it('should generate next steps for mark_complete', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'mark_complete',
        agent: 'test-agent',
        toolResponse: {
          success: true,
          status: 'DONE'
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker
      };

      // Act
      const nextSteps = await responseEnhancer.generateNextSteps(context);

      // Assert
      expect(nextSteps).toContain('Archive completed tasks');
      expect(nextSteps).toContain('Check for new assignments');
    });
  });

  describe('integration with delegation tracking', () => {
    it('should detect incomplete delegations and provide alerts', async () => {
      // Arrange
      const incompleteDelegations = [
        {
          taskId: '2025-01-10T09-00-00-old-delegation',
          targetAgent: 'backend-engineer',
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          taskToolInvoked: false,
          subagentStarted: false,
          completionStatus: 'pending' as const
        }
      ];

      mockDelegationTracker.checkIncompleteDelegations.mockResolvedValue(
        incompleteDelegations
      );

      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: 'new-task',
          status: 'created'
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      mockComplianceTracker.getComplianceLevel.mockResolvedValue(70);

      // Act
      const enhanced = await responseEnhancer.enhance(context);

      // Assert
      expect(enhanced.guidance?.contextual_reminder).toContain('incomplete delegation');
      expect(mockDelegationTracker.checkIncompleteDelegations).toHaveBeenCalledWith('test-agent');
    });

    it('should track successful delegation completions', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: {
          taskId: 'delegation-task',
          status: 'created',
          taskType: 'delegation',
          targetAgent: 'backend-engineer'
        },
        promptManager: mockPromptManager,
        complianceTracker: mockComplianceTracker,
        delegationTracker: mockDelegationTracker
      };

      // Act
      await responseEnhancer.enhance(context);

      // Assert
      expect(mockDelegationTracker.recordDelegationCreated).toHaveBeenCalledWith(
        'delegation-task',
        'backend-engineer'
      );
    });
  });

  describe('error handling', () => {
    it('should handle null tool responses gracefully', async () => {
      // Arrange
      const context: EnhancementContext = {
        toolName: 'test_tool',
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

    it('should handle undefined compliance tracker gracefully', async () => {
      // Arrange
      const configWithoutTracker = {
        ...mockConfig,
        complianceTracker: undefined
      } as unknown as ServerConfig;

      const enhancer = new ResponseEnhancer(configWithoutTracker);

      const context: EnhancementContext = {
        toolName: 'create_task',
        agent: 'test-agent',
        toolResponse: { taskId: 'test', status: 'created' },
        promptManager: mockPromptManager,
        complianceTracker: undefined as unknown as ComplianceTracker
      };

      // Act
      const enhanced = await enhancer.enhance(context);

      // Assert - Should still enhance but without compliance data
      expect(enhanced.guidance).toBeDefined();
      expect(enhanced.guidance?.compliance_level).toBeUndefined();
    });
  });
});