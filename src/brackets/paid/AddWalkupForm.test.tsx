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

  it('puts focus back in the box so a list can be typed straight through', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<AddWalkupForm onAdd={onAdd} />);

    const input = screen.getByLabelText('Add a player');
    await user.type(input, 'Rocket{Enter}');

    // type-enter-type-enter, not type-enter-reach-for-the-box.
    await waitFor(() => expect(input).toHaveValue(''));
    expect(input).toHaveFocus();
  });

  it('returns focus after the BUTTON too, not just Enter', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<AddWalkupForm onAdd={onAdd} />);

    const input = screen.getByLabelText('Add a player');
    await user.type(input, 'Rocket');
    await user.click(screen.getByRole('button', { name: /add this name/i }));

    // Clicking leaves focus on the button; it has to come back by itself.
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('waits for the box to be re-enabled before taking the cursor back', async () => {
    // The parent disables this form while an add is in flight, and a disabled
    // input silently refuses focus. Held until it can actually take it.
    const user = userEvent.setup();
    let resolveAdd: () => void = () => {};
    const onAdd = vi.fn(() => new Promise<void>((r) => (resolveAdd = r)));

    const { rerender } = renderWithProviders(
      <AddWalkupForm onAdd={onAdd} disabled={false} />
    );
    const input = screen.getByLabelText('Add a player');
    await user.type(input, 'Rocket');
    // Via the BUTTON, so focus genuinely starts somewhere else.
    await user.click(screen.getByRole('button', { name: /add this name/i }));

    // Save in flight: the parent locks the form.
    rerender(<AddWalkupForm onAdd={onAdd} disabled />);
    resolveAdd();
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(input).not.toHaveFocus(); // a disabled box cannot take it

    // Save done, form unlocked — now the cursor comes back.
    rerender(<AddWalkupForm onAdd={onAdd} disabled={false} />);
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('leaves focus alone when the add failed, next to the reason', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockRejectedValue(new Error('nope'));
    renderWithProviders(<AddWalkupForm onAdd={onAdd} />);

    const input = screen.getByLabelText('Add a player');
    await user.type(input, 'Rocket{Enter}');

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(input).toHaveValue('Rocket');
  });
});
