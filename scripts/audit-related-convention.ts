/**
 * @fileoverview One-off audit: find entries in general.tsx where
 * the 3-role convention is violated.
 *
 * Convention (from src/glossary/types.ts):
 *   1. In-body links: every glossary term in longDef is a body link.
 *   2. "Relevant topics:" line at end of longDef = mirrors body links.
 *   3. `related` field = edge concepts NOT in body.
 *
 * This script reports:
 *   - Entries where a slug appears in BOTH the body AND `related`
 *     (duplication — should be in Relevant topics, not related).
 *   - Entries missing a "Relevant topics:" line when they have
 *     multiple body links.
 */

import fs from 'node:fs';
import path from 'node:path';

const TARGET = path.resolve('src/glossary/entries/general.tsx');
const source = fs.readFileSync(TARGET, 'utf8');

// Split the file into top-level entries. Entries look like:
//   `'some-slug':` or `someSlug:` at indent level 2, followed by `{ ... },`
// We approximate by finding each `slug: '<name>',` line and capturing
// the lines from one `slug:` declaration to just before the next.
const lines = source.split('\n');

interface Entry {
  slug: string;
  startLine: number;
  endLine: number;
  body: string;
  related: string[];
  bodyHrefs: string[];
  hasRelevantTopics: boolean;
}

const entries: Entry[] = [];
let current: Entry | null = null;

const slugLineRe = /^\s+slug: '([a-z-]+)',\s*$/;
const relatedLineRe = /^\s+related: \[(.*)\],\s*$/;
const relevantTopicsRe = /Relevant topics:/;
const hrefRe = /href="#([a-z-]+)"/g;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const slugMatch = line.match(slugLineRe);
  if (slugMatch) {
    if (current) {
      current.endLine = i - 1;
      entries.push(current);
    }
    current = {
      slug: slugMatch[1],
      startLine: i,
      endLine: i,
      body: '',
      related: [],
      bodyHrefs: [],
      hasRelevantTopics: false,
    };
    continue;
  }
  if (!current) continue;
  current.body += line + '\n';
  const relatedMatch = line.match(relatedLineRe);
  if (relatedMatch) {
    const items = relatedMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''))
      .filter(Boolean);
    current.related = items;
  }
  if (relevantTopicsRe.test(line)) {
    current.hasRelevantTopics = true;
  }
  const hrefMatches = [...line.matchAll(hrefRe)];
  for (const m of hrefMatches) {
    current.bodyHrefs.push(m[1]);
  }
}
if (current) {
  current.endLine = lines.length - 1;
  entries.push(current);
}

console.log(`Scanned ${entries.length} entries.\n`);

let violations = 0;

// We want to find body hrefs that aren't part of the Relevant topics line
// vs ones that are. Simplification: any href in the entry counts as body
// for the purpose of "is this slug referenced from body?"
//
// But the Relevant topics line itself contains hrefs — those should not
// count as "in body" for purposes of related-duplication. So separate
// hrefs that appear AFTER the "Relevant topics" line.
const allViolationsByEntry: Array<{ slug: string; duplicates: string[]; missingRelevantTopics: string[] }> = [];

for (const entry of entries) {
  // Split body into pre-Relevant-topics and post.
  const bodyLines = entry.body.split('\n');
  let relevantTopicsIdx = -1;
  for (let i = 0; i < bodyLines.length; i++) {
    if (relevantTopicsRe.test(bodyLines[i])) {
      relevantTopicsIdx = i;
      break;
    }
  }

  // Collect hrefs in the body (excluding Relevant topics line + below).
  const realBodyText =
    relevantTopicsIdx === -1
      ? entry.body
      : bodyLines.slice(0, relevantTopicsIdx).join('\n');
  const realBodyHrefs: string[] = [];
  for (const m of realBodyText.matchAll(hrefRe)) {
    realBodyHrefs.push(m[1]);
  }
  const realBodySet = new Set(realBodyHrefs);
  // Don't count self-references.
  realBodySet.delete(entry.slug);

  // Duplication: slugs in BOTH body and related.
  const duplicates = entry.related.filter((slug) => realBodySet.has(slug));

  // Body links missing from Relevant topics (when entry has Relevant topics).
  const relevantTopicsText =
    relevantTopicsIdx === -1
      ? ''
      : bodyLines.slice(relevantTopicsIdx).join('\n');
  const relevantTopicsHrefs: string[] = [];
  for (const m of relevantTopicsText.matchAll(hrefRe)) {
    relevantTopicsHrefs.push(m[1]);
  }
  const relevantTopicsSet = new Set(relevantTopicsHrefs);
  const missingFromRelevantTopics = [...realBodySet].filter(
    (slug) => !relevantTopicsSet.has(slug),
  );

  if (duplicates.length > 0 || (realBodySet.size >= 2 && !entry.hasRelevantTopics) || missingFromRelevantTopics.length > 0) {
    violations++;
    allViolationsByEntry.push({
      slug: entry.slug,
      duplicates,
      missingRelevantTopics: missingFromRelevantTopics,
    });
  }
}

console.log(`Entries with violations: ${violations}\n`);

for (const v of allViolationsByEntry) {
  console.log(`◇ ${v.slug}`);
  if (v.duplicates.length > 0) {
    console.log(
      `    duplicates in body & related: ${v.duplicates.join(', ')}`,
    );
  }
  if (v.missingRelevantTopics.length > 0) {
    console.log(
      `    body links missing from Relevant topics: ${v.missingRelevantTopics.join(', ')}`,
    );
  }
}
