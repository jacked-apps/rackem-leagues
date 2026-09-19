/**
 * @fileoverview Tests for the room page's wiring: the registry decides what
 * fills the game slot, the host sees controls a guest does not, and the room
 * is "ended" on either signal (null query, or the realtime hook's roomGone).
 *
 * Realtime, heartbeat, hooks and the registry are mocked at the module
 * boundary; each has its own tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { RoomState } from '@/api/queries/rooms';

const mockUseRoom = vi.fn();
const mockRealtime = vi.fn();
const mockHeartbeat = vi.fn();
vi.mock('@/api/hooks/useRooms', () => ({
  useRoom: (id: string) => mockUseRoom(id),
  useJoinRoom: () => ({ mutateAsync: vi.fn() }),
  useSetRoomShared: () => ({ mutateAsync: vi.fn() }),
  useSetRoomGame: () => ({ mutateAsync: vi.fn() }),
  useCloseRoom: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('./useRoomRealtime', () => ({ useRoomRealtime: (p: unknown) => mockRealtime(p) }));
vi.mock('./useRoomHeartbeat', () => ({ useRoomHeartbeat: (...a: unknown[]) => mockHeartbeat(...a) }));
vi.mock('./deviceId', () => ({ getDeviceId: () => 'my-dev' }));
vi.mock('@/api/hooks/useUserProfile', () => ({ useIsOperator: () => true }));
vi.mock('./games/registry', () => {
  const fake = {
    key: 'fake_game',
    name: 'Fake Game',
    description: 'for tests',
    tables: ['room_fakes'],
    isReady: (s: Record<string, unknown>) => s.ready === true,
    Setup: () => <p>FAKE SETUP</p>,
    Play: ({ isHost }: { isHost: boolean }) => <p>FAKE PLAY {isHost ? 'host' : 'guest'}</p>,
  };
  return {
    getGame: (k: string) => (k === 'fake_game' ? fake : undefined),
    gameName: (k: string) => (k === 'fake_game' ? 'Fake Game' : k),
    listGames: () => [fake],
  };
});

import { RoomPage } from './RoomPage';

const HOST = { id: 'p1', member_id: 'm1', device_id: 'my-dev', display_name: 'Ed', is_host: true, is_present: true, last_seen_at: '', joined_at: '' };
const GUEST = { id: 'p2', member_id: 'm2', device_id: 'other-dev', display_name: 'Jack', is_host: false, is_present: false, last_seen_at: '', joined_at: '' };

function state(over: Partial<RoomState['room']> = {}, phones = [HOST, GUEST]): RoomState {
  return {
    room: {
      id: 'r1', host_member_id: 'm1', game_key: 'fake_game', game_tables: ['room_fakes'],
      settings: { ready: true }, shared: true, join_token: 'tok', last_activity_at: '', created_at: '', ...over,
    },
    seats: { devices: phones.length, guests: phones.length - 1, seats: 3, open: 4 - phones.length },
    phones,
  };
}

function renderRoom() {
  return render(
    <MemoryRouter initialEntries={['/rooms/r1']}>
      <Routes>
        <Route path="/rooms/:roomId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseRoom.mockReset().mockReturnValue({ data: state(), isLoading: false });
  mockRealtime.mockReset().mockReturnValue({ connectionStatus: 'live', roomGone: false });
  mockHeartbeat.mockReset();
});

describe('RoomPage', () => {
  it('renders the game the row names, via the registry, with who is here', () => {
    renderRoom();
    expect(screen.getByRole('heading', { name: 'Fake Game' })).toBeInTheDocument();
    expect(screen.getByText('FAKE PLAY host')).toBeInTheDocument();
    expect(screen.getByText('Ed')).toBeInTheDocument();
    expect(screen.getByText('you · host')).toBeInTheDocument();
    expect(screen.getByText('Jack')).toBeInTheDocument();
    expect(screen.getByText('away')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows Setup until the game says its settings are ready', () => {
    mockUseRoom.mockReturnValue({ data: state({ settings: {} }), isLoading: false });
    renderRoom();
    expect(screen.getByText('FAKE SETUP')).toBeInTheDocument();
  });

  it('an unknown game key is a plain notice, not a crash', () => {
    mockUseRoom.mockReturnValue({ data: state({ game_key: 'mystery' }), isLoading: false });
    renderRoom();
    expect(screen.getByText(/doesn't know \(mystery\)/)).toBeInTheDocument();
  });

  it('host controls render only for the host phone', () => {
    const { unmount } = renderRoom();
    expect(screen.getByRole('button', { name: 'End room' })).toBeInTheDocument();
    unmount();

    // Same room seen from the guest's device.
    mockUseRoom.mockReturnValue({
      data: state({}, [{ ...HOST, device_id: 'host-dev' }, { ...GUEST, device_id: 'my-dev', is_present: true }]),
      isLoading: false,
    });
    renderRoom();
    expect(screen.queryByRole('button', { name: 'End room' })).toBeNull();
    expect(screen.getByText('FAKE PLAY guest')).toBeInTheDocument();
  });

  it('wires realtime to the row and beats only once this device has a seat', () => {
    renderRoom();
    expect(mockRealtime).toHaveBeenCalledWith({ roomId: 'r1', shared: true, tables: ['room_fakes'] });
    expect(mockHeartbeat).toHaveBeenLastCalledWith('r1', 'my-dev', true);
  });

  it('a device without a seat is offered one instead of the game', () => {
    mockUseRoom.mockReturnValue({ data: state({}, [{ ...HOST, device_id: 'host-dev' }]), isLoading: false });
    renderRoom();
    expect(screen.getByRole('button', { name: 'Take a seat' })).toBeInTheDocument();
    expect(screen.queryByText(/FAKE PLAY/)).toBeNull();
    expect(mockHeartbeat).toHaveBeenLastCalledWith('r1', 'my-dev', false);
  });

  it('roomGone from realtime flips to RoomEnded without a refetch', () => {
    mockRealtime.mockReturnValue({ connectionStatus: 'live', roomGone: true });
    renderRoom();
    expect(screen.getByText('This room has ended')).toBeInTheDocument();
  });

  it('a room query resolving to null does the same', () => {
    mockUseRoom.mockReturnValue({ data: null, isLoading: false });
    renderRoom();
    expect(screen.getByText('This room has ended')).toBeInTheDocument();
  });

  it('a free room shows no connection status and the door copy', () => {
    mockUseRoom.mockReturnValue({ data: state({ shared: false }, [HOST]), isLoading: false });
    renderRoom();
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.getByRole('button', { name: /open the door to invite/ })).toBeInTheDocument();
  });
});
