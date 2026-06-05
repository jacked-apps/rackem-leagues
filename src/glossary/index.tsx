/**
 * @fileoverview Glossary registry — merges per-domain entry files, exposes
 * slug-keyed lookup, alphabetical browse, alias-aware search, and a thin
 * InfoButton-shape helper.
 *
 * Slugs are compile-time enforced via the `GlossarySlug` union derived from
 * the merged registry — type-checked callers cannot reference a non-existent
 * slug. The GlossaryInfoButton wrapper still guards against type-cast bypass
 * at runtime.
 *
 * Search mirrors the pattern in src/rules/useRulebookSearch.ts: plain
 * case-insensitive substring on canonical names + aliases, useMemo-wrapped
 * hook for React callers. Upgrade path: swap searchGlossary for a Fuse.js or
 * MiniSearch implementation behind the same signature when zero-result rates
 * tell us we need more.
 *
 * @see docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md Unit 1.
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { entries as handicap } from './entries/handicap';
import { entries as scoring } from './entries/scoring';
import { entries as matchFormat } from './entries/match-format';
import { entries as standings } from './entries/standings';
import { entries as general } from './entries/general';
import type { GlossaryEntry } from './types';

/** Merged registry: { slug -> GlossaryEntry } across every per-domain file. */
const registry = {
  ...handicap,
  ...scoring,
  ...matchFormat,
  ...standings,
  ...general,
} as const;

/** Compile-time union of every known slug. New entries extend it automatically. */
export type GlossarySlug = keyof typeof registry;

/**
 * Resolve a slug to its entry. Slug is type-checked at the call site, so the
 * return is never null — an unknown slug is a compile error.
 */
export function getGlossaryEntry(slug: GlossarySlug): GlossaryEntry {
  return registry[slug];
}

/** All entries, alphabetized by canonicalName, for browse views. */
export function getAllGlossaryEntries(): GlossaryEntry[] {
  return Object.values(registry).sort((a, b) =>
    a.canonicalName.localeCompare(b.canonicalName),
  );
}

export type GlossaryMatchType = 'canonical' | 'alias';

export interface GlossarySearchResult {
  entry: GlossaryEntry;
  matchType: GlossaryMatchType;
  /** Index of the substring match within the matched field. */
  matchIndex: number;
  /** When matchType is 'alias', which alias matched. */
  matchedAlias?: string;
}

/**
 * Pure search over canonical names + aliases. Plain case-insensitive substring;
 * empty/whitespace query returns []. Caller decides what to render in the
 * empty-query case (likely the alphabetical browse).
 */
export function searchGlossary(query: string): GlossarySearchResult[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const results: GlossarySearchResult[] = [];
  for (const entry of Object.values(registry)) {
    const canonicalIdx = entry.canonicalName.toLowerCase().indexOf(needle);
    if (canonicalIdx >= 0) {
      results.push({ entry, matchType: 'canonical', matchIndex: canonicalIdx });
      continue;
    }
    for (const alias of entry.aliases) {
      const aliasIdx = alias.toLowerCase().indexOf(needle);
      if (aliasIdx >= 0) {
        results.push({
          entry,
          matchType: 'alias',
          matchIndex: aliasIdx,
          matchedAlias: alias,
        });
        break;
      }
    }
  }
  return results;
}

/** React hook wrapper — memoizes by query string. */
export function useGlossarySearch(query: string): GlossarySearchResult[] {
  return useMemo(() => searchGlossary(query), [query]);
}

/**
 * Convert a glossary entry to the { title, content } prop-bag shape used by
 * the existing src/constants/infoContent/*.tsx files. Used by Unit 3b's
 * migration shims so wizard step imports keep working without code changes.
 *
 * Renders shortDef as a single paragraph — that's the popover surface, per
 * Design Principle 3 (short by default). longDef belongs on the Learn hub.
 */
export function glossaryToInfoButtonProps(
  slug: GlossarySlug,
): { title: string; content: ReactNode } {
  const entry = getGlossaryEntry(slug);
  return {
    title: entry.canonicalName,
    content: <p>{entry.shortDef}</p>,
  };
}

export type { GlossaryEntry, L1Anchor } from './types';
