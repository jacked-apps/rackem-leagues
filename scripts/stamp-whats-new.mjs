/**
 * Stamp the accumulated `unreleased` entries with a version, and open a fresh
 * empty block.
 *
 * Run when cutting a release, and commit the result with the tag. The page and
 * the release then match by construction — the entries were written by the PRs
 * that made up that release, not reconstructed afterwards.
 *
 * Usage: node scripts/stamp-whats-new.mjs 1.9.0
 *
 * @see docs/plans/2026-09-05-002-feat-whats-new-plan.md
 */

import { readFileSync, writeFileSync } from 'node:fs';

const RELEASES_PATH = 'src/whatsNew/releases.ts';

const version = process.argv[2]?.replace(/^v/, '');

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage: node scripts/stamp-whats-new.mjs <version>   e.g. 1.9.0');
  process.exit(2);
}

const source = readFileSync(RELEASES_PATH, 'utf8');

if (source.includes(`version: '${version}'`)) {
  console.error(`${version} is already stamped in ${RELEASES_PATH}.`);
  process.exit(1);
}

if (!source.includes('version: UNRELEASED')) {
  console.error(`
No "unreleased" block found in ${RELEASES_PATH}.

Either it was already stamped, or it was removed. Nothing has been changed.
`);
  process.exit(1);
}

// Local date, not toISOString(): that's UTC, so an evening release west of
// Greenwich would be dated tomorrow.
const now = new Date();
const today = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');

const stamped = source.replace(
  /version: UNRELEASED,\n(\s*)date: null,/,
  `version: '${version}',\n$1date: '${today}',`
);

if (stamped === source) {
  console.error(`
Found "version: UNRELEASED" but couldn't match the block to stamp it.

The shape of releases.ts has probably changed. Stamp it by hand rather than
letting this guess. Nothing has been changed.
`);
  process.exit(1);
}

// Re-open an empty unreleased block above the one just stamped, so the next PR
// has somewhere to write without thinking about it.
const withFreshBlock = stamped.replace(
  /export const RELEASES: Release\[\] = \[\n/,
  `export const RELEASES: Release[] = [
  {
    version: UNRELEASED,
    date: null,
    summary: '',
    entries: [],
  },
`
);

writeFileSync(RELEASES_PATH, withFreshBlock);

console.log(`
Stamped ${version} (${today}) and opened a fresh unreleased block.

Before tagging:
  - check the summary line on ${version} — it's what the "Earlier releases"
    list shows, and it was written before you knew the whole release
  - read the entries once more as a player would
`);
