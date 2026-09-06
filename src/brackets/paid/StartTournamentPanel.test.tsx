/**
 * @fileoverview Tests for StartTournamentPanel — the Start control + the
 * "also add the waiting room" checkbox.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/utils';
import { StartTournamentPanel } from './StartTournamentPanel';

/** Defaults for a startable tournament; spread overrides per test. */
function props(over: Record<string, unknown> = {}) {
  return {
    officialCount: 4,
    waitingCount: 2,
    includeWaiting: false,
    onIncludeWaitingChange: vi.fn(),
    onStart: vi.fn(),
    starting: false,
    priceLabel: null,
    trackEntryFees: true,
    ...over,
  };
}

describe('StartTournamentPanel', () => {
  it('offers the waiting room by its count, unchecked', () => {
    renderWithProviders(<StartTournamentPanel {...props()} />);

    const checkbox = screen.getByLabelText('Also add the 2 still waiting, as unpaid');
    expect(checkbox).toBeTruthy();
    expect(checkbox.getAttribute('data-state')).toBe('unchecked');
  });

  it('hides the offer entirely when nobody is waiting', () => {
    renderWithProviders(<StartTournamentPanel {...props({ waitingCount: 0 })} />);
    expect(screen.queryByText(/still waiting/i)).toBeNull();
  });

  it('counts only the official list until the waiting room is included', () => {
    const { rerender } = renderWithProviders(<StartTournamentPanel {...props()} />);
    expect(screen.getByText('Starting with 4 players.')).toBeTruthy();

    rerender(<StartTournamentPanel {...props({ includeWaiting: true })} />);
    expect(screen.getByText('Starting with 6 players.')).toBeTruthy();
  });

  it('reports the checkbox change rather than acting on it', () => {
    const onIncludeWaitingChange = vi.fn();
    renderWithProviders(<StartTournamentPanel {...props({ onIncludeWaitingChange })} />);

    fireEvent.click(screen.getByLabelText('Also add the 2 still waiting, as unpaid'));
    expect(onIncludeWaitingChange).toHaveBeenCalledWith(true);
  });

  it('will not start below two players, and says why', () => {
    renderWithProviders(
      <StartTournamentPanel {...props({ officialCount: 1, waitingCount: 0 })} />
    );

    expect(screen.getByText('Add at least 2 players before starting.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start tournament' })).toBeDisabled();
  });

  it('lets the waiting room make up the minimum', () => {
    renderWithProviders(
      <StartTournamentPanel
        {...props({ officialCount: 1, waitingCount: 3, includeWaiting: true })}
      />
    );
    expect(screen.getByRole('button', { name: 'Start tournament' })).not.toBeDisabled();
  });

  it('names the price when premium features are being charged at start', () => {
    renderWithProviders(<StartTournamentPanel {...props({ priceLabel: '$5' })} />);
    expect(screen.getByRole('button', { name: 'Start & pay $5' })).toBeTruthy();
  });

  it('starts on tap', () => {
    const onStart = vi.fn();
    renderWithProviders(<StartTournamentPanel {...props({ onStart })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start tournament' }));
    expect(onStart).toHaveBeenCalled();
  });

  it('says nothing about payment without the entry-fee tracker', () => {
    renderWithProviders(<StartTournamentPanel {...props({ trackEntryFees: false })} />);

    expect(screen.getByLabelText('Also add the 2 still waiting')).toBeTruthy();
    expect(screen.queryByText(/unpaid/i)).toBeNull();
  });
});
