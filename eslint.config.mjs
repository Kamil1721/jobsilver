import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ['src/scripts/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    '.next-dev/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'automation-worker/**',
    'graphify-out/**',
    '.claude/**',
    '.codex/**',
    'design-refs/**',
  ]),
])
