/**
 * @fileoverview Runout — non-breaking winner clears their entire group plus
 * the 8-ball on a single visit to the table after the opponent's break.
 *
 * 8-ball only. Role-gated to non-breaker (the breaker running their own rack
 * is a Break and Run, not a Runout).
 *
 * Phase 1 enabledByDefault: matches today's modal.
 */

import type { GameEventDefinition } from '../types';

export const runout: GameEventDefinition = {
  name: 'runout',
  label: 'Runout',
  gameTypes: ['eight_ball'],
  winnerRequired: 'non-breaker',
  attributedTo: 'winner',
  enabledByDefault: {
    eight_ball: true,
    nine_ball: false,
    ten_ball: false,
  },
};
