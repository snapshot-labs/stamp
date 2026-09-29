import config from '@snapshot-labs/eslint-config';

export default [
  ...config,
  {
    files: ['test/**'],
    ignores: [
      'test/unit/helpers/api.test.ts',
      'test/unit/helpers/graphql.test.ts',
      'test/unit/helpers/graphqlEnvelope.test.ts',
      'test/unit/resolvers/address.test.ts',
      'test/unit/resolvers/address/starknet-batch-guard.test.ts'
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
];
