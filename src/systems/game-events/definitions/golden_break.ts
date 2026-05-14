/**
 * @fileoverview Golden Break — the breaker pockets the 8-ball on the break
 * shot. Whether it counts as a win is a separate league-level preference
 * (`golden_break_counts_as_win`) handled by the calculator, not this event.
 *
 * 8-ball only. Mutually exclusive with Break and Run.
 *
 * Phase 1 enabledByDefault: matches today's modal — true for 8-ball, false
 * for game types where the event doesn't apply.
 */

import type { GameEventDefinition } from '../types';

export const goldenBreak: GameEventDefinition = {
  name: 'golden_break',
  label: 'Golden Break',
  abbreviation: 'GB',
  gameTypes: ['eight_ball'],
  winnerRequired: 'breaker',
  attributedTo: 'winner',
  mutuallyExclusiveWith: ['break_and_run'],
  enabledByDefault: {
    eight_ball: true,
    nine_ball: false,
    ten_ball: false,
  },
};
