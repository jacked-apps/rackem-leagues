/**
 * @fileoverview The four seed modules every prep-time chain begins
 * with. Each system's chain spreads these and then adds its own
 * threshold modules.
 *
 * Per Ed: the state bag is shared infrastructure for the life of the
 * match. Seed everything we have access to even if today's threshold
 * modules don't read it — the scoreboard, confirm flow, and swap flow
 * will consume the bag too.
 *
 * Each system's chain may add/omit/replace seeds as needed (e.g.,
 * Fargo points-mode adds `seedFargoNegotiatedStartPoints`; future
 * systems may add their own seeds).
 */

import type { Module } from '@/systems/chain-runtime/types';
import { seedMatchIdentity } from '@/systems/modules/seed/seedMatchIdentity';
import { seedLineupHandicaps } from '@/systems/modules/seed/seedLineupHandicaps';
import { seedLineupPlayers } from '@/systems/modules/seed/seedLineupPlayers';
import { seedMatchFormat } from '@/systems/modules/seed/seedMatchFormat';

export const commonSeeds: readonly Module[] = [
  seedMatchIdentity,
  seedLineupHandicaps,
  seedLineupPlayers,
  seedMatchFormat,
];
