/**
 * @fileoverview Render tests for the dispute banner (many-eyes Amendment F).
 *
 * Light-touch — the component is a styled Alert with a list. Pin the visible
 * structure (renders nothing for empty, lists each game, becomes interactive
 * when handler is provided) without locking copy.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisputeBanner } from './DisputeBanner';
import type { GameDispute } from '@/utils/match/deriveDisputes';

function makeDispute(game_number: number, game_id?: string): GameDispute {
  return {
    game_id: game_id ?? `g${game_number}`,
    game_number,
    initiations: [
      {
        confirmer_id: 'm-a',
        side: 'home',
        snapshot: {
          winner_team_id: 'home-team',
          winner_player_id: 'p-x',
          break_and_run: false,
          golden_break: false,
          break_fouled: false,
          runout: false,
          win_by_forfeit: false,
          winner_value: null,
          loser_value: null,
        },
        created_at: '2026-05-26T12:00:00.000Z',
      },
      {
        confirmer_id: 'm-b',
        side: 'away',
        snapshot: {
          winner_team_id: 'away-team',
          winner_player_id: 'p-y',
          break_and_run: false,
          golden_break: false,
          break_fouled: false,
          runout: false,
          win_by_forfeit: false,
          winner_value: null,
          loser_value: null,
        },
        created_at: '2026-05-26T12:00:05.000Z',
      },
    ],
  };
}

describe('<DisputeBanner />', () => {
  it('renders nothing when there are no disputes (no residual chrome)', () => {
    const { container } = render(<DisputeBanner disputes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single dispute with the game number', () => {
    render(<DisputeBanner disputes={[makeDispute(3)]} />);
    expect(screen.getByText(/Game 3/)).toBeInTheDocument();
  });

  it('lists multiple disputed games', () => {
    render(<DisputeBanner disputes={[makeDispute(3), makeDispute(5), makeDispute(8)]} />);
    expect(screen.getByText(/Game 3/)).toBeInTheDocument();
    expect(screen.getByText(/Game 5/)).toBeInTheDocument();
    expect(screen.getByText(/Game 8/)).toBeInTheDocument();
  });

  it('rows are inert text when no onDisputeClick is provided (Amendment F alone)', () => {
    render(<DisputeBanner disputes={[makeDispute(3)]} />);
    // No clickable button surface for the row.
    expect(screen.queryByRole('button', { name: /Game 3/ })).not.toBeInTheDocument();
  });

  it('rows are tappable buttons when onDisputeClick is provided (Amendment G wiring)', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <DisputeBanner disputes={[makeDispute(3, 'game-3-id')]} onDisputeClick={onClick} />
    );
    await user.click(screen.getByRole('button', { name: /Game 3/ }));
    expect(onClick).toHaveBeenCalledWith('game-3-id');
  });
});
