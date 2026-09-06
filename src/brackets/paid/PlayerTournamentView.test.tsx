/**
 * @fileoverview Tests for PlayerTournamentView — what a player sees while a
 * tournament fills up.
 *
 * The privacy rule is the one that matters: this page is reachable from a code
 * taped to a wall, so it may show the viewer their OWN entry fee and nobody
 * else's.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { PlayerTournamentView } from './PlayerTournamentView';
import type { BracketPlayerView } from '@/api/queries/brackets';

function view(over: Partial<BracketPlayerView> = {}): BracketPlayerView {
  return {
    found: true,
    bracket: {
      id: 'b1',
      name: 'Friday 9-Ball',
      status: 'setup',
      format: 'double_elimination',
      grand_final_reset: true,
      game_type: 'nine_ball',
      premium_features: ['real_players', 'payment_tracker'],
    },
    waiting: ['Slim', 'Doc'],
    official: ['Mike', 'Sara'],
    me: null,
    participants: [],
    matches: [],
    ...over,
  };
}

describe('PlayerTournamentView', () => {
  it('shows who is in and who is waiting, with counts', () => {
    renderWithProviders(<PlayerTournamentView view={view()} />);

    expect(screen.getByText('In the tournament (2)')).toBeTruthy();
    expect(screen.getByText('Waiting to be added (2)')).toBeTruthy();
    expect(screen.getByText('Mike')).toBeTruthy();
    expect(screen.getByText('Slim')).toBeTruthy();
  });

  it('says the bracket has not been drawn yet', () => {
    renderWithProviders(<PlayerTournamentView view={view()} />);
    expect(screen.getByText(/hasn't been drawn yet/i)).toBeTruthy();
  });

  it('tells the player where they stand', () => {
    renderWithProviders(
      <PlayerTournamentView
        view={view({ me: { display_name: 'Tim P', status: 'hopper', paid_status: null } })}
      />
    );

    expect(screen.getByText(/you're on the waiting list as tim p/i)).toBeTruthy();
    expect(screen.getByText(/organizer will add you/i)).toBeTruthy();
  });

  it('shows the viewer their OWN unpaid entry fee', () => {
    renderWithProviders(
      <PlayerTournamentView
        view={view({
          me: { display_name: 'Tim P', status: 'official', paid_status: 'unpaid' },
        })}
      />
    );
    expect(screen.getByText(/your entry fee is not marked paid/i)).toBeTruthy();
  });

  it('never shows an entry-fee line for anyone but the viewer', () => {
    // Everyone else is a bare name — this page is on a wall.
    renderWithProviders(
      <PlayerTournamentView
        view={view({
          me: { display_name: 'Tim P', status: 'official', paid_status: 'paid' },
        })}
      />
    );

    expect(screen.getAllByText(/entry fee/i)).toHaveLength(1);
    expect(screen.queryByText(/unpaid/i)).toBeNull();
  });

  it('says nothing about fees when the tournament does not track them', () => {
    renderWithProviders(
      <PlayerTournamentView
        view={view({
          bracket: { ...view().bracket!, premium_features: ['real_players'] },
          me: { display_name: 'Tim P', status: 'official', paid_status: 'unpaid' },
        })}
      />
    );
    expect(screen.queryByText(/entry fee/i)).toBeNull();
  });

  it('tells the player what they are playing', () => {
    renderWithProviders(<PlayerTournamentView view={view()} />);

    expect(screen.getByText('Double elimination')).toBeTruthy();
    expect(screen.getByText('Two losses')).toBeTruthy();
    expect(screen.getByText('9-ball')).toBeTruthy();
  });
});
