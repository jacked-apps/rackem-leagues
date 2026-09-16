/**
 * @fileoverview What only the host can do: switch the game, open the door,
 * end the room. Guests never see this component — the page does not render
 * it for them, and the RPCs refuse them anyway (`not_host`).
 *
 * Ending the room asks first: it deletes the row, the cascade takes every
 * phone and every game row with it, and every other phone flips to "this room
 * has ended" live. There is no undo, so there is a confirm.
 *
 * The door toggle is passed in from the page, because the seat counter's tap
 * on a free room opens the same door — one mutation, two buttons.
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
import { useCloseRoom, useSetRoomGame } from '@/api/hooks/useRooms';
import type { RoomRow } from '@/api/queries/rooms';
import { CreateRoomDialog } from './CreateRoomDialog';
import { roomRefusalCopy } from './roomRefusalCopy';
import type { GameDefinition } from './games/types';

interface RoomHostControlsProps {
  room: RoomRow;
  /** Open (free → shared) or shut the door. Owned by the page. */
  onToggleDoor: () => Promise<void>;
}

export function RoomHostControls({ room, onToggleDoor }: RoomHostControlsProps) {
  const navigate = useNavigate();
  const setGame = useSetRoomGame(room.id);
  const close = useCloseRoom(room.id);
  const [switching, setSwitching] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const switchGame = async (game: GameDefinition): Promise<string | null> => {
    const r = await setGame.mutateAsync({ gameKey: game.key, tables: [...game.tables] });
    return r.ok ? null : roomRefusalCopy(r);
  };

  const endRoom = async () => {
    const r = await close.mutateAsync();
    if (!r.ok) return toast.error(roomRefusalCopy(r));
    navigate('/rooms', { replace: true });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setSwitching(true)}>
        Switch game
      </Button>
      <Button variant="outline" size="sm" onClick={onToggleDoor}>
        {room.shared ? 'Make private' : 'Open to others'}
      </Button>
      <Button variant="destructive" size="sm" loadingText="none" onClick={() => setConfirmClose(true)}>
        End room
      </Button>

      {switching && (
        <CreateRoomDialog
          open
          onOpenChange={setSwitching}
          mode="switch"
          currentGameKey={room.game_key}
          onSubmit={switchGame}
        />
      )}

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this room?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone here sees it end, and the game's progress is gone. Nothing from it was ever
              going to count toward stats.
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
