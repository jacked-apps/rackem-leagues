/**
 * @fileoverview The season-replay fixture builder
 * (scripts/season-fixture/buildFixture.mjs). The repo is public, so the
 * thing that matters most is what it must NOT copy: names, real ids, dates,
 * who confirmed a game, or any column it wasn't told about.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U3)
 */

import { describe, it, expect } from 'vitest';
import { buildFixture } from '../../../scripts/season-fixture/buildFixture.mjs';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [H, A, BYE, W1, W2] = [id(1), id(2), id(3), id(4), id(5)];

/** A completed match row with production-like columns, including ones that must be dropped. */
function match(n: number, week: string, home: string, away: string) {
  return {
    id: id(100 + n), season_week_id: week, match_number: n, home_team_id: home, away_team_id: away,
    home_to_win: 10, home_to_tie: 9, home_to_lose: 8, away_to_win: 10, away_to_tie: 9, away_to_lose: 8,
    home_games_won: 10, away_games_won: 8, home_points_earned: 1, away_points_earned: -1,
    match_result: 'home_win', winner_team_id: home, home_team_verified_by: id(900),
    completed_at: '2026-08-31T00:46:21Z', team_secret_note: 'Bob was late',
    system_snapshot: { points_calculator: 'linear_above_threshold', snapshot_at: '2026-08-30T20:56:56Z', per_game_allocator_id: id(901), threshold_chart_id: null },
  };
}
const lineup = (matchId: string, team: string) => ({
  match_id: matchId, team_id: team, locked: true, player1_id: id(800), player1_handicap: 2,
  player2_handicap: -1, player3_handicap: 0, player4_handicap: 0, player5_handicap: 0, home_team_modifier: 1,
});

const m1 = match(1, W2, H, A);
const m2 = match(2, W1, A, H);
const raw = {
  matches: [m1, m2, match(3, W1, H, BYE)],
  weeks: [{ id: W2, scheduled_date: '2026-06-21', week_type: 'regular' }, { id: W1, scheduled_date: '2026-06-14', week_type: 'regular' }],
  teams: [{ id: H, status: 'active' }, { id: A, status: 'active' }, { id: BYE, status: 'bye' }],
  lineups: [lineup(m1.id, H), lineup(m1.id, A), lineup(m2.id, H), lineup(m2.id, A)],
  games: [{ match_id: m1.id, game_number: 1, winner_team_id: A, winner_player_id: id(800), home_position: 1, away_position: 1, is_tiebreaker: false, confirmed_by_home: id(700), confirmed_by_away: null, created_at: '2026-08-30T20:56:30Z' }],
};

describe('buildFixture', () => {
  const { matches, skipped } = buildFixture(raw);
  const text = JSON.stringify(matches);

  it('contains no uuid, no date and no unlisted column', () => {
    expect(text).not.toMatch(UUID);
    expect(text).not.toMatch(/20\d\d-\d\d-\d\d/);
    expect(text).not.toContain('Bob was late');
    expect(text).not.toContain('verified_by');
  });

  it('skips bye matches and numbers weeks by date, not by input order', () => {
    expect(skipped.byes).toBe(1);
    expect(matches.map((m) => m.key)).toEqual(['W01-M2', 'W02-M1']);
  });

  it('gives each team one stable fake name across matches', () => {
    expect(matches.map((m) => [m.home, m.away])).toEqual([['Team A', 'Team B'], ['Team B', 'Team A']]);
  });

  it('keeps what scoring needs: handicaps, frozen bonus, winning SIDE, confirmed yes/no', () => {
    const later = matches[1];
    expect(later.lineups.home).toEqual({ lockedRows: 1, handicaps: [2, -1, 0, 0, 0], home_team_modifier: 1 });
    expect(later.games[0]).toMatchObject({ winner: 'away', confirmed_home: true, confirmed_away: false });
    expect(later.stored).toMatchObject({ home_points_earned: 1, winner: 'home' });
  });

  it('drops snapshot ids and the timestamp but keeps the settings', () => {
    expect(matches[0].snapshot).toEqual({ points_calculator: 'linear_above_threshold' });
    expect(matches[0].usesThresholdChart).toBe(false);
  });
});
