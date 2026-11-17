/**
 * @fileoverview Vitest config used ONLY by mutation testing (`pnpm test:mutation`).
 *
 * Stryker's vitest runner has no project selector, so it can't pick the `unit`
 * project out of vitest.config.ts — this config is that project on its own,
 * narrowed to the tests that can catch a scoring/handicap mistake (the scoring
 * modules' own tests, the utils tests, and src/__tests__/unit — which holds
 * the season replay, the strongest mistake-catcher we have). No database
 * tests: a mutant run must never touch Postgres.
 *
 * Shares define / plugins / aliases with vitest.config.ts so tests resolve
 * exactly as they do in the normal run.
 *
 * @see stryker.config.mjs
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U8)
 */

import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
  define: base.define,
  plugins: base.plugins,
  resolve: base.resolve,
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/systems/**/*.{test,spec}.{ts,tsx}',
      'src/utils/**/*.{test,spec}.{ts,tsx}',
      'src/__tests__/unit/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', 'src/__tests__/database/**'],
  },
});
