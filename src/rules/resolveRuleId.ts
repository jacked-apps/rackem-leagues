/**
 * @fileoverview Resolve a `(game, ruleId)` pair to its `Rule` object, or null.
 *
 * Used by the rule detail route and the R9c unknown-ID fallback. A `null`
 * return means the rule does not exist in the currently-committed rulebook;
 * the caller (`RuleDetailPage`) surfaces that to the user and redirects.
 *
 * Implementation is a direct lookup against the `idMap` emitted by
 * `scripts/clean-rulebook.ts` — O(1) per resolve. No async, no cache needed.
 */

import { rulebook } from './useRulebook';
import type { Rule } from './rulebook.types';

/**
 * Look up a rule by its game slug and rule ID.
 *
 * @param game    Game slug as used in URLs (e.g., "8-ball").
 * @param ruleId  Rule identifier within that game (e.g., "2-1").
 * @returns The matching `Rule` or `null` if unknown.
 */
export function resolveRuleId(game: string, ruleId: string): Rule | null {
  const key = `${game}:${ruleId}` as const;
  const ref = rulebook.index.idMap[key];
  if (!ref) return null;
  const rules = rulebook.rulesByGame[ref.game];
  if (!rules) return null;
  return rules.find((rule) => rule.id === ref.ruleId) ?? null;
}
