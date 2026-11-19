/**
 * @fileoverview Double-tap guard on the opponent-confirmation dialog.
 *
 * Room Race keeps this dialog open until its save lands, so a second tap used
 * to send the answer again (two confirms, or a game reversed twice), and a tap
 * on the other button could send the opposite answer. While a returned save is
 * pending, both answer buttons must be locked. A caller that returns nothing
 * (league scoring closes at once) must still close straight away.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils';
import { ConfirmationDialog } from '../ConfirmationDialog';

const GAME = {
  gameNumber: 3,
  winnerPlayerName: 'Dana',
  breakAndRun: false,
  goldenBreak: false,
  earlyEight: false,
  breakFouled: false,
  runout: false,
  winByForfeit: false,
  winnerValue: null,
  loserValue: null,
};

/** A save the test finishes by hand. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function renderDialog(props: { onConfirm?: () => unknown; onDeny?: () => unknown; onClose?: () => void }) {
  renderWithProviders(
    <ConfirmationDialog
      open
      game={GAME}
      gameType="8-ball"
      onConfirm={props.onConfirm ?? vi.fn()}
      onDeny={props.onDeny ?? vi.fn()}
      onDismiss={vi.fn()}
      onClose={props.onClose ?? vi.fn()}
    />
  );
}

describe('ConfirmationDialog double-tap guard', () => {
  it('sends Confirm once and locks Deny until the save lands', async () => {
    const save = deferred();
    const onConfirm = vi.fn(() => save.promise);
    const onDeny = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onConfirm, onDeny, onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    fireEvent.click(screen.getByRole('button', { name: /deny/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDeny).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /deny/i })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    save.resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('sends Deny once and locks Confirm until the save lands', async () => {
    const save = deferred();
    const onConfirm = vi.fn();
    const onDeny = vi.fn(() => save.promise);
    renderDialog({ onConfirm, onDeny });

    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    fireEvent.click(screen.getByRole('button', { name: /deny/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onDeny).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    save.resolve();
  });

  it('still closes at once for a caller that returns nothing', async () => {
    const onClose = vi.fn();
    renderDialog({ onConfirm: () => undefined, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
