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
 *   3. PAST PLAYERS — everyone they've run a tournament with before (registered
 *      players AND remembered walk-up names), one tap to add.
 *
 * Stacked rather than tabbed because admitting is a back-and-forth between the
 * groups; tabs would lose the organizer's place on every tap. A player is only
 * ever in one group (see buildHopperGroups), so tapping a past player visibly
 * moves them up to Waiting, and admitting moves them up again.
 *
 * Tap any name for its action menu. Rendered inside the tournament's setup view.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useBracketHopper,
  useBracketRoster,
  useAdmitHopperEntry,
  useSetHopperPaidStatus,
  useEjectHopperEntry,
  useAddRegisteredToHopper,
  useAddWalkupToHopper,
  useForgetRosterEntry,
  useAddPremiumFeature,
} from '@/api/hooks/useBrackets';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { buildHopperGroups, type HopperRow } from './hopperGroups';
import type { AddRegisteredResult } from '@/api/mutations/brackets';
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
import { getPremiumFeature, formatPrice } from './premiumFeatures';
import { AddRegisteredPlayer } from './AddRegisteredPlayer';
import { AddWalkupForm } from './AddWalkupForm';
import { HopperEntryMenu } from './HopperEntryMenu';
import { HopperGroup } from './HopperGroup';
import { PastPlayerMenu } from './PastPlayerMenu';

interface HopperViewProps {
  bracketId: string;
  /**
   * Standing instruction: when the organizer starts, sweep whoever is still
   * waiting into the tournament. It lives HERE rather than on the checkout card
   * because it is a rule about this list — and it can be set before anyone has
   * arrived, so it shows even when the list is empty.
   */
  includeWaiting?: boolean;
  onIncludeWaitingChange?: (include: boolean) => void;
  /**
   * This tournament bought the entry-fee tracker. Sold separately from sign-up
   * links, so without it the screen shows no paid/unpaid anything.
   */
  trackEntryFees?: boolean;
  /** Once the tournament starts the lists are a record, not a workspace. */
  readOnly?: boolean;
}

