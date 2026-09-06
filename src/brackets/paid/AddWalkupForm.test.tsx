/**
 * @fileoverview Tests for AddWalkupForm — the organizer's type-a-name entry.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils';
import { AddWalkupForm } from './AddWalkupForm';

describe('AddWalkupForm', () => {
  it('adds a trimmed name and clears the box', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<AddWalkupForm onAdd={onAdd} />);

    const input = screen.getByLabelText('Add a player');
    await user.type(input, '  Rocket  ');
    await user.click(screen.getByRole('button', { name: /add this name/i }));

    expect(onAdd).toHaveBeenCalledWith('Rocket');
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('keeps what was typed when the add fails', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockRejectedValue(new Error('nope'));
    renderWithProviders(<AddWalkupForm onAdd={onAdd} />);

    const input = screen.getByLabelText('Add a player');
    await user.type(input, 'Rocket');
    await user.click(screen.getByRole('button', { name: /add this name/i }));

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(input).toHaveValue('Rocket');
  });

  it('will not add an empty or whitespace-only name', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    renderWithProviders(<AddWalkupForm onAdd={onAdd} />);

    expect(screen.getByRole('button', { name: /add this name/i })).toBeDisabled();
    await user.type(screen.getByLabelText('Add a player'), '   ');
    expect(screen.getByRole('button', { name: /add this name/i })).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('takes no input once the tournament has started', () => {
    renderWithProviders(<AddWalkupForm onAdd={vi.fn()} disabled />);
    expect(screen.getByLabelText('Add a player')).toBeDisabled();
  });
});
