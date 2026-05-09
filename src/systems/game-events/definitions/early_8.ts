/**
 * @fileoverview Early 8 — loser pocketed the 8-ball before clearing their
 * own group. Loss-cause attributed to the loser.
 *
 * 8-ball only.
 *
 * Phase 1 enabledByDefault: false everywhere. Net-new event introduced by
 * Branch B; ships dormant until Phase 2 adds the LO toggle UI. Today's
 * modal does not render Early 8, and Phase 1 must preserve that exactly.
 */

import type { GameEventDefinition } from '../types';

export const early8: GameEventDefinition = {
  name: 'early_8',
  label: 'Early 8',
  gameTypes: ['eight_ball'],
  attributedTo: 'loser',
  enabledByDefault: {
    eight_ball: false,
    nine_ball: false,
    ten_ball: false,
  },
};
