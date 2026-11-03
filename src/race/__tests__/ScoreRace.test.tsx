/**
 * @fileoverview Tests for the race room's winner-only option (`extras`).
 *
 * A game-room race records only who won. With `extras={false}` the room must
 * send every "how it ended" flag as false — even if the pending result somehow
 * carried one — and with the default it must still pass the dialog's choices
 * through, so the sandbox and tournaments are unchanged.
 *
 * The data and action hooks are mocked; the games list is replaced by a single
 * "score" button so the test drives the real ScoringDialog without a database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { ScoreRace } from '../ScoreRace';
import type { RaceSeat } from '../types';

const home: RaceSeat = { memberId: 'home-member', side: 'home', displayName: 'Ace', goal: 5 };
const away: RaceSeat = { memberId: 'away-member', side: 'away', displayName: 'Bee', goal: 5 };

const recordMutate = vi.fn();
const idle = () => ({ mutate: vi.fn(), isPending: false });

vi.mock('../useRaceView', () => ({
  useRaceView: () => ({
    isLoading: false,
    error: null,
    view: {
      race: {
        id: 'race-1',
        home_member_id: home.memberId,
        away_member_id: away.memberId,
        game_type: '8-ball',
        status: 'in_play',
        winner_player_id: null,
        break_rule: 'alternate',
      },
      home,
      away,
      games: [],
      confirmations: [],
      mySide: 'home',
      homeWon: 0,
      awayWon: 0,
      activeGameNumber: 1,
      vacatableGameNumber: null,
    },
  }),
}));

vi.mock('../useRaceActions', () => ({
  useRaceActions: () => ({
    start: idle(),
    record: { mutate: recordMutate, isPending: false },
    confirm: idle(),
    vacate: idle(),
  }),
}));

// Ace wins game 1 off the break — the case where every breaker extra applies.
vi.mock('../RaceGamesList', () => ({
  RaceGamesList: ({ onScore }: { onScore: (n: number, s: RaceSeat, b: boolean) => void }) => (
    <button onClick={() => onScore(1, home, true)}>score</button>
  ),
}));

const ALL_OFF = {
  breakAndRun: false,
  goldenBreak: false,
  earlyEight: false,
  breakFouled: false,
  runout: false,
};

beforeEach(() => recordMutate.mockClear());

describe('ScoreRace — extras={false} (winner only)', () => {
  it('hides the extras and records every flag false', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScoreRace raceId="race-1" extras={false} />);

    await user.click(screen.getByText('score'));
    expect(screen.queryByLabelText(/break & run/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/break foul/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save game/i }));

    expect(recordMutate).toHaveBeenCalledWith({
      gameNumber: 1,
      winnerPlayerId: home.memberId,
      ...ALL_OFF,
    });
  });
});

describe('ScoreRace — extras default (unchanged)', () => {
  it('offers the extras and passes a ticked one through', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScoreRace raceId="race-1" />);

    await user.click(screen.getByText('score'));
    await user.click(screen.getByLabelText(/break & run/i));
    await user.click(screen.getByRole('button', { name: /save game/i }));

    expect(recordMutate).toHaveBeenCalledWith({
      gameNumber: 1,
      winnerPlayerId: home.memberId,
      ...ALL_OFF,
      breakAndRun: true,
    });
  });
});
