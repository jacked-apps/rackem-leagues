/**
 * @fileoverview Double-tap guard on Save Game.
 *
 * Match scoring used to throw its save's promise away, so Save Game stayed
 * tappable while the save was in flight and a double tap on slow bar wifi
 * could score the same game twice. The dialog's contract: when onConfirm
 * returns a promise, Save Game is disabled until it settles.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils';
import { ScoringDialog } from '../ScoringDialog';

describe('ScoringDialog Save Game double-tap guard', () => {
  it('saves once and stays disabled until the save lands', async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (finish = r)));
    renderWithProviders(
      <ScoringDialog
        open
        game={{ gameNumber: 1, winnerPlayerName: 'Dana', winnerWasScheduledBreaker: false }}
        breakAndRun={false}
        goldenBreak={false}
        goldenBreakCountsAsWin
        gameType="8-ball"
        onBreakAndRunChange={vi.fn()}
        onGoldenBreakChange={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const save = screen.getByRole('button', { name: /save game/i });
    fireEvent.click(save);
    fireEvent.click(screen.getByRole('button', { name: /sav/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /sav/i })).toBeDisabled();

    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: /save game/i })).toBeEnabled());
  });
});
