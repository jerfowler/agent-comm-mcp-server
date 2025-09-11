/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.smoke.ts',
    '**/tests/**/*.e2e.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/config.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Transform configuration optimized for ESM
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: './tsconfig.test.json'
    }],
    '^.+\\.js$': ['ts-jest', {
      useESM: true
    }]
  },
  // Module name mapping to handle .js extensions in TypeScript imports
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Don't transform node_modules except for ESM packages that need it
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol|fs-extra)/)'
  ],
  // Enhanced error reporting
  errorOnDeprecated: false,
  detectOpenHandles: true,
  forceExit: true,
  
  // Performance optimizations
  maxWorkers: '50%',
  cache: true,
  
  // Test result formatting
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml'
    }]
  ]
};

export default config;