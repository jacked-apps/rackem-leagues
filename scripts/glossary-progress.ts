/**
 * @fileoverview pnpm glossary:progress
 *
 * Lists glossary entries Ed has personally reviewed vs entries that still
 * need a content pass. Parses the entry source files directly (no React
 * runtime needed) by scanning for `slug`, `canonicalName`, and the
 * optional `reviewedByEd` field on each entry.
 *
 * Usage: pnpm glossary:progress
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ENTRIES_DIR = join(__dirname, '..', 'src', 'glossary', 'entries');

interface EntryRecord {
  slug: string;
  canonicalName: string;
  reviewedByEd?: string;
  file: string;
}

/**
 * Each entry in `src/glossary/entries/*.tsx` is an object literal that opens
 * with a `slug: '...'` field and (a few lines later) `canonicalName: '...'`.
 * `reviewedByEd: '...'` is optional and appears at the bottom of the entry,
 * before the closing `}`. We segment the file into entries by splitting on
 * `^  [key]: {` boundaries (two-space indent + key + ` : {` = top-level
 * entry start). Each segment is one entry's worth of source.
 */
function parseEntries(content: string, file: string): EntryRecord[] {
  const records: EntryRecord[] = [];
  // Split on the start of each top-level entry. The lookahead keeps the
  // delimiter with the following chunk.
  const segments = content.split(/(?=^  ['"]?[a-zA-Z0-9_-]+['"]?:\s*\{)/m);
  for (const seg of segments) {
    const slugMatch = seg.match(/slug:\s*['"]([^'"]+)['"]/);
    const nameMatch = seg.match(/canonicalName:\s*['"]([^'"]+)['"]/);
    const reviewMatch = seg.match(/reviewedByEd:\s*['"]([^'"]+)['"]/);
    if (!slugMatch || !nameMatch) continue;
    records.push({
      slug: slugMatch[1],
      canonicalName: nameMatch[1],
      reviewedByEd: reviewMatch?.[1],
      file,
    });
  }
  return records;
}

function main() {
  const files = readdirSync(ENTRIES_DIR).filter((f) => f.endsWith('.tsx'));
  const all: EntryRecord[] = [];
  for (const file of files) {
    const content = readFileSync(join(ENTRIES_DIR, file), 'utf-8');
    all.push(...parseEntries(content, file));
  }

  const reviewed = all.filter((e) => e.reviewedByEd);
  const unreviewed = all.filter((e) => !e.reviewedByEd);
  const pct = all.length === 0 ? 0 : Math.round((reviewed.length / all.length) * 100);

  console.log(
    `\nGlossary review progress: ${reviewed.length}/${all.length} (${pct}%)\n`,
  );

  if (reviewed.length > 0) {
    console.log('Reviewed (most recent first):');
    [...reviewed]
      .sort((a, b) =>
        (b.reviewedByEd ?? '').localeCompare(a.reviewedByEd ?? ''),
      )
      .forEach((e) =>
        console.log(
          `  ✓ ${e.slug.padEnd(35)} ${e.reviewedByEd}  ${e.canonicalName}`,
        ),
      );
    console.log();
  }

  console.log(`Unreviewed (${unreviewed.length}):`);
  unreviewed
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName))
    .forEach((e) =>
      console.log(`  ☐ ${e.slug.padEnd(35)}             ${e.canonicalName}`),
    );
  console.log();
}

main();
