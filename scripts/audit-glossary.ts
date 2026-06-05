/**
 * @fileoverview The glossary drift audit verifier.
 *
 * Pure function. Walks every entry's `l1_anchor` and checks:
 *   - The referenced file exists under `docs/league-system/`.
 *   - When an `anchor` is set, either a literal `{#anchor}` marker OR a
 *     Markdown heading whose `github-slugger`-derived slug matches.
 *
 * Returns `{ ok, violations, warnings, samples }`. Does NOT throw. The CLI
 * wrapper (`audit-glossary-cli.ts`) prints a report and exits with code 1
 * when `ok` is false; the vitest test asserts `ok === true`.
 *
 * Pending-file allowlist: looks for a fenced YAML block in
 * `docs/league-system/implementation-status.md` containing a `pending_paths`
 * array. Entries pointing at allowlisted paths produce a `warning`, not a
 * `violation`. If the block is absent, the allowlist is empty.
 *
 * @see docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md (Unit 7)
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import GithubSlugger from 'github-slugger';

export interface L1Anchor {
  path: string;
  anchor?: string;
}

export interface EntryToVerify {
  slug: string;
  canonicalName: string;
  l1_anchor: L1Anchor;
}

export type ViolationReason = 'missing_file' | 'missing_anchor';

export interface Violation {
  slug: string;
  l1_anchor: L1Anchor;
  reason: ViolationReason;
}

export interface Warning {
  slug: string;
  l1_anchor: L1Anchor;
  reason: 'pending_file';
}

export interface Sample {
  slug: string;
  path: string;
  anchor?: string;
}

export interface AuditResult {
  ok: boolean;
  violations: Violation[];
  warnings: Warning[];
  samples: Sample[];
}

const PENDING_STATUS_FILE = join(
  'docs',
  'league-system',
  'implementation-status.md',
);

/** Parse a fenced YAML block named `pending_paths` from
 *  `implementation-status.md`. Returns an empty set when the file or block
 *  is missing — we just don't allowlist anything. */
function readPendingPaths(repoRoot: string): Set<string> {
  const statusPath = join(repoRoot, PENDING_STATUS_FILE);
  if (!existsSync(statusPath)) return new Set();
  const content = readFileSync(statusPath, 'utf-8');
  const yamlBlocks = content.matchAll(/```ya?ml\n([\s\S]*?)```/g);
  for (const block of yamlBlocks) {
    const body = block[1];
    const pendingMatch = body.match(
      /^pending_paths:\s*\n((?:\s*-\s*['"]?[^'"\n]+['"]?\s*\n?)+)/m,
    );
    if (!pendingMatch) continue;
    const result = new Set<string>();
    for (const line of pendingMatch[1].split('\n')) {
      const m = line.match(/^\s*-\s*['"]?([^'"]+?)['"]?\s*$/);
      if (m) result.add(m[1].trim());
    }
    return result;
  }
  return new Set();
}

/** Returns true if `anchor` resolves to either a literal `{#anchor}` marker
 *  or a Markdown heading whose github-slugger slug matches. */
function checkAnchor(absFilePath: string, anchor: string): boolean {
  const content = readFileSync(absFilePath, 'utf-8');
  if (content.includes(`{#${anchor}}`)) return true;

  const slugger = new GithubSlugger();
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    const headingText = match[1].trim();
    const cleaned = headingText.replace(/\s*\{#[^}]+\}\s*$/, '');
    const slug = slugger.slug(cleaned);
    if (slug === anchor) return true;
  }
  return false;
}

/**
 * Audit a set of glossary entries against the actual L1 file structure.
 * Pure function — no side effects beyond filesystem reads.
 */
export function auditGlossary(
  entries: readonly EntryToVerify[],
  options: { repoRoot?: string } = {},
): AuditResult {
  const repoRoot = options.repoRoot ?? process.cwd();
  const pendingPaths = readPendingPaths(repoRoot);

  const violations: Violation[] = [];
  const warnings: Warning[] = [];
  const samples: Sample[] = [];

  for (const entry of entries) {
    const { path, anchor } = entry.l1_anchor;
    const absPath = join(repoRoot, path);

    if (!existsSync(absPath)) {
      if (pendingPaths.has(path)) {
        warnings.push({
          slug: entry.slug,
          l1_anchor: entry.l1_anchor,
          reason: 'pending_file',
        });
      } else {
        violations.push({
          slug: entry.slug,
          l1_anchor: entry.l1_anchor,
          reason: 'missing_file',
        });
      }
      continue;
    }

    if (anchor && !checkAnchor(absPath, anchor)) {
      violations.push({
        slug: entry.slug,
        l1_anchor: entry.l1_anchor,
        reason: 'missing_anchor',
      });
      continue;
    }

    samples.push({ slug: entry.slug, path, anchor });
  }

  return {
    ok: violations.length === 0,
    violations,
    warnings,
    samples,
  };
}
