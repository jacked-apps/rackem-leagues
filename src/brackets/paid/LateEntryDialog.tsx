/**
 * @fileoverview Seat a latecomer in an unused bye.
 *
 * Someone turns up after the tournament has started. If a bye hasn't been used
 * yet, they can take it — established practice, and the only seat that can
 * honestly hold them: every other empty slot belongs to a player who has to win
 * their way into it, and losers-bracket seats belong to someone who already
 * lost.
 *
 * Deliberately blunt about the consequence, because it un-decides a match
 * somebody has already been told they won.
 */

import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LateEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Who currently holds the bye — they will have to play after all. */
  byeHolderName: string;
  /** Add this name; returns a message to show, or null when it worked. */
  onAdd: (displayName: string) => Promise<string | null>;
}

export function LateEntryDialog({
  open,
  onOpenChange,
  byeHolderName,
  onAdd,
}: LateEntryDialogProps) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const trimmed = name.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || adding) return;
    setAdding(true);
    setProblem(null);
    try {
      const message = await onAdd(trimmed);
      if (message) {
        // Shown beside the box they'd retype in, not as a toast that vanishes.
        setProblem(message);
        return;
      }
      setName('');
      onOpenChange(false);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a late player</DialogTitle>
            <DialogDescription>
              {byeHolderName} has a bye. Adding someone here gives them an
              opponent, so {byeHolderName} plays this round after all instead of
              sitting it out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="late-entry-name">Player name</Label>
            <Input
              id="late-entry-name"
              value={name}
              disabled={adding}
              placeholder="Name"
              onChange={(e) => {
                setName(e.target.value);
                setProblem(null);
              }}
            />
            {problem && <p className="text-sm text-destructive">{problem}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              loadingText="none"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loadingText="Adding…" isLoading={adding} disabled={!trimmed}>
              Add player
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
