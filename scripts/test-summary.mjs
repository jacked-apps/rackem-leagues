/**
 * @fileoverview CI step: print a test run's results as plain language into the
 * job summary. Runs with `if: always()`, so a failing test step still gets its
 * summary — failures listed first.
 *
 * Usage: node scripts/test-summary.mjs <report.json> "<title>" [main-report.json]
 *   report.json      vitest JSON report from this run (--reporter=json)
 *   main-report.json the same report from main's last run, to name removed
 *                    tests; optional (missing → "couldn't compare")
 * Exit 2 when this run's report is missing or empty — a summary that says
 * "0 passed" because the report never got written would be a lie.
 *
 * @see scripts/test-summary/summarize.mjs
 */

import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { summarize } from './test-summary/summarize.mjs';

const [reportPath, title = 'Tests', mainPath] = process.argv.slice(2);
const read = (p) => (p && existsSync(p) && readFileSync(p, 'utf8').trim() ? JSON.parse(readFileSync(p, 'utf8')) : null);

const report = read(reportPath);
if (!report?.testResults?.length) {
  console.error(`No test report at ${reportPath ?? '(none given)'} — the test step didn't produce one, so there are no results to show.`);
  process.exit(2);
}

const markdown = summarize(report, { title, mainReport: read(mainPath) });
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
