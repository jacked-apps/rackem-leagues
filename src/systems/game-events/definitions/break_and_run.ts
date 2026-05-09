/**
 * @fileoverview Break and Run — winner breaks, pockets a ball, and runs the
 * rest of the rack without the opponent getting a turn at the table.
 *
 * Mutually exclusive with Golden Break (a B&R can't also be an 8-on-the-break;
 * if the 8 dropped on the break it's a golden break, not a B&R).
 *
 * Phase 1 enabledByDefault: matches today's modal — true everywhere.
 */

import type { GameEventDefinition } from '../types';

export const breakAndRun: GameEventDefinition = {
  name: 'break_and_run',
  label: 'Break and Run',
  abbreviation: 'B&R',
  gameTypes: ['eight_ball', 'nine_ball', 'ten_ball'],
  winnerRequired: 'breaker',
  attributedTo: 'winner',
  mutuallyExclusiveWith: ['golden_break'],
  enabledByDefault: {
    eight_ball: true,
    nine_ball: true,
    ten_ball: true,
  },
};
