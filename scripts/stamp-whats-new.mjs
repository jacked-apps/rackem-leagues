/**
 * Fold the waiting What's New notes into a versioned release.
 *
 * Runs AUTOMATICALLY as the `version` script in package.json: `npm version
 * <patch|minor|major>` bumps package.json, runs this, then commits and tags.
 * Whatever this writes (and the `git add` after it) lands in that same commit,
 * so the tag always carries its notes. Nobody runs this by hand at release.
 *
 * What it does:
 *   1. reads every `src/whatsNew/notes/*.json` (one file per PR, file-name order)
 *   2. writes them as a new block under the STAMP marker in releases.ts,
 *      dated today, with a summary joined from the notes' headlines
 *   3. deletes the note files
 *
 * It must never block a release, so two cases are a quiet success, not an
 * error: no notes waiting (a release with nothing user-facing) and a version
 * already stamped. A real failure (the marker missing, a broken note file) is
 * kept off main by src/whatsNew/__tests__/stampWhatsNew.test.ts.
 *
 * Usage: node scripts/stamp-whats-new.mjs [version]
 *        (the version defaults to package.json's, which npm has just bumped)
 *
 * @see docs/plans/2026-11-01-001-fix-whats-new-zero-step-release-plan.md
 */

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RELEASES_PATH = 'src/whatsNew/releases.ts';
const NOTES_DIR = 'src/whatsNew/notes';
const MARKER = '// STAMP: new releases are inserted directly below this line. Keep it.';

const version = (
  process.argv[2] ?? JSON.parse(readFileSync('package.json', 'utf8')).version
)?.replace(/^v/, '');

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`What's New: "${version}" isn't a version like 1.9.0.`);
  process.exit(2);
}

const noteFiles = existsSync(NOTES_DIR)
  ? readdirSync(NOTES_DIR).filter((f) => f.endsWith('.json')).sort()
  : [];

if (noteFiles.length === 0) {
  console.log(`What's New: no notes waiting, nothing to stamp for ${version}.`);
  process.exit(0);
}

const source = readFileSync(RELEASES_PATH, 'utf8');

if (source.includes(`version: '${version}'`)) {
  console.log(`What's New: ${version} is already stamped; notes left waiting for the next release.`);
  process.exit(0);
}

if (!source.includes(MARKER)) {
  console.error(`What's New: the STAMP marker is missing from ${RELEASES_PATH}. Nothing changed.`);
  process.exit(1);
}

const notes = noteFiles.flatMap((f) => JSON.parse(readFileSync(join(NOTES_DIR, f), 'utf8')));

/** A TypeScript single-quoted string literal. */
const str = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** "a", "a and b", "a, b and c". */
function joinPhrases(phrases) {
  if (phrases.length <= 1) return phrases[0] ?? '';
  return `${phrases.slice(0, -1).join(', ')} and ${phrases.at(-1)}`;
}

// Capitalise only the first letter: headlines are phrases written mid-sentence.
const joined = joinPhrases(notes.map((n) => n.headline).filter(Boolean));
const summary = joined ? joined[0].toUpperCase() + joined.slice(1) : 'Fixes and improvements';

// Local date, not toISOString(): that's UTC, so an evening release west of
// Greenwich would be dated tomorrow.
const now = new Date();
const today = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');

const entries = notes
  .map((n) =>
    [
      '      {',
      `        text: ${str(n.text)},`,
      n.kind && `        kind: ${str(n.kind)},`,
      n.forOperators && '        forOperators: true,',
      '      },',
    ]
      .filter(Boolean)
      .join('\n')
  )
  .join('\n');

const block = `  {
    version: '${version}',
    date: '${today}',
    summary: ${str(summary)},
    entries: [
${entries}
    ],
  },
`;

// Insert after the marker's line, in the file's own line endings (a Windows
// checkout may have CRLF).
const eol = source.includes('\r\n') ? '\r\n' : '\n';
const at = source.indexOf('\n', source.indexOf(MARKER)) + 1;
writeFileSync(RELEASES_PATH, source.slice(0, at) + block.replace(/\n/g, eol) + source.slice(at));
for (const f of noteFiles) rmSync(join(NOTES_DIR, f));

console.log(`What's New: stamped ${version} with ${notes.length} note(s) — "${summary}".`);
