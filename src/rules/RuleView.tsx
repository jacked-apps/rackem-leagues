/**
 * @fileoverview Renders a single rule's heading and body paragraphs.
 *
 * Pure presentation. The parent (`RuleDetailPage`) owns resolution, routing,
 * and the toolbar (drawer trigger + Copy-link button). This component stays
 * small so it's easy to tweak styling without touching route logic.
 */

import type { Rule } from './rulebook.types';

type RuleViewProps = {
  rule: Rule;
  /** Human-readable game name (e.g., "8-Ball") used in the rule subtitle. */
  gameName: string;
};

export function RuleView({ rule, gameName }: RuleViewProps) {
  return (
    <article className="space-y-4">
      <header>
        <p className="text-sm text-muted-foreground">
          {gameName} · Rule {rule.id}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{rule.heading}</h1>
      </header>
      <div className="space-y-3 text-base leading-relaxed">
        {rule.body.length === 0 ? (
          <p className="text-muted-foreground italic">(No content in this rule.)</p>
        ) : (
          rule.body.map((paragraph, i) => <p key={i}>{paragraph}</p>)
        )}
      </div>
    </article>
  );
}
