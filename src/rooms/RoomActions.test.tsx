/**
 * @fileoverview Tests for the two ways out of a room.
 *
 * The distinction is the whole point: Exit leaves the room running (a plain
 * navigation, no server call), End deletes it and asks first. Everyone gets
 * Exit; only the owner gets End.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mockClose = vi.fn();
vi.mock('@/api/hooks/useRooms', () => ({
  useCloseRoom: () => ({ mutateAsync: mockClose }),
}));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

import { RoomActions } from './RoomActions';

/** Shows where the router ended up, so "did it navigate?" is observable. */
function Probe() {
  return <p>AT {useLocation().pathname}</p>;
}

const renderActions = (isHost: boolean) =>
  render(
    <MemoryRouter initialEntries={['/rooms/r1']}>
      <Routes>
        <Route path="/rooms/:roomId" element={<RoomActions roomId="r1" isHost={isHost} />} />
        <Route path="/rooms" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  mockClose.mockReset().mockResolvedValue({ ok: true });
  toastError.mockReset();
});

describe('RoomActions', () => {
  it('Exit navigates away and never touches the server — the room keeps running', () => {
    renderActions(false);
    fireEvent.click(screen.getByRole('button', { name: 'Exit room' }));
    expect(screen.getByText('AT /rooms')).toBeInTheDocument();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('a guest is offered Exit but never End', () => {
    renderActions(false);
    expect(screen.getByRole('button', { name: 'Exit room' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End room' })).toBeNull();
  });

  it('End asks first, then closes the room and leaves', async () => {
    renderActions(true);
    fireEvent.click(screen.getByRole('button', { name: 'End room' }));

    // Nothing has happened yet — the dialog is the gate.
    expect(screen.getByText('End this room?')).toBeInTheDocument();
    expect(mockClose).not.toHaveBeenCalled();

    // The trigger goes aria-hidden while the dialog is open, so this resolves
    // to the dialog's action rather than the button that opened it.
    fireEvent.click(screen.getByRole('button', { name: 'End room' }));
    await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('AT /rooms')).toBeInTheDocument());
  });

  it('backing out of the confirm leaves the room alone', () => {
    renderActions(true);
    fireEvent.click(screen.getByRole('button', { name: 'End room' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(mockClose).not.toHaveBeenCalled();
    expect(screen.queryByText('AT /rooms')).toBeNull();
  });

  it('a refused close says why and stays put', async () => {
    mockClose.mockResolvedValue({ ok: false, reason: 'not_host' });
    renderActions(true);
    fireEvent.click(screen.getByRole('button', { name: 'End room' }));
    // The trigger goes aria-hidden while the dialog is open, so this resolves
    // to the dialog's action rather than the button that opened it.
    fireEvent.click(screen.getByRole('button', { name: 'End room' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Only the host can do that.'));
    expect(screen.queryByText('AT /rooms')).toBeNull();
  });
});
