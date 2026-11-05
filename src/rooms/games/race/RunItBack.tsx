/**
 * @fileoverview "Run it back" — the panel under a finished room race.
 *
 * Either player asks; the other accepts (the next race opens on both phones,
 * same players and settings) or denies (the request clears and either may ask
 * again). Each state is told in words, never by colour:
 * - nobody asked → the players get a "Run it back" button
 * - I asked → "Waiting for <them> to answer"
 * - they asked → Accept / Deny
 * - a spectator sees who asked, with no buttons
 *
 * The request lives on the room's link row, so the room's channel carries it
 * to the other phone; this panel only reads `requestedBy`.
 */
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { roomRaceRefusalCopy } from './roomRaceRefusalCopy';
import { useAnswerRoomRaceRematch, useRequestRoomRaceRematch } from './useRoomRace';
import type { RoomRaceResult } from './roomRaceApi';

interface RunItBackProps {
  roomId: string;
  myMemberId: string;
  homeMemberId: string;
  awayMemberId: string;
  /** The member who asked and is waiting, or null. */
  requestedBy: string | null;
  /** Display name for a member, from the room's phones. */
  nameOf: (memberId: string | undefined) => string | undefined;
}

export function RunItBack({ roomId, myMemberId, homeMemberId, awayMemberId, requestedBy, nameOf }: RunItBackProps) {
  const request = useRequestRoomRaceRematch(roomId);
  const answer = useAnswerRoomRaceRematch(roomId);
  const isPlayer = myMemberId === homeMemberId || myMemberId === awayMemberId;
  const otherId = myMemberId === homeMemberId ? awayMemberId : homeMemberId;
  const otherName = nameOf(otherId) ?? 'the other player';
  const askerName = nameOf(requestedBy ?? undefined) ?? 'A player';
  const busy = request.isPending || answer.isPending;

  const report = (r: RoomRaceResult) => {
    if (!r.ok) toast.error(roomRaceRefusalCopy(r.reason));
  };

  let body;
  if (!requestedBy) {
    if (!isPlayer) return null;
    body = (
      <Button size="sm" className="w-full" loadingText="Asking…" disabled={busy} onClick={async () => report(await request.mutateAsync())}>
        Run it back
      </Button>
    );
  } else if (requestedBy === myMemberId) {
    body = <p className="text-sm">Waiting for {otherName} to answer.</p>;
  } else if (isPlayer) {
    body = (
      <div className="space-y-2">
        <p className="text-sm">{askerName} wants to run it back.</p>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" loadingText="Starting…" disabled={busy} onClick={async () => report(await answer.mutateAsync(true))}>
            Accept
          </Button>
          <Button size="sm" className="flex-1" variant="outline" loadingText="none" disabled={busy} onClick={async () => report(await answer.mutateAsync(false))}>
            Deny
          </Button>
        </div>
      </div>
    );
  } else {
    body = <p className="text-sm text-muted-foreground">{askerName} asked to run it back.</p>;
  }

  return (
    // A strip under the games, matching the who-breaks strip above them.
    <section className="mx-auto w-full max-w-2xl border-t py-2">{body}</section>
  );
}
