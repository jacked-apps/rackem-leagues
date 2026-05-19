/**
 * @fileoverview Message View Component
 *
 * Displays message thread for selected conversation.
 * Shows message history and input box for sending new messages.
 *
 * Mobile-optimized with:
 * - Responsive padding for message area
 * - Touch-friendly message bubbles
 * - Mobile-optimized input area
 */

import { useState, useEffect, useRef } from 'react';
import { ConversationHeader } from './ConversationHeader';
import { EditConversationTitleDialog } from './EditConversationTitleDialog';
import { MessageInput } from './MessageInput';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { MessageList, type Message } from './messageview/MessageList';
import { useOutgoingMessages } from './messageview/useOutgoingMessages';
import { useConversationParticipants } from '@/hooks/useConversationParticipants';
import { useConversationMessages, useSendMessage, useUpdateLastRead, useConversationMessagesRealtime, useLeaveConversation, useBlockUser, useMessageComposerStatus } from '@/api/hooks';
import { supabase } from '@/supabaseClient';
import { ConfirmDialog } from '@/components/shared';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface MessageViewProps {
  conversationId: string;
  currentUserId: string;
  onBack?: () => void;
  onLeaveConversation?: () => void;
}

export function MessageView({ conversationId, currentUserId, onBack, onLeaveConversation }: MessageViewProps) {
  const [conversationType, setConversationType] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>('');
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  // Unit 19: rename-chat dialog (only for team chats, captain-only).
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  // TanStack Query hooks
  const { data: messagesData = [], isLoading: loading } = useConversationMessages(conversationId);
  const messages = messagesData as unknown as Message[];
  const sendMessageMutation = useSendMessage();

  // Unit 8 inline-failed-send: optimistic outgoing-messages state that
  // MessageList renders alongside the confirmed messages.
  const { outgoing, addPending, markPending, markFailed, remove, removeByMatch } = useOutgoingMessages();
  const updateLastReadMutation = useUpdateLastRead();
  const leaveConversationMutation = useLeaveConversation();
  const blockUserMutation = useBlockUser();

  // Real-time subscriptions (auto-manages channels and cleanup)
  // Unit 17: when the realtime push delivers a message from the
  // current user, find the matching optimistic pending entry in
  // `outgoing` (by content + recent timestamp) and remove it in the
  // same tick the confirmed bubble enters the cache. Without this,
  // the optimistic pending bubble and the confirmed bubble briefly
  // co-exist before the mutation's await resolves → small but
  // visible flash on every send.
  useConversationMessagesRealtime(
    conversationId,
    currentUserId,
    updateLastReadMutation,
    (msg) => {
      removeByMatch((entry) => {
        if (entry.content !== msg.content) return false;
        // Defensive timestamp window — protects against an
        // unlikely double-send-of-same-content matching the wrong
        // pending entry. 30s covers normal round-trip latency
        // with margin.
        const entryTs = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
        const msgTs = new Date(msg.created_at).getTime();
        return Math.abs(msgTs - entryTs) < 30_000;
      });
    },
  );

  // R5 + Phase-1 announcement-feels-one-way decision: gate the composer.
  // Returns { readOnly, reason } when the current user is a past-member of
  // this chat OR is a non-staff viewer of an announcements channel.
  const { data: composerStatus } = useMessageComposerStatus(conversationId);

  const { recipientName, recipientLastRead, currentUserLastRead } = useConversationParticipants(
    conversationId,
    currentUserId
  );

  // Snapshot the current user's last_read_at at chat-open time. We
  // can't read this live because the moment messages load, the
  // updateLastReadMutation fires and bumps last_read_at to now — so
  // a "where did I leave off" divider needs the value as it was
  // BEFORE the user entered the chat. First non-null value wins;
  // subsequent participant-list refetches are ignored for this
  // purpose (a cleared ref means "fresh chat, no divider").
  const unreadAnchorRef = useRef<string | null | undefined>(undefined);
  if (unreadAnchorRef.current === undefined && currentUserLastRead !== null) {
    unreadAnchorRef.current = currentUserLastRead;
  }
  // Reset the anchor when the conversation changes — otherwise the
  // divider from chat A could carry over into chat B.
  useEffect(() => {
    unreadAnchorRef.current = undefined;
  }, [conversationId]);

  // Load conversation details (type and participants) when conversation changes
  useEffect(() => {
    async function loadConversationDetails() {
      // Fetch conversation type, auto_managed flag, and title.
      const { data: convData } = await supabase
        .from('conversations')
        .select('conversation_type, auto_managed, title')
        .eq('id', conversationId)
        .single();

      if (convData) {
        setConversationType(convData.conversation_type);
        setConversationTitle(convData.title ?? '');
      }

      // For DMs: conversation_type is null and auto_managed is false
      // For auto-managed convos: conversation_type is set ('team_chat', 'captains_chat', 'announcements')
      const isDM = !convData?.auto_managed && convData?.conversation_type === null;

      if (isDM) {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .is('left_at', null);

        // DMs have exactly 2 participants
        if (participants && participants.length === 2) {
          const otherParticipant = participants?.find((p: any) => p.user_id !== currentUserId);
          if (otherParticipant) {
            setOtherUserId(otherParticipant.user_id);
          }
        }
      }
    }

    loadConversationDetails();
  }, [conversationId, currentUserId]);

  // Mark conversation as read when messages load
  useEffect(() => {
    if (messages.length > 0) {
      updateLastReadMutation.mutate({
        conversationId,
        userId: currentUserId,
      });
    }
  }, [conversationId, currentUserId, messages.length]);

  // Submit a message: add an optimistic bubble to the conversation,
  // fire the mutation, and either remove the bubble on success (realtime
  // delivers the authoritative server-side row) or transition it to
  // failed state on error (the bubble stays inline with a Retry button).
  // Swallows the error here — failure is visible via the inline bubble,
  // not via re-thrown exceptions to MessageInput.
  const sendWithOptimistic = async (clientId: string, content: string) => {
    try {
      await sendMessageMutation.mutateAsync({
        conversationId,
        senderId: currentUserId,
        content,
      });
      remove(clientId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Error sending message', { error: msg });
      markFailed(clientId, msg || 'Failed to send');
    }
  };

  const handleSendMessage = async (content: string) => {
    const clientId = addPending(content);
    await sendWithOptimistic(clientId, content);
  };

  const handleRetryOutgoing = async (clientId: string, content: string) => {
    markPending(clientId);
    await sendWithOptimistic(clientId, content);
  };

  const handleLeaveClick = () => {
    setShowLeaveConfirm(true);
  };

  const handleLeaveConfirm = async () => {
    try {
      await leaveConversationMutation.mutateAsync({
        conversationId,
        userId: currentUserId,
      });

      // Navigate back to conversation list
      if (onLeaveConversation) {
        onLeaveConversation();
      }
    } catch (error) {
      logger.error('Error leaving conversation', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Failed to leave conversation. Please try again.');
    }
  };

  const handleBlockClick = () => {
    if (!otherUserId) return;
    setShowBlockConfirm(true);
  };

  const handleBlockConfirm = async () => {
    if (!otherUserId) return;

    try {
      await blockUserMutation.mutateAsync({
        blockerId: currentUserId,
        blockedUserId: otherUserId,
      });

      // Navigate back to conversation list after blocking
      if (onLeaveConversation) {
        onLeaveConversation();
      }
    } catch (error) {
      logger.error('Error blocking user', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Failed to block user. Please try again.');
    }
  };

  // DM conversations have null conversation_type and exactly 1 other participant
  const isDM = conversationType === null && !!otherUserId;

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader
        title={recipientName || 'Direct Message'}
        onBack={onBack}
        onLeave={handleLeaveClick}
        onBlock={handleBlockClick}
        onRename={() => setShowRenameDialog(true)}
        canLeave={!composerStatus?.cannotLeave}
        canBlock={isDM}
        // Unit 19: rename only available on team chats, captain-only
        // (captain = the participant with cannot_leave=true).
        canRename={
          conversationType === 'team_chat' && composerStatus?.cannotLeave === true
        }
      />

      {/* Leave Conversation Confirmation */}
      <ConfirmDialog
        open={showLeaveConfirm}
        onOpenChange={setShowLeaveConfirm}
        title="Leave Conversation?"
        description="Are you sure you want to leave this conversation? You can always start a new one later."
        confirmLabel="Leave"
        cancelLabel="Cancel"
        onConfirm={handleLeaveConfirm}
        variant="default"
      />

      {/* Block User Confirmation */}
      <ConfirmDialog
        open={showBlockConfirm}
        onOpenChange={setShowBlockConfirm}
        title="Block User?"
        description="They will no longer be able to message you, and this conversation will be removed from your list."
        confirmLabel="Block"
        cancelLabel="Cancel"
        onConfirm={handleBlockConfirm}
        variant="destructive"
      />

      {/* Messages — list rendering, loading, empty state, auto-scroll,
          system-message variant, and per-bubble profanity filter all live
          in <MessageList>. */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 bg-muted">
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          recipientLastRead={recipientLastRead}
          unreadAnchorAt={unreadAnchorRef.current ?? null}
          loading={loading}
          outgoingMessages={outgoing}
          onRetryOutgoing={handleRetryOutgoing}
        />
      </div>

      {/* Composer OR read-only banner — never both, and the composer is
          unmounted (not hidden) when locked so it stays out of tab order
          and screen-reader output. */}
      {composerStatus?.readOnly && composerStatus.reason ? (
        <ReadOnlyBanner
          reason={composerStatus.reason}
          contextName={composerStatus.contextName ?? undefined}
        />
      ) : (
        <MessageInput onSend={handleSendMessage} />
      )}

      {/* Unit 19: rename-chat dialog. Only mounted when needed (the
          ConversationHeader's "Edit name" menu item is only visible when
          canRename is true, so showRenameDialog is only ever set in
          permitted contexts; the mutation also enforces server-side). */}
      {showRenameDialog && (
        <EditConversationTitleDialog
          open={showRenameDialog}
          onOpenChange={setShowRenameDialog}
          conversationId={conversationId}
          userId={currentUserId}
          initialTitle={conversationTitle}
        />
      )}
    </div>
  );
}
