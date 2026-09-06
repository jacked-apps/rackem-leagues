/**
 * @fileoverview Tests for rewriting raw games from one player's point of view.
 *
 * The two things worth guarding are the ones that would be wrong quietly:
 * whose side the row is written from, and which lineup the opponent's handicap
 * is read out of. Both look plausible when they are backwards.
 */

import { describe, it, expect } from 'vitest';
import {
  toPlayerGameRows,
  type RawGame,
  type HistoryContext,
} from './toPlayerGameRows';

const ME = 'me';
const THEM = 'them';

const ctx: HistoryContext = {
  playerNames: new Map([
    [ME, 'Me Myself'],
    [THEM, 'Joe Smith'],
  ]),
  seasonHandicapSystem: new Map([['season-1', 'percentage']]),
};

function emptySlots() {
  return {
    player2_id: null,
    player2_handicap: null,
    player3_id: null,
    player3_handicap: null,
    player4_id: null,
    player4_handicap: null,
    player5_id: null,
    player5_handicap: null,
    swap_new_player_id: null,
    swap_new_player_handicap: null,
  };
}

/** My team is home and theirs away, unless a test flips it. */
function game(
  overrides: Partial<RawGame> = {},
  matchOverrides: Record<string, unknown> = {},
): RawGame {
  return {
    id: 'g1',
    game_number: 1,
    home_player_id: ME,
    away_player_id: THEM,
    winner_player_id: ME,
    break_and_run: false,
    golden_break: false,
    runout: false,
    early_eight: false,
    win_by_forfeit: false,
    match: {
      id: 'm1',
      season_id: 'season-1',
      home_team_id: 'team-mine',
      away_team_id: 'team-theirs',
      assigned_table_number: 2,
      system_snapshot: { handicap_type: 'fargo' },
      week: { scheduled_date: '2026-05-01' },
      venue: { name: 'Butera Billiards' },
      lineups: [
        { team_id: 'team-mine', player1_id: ME, player1_handicap: 500, ...emptySlots() },
        { team_id: 'team-theirs', player1_id: THEM, player1_handicap: 620, ...emptySlots() },
      ],
      ...matchOverrides,
    },
    ...overrides,
  } as RawGame;
}

describe('toPlayerGameRows - whose side the row is written from', () => {
  it('reports a win when I am the winner', () => {
    const [row] = toPlayerGameRows([game()], ME, ctx);
    expect(row.won).toBe(true);
    expect(row.opponentName).toBe('Joe Smith');
  });

  it('reports a loss when they are', () => {
    const [row] = toPlayerGameRows([game({ winner_player_id: THEM })], ME, ctx);
    expect(row.won).toBe(false);
  });

  it('reads one game from both players and gets the mirror image', () => {
    // One row, two truths. This is the premise of the whole feature.
    const raw = [game()];
    const [mine] = toPlayerGameRows(raw, ME, ctx);
    const [theirs] = toPlayerGameRows(raw, THEM, ctx);

    expect(mine.won).toBe(true);
    expect(theirs.won).toBe(false);
    expect(mine.opponentId).toBe(THEM);
    expect(theirs.opponentId).toBe(ME);
    // Same game, so the ending is the same fact from either chair.
    expect(mine.ending).toBe(theirs.ending);
  });

  it('works when I am the away player', () => {
    const [row] = toPlayerGameRows(
      [game({ home_player_id: THEM, away_player_id: ME, winner_player_id: ME })],
      ME,
      ctx,
    );
    expect(row.won).toBe(true);
    expect(row.opponentId).toBe(THEM);
    expect(row.myTeamId).toBe('team-theirs');
  });

  it('skips games this player did not play', () => {
    expect(toPlayerGameRows([game()], 'someone-else', ctx)).toHaveLength(0);
  });

  it('counts a game with no recorded winner as not won', () => {
    const [row] = toPlayerGameRows([game({ winner_player_id: null })], ME, ctx);
    expect(row.won).toBe(false);
  });
});

describe('toPlayerGameRows - the handicap comes from THEIR lineup', () => {
  it('reads the opponent handicap, not mine', () => {
    // Both lineups are present; reading the wrong one returns 500 instead of
    // 620, and nothing else on the page would look wrong.
    const [row] = toPlayerGameRows([game()], ME, ctx);
    expect(row.opponentHandicap).toBe(620);
  });

  it('still reads their lineup when I am the away player', () => {
    // Flip the teams too, not just the players — a player is in their own
    // team's lineup, so swapping only the game's home/away player ids would
    // build a fixture that could not exist.
    const [row] = toPlayerGameRows(
      [
        game(
          { home_player_id: THEM, away_player_id: ME },
          { home_team_id: 'team-theirs', away_team_id: 'team-mine' },
        ),
      ],
      ME,
      ctx,
    );
    expect(row.opponentHandicap).toBe(620);
  });

  it('is null when their lineup is missing', () => {
    const [row] = toPlayerGameRows([game({}, { lineups: [] })], ME, ctx);
    expect(row.opponentHandicap).toBeNull();
  });
});

