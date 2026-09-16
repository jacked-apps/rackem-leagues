/**
 * @fileoverview TanStack hooks for the two-phone coin flip.
 *
 * The one rule a game must follow to be live in a room: key its queries with
 * `queryKeys.rooms.table(roomId, table)`. The room's realtime channel pokes
 * exactly that key on every INSERT/UPDATE to `room_coin_flips`, so a call on
 * one phone and a throw on the other show up on both without either knowing
 * how. Writes invalidate the same key so the writer's own screen moves
 * without waiting for the echo.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import type { Call } from '@/components/coinflip/types';
import { callRoomCoin, COIN_FLIP_TABLE, getLatestRoomFlip, startRoomCoinFlip, throwRoomCoin } from './coinFlipApi';

const key = (roomId: string) => queryKeys.rooms.table(roomId, COIN_FLIP_TABLE);

/** The room's latest flip (null before the first). Live via the room's channel. */
export function useLatestRoomFlip(roomId: string) {
  return useQuery({
    queryKey: key(roomId),
    queryFn: () => getLatestRoomFlip(roomId),
    staleTime: 0,
  });
}

export function useStartRoomCoinFlip(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { callerPhoneId: string; flipperPhoneId: string }) =>
      startRoomCoinFlip(roomId, p.callerPhoneId, p.flipperPhoneId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(roomId) }),
  });
}

export function useCallRoomCoin(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { flipId: string; side: Call }) => callRoomCoin(p.flipId, p.side),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(roomId) }),
  });
}

export function useThrowRoomCoin(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (flipId: string) => throwRoomCoin(flipId),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(roomId) }),
  });
}
