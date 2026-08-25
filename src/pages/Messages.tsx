/**
 * @fileoverview Messages Page
 *
 * Mobile-first messaging interface with responsive layout:
 * - Mobile: Single panel that toggles between conversation list and message view
 * - Desktop (md+): Two-column layout with conversation list and message view side-by-side
 *
 * Mobile Navigation:
 * - Shows conversation list by default
 * - Selecting a conversation hides the list and shows the message view
 * - Back button in message view returns to conversation list
 *
 * Desktop Navigation:
 * - Both panels always visible
 * - No back button needed
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { ConversationList } from '@/components/messages/ConversationList';
import { CreateTeamChatPrompt } from '@/components/messages/CreateTeamChatPrompt';
import { MessageView } from '@/components/messages/MessageView';
import { MessagesEmptyState } from '@/components/messages/MessagesEmptyState';
import { NewMessageModal } from '@/components/messages/NewMessageModal';
import { AnnouncementModal } from '@/components/messages/AnnouncementModal';
import { MessageSettingsModal } from '@/components/messages/MessageSettingsModal';
import { ProfanityOnboardingModal } from '@/components/onboarding/ProfanityOnboardingModal';
import { PushOnboardingPrompt } from '@/components/messages/PushOnboardingPrompt';
import {
  useCurrentMember,
  useUserProfile,
  useIsCaptain,
  useConversations,
  useCreateOrOpenConversation,
  useCreateGroupConversation,
  useCreateLeagueAnnouncement,
  useCreateOrganizationAnnouncement,
} from '@/api/hooks';
import { resolveDeepLinkTarget } from '@/utils/messages/resolveDeepLinkTarget';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

export function Messages() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: member } = useCurrentMember();
  const memberId = member?.id;
  const firstName = member?.first_name;
  const { canAccessLeagueOperatorFeatures } = useUserProfile();
  // Deep link: /messages/:conversationId opens that thread even on a cold load
  // (push feature Unit 3). We validate the id against the user's own
  // conversations so an unknown/forbidden id falls back to the list.
  const { conversationId: routeConversationId } = useParams<{
    conversationId?: string;
  }>();
  const { data: conversations = [], isLoading: conversationsLoading } =
    useConversations(memberId);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(routeConversationId ?? null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { data: isCaptain = false } = useIsCaptain();

  // Unit 9: one-time profanity-filter onboarding. Shown the first time a
  // member opens Messages (detected by a NULL
  // profanity_onboarding_completed_at). The modal records a choice on
  // every exit path, so once resolved it never reappears; the local
  // flag just prevents a re-render flash before the member cache
  // refetches with the new timestamp.
  const [onboardingResolved, setOnboardingResolved] = useState(false);
  const showProfanityOnboarding =
    !!member?.user_id &&
    member.profanity_onboarding_completed_at == null &&
    !onboardingResolved;

  // Push-notification onboarding (Unit 6). A separate three-way prompt shown on
  // Messages open once profanity is out of the way and the member hasn't
  // answered the push question (push_enabled IS NULL). "Not now" leaves it NULL
  // so it re-asks next visit; the local flag only hides it for this mount.
  const [pushPromptResolved, setPushPromptResolved] = useState(false);
  const showPushOnboarding =
    !!member?.user_id &&
    !!memberId &&
    member.push_enabled == null &&
    !showProfanityOnboarding &&
    !pushPromptResolved;

  // Mutation hooks
  const createOrOpenConversationMutation = useCreateOrOpenConversation();
  const createGroupConversationMutation = useCreateGroupConversation();
  const createLeagueAnnouncementMutation = useCreateLeagueAnnouncement();
  const createOrganizationAnnouncementMutation = useCreateOrganizationAnnouncement();

  // Check if we were passed a conversationId from navigation state
  useEffect(() => {
    const state = location.state as { conversationId?: string } | null;
    if (state?.conversationId) {
      setSelectedConversationId(state.conversationId);
      // Clear the state so refreshing doesn't re-select
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Deep link (/messages/:conversationId): open the target thread. While the
  // conversation list is still loading we open optimistically; once loaded, an
  // unknown/forbidden id resets to null and the list shows instead. We only act
  // when a param is present, so in-app selection on bare /messages is untouched.
  useEffect(() => {
    if (!routeConversationId) return;
    const conversationIds = (conversations as Array<{ id: string }>).map(
      (c) => c.id
    );
    const { conversationId } = resolveDeepLinkTarget({
      routeConversationId,
      conversationIds,
      isLoading: conversationsLoading,
    });
    setSelectedConversationId(conversationId);
  }, [routeConversationId, conversationsLoading, conversations]);

  const handleNewMessage = () => {
    setShowNewMessageModal(true);
  };

  const handleAnnouncements = () => {
    setShowAnnouncementModal(true);
  };

  const handleCreateAnnouncement = async (
    targets: Array<{ id: string; name: string; type: 'league' | 'organization' }>,
    message: string
  ) => {
    if (!memberId) {
      return;
    }

    try {
      // Send announcement to each selected target
      for (const target of targets) {
        if (target.type === 'league') {
          await createLeagueAnnouncementMutation.mutateAsync({
            leagueId: target.id,
            senderId: memberId,
            message,
          });
        } else if (target.type === 'organization') {
          await createOrganizationAnnouncementMutation.mutateAsync({
            operatorId: target.id,
            senderId: memberId,
            message,
          });
        }
      }

      // Close modal (cache auto-refreshed by mutations)
      setShowAnnouncementModal(false);

      // Show success message
      toast.success(
        `Announcement sent successfully to ${targets.length} target${targets.length > 1 ? 's' : ''}!`
      );
    } catch (error) {
      logger.error('Error creating announcement', { error: error instanceof Error ? error.message : String(error) });
      toast.error(`Failed to send announcement. Please try again.`);
    }
  };

  const handleCreateConversation = async (
    userIds: string[],
    groupName?: string
  ) => {
    if (!memberId) {
      return;
    }

    try {
      let conversationId: string | null = null;

      if (userIds.length === 1) {
        // Direct message
        const result = await createOrOpenConversationMutation.mutateAsync({
          userId1: memberId,
          userId2: userIds[0],
        });
        conversationId = result.conversationId;
      } else {
        // Group conversation
        if (!groupName) {
          logger.error('Group name is required for group conversations');
          return;
        }

        // Include current user in the group
        const allMemberIds = [memberId, ...userIds];

        const result = await createGroupConversationMutation.mutateAsync({
          creatorId: memberId,
          groupName,
          memberIds: allMemberIds,
        });
        conversationId = result.conversationId;
      }

      if (conversationId) {
        setSelectedConversationId(conversationId);
        setShowNewMessageModal(false);
        // Cache auto-refreshed by mutations - no need for refreshKey
      }
    } catch (error) {
      logger.error('Error creating conversation', { error: error instanceof Error ? error.message : String(error) });
      toast.error('Failed to create conversation. Please try again.');
    }
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header - Shows when viewing conversation list, hidden on mobile when conversation selected */}
      <div
        className={cn(
          selectedConversationId ? 'hidden md:block' : 'block'
        )}
      >
        <PageHeader
          backLabel="Back"
          onBackClick={() => navigate(-1)}
          title={firstName ? `${firstName}'s Messages` : 'Messages'}
        />
      </div>

      {/* Responsive layout: Single panel on mobile, two-column on desktop */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Conversation List - Hidden on mobile when message is selected */}
        <div
          className={cn(
            'w-full md:w-80 border-r bg-muted flex flex-col h-full',
            // On mobile: hide when message is selected, show when no message selected
            selectedConversationId ? 'hidden md:flex' : 'flex'
          )}
        >
          {memberId && (
            <>
              <CreateTeamChatPrompt onChatCreated={setSelectedConversationId} />
              <ConversationList
                userId={memberId}
                selectedConversationId={selectedConversationId}
                onSelectConversation={setSelectedConversationId}
                onNewMessage={handleNewMessage}
                showAnnouncements={isCaptain || canAccessLeagueOperatorFeatures()}
                onAnnouncements={handleAnnouncements}
                onSettings={() => setShowSettingsModal(true)}
                onExit={() => navigate('/my-teams')}
              />
            </>
          )}
        </div>

        {/* Message View - Hidden on mobile when no message selected */}
        <div
          className={cn(
            'flex-1 flex flex-col min-h-0 overflow-hidden',
            // On mobile: hide when no message selected, show when message is selected
            selectedConversationId ? 'flex' : 'hidden md:flex'
          )}
        >
          {selectedConversationId && memberId ? (
            <MessageView
              conversationId={selectedConversationId}
              currentUserId={memberId}
              onBack={handleBackToList}
              onLeaveConversation={() => {
                setSelectedConversationId(null);
                // Cache auto-refreshed by mutation
              }}
            />
          ) : (
            <MessagesEmptyState />
          )}

          {/* Exit Button - Only show on desktop */}
          <div className="hidden md:flex border-t bg-muted px-4 md:px-6 py-4 justify-end flex-shrink-0">
            <Button onClick={() => navigate('/my-teams')} loadingText="none">
              Exit to My Teams
            </Button>
          </div>
        </div>
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && memberId && (
        <NewMessageModal
          onClose={() => setShowNewMessageModal(false)}
          onCreateConversation={handleCreateConversation}
          currentUserId={memberId}
        />
      )}

      {/* Announcement Modal */}
      {showAnnouncementModal && memberId && (
        <AnnouncementModal
          onClose={() => setShowAnnouncementModal(false)}
          onCreateAnnouncement={handleCreateAnnouncement}
          currentUserId={memberId}
          canAccessOperatorFeatures={canAccessLeagueOperatorFeatures()}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <MessageSettingsModal
          onClose={() => setShowSettingsModal(false)}
          onUnblocked={() => {
            // Cache auto-refreshed by unblock mutation
          }}
        />
      )}

      {/* Profanity onboarding — first Messages open only (Unit 9) */}
      {showProfanityOnboarding && member?.user_id && (
        <ProfanityOnboardingModal
          userId={member.user_id}
          onResolved={() => setOnboardingResolved(true)}
        />
      )}

      {/* Push notification onboarding — three-way, re-asks until answered (Unit 6) */}
      {showPushOnboarding && member?.user_id && memberId && (
        <PushOnboardingPrompt
          userId={member.user_id}
          memberId={memberId}
          onResolved={() => setPushPromptResolved(true)}
        />
      )}
    </div>
  );
}
