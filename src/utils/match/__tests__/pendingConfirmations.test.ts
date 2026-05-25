/**
 * @fileoverview Tests for the pending-confirmation derivation
 * (live-scoring handoff stability).
 *
 * These pin the predicate that makes the confirm prompt self-heal from data:
 * a game needs MY confirmation iff a winner is set, the opponent confirmed,
 * and I have not. Everything else must NOT prompt me.
 */

import { describe, it, expect } from 'vitest';
import {
  gameNeedsMyConfirmation,
  buildConfirmationItem,
} from '../pendingConfirmations';
import type { MatchGame, Player } from '@/types';

const HOME = 'home-team';
const AWAY = 'away-team';

/** Minimal game row factory — only the fields the predicate/builder read. */
function game(overrides: Partial<MatchGame>): MatchGame {
  return {
    id: 'g1',
    game_number: 1,
    winner_team_id: null,
    winner_player_id: null,
    confirmed_by_home: false,
    confirmed_by_away: false,
    break_and_run: false,
    golden_break: false,
    break_fouled: false,
    runout: false,
    win_by_forfeit: false,
    winner_value: null,
    loser_value: null,
    ...overrides,
  } as MatchGame;
}

describe('gameNeedsMyConfirmation', () => {
  it('away scored + away confirmed, home has not → home needs to confirm', () => {
    const g = game({
      winner_player_id: 'p1',
      confirmed_by_away: true as unknown as boolean,
      confirmed_by_home: false,
    });
    expect(gameNeedsMyConfirmation(g, HOME, HOME)).toBe(true);
  });

  it('home scored + home confirmed, away has not → away needs to confirm', () => {
    const g = game({
      winner_player_id: 'p1',
      confirmed_by_home: true as unknown as boolean,
      confirmed_by_away: false,
    });
    expect(gameNeedsMyConfirmation(g, AWAY, HOME)).toBe(true);
  });

  it('does NOT prompt the side that already scored/confirmed it', () => {
    const g = game({
      winner_player_id: 'p1',
      confirmed_by_away: true as unknown as boolean,
    });
    // away is the scorer here; away should not be prompted
    expect(gameNeedsMyConfirmation(g, AWAY, HOME)).toBe(false);
  });

  it('does NOT prompt when there is no winner yet', () => {
    const g = game({ winner_player_id: null, confirmed_by_away: true as unknown as boolean });
    expect(gameNeedsMyConfirmation(g, HOME, HOME)).toBe(false);
  });

  it('does NOT prompt when both sides already confirmed (official)', () => {
    const g = game({
      winner_player_id: 'p1',
      confirmed_by_home: true as unknown as boolean,
      confirmed_by_away: true as unknown as boolean,
    });
    expect(gameNeedsMyConfirmation(g, HOME, HOME)).toBe(false);
    expect(gameNeedsMyConfirmation(g, AWAY, HOME)).toBe(false);
  });

  it('does NOT prompt when the opponent has not confirmed yet (nothing to verify)', () => {
    // winner set but neither side has confirmed — not the handoff state
    const g = game({ winner_player_id: 'p1' });
    expect(gameNeedsMyConfirmation(g, HOME, HOME)).toBe(false);
    expect(gameNeedsMyConfirmation(g, AWAY, HOME)).toBe(false);
  });
});

describe('buildConfirmationItem', () => {
  const players: Map<string, Player> = new Map([
    ['p1', { id: 'p1', first_name: 'John', last_name: 'Doe', nickname: 'Johnny' }],
  ]);

  it('forwards every scored field and resolves the winner nickname', () => {
    const g = game({
      game_number: 7,
      winner_player_id: 'p1',
      break_and_run: true,
      win_by_forfeit: false,
      winner_value: 10,
      loser_value: 4,
    });

    const item = buildConfirmationItem(g, players);
    expect(item).toMatchObject({
      gameNumber: 7,
      winnerPlayerName: 'Johnny',
      breakAndRun: true,
      winByForfeit: false,
      winnerValue: 10,
      loserValue: 4,
    });
  });
});
