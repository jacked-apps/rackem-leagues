/**
 * @fileoverview Organizer live bracket view (Unit 5).
 *
 * The authed organizer's page for a running bracket: renders the live tree,
 * lets them tap a ready match's winner (with a confirm), shows the champion +
 * a close action when complete, and stays live via realtime. State is
 * data-derived — the view recomputes from the fetched rows on every render, so
 * a missed realtime event only delays.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryKeys } from '@/api/queryKeys';
import type { LateEntryResult } from '@/api/mutations/brackets';
import {
  useBracket,
  useAdvanceWinner,
  useSetMatchInProgress,
  useReopenMatch,
  useCloseBracket,
  useAddLateEntry,
} from '@/api/hooks/useBrackets';
import { buildBracketView, championName } from './bracketViewModel';
import { BracketTree } from './BracketTree';
import { EntryFeePanel } from './paid/EntryFeePanel';
import { LateEntryDialog } from './paid/LateEntryDialog';
import { hasPremiumFeature } from './paid/premiumFeatures';
import { copyText } from '@/utils/clipboard';
import { usesHopperSetup } from './paid/bracketDestination';
import { BracketLegend } from './BracketLegend';
import { useBracketRealtime } from './useBracketRealtime';

/** A slot the organizer tapped, awaiting confirmation. */
interface PendingPick {
  matchId: string;
  participantId: string;
  name: string;
}

