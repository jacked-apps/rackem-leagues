import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest config.
 *
 * Two projects so DB-backed tests (which share a single local Postgres
 * and would race each other under parallel execution) get pinned to
 * sequential execution automatically — neither the developer nor CI
 * has to remember a flag.
 *
 *   - unit       : every other *.test.* file. Parallel, happy-dom.
 *   - db         : src/__tests__/database/**. Sequential (fileParallelism:
 *                  false), jsdom (some files import supabase-js, which
 *                  happy-dom can't handle on writes).
 *
 * Run `pnpm test:run` to execute both projects; vitest handles the
 * sequential-vs-parallel scheduling per project transparently.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/.{idea,git,cache,output,temp}',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'happy-dom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['**/*.{test,spec}.{ts,tsx}'],
          exclude: [
            'node_modules',
            'dist',
            '.next',
            '.cache',
            'src/__tests__/database/**',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/__tests__/database/**/*.{test,spec}.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
