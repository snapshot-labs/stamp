import config from '@snapshot-labs/eslint-config';

export default [
  ...config,
  {
    files: ['test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
];
