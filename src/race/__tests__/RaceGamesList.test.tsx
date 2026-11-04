/**
 * @fileoverview Tests for the race games list — the component that makes the
 * linear rule visible.
 *
 * A race is two people at one table, so games happen in order and come undone
 * in order: to fix game 3 of 5 you vacate 5, then 4, then 3. The server
 * enforces that, but the list is where a player meets it, and the way they meet
 * it is that Vacate exists on exactly one row.
 *
 * These tests exist because the button placement IS the rule as far as a player
 * is concerned. If Vacate ever appeared on a middle game, the server would
 * refuse it and the player would just see a failure they could not explain.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { RaceGamesList } from '../RaceGamesList';
import type { Race, RaceGame, RaceSeat } from '../types';

const HOME_ID = 'home-member';
const AWAY_ID = 'away-member';

const home: RaceSeat = { memberId: HOME_ID, side: 'home', displayName: 'Ace', goal: 5 };
const away: RaceSeat = { memberId: AWAY_ID, side: 'away', displayName: 'Bee', goal: 5 };

const race = {
  id: 'race-1',
  home_member_id: HOME_ID,
  away_member_id: AWAY_ID,
  goal_home: 5,
  goal_away: 5,
  break_rule: 'alternate',
  game_type: 'eight_ball',
  status: 'in_play',
  winner_player_id: null,
  first_breaker_side: 'home',
} as unknown as Race;

/** A game with a result both players agreed to. */
function settled(n: number, winnerId: string): RaceGame {
  return {
    id: `g${n}`,
    race_id: 'race-1',
    game_number: n,
    home_action: n % 2 === 1 ? 'breaks' : 'racks',
    away_action: n % 2 === 1 ? 'racks' : 'breaks',
    game_type: 'eight_ball',
    winner_player_id: winnerId,
    winner_team_id: null,
    break_and_run: false,
    golden_break: false,
    break_fouled: false,
    runout: false,
    win_by_forfeit: false,
    winner_value: null,
    loser_value: null,
    confirmed_by_home: HOME_ID,
    confirmed_by_away: AWAY_ID,
    confirmed_at: '2026-09-10T00:00:00Z',
    vacate_requested_by: null,
    created_at: '2026-09-10T00:00:00Z',
    updated_at: '2026-09-10T00:00:00Z',
  } as unknown as RaceGame;
}

/** A game that exists but has not been played yet. */
function empty(n: number): RaceGame {
  return { ...settled(n, HOME_ID), winner_player_id: null, confirmed_by_home: null, confirmed_by_away: null } as RaceGame;
}

function renderList(overrides: Partial<React.ComponentProps<typeof RaceGamesList>> = {}) {
  const props = {
    race,
    games: [settled(1, HOME_ID), settled(2, AWAY_ID), settled(3, HOME_ID), empty(4)],
    home,
    away,
    activeGameNumber: 4,
    vacatableGameNumber: 3,
    isPlayer: true,
    onScore: vi.fn(),
    onVacate: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<RaceGamesList {...props} />);
  return props;
}

describe('RaceGamesList', () => {
  it('offers Vacate on exactly one game — the last one played', () => {
    renderList();
    // Three games have results, but only game 3 can come off.
    expect(screen.getAllByRole('button', { name: /vacate/i })).toHaveLength(1);
  });

  it('vacates the game it is shown against', () => {
    const { onVacate } = renderList();
    screen.getByRole('button', { name: /vacate/i }).click();
    expect(onVacate).toHaveBeenCalledWith(3);
  });

  it('draws the league columns: Break, vs, Rack', () => {
    renderList();
    expect(screen.getByText('Break')).toBeInTheDocument();
    expect(screen.getByText('Rack')).toBeInTheDocument();
  });

  it('puts the breaker on the left of the game being played', () => {
    // Game 4 is an even game, so under alternate the AWAY player breaks it.
    renderList();
    const [left, right] = screen.getAllByRole('button').filter((b) => /^(Ace|Bee)$/.test(b.textContent ?? ''));
    expect(left).toHaveTextContent('Bee');
    expect(right).toHaveTextContent('Ace');
  });

  it('passes whether the winner was the one who broke', () => {
    const { onScore } = renderList();
    screen.getByRole('button', { name: 'Bee' }).click();
    expect(onScore).toHaveBeenCalledWith(4, away, true);

    screen.getByRole('button', { name: 'Ace' }).click();
    expect(onScore).toHaveBeenLastCalledWith(4, home, false);
  });

  it('marks agreed winners with a trophy, not colour alone', () => {
    renderList();
    expect(screen.getAllByText('🏆')).toHaveLength(3);
  });

  it('gives a spectator no working buttons', () => {
    const { onScore } = renderList({ isPlayer: false });
    for (const b of screen.queryAllByRole('button')) expect(b).toBeDisabled();
    expect(screen.queryByRole('button', { name: /vacate/i })).not.toBeInTheDocument();
    expect(onScore).not.toHaveBeenCalled();
  });

  it('offers Confirm on the pending game waiting on this viewer', () => {
    const halfAgreed = { ...settled(1, HOME_ID), confirmed_by_away: null } as RaceGame;
    const onConfirm = vi.fn();
    renderList({ games: [halfAgreed], activeGameNumber: null, vacatableGameNumber: 1, awaitingGameNumber: 1, onConfirm });
    // A pending result has no trophy yet.
    expect(screen.queryByText('🏆')).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Confirm' }).click();
    expect(onConfirm).toHaveBeenCalledWith(1);
  });

  it('offers Vacate instead when the pending game waits on the other player', () => {
    const halfAgreed = { ...settled(1, HOME_ID), confirmed_by_away: null } as RaceGame;
    renderList({ games: [halfAgreed], activeGameNumber: null, vacatableGameNumber: 1 });
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vacate/i })).toBeInTheDocument();
  });

  it('says so when no game exists yet', () => {
    renderList({ games: [], activeGameNumber: null, vacatableGameNumber: null });
    expect(screen.getByText(/No games yet/)).toBeInTheDocument();
  });
});
