/**
 * @fileoverview PR check: a change to database query code needs a real-
 * database test that exercises it — or a waiver CI prints for everyone to see.
 *
 * Why: My Stats (#277) shipped a query Postgres rejected outright while ~4,800
 * unit tests passed — none of them asked Postgres anything. On the commit that
 * shipped the bug, this check fails and names `playerGameHistory.ts`.
 *
 * Rules (helpers in scripts/query-tests/):
 *   - query code = a changed line inside a Supabase call chain, or inside a
 *                  select constant such a chain uses (where #277 broke)
 *   - covered    = a file under src/__tests__/database/ imports the module AND
 *                  uses what it imported (a bare import doesn't count)
 *   - waiver     = `[no-db-test: <reason>]` in the PR description; printed in
 *                  the job summary. No approval step (Ed, 2026-11-17).
 *
 * Usage: node scripts/check-query-tests.mjs <diff-file> <pr-body-file>
 * <diff-file> is `git diff -U0 <base> <head>`. Run from the repo root (it
 * reads the PR's version of every file).
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U1)
 */

import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { changedLines } from './query-tests/diff.mjs';
import { evaluate } from './query-tests/evaluate.mjs';

const DB_TEST_DIR = 'src/__tests__/database';
const [, , diffPath, prBodyPath] = process.argv;

if (!diffPath || !prBodyPath) {
  console.error('Usage: node scripts/check-query-tests.mjs <diff-file> <pr-body-file>');
  process.exit(2);
}

/** Missing inputs must not silently pass the check. */
function read(path, label) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    console.error(`Could not read ${label} (${path}): ${error.message}`);
    process.exit(2);
  }
}

/** Every .ts/.tsx file under the db test folder, helpers included. */
function dbTestFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return dbTestFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [{ path, source: read(path, 'a db test') }] : [];
  });
}

// Deleted files never appear (their new side is /dev/null); existsSync is a
// second guard for renames the diff reports oddly.
const changed = new Map(
  [...changedLines(read(diffPath, 'the diff'))].filter(([path]) => existsSync(path)),
);

const result = evaluate({
  changed,
  readSource: (path) => read(path, path),
  dbTests: dbTestFiles(DB_TEST_DIR),
  prBody: read(prBodyPath, 'the PR description'),
});

const lines = ['## Database query tests', ''];
for (const path of result.covered) lines.push(`- OK: \`${path}\` — a real-database test uses it`);
for (const path of result.uncovered) lines.push(`- **NO real-database test:** \`${path}\``);
if (result.covered.length + result.uncovered.length === 0) lines.push('No query code changed.');
if (result.waiver.present) {
  lines.push('', '### Waivers', '', `- \`[no-db-test]\` — ${result.waiver.reason || '(no reason given)'}`);
}
const summary = lines.join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);

if (!result.ok) {
  console.error(`
These files change a database query, but no test under ${DB_TEST_DIR}/
uses them. Unit tests with a faked database can't catch a broken query —
that's how My Stats shipped broken (#277).

Fix (pick one):
  1. Add or extend a test in ${DB_TEST_DIR}/ that calls the changed code
     against the real local database. A query inside a component? Move it
     into src/api/ first, then test it there.
  2. If a real-database test truly can't cover it (e.g. realtime-only), put
     [no-db-test: <why>] in the PR description. It will be printed above.
`);
  process.exit(1);
}
