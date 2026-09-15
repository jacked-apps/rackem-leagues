/**
 * @fileoverview A tappable hopper entry + its action menu (Phase C, Unit C3).
 *
 * The whole row is the trigger — the organizer taps a name and gets the menu for
 * that person. Which actions appear depends on where the row sits:
 *
 *   • WAITING  → add them to the tournament, Remove.
 *   • IN THE TOURNAMENT → Remove.
 *
 * Every mention of money is gated on `trackEntryFees` (the payment_tracker
 * feature). The features are sold separately, so a tournament that bought
 * sign-up links but not the entry-fee tracker must never see "Add as paid" —
 * that would both give the tracker away and clutter the menu of an organizer
 * who collects nothing at the door. With it off, admitting is one item and the
 * stored paid flag simply defaults to unpaid, unseen.
 *
 * Admitting and flipping paid are non-destructive, so they fire on the tap.
 * Remove deletes the entry, so it takes a second confirming tap (project
 * precedent for destructive actions) and the copy says exactly what survives —
 * which depends on the row, so it is worth getting right rather than hedging.
 * See removalConsequence.
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
import type { HopperRow } from './hopperGroups';
import { HopperIdentityLine } from './HopperIdentityLine';
import { removalConsequence } from './removalConsequence';

interface HopperEntryMenuProps {
  row: HopperRow;
  /** Move a candidate onto the official list with the organizer's paid call. */
  onAdmit: (paidStatus: 'paid' | 'unpaid') => void;
  /** Flip an already-official entry's paid flag. */
  onSetPaid: (paidStatus: 'paid' | 'unpaid') => void;
  /** This tournament bought the entry-fee tracker — show the money actions. */
  trackEntryFees?: boolean;
  /** Delete the entry from this tournament. */
  onEject: () => void;
  /** Setup is over (or a write is in flight) — show the row, take no actions. */
  disabled?: boolean;
}

export function HopperEntryMenu({
  row,
  onAdmit,
  onSetPaid,
  onEject,
  trackEntryFees = false,
  disabled = false,
}: HopperEntryMenuProps) {
  const [confirmingEject, setConfirmingEject] = useState(false);
  const { entry, identity } = row;
  const isOfficial = entry.status === 'official';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={disabled}
          className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
        >
          <HopperIdentityLine identity={identity} duplicateName={row.duplicateName} />
          {isOfficial ? (
            trackEntryFees && (
              <span
                className={`shrink-0 text-xs font-medium ${
                  entry.paid_status === 'paid' ? 'text-success' : 'text-muted-foreground'
                }`}
              >
                {entry.paid_status === 'paid' ? 'Paid' : 'Unpaid'}
              </span>
            )
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">
              {arrivalLabel(entry.added_via)}
            </span>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          {isOfficial
            ? trackEntryFees && (
                <DropdownMenuItem
                  onSelect={() => onSetPaid(entry.paid_status === 'paid' ? 'unpaid' : 'paid')}
                >
                  {entry.paid_status === 'paid' ? 'Mark as unpaid' : 'Mark as paid'}
                </DropdownMenuItem>
              )
            : trackEntryFees ? (
                <>
                  <DropdownMenuItem onSelect={() => onAdmit('paid')}>
                    Add as paid
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onAdmit('unpaid')}>
                    Add as unpaid
                  </DropdownMenuItem>
                </>
              ) : (
                // No tracker: admitting is one plain action. The stored flag
                // defaults to unpaid and is never shown.
                <DropdownMenuItem onSelect={() => onAdmit('unpaid')}>
                  Add to tournament
                </DropdownMenuItem>
              )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmingEject(true)}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmingEject} onOpenChange={setConfirmingEject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {identity.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>{removalConsequence(row)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmingEject(false);
                onEject();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** How this candidate got here — useful context before the organizer admits them. */
function arrivalLabel(addedVia: HopperRow['entry']['added_via']): string {
  if (addedVia === 'qr') return 'Scanned in';
  if (addedVia === 'link') return 'Joined by link';
  return 'Added by you';
}