export function HopperView({
  bracketId,
  includeWaiting = false,
  onIncludeWaitingChange,
  trackEntryFees = false,
  readOnly = false,
}: HopperViewProps) {
  const hopper = useBracketHopper(bracketId);
  const roster = useBracketRoster(bracketId);

  const admit = useAdmitHopperEntry(bracketId);
  const setPaid = useSetHopperPaidStatus(bracketId);
  const eject = useEjectHopperEntry(bracketId);
  const addRegistered = useAddRegisteredToHopper(bracketId);
  const addWalkup = useAddWalkupToHopper(bracketId);
  const forget = useForgetRosterEntry(bracketId);
  const addFeature = useAddPremiumFeature(bracketId);

  /**
   * The upsell, held open while the organizer decides.
   *
   * A promise resolver rather than a callback: the checkbox awaits the answer,
   * so a "no" leaves the box exactly as it was instead of ticking and undoing.
   */
  const [feeOffer, setFeeOffer] = useState<((bought: boolean) => void) | null>(null);

  const groups = useMemo(
    () => buildHopperGroups(hopper.data ?? [], roster.data ?? []),
    [hopper.data, roster.data]
  );

  // Anyone already here is hidden from search: the database would refuse them,
  // and an option that always errors is worse than no option.
  const memberIdsInHopper = useMemo(
    () => (hopper.data ?? []).flatMap((e) => (e.member_id ? [e.member_id] : [])),
    [hopper.data]
  );

  // A write in flight disables the menus — the lists re-order underneath a
  // successful one, and a second tap during that shuffle would hit the wrong row.
  const locked =
    readOnly ||
    admit.isPending ||
    setPaid.isPending ||
    eject.isPending ||
    addRegistered.isPending ||
    addWalkup.isPending ||
    forget.isPending;

  if (hopper.isLoading) return <Note>Loading players…</Note>;
  if (hopper.isError) return <Note>Couldn't load the players for this tournament.</Note>;

  const { counts } = groups;

  /** Both hopper groups render identically — only the rows and copy differ. */
  const entryRow = (row: HopperRow) => (
    <li key={row.id}>
      <HopperEntryMenu
        row={row}
        trackEntryFees={trackEntryFees}
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

      {/*
        Three ways in, in the order an organizer reaches for them: look up
        someone with an account, or type a name for someone without one. The
        third — players adding themselves by QR or link — needs nothing here.
      */}
      <AddRegisteredPlayer
        disabled={locked}
        excludeMemberIds={memberIdsInHopper}
        onAdd={async (memberId) => {
          const result = await addRegistered.mutateAsync(memberId);
          if (result.ok) return null;
          return registeredAddProblem(result);
        }}
      />

      <AddWalkupForm
        trackEntryFees={trackEntryFees}
        onRequestEntryFees={() => new Promise<boolean>((resolve) => setFeeOffer(() => resolve))}
        // Unticking gives the feature back, while it is still within its
        // allowance. A refusal is reported and the box stays ticked, because
        // the feature really is still on.
        // Rethrown after reporting, so the form knows to keep the typed name.
        onAdd={(entry) =>
          addWalkup.mutateAsync(entry).catch((err: unknown) => {
            reportError(err);
            throw err;
          })
        }
        disabled={locked}
      />

      <HopperGroup
        tone="in"
        title="In the tournament"
        count={counts.official}
        empty="Nobody added yet. Tap a waiting player below to add them."
      >
        {groups.official.map(entryRow)}
      </HopperGroup>

      <HopperGroup
        tone="waiting"
        title="Waiting to be added"
        count={counts.waiting}
        // The add form above already says where waiting players come from.
        empty="Nobody waiting yet."
      >
        {groups.waiting.map(entryRow)}
      </HopperGroup>

      {onIncludeWaitingChange && (
        <div className="flex items-start gap-2 px-2">
          <Checkbox
            id="auto-add-waiting"
            checked={includeWaiting}
            disabled={locked}
            onCheckedChange={(c) => onIncludeWaitingChange(c === true)}
          />
          <Label htmlFor="auto-add-waiting" className="cursor-pointer font-normal">
            <span className="text-sm">Add anyone still waiting when I start</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              {trackEntryFees ? 'They go in as unpaid.' : 'Off by default.'}
            </span>
          </Label>
        </div>
      )}

      <HopperGroup
        tone="aside"
        title="Past players"
        count={counts.past}
        empty="Players from your past tournaments show up here for one-tap adding."
      >
        {groups.past.map((row) => (
          <li key={row.key}>
            <PastPlayerMenu
              row={row}
              disabled={locked}
              onAdd={() =>
                run(
                  // A remembered walk-up has no account to link to — re-adding
                  // them just re-types the name we saved on their behalf.
                  row.player.member_id
                    ? addRegistered.mutateAsync(row.player.member_id)
                    : addWalkup.mutateAsync({ displayName: row.identity.displayName })
                )
              }
              onForget={() =>
                run(
                  forget.mutateAsync(
                    row.player.member_id
                      ? { memberId: row.player.member_id }
                      : { displayName: row.player.display_name }
                  )
                )
              }
            />
          </li>
        ))}
      </HopperGroup>

      <AlertDialog
        open={feeOffer !== null}
        onOpenChange={(open) => {
          // Dismissing any other way is a "no", so the box never ticks itself.
          if (!open && feeOffer) {
            feeOffer(false);
            setFeeOffer(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* Eyebrow, so it is unmistakably an offer rather than a setting. */}
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Premium feature
            </p>
            <AlertDialogTitle>
              {getPremiumFeature('payment_tracker')?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getPremiumFeature('payment_tracker')?.blurb}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 text-sm">
            <p>
              <span className="font-medium">
                {formatPrice(getPremiumFeature('payment_tracker')?.priceCents ?? 0)}
              </span>
              , added to what you pay when you start this tournament — nothing is
              charged now.
            </p>

            {/*
              Only states what is actually enforced. There is no way to remove a
              feature once added, so this is true today. The 24-hour
              delete/restart lockout Ed wants is NOT built, and warning about a
              rule nothing enforces just teaches people to skip warnings.
            */}
            {/*
              States the rule that is actually enforced by
              remove_premium_feature: removable inside a small allowance, locked
              once genuinely used. Deliberately NOT the 24-hour delete/restart
              lockout — nothing enforces that, and a warning people discover is
              a bluff teaches them to ignore the real ones.
            */}
            {/*
              text-warning, NOT text-warning-foreground. The -foreground token is
              near-black for BOTH themes because it is meant to sit on a SOLID
              amber fill; on a 10% tint it vanishes into a dark background. The
              documented pairing for a tinted callout is the tinted background,
              a 40% border and the plain colour token as text (see the status
              tokens in index.css).
            */}
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
              <span className="font-semibold">Heads up:</span> you can take this
              back off while you're still setting up. Once you've marked more
              than 5 players paid, it stays on the bill.
            </p>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="mt-0">Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const resolve = feeOffer;
                setFeeOffer(null);
                try {
                  const result = await addFeature.mutateAsync('payment_tracker');
                  if (result.ok) {
                    toast.success('Entry-fee tracker added.');
                    resolve?.(true);
                    return;
                  }
                  reportError(new Error('Could not add it — try again.'));
                } catch (err) {
                  reportError(err);
                }
                resolve?.(false);
              }}
            >
              Add it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Surface a failed write instead of letting it fail silently — a row that simply
 * doesn't move reads as an unresponsive tap. The cache invalidation on success
 * already re-renders the lists, so there's nothing to do on the happy path.
 */
function run(promise: Promise<unknown>): void {
  promise.catch(reportError);
}

/**
 * Turn a refused search-add into a sentence that says what to do about it. Each
 * of these is an ordinary outcome rather than a fault, so none should read like
 * an error.
 */
function registeredAddProblem(result: AddRegisteredResult): string {
  switch (result.reason) {
    case 'name_taken':
      return `Someone is already on this list as ${result.name}. They'd need to change their nickname first.`;
    case 'not_accepting':
      return 'This tournament has already started.';
    case 'not_registered':
      return "That player doesn't have an account — add them by name instead.";
    case 'no_such_player':
      return 'That player could not be found.';
    default:
      return "That didn't go through — try again.";
  }
}

/** Show a failed write as the organizer-facing sentence it usually already is. */
function reportError(err: unknown): void {
  toast.error(err instanceof Error ? err.message : 'That didn’t go through.');
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
