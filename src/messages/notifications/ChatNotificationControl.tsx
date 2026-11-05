/**
 * @fileoverview Container for the per-conversation notification setting.
 *
 * Pulls together the levels above this chat (system kind policy, the member's
 * master switch, their per-kind default) so the dialog can explain itself, and
 * saves the chat's own value.
 *
 * The toast is the point: Ed asked that trying to change something a higher
 * level governs should say where to change it, rather than accepting a tap that
 * does nothing.
 *
 * @see docs/plans/2026-09-04-001-feat-notification-controls-plan.md
 */

import { toast } from 'sonner';
import { useCurrentMember } from '@/api/hooks';
import {
  useNotificationKindPrefs,
  usePushableKinds,
} from '@/api/hooks/useNotificationPrefs';
import {
  useConversationNotificationPref,
  useSetConversationNotificationPref,
} from '@/api/hooks/useConversationNotificationPref';
import { ChatNotificationDialog } from './ChatNotificationDialog';
import { resolveChatOverride } from './resolveChatOverride';
import {
  DEFAULT_GROUP_INTERVAL_MINUTES,
  kindDisplay,
} from './notificationKinds';

interface ChatNotificationControlProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  /** Conversation name, for the dialog heading. */
  title: string;
  /** `conversations.conversation_type`; NULL is a direct message. */
  conversationType: string | null;
}

/**
 * Per-conversation notification settings, wired to the member's global rules.
 *
 * @param props - See {@link ChatNotificationControlProps}
 */
export function ChatNotificationControl({
  open,
  onClose,
  conversationId,
  title,
  conversationType,
}: ChatNotificationControlProps) {
  const { data: member } = useCurrentMember();
  const memberId = member?.id;
  const kindKey = conversationType ?? 'direct';
  const display = kindDisplay(kindKey);

  const { data: pushableKinds = [] } = usePushableKinds();
  const { data: kindPrefs = [] } = useNotificationKindPrefs(memberId);
  const { data: pref } = useConversationNotificationPref(conversationId, memberId);
  const save = useSetConversationNotificationPref();

  if (!open || !memberId) return null;

  const storedKind = kindPrefs.find((p) => p.conversationKind === kindKey);
  // No stored row means no restriction from that level — the same convention
  // used everywhere else in the chain.
  const kindEnabled = storedKind?.pushEnabled ?? true;
  const kindInterval =
    storedKind?.intervalMinutes ??
    (display?.supportsInterval ? DEFAULT_GROUP_INTERVAL_MINUTES : null);

  const override = resolveChatOverride({
    masterEnabled: member?.push_enabled !== false,
    quietHoursConfigured: false,
    kindIsLive: pushableKinds.includes(kindKey),
    kindEnabled,
    kindIntervalMinutes: kindInterval,
    kindLabel: display?.label ?? 'These chats',
  });

  const notify = (pref?.notificationMode ?? 'all') === 'all';

  const handleChange = (nextNotify: boolean, nextInterval: number | null) => {
    // Turning a chat ON while something above it is off saves fine — the chat
    // level genuinely stops restricting — but it won't produce a notification.
    // Say where to fix that instead of letting the switch imply success.
    if (nextNotify && override.isOverruled && override.message) {
      toast.info(override.message);
    }
    save.mutate({
      conversationId,
      memberId,
      notify: nextNotify,
      intervalMinutes: nextInterval,
    });
  };

  return (
    <ChatNotificationDialog
      open={open}
      onClose={onClose}
      title={title}
      notify={notify}
      intervalMinutes={pref?.intervalMinutes ?? null}
      supportsInterval={display?.supportsInterval ?? false}
      override={override}
      isSaving={save.isPending}
      onChange={handleChange}
    />
  );
}
