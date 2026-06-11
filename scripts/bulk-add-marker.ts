/**
 * One-off: add `reviewedByEd: '<date>'` to the 23 entries that were
 * cleared during the 3-role convention sweep.
 *
 * Ed's bulk re-bless after he said "i'll have to trust ya."
 */

import fs from 'node:fs';
import path from 'node:path';

const TARGET = path.resolve('src/glossary/entries/general.tsx');
const DATE = '2026-05-31';

const SLUGS_TO_MARK = [
  'blackout-dates',
  'schedule',
  'game-type',
  'substitute',
  'house-rules',
  'break-foul',
  'win-by-forfeit',
  'lineup-lock',
  'racker',
  'breaker',
  'extra-round',
  'league-name',
  'league-operator',
  'double-duty',
  'break-and-run',
  'table-run',
  'golden-break',
  'prize-calculator',
  'bye',
  'rack',
  'tiebreaker',
  'single-short-race',
  'manual-tiebreaker',
];

let source = fs.readFileSync(TARGET, 'utf8');

let touched = 0;
let alreadyMarked = 0;
let notFound = 0;

for (const slug of SLUGS_TO_MARK) {
  // Find the entry block. Entry opens with either `'slug-name': {` or
  // `slugName: {` at indent 2.
  const openPatterns = [
    new RegExp(`^  '${slug}': \\{$`, 'm'),
    new RegExp(`^  ${slug.replace(/-/g, '')}:\\s*\\{$`, 'm'),
    new RegExp(`^  ${slug}: \\{$`, 'm'),
  ];
  let openMatch: RegExpMatchArray | null = null;
  for (const re of openPatterns) {
    openMatch = source.match(re);
    if (openMatch) break;
  }
  if (!openMatch || openMatch.index === undefined) {
    console.warn(`✗ ${slug}: entry not found`);
    notFound++;
    continue;
  }
  const openIdx = openMatch.index;
  // Find the entry's closing `  },` (at indent 2). Search forward from openIdx.
  const closeRe = /^  \},$/m;
  closeRe.lastIndex = openIdx;
  const afterOpen = source.slice(openIdx);
  const closeMatch = afterOpen.match(closeRe);
  if (!closeMatch || closeMatch.index === undefined) {
    console.warn(`✗ ${slug}: closing brace not found`);
    notFound++;
    continue;
  }
  const closeAbsoluteIdx = openIdx + closeMatch.index;
  // Slice out the entry body (from open to close, exclusive of close).
  const entryBlock = source.slice(openIdx, closeAbsoluteIdx);
  if (entryBlock.includes('reviewedByEd:')) {
    console.log(`  ${slug}: already marked, skipping`);
    alreadyMarked++;
    continue;
  }
  // Insert the marker line right before the closing `  },`.
  const insertion = `    reviewedByEd: '${DATE}',\n`;
  source = source.slice(0, closeAbsoluteIdx) + insertion + source.slice(closeAbsoluteIdx);
  console.log(`✓ ${slug}: marker added`);
  touched++;
}

fs.writeFileSync(TARGET, source, 'utf8');

console.log(`\nDone. Marked: ${touched}, already marked: ${alreadyMarked}, not found: ${notFound}`);