export function BracketView() {
  const { bracketId } = useParams<{ bracketId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBracket(bracketId);
  const advance = useAdvanceWinner(bracketId ?? '');
  const setInProgress = useSetMatchInProgress(bracketId ?? '');
  const reopen = useReopenMatch(bracketId ?? '');
  const closeBracket = useCloseBracket();
  const lateEntry = useAddLateEntry(bracketId ?? '');
  const [pending, setPending] = useState<PendingPick | null>(null);
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  /** The bye an organizer is seating a latecomer into. */
  const [lateEntryMatchId, setLateEntryMatchId] = useState<string | null>(null);

  useBracketRealtime(bracketId, queryKeys.brackets.detail(bracketId ?? ''));

  const view = useMemo(
    () => (data ? buildBracketView(data.participants, data.matches) : null),
    [data]
  );
  const champion = view ? championName(view) : null;

  if (isLoading) return <Centered>Loading tournament…</Centered>;
  if (isError || !data || !view) return <Centered>Tournament not found.</Centered>;

  const { bracket } = data;

  // Reached by an old link or a back button: this tournament hasn't started and
  // its players are still gathering, so the bracket here would be empty.
  if (usesHopperSetup(bracket)) {
    return (
      <Centered>
        <p>This tournament hasn't started yet — players are still being added.</p>
        <Link to={`/brackets/${bracket.id}/setup`} className="underline">
          Go to the player list
        </Link>
      </Centered>
    );
  }

  /** Record the confirmed pick. */
  const confirmPick = async () => {
    if (!pending) return;
    const pick = pending;
    setPending(null);
    try {
      const advanced = await advance.mutateAsync({
        matchId: pick.matchId,
        winnerParticipantId: pick.participantId,
      });
      if (!advanced) {
        toast.info('That match was already decided — refreshed.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record the winner.');
    }
  };

  /** Undo the confirmed reopen. */
  const confirmReopen = async () => {
    if (!reopenId) return;
    const id = reopenId;
    setReopenId(null);
    try {
      await reopen.mutateAsync(id);
    } catch (err) {
      // The guard message (e.g. "reopen a later match first") is user-facing.
      toast.error(err instanceof Error ? err.message : 'Could not reopen the match.');
    }
  };

  const handleClose = async () => {
    if (!bracketId) return;
    setConfirmingClose(false);
    try {
      await closeBracket.mutateAsync(bracketId);
      toast.success('Tournament closed.');
      // Closing is terminal — return to the tournaments list rather than sit on
      // a now-dead page that will be swept.
      navigate('/brackets');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not close the bracket.');
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Link
        to="/brackets"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Tournaments
      </Link>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{bracket.name}</CardTitle>
          <div className="flex gap-2">
            {bracket.status !== 'closed' && (
              <Button
                variant="outline"
                loadingText="none"
                onClick={() => copyShareLink(bracket.share_token)}
              >
                Copy share link
              </Button>
            )}
            {bracket.status === 'complete' && (
              <Button
                variant="destructive"
                loadingText="none"
                onClick={() => setConfirmingClose(true)}
              >
                Close tournament
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {champion && (
            <div className="rounded-md bg-accent px-4 py-3 text-center font-semibold">
              🏆 {champion} wins!
            </div>
          )}
          {bracket.status === 'closed' && (
            <p className="text-sm text-muted-foreground">This bracket has been closed.</p>
          )}
          {bracket.status === 'live' && <BracketLegend />}
          <BracketTree
            view={view}
            readOnly={bracket.status !== 'live'}
            onPick={(matchId, participantId) =>
              setPending({
                matchId,
                participantId,
                name: resolveName(view, matchId, participantId) ?? 'this player',
              })
            }
            onReopen={(matchId) => setReopenId(matchId)}
            // Paid tournaments only — a quality-of-life extra for paying at
            // all, so the gate is the tier rather than any one feature.
            onLateEntry={
              bracket.tier === 'paid' ? (matchId) => setLateEntryMatchId(matchId) : undefined
            }
            onToggleInProgress={(matchId, inProgress) =>
              setInProgress.mutate({ matchId, inProgress })
            }
          />

          {/* Entry-fee tracker — only when the tournament bought that feature. */}
          {hasPremiumFeature(bracket.premium_features, 'payment_tracker') && (
            <EntryFeePanel
              bracketId={bracket.id}
              participants={data.participants}
              readOnly={bracket.status === 'closed'}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advance {pending?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This records {pending?.name} as the winner and moves them forward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPick}>Advance</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reopenId !== null} onOpenChange={(o) => !o && setReopenId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this match?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the recorded winner and puts the match back to
              unplayed so you can re-enter it. (If a later match has already
              been played, reset that one first.)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReopen}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LateEntryDialog
        open={lateEntryMatchId !== null}
        onOpenChange={(o) => !o && setLateEntryMatchId(null)}
        byeHolderName={byeHolderName(view, lateEntryMatchId) ?? 'This player'}
        onAdd={async (displayName) => {
          if (!lateEntryMatchId) return null;
          const result = await lateEntry.mutateAsync({
            matchId: lateEntryMatchId,
            displayName,
          });
          if (result.ok) {
            toast.success(`${result.name} is in.`);
            return null;
          }
          return lateEntryProblem(result);
        }}
      />

      <AlertDialog open={confirmingClose} onOpenChange={setConfirmingClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this tournament?</AlertDialogTitle>
            <AlertDialogDescription>
              The shared link keeps showing the final results for a while, then
              the tournament is removed automatically. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose}>Close tournament</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Copy the public share link for this bracket to the clipboard. */
async function copyShareLink(shareToken: string): Promise<void> {
  const url = `${window.location.origin}/brackets/share/${shareToken}`;
  if (await copyText(url)) {
    toast.success('Share link copied.');
    return;
  }
  toast.error('Could not copy the share link.');
}

/**
 * Turn a refused late entry into a sentence that says what happened. All of
 * these are ordinary outcomes at a busy tournament, not faults.
 */
function lateEntryProblem(result: LateEntryResult): string {
  switch (result.reason) {
    case 'already_played':
      return 'That bye has been used — the player has already played their next match.';
    case 'already_started':
      return 'Their next match has already started, so the bye is locked in.';
    case 'name_taken':
      return `${result.name} is already in this tournament — use a different name.`;
    case 'name_required':
      return 'Enter a name.';
    case 'name_too_long':
      return `Keep it to ${result.max ?? 24} characters.`;
    case 'not_live':
      return 'This tournament is not running.';
    case 'not_a_bye':
      return 'That match is not a bye.';
    case 'not_premium':
      return 'Late entry is a premium feature.';
    default:
      return "That didn't go through — try again.";
  }
}

/** The player currently holding a bye, for the confirm's wording. */
function byeHolderName(
  view: ReturnType<typeof buildBracketView>,
  matchId: string | null
): string | null {
  if (!matchId) return null;
  const all = [...view.winners.flat(), ...view.losers.flat(), ...view.grandFinal];
  const match = all.find((m) => m.id === matchId);
  return match?.home.name ?? match?.away.name ?? null;
}

/** Look up the tapped participant's display name across all sides. */
function resolveName(
  view: ReturnType<typeof buildBracketView>,
  matchId: string,
  participantId: string
): string | null {
  const all = [...view.winners.flat(), ...view.losers.flat(), ...view.grandFinal];
  const match = all.find((m) => m.id === matchId);
  if (!match) return null;
  if (match.home.participantId === participantId) return match.home.name;
  if (match.away.participantId === participantId) return match.away.name;
  return null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-16 text-center text-muted-foreground">
      {children}
    </div>
  );
}
