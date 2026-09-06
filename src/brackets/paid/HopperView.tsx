/**
 * @fileoverview The organizer's hopper screen for a paid tournament (Phase C, Unit C3).
 *
 * Everything about who is playing, before the bracket starts. Three stacked
 * groups under one sticky count bar, so the organizer always knows the shape of
 * the room without scrolling:
 *
 *   1. IN THE TOURNAMENT — the official list; this is what Start seeds.
 *   2. WAITING TO BE ADDED — people who scanned the QR, opened the link, or were
 *      added by the organizer, but haven't been let in yet.
 *   3. PAST PLAYERS — everyone they've run a tournament with before, one tap to add.
 *
 * Stacked rather than tabbed because admitting is a back-and-forth between the
 * groups; tabs would lose the organizer's place on every tap. A player is only
 * ever in one group (see buildHopperGroups), so tapping a past player visibly
 * moves them up to Waiting, and admitting moves them up again.
 *
 * Tap any name for its action menu. Rendered inside the tournament's setup view.
 */

import { useMemo } from 'react';
import { toast } from 'sonner';
import {
  useBracketHopper,
  useBracketRoster,
  useAdmitHopperEntry,
  useSetHopperPaidStatus,
  useEjectHopperEntry,
  useAddRegisteredToHopper,
} from '@/api/hooks/useBrackets';
import { buildHopperGroups, type HopperRow } from './hopperGroups';
import { HopperEntryMenu } from './HopperEntryMenu';
import { HopperGroup } from './HopperGroup';
import { HopperIdentityLine } from './HopperIdentityLine';

interface HopperViewProps {
  bracketId: string;
  /** Once the tournament starts the lists are a record, not a workspace. */
  readOnly?: boolean;
}

export function HopperView({ bracketId, readOnly = false }: HopperViewProps) {
  const hopper = useBracketHopper(bracketId);
  const roster = useBracketRoster(bracketId);

  const admit = useAdmitHopperEntry(bracketId);
  const setPaid = useSetHopperPaidStatus(bracketId);
  const eject = useEjectHopperEntry(bracketId);
  const addRegistered = useAddRegisteredToHopper(bracketId);

  const groups = useMemo(
    () => buildHopperGroups(hopper.data ?? [], roster.data ?? []),
    [hopper.data, roster.data]
  );

  // A write in flight disables the menus — the lists re-order underneath a
  // successful one, and a second tap during that shuffle would hit the wrong row.
  const locked =
    readOnly ||
    admit.isPending ||
    setPaid.isPending ||
    eject.isPending ||
    addRegistered.isPending;

  if (hopper.isLoading) return <Note>Loading players…</Note>;
  if (hopper.isError) return <Note>Couldn't load the players for this tournament.</Note>;

  const { counts } = groups;

  /** Both hopper groups render identically — only the rows and copy differ. */
  const entryRow = (row: HopperRow) => (
    <li key={row.id}>
      <HopperEntryMenu
        row={row}
        disabled={locked}
        onAdmit={(paidStatus) => run(admit.mutateAsync({ entryId: row.id, paidStatus }))}
        onSetPaid={(paidStatus) => run(setPaid.mutateAsync({ entryId: row.id, paidStatus }))}
        onEject={() => run(eject.mutateAsync(row.id))}
      />
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-4 border-b bg-background px-1 py-2 text-sm">
        <span className="font-semibold">In {counts.official}</span>
        <span className="text-muted-foreground">Waiting {counts.waiting}</span>
        <span className="text-muted-foreground">Past {counts.past}</span>
      </div>

      <HopperGroup
        title="In the tournament"
        count={counts.official}
        empty="Nobody added yet. Tap a waiting player below to add them."
      >
        {groups.official.map(entryRow)}
      </HopperGroup>

      <HopperGroup
        title="Waiting to be added"
        count={counts.waiting}
        empty="Nobody waiting. Players who scan your QR code or open your link land here."
      >
        {groups.waiting.map(entryRow)}
      </HopperGroup>

      <HopperGroup
        title="Past players"
        count={counts.past}
        empty="Players from your past tournaments show up here for one-tap adding."
      >
        {groups.past.map((row) => (
          <li key={row.memberId}>
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                run(
                  addRegistered.mutateAsync({
                    memberId: row.memberId,
                    displayName: row.identity.displayName,
                  })
                )
              }
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
            >
              <HopperIdentityLine identity={row.identity} duplicateName={row.duplicateName} />
              <span className="shrink-0 text-xs font-medium text-muted-foreground">Add</span>
            </button>
          </li>
        ))}
      </HopperGroup>
    </div>
  );
}

/**
 * Surface a failed write instead of letting it fail silently — a row that simply
 * doesn't move reads as an unresponsive tap. The cache invalidation on success
 * already re-renders the lists, so there's nothing to do on the happy path.
 */
function run(promise: Promise<unknown>): void {
  promise.catch((err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'That didn’t go through.');
  });
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
