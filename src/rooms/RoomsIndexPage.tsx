/**
 * @fileoverview Rooms index (`/rooms`) — start a room, or get back into one.
 *
 * Two things, because a room is perishable and a phone is not: "Start a room"
 * for tonight, and the rooms this member already has a device in, so someone
 * who walked away from the table (or whose browser dropped the tab) has a way
 * back that is not "find the QR again." A deleted room falls out of the list on
 * its own — its phones went with it.
 *
 * Any member can start a FREE room. Opening it to others is behind the host
 * gate, explained inside the dialog. Gated non-production as a whole (Unit 7).
 *
 * Each row (`RoomListRow`) also gives the room's host a Delete, so old rooms
 * can be cleared out from here without opening them.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useCreateRoom, useMyRooms } from '@/api/hooks/useRooms';
import { CreateRoomDialog } from './CreateRoomDialog';
import { getDeviceId } from './deviceId';
import { RoomListRow } from './RoomListRow';
import { roomRefusalCopy } from './roomRefusalCopy';
import type { GameDefinition } from './games/types';

export function RoomsIndexPage() {
  const navigate = useNavigate();
  const { data: member } = useCurrentMember();
  const { data: mine, isLoading } = useMyRooms(member?.id);
  const create = useCreateRoom();
  const [creating, setCreating] = useState(false);

  /** Start the room on this device; land in it. Refusals come back as a sentence. */
  const start = async (game: GameDefinition, shared: boolean): Promise<string | null> => {
    const result = await create.mutateAsync({
      gameKey: game.key,
      tables: [...game.tables],
      // The game's defaults ride in on create; the room row is where its SQL
      // reads them (the race refuses a missing key rather than guessing).
      settings: game.defaultSettings,
      deviceId: getDeviceId(),
      shared,
      maxScreens: game.screens.max,
    });
    if (!result.ok) return roomRefusalCopy(result);
    navigate(`/rooms/${result.room_id}`);
    return null;
  };

  const rooms = mine ?? [];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rooms</h1>
        <Button loadingText="none" onClick={() => setCreating(true)}>
          Start a room
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rooms you're in</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None right now. Start one, or scan a room's code to join.
            </p>
          ) : (
            <ul className="divide-y">
              {rooms.map((r) => (
                <RoomListRow key={r.room_id} room={r} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateRoomDialog open onOpenChange={setCreating} onSubmit={start} />
      )}
    </div>
  );
}
