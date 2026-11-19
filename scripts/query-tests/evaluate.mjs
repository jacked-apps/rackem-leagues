/**
 * @fileoverview The query-test guard's verdict, as a pure function: given the
 * changed files, their contents, the database tests and the PR description,
 * which query files are untested, is there a waiver, and does the PR pass?
 *
 * Kept pure (all file reading lives in `scripts/check-query-tests.mjs`) so
 * the unit tests can feed it the exact shape of the My Stats (#277) PR.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U1)
 */

import { isAppSource } from './detect.mjs';
import { queryLines } from './spans.mjs';
import { moduleKey, testExercises } from './coverage.mjs';

/**
 * The PR-description opt-out: `[no-db-test: <reason>]`. Case-insensitive.
 * Ed (2026-11-17): waivers need no approval — CI just prints them.
 *
 * @param {string} body
 * @returns {{ present: boolean, reason: string }}
 * @example parseWaiver('[no-db-test: realtime only]') // { present: true, reason: 'realtime only' }
 */
export function parseWaiver(body) {
  const match = body.match(/\[no-db-test:([^\]]*)\]/i);
  return { present: Boolean(match), reason: match ? match[1].trim() : '' };
}

/**
 * @param {object} input
 * @param {Map<string, Set<number>>} input.changed - path → changed line numbers (from diff.mjs; deleted files excluded)
 * @param {(path: string) => string} input.readSource - current content of a changed file
 * @param {{ path: string, source: string }[]} input.dbTests - every file under src/__tests__/database/
 * @param {string} input.prBody
 * @returns {{ ok: boolean, uncovered: string[], covered: string[],
 *             waiver: { present: boolean, reason: string } }}
 */
export function evaluate({ changed, readSource, dbTests, prBody }) {
  // A file counts only when a changed line falls inside a query region —
  // see spans.mjs for why whole-file matching was too noisy.
  const queryFiles = [...changed].filter(([path, lines]) => {
    if (!isAppSource(path)) return false;
    const regions = queryLines(readSource(path));
    return [...lines].some((n) => regions.has(n));
  }).map(([path]) => path);
  const covered = [];
  const uncovered = [];
  for (const path of queryFiles) {
    const key = moduleKey(path);
    const exercised = dbTests.some((test) => testExercises(test.source, test.path, key));
    (exercised ? covered : uncovered).push(path);
  }
  const waiver = parseWaiver(prBody);
  // A waiver with no reason is not a waiver: "why" is the whole point of
  // printing it where Ed can see it.
  const ok = uncovered.length === 0 || (waiver.present && waiver.reason.length > 0);
  return { ok, uncovered, covered, waiver };
}
