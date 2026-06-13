/**
 * @fileoverview AttachPlaceholderDialog
 *
 * LO-initiated direct attach of a placeholder to an existing registered
 * user. Common scenario: "I registered but can't see my team" → LO opens
 * the placeholder, picks the user, clicks Attach. No email round trip.
 *
 * Under the hood: calls the lo-merge-placeholder Edge Function which calls
 * merge_placeholder_into_member_v2 with actor_role='lo_initiated'. The
 * LO's org-staff membership is the authorization gate.
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
import type { PartialMember } from '@/types/member';

interface AttachPlaceholderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The placeholder being attached */
  placeholderId: string;
  placeholderNickname: string;
  placeholderFullName: string;
  /** Org id for the LO auth scope; passed through to the Edge Function */
  organizationId: string;
  /** Called after a successful attach so the caller can refetch */
  onAttached?: () => void;
}

export const AttachPlaceholderDialog: React.FC<AttachPlaceholderDialogProps> = ({
  open,
  onOpenChange,
  placeholderId,
  placeholderNickname,
  placeholderFullName,
  organizationId,
  onAttached,
}) => {
  const queryClient = useQueryClient();
  const [selectedTargetId, setSelectedTargetId] = useState('');

  // Fetch all members, filter to registered ones only (user_id set).
  // getAllMembers returns PartialMember rows that carry user_id — we use
  // it to keep placeholders out of the target picker.
  const { data: allMembers = [] } = useQuery({
    queryKey: [...queryKeys.members.all, 'org', organizationId],
    queryFn: () => getAllMembers(organizationId),
    enabled: open,
  });

  // deno-lint-ignore no-explicit-any
  const registeredMembers: PartialMember[] = (allMembers as any[]).filter(
    (m) => m?.user_id,
  );

  const selectedTarget = registeredMembers.find((m) => m.id === selectedTargetId);

  const attachMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) throw new Error('Session expired. Please log in again.');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lo-merge-placeholder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            placeholderMemberId: placeholderId,
            targetMemberId: selectedTargetId,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Attach failed');
      }
      return result;
    },
    onSuccess: () => {
      toast.success(
        `${placeholderNickname} attached to ${selectedTarget?.first_name ?? 'user'}`,
      );
      // Refetch placeholder list so the attached row disappears.
      queryClient.invalidateQueries({
        queryKey: ['org-placeholders-for-merge', organizationId],
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      onAttached?.();
      setSelectedTargetId('');
      onOpenChange(false);
    },
    onError: (err) => {
      logger.error('Attach placeholder failed', { error: (err as Error).message });
      toast.error((err as Error).message || 'Could not attach');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attach placeholder to a registered user</DialogTitle>
          <DialogDescription>
            Moves all of {placeholderNickname}'s games, teams, and handicap
            history onto the registered user you pick. Can be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Who we're moving FROM */}
          <div className="rounded-md bg-warning/10 border border-warning/40 p-3">
            <p className="text-xs text-warning font-medium">Placeholder</p>
            <p className="text-sm font-semibold text-foreground">
              {placeholderFullName}
              <span className="text-warning font-normal">
                {' '}({placeholderNickname})
              </span>
            </p>
          </div>

          {/* Pick target user */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Registered user
            </label>
            <MemberCombobox
              members={registeredMembers}
              value={selectedTargetId}
              onValueChange={setSelectedTargetId}
              placeholder="Search registered users…"
              allowCreatePlaceholder={false}
            />
          </div>

          {/* Preview after selection */}
          {selectedTarget && (
            <div className="rounded-md bg-success/10 border border-success/40 p-3">
              <p className="text-xs text-success font-medium">Will attach to</p>
              <p className="text-sm font-semibold text-foreground">
                {selectedTarget.first_name} {selectedTarget.last_name}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={attachMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => attachMutation.mutate()}
            disabled={!selectedTargetId || attachMutation.isPending}
            isLoading={attachMutation.isPending}
            loadingText="Attaching…"
          >
            Attach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
