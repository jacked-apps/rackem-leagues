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
 *
 * Focus RETURNS to the box after each successful add, so entering a group is
 * type-enter-type-enter rather than type-enter-reach-for-the-box. Adding names
 * one after another is the normal case, not the exception.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
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
  // Scoped to this form rather than a document-wide lookup, and not a ref on
  // <Input> — that is a plain function component, so React 18 would not pass one.
  const formRef = useRef<HTMLFormElement>(null);
  /**
   * A successful add asked for the cursor back. STATE, not a ref: a ref change
   * schedules no render, so the effect below would never run for a save quick
   * enough that `disabled` never visibly flipped.
   */
  const [wantsFocus, setWantsFocus] = useState(false);

  /**
   * Return the cursor once the box can actually take it.
   *
   * The parent disables this form while an add is in flight, and a disabled
   * input silently refuses focus() — so calling it the instant the save
   * resolved did nothing at all. This runs when the request is made AND
   * whenever `disabled` clears, so the cursor lands either way, and whether the
   * add came from Enter or from the button.
   */
  useEffect(() => {
    if (!wantsFocus || disabled) return;
    setWantsFocus(false);
    formRef.current?.querySelector('input')?.focus();
  }, [wantsFocus, disabled]);

  const trimmed = name.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      // Only clear on success — a failed add would otherwise lose what they typed.
      setName('');
      // Ask for the cursor back; the effect grants it once the box can take it.
      setWantsFocus(true);
    } catch {
      // Swallowed on purpose: the caller reports the failure (it owns the toast),
      // and an uncaught rejection here would just be an unhandled promise. The
      // typed name stays in the box so the organizer can retry it.
    } finally {
      setAdding(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <Label htmlFor="add-walkup">Add a player</Label>
      <div className="flex gap-2">
        <Input
          id="add-walkup"
          value={name}
          disabled={disabled}
          placeholder="Name"
          onChange={(e) => setName(e.target.value)}
        />
        {/* See AddRegisteredPlayer: distinct accessible name, same visible text. */}
        <Button
          type="submit"
          variant="outline"
          aria-label="Add this name"
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
