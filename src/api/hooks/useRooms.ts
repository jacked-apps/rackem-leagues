/**
 * @fileoverview TanStack Query hooks for the Game Room.
 *
 * Reads poll as a FALLBACK: realtime (`useRoomRealtime`, Unit 4) is the fast
 * path, and every piece of room state is data-derived, so a missed event only
 * delays — the poll catches it. That posture is the public bracket page's
 * (`useBracketShare`), where realtime delivery was never proven either.
 *
 * Writes invalidate `rooms.detail(roomId)`, which is a PREFIX of every game
 * table key — so one invalidation refreshes the room, its phones, and every
 * game table (see `queryKeys.rooms`).
 *
 * Identity is the existing `useCurrentMember()`; nothing new. The device id
 * comes from `src/rooms/deviceId.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { getMyRooms, getRoom, getRoomByToken } from '@/api/queries/rooms';
import {
  closeRoom,
  createRoom,
  joinRoom,
  setRoomGame,
  setRoomSettings,
  setRoomShared,
  type CreateRoomParams,
} from '@/api/mutations/rooms';
import type { Json } from '@/types/database.types';

/** How often an open room polls as the realtime fallback. A dial. */
export const ROOM_POLL_MS = 15_000;

/** A room's live state. Polls while the room exists; stops once it is gone. */
export function useRoom(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rooms.detail(roomId ?? ''),
    queryFn: () => getRoom(roomId!),
    enabled: !!roomId,
    staleTime: 0,
    // `null` = the room is gone; nothing left to poll for.
    refetchInterval: (query) => (query.state.data ? ROOM_POLL_MS : false),
  });
}

/** The join page's read. One fetch; the page joins or explains. */
export function useRoomByToken(joinToken: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rooms.byToken(joinToken ?? ''),
    queryFn: () => getRoomByToken(joinToken!),
    enabled: !!joinToken,
    staleTime: 0,
  });
}

/** Rooms the member has a device in — the rooms index's "rejoin" list. */
export function useMyRooms(memberId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rooms.mine(memberId ?? ''),
    queryFn: () => getMyRooms(memberId!),
    enabled: !!memberId,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateRoomParams) => createRoom(p),
    onSuccess: (r) => {
      if (r.ok) qc.invalidateQueries({ queryKey: queryKeys.rooms.all });
    },
  });
}

export function useJoinRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { joinToken: string; deviceId: string }) => joinRoom(p.joinToken, p.deviceId),
    onSuccess: (r) => {
      if (r.ok) qc.invalidateQueries({ queryKey: queryKeys.rooms.detail(r.room_id) });
    },
  });
}

/** Host: switch to a new game (validates, wipes the old game's rows). */
export function useSetRoomGame(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { gameKey: string; tables: string[]; settings?: Record<string, Json> }) =>
      setRoomGame(roomId, p.gameKey, p.tables, p.settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rooms.detail(roomId) }),
  });
}

/** Host: change settings mid-play (no wipe). */
export function useSetRoomSettings(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, Json>) => setRoomSettings(roomId, settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rooms.detail(roomId) }),
  });
}

/** Host: open or shut the door in place. */
export function useSetRoomShared(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shared: boolean) => setRoomShared(roomId, shared),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rooms.detail(roomId) }),
  });
}

/** Host: end the room. */
export function useCloseRoom(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => closeRoom(roomId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rooms.all }),
  });
}
