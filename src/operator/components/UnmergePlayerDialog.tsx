/**
 * @fileoverview UnmergePlayerDialog
 *
 * Deliberate, three-stage flow for reversing a placeholder merge — never a
 * one-click action. Reversing a merge is mistake-correction; it shouldn't
 * be casual.
 *
 *   Stage 1 — Pick a target. LO searches/picks the registered user they
 *             think has a wrong merge.
 *   Stage 2 — Review. System lists EVERY active merge that landed on
 *             that user, each with a synopsis of what came from the
 *             absorbed placeholder. A single user may have absorbed
 *             multiple placeholders over time; LO sees them all.
 *   Stage 3 — Confirm. LO picks a specific archive and gets a
 *             confirmation showing exactly what will be stripped from
 *             the target if they undo. Only then does the undo fire.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MemberCombobox } from '@/components/MemberCombobox';
import { getAllMembers } from '@/api/queries/members';
import { queryKeys } from '@/api/queryKeys';
import { AlertTriangle, RotateCcw } from 'lucide-react';
// deno-lint-ignore no-explicit-any
type AnyMember = any;

interface UnmergePlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

interface MergeIntoMember {
  archive_id: string;
  placeholder_member_id: string;
  placeholder_first_name: string | null;
  placeholder_last_name: string | null;
  placeholder_nickname: string | null;
  actor_role: string;
  actor_name: string | null;
  created_at: string;
  expires_at: string;
  synopsis: {
    tables?: Record<string, number>;
    team_players_added?: number;
  } | null;
}

export const UnmergePlayerDialog: React.FC<UnmergePlayerDialogProps> = ({
  open,
  onOpenChange,
  organizationId,
}) => {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState('');
  // Stage gate: which archive_id the LO is confirming reversal of (null
  // means we're still in pick/review stage).
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(
    null,
  );

  const { data: allMembers = [] } = useQuery({
    queryKey: [...queryKeys.members.all, 'org', organizationId],
    queryFn: () => getAllMembers(organizationId),
    enabled: open,
  });

  const registeredMembers = (allMembers as AnyMember[]).filter((m) => m?.user_id);

  const { data: merges = [], isLoading: mergesLoading } = useQuery({
    queryKey: ['merges-into-member', organizationId, targetId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_merges_into_member', {
        p_target_member_id: targetId,
        p_org_id: organizationId,
      });
      if (error) throw error;
      return (data as MergeIntoMember[]) ?? [];
    },
    enabled: open && !!targetId,
  });

  const undoMutation = useMutation({
    mutationFn: async (archiveId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) throw new Error('Session expired. Please log in again.');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lo-undo-merge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ archiveId }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Undo failed');
      }
      return result;
    },
    onSuccess: () => {
      toast.success('Merge undone — placeholder restored');
      queryClient.invalidateQueries({
        queryKey: ['merges-into-member', organizationId, targetId],
      });
      queryClient.invalidateQueries({
        queryKey: ['org-placeholders-for-merge', organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['org-placeholders-archived', organizationId],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      setConfirmingArchiveId(null);
      // Stay open so the LO can verify or pick another. They can close
      // when they're done.
    },
    onError: (err) => {
      logger.error('Undo merge failed', { error: (err as Error).message });
      toast.error((err as Error).message || 'Could not undo');
    },
  });

  const selectedTarget = registeredMembers.find((m) => m.id === targetId);
  const confirmingMerge = merges.find((m) => m.archive_id === confirmingArchiveId);

  // Reset state on close so reopening starts fresh.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTargetId('');
      setConfirmingArchiveId(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        {/* Stage 3: confirmation for one specific archive */}
        {confirmingMerge ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirm unmerge
              </DialogTitle>
              <DialogDescription>
                This will reverse a merge that absorbed a placeholder into{' '}
                <strong>
                  {selectedTarget?.first_name} {selectedTarget?.last_name}
                </strong>
                . Read what will be stripped from their account before confirming.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-md bg-warning/10 border border-warning/40 p-3">
                <p className="text-xs text-warning font-medium">
                  Placeholder being restored
                </p>
                <p className="font-semibold text-foreground">
                  {confirmingMerge.placeholder_first_name}{' '}
                  {confirmingMerge.placeholder_last_name}
                  {confirmingMerge.placeholder_nickname && (
                    <span className="font-normal">
                      {' '}({confirmingMerge.placeholder_nickname})
                    </span>
                  )}
                </p>
                <p className="text-xs text-warning mt-1">
                  Originally merged{' '}
                  {new Date(confirmingMerge.created_at).toLocaleString()}
                  {confirmingMerge.actor_name && <> by {confirmingMerge.actor_name}</>}
                </p>
              </div>

              <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3">
                <p className="text-xs text-destructive font-medium">
                  Will be stripped from {selectedTarget?.first_name}'s account
                </p>
                <Synopsis synopsis={confirmingMerge.synopsis} />
              </div>

              <p className="text-xs text-muted-foreground">
                Anything {selectedTarget?.first_name} did AFTER this merge stays
                with them. Only the rows that came from the placeholder go
                back.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingArchiveId(null)}
                disabled={undoMutation.isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => undoMutation.mutate(confirmingMerge.archive_id)}
                isLoading={undoMutation.isPending}
                loadingText="Reversing…"
              >
                Confirm unmerge
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Stages 1 + 2: pick target, then review their merges.
          <>
            <DialogHeader>
              <DialogTitle>Unmerge a player</DialogTitle>
              <DialogDescription>
                Reversing a merge undoes a previous attach. Look up the
                registered user, review what was merged into them, and pick
                the specific reversal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Player
                </label>
                <MemberCombobox
                  members={registeredMembers}
                  value={targetId}
                  onValueChange={(v) => {
                    setTargetId(v);
                    setConfirmingArchiveId(null);
                  }}
                  placeholder="Search registered users…"
                  allowCreatePlaceholder={false}
                />
              </div>

              {targetId && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Reversible merges into{' '}
                    {selectedTarget?.first_name} {selectedTarget?.last_name}
                  </p>
                  {mergesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : merges.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No reversible merges. Either no placeholder has been
                      merged into this user, or all prior merges have already
                      been undone or expired.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border border rounded-md">
                      {merges.map((m) => {
                        const placeholderLabel =
                          m.placeholder_nickname?.trim() ||
                          m.placeholder_first_name ||
                          'placeholder';
                        return (
                          <li key={m.archive_id} className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground">
                                  {placeholderLabel}{' '}
                                  <span className="text-muted-foreground font-normal text-xs">
                                    ({m.placeholder_first_name}{' '}
                                    {m.placeholder_last_name})
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(m.created_at).toLocaleString()}
                                  {m.actor_name && <> · by {m.actor_name}</>}
                                  {m.actor_role === 'invite_accept' && (
                                    <span className="text-info"> · self-claim</span>
                                  )}
                                </p>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  <Synopsis synopsis={m.synopsis} compact />
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setConfirmingArchiveId(m.archive_id)
                                }
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Review
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

/**
 * Renders a human-readable summary of what was transferred. The synopsis
 * counts come from get_merges_into_member's JSONB derivation of
 * transferred_rows, so what's shown here is exactly what's in the archive.
 */
const Synopsis: React.FC<{
  synopsis: MergeIntoMember['synopsis'];
  compact?: boolean;
}> = ({ synopsis, compact }) => {
  if (!synopsis) return <span>(no detail available)</span>;
  const tables = synopsis.tables ?? {};
  const teamPlayersAdded = synopsis.team_players_added ?? 0;

  // Best-effort labels for the most-common tables; everything else falls
  // through to the raw column-label form.
  const labelFor = (t: string, count: number): string => {
    if (t === 'team_players') return `${count} team membership row(s)`;
    if (t === 'match_lineups') return `${count} lineup appearance(s)`;
    if (t === 'match_games') return `${count} game(s)`;
    if (t === 'teams') return `${count} captaincy/captaincies`;
    return `${count} × ${t}`;
  };

  const items = Object.entries(tables).map(([t, c]) => labelFor(t, c));
  // Highlight the "new memberships" count separately when it's non-zero
  // — that's what the target visibly gained from the merge.
  if (teamPlayersAdded > 0) {
    items.unshift(
      `${teamPlayersAdded} new team membership(s) created for the target`,
    );
  }

  if (items.length === 0) return <span>(nothing material to strip)</span>;

  if (compact) {
    return <span>{items.join(' · ')}</span>;
  }
  return (
    <ul className="list-disc list-inside text-destructive space-y-0.5 mt-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
};
