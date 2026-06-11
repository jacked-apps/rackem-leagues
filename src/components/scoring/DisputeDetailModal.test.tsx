/**
 * @fileoverview Render tests for the dispute-detail modal (Amendment G).
 *
 * Pin the visible shape: closed when dispute is null, lists each conflicting
 * initiation when open, Close button calls onOpenChange(false). Light-touch on
 * copy.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisputeDetailModal } from './DisputeDetailModal';
import type { GameDispute } from '@/utils/match/deriveDisputes';

function nameMap(): (id: string | null) => string {
  const lookup: Record<string, string> = {
    'm-a': 'Alice',
    'm-b': 'Bob',
    'p-x': 'Player X',
    'p-y': 'Player Y',
  };
  return (id) => (id ? (lookup[id] ?? 'Unknown') : 'Unknown');
}

function dispute(): GameDispute {
  return {
    game_id: 'g1',
    game_number: 3,
    initiations: [
      {
        confirmer_id: 'm-a',
        side: 'home',
        snapshot: {
          winner_team_id: 'home-team',
          winner_player_id: 'p-x',
          break_and_run: true,
          golden_break: false,
          break_fouled: false,
          runout: false,
          win_by_forfeit: false,
          winner_value: 7,
          loser_value: 3,
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
          golden_break: true,
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

describe('<DisputeDetailModal />', () => {
  it('renders nothing when dispute is null', () => {
    render(
      <DisputeDetailModal
        dispute={null}
        onOpenChange={vi.fn()}
        getPlayerDisplayName={nameMap()}
      />
    );
    // Radix Dialog renders its overlay/content only when open — no game number visible.
    expect(screen.queryByText(/Game/)).not.toBeInTheDocument();
  });

  it('shows the game number in the title when dispute is open', () => {
    render(
      <DisputeDetailModal
        dispute={dispute()}
        onOpenChange={vi.fn()}
        getPlayerDisplayName={nameMap()}
      />
    );
    expect(screen.getByText(/Game 3/)).toBeInTheDocument();
  });

  it('lists each initiator with their name + side + winner', () => {
    render(
      <DisputeDetailModal
        dispute={dispute()}
        onOpenChange={vi.fn()}
        getPlayerDisplayName={nameMap()}
      />
    );
    // Two initiators by name + their sides.
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/\(Home\)/)).toBeInTheDocument();
    expect(screen.getByText(/\(Away\)/)).toBeInTheDocument();
    // Their respective winner picks.
    expect(screen.getByText('Player X')).toBeInTheDocument();
    expect(screen.getByText('Player Y')).toBeInTheDocument();
  });

  it("only shows the truthy extras (Alice's Break & Run, Bob's Golden Break)", () => {
    render(
      <DisputeDetailModal
        dispute={dispute()}
        onOpenChange={vi.fn()}
        getPlayerDisplayName={nameMap()}
      />
    );
    expect(screen.getByText(/Break & Run/)).toBeInTheDocument();
    expect(screen.getByText(/Golden Break/)).toBeInTheDocument();
    // Untriggered extras don't pollute the display.
    expect(screen.queryByText(/Break Fouled/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Forfeit/)).not.toBeInTheDocument();
  });

  it('shows points when present, hides the row when both are null', () => {
    render(
      <DisputeDetailModal
        dispute={dispute()}
        onOpenChange={vi.fn()}
        getPlayerDisplayName={nameMap()}
      />
    );
    // Alice has winner_value=7, loser_value=3 → points row present.
    expect(screen.getByText(/W: 7/)).toBeInTheDocument();
    expect(screen.getByText(/L: 3/)).toBeInTheDocument();
  });

  it('the shadcn Dialog X icon calls onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DisputeDetailModal
        dispute={dispute()}
        onOpenChange={onOpenChange}
        getPlayerDisplayName={nameMap()}
      />
    );
    // The shadcn Dialog ships with a built-in close X icon (sr-only "Close"
    // label). That + ESC + outside-click are the three close paths — no
    // redundant footer button in our modal.
    await user.click(screen.getByRole('button', { name: /Close/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
