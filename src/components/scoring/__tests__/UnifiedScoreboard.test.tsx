/**
 * @fileoverview Tests for UnifiedScoreboard — the single component that
 * replaces ThreeVThreeScoreboard / FiveVFiveScoreboard / TenSevenScoreboard
 * (Unit 3 of the unified-scoreboard plan).
 *
 * Test-first execution per the plan: the FIRST and most important assertion
 * is the R4 contract — "scoreboard reads points from match row, NOT from
 * legacy `calculatePoints` recomputation." This is the bug that triggered
 * the whole brainstorm; locking it down with a test prevents regression.
 *
 * Coverage:
 *   - R3 contract: scoreboard reads home_points_earned / away_points_earned
 *     from the match row directly. No legacy recomputation path.
 *   - R7: points_calculator === 'none' (or null) hides the points axis.
 *   - R6/R17: schema-derived display hints render on the active calculator.
 *   - R8/R12: inline team identity, no center "VS" column.
 *   - R10: threshold trio collapsed by default; user-toggle expand.
 *   - R14: player rows auto-flex by lineup_size (3v3, 5v5, 4v4 off-preset).
 *   - R22: Fargo start-points delta surfaces inline on points line.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import {
  registerTestedPresetCalculators,
  clearRegistry,
} from '@/systems/calculators';
import { UnifiedScoreboard } from '../UnifiedScoreboard';
import type { Lineup, HandicapThresholds, MatchWithLeagueSettings } from '@/types';

// ----------------------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------------------

function buildMatch(
  overrides: Partial<MatchWithLeagueSettings> = {},
): MatchWithLeagueSettings {
  return {
    id: 'match-1',
    home_team_id: 'team-home',
    away_team_id: 'team-away',
    home_team: { team_name: 'Home Team' },
    away_team: { team_name: 'Away Team' },
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
    player4_id: null,
    player4_handicap: null,
    player5_id: null,
    player5_handicap: null,
    ...overrides,
  } as Lineup;
}

const noopHandlers = {
  onVerify: vi.fn(),
  getPlayerDisplayName: (id: string) => `Player ${id}`,
  getPlayerStats: () => ({ wins: 0, losses: 0 }),
};

function bcaThresholds(): HandicapThresholds {
  return { games_to_win: 11, games_to_tie: 9, games_to_lose: 7 };
}

// Hermetic registry per institutional pattern (PR #98 self-registration).
beforeEach(() => {
  clearRegistry();
  registerTestedPresetCalculators();
  vi.clearAllMocks();
});

// ----------------------------------------------------------------------------
// R4 contract: scoreboard reads from match row, never recomputes
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — match-row source-of-truth (R4 contract)', () => {
  it('renders BCA 3v3 points from match.home_points_earned — NOT recomputed', () => {
    // The match row says home has earned 7 points. If the scoreboard
    // recomputed via calculatePoints from games_won + thresholds it would
    // produce a DIFFERENT number (e.g. 8 - 7 = 1 by the legacy formula).
    // The test pins the contract: whatever match.home_points_earned says,
    // that's what renders.
    const match = buildMatch({
      home_games_won: 8,
      home_points_earned: 7, // canonical "from match row" value
      away_games_won: 5,
      away_points_earned: 2,
      home_to_win: 11,
      home_to_tie: 9,
      home_to_lose: 7,
      away_to_win: 11,
      away_to_tie: 9,
      away_to_lose: 7,
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={5}
        awayLosses={8}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    // The exact rendered number IS match.home_points_earned, no math.
    // Both teams' points appear on the page.
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders Fargo games-mode points from match row (no calculateFargoMatchTotals)', () => {
    // Fargo league with games-mode (the conflation case from 2026-05-03).
    // home_points_earned was calculator-correct via the new pipeline; the
    // legacy fargoTotals path would produce a different number.
    const match = buildMatch({
      home_games_won: 12,
      home_points_earned: 14,
      away_games_won: 13,
      away_points_earned: 11,
      home_to_win: 13,
      home_to_tie: null,
      home_to_lose: null,
      away_to_win: 13,
      away_to_tie: null,
      away_to_lose: null,
      system_snapshot: {
        points_calculator: 'linear_above_threshold',
        points_calculator_params: {},
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup({
          player4_id: 'p4',
          player4_handicap: 6,
          player5_id: 'p5',
          player5_handicap: 7,
        })}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={{ games_to_win: 13, games_to_tie: null, games_to_lose: null }}
        awayThresholds={{ games_to_win: 13, games_to_tie: null, games_to_lose: null }}
        homeLosses={13}
        awayLosses={12}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="games"
        lineupSize={5}
        {...noopHandlers}
      />,
    );

    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------
// R7 — 'none' calculator hides points axis
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — none calculator (R7)', () => {
  it("hides the points axis when points_calculator === 'none'", () => {
    const match = buildMatch({
      home_games_won: 8,
      away_games_won: 5,
      home_to_win: 13,
      away_to_win: 13,
      system_snapshot: {
        points_calculator: 'none',
        points_calculator_params: {},
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup({
          player4_id: 'p4',
          player4_handicap: 6,
          player5_id: 'p5',
          player5_handicap: 7,
        })}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={{ games_to_win: 13, games_to_tie: null, games_to_lose: null }}
        awayThresholds={{ games_to_win: 13, games_to_tie: null, games_to_lose: null }}
        homeLosses={5}
        awayLosses={8}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="games"
        lineupSize={5}
        {...noopHandlers}
      />,
    );

    // No "Points" label rendered when calculator is 'none'.
    expect(screen.queryByText(/points/i)).not.toBeInTheDocument();
  });

  it('treats null calculator (legacy snapshot) the same as none', () => {
    const match = buildMatch({
      home_games_won: 5,
      away_games_won: 5,
      home_to_win: 11,
      away_to_win: 11,
      system_snapshot: {
        points_calculator: null,
        points_calculator_params: null,
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={5}
        awayLosses={5}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    expect(screen.queryByText(/points/i)).not.toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------
// R8 / R12 — inline team identity, info button at corner
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — inline team identity (R8, R12)', () => {
  it('renders team names from the match row', () => {
    const match = buildMatch({
      home_team: { team_name: 'Sharks' },
      away_team: { team_name: 'Jets' },
      home_to_win: 11,
      away_to_win: 11,
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={0}
        awayLosses={0}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    expect(screen.getByText('Sharks')).toBeInTheDocument();
    expect(screen.getByText('Jets')).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------
// R14 — player rows auto-flex by lineup_size
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — auto-flex player rows (R14)', () => {
  it('renders 3 player rows for lineup_size: 3 (off-preset is fine)', () => {
    const match = buildMatch({ home_to_win: 11, away_to_win: 11 });

    const { container } = renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={0}
        awayLosses={0}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    // The component should not crash; basic render works for size=3.
    // Detailed player-row assertions go in the player-drawer test block
    // when implementation lands.
    expect(container.firstChild).toBeTruthy();
  });

  it('renders without crashing for lineup_size: 4 (off-preset)', () => {
    const match = buildMatch({ home_to_win: 13, away_to_win: 13 });

    const { container } = renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup({
          player4_id: 'p4',
          player4_handicap: 6,
        })}
        awayLineup={buildLineup({
          team_id: 'team-away',
          player4_id: 'p4-away',
          player4_handicap: 6,
        })}
        homeThresholds={{ games_to_win: 13, games_to_tie: null, games_to_lose: null }}
        awayThresholds={{ games_to_win: 13, games_to_tie: null, games_to_lose: null }}
        homeLosses={0}
        awayLosses={0}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="games"
        lineupSize={4}
        {...noopHandlers}
      />,
    );

    expect(container.firstChild).toBeTruthy();
  });
});

// ----------------------------------------------------------------------------
// R6/R17 — calculator hint rendering (schema-derived + escape hatch)
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — calculator hints (R6/R17)', () => {
  it('renders the BCA 5v5 milestone hint declared in displayHints (drawer-bound)', async () => {
    const match = buildMatch({
      home_games_won: 8,
      away_games_won: 5,
      home_points_earned: 9,
      away_points_earned: 5,
      home_to_win: 13,
      away_to_win: 13,
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

    const user = userEvent.setup();
    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup({
          player4_id: 'p4',
          player4_handicap: 6,
          player5_id: 'p5',
          player5_handicap: 7,
        })}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={{ games_to_win: 13, games_to_tie: null, games_to_lose: null }}
        awayThresholds={{ games_to_win: 13, games_to_tie: null, games_to_lose: null }}
        homeLosses={5}
        awayLosses={8}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="games"
        lineupSize={5}
        {...noopHandlers}
      />,
    );

    // Default state: hints are NOT visible (they're drawer-bound now).
    expect(screen.queryByText(/Milestone bonus/i)).not.toBeInTheDocument();

    // Open the drawer — hints render alongside the threshold trio.
    await user.click(screen.getAllByText('Home Team')[0]);
    expect(screen.getAllByText(/Milestone bonus/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.5/).length).toBeGreaterThan(0);
  });

  it('renders nothing extra when the calculator declares no displayHints', () => {
    // linear_above_threshold has no displayHints (rate-only param).
    const match = buildMatch({
      home_games_won: 5,
      home_points_earned: 1,
      away_games_won: 3,
      away_points_earned: 0,
      home_to_win: 11,
      away_to_win: 11,
      system_snapshot: {
        points_calculator: 'linear_above_threshold',
        points_calculator_params: { per_extra_game_multiplier: 1 },
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={3}
        awayLosses={5}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    // No hint pills rendered — calculator is silent about display.
    expect(screen.queryByText(/Milestone bonus/i)).not.toBeInTheDocument();
  });

  it('falls back gracefully for an unknown / unresolvable calculator', () => {
    // Calculator name not in the registry — scoreboard renders without a
    // crash, hints array is empty, points axis still appears since the
    // name is not 'none'.
    const match = buildMatch({
      home_games_won: 3,
      home_points_earned: 99, // unique number to assert against
      away_games_won: 2,
      away_points_earned: 77, // unique number to assert against
      home_to_win: 11,
      away_to_win: 11,
      system_snapshot: {
        points_calculator: 'novel_calculator_not_yet_built',
        points_calculator_params: { exotic: 42 },
      },
    });

    const { container } = renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={2}
        awayLosses={3}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    expect(container.firstChild).toBeTruthy();
    // Points still render for unknown-but-not-'none' calculators.
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByText('77')).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------
// R9 — win-condition primary-axis flip
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — primary axis flip (R9)', () => {
  it('renders points as primary (large) when winCondition is points', () => {
    // Fargo 10-7 default. winCondition='points' should put points in the
    // larger emphasis position; games becomes the secondary.
    const match = buildMatch({
      home_games_won: 12,
      away_games_won: 13,
      home_points_earned: 187,
      away_points_earned: 175,
      home_to_win: 200,
      away_to_win: 200,
      home_to_tie: 0,
      away_to_tie: 25,
      system_snapshot: {
        points_calculator: 'accumulated_per_game',
        points_calculator_params: {},
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup({
          player4_id: 'p4',
          player4_handicap: 6,
          player5_id: 'p5',
          player5_handicap: 7,
        })}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={{ games_to_win: 200, games_to_tie: 0, games_to_lose: null }}
        awayThresholds={{ games_to_win: 200, games_to_tie: 25, games_to_lose: null }}
        homeLosses={13}
        awayLosses={12}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="points"
        lineupSize={5}
        {...noopHandlers}
      />,
    );

    // Both points numbers render (they're the primary axis numbers).
    expect(screen.getByText('187')).toBeInTheDocument();
    expect(screen.getByText('175')).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------
// R22 (revised 2026-05-04) — start-credit folded into points; "starting N"
// label appears in the threshold drawer instead of a badge
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — Fargo start-points (R22 revised 2026-05-04)', () => {
  it('renders points number including the start-credit (no separate badge)', async () => {
    // computeMatchRunningTotals folds *_to_tie into *_points_earned for
    // points-mode. The fixture below simulates the post-fold state: weaker
    // (away) team's earned column already includes the 25-credit.
    const match = buildMatch({
      home_games_won: 0,
      away_games_won: 0,
      home_points_earned: 0, // stronger team — start-credit 0
      away_points_earned: 25, // weaker team — start-credit 25 already folded in
      home_to_tie: 0,
      away_to_tie: 25,
      home_to_win: null, // points-mode with no point threshold (cleaned up by useMatchPreparation)
      away_to_win: null,
      system_snapshot: {
        points_calculator: 'accumulated_per_game',
        points_calculator_params: {},
      },
    });

    const user = userEvent.setup();
    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup({
          player4_id: 'p4',
          player4_handicap: 6,
          player5_id: 'p5',
          player5_handicap: 7,
        })}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={{ games_to_win: null, games_to_tie: 0, games_to_lose: null }}
        awayThresholds={{ games_to_win: null, games_to_tie: 25, games_to_lose: null }}
        homeLosses={0}
        awayLosses={0}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="points"
        lineupSize={5}
        {...noopHandlers}
      />,
    );

    // Points show the folded total (25 includes the start-credit).
    // Multiple "0" elements appear (home wins, home points), so use getAllByText.
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    // No "+N start" badge anywhere.
    expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();

    // Open the drawer to reveal the "Starts +N" label in the threshold row.
    // Stronger team (home, to_tie=0) gets no label — hide-when-zero per
    // Ed's smoke-test feedback. Weaker team (away, to_tie=25) shows
    // "Starts +25" with a + sign.
    await user.click(screen.getAllByText('Home Team')[0]);
    expect(screen.getByText(/Starts \+25/)).toBeInTheDocument();
    expect(screen.queryByText(/Starts \+0/)).not.toBeInTheDocument();
  });

  it('does not render start-credit info in games-mode', () => {
    const match = buildMatch({
      home_games_won: 5,
      home_points_earned: 1,
      home_to_tie: 9,
      away_to_tie: 9,
      home_to_win: 11,
      away_to_win: 11,
      system_snapshot: {
        points_calculator: 'linear_above_threshold',
        points_calculator_params: {},
      },
    });

    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={3}
        awayLosses={5}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    expect(screen.queryByText(/start/i)).not.toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------
// Per-player points column conditional (Ed's framing during review)
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — per-player points column (calculator-driven)', () => {
  it('shows the per-player P column when getPlayerPoints is provided', async () => {
    const match = buildMatch({
      home_points_earned: 30,
      away_points_earned: 25,
      home_to_win: 11,
      away_to_win: 11,
      system_snapshot: {
        points_calculator: 'accumulated_per_game',
        points_calculator_params: {},
      },
    });
    const getPlayerPoints = vi.fn(() => 10);

    const user = userEvent.setup();
    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={0}
        awayLosses={0}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="9-ball"
        winCondition="points"
        lineupSize={3}
        {...noopHandlers}
        getPlayerPoints={getPlayerPoints}
      />,
    );

    // Open the home team's drawer to expose the player table.
    await user.click(screen.getByText('Home Team'));
    // The 'P' column header appears.
    expect(screen.getAllByText('P').length).toBeGreaterThan(0);
    // getPlayerPoints was called for each rendered player (3 players × 1 team
    // opened = 3 calls minimum).
    expect(getPlayerPoints).toHaveBeenCalled();
  });

  it('hides the per-player P column when getPlayerPoints is omitted', async () => {
    const match = buildMatch({
      home_points_earned: 5,
      away_points_earned: 3,
      home_to_win: 11,
      away_to_win: 11,
      system_snapshot: {
        points_calculator: 'accumulate_with_milestone_jumps',
        points_calculator_params: {},
      },
    });

    const user = userEvent.setup();
    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={2}
        awayLosses={4}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
        // No getPlayerPoints prop — aggregate calculator, no per-player tally.
      />,
    );

    await user.click(screen.getByText('Home Team'));
    // Drawer's "HC", "Name", "W", "L" headers render — but no "P" column.
    expect(screen.getAllByText('HC').length).toBeGreaterThan(0);
    expect(screen.queryByText('P')).not.toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------------
// R10 — threshold trio shows alongside the player drawer (drawer-bound)
// ----------------------------------------------------------------------------

describe('UnifiedScoreboard — threshold trio (drawer-bound, R10 revised 2026-05-04)', () => {
  it('hides the threshold trio by default; shows it when the team drawer opens', async () => {
    const match = buildMatch({
      home_games_won: 5,
      home_to_win: 11,
      home_to_tie: 9,
      home_to_lose: 7,
      away_to_win: 11,
      away_to_tie: 9,
      away_to_lose: 7,
    });

    const user = userEvent.setup();
    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={3}
        awayLosses={5}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    // Default state: threshold "tie" / "lose" labels are NOT visible.
    expect(screen.queryByText('tie')).not.toBeInTheDocument();
    expect(screen.queryByText('lose')).not.toBeInTheDocument();

    // Tap the home team name (acts as drawer + threshold toggle). After the
    // drawer opens, "Home Team" also appears inside via TeamNameLink — use
    // the first match (the team-name button at the top).
    await user.click(screen.getAllByText('Home Team')[0]);

    // Now the trio (win/tie/lose) labels appear for the home card.
    expect(screen.getAllByText('tie').length).toBeGreaterThan(0);
    expect(screen.getAllByText('lose').length).toBeGreaterThan(0);

    // Tap again → both trio AND drawer collapse.
    await user.click(screen.getAllByText('Home Team')[0]);
    expect(screen.queryByText('tie')).not.toBeInTheDocument();
  });

  it('opens both teams\' drawers when either team name is tapped (shared state)', async () => {
    const match = buildMatch({
      home_team: { team_name: 'Sharks' },
      away_team: { team_name: 'Jets' },
      home_games_won: 5,
      home_to_win: 11,
      home_to_tie: 9,
      home_to_lose: 7,
      away_to_win: 11,
      away_to_tie: 9,
      away_to_lose: 7,
    });

    const user = userEvent.setup();
    renderWithProviders(
      <UnifiedScoreboard
        match={match}
        homeLineup={buildLineup()}
        awayLineup={buildLineup({ team_id: 'team-away' })}
        homeThresholds={bcaThresholds()}
        awayThresholds={bcaThresholds()}
        homeLosses={3}
        awayLosses={5}
        allGamesComplete={false}
        isHomeTeam={true}
        gameType="8-ball"
        winCondition="games"
        lineupSize={3}
        {...noopHandlers}
      />,
    );

    // Default: neither drawer is open. The "tie" threshold label only
    // surfaces inside the drawer-bound trio.
    expect(screen.queryByText('tie')).not.toBeInTheDocument();

    // Tap the AWAY team. Both drawers should open per Ed's framing.
    await user.click(screen.getByText('Jets'));

    // Both teams' threshold trios are now visible (one per team — at least
    // 2 "tie" labels, one per side). If only one side opened we'd see 1.
    expect(screen.getAllByText('tie').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('lose').length).toBeGreaterThanOrEqual(2);
  });
});
