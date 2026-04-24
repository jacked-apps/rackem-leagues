/**
 * @fileoverview RemovePlaceholderDialog
 *
 * Smart "Remove" flow for an LO. Looks at the placeholder's state and
 * decides between two outcomes, each with a clear pre-confirmation
 * message explaining what will happen:
 *
 *   - UNUSED (no stats, no team): permanent delete. Explicit, irreversible,
 *     and the LO knows from the copy that there's nothing to preserve.
 *
 *   - USED (has stats OR on ≥1 team): archive. Data is kept; row just
 *     leaves the active queue and future global/BCA lookups can find
 *     them again.
 *
 * The routing is decided on the client from the fetched row so the LO
 * sees the right message before clicking Confirm. The underlying RPCs
 * also guard server-side, so a stale UI can't cause a wrong action.
 */

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
import { AlertTriangle, Archive as ArchiveIcon } from 'lucide-react';
import { useUser } from '@/context/useUser';
import { logger } from '@/utils/logger';

interface RemovePlaceholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholderId: string;
  placeholderNickname: string;
  /** Client-side signals used to route delete vs archive. */
  hasStats: boolean;
  teamCount: number;
  organizationId: string;
}

export const RemovePlaceholderDialog: React.FC<RemovePlaceholderDialogProps> = ({
  open,
  onOpenChange,
  placeholderId,
  placeholderNickname,
  hasStats,
  teamCount,
  organizationId,
}) => {
  const queryClient = useQueryClient();
  const { user } = useUser();

  // Unused = no stats AND not on any team. Everything else gets archived
  // so stats/teams/history are preserved.
  const isUnused = !hasStats && teamCount === 0;
  const action: 'delete' | 'archive' = isUnused ? 'delete' : 'archive';

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
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
      logger.error(`${action} placeholder failed`, { error: (err as Error).message });
      toast.error((err as Error).message || `Could not ${action}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'delete' ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Remove {placeholderNickname}?
              </>
            ) : (
              <>
                <ArchiveIcon className="h-5 w-5 text-gray-600" />
                Archive {placeholderNickname}?
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {action === 'delete' ? (
              <>
                This placeholder is unused and has no relevant information
                to save. It will be removed from the system <strong>permanently</strong>.
                You can always make a new one for this person without
                losing anything.
              </>
            ) : (
              <>
                This placeholder will be <strong>archived</strong> — their games,
                teams, and handicap history stay intact. To bring them back,
                look them up under the global tab of player lookup.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={action === 'delete' ? 'destructive' : 'default'}
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            loadingText={action === 'delete' ? 'Removing…' : 'Archiving…'}
          >
            {action === 'delete' ? 'Remove permanently' : 'Archive'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
