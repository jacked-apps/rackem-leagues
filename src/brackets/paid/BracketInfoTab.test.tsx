/**
 * @fileoverview Tests for BracketInfoTab — editing a tournament before it starts.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { BracketInfoTab } from './BracketInfoTab';
import type { BracketSettings } from '@/api/mutations/brackets';

function settings(over: Partial<BracketSettings> = {}): BracketSettings {
  return {
    name: 'Friday 9-Ball',
    format: 'double_elimination',
    grandFinalReset: true,
    gameType: 'nine_ball',
    ...over,
  };
}

describe('BracketInfoTab', () => {
  it('shows the tournament as it stands', () => {
    renderWithProviders(<BracketInfoTab settings={settings()} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Tournament name')).toHaveValue('Friday 9-Ball');
  });

  it('saves nothing until something actually changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(<BracketInfoTab settings={settings()} onSave={onSave} />);

    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();

    await user.type(screen.getByLabelText('Tournament name'), ' Open');
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
  });

  it('saves the edited name', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<BracketInfoTab settings={settings()} onSave={onSave} />);

    await user.clear(screen.getByLabelText('Tournament name'));
    await user.type(screen.getByLabelText('Tournament name'), 'Saturday 8-Ball');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Saturday 8-Ball' })
    );
  });

  it('will not save an empty name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BracketInfoTab settings={settings()} onSave={vi.fn()} />);

    await user.clear(screen.getByLabelText('Tournament name'));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('offers the grand-final rule for double elimination', () => {
    renderWithProviders(<BracketInfoTab settings={settings()} onSave={vi.fn()} />);
    expect(screen.getByLabelText(/beaten twice/i)).toBeTruthy();
  });

  it('does not offer it where it cannot apply', () => {
    renderWithProviders(
      <BracketInfoTab settings={settings({ format: 'single_elimination' })} onSave={vi.fn()} />
    );
    expect(screen.queryByLabelText(/beaten twice/i)).toBeNull();
  });

  it('keeps a half-typed edit when the tournament refreshes underneath', () => {
    // The setup page has realtime on the player list, which refetches the
    // bracket too. Resetting the draft on every refresh would delete whatever
    // the organizer was in the middle of typing.
    const { rerender } = renderWithProviders(
      <BracketInfoTab settings={settings()} onSave={vi.fn()} />
    );
    const input = screen.getByLabelText('Tournament name') as HTMLInputElement;
    input.focus();

    rerender(<BracketInfoTab settings={settings()} onSave={vi.fn()} />);
    expect(screen.getByLabelText('Tournament name')).toHaveValue('Friday 9-Ball');
  });
});
