/**
 * @fileoverview The tournament's rules as one compact line (Unit C3).
 *
 * Sits directly under the tournament name, because "what am I walking into" is
 * the second thing a player wants after knowing they're in the right place —
 * and on a phone it has to cost a line, not a card. Each rule is a small chip
 * rather than a label/value row so the whole thing wraps to two lines at most.
 */

import type { RulesSource } from './tournamentRules';
import { tournamentRules } from './tournamentRules';

export function TournamentRulesBar({ bracket }: { bracket: RulesSource }) {
  const rules = tournamentRules(bracket);
  if (rules.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1.5">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className="rounded-full bg-muted px-2 py-0.5 text-xs"
          // The label is the chip's meaning, not its text — "Two losses" reads
          // on its own, "Knocked out after: Two losses" does not fit a phone.
          title={rule.label}
        >
          {rule.value}
        </li>
      ))}
    </ul>
  );
}
