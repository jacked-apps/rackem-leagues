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
import { useParams } from 'react-router-dom';
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
import { useBracket, useAdvanceWinner, useCloseBracket } from '@/api/hooks/useBrackets';
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
  const closeBracket = useCloseBracket();
  const [pending, setPending] = useState<PendingPick | null>(null);

  useBracketRealtime(bracketId, queryKeys.brackets.detail(bracketId ?? ''));

  const view = useMemo(
    () => (data ? buildBracketView(data.participants, data.matches) : null),
    [data]
  );
  const champion = view ? championName(view) : null;

  if (isLoading) return <Centered>Loading bracket…</Centered>;
  if (isError || !data || !view) return <Centered>Bracket not found.</Centered>;

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

  const handleClose = async () => {
    if (!bracketId) return;
    try {
      await closeBracket.mutateAsync(bracketId);
      toast.success('Bracket closed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not close the bracket.');
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
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
              <Button variant="destructive" loadingText="Closing…" onClick={handleClose}>
                Close bracket
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
