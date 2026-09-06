/**
 * @fileoverview Tests for PastPlayerMenu — the past-player row's action menu.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { PastPlayerMenu } from './PastPlayerMenu';
import type { RosterRow } from './hopperGroups';

function row(kind: 'registered' | 'walkup'): RosterRow {
  return {
    key: kind === 'registered' ? 'm-kenny' : 'walkup:rocket',
    player: {} as RosterRow['player'],
    identity: {
      kind,
      displayName: kind === 'registered' ? 'Kenny' : 'Rocket',
      playerNumber: kind === 'registered' ? 333 : null,
      home: kind === 'registered' ? 'Erie, PA' : null,
    },
    duplicateName: false,
  };
}

describe('PastPlayerMenu', () => {
  it('adds the player from its menu', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderWithProviders(
      <PastPlayerMenu row={row('registered')} onAdd={onAdd} onForget={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Kenny/ }));
    await user.click(await screen.findByText('Add to this tournament'));

    expect(onAdd).toHaveBeenCalled();
  });

  it('makes forgetting take a second, confirming tap', async () => {
    const user = userEvent.setup();
    const onForget = vi.fn();
    renderWithProviders(
      <PastPlayerMenu row={row('registered')} onAdd={vi.fn()} onForget={onForget} />
    );

    await user.click(screen.getByRole('button', { name: /Kenny/ }));
    await user.click(await screen.findByText('Forget this player'));

    // The menu item alone must not remove anyone.
    expect(onForget).not.toHaveBeenCalled();
    expect(await screen.findByText('Forget Kenny?')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Forget' }));
    expect(onForget).toHaveBeenCalled();
  });

  it('promises a registered player that their tournaments are untouched', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PastPlayerMenu row={row('registered')} onAdd={vi.fn()} onForget={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Kenny/ }));
    await user.click(await screen.findByText('Forget this player'));

    expect(screen.getByText(/nothing changes for any tournament/i)).toBeTruthy();
    expect(screen.getByText(/won't be suggested next time/i)).toBeTruthy();
  });

  it('tells a walk-up it is only the saved NAME being dropped', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PastPlayerMenu row={row('walkup')} onAdd={vi.fn()} onForget={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: /Rocket/ }));
    await user.click(await screen.findByText('Forget this player'));

    expect(screen.getByText(/saved name comes off/i)).toBeTruthy();
  });

  it('takes no actions when the tournament has started', async () => {
    renderWithProviders(
      <PastPlayerMenu row={row('registered')} onAdd={vi.fn()} onForget={vi.fn()} disabled />
    );
    expect(screen.getByRole('button', { name: /Kenny/ })).toBeDisabled();
  });
});
