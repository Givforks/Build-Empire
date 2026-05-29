const { FlatCompat } = require('@eslint/eslintrc');
const compat = new FlatCompat({
  recommendedConfig: true,
});

module.exports = [
  // bring in standard configs
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'),
  {
    ignores: [
      'node_modules/**',
      '**/node_modules/**',
      'dist/**',
      '**/dist/**',
      '**/*.map',
      'apps/**/dist/**',
      'FULL-STACK-HEAVY/myworkspace/node_modules/**'
    ],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      import: require('eslint-plugin-import')
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import/no-unresolved': 'off',
      'import/extensions': 'off'
    }
  }
];
