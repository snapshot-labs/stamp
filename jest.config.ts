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
  globals: { 'ts-jest': { tsconfig: { allowJs: true } } },
  // jsdom's dependency tree ships ESM-only packages, which Jest's CommonJS runtime cannot load untranspiled
  transform: { '^.+\\.m?js$': 'ts-jest' },
  transformIgnorePatterns: [
    '^(?!.*/node_modules/(@exodus|@asamuzakjp|@csstools|parse5)/).*/node_modules/'
  ],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-dotenv.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup-jest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/dist/', '<rootDir>/test/fixtures/'],
  moduleFileExtensions: ['js', 'mjs', 'ts'],
  testTimeout: 30000
};
