/**
 * @fileoverview Pure substring search over a set of house rules.
 *
 * Mirrors Branch 1's `searchRulebook` interface so the reader can merge the
 * two result streams without special-casing. Case-insensitive, treats regex
 * special characters as literals, returns an empty array for empty /
 * whitespace-only queries.
 */

import type { HouseRule } from './house-rules.types';

export type HouseRuleSearchResult = {
  rule: HouseRule;
  matchType: 'title' | 'body';
  matchIndex: number;
  /** For body matches, which paragraph the match was found in. */
  bodyParagraphIndex?: number;
};

/**
 * @param query The raw query string as typed by the user.
 * @param rules The corpus to search.
 */
export function searchHouseRules(
  query: string,
  rules: HouseRule[],
): HouseRuleSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const results: HouseRuleSearchResult[] = [];
  for (const rule of rules) {
    const titleIdx = rule.title.toLowerCase().indexOf(needle);
    if (titleIdx >= 0) {
      results.push({ rule, matchType: 'title', matchIndex: titleIdx });
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
  return results;
}
