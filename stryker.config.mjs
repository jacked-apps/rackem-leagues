/**
 * @fileoverview Mutation testing for the scoring / handicap code.
 *
 * What it does: makes small deliberate mistakes in the code below (flip a
 * `>=` to `>`, change a `+` to `-`, drop a condition…), one at a time, and
 * runs the tests against each. A mistake the tests catch is "killed"; one
 * they miss "survived" — a gap in what the tests protect. This is how we prove
 * the tests guard the math, not just run it.
 *
 * Run: `pnpm test:mutation` (local only — slow; CI is a later decision).
 * Then: `node scripts/mutation-summary.mjs` prints the plain-language report.
 * A survivor that can't matter gets a reasoned comment on the line above it:
 *   // Stryker disable next-line <mutator>: <why this can't change a result>
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U8)
 */

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  // Named explicitly: with pnpm's isolated node_modules, Stryker's automatic
  // plugin discovery can't see the runner and fails with 'no TestRunner
  // plugins were loaded'.
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.stryker.config.ts' },
  mutate: [
    'src/systems/**/*.ts',
    'src/utils/match/computeMatchRunningTotals.ts',
    'src/utils/match/engineRunningTotals.ts',
    'src/utils/match/engineInputs.ts',
    'src/utils/match/scoringSnapshot.ts',
    'src/utils/match/composeMatchThresholds.ts',
    'src/utils/match/computeMatchPrepPayload.ts',
    'src/utils/handicap/*.ts',
    'src/utils/fargoMatchTotals.ts',
    'src/utils/determineMatchResult.ts',
    // Not the code under test:
    '!src/**/*.{test,spec}.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts',
    '!src/**/types.ts',
  ],
  // Ed's machine runs out of memory with more than ~2 parallel workers.
  concurrency: 2,
  // Constants evaluated once at import are expensive to mutate and rarely
  // meaningful; skip them.
  ignoreStatic: true,
  // Re-test only mutants in code (or tests) that changed since the last run.
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  reporters: ['json', 'html', 'clear-text', 'progress'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  coverageAnalysis: 'perTest',
  timeoutMS: 20000,
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};
