/**
 * @fileoverview Threshold module: Fargo points-mode threshold writes.
 *
 * Pure passthrough — the captains' start-points negotiation runs
 * upstream of match prep and lands its agreed values on
 * `matches.home_to_tie` / `away_to_tie`. The
 * `seedFargoNegotiatedStartPoints` seed module writes those into the
 * bag under `negotiated_home_start_points` and
 * `negotiated_away_start_points`. This module copies them onto the
 * final threshold-row keys.
 *
 * Writes:
 * - `home_to_win = null` (Fargo points-mode plays the full game count)
 * - `home_to_tie` = the negotiated home start credit
 * - `home_to_lose = null`
 * - `away_to_win`, `away_to_tie`, `away_to_lose` — same shape
 *
 * Never throws.
 */

import type { Module, StateBag } from '@/systems/chain-runtime/types';

export const thresholds: Module = {
  name: 'fargoPoints.thresholds',
  run: (bag: StateBag) => {
    const homeTie = bag.negotiated_home_start_points;
    const awayTie = bag.negotiated_away_start_points;
    bag.home_to_win = null;
    bag.home_to_tie = typeof homeTie === 'number' ? homeTie : null;
    bag.home_to_lose = null;
    bag.away_to_win = null;
    bag.away_to_tie = typeof awayTie === 'number' ? awayTie : null;
    bag.away_to_lose = null;
  },
};
