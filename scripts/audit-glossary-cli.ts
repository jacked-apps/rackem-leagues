/**
 * @fileoverview pnpm glossary:verify — CLI for the drift audit.
 *
 * Reads entry source files directly (regex over the slug + canonicalName +
 * l1_anchor.path + l1_anchor.anchor fields), feeds them to `auditGlossary`,
 * prints a markdown-formatted report to stdout, and exits with code 1 on
 * any violation. Warnings (pending-file allowlist hits) do NOT cause a
 * non-zero exit.
 *
 * Usage: pnpm glossary:verify
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  auditGlossary,
  type EntryToVerify,
} from './audit-glossary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');
const ENTRIES_DIR = join(REPO_ROOT, 'src', 'glossary', 'entries');

/** Parse entries from source files (no React runtime needed). Each entry
 *  spans from its top-level `key: {` line to the matching close. We extract
 *  the slug, canonicalName, l1_anchor.path, and l1_anchor.anchor (when set). */
function parseEntries(): EntryToVerify[] {
  const files = readdirSync(ENTRIES_DIR).filter((f) => f.endsWith('.tsx'));
  const out: EntryToVerify[] = [];
  for (const file of files) {
    const content = readFileSync(join(ENTRIES_DIR, file), 'utf-8');
    // Split into entry-shaped segments.
    const segments = content.split(/(?=^  ['"]?[a-zA-Z0-9_-]+['"]?:\s*\{)/m);
    for (const seg of segments) {
      const slugMatch = seg.match(/slug:\s*['"]([^'"]+)['"]/);
      const nameMatch = seg.match(/canonicalName:\s*['"]([^'"]+)['"]/);
      const anchorBlock = seg.match(
        /l1_anchor:\s*\{([\s\S]*?)\}/,
      );
      if (!slugMatch || !nameMatch || !anchorBlock) continue;
      const pathMatch = anchorBlock[1].match(/path:\s*['"]([^'"]+)['"]/);
      const anchorMatch = anchorBlock[1].match(/anchor:\s*['"]([^'"]+)['"]/);
      if (!pathMatch) continue;
      out.push({
        slug: slugMatch[1],
        canonicalName: nameMatch[1],
        l1_anchor: {
          path: pathMatch[1],
          anchor: anchorMatch?.[1],
        },
      });
    }
  }
  return out;
}

function main() {
  const entries = parseEntries();
  const result = auditGlossary(entries, { repoRoot: REPO_ROOT });

  console.log(`# Glossary drift audit\n`);
  console.log(
    `**Entries checked:** ${entries.length}  |  **OK:** ${result.samples.length}  |  **Violations:** ${result.violations.length}  |  **Warnings:** ${result.warnings.length}\n`,
  );

  if (result.violations.length > 0) {
    console.log(`## ❌ Violations\n`);
    for (const v of result.violations) {
      const anchor = v.l1_anchor.anchor ? `#${v.l1_anchor.anchor}` : '';
      console.log(
        `- **${v.slug}** → \`${v.l1_anchor.path}${anchor}\` — ${v.reason.replace('_', ' ')}`,
      );
    }
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log(`## ⚠️  Warnings (pending-file allowlist hits)\n`);
    for (const w of result.warnings) {
      console.log(`- **${w.slug}** → \`${w.l1_anchor.path}\` (pending)`);
    }
    console.log();
  }

  if (result.ok) {
    console.log(`✅ All anchors resolve.\n`);
  } else {
    console.log(
      `❌ ${result.violations.length} violation(s). Fix the entries above or update the L1 path.\n`,
    );
    process.exit(1);
  }
}

main();
