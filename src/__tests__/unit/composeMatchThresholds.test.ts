/**
 * @fileoverview Unit tests for composeMatchThresholds — the system-agnostic
 * match threshold composer (lineup-swap recalibration, Unit 2).
 *
 * The central invariant under test is R7 / [[feedback_match_ops_system_agnostic]]:
 * the composer dispatches through `buildSystemFromPreferences` and the resolved
 * mechanism's KIND, never on `handicap_type`. We verify this two ways:
 *   1. Behaviourally — four different systems (percentage / points / fargo /
 *      none) each recalibrate correctly with the SAME composer code path.
 *   2. Structurally — the composer source contains no handicap-type string
 *      literal and no lineup-shape sniffing (player4_handicap / team_format).
 *
 * Parity: for the extended-finish (extra_games) shape we assert byte-identical
 * numbers against the same charts match preparation uses; for the head-start
 * (Fargo start-points) shape we assert against the Fargo formula chart.
 */

import { readFileSync } from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { composeMatchThresholds } from '@/utils/match/composeMatchThresholds';
import { get5v5GamesNeeded } from '@/utils/handicap/get5v5GamesNeeded';
import { get3v3GamesNeeded } from '@/utils/handicap/get3v3GamesNeeded';
import { fargoFormulaChart } from '@/systems/threshold-charts';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { Lineup } from '@/types/match';

// Only the team-bonus DB call is mocked (used solely by the points system).
// Every other system path runs the real chart math with no DB access.
vi.mock('@/utils/getTeamHandicapBonus', () => ({
  getTeamHandicapBonus: vi.fn().mockResolvedValue(0),
}));
import { getTeamHandicapBonus } from '@/utils/getTeamHandicapBonus';
const mockedBonus = vi.mocked(getTeamHandicapBonus);

beforeEach(() => {
  mockedBonus.mockClear();
  mockedBonus.mockResolvedValue(0);
});

/** Build a resolved-prefs object, overriding the BCA-5v5 (percentage) base. */
function makePrefs(overrides: Partial<ResolvedSystemConfig> = {}): ResolvedSystemConfig {
  return {
    lineup_size: 5,
    max_roster_size: 8,
    game_generation: 'single_round_robin',
    pairing_format: 'single_rack',
    race_length: null,
    points_calculator: 'accumulate_with_milestone_jumps',
    points_calculator_params: {},
    win_condition: 'games',
    handicap_type: 'percentage',
    mechanism: 'extra_games',
    threshold_chart_id: null,
    standings_sort: ['match_wins'],
    tiebreaker_trigger: 'never',
    tiebreaker_format: 'accept_tie',
    overrides: {},
    per_game_allocator_id: null,
    snapshot_at: '2026-06-02T00:00:00.000Z',
    ...overrides,
  };
}

/** Build a lineup row from per-position handicaps (trailing positions optional). */
function makeLineup(handicaps: Array<number | null>): Lineup {
  const at = (i: number) => (handicaps[i] === undefined ? null : handicaps[i]);
  return {
    id: `lineup-${Math.abs(handicaps.reduce<number>((a, h) => a + (h ?? 0), 0))}`,
    team_id: 'team',
    player1_id: 'p1',
    player1_handicap: (at(0) ?? 0) as number,
    player2_id: 'p2',
    player2_handicap: (at(1) ?? 0) as number,
    player3_id: 'p3',
    player3_handicap: (at(2) ?? 0) as number,
    player4_id: at(3) === null ? null : 'p4',
    player4_handicap: at(3),
    player5_id: at(4) === null ? null : 'p5',
    player5_handicap: at(4),
    home_team_modifier: 0,
    locked: false,
    locked_at: null,
  };
}

const ctx = { homeTeamId: 'home', awayTeamId: 'away', seasonId: 'season' };

