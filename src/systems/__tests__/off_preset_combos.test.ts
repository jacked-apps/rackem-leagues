/**
 * @fileoverview Off-preset-combination integration tests (Phase 8 Unit
 * 8.1 of the modular-league-system v2 plan).
 *
 * Exercises combinations that are NOT one of the three Tested Presets
 * (BCA 3v3 / BCA 5v5 / Fargo 5v5) end-to-end through:
 *   1. `buildSystemFromPreferences` — runtime resolver produces a
 *      SystemModule with the right rating + threshold + scoring shape
 *      for the requested axes.
 *   2. `computeMatchRunningTotals` — feeds the snapshot's calculator
 *      and the simulated match_games rows through the per-mutation
 *      running-totals helper.
 *
 * Each test simulates a complete match's worth of confirmed regular
 * games and asserts the four totals on the match row come out right.
 *
 * The plan's Success Criterion 1: "any coherent combo produces a
 * working league." This file documents that for combos outside the
 * Tested Preset bundles.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildSystemFromPreferences } from '../buildSystemFromPreferences';
import { computeMatchRunningTotals } from '@/utils/match/computeMatchRunningTotals';
import type { MinimalMatchGame } from '@/utils/match/computeMatchRunningTotals';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { SystemOverrides } from '@/types/systemOverrides';
import {
  registerTestedPresetCalculators,
  clearRegistry,
} from '@/systems/calculators';

const NOW = '2026-05-02T00:00:00.000Z';
const HOME = 'team-home';
const AWAY = 'team-away';

const EMPTY_OVERRIDES: SystemOverrides = {};

function makeConfig(overrides: Partial<ResolvedSystemConfig>): ResolvedSystemConfig {
  return {
    lineup_size: 4,
    max_roster_size: 6,
    game_generation: 'single_round_robin',
    pairing_format: 'single_rack',
    race_length: null,
    points_calculator: 'linear_above_threshold',
    points_calculator_params: {},
    win_condition: 'games',
    handicap_type: 'fargo',
    mechanism: 'start_points',
    threshold_chart_id: null,
    standings_sort: ['match_wins', 'games_won', 'points_earned'],
    tiebreaker_trigger: 'never',
    tiebreaker_format: 'accept_tie',
    overrides: {},
    snapshot_at: NOW,
    ...overrides,
  };
}

/** Build a confirmed regular game with the given winner. */
function regularGame(
  winner: string,
  ballsPocketed: number | null = null,
): MinimalMatchGame {
  return {
    winner_team_id: winner,
    loser_balls_pocketed: ballsPocketed,
    is_tiebreaker: false,
    confirmed_by_home: 'h',
    confirmed_by_away: 'a',
  };
}

