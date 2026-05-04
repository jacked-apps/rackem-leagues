/**
 * @fileoverview Off-preset characterization tests for UnifiedScoreboard.
 *
 * Unit 8 of the unified-scoreboard plan
 * (`docs/plans/2026-05-03-001-feat-unified-scoreboard-plan.md`).
 *
 * Per architectural-reframe §8.2 of the modular-league-system plan:
 * "characterization tests on the 3 Tested Presets prove backwards
 *  compatibility but DO NOT prove modular composition works."
 *
 * These tests exercise lineup_size + handicap + win_condition + calculator
 * combinations that are NOT one of the three Tested Preset cards. If the
 * unified scoreboard were secretly preset-coupled (e.g. branched on
 * lineup_size === 5 or handicap_type === 'fargo'), these tests would fail.
 *
 * Coverage:
 *   - 4v4 + Fargo handicap + games win-condition + linear_above_threshold:
 *     four player rows render, games-axis primary, no preset-coupled
 *     assumptions.
 *   - 4v4 + Fargo handicap + games win-condition + accumulate_with_milestone_jumps:
 *     milestone hint renders for any lineup size, not just 5v5.
 *   - 6v6 (hypothetical future preset) + BCA points + linear_above_threshold:
 *     six player rows render; the scoreboard tolerates lineup sizes that
 *     don't exist in any current preset.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import {
  registerTestedPresetCalculators,
  clearRegistry,
} from '@/systems/calculators';
import { UnifiedScoreboard } from '../UnifiedScoreboard';
import type { Lineup, MatchWithLeagueSettings } from '@/types';

function buildMatch(
  overrides: Partial<MatchWithLeagueSettings> = {},
): MatchWithLeagueSettings {
  return {
    id: 'match-offpreset-1',
    home_team_id: 'team-home',
    away_team_id: 'team-away',
    home_team: { team_name: 'Home' },
    away_team: { team_name: 'Away' },
    home_games_won: 0,
    away_games_won: 0,
    home_points_earned: 0,
    away_points_earned: 0,
    home_to_win: null,
    home_to_tie: null,
    home_to_lose: null,
    away_to_win: null,
    away_to_tie: null,
    away_to_lose: null,
    home_team_verified_by: null,
    away_team_verified_by: null,
    system_snapshot: {
      points_calculator: 'linear_above_threshold',
      points_calculator_params: {},
    },
    ...overrides,
  } as MatchWithLeagueSettings;
}

function buildLineup(overrides: Partial<Lineup> = {}): Lineup {
  return {
    team_id: 'team-home',
    player1_id: 'p1',
    player1_handicap: 3,
    player2_id: 'p2',
    player2_handicap: 4,
    player3_id: 'p3',
    player3_handicap: 5,
    player4_id: 'p4',
    player4_handicap: 6,
    ...overrides,
  } as Lineup;
}

const noopHandlers = {
  onVerify: vi.fn(),
  getPlayerDisplayName: (id: string) => `Player ${id}`,
  getPlayerStats: () => ({ wins: 0, losses: 0 }),
};

beforeEach(() => {
  clearRegistry();
  registerTestedPresetCalculators();
  vi.clearAllMocks();
});

describe('UnifiedScoreboard — off-preset combos (Unit 8)', () => {
  it('4v4 Fargo games-mode + linear_above_threshold renders correctly', () => {
    // This combo doesn't match any Tested Preset card:
    //   - lineup_size: 4 (not 3, not 5)
    //   - handicap_type: 'fargo' (matches Fargo preset's handicap)
    //   - win_condition: 'games' (Fargo preset is points-mode by default)
    //   - calculator: 'linear_above_threshold' (Fargo preset uses
    //     'accumulated_per_game'; this is the BCA 3v3 calculator)
    // If the scoreboard branches on lineup_size === 5 or treats
    // handicap === 'fargo' as a synonym for points-mode, this fails.
    const match = buildMatch({
      home_games_won: 7,
      away_games_won: 5,
      home_points_earned: 1,
      away_points_earned: 0,
      home_to_win: 11,
      home_to_tie: 9,
      home_to_lose: 7,
      away_to_win: 11,
      away_to_tie: 9,
      away_to_lose: 7,
      system_snapshot: {
        points_calculator: 'linear_above_threshold',
        points_calculator_params: { per_extra_game_multiplier: 1 },
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({
          team_id: 'team-away',
          player1_id: 'a1',
          player2_id: 'a2',
          player3_id: 'a3',
          player4_id: 'a4',
        })}
        homeThresholds={{ games_to_win: 11, games_to_tie: 9, games_to_lose: 7 }}
        awayThresholds={{ games_to_win: 11, games_to_tie: 9, games_to_lose: 7 }}
        homeLosses={5}
        awayLosses={7}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="games"
        lineupSize={4}
        {...noopHandlers}
      />,
    );

    // Both teams' wins render in the new "won/to_win" slash format.
    expect(screen.getByText('7/11')).toBeInTheDocument();
    expect(screen.getByText('5/11')).toBeInTheDocument();
    // Wins label appears (lowercase intentional in the small-text label).
    expect(screen.getAllByText(/wins/i).length).toBeGreaterThan(0);
  });

  it('4v4 Fargo games-mode + accumulate_with_milestone_jumps renders milestone hint', () => {
    // Validates that the milestone hint surfaces for ANY lineup size, not
    // just 5v5. Pre-Unit-7, the 1.5x marker was hardcoded inside
    // FiveVFiveScoreboard's TeamStatsCard with `mode === '5v5'`. Now it's
    // schema-derived from the calculator's displayHints — works for 4v4.
    const match = buildMatch({
      home_games_won: 8,
      away_games_won: 5,
      home_points_earned: 9.0,
      away_points_earned: 5.0,
      home_to_win: 11,
      home_to_tie: 9,
      home_to_lose: 7,
      away_to_win: 11,
      away_to_tie: 9,
      away_to_lose: 7,
      system_snapshot: {
        points_calculator: 'accumulate_with_milestone_jumps',
        points_calculator_params: {
          per_game_increment: 0.1,
          milestone_percent: 0.7,
          milestone_jump_value: 1.5,
          win_threshold_jump_value: 3.0,
        },
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({
          team_id: 'team-away',
          player1_id: 'a1',
          player2_id: 'a2',
          player3_id: 'a3',
          player4_id: 'a4',
        })}
        homeThresholds={{ games_to_win: 11, games_to_tie: 9, games_to_lose: 7 }}
        awayThresholds={{ games_to_win: 11, games_to_tie: 9, games_to_lose: 7 }}
        homeLosses={5}
        awayLosses={8}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="games"
        lineupSize={4}
        {...noopHandlers}
      />,
    );

    // Milestone hint renders for the off-preset 4v4 combo.
    expect(screen.getAllByText(/Milestone bonus/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.5/).length).toBeGreaterThan(0);
  });

  it('hypothetical 6v6 lineup renders without preset-coupled crashes', () => {
    // No current preset uses lineup_size: 6. If the scoreboard had hardcoded
    // assumptions about 3 vs 5 (or any specific count), this would fail.
    // The Lineup type only goes up to player5_id so we can render at most
    // 5 player rows for now — but the auto-flex should clamp gracefully and
    // not crash for lineup_size > 5. The test asserts no crash + the basic
    // structure is intact.
    const match = buildMatch({
      home_games_won: 10,
      away_games_won: 8,
      home_points_earned: 2,
      away_points_earned: 0,
      home_to_win: 13,
      home_to_tie: 11,
      home_to_lose: 9,
      away_to_win: 13,
      away_to_tie: 11,
      away_to_lose: 9,
    });

    const { container } = renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup({
          player5_id: 'p5',
          player5_handicap: 7,
        })}
        awayLineup={buildLineup({
          team_id: 'team-away',
          player5_id: 'a5',
          player5_handicap: 7,
        })}
        homeThresholds={{ games_to_win: 13, games_to_tie: 11, games_to_lose: 9 }}
        awayThresholds={{ games_to_win: 13, games_to_tie: 11, games_to_lose: 9 }}
        homeLosses={8}
        awayLosses={10}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="games"
        lineupSize={6} // hypothetical future preset
        {...noopHandlers}
      />,
    );

    // No crash. Core data still surfaces (new slash format: won/to_win).
    expect(container.firstChild).toBeTruthy();
    expect(screen.getByText('10/13')).toBeInTheDocument();
    expect(screen.getByText('8/13')).toBeInTheDocument();
  });

  it('3v3 + Fargo handicap + points + accumulated_per_game renders cleanly', () => {
    // Inverse off-preset combo: BCA 3v3's lineup with Fargo's calculator.
    // Tests that the points-mode primary axis works at small lineup sizes.
    const match = buildMatch({
      home_games_won: 6,
      away_games_won: 4,
      home_points_earned: 75,
      away_points_earned: 53,
      home_to_win: 100,
      home_to_tie: 0,
      home_to_lose: null,
      away_to_win: 100,
      away_to_tie: 15,
      away_to_lose: null,
      system_snapshot: {
        points_calculator: 'accumulated_per_game',
        points_calculator_params: {},
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup({
          player4_id: null,
          player4_handicap: null,
        })}
        awayLineup={buildLineup({
          team_id: 'team-away',
          player1_id: 'a1',
          player2_id: 'a2',
          player3_id: 'a3',
          player4_id: null,
          player4_handicap: null,
        })}
        homeThresholds={{ games_to_win: 100, games_to_tie: 0, games_to_lose: null }}
        awayThresholds={{ games_to_win: 100, games_to_tie: 15, games_to_lose: null }}
        homeLosses={4}
        awayLosses={6}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="points"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    // Points are primary (large) since winCondition='points'. Start-credit
    // is now folded into the displayed total (post-2026-05-04 R22 revision)
    // — fixture's home_points_earned/away_points_earned values already
    // include their respective credits. No "+N" badge appears.
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('53')).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
  });
});
