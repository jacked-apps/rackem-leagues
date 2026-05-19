/**
 * @fileoverview Tests for the Unit 21 collapsible "Archived" section
 * in ConversationList.
 *
 * Pins the contract: past-member rows live under a clickable
 * "Archived (N)" header, default-collapsed. Click the header to
 * expand; click again to collapse. When there are zero past-member
 * rows, the header doesn't render at all.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const mockUseConversations = vi.fn();
const mockUseConversationsRealtime = vi.fn();
const mockUseProfanityFilter = vi.fn();

vi.mock('@/api/hooks', () => ({
  useConversations: (userId: string) => mockUseConversations(userId),
  useConversationsRealtime: (userId: string) => mockUseConversationsRealtime(userId),
  // useUpdateLastRead is used by the tappable mark-as-read badge.
  // Not exercised in this file; return a no-op mutate so the import resolves.
  useUpdateLastRead: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/useProfanityFilter', () => ({
  useProfanityFilter: () => mockUseProfanityFilter(),
}));

import { ConversationList } from '../ConversationList';

function makeConv(overrides: Record<string, unknown> = {}) {
  return {
    id: `conv-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Team A',
    conversationType: 'team',
    scopeType: 'team',
    lastMessageAt: '2026-05-12T10:00:00Z',
    lastMessagePreview: 'hello',
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

describe('ConversationList — Archived section toggle (Unit 21)', () => {
  it('does NOT render the Archived header when there are zero past-member rows', () => {
    mockUseConversations.mockReturnValue({
      data: [makeConv({ title: 'Active 1' }), makeConv({ title: 'Active 2' })],
      isLoading: false,
    });
    renderList();
    expect(screen.queryByTestId('archived-toggle')).not.toBeInTheDocument();
  });

  it('renders the Archived header with count when past-member rows exist, default-collapsed', () => {
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({ title: 'Active 1' }),
        makeConv({ title: 'Old Team 1', isPastMember: true }),
        makeConv({ title: 'Old Team 2', isPastMember: true }),
      ],
      isLoading: false,
    });
    renderList();
    const toggle = screen.getByTestId('archived-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle.textContent).toContain('Archived (2)');
    // Archived row titles must NOT be in the DOM when collapsed.
    expect(screen.queryByText('Old Team 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Old Team 2')).not.toBeInTheDocument();
    // Active row IS in the DOM.
    expect(screen.getByText('Active 1')).toBeInTheDocument();
  });

  it('reveals the archived rows when the header is clicked, then hides them again on second click', async () => {
    const user = userEvent.setup();
    mockUseConversations.mockReturnValue({
      data: [
        makeConv({ title: 'Active' }),
        makeConv({ title: 'Old Team 1', isPastMember: true }),
        makeConv({ title: 'Old Team 2', isPastMember: true }),
      ],
      isLoading: false,
    });
    renderList();

    const toggle = screen.getByTestId('archived-toggle');
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Old Team 1')).toBeInTheDocument();
    expect(screen.getByText('Old Team 2')).toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Old Team 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Old Team 2')).not.toBeInTheDocument();
  });
});
