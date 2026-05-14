/**
 * @fileoverview Win by Forfeit — opponent could not play, so the win is
 * recorded without an actual game played.
 *
 * suppressesRoleConditionalEvents: true — when this is checked, all
 * role-gated events (B&R, Runout, Golden Break) are hidden in the modal
 * because there was no real breaker.
 *
 * Phase 1 enabledByDefault: matches today's modal — true everywhere.
 */

import type { GameEventDefinition } from '../types';

export const winByForfeit: GameEventDefinition = {
  name: 'win_by_forfeit',
  label: 'Win by Forfeit',
  gameTypes: ['eight_ball', 'nine_ball', 'ten_ball'],
  attributedTo: 'winner',
  suppressesRoleConditionalEvents: true,
  enabledByDefault: {
    eight_ball: true,
    nine_ball: true,
    ten_ball: true,
  },
};
