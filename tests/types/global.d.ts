/**
 * Global test type declarations
 */

import type { ServerConfig as _ServerConfig, Task as _Task, Agent as _Agent } from '../../src/types.js';
import type { Stats } from 'fs';

declare global {
  const testUtils: {
    createMockConfig: (overrides?: Partial<_ServerConfig>) => _ServerConfig;
    createMockTask: (overrides?: Partial<_Task>) => _Task;
    createMockStats: (overrides?: Partial<Stats>) => Stats;
    getTestTimestamp: () => string;
    sampleTaskContent: string;
    samplePlanContent: string;
    validationTestCases: {
      validStrings: string[];
      invalidStrings: unknown[];
      validNumbers: number[];
      invalidNumbers: unknown[];
      validBooleans: boolean[];
      invalidBooleans: unknown[];
      pathTraversalAttempts: string[];
      specialCharacters: string[];
      longStrings: string;
      emptyContent: string[];
    };
  };
}

export {};