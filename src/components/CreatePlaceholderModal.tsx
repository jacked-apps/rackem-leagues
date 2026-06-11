/**
 * @fileoverview Create Placeholder Player Modal
 *
 * Minimal creation form. The bar to create a placeholder is intentionally
 * low — captains add new players at a bar, often on a phone, often without
 * city/state on hand. We ask only for what the data model can't generate
 * for itself.
 *
 * Required: First name, Last name.
 * Optional: Nickname (auto-generated from name if blank), Email.
 *
 * Email semantics:
 *   - If provided, the members trigger auto-creates a pending invite_token
 *     for that email — that's the contract guaranteed at the DB level.
 *   - If the modal also has team context (caller passed `teamId` and
 *     `invitedByMemberId`), we additionally fire send-invite as best-effort
 *     email delivery. Failure to deliver email never fails the create.
 *   - If no team context (e.g., the wizard captain picker before any team
 *     exists), the invite_token is still there — when the recipient
 *     registers, the dashboard pending-invites modal surfaces it. No
 *     email round-trip needed for the system to work.
 *
 * City/state/handicap are not asked for — they default to blank/0/40 in
 * the mutation. LO can edit later when needed (e.g., to populate fields
 * required by Jack's payment integration).
 */

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateNickname } from '@/utils/nicknameGenerator';
import { createPlaceholderMember } from '@/api/mutations/members';
import { queryKeys } from '@/api/queryKeys';
import { supabase } from '@/supabaseClient';
import { EMAIL_INVITES_ENABLED } from '@/config/featureFlags';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface CreatePlaceholderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (member: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
  }) => void;
  /** Team id for email delivery context. When supplied alongside an
   *  email on the form, the modal additionally fires send-invite for
   *  email delivery. Without team context the trigger-created invite
   *  still exists, ready to be claimed via the dashboard modal. */
  teamId?: string;
  /** Captain or LO id used as invited_by_member_id when firing
   *  send-invite. Defaults to the current authenticated user's member
   *  id if unset. */
  invitedByMemberId?: string;
  /** Captain/team display labels — passed through to send-invite for
   *  email body context if delivery fires. */
  teamName?: string;
  captainName?: string;
}

export function CreatePlaceholderModal({
  open,
  onOpenChange,
  onCreated,
  teamId,
  invitedByMemberId,
  teamName,
  captainName,
}: CreatePlaceholderModalProps) {
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (open) {
      setFirstName('');
      setLastName('');
      setNickname('');
      setEmail('');
    }
  }, [open]);

  /**
   * Best-effort email delivery via send-invite. Runs only when the
   * caller passed team context. Never throws — failure is logged and
   * surfaced as a soft toast so the create-success path keeps moving.
   */
  const fireSendInvite = async (memberId: string, recipient: string) => {
    // Email invites are gated off — the edge function's sandbox sender can't
    // reach real players (see EMAIL_INVITES_ENABLED). Skip the (silently
    // failing) send entirely; the placeholder + token are still created.
    if (!EMAIL_INVITES_ENABLED) return;
    if (!teamId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) return;

      let invitedBy = invitedByMemberId;
      if (!invitedBy) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: callerMember } = await supabase
            .from('members')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          invitedBy = callerMember?.id ?? undefined;
        }
      }
      if (!invitedBy) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            memberId,
            email: recipient,
            teamId,
            invitedByMemberId: invitedBy,
            teamName,
            captainName,
            baseUrl: window.location.origin,
          }),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        logger.warn('send-invite returned non-2xx', { status: response.status, result });
      }
    } catch (err) {
      logger.warn('send-invite call failed (non-fatal)', {
        error: (err as Error).message,
      });
    }
  };

  const createMutation = useMutation({
    mutationFn: createPlaceholderMember,
    onSuccess: async (data) => {
      // Refresh every member-prefixed query so the new placeholder shows
      // up immediately in dropdowns / the LO Placeholders card.
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all });

      // Auto-fire email delivery when we have an email and team context.
      // The trigger has already created the invite_token regardless.
      const trimmedEmail = email.trim();
      if (trimmedEmail) {
        if (teamId) {
          await fireSendInvite(data.id, trimmedEmail);
          toast.success(
            `Created ${data.first_name} ${data.last_name}. Invite sent to ${trimmedEmail}.`,
          );
        } else {
          // No team context — trigger-created invite is still good. Recipient
          // will see it via the dashboard pending-invites modal on next login.
          toast.success(
            `Created ${data.first_name} ${data.last_name}. They'll see the claim link when they log in.`,
          );
        }
      } else {
        toast.success(`Created placeholder: ${data.first_name} ${data.last_name}`);
      }

      onCreated?.(data);
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Failed to create placeholder member', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to create placeholder. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!lastName.trim()) {
      toast.error('Last name is required');
      return;
    }

    const finalNickname = nickname.trim() || generateNickname(firstName, lastName);

    createMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      nickname: finalNickname,
      // city/state default to blank in the mutation. LO can edit later.
      // Handicaps default to 0 / 40 — mutation defaults handle that.
      email: email.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a placeholder player</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Create a stand-in for a real person who hasn't registered yet.
              Just their name is required.
            </span>
            <span className="block text-xs text-muted-foreground">
              If you add their email, an invite is created automatically —
              they can claim their game history when they sign up.
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lastName">Last name *</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nickname">
                Nickname
                <span className="ml-2 text-xs text-muted-foreground">
                  (optional, max 12 chars — auto-generated if blank)
                </span>
              </Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 12))}
                placeholder="Auto-generated if empty"
                maxLength={12}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">
                Email
                <span className="ml-2 text-xs text-muted-foreground">
                  (optional — entering one creates and{teamId ? ' sends' : ''} an invite)
                </span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="player@example.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              isLoading={createMutation.isPending}
              loadingText="Creating..."
            >
              Create player
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
