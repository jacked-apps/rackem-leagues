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

import { useState, useRef, useEffect } from 'react';
import { ConversationHeader } from './ConversationHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ReadOnlyBanner } from './ReadOnlyBanner';
import { useConversationParticipants } from '@/hooks/useConversationParticipants';
import { useConversationMessages, useSendMessage, useUpdateLastRead, useConversationMessagesRealtime, useLeaveConversation, useBlockUser, useMessageComposerStatus } from '@/api/hooks';
import { supabase } from '@/supabaseClient';
import { LoadingState, EmptyState, ConfirmDialog } from '@/components/shared';
import { MessageSquare } from 'lucide-react';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  is_edited: boolean;
  sender: {
    id: string;
    first_name: string;
    last_name: string;
    system_player_number: number;
  };
}

interface MessageViewProps {
  conversationId: string;
  currentUserId: string;
  onBack?: () => void;
  onLeaveConversation?: () => void;
}

export function MessageView({ conversationId, currentUserId, onBack, onLeaveConversation }: MessageViewProps) {
  const [conversationType, setConversationType] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // TanStack Query hooks
  const { data: messagesData = [], isLoading: loading } = useConversationMessages(conversationId);
  const messages = messagesData as any as Message[];
  const sendMessageMutation = useSendMessage();
  const updateLastReadMutation = useUpdateLastRead();
  const leaveConversationMutation = useLeaveConversation();
  const blockUserMutation = useBlockUser();

  // Real-time subscriptions (auto-manages channels and cleanup)
  useConversationMessagesRealtime(conversationId, currentUserId, updateLastReadMutation);

  // R5 + Phase-1 announcement-feels-one-way decision: gate the composer.
  // Returns { readOnly, reason } when the current user is a past-member of
  // this chat OR is a non-staff viewer of an announcements channel.
  const { data: composerStatus } = useMessageComposerStatus(conversationId);

  const { recipientName, recipientLastRead } = useConversationParticipants(
    conversationId,
    currentUserId
  );

  // Load conversation details (type and participants) when conversation changes
  useEffect(() => {
    async function loadConversationDetails() {
      // Fetch conversation type and auto_managed flag
      const { data: convData } = await supabase
        .from('conversations')
        .select('conversation_type, auto_managed')
        .eq('id', conversationId)
        .single();

      if (convData) {
        setConversationType(convData.conversation_type);
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    sendMessageMutation.mutate(
      {
        conversationId,
        senderId: currentUserId,
        content,
      },
      {
        onError: (error) => {
          logger.error('Error sending message', { error: error instanceof Error ? error.message : String(error) });
          toast.error('Failed to send message. Please try again.');
        },
      }
    );

    // Don't manually fetch - let realtime subscription handle it
    // The message will appear via the realtime subscription
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
        canLeave={true}
        canBlock={isDM}
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

      {/* Messages - Mobile-optimized padding */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 bg-muted">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingState message="Loading messages..." />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description="Start the conversation!"
            />
          </div>
        ) : (
          messages.map((message) => {
            if (!message.sender) {
              return null;
            }

            const isCurrentUser = message.sender.id === currentUserId;
            const senderName = `${message.sender.first_name} ${message.sender.last_name}`;

            return (
              <MessageBubble
                key={message.id}
                content={message.content}
                createdAt={message.created_at}
                isEdited={message.is_edited}
                isCurrentUser={isCurrentUser}
                senderName={!isCurrentUser ? senderName : undefined}
                senderId={!isCurrentUser ? message.sender.id : undefined}
                recipientLastRead={recipientLastRead}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer OR read-only banner — never both, and the composer is
          unmounted (not hidden) when locked so it stays out of tab order
          and screen-reader output. */}
      {composerStatus?.readOnly && composerStatus.reason ? (
        <ReadOnlyBanner reason={composerStatus.reason} />
      ) : (
        <MessageInput onSend={handleSendMessage} />
      )}
    </div>
  );
}
