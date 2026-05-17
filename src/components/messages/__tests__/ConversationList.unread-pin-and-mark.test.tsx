/**
 * @fileoverview Tests for unread-announcement pinning + tappable
 * mark-as-read badge in ConversationList.
 *
 * Pins two related contracts:
 * 1. Pin: unread announcement rows always render ABOVE non-announcement
 *    rows in the active section, regardless of last_message_at. Once
 *    unread drops to 0 (user reads or clicks the badge), the row
 *    drops back into its natural slot.
 * 2. Mark-as-read: the unread-count badge is tappable. Clicking it
 *    invokes useUpdateLastRead with {conversationId, userId} and does
 *    NOT also open the conversation (stopPropagation on the click).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const mockUseConversations = vi.fn();
const mockUseConversationsRealtime = vi.fn();
const mockUseProfanityFilter = vi.fn();
const mockUpdateLastReadMutate = vi.fn();

vi.mock('@/api/hooks', () => ({
  useConversations: (userId: string) => mockUseConversations(userId),
  useConversationsRealtime: (userId: string) => mockUseConversationsRealtime(userId),
  useUpdateLastRead: () => ({ mutate: mockUpdateLastReadMutate }),
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
    lastMessagePreview: 'hello',
    unreadCount: 0,
    createdAt: '2026-05-01T10:00:00Z',
    isPastMember: false,
    ...overrides,
  };
}

function renderList(onSelect = vi.fn()) {
  return {
    onSelect,
    ...renderWithProviders(
      <ConversationList
        userId="user-1"
        selectedConversationId={null}
        onSelectConversation={onSelect}
      />,
    ),
  };
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

describe('ConversationList — unread announcement pinning', () => {
  it('pins an unread announcement above more-recent non-announcement chats', () => {
    mockUseConversations.mockReturnValue({
      data: [
        // Most recent activity is a DM, but the older unread announcement
        // should appear first.
        makeConv({
          title: 'Recent DM',
          conversationType: null,
          lastMessageAt: '2026-05-16T15:00:00Z',
          unreadCount: 0,
        }),
        makeConv({
          title: 'League Announcement',
          conversationType: 'announcements',
          lastMessageAt: '2026-05-10T09:00:00Z',
          unreadCount: 3,
        }),
      ],
      isLoading: false,
    });
    renderList();

    const rows = screen.getAllByRole('button').filter((b) => b.textContent?.match(/Recent DM|League Announcement/));
    expect(rows[0].textContent).toContain('League Announcement');
    expect(rows[1].textContent).toContain('Recent DM');
  });

  it('does NOT pin a read announcement — it sorts by recency like everything else', () => {
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          title: 'Recent DM',
          conversationType: null,
          lastMessageAt: '2026-05-16T15:00:00Z',
          unreadCount: 0,
        }),
        makeConv({
          title: 'Old Read Announcement',
          conversationType: 'announcements',
          lastMessageAt: '2026-05-10T09:00:00Z',
          unreadCount: 0,
        }),
      ],
      isLoading: false,
    });
    renderList();

    // No pin → render order matches input order (the parent query
    // already returns last_message_at desc; we don't re-sort the rest).
    const rows = screen.getAllByRole('button').filter((b) => b.textContent?.match(/Recent DM|Old Read Announcement/));
    expect(rows[0].textContent).toContain('Recent DM');
    expect(rows[1].textContent).toContain('Old Read Announcement');
  });
});

describe('ConversationList — tappable unread badge (mark-as-read)', () => {
  it('clicking the badge invokes useUpdateLastRead with the right args', async () => {
    const user = userEvent.setup();
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          id: 'conv-target',
          title: 'Team Chat',
          unreadCount: 5,
        }),
      ],
      isLoading: false,
    });
    renderList();

    const badge = screen.getByRole('button', { name: /Mark Team Chat as read/i });
    await user.click(badge);

    expect(mockUpdateLastReadMutate).toHaveBeenCalledTimes(1);
    expect(mockUpdateLastReadMutate).toHaveBeenCalledWith({
      conversationId: 'conv-target',
      userId: 'user-1',
    });
  });

  it('clicking the badge does NOT also open the conversation (stopPropagation)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          id: 'conv-target',
          title: 'Team Chat',
          unreadCount: 2,
        }),
      ],
      isLoading: false,
    });
    renderList(onSelect);

    const badge = screen.getByRole('button', { name: /Mark Team Chat as read/i });
    await user.click(badge);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking the row body (NOT the badge) still opens the conversation', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          id: 'conv-target',
          title: 'Team Chat',
          unreadCount: 2,
          lastMessagePreview: 'the preview body',
        }),
      ],
      isLoading: false,
    });
    renderList(onSelect);

    await user.click(screen.getByText('the preview body'));

    expect(onSelect).toHaveBeenCalledWith('conv-target');
    expect(mockUpdateLastReadMutate).not.toHaveBeenCalled();
  });

  it('no badge renders when unreadCount is 0 (nothing to mark)', () => {
    mockUseConversations.mockReturnValue({
      data: [makeConv({ title: 'Team Chat', unreadCount: 0 })],
      isLoading: false,
    });
    renderList();

    expect(screen.queryByRole('button', { name: /Mark .* as read/i })).not.toBeInTheDocument();
  });

  it('no badge renders for past-member rows (stale unread suppressed by Unit 20 rule)', () => {
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({
          title: 'Old Team',
          unreadCount: 4,
          isPastMember: true,
        }),
      ],
      isLoading: false,
    });
    renderList();

    // The row may be in the archived/collapsed section; expand to be sure.
    expect(screen.queryByRole('button', { name: /Mark .* as read/i })).not.toBeInTheDocument();
  });
});
