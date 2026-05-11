/**
 * @fileoverview Unit tests for `searchRulebook` (the pure function behind
 * `useRulebookSearch`). Exercises query/filter combinations against the
 * committed cleaned rulebook.
 */

import { describe, expect, it } from 'vitest';

import { searchRulebook, ALL_GAMES } from '@/rules/useRulebookSearch';

describe('searchRulebook', () => {
  it('returns empty for an empty query', () => {
    expect(searchRulebook('', ALL_GAMES)).toEqual([]);
  });

  it('returns empty for whitespace-only query', () => {
    expect(searchRulebook('   ', ALL_GAMES)).toEqual([]);
  });

  it('returns empty when nothing matches', () => {
    expect(searchRulebook('xyzzy-nonsense-term', ALL_GAMES)).toEqual([]);
  });

  it('finds every rule mentioning a known term across all games', () => {
    const results = searchRulebook('jump', ALL_GAMES);
    expect(results.length).toBeGreaterThan(0);
    for (const hit of results) {
      const haystack =
        hit.matchType === 'heading'
          ? hit.rule.heading.toLowerCase()
          : hit.rule.body[hit.bodyParagraphIndex ?? 0].toLowerCase();
      expect(haystack).toContain('jump');
    }
  });

  it('narrows results when a single game filter is supplied', () => {
    const all = searchRulebook('ball', ALL_GAMES);
    const nineBall = searchRulebook('ball', '9-ball');
    expect(all.length).toBeGreaterThan(nineBall.length);
    for (const hit of nineBall) {
      expect(hit.rule.game).toBe('9-ball');
    }
  });

  it('is case-insensitive', () => {
    const lower = searchRulebook('stalemate', ALL_GAMES);
    const upper = searchRulebook('STALEMATE', ALL_GAMES);
    const mixed = searchRulebook('Stalemate', ALL_GAMES);
    expect(lower.length).toBeGreaterThan(0);
    expect(upper.length).toBe(lower.length);
    expect(mixed.length).toBe(lower.length);
  });

  it('treats regex-special characters as literal substrings', () => {
    // Known body text: "(see Figure 3-1)". Searching the literal "(see " must
    // find it and must not throw.
    expect(() => searchRulebook('(see ', ALL_GAMES)).not.toThrow();
    const results = searchRulebook('(see ', ALL_GAMES);
    expect(results.length).toBeGreaterThan(0);
  });

  it('reports matchType="heading" when the term is in the heading', () => {
    // "Stalemate" appears as a rule heading in 9-Ball (3-7) and elsewhere.
    const results = searchRulebook('Stalemate', '9-ball');
    const headingMatches = results.filter((r) => r.matchType === 'heading');
    expect(headingMatches.length).toBeGreaterThan(0);
  });

  it('reports matchType="body" with a paragraph index when match is in body', () => {
    const results = searchRulebook('jump', '9-ball');
    const bodyMatches = results.filter((r) => r.matchType === 'body');
    expect(bodyMatches.length).toBeGreaterThan(0);
    for (const hit of bodyMatches) {
      expect(hit.bodyParagraphIndex).toBeTypeOf('number');
      expect(hit.bodyParagraphIndex).toBeGreaterThanOrEqual(0);
    }
  });
});
