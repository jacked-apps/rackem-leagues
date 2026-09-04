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
import { Link, useParams } from 'react-router-dom';
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
import {
  useBracket,
  useAdvanceWinner,
  useReopenMatch,
  useCloseBracket,
} from '@/api/hooks/useBrackets';
import { buildBracketView, championName } from './bracketViewModel';
import { BracketTree } from './BracketTree';
import { useBracketRealtime } from './useBracketRealtime';

/** A slot the organizer tapped, awaiting confirmation. */
interface PendingPick {
  matchId: string;
  participantId: string;
  name: string;
}

export function BracketView() {
  const { bracketId } = useParams<{ bracketId: string }>();
  const { data, isLoading, isError } = useBracket(bracketId);
  const advance = useAdvanceWinner(bracketId ?? '');
  const reopen = useReopenMatch(bracketId ?? '');
  const closeBracket = useCloseBracket();
  const [pending, setPending] = useState<PendingPick | null>(null);
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  useBracketRealtime(bracketId, queryKeys.brackets.detail(bracketId ?? ''));

  const view = useMemo(
    () => (data ? buildBracketView(data.participants, data.matches) : null),
    [data]
  );
  const champion = view ? championName(view) : null;

  if (isLoading) return <Centered>Loading tournament…</Centered>;
  if (isError || !data || !view) return <Centered>Tournament not found.</Centered>;

  const { bracket } = data;

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
          />
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
            <AlertDialogTitle>Reopen this match?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the recorded winner and puts the match back to
              unplayed so you can re-enter it. (If a later match has already
              been played, reopen that one first.)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReopen}>Reopen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Share link copied.');
  } catch {
    toast.error('Could not copy — link: ' + url);
  }
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
