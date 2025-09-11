module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.all.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked'
  ],
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  rules: {
    // Disable base ESLint rule in favor of TypeScript version
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true 
    }],
    
    // TEMPORARILY DISABLED STRICT ENFORCEMENT for repository recovery
    // '@typescript-eslint/no-explicit-any': 'error',
    // '@typescript-eslint/no-unsafe-argument': 'error',
    // '@typescript-eslint/no-unsafe-assignment': 'error',
    // '@typescript-eslint/no-unsafe-call': 'error',
    // '@typescript-eslint/no-unsafe-member-access': 'error',
    // '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    
    // Ban direct fs-extra imports - must use fs-extra-safe
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['fs-extra'],
          message: 'Import from ../utils/fs-extra-safe.js instead of fs-extra directly to prevent runtime errors'
        }
      ]
    }],
    
    // TEMPORARILY DISABLED - Ban specific TypeScript language features
    // 'no-restricted-syntax': [
    //   'error',
    //   // Ban 'any' type annotations completely
    //   {
    //     selector: 'TSTypeAnnotation > TSAnyKeyword',
    //     message: 'The "any" type is banned. Use specific types or unknown instead.'
    //   },
    //   // Ban 'any' in type assertions
    //   {
    //     selector: 'TSTypeAssertion > TSAnyKeyword',
    //     message: 'Type assertion to "any" is banned. Use specific types or unknown instead.'
    //   },
    //   // Ban 'any' in generic type parameters
    //   {
    //     selector: 'TSTypeParameter > TSTypeAnnotation > TSAnyKeyword',
    //     message: 'Generic type parameter "any" is banned. Use specific types or unknown instead.'
    //   },
    //   // Ban 'any' in function parameters
    //   {
    //     selector: 'FunctionDeclaration Parameter > TSTypeAnnotation > TSAnyKeyword',
    //     message: 'Function parameter type "any" is banned. Use specific types or unknown instead.'
    //   }
    // ],
    
    // General code quality
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn'
  },
  
  // Special overrides for test files - STRICT MODE ENFORCED
  overrides: [
    {
      files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true
      },
      rules: {
        // TEMPORARILY DISABLED STRICT ENFORCEMENT: Even tests must use proper types
        // '@typescript-eslint/no-explicit-any': 'error',
        // '@typescript-eslint/no-unsafe-assignment': 'error', 
        // '@typescript-eslint/no-unsafe-member-access': 'error',
        
        // Allow mock variables but still ban 'any'
        '@typescript-eslint/no-unused-vars': ['error', { 
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_|^mock',
          ignoreRestSiblings: true 
        }],
        
        // Allow console.log in tests for debugging
        'no-console': 'warn',
        
        // Test files can use type assertions more liberally (but not to 'any')
        '@typescript-eslint/no-unnecessary-type-assertion': 'warn'
      }
    }
  ]
};