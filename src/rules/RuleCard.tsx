/**
 * @fileoverview One clickable row in a game's TOC. Shows the rule ID and
 * heading; navigates to the rule detail page on click. Sized to meet the
 * 44×44 px touch-target minimum from R6.
 */

import { Link } from 'react-router-dom';

import type { Rule } from './rulebook.types';

type RuleCardProps = {
  rule: Rule;
};

export function RuleCard({ rule }: RuleCardProps) {
  return (
    <Link
      to={`/rules/${rule.game}/${rule.id}`}
      className="flex min-h-11 items-center gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="font-mono text-sm text-muted-foreground shrink-0">{rule.id}</span>
      <span className="font-medium">{rule.heading}</span>
    </Link>
  );
}
