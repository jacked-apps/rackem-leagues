/**
 * @fileoverview Type-a-name entry for the hopper (Phase C, Unit C3).
 *
 * The organizer's own way to put someone in the waiting room, alongside the two
 * self-service paths (scanning the QR, opening the join link). A typed name
 * creates a WALK-UP — an entrant with no account, whose whole identity is that
 * name — which is the right shape for someone who showed up and doesn't use the
 * app. Registered players who are already known arrive via the join link or the
 * past-players list; searching for a registered player by name is a separate
 * piece not built yet.
 *
 * Deliberately permissive about duplicates: two people really can both be
 * called Slim, and the organizer is the one who knows. The screen flags a shared
 * name rather than refusing it.
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddWalkupFormProps {
  /** Add this name to the waiting room. Rejected names stay in the box. */
  onAdd: (displayName: string) => Promise<unknown>;
  disabled?: boolean;
}

export function AddWalkupForm({ onAdd, disabled = false }: AddWalkupFormProps) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const trimmed = name.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      // Only clear on success — a failed add would otherwise lose what they typed.
      setName('');
    } catch {
      // Swallowed on purpose: the caller reports the failure (it owns the toast),
      // and an uncaught rejection here would just be an unhandled promise. The
      // typed name stays in the box so the organizer can retry it.
    } finally {
      setAdding(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Label htmlFor="add-walkup">Add a player</Label>
      <div className="flex gap-2">
        <Input
          id="add-walkup"
          value={name}
          disabled={disabled}
          placeholder="Name"
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          loadingText="none"
          isLoading={adding}
          disabled={disabled || !trimmed}
        >
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        They go to the waiting room. Players who scan your QR code or open your
        join link land there too.
      </p>
    </form>
  );
}