describe('toPlayerGameRows - handicap system', () => {
  it('prefers the snapshot frozen at match start', () => {
    const [row] = toPlayerGameRows([game()], ME, ctx);
    expect(row.handicapSystem).toBe('fargo');
  });

  it('falls back to the league system when a legacy match has no snapshot', () => {
    // Safe only because handicap_type is immutable per league (DB trigger).
    const [row] = toPlayerGameRows([game({}, { system_snapshot: null })], ME, ctx);
    expect(row.handicapSystem).toBe('percentage');
  });

  it('is null when neither is known, rather than guessed from the number', () => {
    const [row] = toPlayerGameRows(
      [game({}, { system_snapshot: null, season_id: 'unknown-season' })],
      ME,
      ctx,
    );
    expect(row.handicapSystem).toBeNull();
  });
});

describe('toPlayerGameRows - endings', () => {
  it.each([
    ['break_and_run', { break_and_run: true }],
    ['golden_break', { golden_break: true }],
    ['runout', { runout: true }],
    ['early_eight', { early_eight: true }],
    ['forfeit', { win_by_forfeit: true }],
  ])('records %s', (expected, flags) => {
    const [row] = toPlayerGameRows([game(flags)], ME, ctx);
    expect(row.ending).toBe(expected);
  });

  it('records an ordinary game as plain', () => {
    const [row] = toPlayerGameRows([game()], ME, ctx);
    expect(row.ending).toBe('plain');
  });

  it('treats a forfeit as a forfeit even if a legacy row also set a flag', () => {
    // A forfeited game was not played, so nothing else about how it ended can
    // be true. The current dialog clears the others; old rows may not have.
    const [row] = toPlayerGameRows(
      [game({ win_by_forfeit: true, break_and_run: true })],
      ME,
      ctx,
    );
    expect(row.ending).toBe('forfeit');
  });
});

describe('toPlayerGameRows - context', () => {
  it('carries venue and table through', () => {
    const [row] = toPlayerGameRows([game()], ME, ctx);
    expect(row.venueName).toBe('Butera Billiards');
    expect(row.tableNumber).toBe(2);
  });

  it('names an unknown opponent rather than showing a blank', () => {
    const [row] = toPlayerGameRows([game({ away_player_id: 'ghost' })], ME, ctx);
    expect(row.opponentName).toBe('Unknown player');
  });

  it('sorts newest first', () => {
    const rows = toPlayerGameRows(
      [
        game({ id: 'old' }, { week: { scheduled_date: '2026-01-01' } }),
        game({ id: 'new' }, { week: { scheduled_date: '2026-06-01' } }),
        game({ id: 'mid' }, { week: { scheduled_date: '2026-03-01' } }),
      ],
      ME,
      ctx,
    );
    expect(rows.map((r) => r.gameId)).toEqual(['new', 'mid', 'old']);
  });
});

describe('toPlayerGameRows - venue', () => {
  it('prefers where the match was actually played', () => {
    const [row] = toPlayerGameRows(
      [
        game(
          {},
          {
            venue: { name: 'Actual Hall' },
            scheduled_venue: { name: 'Scheduled Hall' },
          },
        ),
      ],
      ME,
      ctx,
    );
    expect(row.venueName).toBe('Actual Hall');
  });

  it('falls back to the scheduled venue when no actual one is recorded', () => {
    // A match that never had its venue confirmed still happened somewhere, and
    // the schedule is the best evidence of where.
    const [row] = toPlayerGameRows(
      [game({}, { venue: null, scheduled_venue: { name: 'Scheduled Hall' } })],
      ME,
      ctx,
    );
    expect(row.venueName).toBe('Scheduled Hall');
  });

  it('is null when neither is known', () => {
    const [row] = toPlayerGameRows(
      [game({}, { venue: null, scheduled_venue: null })],
      ME,
      ctx,
    );
    expect(row.venueName).toBeNull();
  });
});

describe('toPlayerGameRows - table size', () => {
  /** The venue records which of ITS table numbers are which size. */
  const venue = {
    name: 'Butera Billiards',
    bar_box_table_numbers: [1, 2],
    eight_foot_table_numbers: [5],
    regulation_table_numbers: [3, 4],
  };

  it.each([
    [1, 'bar_box'],
    [3, 'regulation'],
    [5, 'eight_foot'],
  ])('reads table %i as %s', (tableNumber, expected) => {
    const [r] = toPlayerGameRows(
      [game({}, { venue, assigned_table_number: tableNumber })],
      ME,
      ctx,
    );
    expect(r.tableSize).toBe(expected);
  });

  it('is null for a table the venue has not catalogued', () => {
    // Never guessed. A venue that has not recorded its room says nothing
    // rather than defaulting everything to the commonest size.
    const [r] = toPlayerGameRows(
      [game({}, { venue, assigned_table_number: 9 })],
      ME,
      ctx,
    );
    expect(r.tableSize).toBeNull();
  });

  it('is null when there is no table number', () => {
    const [r] = toPlayerGameRows(
      [game({}, { venue, assigned_table_number: null })],
      ME,
      ctx,
    );
    expect(r.tableSize).toBeNull();
  });

  it('falls back to the scheduled venue when no actual one is recorded', () => {
    const [r] = toPlayerGameRows(
      [game({}, { venue: null, scheduled_venue: venue, assigned_table_number: 3 })],
      ME,
      ctx,
    );
    expect(r.tableSize).toBe('regulation');
  });
});
