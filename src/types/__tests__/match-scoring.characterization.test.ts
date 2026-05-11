/**
 * @fileoverview Characterization tests for BCA scoring aggregators.
 *
 * Locks the three pure functions in `src/types/match.ts` that produce
 * the BCA running scoreboard mid-match AND the final point totals:
 *
 *   1. getTeamStats(teamId, gameResults) → { wins, losses }
 *      - Only counts confirmed games (both home and away confirmed)
 *      - Wins = games where winner_team_id === teamId
 *      - Losses = games with a different (non-null) winner
 *
 *   2. calculatePoints(teamId, thresholds, gameResults) → number
 *      - 3v3 BCA points scoring
 *      - Tie-possible chart: positive above games_to_win, ZERO in tie
 *        range (games_to_tie..games_to_win inclusive), negative below
 *      - No-tie chart: simple wins - games_to_win (can go negative)
 *
 *   3. calculateBCAPoints(teamId, thresholds, gameResults) → number
 *      - 5v5 BCA bonus-jump scoring
 *      - Below 70% of games_to_win: 0.1 points per win
 *      - At 70% (rounded): jumps to 1.5 + 0.1 per additional win
 *      - At games_to_win: jumps to 3.0 + 0.1 per additional win
 *      - 70% threshold uses Math.round (banker's rounding for .5 ties)
 *
 * These are the EXACT functions that produce the score numbers the
 * user asked be locked: "make sure the numbers match as each game
 * is being recorded. before and after."
 *
 * Locked here so the modular-league refactor (Phase 5) can extend or
 * relocate scoring without changing the numbers visible during play.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePoints,
  calculateBCAPoints,
  getTeamStats,
} from '../match';
import type { MatchGame, HandicapThresholds } from '../match';

const HOME = 'home-team-id';
const AWAY = 'away-team-id';

function game(overrides: Partial<MatchGame>): MatchGame {
  return {
    id: 'g',
    game_number: 1,
    home_position: 1,
    away_position: 1,
    home_player_id: null,
    away_player_id: null,
    winner_team_id: null,
    winner_player_id: null,
    home_action: 'breaks',
    away_action: 'racks',
    break_and_run: false,
    golden_break: false,
    confirmed_by_home: true,
    confirmed_by_away: true,
    is_tiebreaker: false,
    break_fouled: false,
    runout: false,
    win_by_forfeit: false,
    loser_balls_pocketed: null,
    ...overrides,
  };
}

function makeMap(games: MatchGame[]): Map<number, MatchGame> {
  return new Map(games.map((g, i) => [g.game_number ?? i + 1, g]));
}

describe('getTeamStats — characterization', () => {
  it('returns 0 wins and 0 losses for empty Map', () => {
    expect(getTeamStats(HOME, new Map())).toEqual({ wins: 0, losses: 0 });
  });

  it('counts wins where winner_team_id matches the team', () => {
    const games = makeMap([
      game({ game_number: 1, winner_team_id: HOME }),
      game({ game_number: 2, winner_team_id: HOME }),
      game({ game_number: 3, winner_team_id: AWAY }),
    ]);
    expect(getTeamStats(HOME, games)).toEqual({ wins: 2, losses: 1 });
  });

  it('skips games where winner_team_id is null (unscored)', () => {
    const games = makeMap([
      game({ game_number: 1, winner_team_id: HOME }),
      game({ game_number: 2, winner_team_id: null }),
      game({ game_number: 3, winner_team_id: AWAY }),
    ]);
    expect(getTeamStats(HOME, games)).toEqual({ wins: 1, losses: 1 });
  });

  it('skips games not confirmed by home', () => {
    const games = makeMap([
      game({ game_number: 1, winner_team_id: HOME, confirmed_by_home: false }),
      game({ game_number: 2, winner_team_id: HOME }),
    ]);
    expect(getTeamStats(HOME, games)).toEqual({ wins: 1, losses: 0 });
  });

  it('skips games not confirmed by away', () => {
    const games = makeMap([
      game({ game_number: 1, winner_team_id: HOME, confirmed_by_away: false }),
      game({ game_number: 2, winner_team_id: HOME }),
    ]);
    expect(getTeamStats(HOME, games)).toEqual({ wins: 1, losses: 0 });
  });

  it('counts an unrelated winner as a loss for the queried team', () => {
    const games = makeMap([
      game({ game_number: 1, winner_team_id: 'unrelated' }),
    ]);
    expect(getTeamStats(HOME, games)).toEqual({ wins: 0, losses: 1 });
  });
});

describe('calculatePoints — characterization (3v3 BCA points scoring)', () => {
  it('returns 0 when thresholds is null', () => {
    expect(calculatePoints(HOME, null, new Map())).toBe(0);
  });

  describe('tie-possible thresholds (chart entry has games_to_tie)', () => {
    // Example: even-match 3v3 → win=10, tie=9, lose=8
    const thresholds: HandicapThresholds = {
      games_to_win: 10,
      games_to_tie: 9,
      games_to_lose: 8,
    };

    it('wins exactly games_to_win (10) → 0 points (just at win threshold)', () => {
      const games = makeMap(
        Array.from({ length: 10 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculatePoints(HOME, thresholds, games)).toBe(0);
    });

    it('wins above games_to_win (12) → +2 points (12 - 10)', () => {
      const games = makeMap(
        Array.from({ length: 12 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculatePoints(HOME, thresholds, games)).toBe(2);
    });

    it('wins exactly games_to_tie (9) → 0 points (in tie range)', () => {
      const games = makeMap(
        Array.from({ length: 9 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculatePoints(HOME, thresholds, games)).toBe(0);
    });

    it('wins below games_to_tie (8) → -1 points (8 - 9)', () => {
      const games = makeMap(
        Array.from({ length: 8 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculatePoints(HOME, thresholds, games)).toBe(-1);
    });

    it('wins way below tie (5) → -4 points (5 - 9)', () => {
      const games = makeMap(
        Array.from({ length: 5 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculatePoints(HOME, thresholds, games)).toBe(-4);
    });

    it('zero wins → -9 points (0 - 9)', () => {
      expect(calculatePoints(HOME, thresholds, new Map())).toBe(-9);
    });
  });

  describe('no-tie-possible thresholds (chart entry has null games_to_tie)', () => {
    // Example: handicap diff +1 → win=10, tie=null, lose=9
    const thresholds: HandicapThresholds = {
      games_to_win: 10,
      games_to_tie: null,
      games_to_lose: 9,
    };

    it('wins exactly games_to_win → 0 points', () => {
      const games = makeMap(
        Array.from({ length: 10 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculatePoints(HOME, thresholds, games)).toBe(0);
    });

    it('above games_to_win → positive', () => {
      const games = makeMap(
        Array.from({ length: 13 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculatePoints(HOME, thresholds, games)).toBe(3);
    });

    it('below games_to_win → negative (no tie buffer)', () => {
      const games = makeMap(
        Array.from({ length: 9 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      // 9 - 10 = -1; no tie range so this is straight subtraction
      expect(calculatePoints(HOME, thresholds, games)).toBe(-1);
    });
  });
});

describe('calculateBCAPoints — characterization (5v5 BCA bonus-jump scoring)', () => {
  it('returns 0 when thresholds is null', () => {
    expect(calculateBCAPoints(HOME, null, new Map())).toBe(0);
  });

  // Example: even-match 5v5 → games_to_win = 13. 70% of 13 = 9.1 → rounds to 9.
  const thresholds: HandicapThresholds = {
    games_to_win: 13,
    games_to_tie: null,
    games_to_lose: 12,
  };

  describe('below 70% threshold (0.1 per win)', () => {
    it('zero wins → 0 points', () => {
      expect(calculateBCAPoints(HOME, thresholds, new Map())).toBe(0);
    });

    it('1 win → 0.1 points', () => {
      const games = makeMap([game({ game_number: 1, winner_team_id: HOME })]);
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(0.1, 5);
    });

    it('5 wins → 0.5 points', () => {
      const games = makeMap(
        Array.from({ length: 5 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(0.5, 5);
    });

    it('8 wins → 0.8 points (just below 70% = 9 wins)', () => {
      const games = makeMap(
        Array.from({ length: 8 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(0.8, 5);
    });
  });

  describe('70% threshold bonus jump (1.5 + 0.1 per additional win)', () => {
    it('9 wins (exactly 70%) → 1.5 points (bonus jump)', () => {
      const games = makeMap(
        Array.from({ length: 9 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(1.5, 5);
    });

    it('10 wins → 1.6 points', () => {
      const games = makeMap(
        Array.from({ length: 10 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(1.6, 5);
    });

    it('12 wins → 1.8 points (just below win threshold)', () => {
      const games = makeMap(
        Array.from({ length: 12 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(1.8, 5);
    });
  });

  describe('win-threshold bonus jump (3.0 + 0.1 per additional win)', () => {
    it('13 wins (exactly games_to_win) → 3.0 points (second bonus jump)', () => {
      const games = makeMap(
        Array.from({ length: 13 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(3.0, 5);
    });

    it('14 wins → 3.1 points', () => {
      const games = makeMap(
        Array.from({ length: 14 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(3.1, 5);
    });

    it('25 wins (max in 5v5 SRR) → 4.2 points', () => {
      const games = makeMap(
        Array.from({ length: 25 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      // 3.0 + (25 - 13) * 0.1 = 3.0 + 1.2 = 4.2
      expect(calculateBCAPoints(HOME, thresholds, games)).toBeCloseTo(4.2, 5);
    });
  });

  describe('70% threshold rounding (Math.round, .5 rounds toward +Inf in V8)', () => {
    it('games_to_win=10: 70% = 7 exactly, no rounding ambiguity', () => {
      const t: HandicapThresholds = {
        games_to_win: 10,
        games_to_tie: null,
        games_to_lose: 9,
      };
      // 7 wins should hit the 1.5 bonus
      const games = makeMap(
        Array.from({ length: 7 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, t, games)).toBeCloseTo(1.5, 5);
    });

    it('games_to_win=15: 70% = 10.5 → rounds to 11 (banker would say 10, but Math.round in V8 rounds .5 up)', () => {
      const t: HandicapThresholds = {
        games_to_win: 15,
        games_to_tie: null,
        games_to_lose: 14,
      };
      // 11 wins should hit the bonus, 10 should not
      const ten = makeMap(
        Array.from({ length: 10 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      const eleven = makeMap(
        Array.from({ length: 11 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      // 10 wins: still in 0.1-per-win range → 1.0
      expect(calculateBCAPoints(HOME, t, ten)).toBeCloseTo(1.0, 5);
      // 11 wins: hits 70% rounded threshold → 1.5
      expect(calculateBCAPoints(HOME, t, eleven)).toBeCloseTo(1.5, 5);
    });
  });

  describe('handicap-asymmetric thresholds (higher-team needs more)', () => {
    it('higher team (games_to_win=15) needs more wins to hit each bonus', () => {
      const higher: HandicapThresholds = {
        games_to_win: 15,
        games_to_tie: null,
        games_to_lose: 10,
      };
      // 8 wins on the higher team (needs 11 for 70% jump): still 0.1/win
      const eight = makeMap(
        Array.from({ length: 8 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, higher, eight)).toBeCloseTo(0.8, 5);
    });

    it('lower team (games_to_win=11) hits bonuses with fewer wins', () => {
      const lower: HandicapThresholds = {
        games_to_win: 11,
        games_to_tie: null,
        games_to_lose: 14,
      };
      // 70% of 11 = 7.7 → rounds to 8
      // 8 wins on lower team: 1.5 (bonus jump)
      const eight = makeMap(
        Array.from({ length: 8 }, (_, i) =>
          game({ game_number: i + 1, winner_team_id: HOME })
        )
      );
      expect(calculateBCAPoints(HOME, lower, eight)).toBeCloseTo(1.5, 5);
    });
  });
});
