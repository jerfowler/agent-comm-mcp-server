/**
 * Global test type declarations
 */

import type { ServerConfig as _ServerConfig, Task as _Task, Agent as _Agent } from '../../src/types.js';

declare global {
  const testUtils: {
    createMockConfig: (overrides?: any) => any;
    createMockTask: (overrides?: any) => any;
    createMockStats: (overrides?: any) => any;
    getTestTimestamp: () => string;
    sampleTaskContent: string;
    samplePlanContent: string;
    validationTestCases: {
      validStrings: string[];
      invalidStrings: any[];
      validNumbers: number[];
      invalidNumbers: any[];
      validBooleans: boolean[];
      invalidBooleans: any[];
      pathTraversalAttempts: string[];
      specialCharacters: string[];
      longStrings: string;
      emptyContent: string[];
    };
  };
}

export {};