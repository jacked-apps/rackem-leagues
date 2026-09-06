/**
 * Ensure a PR answers the What's New question — one way or the other.
 *
 * Passes when EITHER:
 *   - the PR changes src/whatsNew/releases.ts, or
 *   - the PR description contains [no-changelog]
 *
 * The point is that you can't FORGET, you can only DECIDE. Declaring
 * "no user-facing change" costs one line and is visible in review, so a wrong
 * [no-changelog] on a PR that plainly changes something a player sees gets
 * caught by a human — which is the right place for a judgement call.
 *
 * Deliberately NOT "you changed src/, therefore write an entry": that's wrong
 * most of the time (refactors, test fixes, dependency bumps, a migration
 * renumber), and a check that cries wolf gets routed around until it protects
 * nothing.
 *
 * Usage: node scripts/check-whats-new.mjs <changed-files-file> <pr-body-file>
 *
 * @see docs/plans/2026-09-05-002-feat-whats-new-plan.md
 */

import { readFileSync } from 'node:fs';

const RELEASES_PATH = 'src/whatsNew/releases.ts';
const OPT_OUT = '[no-changelog]';

const [, , changedFilesPath, prBodyPath] = process.argv;

if (!changedFilesPath || !prBodyPath) {
  console.error(
    'Usage: node scripts/check-whats-new.mjs <changed-files-file> <pr-body-file>'
  );
  process.exit(2);
}

/** Missing/unreadable inputs must not silently pass the check. */
function read(path, label) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    console.error(`Could not read ${label} (${path}): ${error.message}`);
    process.exit(2);
  }
}

const changedFiles = read(changedFilesPath, 'the changed-files list')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

const prBody = read(prBodyPath, 'the PR description');

const touchedReleases = changedFiles.includes(RELEASES_PATH);
// Case-insensitive: [No-Changelog] is plainly the same intent, and failing
// someone over capitalisation teaches them the check is pedantic.
const optedOut = prBody.toLowerCase().includes(OPT_OUT);

if (touchedReleases) {
  console.log(`OK — this PR updates ${RELEASES_PATH}.`);
  process.exit(0);
}

if (optedOut) {
  console.log(`OK — this PR declares ${OPT_OUT}.`);
  process.exit(0);
}

console.error(`
This PR neither adds a What's New entry nor says it doesn't need one.

Pick whichever is true:

  1. It changes something a user would notice
     → add a line to the "unreleased" block in ${RELEASES_PATH}

     Write it for a pool player, not an engineer. Say what changed FOR THEM,
     no jargon, one or two sentences:

       "Tapping Create team chat twice made two identical chats. Now it makes one."

     not

       "fix(messages): guard createTeamChat against a double-submit race"

  2. It doesn't — a refactor, a test fix, a dependency bump
     → put [no-changelog] in the PR description

Neither is more correct than the other. The check only insists you answer.

Full writing rules: the header comment in ${RELEASES_PATH}
`);
process.exit(1);
