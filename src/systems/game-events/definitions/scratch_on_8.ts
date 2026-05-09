/**
 * @fileoverview Scratch on 8 — loser pocketed the cue ball while shooting
 * the 8-ball. Loss-cause attributed to the loser.
 *
 * 8-ball only.
 *
 * Phase 1 enabledByDefault: false everywhere. Net-new event; ships dormant
 * until Phase 2 LO toggle UI ships.
 */

import type { GameEventDefinition } from '../types';

export const scratchOn8: GameEventDefinition = {
  name: 'scratch_on_8',
  label: 'Scratch on 8',
  gameTypes: ['eight_ball'],
  attributedTo: 'loser',
  enabledByDefault: {
    eight_ball: false,
    nine_ball: false,
    ten_ball: false,
  },
};
