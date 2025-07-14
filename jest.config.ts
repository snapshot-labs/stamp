/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  collectCoverageFrom: ['./src/**'],
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/', '<rootDir>/test/fixtures/'],

  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-jest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/', '<rootDir>/test/fixtures/'],
  moduleFileExtensions: ['js', 'ts'],
  testTimeout: 30000
};
