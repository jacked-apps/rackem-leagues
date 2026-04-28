/**
 * @fileoverview Table of contents for a single game — an ordered vertical
 * list of `RuleCard`s. Rendered inside a Tabs `TabsContent` when the user
 * has picked one game, or inside an Accordion `AccordionContent` when the
 * "All games" view is active.
 *
 * When the House-rules filter is on and a scope has matching house rules,
 * each matching house rule is indented below its CSI counterpart, and any
 * standalones appear in a "League-specific additions" block above the CSI
 * list. The `differencesOnly` flag hides CSI rules that have no house-rule
 * siblings — standalones stay visible.
 */

import { RuleCard } from './RuleCard';
import { HouseRuleCard } from './HouseRuleCard';
import { groupHouseRules } from './groupHouseRules';
import type { Rule } from './rulebook.types';
import type { HouseRule } from './house-rules.types';

type GameTOCProps = {
  rules: Rule[];
  /** Visible house rules for the current scope. Defaults to empty. */
  houseRules?: HouseRule[];
  /** Game slug — required when houseRules is non-empty so matching works. */
  game?: string;
  /** When true, hide CSI rules with no matching house rules. */
  differencesOnly?: boolean;
};

export function GameTOC({ rules, houseRules = [], game, differencesOnly = false }: GameTOCProps) {
  const slug = game ?? rules[0]?.game ?? '';
  const { standalones, entries } = groupHouseRules(rules, houseRules, slug);
  const visibleEntries = differencesOnly
    ? entries.filter((e) => e.matching.length > 0)
    : entries;

  return (
    <nav aria-label="Rules in this game" className="space-y-2 py-3">
      {standalones.length > 0 ? (
        <section aria-label="League-specific additions" className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            League-specific additions
          </h3>
          {standalones.map((rule) => (
            <HouseRuleCard key={`std-${rule.id}`} rule={rule} />
          ))}
        </section>
      ) : null}

      {visibleEntries.map(({ csi, matching }) => (
        <div key={csi.id} className="space-y-2">
          <RuleCard rule={csi} />
          {matching.length > 0 ? (
            <div className="ml-4 space-y-2 border-l-2 border-primary/30 pl-3">
              {matching.map((hr) => (
                <HouseRuleCard key={hr.id} rule={hr} />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
