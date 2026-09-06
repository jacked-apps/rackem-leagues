/**
 * @fileoverview The tournament's rules, in words a player understands (Unit C3).
 *
 * A player arriving at a tournament wants to know what they've walked into
 * before it starts: how many losses puts them out, what they're playing, and —
 * once handicapping ships — what their races are. Pure and total so the player
 * page can render whatever state the tournament is in without guarding every
 * field, and so the wording is testable on its own.
 */

import { gameTypeLabel } from '../gameTypes';

/** What the player page needs to describe a tournament. */
export interface RulesSource {
  format: string;
  grand_final_reset: boolean;
  game_type: string | null;
}

/** One line of the rules list: a label and its value. */
export interface RuleLine {
  label: string;
  value: string;
}

/**
 * Describe a tournament's rules as label/value lines.
 *
 * Only settled facts appear — an unset game type is omitted rather than shown
 * as "Unknown", because a blank line reads as a missing answer while no line at
 * all reads as "not part of this tournament".
 *
 * @example
 * tournamentRules({ format: 'double_elimination', grand_final_reset: true, game_type: 'eight_ball' })
 * // → [{label: 'Format', value: 'Double elimination'}, …]
 */
export function tournamentRules(bracket: RulesSource): RuleLine[] {
  const lines: RuleLine[] = [];
  const doubleElim = bracket.format === 'double_elimination';

  lines.push({
    label: 'Format',
    value: doubleElim ? 'Double elimination' : 'Single elimination',
  });

  // The bit a player actually cares about, said plainly.
  lines.push({
    label: 'Knocked out after',
    value: doubleElim ? 'Two losses' : 'One loss',
  });

  if (doubleElim && bracket.grand_final_reset) {
    lines.push({
      label: 'Final',
      value: 'Winners-side player must be beaten twice',
    });
  }

  if (bracket.game_type) {
    lines.push({
      label: 'Game',
      value: gameTypeLabel(bracket.game_type),
    });
  }

  return lines;
}
