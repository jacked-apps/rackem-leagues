/**
 * @fileoverview One clickable row in a game's TOC. Shows the rule ID and
 * heading; navigates to the rule detail page on click. Sized to meet the
 * 44×44 px touch-target minimum from R6.
 *
 * Accepts an optional `to` prop so house-rule rows (which link to
 * `/rules/house/...`) can reuse this component without hardcoding the CSI
 * route shape. Accepts an optional `originLabel` for the small badge shown
 * to the right when house rules are displayed alongside CSI rules.
 */

import { Link } from 'react-router-dom';

import type { Rule } from './rulebook.types';

type RuleCardProps = {
  rule: Pick<Rule, 'id' | 'heading' | 'game'>;
  /** Override the link target. Defaults to the CSI rule route `/rules/:game/:ruleId`. */
  to?: string;
  /** Small badge shown on the right (e.g., "Ed's Leagues"). Omit for CSI rows. */
  originLabel?: string;
};

export function RuleCard({ rule, to, originLabel }: RuleCardProps) {
  const href = to ?? `/rules/${rule.game}/${rule.id}`;
  return (
    <Link
      to={href}
      className="flex min-h-11 items-center gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="font-mono text-sm text-muted-foreground shrink-0">{rule.id}</span>
      <span className="font-medium">{rule.heading}</span>
      {originLabel ? (
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {originLabel}
        </span>
      ) : null}
    </Link>
  );
}
