/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

export default {
  roots: ['<rootDir>/test'],
  clearMocks: true,
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  collectCoverageFrom: ['./src/**'],
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/', '<rootDir>/test/fixtures/'],

  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-dotenv.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-jest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/', '<rootDir>/test/fixtures/'],
  moduleFileExtensions: ['js', 'ts'],
  testTimeout: 30000,
  // @webinterop/dns-connect leaks ref'd handles (a non-unref'd cache timer and
  // an open DoH socket) with no teardown API, keeping the worker alive past the
  // run. Force a clean exit until the upstream library exposes a way to close it.
  forceExit: true
};
