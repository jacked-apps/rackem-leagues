/**
 * @fileoverview Group matching house rules underneath the CSI rules they
 * override or enhance, for the reader's TOC/Accordion interleave view (R12).
 *
 * Standalones (no `related_rule_id`) are pulled into their own "league
 * additions" section at the top of the TOC. Matching rules are sorted
 * league-scoped first, then org-scoped (specificity order) so that a
 * league-specific override is listed above a parent-org rule that addresses
 * the same CSI section.
 */

import type { Rule } from './rulebook.types';
import type { HouseRule } from './house-rules.types';

export type TocEntry = {
  csi: Rule;
  matching: HouseRule[];
};

export type GroupedToc = {
  /** Game-scoped standalones rendered above the CSI list. */
  standalones: HouseRule[];
  /** CSI rules paired with any matching house rules. */
  entries: TocEntry[];
};

function specificityRank(rule: HouseRule): number {
  return rule.scope_type === 'league' ? 0 : 1;
}

/**
 * Build the TOC shape for one game's rules + the visible house rules.
 *
 * Matching is done on the `idMap` key shape `"{game}:{ruleId}"` that
 * Branch 1's `related_rule_id` stores. House rules for other games are
 * ignored here — AllGamesAccordion calls this once per game.
 */
export function groupHouseRules(
  csiRules: Rule[],
  houseRules: HouseRule[],
  game: string,
): GroupedToc {
  const gameRules = houseRules.filter((r) => r.game === game);
  const standalones = gameRules
    .filter((r) => r.related_rule_id === null || r.effect_type === 'standalone')
    .sort((a, b) => specificityRank(a) - specificityRank(b));

  const byCsi = new Map<string, HouseRule[]>();
  for (const r of gameRules) {
    if (r.related_rule_id === null || r.effect_type === 'standalone') continue;
    const bucket = byCsi.get(r.related_rule_id) ?? [];
    bucket.push(r);
    byCsi.set(r.related_rule_id, bucket);
  }
  for (const list of byCsi.values()) {
    list.sort((a, b) => specificityRank(a) - specificityRank(b));
  }

  const entries: TocEntry[] = csiRules.map((csi) => ({
    csi,
    matching: byCsi.get(`${game}:${csi.id}`) ?? [],
  }));

  return { standalones, entries };
}
