/**
 * @fileoverview In-memory keyword search over the cleaned rulebook.
 *
 * v1 uses plain case-insensitive substring matching — no fuzzy matching,
 * no tokenization, no stemming. The full rulebook is small (~135 rules,
 * <150 KB of cleaned text), so a linear scan is fast on every keystroke.
 * Regex-special characters in the query are safe because we use
 * `String.prototype.includes`, not a regex.
 *
 * Upgrade path when zero-results rates tell us we need more (per the plan):
 * swap `searchRulebook` for a Fuse.js or MiniSearch implementation behind
 * the same signature. The UI does not depend on implementation details.
 */

import { useMemo } from 'react';

import { rulebook } from './useRulebook';
import type { Rule } from './rulebook.types';

/** Filter value meaning "match across every game". */
export const ALL_GAMES: 'all' = 'all';

export type GameFilter = string | typeof ALL_GAMES;

export type SearchResult = {
  /** The matched rule. */
  rule: Rule;
  /** Whether the match is in the rule's heading or one of its body paragraphs. */
  matchType: 'heading' | 'body';
  /** Index of the first match within the heading or body paragraph (for snippet extraction). */
  matchIndex: number;
  /** For body matches, the index of the body paragraph that contained the match. */
  bodyParagraphIndex?: number;
};

/**
 * Pure search function — safe to call outside React. Unit-tested directly.
 *
 * @param query       The user's search query.
 * @param gameFilter  A game slug or `'all'`.
 * @returns Matching rules in game + source order; empty array for empty or
 *          whitespace-only queries (caller should render the TOC instead).
 */
export function searchRulebook(query: string, gameFilter: GameFilter): SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const targetSlugs =
    gameFilter === ALL_GAMES
      ? rulebook.index.games.map((g) => g.slug)
      : [gameFilter];

  const results: SearchResult[] = [];
  for (const slug of targetSlugs) {
    const rules = rulebook.rulesByGame[slug];
    if (!rules) continue;
    for (const rule of rules) {
      const headingIdx = rule.heading.toLowerCase().indexOf(needle);
      if (headingIdx >= 0) {
        results.push({ rule, matchType: 'heading', matchIndex: headingIdx });
        continue;
      }
      for (let i = 0; i < rule.body.length; i++) {
        const bodyIdx = rule.body[i].toLowerCase().indexOf(needle);
        if (bodyIdx >= 0) {
          results.push({
            rule,
            matchType: 'body',
            matchIndex: bodyIdx,
            bodyParagraphIndex: i,
          });
          break;
        }
      }
    }
  }
  return results;
}

/** React hook wrapper — memoizes results by (query, gameFilter). */
export function useRulebookSearch(query: string, gameFilter: GameFilter): SearchResult[] {
  return useMemo(() => searchRulebook(query, gameFilter), [query, gameFilter]);
}
