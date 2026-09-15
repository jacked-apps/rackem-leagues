/**
 * @fileoverview A tappable past-player row + its action menu (Phase C, Unit C3).
 *
 * Every name on the setup screen behaves the same way — tap it, get the menu for
 * that person — so the past-players list works like the two groups above it
 * rather than being a special one-tap-only list.
 *
 * Two actions: add them to this tournament, or forget them. Forgetting is the
 * organizer's housekeeping valve on a list that is otherwise sticky forever, so
 * it takes a confirming second tap and the copy is explicit that it changes
 * their saved list and nothing about any tournament.
 */

import { useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RosterRow } from './hopperGroups';
import { HopperIdentityLine } from './HopperIdentityLine';

interface PastPlayerMenuProps {
  row: RosterRow;
  /** Put them in this tournament's waiting room. */
  onAdd: () => void;
  /** Drop them from the organizer's remembered past players. */
  onForget: () => void;
  disabled?: boolean;
}

export function PastPlayerMenu({
  row,
  onAdd,
  onForget,
  disabled = false,
}: PastPlayerMenuProps) {
  const [confirmingForget, setConfirmingForget] = useState(false);
  const { identity } = row;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
        >
          <HopperIdentityLine identity={identity} duplicateName={row.duplicateName} />
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Add</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onAdd}>Add to this tournament</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmingForget(true)}
          >
            Forget this player
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmingForget} onOpenChange={setConfirmingForget}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget {identity.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {identity.kind === 'registered'
                ? "They come off your past players list, so they won't be suggested next time. Nothing changes for any tournament they've played, and adding them again puts them back on the list."
                : "The saved name comes off your past players list. Nothing changes for any tournament they've played, and typing the name again saves it back."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmingForget(false);
                onForget();
              }}
            >
              Forget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
