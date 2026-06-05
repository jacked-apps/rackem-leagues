/**
 * @fileoverview Render tests for the peek-and-confirm dialog (Unit 6).
 *
 * Pin the visible shape: closed when gameNumber is null, shows winner +
 * achievements + points (when present), Confirm button hidden when already
 * vouched, Confirm fires the callback, X icon closes via onOpenChange.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeekConfirmDialog } from './PeekConfirmDialog';
import type { ResultLike } from '@/utils/match/deriveDissents';

const baseRecorded: ResultLike = {
  winner_team_id: 'home',
  winner_player_id: 'p-x',
  break_and_run: false,
  golden_break: false,
  break_fouled: false,
  runout: false,
  win_by_forfeit: false,
  winner_value: null,
  loser_value: null,
};

describe('<PeekConfirmDialog />', () => {
  it('renders nothing when gameNumber is null', () => {
    render(
      <PeekConfirmDialog
        gameNumber={null}
        winnerPlayerName="Alice"
        recordedResult={baseRecorded}
        alreadyVouched={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByText(/Game/)).not.toBeInTheDocument();
  });

  it('shows the game number, winner name, and "none" for empty achievements', () => {
    render(
      <PeekConfirmDialog
        gameNumber={3}
        winnerPlayerName="Alice"
        recordedResult={baseRecorded}
        alreadyVouched={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/Game 3/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // "none" placeholder for empty achievements.
    expect(screen.getByText('none')).toBeInTheDocument();
  });

  it('lists truthy achievements only', () => {
    render(
      <PeekConfirmDialog
        gameNumber={1}
        winnerPlayerName="Alice"
        recordedResult={{ ...baseRecorded, break_and_run: true, golden_break: true }}
        alreadyVouched={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/Break & Run/)).toBeInTheDocument();
    expect(screen.getByText(/Golden Break/)).toBeInTheDocument();
    expect(screen.queryByText(/Break Fouled/)).not.toBeInTheDocument();
  });

  it('shows points row when winner_value/loser_value are set', () => {
    render(
      <PeekConfirmDialog
        gameNumber={1}
        winnerPlayerName="Alice"
        recordedResult={{ ...baseRecorded, winner_value: 7, loser_value: 3 }}
        alreadyVouched={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/Points:/)).toBeInTheDocument();
    expect(screen.getByText(/W: 7/)).toBeInTheDocument();
    expect(screen.getByText(/L: 3/)).toBeInTheDocument();
  });

  it('hides the Confirm button and shows "already vouched" note when alreadyVouched=true', () => {
    render(
      <PeekConfirmDialog
        gameNumber={1}
        winnerPlayerName="Alice"
        recordedResult={baseRecorded}
        alreadyVouched={true}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /^Confirm$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/already vouched/i)).toBeInTheDocument();
  });

  it('Confirm button calls onConfirm', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <PeekConfirmDialog
        gameNumber={1}
        winnerPlayerName="Alice"
        recordedResult={baseRecorded}
        alreadyVouched={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole('button', { name: /^Confirm$/ }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('the shadcn Dialog X icon calls onOpenChange(false)', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PeekConfirmDialog
        gameNumber={1}
        winnerPlayerName="Alice"
        recordedResult={baseRecorded}
        alreadyVouched={false}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />
    );
    // No redundant footer Close button — the shadcn Dialog ships with a
    // built-in X icon (sr-only "Close" label) + ESC + outside-click are
    // the close paths. Same pattern as DisputeDetailModal.
    await user.click(screen.getByRole('button', { name: /Close/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
