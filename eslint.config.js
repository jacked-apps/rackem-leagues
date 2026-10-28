import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'reference-code/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // A leading underscore marks a name as deliberately unused (a required
      // parameter slot, or a field pulled out of an object to omit it).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Fast-refresh only matters for files you edit with the dev server open.
    // These export non-components on purpose: shadcn/ui pairs each component
    // with its variants helper (upstream convention), test utils re-export
    // testing-library, and NavRoutes exports the router instance itself.
    files: ['src/components/ui/**', 'src/test/**', 'src/navigation/NavRoutes.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