describe('composeMatchThresholds — extended-finish (extra_games)', () => {
  it('percentage (BCA 5v5): byte-identical to the 5v5 games-needed chart, no DB call', async () => {
    const prefs = makePrefs(); // base is percentage / extra_games / 5v5
    const homeLineup = makeLineup([5, 4, 3, 2, 1]); // sum 15
    const awayLineup = makeLineup([1, 1, 1, 1, 1]); // sum 5

    const payload = await composeMatchThresholds({ prefs, homeLineup, awayLineup, ...ctx });

    const expectedHome = get5v5GamesNeeded(10); // homeSum - awaySum
    const expectedAway = get5v5GamesNeeded(-10);
    expect(payload).toEqual({
      home_to_win: expectedHome.games_to_win,
      home_to_tie: expectedHome.games_to_tie,
      home_to_lose: expectedHome.games_to_lose,
      away_to_win: expectedAway.games_to_win,
      away_to_tie: expectedAway.games_to_tie,
      away_to_lose: expectedAway.games_to_lose,
    });
    expect(mockedBonus).not.toHaveBeenCalled(); // percentage never fetches team bonus
  });

  it('points (BCA 3v3): byte-identical to the 3v3 chart, includes team bonus on home', async () => {
    mockedBonus.mockResolvedValue(2); // home gets a +2 team bonus
    const prefs = makePrefs({
      lineup_size: 3,
      handicap_type: 'points',
      game_generation: 'double_round_robin',
      points_calculator: 'linear_above_threshold',
    });
    const homeLineup = makeLineup([7, 5, 3, null, null]); // sum 15 (+2 bonus = 17)
    const awayLineup = makeLineup([2, 2, 2, null, null]); // sum 6

    const payload = await composeMatchThresholds({ prefs, homeLineup, awayLineup, ...ctx });

    const expectedHome = get3v3GamesNeeded(17 - 6);
    const expectedAway = get3v3GamesNeeded(6 - 17);
    expect(payload.home_to_win).toBe(expectedHome.games_to_win);
    expect(payload.away_to_win).toBe(expectedAway.games_to_win);
    expect(mockedBonus).toHaveBeenCalledTimes(1);
  });

  it('none: a no-handicap league (zero handicaps) gets symmetric even-match thresholds, no DB call', async () => {
    // A 'none' league carries no per-player handicaps, so both sides resolve to
    // the zero-diff (even match) chart entry — byte-identical to what match
    // preparation produces for the same league. No team bonus, no asymmetry.
    const prefs = makePrefs({ handicap_type: 'none', mechanism: 'none' });
    const payload = await composeMatchThresholds({
      prefs,
      homeLineup: makeLineup([0, 0, 0, 0, 0]),
      awayLineup: makeLineup([0, 0, 0, 0, 0]),
      ...ctx,
    });
    const even = get5v5GamesNeeded(0);
    expect(payload).toEqual({
      home_to_win: even.games_to_win,
      home_to_tie: even.games_to_tie,
      home_to_lose: even.games_to_lose,
      away_to_win: even.games_to_win,
      away_to_tie: even.games_to_tie,
      away_to_lose: even.games_to_lose,
    });
    expect(mockedBonus).not.toHaveBeenCalled();
  });
});

describe('composeMatchThresholds — head-start (Fargo start-points)', () => {
  const fargoPrefs = makePrefs({
    handicap_type: 'fargo',
    mechanism: 'start_points',
    points_calculator: 'accumulated_per_game',
  });

  it('credits the weaker team the freshly-computed start points in *_to_tie', async () => {
    const homeLineup = makeLineup([500, 500, 500, 500, 500]); // stronger
    const awayLineup = makeLineup([450, 450, 450, 450, 450]); // weaker

    const payload = await composeMatchThresholds({
      prefs: fargoPrefs,
      homeLineup,
      awayLineup,
      ...ctx,
    });

    const expected = fargoFormulaChart.compute(
      [500, 500, 500, 500, 500],
      [450, 450, 450, 450, 450],
      {},
    );
    expect(expected.weakerTeam).toBe('away');
    expect(payload).toEqual({
      home_to_win: null,
      home_to_tie: 0, // stronger side gets no head start
      home_to_lose: null,
      away_to_win: null,
      away_to_tie: expected.startPointsForWeakerTeam,
      away_to_lose: null,
    });
  });

  it('evenly-matched teams get zero start points on both sides', async () => {
    const even = makeLineup([500, 500, 500, 500, 500]);
    const payload = await composeMatchThresholds({
      prefs: fargoPrefs,
      homeLineup: even,
      awayLineup: makeLineup([500, 500, 500, 500, 500]),
      ...ctx,
    });
    expect(payload.home_to_tie).toBe(0);
    expect(payload.away_to_tie).toBe(0);
  });
});

describe('composeMatchThresholds — modularity invariant (R7)', () => {
  const source = readFileSync('src/utils/match/composeMatchThresholds.ts', 'utf-8');

  it('contains no handicap-type string literal', () => {
    for (const forbidden of ["'fargo'", "'points'", "'percentage'", "'none'", "'skill_level'"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('does not sniff lineup shape to infer the system', () => {
    expect(source).not.toContain('player4_handicap');
    expect(source).not.toContain('player5_handicap');
    expect(source).not.toContain('team_format');
  });

  it('dispatches through buildSystemFromPreferences and the mechanism kind', () => {
    expect(source).toContain('buildSystemFromPreferences');
    expect(source).toContain('mechanism.kind');
  });
});
