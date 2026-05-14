/**
 * @fileoverview Break Fouled — the player scheduled to break committed a
 * foul on the break shot, flipping the actual breaker to the other player.
 *
 * Attributed to `scheduled-breaker` (NOT `breaker`): the foul is the
 * offender's stat, and the offender is the player scheduled to break before
 * the role-flip — not the post-flip actual breaker.
 *
 * Dual-write: this event is also reflected in `match_games.break_fouled`
 * column for synchronous state-modifier reads on every modal render. The
 * column drives B&R / Runout role-gating; the event row drives stat queries.
 * Both written atomically by the score_game_with_events rpc.
 *
 * Phase 1 enabledByDefault: matches today's modal — true everywhere.
 */

import type { GameEventDefinition } from '../types';

export const breakFouled: GameEventDefinition = {
  name: 'break_fouled',
  label: 'Break Foul',
  gameTypes: ['eight_ball', 'nine_ball', 'ten_ball'],
  attributedTo: 'scheduled-breaker',
  enabledByDefault: {
    eight_ball: true,
    nine_ball: true,
    ten_ball: true,
  },
};
