/**
 * @fileoverview The two ways out of a room, at the bottom of the page where
 * the thing you do last belongs.
 *
 *   - **Exit room** — everyone. Leaves the room running; you just stop
 *     looking at it. Your screen stops beating, so your seat ages out of the
 *     host's house on its own, and the room lives until its host ends it or
 *     the sweep takes it. No server call: leaving is navigating away.
 *   - **End room** — the owner only, and it asks first. Deletes the room,
 *     which cascades to every screen and every game row, and flips every
 *     other phone to "this room has ended" live. No undo, hence the confirm.
 *
 * What used to be here and is NOT any more (Ed, 2026-10-10): "Switch game"
 * and "Make private". Both were in-place edits of a room, and the room is
 * cheap and disposable — you leave and start another one. Keeping them would
 * have meant carrying a wipe-and-rebuild path through every future game for
 * a convenience nobody asked for. The RPCs survive (a game's own restart
 * calls `set_room_game`; the players panel's "Open to others" calls
 * `set_room_shared`); only the buttons are gone.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { roomRefusalCopy } from './roomRefusalCopy';

interface RoomActionsProps {
  roomId: string;
  /** Only the room's owner is offered "End room". */
  isHost: boolean;
}

export function RoomActions({ roomId, isHost }: RoomActionsProps) {
  const navigate = useNavigate();
  const close = useCloseRoom(roomId);
  const [confirmClose, setConfirmClose] = useState(false);

  const endRoom = async () => {
    const r = await close.mutateAsync();
    if (!r.ok) return toast.error(roomRefusalCopy(r));
    navigate('/rooms', { replace: true });
  };

  return (
    <div className="flex items-center justify-between gap-2 border-t pt-3">
      <Button variant="ghost" size="sm" onClick={() => navigate('/rooms')}>
        Exit room
      </Button>

      {isHost && (
        <Button
          variant="destructive"
          size="sm"
          loadingText="none"
          onClick={() => setConfirmClose(true)}
        >
          End room
        </Button>
      )}

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this room?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone here sees it end, and the game's progress is gone. Nothing from it was ever
              going to count toward stats. If you only want to step away, use Exit room instead —
              it keeps running.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction onClick={endRoom}>End room</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
