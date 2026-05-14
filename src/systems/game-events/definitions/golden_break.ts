/**
 * @fileoverview Golden Break — the breaker pockets the 8-ball on the break
 * shot. Whether it renders as a scorable event AND counts as a win is now
 * a single decision encoded in `enabled_events.golden_break` (cascade-
 * resolved over org → league → registry default). The legacy
 * leagues.golden_break_counts_as_win column was dropped 2026-05-12.
 *
 * 8-ball only. Mutually exclusive with Break and Run.
 *
 * enabledByDefault matches BCA Standard rules: 8-ball golden break does
 * NOT count as a win by default. LO opts in via the modal's edit mode if
 * their league has different house rules.
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
    eight_ball: false, // BCA Standard: 8-ball golden break does NOT count
    nine_ball: false,
    ten_ball: false,
  },
};
