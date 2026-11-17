/**
 * @fileoverview Print the last mutation run (`pnpm test:mutation`) as plain
 * language: how many deliberate mistakes the tests caught, which they missed
 * (file:line + the change in words), which were accepted on purpose and why,
 * and tests that ran on mistakes without catching any.
 *
 * Usage: node scripts/mutation-summary.mjs [report.json]
 *   default report: reports/mutation/mutation.json
 * Exit 2 when the report is missing or empty.
 *
 * @see scripts/mutation-summary/summarize.mjs
 */

import { existsSync, readFileSync } from 'node:fs';
import { summarize } from './mutation-summary/summarize.mjs';

const path = process.argv[2] ?? 'reports/mutation/mutation.json';
const report = existsSync(path) && readFileSync(path, 'utf8').trim() ? JSON.parse(readFileSync(path, 'utf8')) : null;
if (!report || !Object.keys(report.files ?? {}).length) {
  console.error(`No mutation report at ${path} — run \`pnpm test:mutation\` first.`);
  process.exit(2);
}
console.log(summarize(report));
