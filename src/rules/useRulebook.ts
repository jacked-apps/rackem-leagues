/**
 * @fileoverview Load the cleaned rulebook data into a typed singleton.
 *
 * The cleaned modules under `src/officalBCARulebook/cleaned/` are static data
 * emitted by `scripts/clean-rulebook.ts`. This module imports them all once
 * at module load and exposes both the resolved `Rulebook` and a tiny React
 * hook wrapper. There is no asynchronous loading step — the data ships with
 * the bundle and is available as soon as the module evaluates.
 *
 * If the committed data ever becomes empty (corrupted build, rerun failure),
 * the module throws at import time. The error boundary around the rules
 * routes catches this and shows the user-facing "Couldn't load" fallback.
 */

import index from '@/officalBCARulebook/cleaned/index';
import general from '@/officalBCARulebook/cleaned/general';
import eightBall from '@/officalBCARulebook/cleaned/8-ball';
import nineBall from '@/officalBCARulebook/cleaned/9-ball';
import tenBall from '@/officalBCARulebook/cleaned/10-ball';
import onePocket from '@/officalBCARulebook/cleaned/one-pocket';
import fourteenOne from '@/officalBCARulebook/cleaned/14-1-continuous';
import bankPool from '@/officalBCARulebook/cleaned/bank-pool';
import wheelchair from '@/officalBCARulebook/cleaned/wheelchair';
import scotchDoubles from '@/officalBCARulebook/cleaned/scotch-doubles';

import type { Rule, Rulebook } from './rulebook.types';

function buildRulebook(): Rulebook {
  const rulesByGame: Record<string, Rule[]> = {
    general,
    '8-ball': eightBall,
    '9-ball': nineBall,
    '10-ball': tenBall,
    'one-pocket': onePocket,
    '14-1-continuous': fourteenOne,
    'bank-pool': bankPool,
    wheelchair,
    'scotch-doubles': scotchDoubles,
  };
  if (index.games.length === 0) {
    throw new Error('Rulebook index has no games. Cleaned data may be corrupted.');
  }
  return { index, rulesByGame };
}

/** Singleton. Evaluated once when this module is first imported. */
export const rulebook: Rulebook = buildRulebook();

/** React hook: returns the same singleton instance on every render. */
export function useRulebook(): Rulebook {
  return rulebook;
}
