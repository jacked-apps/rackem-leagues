/**
 * @fileoverview One join-request card on the approve surface — the guided
 * "who is this?" decision, informative enough to answer the door at scale.
 *
 * Collapsed, it's a scannable summary: who's asking, which team (+ league), and
 * a "captain spot still open" flag when that team's captain is still an
 * unregistered placeholder — the signal an LO juggling dozens of teams needs
 * without opening anything.
 *
 * Expanded, it shows the team's FULL roster:
 *   - claimable placeholder spots as tap-to-connect targets (the captain spot
 *     flagged + listed first) — tapping links the real account into that
 *     placeholder so their stats carry over, gated by a confirm because a merge
 *     transfers a record and can't be casually undone.
 *   - already-registered members as non-tappable recognition context.
 *
 * The footgun guard: "just add them as new" is the easy way to silently create a
 * duplicate (and leave the captain spot unfilled). When the team has any open
 * spot the incomer might fill — a placeholder OR a still-placeholder captain —
 * plain-add becomes a deliberate, confirmed action. The guard keys off the feed
 * flags (not the roster fetch), so a roster that fails to load can't quietly
 * re-open the footgun.
 *
 * The roster is fetched per-card and only on expand, so the collapsed list stays
 * light for an LO with many teams.
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useTeamRosterForApprover } from '@/api/hooks/useTeamRosterForApprover';
import type {
  ApproverJoinRequest,
  TeamRosterMember,
} from '@/api/queries/teamJoin';

interface JoinRequestCardProps {
  req: ApproverJoinRequest;
  /** True while this card's request is mid-approve (disables its controls). */
  busy: boolean;
  /** Fires the decision. claimedMemberId is the placeholder to merge into. */
  onApprove: (
    req: ApproverJoinRequest,
    action: 'add' | 'replace' | 'decline',
    claimedMemberId?: string | null,
  ) => void;
}

