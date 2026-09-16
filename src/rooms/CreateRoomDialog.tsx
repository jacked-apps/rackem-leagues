/**
 * @fileoverview Pick a game — to start a room, or to switch the game in one.
 *
 * Two modes, one dialog, because the choice is the same: which game, from the
 * registry. `create` also asks free-or-shared; `switch` does not (the door is
 * a separate host control, and a switch WIPES the old game's rows, so the
 * copy says so).
 *
 * Dumb on purpose: it never calls an RPC. The opener owns the mutation and
 * hands back a sentence when the server refuses, which the dialog shows in
 * place. That keeps the create path (navigate to the new room) and the switch
 * path (stay put) out of here.
 *
 * The shared toggle is disabled with a note unless the viewer passes the host
 * gate (`useIsOperator`). Shared rooms cost sockets; the server enforces the
 * same gate, this just explains it before the tap.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useIsOperator } from '@/api/hooks/useUserProfile';
import { listGames } from './games/registry';
import type { GameDefinition } from './games/types';

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'switch';
  /** The room's current game, so `switch` preselects it. */
  currentGameKey?: string;
  /** Do the thing; return a problem sentence to show, or null when it went through. */
  onSubmit: (game: GameDefinition, shared: boolean) => Promise<string | null>;
}

export function CreateRoomDialog({ open, onOpenChange, mode, currentGameKey, onSubmit }: CreateRoomDialogProps) {
  const games = listGames();
  const canShare = useIsOperator();
  const [gameKey, setGameKey] = useState(currentGameKey ?? games[0]?.key ?? '');
  const [shared, setShared] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const game = games.find((g) => g.key === gameKey);

  const submit = async () => {
    if (!game) return;
    setProblem(null);
    const result = await onSubmit(game, mode === 'create' && shared);
    if (result) setProblem(result);
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Start a room' : 'Switch game'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'A room is for tonight. Nothing in it counts toward stats.'
              : 'Switching starts fresh — the current game’s progress is cleared for everyone.'}
          </DialogDescription>
        </DialogHeader>

        {games.length === 0 ? (
          <p className="text-sm text-muted-foreground">No games are available yet.</p>
        ) : (
          <RadioGroup value={gameKey} onValueChange={setGameKey} className="space-y-2">
            {games.map((g) => (
              <Label
                key={g.key}
                htmlFor={`game-${g.key}`}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
              >
                <RadioGroupItem value={g.key} id={`game-${g.key}`} className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-medium">{g.name}</div>
                  <p className="text-sm text-muted-foreground">{g.description}</p>
                </div>
              </Label>
            ))}
          </RadioGroup>
        )}

        {mode === 'create' && (
          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="shared-toggle">Open to others</Label>
              <p className="text-sm text-muted-foreground">
                {canShare
                  ? 'People you invite can join on their own phones.'
                  : 'Opening a room to others is a host feature. You can still play on this device.'}
              </p>
            </div>
            <Switch
              id="shared-toggle"
              checked={shared}
              onCheckedChange={setShared}
              disabled={!canShare}
              aria-label="Open to others"
            />
          </div>
        )}

        {problem && <p className="text-sm text-destructive">{problem}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loadingText={mode === 'create' ? 'Starting…' : 'Switching…'} onClick={submit} disabled={!game}>
            {mode === 'create' ? 'Start' : 'Switch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
