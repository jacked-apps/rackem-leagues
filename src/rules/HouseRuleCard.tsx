/**
 * @fileoverview One clickable house-rule row. Thin wrapper around RuleCard
 * that routes to `/rules/house/:scope/:scopeId/:ruleId` and labels the card
 * with the scope name (org or league).
 *
 * The underlying Rule shape uses the HouseRule's title as the "heading"
 * field — they align because Branch 1's RuleView renders `heading` + `body`
 * and HouseRule provides both.
 */

import { RuleCard } from './RuleCard';
import type { HouseRule } from './house-rules.types';

type HouseRuleCardProps = {
  rule: HouseRule;
};

export function HouseRuleCard({ rule }: HouseRuleCardProps) {
  const scopeType = rule.scope_type;
  const scopeId = scopeType === 'organization' ? rule.organization_id : rule.league_id;
  const to = `/rules/house/${scopeType}/${scopeId}/${rule.id}`;

  return (
    <RuleCard
      rule={{ id: rule.id, heading: rule.title, game: rule.game }}
      to={to}
      originLabel={`House · ${rule.scope_name}`}
    />
  );
}
