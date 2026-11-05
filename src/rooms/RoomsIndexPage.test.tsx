/**
 * @fileoverview Tests for the Rooms list (`/rooms`): deleting a room, and the
 * create path forwarding the game's `defaultSettings` to `create_room`.
 *
 * The hooks are REAL (a real QueryClient), and only the read and the RPC are
 * mocked at the API boundary, so "the row leaves" is proven the way it really
 * happens: `close_room` succeeds → the hook invalidates the list → the list
 * refetches without the room.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MyRoom } from '@/api/queries/rooms';

const mockGetMyRooms = vi.fn();
const mockCloseRoom = vi.fn();
const mockCreateRoom = vi.fn();
vi.mock('@/api/queries/rooms', () => ({
  getMyRooms: (id: string) => mockGetMyRooms(id),
  getRoom: vi.fn(),
  getRoomByToken: vi.fn(),
}));
vi.mock('@/api/mutations/rooms', () => ({
  closeRoom: (id: string) => mockCloseRoom(id),
  createRoom: (p: unknown) => mockCreateRoom(p),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  removeRoomPhone: vi.fn(),
  setRoomGame: vi.fn(),
  setRoomSettings: vi.fn(),
  setRoomShared: vi.fn(),
}));
vi.mock('@/api/hooks/useCurrentMember', () => ({ useCurrentMember: () => ({ data: { id: 'm1' } }) }));
vi.mock('./games/registry', () => ({ gameName: (k: string) => `Game ${k}` }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));

import { RoomsIndexPage } from './RoomsIndexPage';

const room = (id: string, isHost: boolean): MyRoom => ({
  room_id: id,
  game_key: id,
  shared: false,
  is_host: isHost,
  joined_at: '2026-11-03T00:00:00Z',
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <RoomsIndexPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

/** Tap the row's Delete, then the dialog's confirm. */
const deleteAndConfirm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete room' }));
};

beforeEach(() => {
  mockGetMyRooms.mockReset().mockResolvedValue([room('mine', true)]);
  mockCloseRoom.mockReset().mockResolvedValue({ ok: true });
  toastError.mockReset();
});

describe('RoomsIndexPage — delete a room', () => {
  it('the host deletes after confirming, and the row leaves the list', async () => {
    renderPage();
    await screen.findByText('Game mine');
    // The refetch after invalidation no longer has the room.
    mockGetMyRooms.mockResolvedValue([]);
    deleteAndConfirm();

    await waitFor(() => expect(mockCloseRoom).toHaveBeenCalledWith('mine'));
    await waitFor(() => expect(screen.queryByText('Game mine')).toBeNull());
  });

  it('cancelling the confirm deletes nothing', async () => {
    renderPage();
    await screen.findByText('Game mine');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(mockCloseRoom).not.toHaveBeenCalled();
    expect(screen.getByText('Game mine')).toBeInTheDocument();
  });

  it('a room I am only a guest in has no Delete', async () => {
    mockGetMyRooms.mockResolvedValue([room('theirs', false)]);
    renderPage();
    await screen.findByText('Game theirs');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open' })).toBeInTheDocument();
  });

  it('a refused delete says why, and the row stays', async () => {
    mockCloseRoom.mockResolvedValue({ ok: false, reason: 'not_host' });
    renderPage();
    await screen.findByText('Game mine');
    deleteAndConfirm();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Only the host can do that.'));
    expect(screen.getByText('Game mine')).toBeInTheDocument();
  });
});

// The create dialog is exercised in its own tests; here a stub hands the page
// a game with defaults, so only "the page forwards them" is under test.
vi.mock('./CreateRoomDialog', () => ({
  CreateRoomDialog: ({ onSubmit }: { onSubmit: (g: unknown, shared: boolean) => Promise<string | null> }) => (
    <button
      onClick={() =>
        onSubmit(
          {
            key: 'race',
            tables: ['room_races'],
            screens: { min: 2, max: 2 },
            defaultSettings: { base: 5, break_rule: 'winner_breaks', game_type: 'eight_ball' },
          },
          true
        )
      }
    >
      stub create
    </button>
  ),
}));

describe('RoomsIndexPage — start a room', () => {
  it("forwards the game's defaultSettings into create_room", async () => {
    mockCreateRoom.mockResolvedValue({ ok: true, room_id: 'new-room' });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Start a room' }));
    fireEvent.click(screen.getByRole('button', { name: 'stub create' }));

    await waitFor(() =>
      expect(mockCreateRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          gameKey: 'race',
          tables: ['room_races'],
          shared: true,
          maxScreens: 2,
          settings: { base: 5, break_rule: 'winner_breaks', game_type: 'eight_ball' },
        })
      )
    );
  });
});
