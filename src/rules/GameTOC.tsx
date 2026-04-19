/**
 * @fileoverview Table of contents for a single game — an ordered vertical
 * list of `RuleCard`s. Rendered inside a Tabs `TabsContent` when the user
 * has picked one game, or inside an Accordion `AccordionContent` when the
 * "All games" view is active.
 */

import { RuleCard } from './RuleCard';
import type { Rule } from './rulebook.types';

type GameTOCProps = {
  rules: Rule[];
};

export function GameTOC({ rules }: GameTOCProps) {
  return (
    <nav aria-label="Rules in this game" className="space-y-2 py-3">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} />
      ))}
    </nav>
  );
}
