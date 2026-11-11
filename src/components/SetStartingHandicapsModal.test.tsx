/**
 * @fileoverview Tests for SetStartingHandicapsModal (extracted from
 * PlayerNameLink). Pins the behaviour it carried over: pre-fill from the
 * current values (or defaults), the 5v5 range check, and a valid save that
 * writes the numbers, toasts and closes.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils';

const { toastMock, updateMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn() } as { success: Mock; error: Mock },
  updateMock: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/api/queries/players', () => ({
  updatePlayerStartingHandicaps: (...args: unknown[]) => updateMock(...args),
}));

import { SetStartingHandicapsModal } from './SetStartingHandicapsModal';

function renderModal(props: Partial<React.ComponentProps<typeof SetStartingHandicapsModal>> = {}) {
  const onOpenChange = vi.fn();
  renderWithProviders(
    <SetStartingHandicapsModal
      open
      onOpenChange={onOpenChange}
      playerId="p1"
      playerName="Ben"
      {...props}
    />
  );
  return { onOpenChange };
}

const fiveVFive = () => screen.getByLabelText(/Starting Handicap \(5v5\)/) as HTMLInputElement;

describe('SetStartingHandicapsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue(undefined);
  });

  it('pre-fills from the current values and shows them', () => {
    renderModal({ current3v3: 1, current5v5: 55 });
    expect(fiveVFive().value).toBe('55');
    expect(screen.getByText('Current: 3v3 = 1, 5v5 = 55')).toBeInTheDocument();
  });

  it('falls back to the defaults when nothing is set', () => {
    renderModal({ current3v3: null, current5v5: null });
    expect(fiveVFive().value).toBe('40');
    expect(screen.getByText('Current: 3v3 = Not set, 5v5 = Not set')).toBeInTheDocument();
  });

  it('rejects a 5v5 value over 100 without saving', () => {
    renderModal();
    fireEvent.change(fiveVFive(), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Handicaps' }));
    expect(toastMock.error).toHaveBeenCalledWith('Starting Handicap (5v5) must be between 0 and 100');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('saves valid numbers, toasts, and closes', async () => {
    const { onOpenChange } = renderModal({ current3v3: -1, current5v5: 40 });
    fireEvent.change(fiveVFive(), { target: { value: '62' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Handicaps' }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('p1', -1, 62));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastMock.success).toHaveBeenCalledWith('Starting handicaps set for Ben!');
  });

  it('Cancel closes without saving', () => {
    const { onOpenChange } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
