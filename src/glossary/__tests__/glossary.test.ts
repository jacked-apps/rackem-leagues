/**
 * @fileoverview Unit 1 tests — glossary schema invariants and search behavior.
 *
 * These tests run against the entire shipped registry, so they keep guarding
 * the invariants as Units 4 + 5 add more entries.
 *
 * @see docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md
 */

import { describe, expect, it } from 'vitest';

import {
  getAllGlossaryEntries,
  getGlossaryEntry,
  searchGlossary,
} from '../index';

describe('glossary schema', () => {
  it('every entry has all required fields, non-empty', () => {
    for (const entry of getAllGlossaryEntries()) {
      expect(entry.slug, `slug for ${entry.canonicalName}`).toBeTruthy();
      expect(entry.canonicalName, `canonicalName for ${entry.slug}`).toBeTruthy();
      expect(entry.shortDef, `shortDef for ${entry.slug}`).toBeTruthy();
      expect(entry.longDef, `longDef for ${entry.slug}`).toBeTruthy();
      expect(
        entry.l1_anchor.path,
        `l1_anchor.path for ${entry.slug}`,
      ).toBeTruthy();
    }
  });

  it('shortDef stays at most 2 sentences (Design Principle 3)', () => {
    for (const entry of getAllGlossaryEntries()) {
      const sentenceCount =
        (entry.shortDef.match(/[.!?](\s|$)/g) ?? []).length;
      expect(
        sentenceCount,
        `${entry.slug} shortDef has ${sentenceCount} sentences: "${entry.shortDef}"`,
      ).toBeLessThanOrEqual(2);
    }
  });
});

describe('slug uniqueness', () => {
  it('no duplicate slugs across entry files', () => {
    const seen = new Set<string>();
    for (const entry of getAllGlossaryEntries()) {
      expect(seen.has(entry.slug), `duplicate slug: ${entry.slug}`).toBe(false);
      seen.add(entry.slug);
    }
  });
});

describe('alias collisions', () => {
  it("no alias collides with another entry's canonical name", () => {
    const entries = getAllGlossaryEntries();
    const canonicalLower = new Set(
      entries.map((e) => e.canonicalName.toLowerCase()),
    );
    for (const entry of entries) {
      for (const alias of entry.aliases) {
        if (alias.toLowerCase() === entry.canonicalName.toLowerCase()) continue;
        expect(
          canonicalLower.has(alias.toLowerCase()),
          `alias "${alias}" on ${entry.slug} collides with another entry's canonicalName`,
        ).toBe(false);
      }
    }
  });

  it('no alias appears on more than one entry', () => {
    const seen = new Map<string, string>();
    for (const entry of getAllGlossaryEntries()) {
      for (const alias of entry.aliases) {
        const key = alias.toLowerCase();
        const prior = seen.get(key);
        expect(
          prior,
          `alias "${alias}" appears on both ${prior} and ${entry.slug}`,
        ).toBeUndefined();
        seen.set(key, entry.slug);
      }
    }
  });
});

describe('related-dial integrity', () => {
  it("every slug in any entry's `related` array exists in the registry", () => {
    const entries = getAllGlossaryEntries();
    const knownSlugs = new Set(entries.map((e) => e.slug));
    for (const entry of entries) {
      for (const relatedSlug of entry.related) {
        expect(
          knownSlugs.has(relatedSlug),
          `${entry.slug}.related references unknown slug "${relatedSlug}"`,
        ).toBe(true);
      }
    }
  });
});

describe('search', () => {
  it('returns a canonical match for the canonical name', () => {
    const results = searchGlossary('FargoRate');
    expect(results).toHaveLength(1);
    expect(results[0]?.matchType).toBe('canonical');
    expect(results[0]?.entry.slug).toBe('fargorate');
  });

  it('returns an alias match when the query is a known alias', () => {
    const results = searchGlossary('fargo rating');
    expect(results).toHaveLength(1);
    expect(results[0]?.matchType).toBe('alias');
    expect(results[0]?.entry.slug).toBe('fargorate');
    expect(results[0]?.matchedAlias).toBe('fargo rating');
  });

  it('is case-insensitive', () => {
    const results = searchGlossary('FARGORATE');
    expect(results).toHaveLength(1);
    expect(results[0]?.entry.slug).toBe('fargorate');
  });

  it('returns an empty array for empty or whitespace-only queries', () => {
    expect(searchGlossary('')).toEqual([]);
    expect(searchGlossary('   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchGlossary('totally-not-a-real-term')).toEqual([]);
  });
});

describe('getGlossaryEntry', () => {
  it('resolves a known slug to its entry', () => {
    const entry = getGlossaryEntry('fargorate');
    expect(entry.canonicalName).toBe('FargoRate');
  });
});