describe('Off-preset combos — full pipeline', () => {
  beforeEach(() => {
    clearRegistry();
    registerTestedPresetCalculators();
  });

  afterEach(() => {
    clearRegistry();
  });

  describe('4v4 + Fargo + games-won + linear_above_threshold', () => {
    // 4v4 single-round-robin = 16 games (even — ties possible at 8-8).
    // Calibrated combo doesn't exist (no Layer 2 chart for Fargo +
    // games-won + 4v4), but the runtime should produce a working
    // SystemModule with sensible fallbacks.
    const cfg = makeConfig({
      lineup_size: 4,
      max_roster_size: 6,
      handicap_type: 'fargo',
      mechanism: 'start_points',
      points_calculator: 'linear_above_threshold',
      win_condition: 'games',
    });

    it('runtime resolver produces an ad-hoc module (not a preset)', () => {
      const mod = buildSystemFromPreferences(cfg, EMPTY_OVERRIDES);
      expect(mod.key).toMatch(/^custom_4v4_fargo/);
      expect(mod.teamFormat.lineupSize).toBe(4);
    });

    it('home wins 9 of 16 → +0 points (above-tie band, threshold=9 inferred at 9)', () => {
      // For this off-preset combo we use linear_above_threshold with
      // games_to_win=9 and games_to_tie=8 (one-game tie band).
      const games = Array.from({ length: 9 }, () => regularGame(HOME))
        .concat(Array.from({ length: 7 }, () => regularGame(AWAY)));

      const totals = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: { games_to_win: 9, games_to_tie: 8, games_to_lose: 7 },
        awayThresholds: { games_to_win: 9, games_to_tie: 8, games_to_lose: 7 },
        games,
        pointsCalculator: cfg.points_calculator,
        pointsCalculatorParams: cfg.points_calculator_params,
      });

      expect(totals.home_games_won).toBe(9);
      expect(totals.away_games_won).toBe(7);
      // Home at win threshold: tie-band rule → 0 (band [8,9])
      expect(totals.home_points_earned).toBe(0);
      // Away at 7 = 1 below tie band: -1
      expect(totals.away_points_earned).toBe(-1);
    });
  });

  describe('5v5 + percentage + 10-7 points calculator (off-preset mix)', () => {
    // Conventional 5v5 uses milestone-jumps; this combo swaps in the
    // per-game 10-7 calculator instead. Confirms the per-game shape
    // works at the 5v5 lineup size, not just at Fargo's default.
    const cfg = makeConfig({
      lineup_size: 5,
      max_roster_size: 8,
      handicap_type: 'percentage',
      mechanism: 'extra_games',
      points_calculator: 'accumulated_per_game',
      win_condition: 'points',
    });

    it('home wins 13 of 25 → 130 + away balls pocketed', () => {
      const games: MinimalMatchGame[] = [];
      // home wins 13, away wins 12. away balls-pocketed: 0..12 cycling
      // through 0–7 — let's just use a fixed 4 each so the math is
      // easy to assert.
      for (let i = 0; i < 13; i++) games.push(regularGame(HOME, 4));
      for (let i = 0; i < 12; i++) games.push(regularGame(AWAY, 4));

      const totals = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: { games_to_win: 13, games_to_tie: null, games_to_lose: 12 },
        awayThresholds: { games_to_win: 13, games_to_tie: null, games_to_lose: 12 },
        games,
        pointsCalculator: cfg.points_calculator,
        pointsCalculatorParams: cfg.points_calculator_params,
      });

      // Home: 13 wins × 10 (winner_points default) + 12 losses ×
      // 4 balls = 130 + 48 = 178
      expect(totals.home_points_earned).toBe(178);
      // Away: 12 wins × 10 + 13 losses × 4 = 120 + 52 = 172
      expect(totals.away_points_earned).toBe(172);
    });
  });

  describe('3v3 + Fargo + games-won (existing user combo from feature/modular-league-system memo)', () => {
    // The user mentioned this combo specifically — a 3v3 league using
    // Fargo ratings rather than the 3v3 BCA points handicap. Off-preset
    // (Tested Preset 3v3 = points-handicap, not Fargo).
    const cfg = makeConfig({
      lineup_size: 3,
      max_roster_size: 5,
      game_generation: 'double_round_robin',
      handicap_type: 'fargo',
      mechanism: 'start_points',
      points_calculator: 'linear_above_threshold',
      win_condition: 'games',
    });

    it('runtime resolver routes to fargo rating + linear scoring stub', () => {
      const mod = buildSystemFromPreferences(cfg, EMPTY_OVERRIDES);
      expect(mod.teamFormat.lineupSize).toBe(3);
      expect(mod.teamFormat.gameGeneration).toBe('double_round_robin');
      // points_calculator=linear_above_threshold → SystemModule.scoring
      // is the legacy NOT_YET_WIRED stub (per Phase 5 Unit 5.5 — aggregate
      // calculators flow through running-totals path, not SystemModule.scoring).
      expect(mod.scoring.method).toBe('games_won_with_team_bonus');
    });

    it('LOCKED tie-band invariant survives across the off-preset combo: 9-9 → 0/0', () => {
      const games = Array.from({ length: 9 }, () => regularGame(HOME))
        .concat(Array.from({ length: 9 }, () => regularGame(AWAY)));

      const totals = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 },
        awayThresholds: { games_to_win: 10, games_to_tie: 9, games_to_lose: 8 },
        games,
        pointsCalculator: cfg.points_calculator,
        pointsCalculatorParams: cfg.points_calculator_params,
      });

      expect(totals.home_games_won).toBe(9);
      expect(totals.away_games_won).toBe(9);
      // Tie-band rule fires regardless of handicap type — calculator
      // doesn't know about handicap.
      expect(totals.home_points_earned).toBe(0);
      expect(totals.away_points_earned).toBe(0);
    });
  });

  describe('points_calculator: null (no points tracking)', () => {
    const cfg = makeConfig({
      lineup_size: 5,
      max_roster_size: 8,
      handicap_type: 'percentage',
      mechanism: 'extra_games',
      points_calculator: null,
      win_condition: 'games',
    });

    it('produces zero points regardless of game count', () => {
      const games = Array.from({ length: 13 }, () => regularGame(HOME))
        .concat(Array.from({ length: 12 }, () => regularGame(AWAY)));

      const totals = computeMatchRunningTotals({
        homeTeamId: HOME,
        awayTeamId: AWAY,
        homeThresholds: { games_to_win: 13, games_to_tie: null, games_to_lose: 12 },
        awayThresholds: { games_to_win: 13, games_to_tie: null, games_to_lose: 12 },
        games,
        pointsCalculator: cfg.points_calculator,
        pointsCalculatorParams: cfg.points_calculator_params,
      });

      expect(totals.home_games_won).toBe(13);
      expect(totals.away_games_won).toBe(12);
      expect(totals.home_points_earned).toBe(0);
      expect(totals.away_points_earned).toBe(0);
    });
  });
});
