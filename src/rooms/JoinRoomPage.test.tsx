/**
 * @fileoverview Tests for the join doorstep: one card, one button, and every
 * refusal as a sentence. Hooks are mocked at the module boundary — the RPCs
 * are proven in src/__tests__/database/rooms.join.db.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { RoomState } from '@/api/queries/rooms';

const mockUseRoomByToken = vi.fn();
const mockJoin = vi.fn();
vi.mock('@/api/hooks/useRooms', () => ({
  useRoomByToken: (t: string) => mockUseRoomByToken(t),
  useJoinRoom: () => ({ mutateAsync: mockJoin }),
}));
vi.mock('./deviceId', () => ({ getDeviceId: () => 'dev-1' }));
vi.mock('./games/registry', () => ({ gameName: (k: string) => (k === 'coin_flip' ? 'Coin flip' : k) }));

import { JoinRoomPage } from './JoinRoomPage';

const STATE: RoomState = {
  room: {
    id: 'r1', host_member_id: 'm1', game_key: 'coin_flip', game_tables: ['room_coin_flips'],
    settings: {}, shared: true, join_token: 'tok', last_activity_at: '', created_at: '',
  },
  seats: { devices: 2, hosts: 1, open: 2 },
  phones: [
    { id: 'p1', member_id: 'm1', device_id: 'host-dev', display_name: 'Ed', is_host: true, is_present: true, last_seen_at: '', joined_at: '' },
  ],
};

function renderAt(token = 'tok') {
  return render(
    <MemoryRouter initialEntries={[`/rooms/join/${token}`]}>
      <Routes>
        <Route path="/rooms/join/:joinToken" element={<JoinRoomPage />} />
        <Route path="/rooms/:roomId" element={<p>ROOM PAGE</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseRoomByToken.mockReset().mockReturnValue({ data: STATE, isLoading: false });
  mockJoin.mockReset();
});

describe('JoinRoomPage', () => {
  it('shows the game, the host, the seats, and one Join button', () => {
    renderAt();
    expect(screen.getByText('Coin flip')).toBeInTheDocument();
    expect(screen.getByText(/Ed's room · 2 here · 2 empty seats/)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
  });

  it('Join calls join_room with the token + this device and navigates into the room', async () => {
    mockJoin.mockResolvedValue({ ok: true, room_id: 'r1', phone_id: 'p9', rejoined: false });
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(screen.getByText('ROOM PAGE')).toBeInTheDocument());
    expect(mockJoin).toHaveBeenCalledWith({ joinToken: 'tok', deviceId: 'dev-1' });
  });

  it('a gone room renders "this room has ended", not an error', () => {
    mockUseRoomByToken.mockReturnValue({ data: null, isLoading: false });
    renderAt('stale');
    expect(screen.getByText('This room has ended')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to rooms' })).toBeInTheDocument();
  });

  it('full → the seat explanation with the members-open-more hint; Join gives way to it', async () => {
    mockJoin.mockResolvedValue({
      ok: false, reason: 'full', seats: { devices: 4, hosts: 1, open: 0 },
      hint: 'another host joining opens more seats',
    });
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() =>
      expect(screen.getByText(/This room is full — another host joining opens more seats\./)).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
  });

  it('not_shared → the private-room sentence', async () => {
    mockJoin.mockResolvedValue({ ok: false, reason: 'not_shared' });
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(screen.getByText(/This room is private/)).toBeInTheDocument());
  });
});
