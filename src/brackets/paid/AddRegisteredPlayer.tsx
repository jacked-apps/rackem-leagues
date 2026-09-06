/**
 * @fileoverview Search for a registered player and add them (Unit C3).
 *
 * The organizer's third way into the hopper, alongside the QR/link players use
 * themselves and the typed name that creates a walk-up. Wraps the app's existing
 * member search — which already searches by name OR player number — rather than
 * growing a second one.
 *
 * REGISTERED PLAYERS ONLY, deliberately. Placeholder players belong to a
 * league's team structure; a tournament has no org and no teams, and offering
 * them here would let a bar tournament reach into league data it has no
 * relationship with. Someone who isn't in the app is a walk-up, which is what
 * the name box next to this is for.
 *
 * The chips are limited to "All" for the same reason: My Org / State / Staff are
 * league scopes, and a tournament organizer is just a player.
 */

import { useState } from 'react';
import { MemberSearchCombobox } from '@/components/MemberSearchCombobox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface AddRegisteredPlayerProps {
  /**
   * Members already in this tournament, so they can't be offered twice — the
   * database would reject it, and an option that always errors is worse than
   * no option.
   */
  excludeMemberIds: string[];
  /** Add this member. Returns a message to show, or null when it worked. */
  onAdd: (memberId: string) => Promise<string | null>;
  disabled?: boolean;
}

export function AddRegisteredPlayer({
  excludeMemberIds,
  onAdd,
  disabled = false,
}: AddRegisteredPlayerProps) {
  const [selected, setSelected] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!selected || adding) return;
    setAdding(true);
    setProblem(null);
    try {
      const message = await onAdd(selected);
      setProblem(message);
      // Only clear on success, so a rejection leaves the pick visible next to
      // the reason it was refused.
      if (!message) setSelected('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="add-registered">Search players</Label>
      <div className="flex gap-2">
        <MemberSearchCombobox
          id="add-registered"
          value={selected}
          onValueChange={(id) => {
            setSelected(id);
            setProblem(null);
          }}
          placeholder="Name or player number"
          disabled={disabled}
          excludeIds={excludeMemberIds}
          filters={['all']}
          defaultFilter="all"
          registeredOnly
          className="min-w-0 flex-1"
        />
        {/*
          Both add buttons on this screen read "Add"; the accessible name says
          which is which, so they aren't two identical controls to anyone
          navigating by name rather than by sight.
        */}
        <Button
          type="button"
          variant="outline"
          aria-label="Add the player you searched for"
          loadingText="none"
          isLoading={adding}
          disabled={disabled || !selected}
          onClick={() => void handleAdd()}
        >
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        For players with an account. Anyone else, type their name below.
      </p>
      {problem && <p className="text-sm text-destructive">{problem}</p>}
    </div>
  );
}
