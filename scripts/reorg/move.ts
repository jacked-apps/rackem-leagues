/**
 * @fileoverview Move files and rewrite every path that points at them.
 *
 * Reads `scripts/reorg/map.json` (unit → list of `{ from, to }`, where either
 * side may be a file or a folder), `git mv`s each file, and rewrites every
 * local path that points at a moved file, or that sits in a moved file. It
 * covers imports, `import type`, export-from, `import()`, `lazy()`,
 * `typeof import()` and `vi.mock` strings, and keeps each path's style (alias
 * stays alias, relative stays relative).
 *
 * Kept in the repo so a paused branch can be carried across the reorg by
 * running the same units on it.
 * Plan: docs/plans/2026-11-05-002-refactor-src-folder-reorg-plan.md
 *
 * Usage:
 *   pnpm exec tsx scripts/reorg/move.ts <unit> [--dry]
 *
 * After a real run it lists other text files (docs, configs, scripts) that
 * still name an old path, for a hand fix.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { findSpecifiers, resolveSpecifier, rewriteSpecifier } from './paths';

type Entry = { from: string; to: string };

const CODE = /\.(ts|tsx|js|jsx|mjs)$/;
const HISTORIC = /^(docs\/archive|docs\/plans|docs\/brainstorms|docs\/audits|memory-bank\/archive|archive)\//;

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Expand folder entries into one old → new pair per tracked file. */
export function expandMoves(entries: Entry[], tracked: string[]): Map<string, string> {
  const moves = new Map<string, string>();
  for (const { from, to } of entries) {
    const inside = tracked.filter((f) => f === from || f.startsWith(from + '/'));
    if (inside.length === 0) throw new Error(`Nothing tracked at ${from}`);
    for (const f of inside) moves.set(f, f === from ? to : to + f.slice(from.length));
  }
  const targets = new Set<string>();
  for (const [oldPath, newPath] of moves) {
    if (targets.has(newPath)) throw new Error(`Two files would land on ${newPath}`);
    if (tracked.includes(newPath) && !moves.has(newPath)) throw new Error(`${oldPath} → ${newPath} would overwrite a file`);
    targets.add(newPath);
  }
  return moves;
}

/**
 * New text for each code file whose paths change. Files with no change are
 * left out.
 */
export function planRewrites(
  moves: Map<string, string>,
  codeFiles: string[],
  read: (p: string) => string,
  exists: (p: string) => boolean,
): Map<string, { text: string; count: number }> {
  const out = new Map<string, { text: string; count: number }>();
  for (const file of codeFiles) {
    const newFile = moves.get(file) ?? file;
    const text = read(file);
    let result = '';
    let cursor = 0;
    let count = 0;
    for (const m of findSpecifiers(text)) {
      const target = resolveSpecifier(file, m.spec, exists);
      if (target === null) continue;
      const newTarget = moves.get(target) ?? target;
      if (newFile === file && newTarget === target) continue;
      const next = rewriteSpecifier(m.spec, file, target, newTarget, newFile);
      if (next === m.spec) continue;
      result += text.slice(cursor, m.start) + next;
      cursor = m.end;
      count++;
    }
    if (count > 0) out.set(file, { text: result + text.slice(cursor), count });
  }
  return out;
}

function main() {
  const [unit, flag] = process.argv.slice(2);
  const dry = flag === '--dry';
  const map = JSON.parse(readFileSync('scripts/reorg/map.json', 'utf8')) as { units: Record<string, Entry[]> };
  const entries = map.units[unit];
  if (!entries) throw new Error(`No unit "${unit}" in map.json`);

  const tracked = git('ls-files').split('\n').filter(Boolean);
  const trackedSet = new Set(tracked);
  const moves = expandMoves(entries, tracked);
  const codeFiles = tracked.filter((f) => CODE.test(f) && !f.startsWith('node_modules/'));
  const rewrites = planRewrites(moves, codeFiles, (p) => readFileSync(p, 'utf8'), (p) => trackedSet.has(p));

  console.log(`Unit ${unit}: ${moves.size} files move, ${rewrites.size} files get path edits.`);
  if (dry) {
    for (const [o, n] of moves) console.log(`  move  ${o} → ${n}`);
    for (const [f, r] of rewrites) console.log(`  edit  ${f} (${r.count})`);
    return;
  }

  // Write new text in place first, then move, so git sees one rename per file.
  for (const [f, r] of rewrites) writeFileSync(f, r.text);
  for (const [o, n] of moves) {
    mkdirSync(posix.dirname(n), { recursive: true });
    git('mv', o, n);
  }

  // Anything that still names an old path (comments, docs, configs, path-keyed
  // test tables) needs a hand fix. Imports are already rewritten by now.
  const oldPaths = [...new Set(entries.map((e) => e.from))];
  const leftovers = git('ls-files').split('\n').filter((f) => f && !HISTORIC.test(f) && f !== 'scripts/reorg/map.json' && /\.(ts|tsx|js|mjs|md|json|ya?ml|sh|txt|toml)$/.test(f));
  for (const f of leftovers) {
    const text = readFileSync(f, 'utf8');
    const hits = oldPaths.filter((p) => text.includes(p) || text.includes(p.replace(/^src\//, '@/')));
    if (hits.length) console.log(`  check ${f}: ${hits.join(', ')}`);
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/reorg/move.ts')) main();
