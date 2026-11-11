/**
 * @fileoverview Unit tests for the review-surface pure helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  achievementChips,
  buildNameTeamMap,
  confirmationsForGame,
  type ConfirmationRow,
} from '../reviewHelpers';
import type { EntryGame } from '../entryHelpers';

const baseGame: EntryGame = {
  id: 'g1',
  game_number: 1,
  home_player_id: 'h1',
  away_player_id: 'a1',
  winner_player_id: 'h1',
  winner_team_id: 'home',
};

describe('achievementChips', () => {
  it('returns only the truthy extras in display order', () => {
    expect(
      achievementChips({ ...baseGame, golden_break: true, break_and_run: true })
    ).toEqual(['Break & Run', 'Golden Break']);
  });

  it('returns an empty array when no extras are set', () => {
    expect(achievementChips(baseGame)).toEqual([]);
  });

  it('includes Forfeit when win_by_forfeit', () => {
    expect(achievementChips({ ...baseGame, win_by_forfeit: true })).toEqual(['Forfeit']);
  });
});

describe('confirmationsForGame', () => {
  const rows: ConfirmationRow[] = [
    { confirmer_id: 'h1', side: 'home', action: 'confirm', created_at: 't1', game_id: 'g1' },
    { confirmer_id: 'a1', side: 'away', action: 'confirm', created_at: 't2', game_id: 'g2' },
  ];

  it('keeps only the rows for the given game', () => {
    expect(confirmationsForGame(rows, 'g1').map((r) => r.confirmer_id)).toEqual(['h1']);
  });
});

describe('buildNameTeamMap', () => {
  const home = {
    data: {
      team_players: [
        { members: { id: 'h1', nickname: 'Ace', first_name: 'Al', last_name: 'Pha' } },
        { members: { id: 'h2', nickname: null, first_name: 'Bea', last_name: 'Ta' } },
      ],
    },
    teamName: 'Sharks',
  };
  const away = {
    data: { team_players: [{ members: { id: 'a1', nickname: 'Dee', first_name: 'D', last_name: 'X' } }] },
    teamName: 'Jets',
  };

  it('maps ids to nickname-preferred name + full name + team', () => {
    const map = buildNameTeamMap(home, away);
    expect(map.get('h1')).toEqual({ name: 'Ace', fullName: 'Al Pha', team: 'Sharks' });
    expect(map.get('a1')).toEqual({ name: 'Dee', fullName: 'D X', team: 'Jets' });
  });

  it('falls back to "First Last" for both name and fullName when no nickname', () => {
    const map = buildNameTeamMap(home, away);
    expect(map.get('h2')).toEqual({ name: 'Bea Ta', fullName: 'Bea Ta', team: 'Sharks' });
  });

  it('tolerates missing roster data', () => {
    const map = buildNameTeamMap({ data: undefined, teamName: 'A' }, { data: null, teamName: 'B' });
    expect(map.size).toBe(0);
  });
});
