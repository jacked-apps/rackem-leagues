/**
 * @fileoverview Tests for the host's controls — in particular that switching
 * games through the dialog calls `set_room_game` with the REGISTRY's table
 * list for the new game (the plug-in contract, end to end from the UI), and
 * that the door button flips the right way.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RoomRow } from '@/api/queries/rooms';

const mockSetGame = vi.fn();
vi.mock('@/api/hooks/useRooms', () => ({
  useSetRoomGame: () => ({ mutateAsync: mockSetGame }),
  useCloseRoom: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/api/hooks/useUserProfile', () => ({ useIsOperator: () => true }));
vi.mock('./games/registry', () => {
  const mk = (key: string, name: string, tables: string[]) => ({
    key, name, description: '', tables, isReady: () => true, Setup: () => null, Play: () => null,
  });
  const games = [mk('coin_flip', 'Coin flip', ['room_coin_flips']), mk('race', 'Race', ['room_races', 'room_race_games'])];
  return { listGames: () => games, getGame: (k: string) => games.find((g) => g.key === k), gameName: (k: string) => k };
});

import { RoomHostControls } from './RoomHostControls';

const ROOM: RoomRow = {
  id: 'r1', host_member_id: 'm1', game_key: 'coin_flip', game_tables: ['room_coin_flips'],
  settings: {}, shared: false, join_token: 'tok', last_activity_at: '', created_at: '',
};

beforeEach(() => mockSetGame.mockReset().mockResolvedValue({ ok: true }));

describe('RoomHostControls', () => {
  it('switching games calls set_room_game with the registry’s tables for the new game', async () => {
    render(
      <MemoryRouter>
        <RoomHostControls room={ROOM} onToggleDoor={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch game' }));
    fireEvent.click(await screen.findByLabelText(/Race/));
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));

    await waitFor(() =>
      expect(mockSetGame).toHaveBeenCalledWith({ gameKey: 'race', tables: ['room_races', 'room_race_games'] })
    );
  });

  it('the door button names the direction it will go', () => {
    const onToggleDoor = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <RoomHostControls room={ROOM} onToggleDoor={onToggleDoor} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open to others' }));
    expect(onToggleDoor).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <RoomHostControls room={{ ...ROOM, shared: true }} onToggleDoor={onToggleDoor} />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Make private' })).toBeInTheDocument();
  });
});
