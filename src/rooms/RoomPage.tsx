/**
 * @fileoverview The room (`/rooms/:roomId`): a header, one players chip, and
 * the slot the game renders in.
 *
 * Deliberately thin. It started with a seat line AND an always-open player
 * list, which said the same thing twice and left a phone with no room for the
 * game itself (Ed, 2026-10-09). Both collapsed into `PlayersChip`.
 *
 * Everything on this page is DATA-DERIVED from one query (`useRoom`) that the
 * realtime hook keeps fresh and a 15 s poll backs up. The room is over when
 * that query resolves to null OR the hook's `roomGone` fires — same screen
 * either way. "Leave" is just navigating away; this device's seat ages out
 * by heartbeat.
 *
 * A seat is a DEVICE. If this device has no phone row (the host's second
 * device, a tab opened from the rooms list), the page offers a seat before
 * showing the game — the heartbeat and the game both need `myPhone`.
 *
 * Host-only controls render only for the host phone. Connection status is a
 * word in the header, never a colour.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Json } from '@/types/database.types';
import type { RoomPhone } from '@/api/queries/rooms';
import {
  useJoinRoom,
  useRemoveRoomPhone,
  useRoom,
  useSetRoomGame,
  useSetRoomShared,
} from '@/api/hooks/useRooms';
import { getDeviceId } from './deviceId';
import { gameName } from './games/registry';
import { GameSlot } from './GameSlot';
import { InviteSheet } from './InviteSheet';
import { PlayersChip } from './PlayersChip';
import { RoomEnded } from './RoomEnded';
import { RoomActions } from './RoomActions';
import { roomRefusalCopy } from './roomRefusalCopy';
import { useRoomHeartbeat } from './useRoomHeartbeat';
import { useRoomRealtime } from './useRoomRealtime';

const STATUS_COPY = {
  live: 'Live',
  reconnecting: 'Reconnecting…',
  error: 'Live updates off — refreshing every 15 s',
} as const;

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const deviceId = getDeviceId();
  const { data: state, isLoading } = useRoom(roomId);
  const room = state?.room;

  const { connectionStatus, roomGone } = useRoomRealtime({
    roomId: room?.id,
    shared: room?.shared ?? false,
    tables: room?.game_tables ?? [],
  });

  const myPhone = state?.phones.find((p) => p.device_id === deviceId);
  useRoomHeartbeat(room?.id, deviceId, !!myPhone);

  const join = useJoinRoom();
  const setShared = useSetRoomShared(roomId ?? '');
  const setGame = useSetRoomGame(roomId ?? '');
  const removePhone = useRemoveRoomPhone(roomId ?? '');
  const [inviting, setInviting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Opening the room…
      </div>
    );
  }
  if (!state || !room || roomGone) return <RoomEnded />;

  const isHost = !!myPhone?.is_host;

  const toggleDoor = async () => {
    const r = await setShared.mutateAsync(!room.shared);
    if (!r.ok) toast.error(roomRefusalCopy(r));
  };

  /** Same game, fresh rows, new settings — what a game's Setup calls. */
  const startGame = async (settings: Record<string, Json>) => {
    const r = await setGame.mutateAsync({ gameKey: room.game_key, tables: room.game_tables, settings });
    if (!r.ok) toast.error(roomRefusalCopy(r));
  };

  /** Host: drop someone's screen. Their seat frees at once. */
  const dropScreen = async (phone: RoomPhone) => {
    const r = await removePhone.mutateAsync({ phoneId: phone.id, deviceId });
    if (!r.ok) toast.error(roomRefusalCopy(r));
  };

  const takeSeat = async () => {
    const r = await join.mutateAsync({ joinToken: room.join_token, deviceId });
    if (!r.ok) toast.error(roomRefusalCopy(r));
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-4 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight">{gameName(room.game_key)}</h1>
          {room.shared && (
            <p className="text-xs text-muted-foreground">{STATUS_COPY[connectionStatus]}</p>
          )}
        </div>
        <PlayersChip
          seats={state.seats}
          phones={state.phones}
          shared={room.shared}
          isHost={isHost}
          myPhoneId={myPhone?.id}
          onInvite={() => setInviting(true)}
          onOpenDoor={toggleDoor}
          onRemove={isHost ? dropScreen : undefined}
        />
      </header>

      {myPhone ? (
        <GameSlot room={room} myPhone={myPhone} phones={state.phones} isHost={isHost} onStart={startGame} />
      ) : (
        <div className="space-y-2 rounded-md border px-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">This device isn't in the room yet.</p>
          <Button loadingText="Joining…" onClick={takeSeat}>
            Take a seat
          </Button>
        </div>
      )}

      <RoomActions roomId={room.id} isHost={isHost} />

      <InviteSheet
        open={inviting}
        onOpenChange={setInviting}
        joinToken={room.join_token}
        seats={state.seats}
      />
    </div>
  );
}
