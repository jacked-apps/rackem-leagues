/**
 * @fileoverview TanStack hooks for the room race.
 *
 * Every key sits under `queryKeys.rooms.table(roomId, 'room_races')`, so the
 * room's realtime channel — which invalidates that key (a prefix) on every
 * change to `room_races` — refreshes the open, the race list and the Run it
 * back state on both phones without this game touching a channel. An accept
 * inserts the next link row, which re-runs the open, which returns the new
 * race: that is how both phones move to the next race together.
 *
 * The race's own games and confirmations are kept live by `ScoreRace`
 * (`useRaceRealtime`), not here.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { answerRoomRaceRematch, listRoomRaces, openRoomRace, requestRoomRaceRematch, ROOM_RACES_TABLE } from './roomRaceApi';

const key = (roomId: string) => queryKeys.rooms.table(roomId, ROOM_RACES_TABLE);

/**
 * The room's current race. Idempotent server-side (the room lock + a unique
 * index), so either phone running it first is fine; `enabled` waits until the
 * room has an opponent, so a lone host never asks.
 */
export function useOpenRoomRace(roomId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...key(roomId), 'open'],
    queryFn: () => openRoomRace(roomId),
    enabled,
    staleTime: 0,
  });
}

/** Every race played in this room, oldest first, with results. */
export function useRoomRaceLinks(roomId: string) {
  return useQuery({
    queryKey: [...key(roomId), 'list'],
    queryFn: () => listRoomRaces(roomId),
    staleTime: 0,
  });
}

/** Ask to Run it back (counts as an accept if the other player already asked). */
export function useRequestRoomRaceRematch(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => requestRoomRaceRematch(roomId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(roomId) }),
  });
}

/** Accept or deny the other player's Run it back. */
export function useAnswerRoomRaceRematch(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accept: boolean) => answerRoomRaceRematch(roomId, accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(roomId) }),
  });
}
