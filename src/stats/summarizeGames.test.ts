/**
 * @fileoverview Tests for the summary maths.
 *
 * The case that matters most is the both-directions one: the same ending has to
 * count as a win for the player who won and a loss for the player who lost. Get
 * that wrong and the page still renders plausible numbers while answering the
 * one question it exists to answer incorrectly.
 */

import { describe, it, expect } from 'vitest';
import { summarizeGames, splitForComparison } from './summarizeGames';
import type { GameEnding, PlayerGameRow } from './playerGameRow';

let seq = 0;

function row(overrides: Partial<PlayerGameRow> = {}): PlayerGameRow {
  seq += 1;
  return {
    gameId: `g${seq}`,
    matchId: 'm1',
    gameNumber: seq,
    playedOn: '2026-05-01',
    seasonId: 'season-1',
    won: true,
    ending: 'plain',
    gameType: 'eight_ball',
    opponentId: 'opp-1',
    opponentName: 'Joe Smith',
    opponentHandicap: 3,
    handicapSystem: 'points',
    venueName: 'Butera Billiards',
    tableNumber: 2,
    myTeamId: 'team-1',
    ...overrides,
  };
}

/** n rows, all the same. */
function rows(n: number, overrides: Partial<PlayerGameRow> = {}): PlayerGameRow[] {
  return Array.from({ length: n }, () => row(overrides));
}

describe('summarizeGames - the basic record', () => {
  it('counts wins and losses', () => {
    const s = summarizeGames([...rows(3, { won: true }), ...rows(2, { won: false })]);
    expect(s.played).toBe(5);
    expect(s.won).toBe(3);
    expect(s.lost).toBe(2);
  });

  it('reports a win rate as a fraction', () => {
    const s = summarizeGames([...rows(1, { won: true }), ...rows(3, { won: false })]);
    expect(s.winRate).toBe(0.25);
  });

  it('reports no win rate at all when nothing has been played', () => {
    // Null, not 0 — a player who has never played does not have a 0% record.
    const s = summarizeGames([]);
    expect(s.played).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.endings).toEqual([]);
  });

  it('keeps wins and losses adding up to games played', () => {
    const s = summarizeGames([...rows(7, { won: true }), ...rows(5, { won: false })]);
    expect(s.won + s.lost).toBe(s.played);
  });
});

describe('summarizeGames - endings count in BOTH directions', () => {
  it('separates games won by an ending from games lost to it', () => {
    // The whole point of the feature: 2 break & runs of my own, 5 that beat me.
    const s = summarizeGames([
      ...rows(2, { won: true, ending: 'break_and_run' }),
      ...rows(5, { won: false, ending: 'break_and_run' }),
    ]);

    const br = s.endings.find((e) => e.ending === 'break_and_run');
    expect(br).toEqual({ ending: 'break_and_run', won: 2, lost: 5 });
  });

  it('tells apart two players with identical records', () => {
    // Ed's example. Same win-loss line, different players.
    const unlucky = summarizeGames([
      ...rows(10, { won: true }),
      ...rows(8, { won: false, ending: 'break_and_run' }),
      ...rows(2, { won: false }),
    ]);
    const outplayed = summarizeGames([
      ...rows(10, { won: true }),
      ...rows(1, { won: false, ending: 'break_and_run' }),
      ...rows(9, { won: false }),
    ]);

    expect(unlucky.won).toBe(outplayed.won);
    expect(unlucky.lost).toBe(outplayed.lost);

    const lostToBR = (s: ReturnType<typeof summarizeGames>) =>
      s.endings.find((e) => e.ending === 'break_and_run')?.lost ?? 0;
    expect(lostToBR(unlucky)).toBe(8);
    expect(lostToBR(outplayed)).toBe(1);
  });

  it.each<GameEnding>([
    'break_and_run',
    'golden_break',
    'runout',
    'early_eight',
    'forfeit',
    'plain',
  ])('handles %s in both directions', (ending) => {
    const s = summarizeGames([
      ...rows(1, { won: true, ending }),
      ...rows(1, { won: false, ending }),
    ]);
    expect(s.endings.find((e) => e.ending === ending)).toEqual({
      ending,
      won: 1,
      lost: 1,
    });
  });

  it('lists only endings that actually happened', () => {
    const s = summarizeGames(rows(3, { ending: 'plain' }));
    expect(s.endings.map((e) => e.ending)).toEqual(['plain']);
  });

  it('puts the most frequent ending first', () => {
    const s = summarizeGames([
      ...rows(1, { ending: 'golden_break' }),
      ...rows(4, { ending: 'plain' }),
      ...rows(2, { ending: 'runout' }),
    ]);
    expect(s.endings.map((e) => e.ending)).toEqual(['plain', 'runout', 'golden_break']);
  });

  it('breaks a tie in a stable order rather than arbitrarily', () => {
    const s = summarizeGames([
      ...rows(1, { ending: 'forfeit' }),
      ...rows(1, { ending: 'break_and_run' }),
    ]);
    expect(s.endings.map((e) => e.ending)).toEqual(['break_and_run', 'forfeit']);
  });
});

describe('summarizeGames - distinct counts', () => {
  it('counts each team, opponent and venue once', () => {
    const s = summarizeGames([
      row({ myTeamId: 'a', opponentId: 'x', venueName: 'Hall 1' }),
      row({ myTeamId: 'a', opponentId: 'x', venueName: 'Hall 1' }),
      row({ myTeamId: 'b', opponentId: 'y', venueName: 'Hall 2' }),
    ]);
    expect(s.teamsPlayedOn).toBe(2);
    expect(s.opponentsFaced).toBe(2);
    expect(s.venuesPlayed).toBe(2);
  });

  it('ignores missing values rather than counting them as one more', () => {
    const s = summarizeGames([
      row({ myTeamId: null, opponentId: null, venueName: null }),
      row({ myTeamId: 'a', opponentId: 'x', venueName: 'Hall 1' }),
    ]);
    expect(s.teamsPlayedOn).toBe(1);
    expect(s.opponentsFaced).toBe(1);
    expect(s.venuesPlayed).toBe(1);
  });
});

describe('splitForComparison', () => {
  it('takes the most recent block and the one before it', () => {
    const all = rows(10);
    const { recent, previous } = splitForComparison(all, 3);
    expect(recent).toEqual(all.slice(0, 3));
    expect(previous).toEqual(all.slice(3, 6));
  });

  it('works at exactly two full blocks', () => {
    const all = rows(6);
    const { recent, previous } = splitForComparison(all, 3);
    expect(recent).toHaveLength(3);
    expect(previous).toHaveLength(3);
  });

  it('offers no comparison when the earlier block is incomplete', () => {
    // Comparing 3 recent games against 2 older ones would read as a trend and
    // mean nothing. Better to show nothing than something misleading.
    const { recent, previous } = splitForComparison(rows(5), 3);
    expect(recent).toHaveLength(3);
    expect(previous).toEqual([]);
  });

  it('offers no comparison when there is not even one full block', () => {
    const { recent, previous } = splitForComparison(rows(2), 3);
    expect(recent).toHaveLength(2);
    expect(previous).toEqual([]);
  });

  it('handles an empty history', () => {
    expect(splitForComparison([], 50)).toEqual({ recent: [], previous: [] });
  });

  it('refuses a nonsensical block size instead of throwing', () => {
    expect(splitForComparison(rows(5), 0)).toEqual({ recent: [], previous: [] });
    expect(splitForComparison(rows(5), -1)).toEqual({ recent: [], previous: [] });
  });
});
