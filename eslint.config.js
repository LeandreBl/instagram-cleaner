import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.chrome-profile/**',
      '.chrome-profiles/**',
      '.cache/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      curly: ['error', 'all'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'SwitchCase[consequent.length>0]:not(:has(> BlockStatement))',
          message: 'Wrap switch case bodies in braces.',
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
