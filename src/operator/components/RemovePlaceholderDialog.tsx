/**
 * @fileoverview RemovePlaceholderDialog
 *
 * Smart "Remove" flow for an LO. Looks at the placeholder's CURRENT state
 * (fetched fresh on open — not from the parent list's cache) and decides
 * between two outcomes, each with a clear pre-confirmation message:
 *
 *   - UNUSED (no stats, no team, no BCA#): permanent delete.
 *   - USED (has stats OR on ≥1 team OR has BCA#): archive (data preserved,
 *     LO can find them via global lookup later).
 *
 * Why fresh: a stale UI is dangerous for destructive actions. If another
 * window added the placeholder to a team, gave them a BCA#, or recorded
 * stats since this LO loaded the page, we MUST surface that state in the
 * confirmation — not show "permanent delete" for a row that's actually
 * not safe to delete anymore.
 *
 * If the row is no longer present (someone else deleted it) or no longer
 * a placeholder (it got merged), the dialog explains and closes without
 * letting the user fire either action.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Archive as ArchiveIcon,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useUser } from '@/context/useUser';
import { logger } from '@/utils/logger';

interface RemovePlaceholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholderId: string;
  /** Used as a fallback while the fresh fetch is in flight. */
  placeholderNickname: string;
  /** Stale-cache values from the parent list — used only as the fallback
   *  display while we fetch fresh state. The action decision is made on
   *  the fresh server response, never on these. */
  hasStats: boolean;
  teamCount: number;
  organizationId: string;
}

interface FreshContext {
  found: boolean;
  is_placeholder: boolean;
  is_archived: boolean;
  has_stats: boolean;
  team_count: number;
  has_bca: boolean;
  first_name: string | null;
  nickname: string | null;
}

export const RemovePlaceholderDialog: React.FC<RemovePlaceholderDialogProps> = ({
  open,
  onOpenChange,
  placeholderId,
  placeholderNickname,
  organizationId,
}) => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  const [fresh, setFresh] = useState<FreshContext | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Refetch on every open so destructive decisions never run on stale state.
  useEffect(() => {
    if (!open) return;
    setFetching(true);
    setFresh(null);
    setFetchError(null);
    (async () => {
      try {
        const { data, error } = await supabase.rpc(
          'get_placeholder_remove_context',
          { p_member_id: placeholderId },
        );
        if (error) throw error;
        const row = (data as FreshContext[])?.[0] ?? null;
        if (!row) throw new Error('Could not load placeholder state');
        setFresh(row);
      } catch (err) {
        logger.error('Fresh remove-context fetch failed', {
          error: (err as Error).message,
        });
        setFetchError((err as Error).message || 'Could not load fresh state');
      } finally {
        setFetching(false);
      }
    })();
  }, [open, placeholderId]);

  // Decision logic, computed only when we have fresh data. Anything that
  // would block delete (stats, team, BCA#) routes to archive instead.
  const action: 'delete' | 'archive' | 'blocked' = (() => {
    if (!fresh) return 'blocked';
    if (!fresh.found) return 'blocked';
    if (!fresh.is_placeholder) return 'blocked';
    if (fresh.is_archived) return 'blocked';
    const isUnused =
      !fresh.has_stats && fresh.team_count === 0 && !fresh.has_bca;
    return isUnused ? 'delete' : 'archive';
  })();

  const blockReason = (() => {
    if (!fresh) return null;
    if (!fresh.found) return 'This placeholder no longer exists.';
    if (!fresh.is_placeholder)
      return 'This placeholder has already been claimed by a registered user.';
    if (fresh.is_archived) return 'This placeholder is already archived.';
    return null;
  })();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (action === 'blocked') throw new Error('Action no longer available');
      const { data: callerMember } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!callerMember) throw new Error('No member record for caller');

      const rpcName =
        action === 'delete' ? 'delete_unused_placeholder' : 'archive_placeholder';

      const { data, error: rpcError } = await supabase.rpc(rpcName, {
        p_member_id: placeholderId,
        p_actor_member_id: callerMember.id,
        p_organization_id: organizationId,
      });
      if (rpcError) throw rpcError;
      const result = (data as { success: boolean; error_message: string | null }[])?.[0];
      if (!result?.success) {
        throw new Error(result?.error_message ?? `${action} failed`);
      }
    },
    onSuccess: () => {
      toast.success(action === 'delete' ? 'Removed permanently' : 'Archived');
      queryClient.invalidateQueries({
        queryKey: ['org-placeholders-for-merge', organizationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['org-placeholders-archived', organizationId],
      });
      onOpenChange(false);
    },
    onError: (err) => {
      logger.error(`${action} placeholder failed`, {
        error: (err as Error).message,
      });
      toast.error((err as Error).message || `Could not ${action}`);
    },
  });

  const displayName =
    fresh?.nickname?.trim() || fresh?.first_name || placeholderNickname;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {fetching ? (
            <>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading current state…
              </DialogTitle>
              <DialogDescription>
                Checking the latest data so we show the right action.
              </DialogDescription>
            </>
          ) : fetchError ? (
            <>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Couldn't load state
              </DialogTitle>
              <DialogDescription>{fetchError}</DialogDescription>
            </>
          ) : action === 'blocked' ? (
            <>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-amber-600" />
                Can't remove
              </DialogTitle>
              <DialogDescription>
                {blockReason}
                <br />
                <span className="text-xs text-gray-500 mt-2 block">
                  Refresh the page to see the current state.
                </span>
              </DialogDescription>
            </>
          ) : action === 'delete' ? (
            <>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Remove {displayName}?
              </DialogTitle>
              <DialogDescription>
                This placeholder is unused and has no relevant information
                to save. It will be removed from the system{' '}
                <strong>permanently</strong>. You can always make a new one
                for this person without losing anything.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="flex items-center gap-2">
                <ArchiveIcon className="h-5 w-5 text-gray-600" />
                Archive {displayName}?
              </DialogTitle>
              <DialogDescription>
                This placeholder will be <strong>archived</strong> — their
                games, teams, and handicap history stay intact. To bring
                them back, look them up under the global tab of player
                lookup.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {action === 'blocked' || fetchError ? 'Close' : 'Cancel'}
          </Button>
          {!fetching && !fetchError && action !== 'blocked' && (
            <Button
              type="button"
              variant={action === 'delete' ? 'destructive' : 'default'}
              onClick={() => mutation.mutate()}
              isLoading={mutation.isPending}
              loadingText={action === 'delete' ? 'Removing…' : 'Archiving…'}
            >
              {action === 'delete' ? 'Remove permanently' : 'Archive'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
