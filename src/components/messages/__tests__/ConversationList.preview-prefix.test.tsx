/**
 * @fileoverview Tests for the iMessage/WhatsApp-style preview prefix
 * on conversation-list rows ("You: ..." / "Jack: ..." / unprefixed).
 *
 * Pins the contract: the rendered preview for a row depends on
 *   (conversation.lastMessageSenderId, conversation.conversationType,
 *    conversation.lastMessageSenderFirstName, currentUserId)
 * and falls back gracefully for system messages + empty conversations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

const mockUseConversations = vi.fn();
const mockUseConversationsRealtime = vi.fn();
const mockUseProfanityFilter = vi.fn();

vi.mock('@/api/hooks', () => ({
  useConversations: (userId: string) => mockUseConversations(userId),
  useConversationsRealtime: (userId: string) => mockUseConversationsRealtime(userId),
  useUpdateLastRead: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/useProfanityFilter', () => ({
  useProfanityFilter: () => mockUseProfanityFilter(),
}));

import { ConversationList } from '../ConversationList';

function makeConv(overrides: Record<string, unknown> = {}) {
  return {
    id: `conv-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Some Chat',
    conversationType: 'team_chat',
    scopeType: 'team',
    lastMessageAt: '2026-05-12T10:00:00Z',
    lastMessagePreview: 'nice shot',
    lastMessageSenderId: 'sender-other',
    lastMessageSenderFirstName: 'Jack',
    unreadCount: 0,
    createdAt: '2026-05-01T10:00:00Z',
    isPastMember: false,
    ...overrides,
  };
}

function renderList() {
  return renderWithProviders(
    <ConversationList
      userId="user-1"
      selectedConversationId={null}
      onSelectConversation={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseConversationsRealtime.mockReturnValue(undefined);
  mockUseProfanityFilter.mockReturnValue({
    shouldFilter: false,
    canToggle: true,
    isLoading: false,
  });
});

describe('ConversationList — preview prefix', () => {
  it('renders "You: " prefix when current user sent the last message', () => {
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          conversationType: 'team_chat',
          lastMessageSenderId: 'user-1', // matches the renderList userId
          lastMessageSenderFirstName: 'Ed',
          lastMessagePreview: 'great match',
        }),
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('You: great match')).toBeInTheDocument();
  });

  it('renders "Jack: " prefix in a group chat when someone else sent the last message', () => {
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          conversationType: 'team_chat',
          lastMessageSenderId: 'sender-other',
          lastMessageSenderFirstName: 'Jack',
          lastMessagePreview: 'great match',
        }),
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('Jack: great match')).toBeInTheDocument();
  });

  it('renders NO prefix in a DM when the other person sent the last message', () => {
    // DM = conversationType === null. The row title already names the
    // other person; prefixing the preview would be redundant.
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          conversationType: null,
          lastMessageSenderId: 'sender-other',
          lastMessageSenderFirstName: 'Jack',
          lastMessagePreview: 'hey ed',
        }),
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('hey ed')).toBeInTheDocument();
    expect(screen.queryByText(/Jack: /)).not.toBeInTheDocument();
  });

  it('renders "You: " in a DM when current user sent the last message', () => {
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          conversationType: null,
          lastMessageSenderId: 'user-1',
          lastMessageSenderFirstName: 'Ed',
          lastMessagePreview: 'sounds good',
        }),
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('You: sounds good')).toBeInTheDocument();
  });

  it('renders NO prefix for system messages (sender is NULL)', () => {
    // Roster-narration + season-activation messages have NULL sender.
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          conversationType: 'team_chat',
          lastMessageSenderId: null,
          lastMessageSenderFirstName: null,
          lastMessagePreview: 'Jack joined the team',
        }),
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('Jack joined the team')).toBeInTheDocument();
  });

  it('renders NO prefix for captains_chat group when sender name is missing', () => {
    // Defensive: if the join didn't return a name for some reason,
    // don't render "undefined: ..." — fall back to raw preview.
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          conversationType: 'captains_chat',
          lastMessageSenderId: 'sender-other',
          lastMessageSenderFirstName: null,
          lastMessagePreview: 'lineup is set',
        }),
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('lineup is set')).toBeInTheDocument();
  });

  it('renders "No messages yet" with no prefix when there is no preview', () => {
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          lastMessagePreview: null,
          lastMessageSenderId: null,
          lastMessageSenderFirstName: null,
        }),
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  it('renders "Jack: " prefix for announcements channels too', () => {
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          conversationType: 'announcements',
          lastMessageSenderId: 'sender-other',
          lastMessageSenderFirstName: 'Jack',
          lastMessagePreview: 'practice cancelled',
        }),
      ],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('Jack: practice cancelled')).toBeInTheDocument();
  });
});
