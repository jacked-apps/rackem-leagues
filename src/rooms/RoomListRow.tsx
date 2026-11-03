/**
 * @fileoverview One room in the Rooms list (`/rooms`): what it is, Open, and —
 * for the room's host only — Delete.
 *
 * Delete exists so a host can clear out a room without walking into it first.
 * Rooms no longer delete themselves (the sweep is gone and there is a per-host
 * room cap), so this list is where old rooms get tidied away. It is the same
 * `close_room` the in-room "End room" uses (`useCloseRoom`), behind the same
 * kind of confirm, because it cannot be undone: the room and everything in it
 * is gone. A refusal is said as a toast and the row stays.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCloseRoom } from '@/api/hooks/useRooms';
import type { MyRoom } from '@/api/queries/rooms';
import { gameName } from './games/registry';
import { roomRefusalCopy } from './roomRefusalCopy';

interface RoomListRowProps {
  /** One entry from `useMyRooms`. `is_host` decides whether Delete is offered. */
  room: MyRoom;
}

export function RoomListRow({ room }: RoomListRowProps) {
  const close = useCloseRoom(room.room_id);
  const [confirming, setConfirming] = useState(false);

  /** Delete the room. On success the hook invalidates the list and the row leaves. */
  const deleteRoom = async () => {
    const r = await close.mutateAsync();
    if (!r.ok) toast.error(roomRefusalCopy(r));
  };

  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <div>
        <p className="font-medium">{gameName(room.game_key)}</p>
        <p className="text-xs text-muted-foreground">
          {[room.is_host && 'host', room.shared ? 'open to others' : 'private']
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {room.is_host && (
          <Button variant="destructive" size="sm" loadingText="none" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to={`/rooms/${room.room_id}`}>Open</Link>
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this room?</AlertDialogTitle>
            <AlertDialogDescription>Anything in it is gone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRoom}>Delete room</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
