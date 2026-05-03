/* eslint-disable */
module.exports = {
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  extends: ['eslint:recommended'],
  globals: {
    L: 'readonly',
    BeachGirlCalendar: 'readonly',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'semi': ['error', 'always'],
    'no-var': 'error',
    'prefer-const': 'warn',
    'eqeqeq': ['warn', 'always'],
  },
  overrides: [
    {
      files: ['build.js', 'scripts/**/*.js'],
      env: { node: true, browser: false },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'photos/',
    '*.json',
    'manage-listings-apm/',
    '.geocode-cache.json',
  ],
};
