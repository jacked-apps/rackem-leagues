/**
 * @fileoverview 8 in Wrong Pocket — loser pocketed the 8-ball in a pocket
 * other than the one they called. Loss-cause attributed to the loser.
 *
 * 8-ball only.
 *
 * Phase 1 enabledByDefault: false everywhere. Net-new event; ships dormant
 * until Phase 2 LO toggle UI ships.
 */

import type { GameEventDefinition } from '../types';

export const eightWrongPocket: GameEventDefinition = {
  name: 'eight_wrong_pocket',
  label: '8 in Wrong Pocket',
  gameTypes: ['eight_ball'],
  attributedTo: 'loser',
  enabledByDefault: {
    eight_ball: false,
    nine_ball: false,
    ten_ball: false,
  },
};