export const JoinRequestCard: React.FC<JoinRequestCardProps> = ({
  req,
  busy,
  onApprove,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Roster loads lazily — only once the card is expanded.
  const {
    data: roster,
    isLoading: rosterLoading,
    isError: rosterError,
  } = useTeamRosterForApprover(expanded ? req.team_id : undefined);

  const connectTargets = roster?.filter((m) => m.claimable) ?? [];
  const registeredMembers = roster?.filter((m) => !m.claimable) ?? [];

  // Is there any open spot this person might fill? Derived from the FEED (not the
  // roster fetch), so the guard holds even if the roster fails to load: an open
  // placeholder OR a captain who's still a placeholder.
  const hasConnectTarget = req.has_open_placeholders || req.captain_is_placeholder;

  // Confirm state: a placeholder we're about to merge into, the guarded plain-add,
  // and the decline.
  const [confirmMerge, setConfirmMerge] = useState<TeamRosterMember | null>(null);
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {/* Collapsed summary — the scannable row. Tap to expand the roster. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{req.requester_name} accepted the invite</p>
              <p className="text-sm text-muted-foreground">
                {req.team_name}
                {req.league_name ? ` · ${req.league_name}` : ''}
              </p>
            </div>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </div>
          {req.captain_is_placeholder && (
            <span className="mt-2 inline-block rounded-full bg-highlight/15 px-2 py-0.5 text-xs font-medium text-highlight">
              Captain spot still open
            </span>
          )}
        </button>

        {expanded && (
          <div className="space-y-2">
            {rosterLoading && (
              <p className="text-sm text-muted-foreground">Loading the team…</p>
            )}

            {rosterError && (
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load the roster. You can still add them below.
              </p>
            )}

            {!rosterLoading && roster && (
              <>
                {connectTargets.length > 0 && (
                  <>
                    <p className="text-sm">
                      Is this one of your players? Tap their name to connect them and
                      keep their stats.
                    </p>
                    {connectTargets.map((m) => (
                      <Button
                        key={m.member_id}
                        variant="outline"
                        className="w-full justify-between"
                        disabled={busy}
                        onClick={() => setConfirmMerge(m)}
                      >
                        <span className="flex items-center gap-2">
                          {m.display_name}
                          {m.is_captain && (
                            <span className="rounded-full bg-highlight/15 px-2 py-0.5 text-xs font-medium text-highlight">
                              captain
                            </span>
                          )}
                        </span>
                        {m.has_stats && (
                          <span className="text-xs text-muted-foreground">has record</span>
                        )}
                      </Button>
                    ))}
                  </>
                )}

                {registeredMembers.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Already on the team
                    </p>
                    {registeredMembers.map((m) => (
                      <div
                        key={m.member_id}
                        className="flex items-center gap-2 px-1 text-sm text-muted-foreground"
                      >
                        <span>{m.display_name}</span>
                        {m.is_captain && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            captain
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Add — guarded when there's an open spot the incomer might fill, a
                plain single action when there isn't. */}
            {hasConnectTarget ? (
              <Button
                variant="secondary"
                className="w-full"
                disabled={busy}
                onClick={() => setConfirmAdd(true)}
              >
                Not one of these — just add them as new
              </Button>
            ) : (
              <Button
                className="w-full"
                loadingText="Adding…"
                isLoading={busy}
                disabled={busy}
                onClick={() => onApprove(req, 'add')}
              >
                Add to the team
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full"
              disabled={busy}
              onClick={() => setConfirmDecline(true)}
            >
              Decline
            </Button>
          </div>
        )}
      </CardContent>

      {/* Tap-a-name confirm — guards against a mis-tap on the connect list. Copy
          splits on whether the placeholder carries a match record:
          - has a record → it's a real merge (stats move over); ask "same person?"
            and note an operator can unmerge it if it's wrong.
          - no record → nothing to transfer, so it's just adding them to that
            spot — plain "add" language, no merge talk.
          The captain spot is called out so seating a captain is unmistakable. */}
      <AlertDialog open={!!confirmMerge} onOpenChange={(o) => !o && setConfirmMerge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMerge?.has_stats
                ? 'Are these the same person?'
                : confirmMerge?.is_captain
                  ? 'Make them the captain?'
                  : 'Add them to the team?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMerge &&
                (confirmMerge.has_stats
                  ? `Connect ${req.requester_name} to ${confirmMerge.display_name} (has a match record)${confirmMerge.is_captain ? ', the captain spot' : ''}. Their spot and stats move over to ${req.requester_name}. An operator can unmerge it later if it's wrong.`
                  : confirmMerge.is_captain
                    ? `Connect ${req.requester_name} to the captain spot (${confirmMerge.display_name}). They become the team's registered captain.`
                    : `Add ${req.requester_name} to ${req.team_name} as ${confirmMerge.display_name}.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmMerge && onApprove(req, 'replace', confirmMerge.member_id)
              }
            >
              {confirmMerge?.has_stats
                ? 'Yes, same person'
                : confirmMerge?.is_captain
                  ? 'Make captain'
                  : 'Add to team'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Guarded plain-add confirm — the footgun stop. Only reached when the team
          has an open spot this person might fill, so spell out the consequence. */}
      <AlertDialog open={confirmAdd} onOpenChange={setConfirmAdd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add {req.requester_name} as a new player?</AlertDialogTitle>
            <AlertDialogDescription>
              {req.requester_name} won&apos;t be connected to any open spot on{' '}
              {req.team_name}
              {req.captain_is_placeholder
                ? ', and the captain spot will stay unfilled'
                : ''}
              . Add them as a brand-new player instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onApprove(req, 'add')}>
              Add as new
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline confirm. */}
      <AlertDialog open={confirmDecline} onOpenChange={setConfirmDecline}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {req.requester_name} won&apos;t be added to {req.team_name}. They can ask
              again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onApprove(req, 'decline')}>
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
