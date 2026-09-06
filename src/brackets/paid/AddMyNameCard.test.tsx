/**
 * @fileoverview Tests for AddMyNameCard — the accountless player's way onto the list.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { AddMyNameCard } from './AddMyNameCard';

describe('AddMyNameCard', () => {
  it('submits a trimmed name', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(null);
    renderWithProviders(<AddMyNameCard onAdd={onAdd} redirectPath="/brackets/join/jt-1" />);

    await user.type(screen.getByLabelText('Add my name'), '  Rocket  ');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledWith('Rocket');
  });

  it('shows a rejection next to the box rather than as a toast', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue('Rocket is already on this list — try another name.');
    renderWithProviders(<AddMyNameCard onAdd={onAdd} redirectPath="/brackets/join/jt-1" />);

    await user.type(screen.getByLabelText('Add my name'), 'Rocket');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    // They have to retype here, so the reason belongs here.
    expect(await screen.findByText(/already on this list/i)).toBeTruthy();
    expect(screen.getByLabelText('Add my name')).toHaveValue('Rocket');
  });

  it('caps the name at 12 characters in the box as well as the database', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddMyNameCard onAdd={vi.fn()} redirectPath="/x" />);

    const input = screen.getByLabelText('Add my name');
    await user.type(input, 'ThisNameIsFarTooLong');
    expect((input as HTMLInputElement).value).toHaveLength(12);
  });

  it('will not submit an empty name', () => {
    renderWithProviders(<AddMyNameCard onAdd={vi.fn()} redirectPath="/x" />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('offers sign-in as the other door, returning to this tournament', () => {
    renderWithProviders(
      <AddMyNameCard onAdd={vi.fn()} redirectPath="/brackets/join/jt-1" />
    );

    expect(
      screen.getByRole('link', { name: /sign in/i }).getAttribute('href')
    ).toBe('/login?redirect=%2Fbrackets%2Fjoin%2Fjt-1');
  });
});
