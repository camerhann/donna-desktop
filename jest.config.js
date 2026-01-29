/**
 * Jest Configuration for Donna Desktop
 *
 * This configuration is optimized for testing an Electron application.
 * It sets up proper module resolution, coverage thresholds, and test patterns.
 */

module.exports = {
  // Use Node environment for main process tests
  testEnvironment: 'node',

  // Root directories for tests
  roots: ['<rootDir>/tests', '<rootDir>/src'],

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],

  // Module path aliases matching project structure
  moduleNameMapper: {
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Setup files to run before each test suite
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/preload.js',  // Preload scripts are hard to test in isolation
    '!**/node_modules/**'
  ],

  // Coverage thresholds - start modest and increase as tests are added
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30
    }
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],

  // Coverage output directory
  coverageDirectory: '<rootDir>/coverage',

  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],

  // Transform settings (no transpilation needed for plain JS)
  transform: {},

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],

  // Verbose output for debugging
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Test timeout (10 seconds for async operations)
  testTimeout: 10000,

  // Detect open handles (useful for async tests)
  detectOpenHandles: true,

  // Force exit after all tests complete
  forceExit: true
};
