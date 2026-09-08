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

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Rocket' })
    );
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

  describe('the two switches', () => {
    it('sends them to the waiting room by default', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<AddWalkupForm onAdd={onAdd} />);

      await user.type(screen.getByLabelText('Add a player'), 'Rocket{Enter}');
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ admit: false })
      );
    });

    it('puts them straight in when asked', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<AddWalkupForm onAdd={onAdd} />);

      await user.click(screen.getByLabelText(/tournament entry|waiting room/i));
      await user.type(screen.getByLabelText('Add a player'), 'Rocket{Enter}');

      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ admit: true }));
    });

    it('keeps the switches set between adds', async () => {
      // A list of people is one decision, not one per name.
      const user = userEvent.setup();
      const onAdd = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<AddWalkupForm onAdd={onAdd} trackEntryFees />);

      await user.click(screen.getByLabelText(/tournament entry|waiting room/i));
      await user.click(screen.getByLabelText(/entry fee paid/i));
      await user.type(screen.getByLabelText('Add a player'), 'Rocket{Enter}');
      await user.type(screen.getByLabelText('Add a player'), 'Slim{Enter}');

      expect(onAdd).toHaveBeenNthCalledWith(2, {
        displayName: 'Slim',
        admit: true,
        paidStatus: 'paid',
      });
    });

    it('SHOWS the fee box even without the tracker — a hidden feature sells nothing', () => {
      renderWithProviders(<AddWalkupForm onAdd={vi.fn()} />);
      expect(screen.getByLabelText(/entry fee paid/i)).toBeTruthy();
      expect(screen.getByText(/add-on/i)).toBeTruthy();
    });

    it('offers the feature instead of ticking, and ticks once bought', async () => {
      const user = userEvent.setup();
      const onRequestEntryFees = vi.fn().mockResolvedValue(true);
      renderWithProviders(
        <AddWalkupForm onAdd={vi.fn()} onRequestEntryFees={onRequestEntryFees} />
      );

      const box = screen.getByLabelText(/entry fee paid/i);
      await user.click(box);

      expect(onRequestEntryFees).toHaveBeenCalled();
      await waitFor(() => expect(box.getAttribute('data-state')).toBe('checked'));
    });

    it('leaves the box alone when the offer is declined', async () => {
      // A curious tap must cost nothing.
      const user = userEvent.setup();
      const onRequestEntryFees = vi.fn().mockResolvedValue(false);
      renderWithProviders(
        <AddWalkupForm onAdd={vi.fn()} onRequestEntryFees={onRequestEntryFees} />
      );

      const box = screen.getByLabelText(/entry fee paid/i);
      await user.click(box);

      await waitFor(() => expect(onRequestEntryFees).toHaveBeenCalled());
      expect(box.getAttribute('data-state')).toBe('unchecked');
    });

    it('does not offer the feature to a tournament that already has it', async () => {
      const user = userEvent.setup();
      const onRequestEntryFees = vi.fn();
      renderWithProviders(
        <AddWalkupForm onAdd={vi.fn()} trackEntryFees onRequestEntryFees={onRequestEntryFees} />
      );

      await user.click(screen.getByLabelText(/tournament entry|waiting room/i));
      await user.click(screen.getByLabelText(/entry fee paid/i));

      expect(onRequestEntryFees).not.toHaveBeenCalled();
    });

    it('names the state it is in, not what ticking it would do', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddWalkupForm onAdd={vi.fn()} />);

      // Reads as the answer at a glance, rather than an instruction.
      expect(screen.getByLabelText('Waiting room')).toBeTruthy();
      await user.click(screen.getByLabelText('Waiting room'));
      expect(screen.getByLabelText('Tournament entry')).toBeTruthy();
    });

    it('explains both destinations behind the info button, not in the form', () => {
      renderWithProviders(<AddWalkupForm onAdd={vi.fn()} />);
      // The long explanation lives in the popup; the form itself stays short.
      expect(screen.queryByText(/holds them until you add them/i)).toBeNull();
      expect(screen.getByRole('button', { name: /more information: where does this player go/i })).toBeTruthy();
    });

    it('will not mark a waiting player paid — there is nothing to pay for yet', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddWalkupForm onAdd={vi.fn()} trackEntryFees />);

      expect(screen.getByLabelText(/entry fee paid/i)).toBeDisabled();
      await user.click(screen.getByLabelText(/tournament entry|waiting room/i));
      expect(screen.getByLabelText(/entry fee paid/i)).not.toBeDisabled();
    });
  });
});
