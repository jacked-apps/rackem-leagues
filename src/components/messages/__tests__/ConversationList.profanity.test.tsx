/**
 * @fileoverview Display-filter tests for ConversationList's last-message
 * preview.
 *
 * Covers the Unit 7 / R4 promise: when `useProfanityFilter` returns
 * `shouldFilter: true`, the inline preview snippet rendered for each
 * conversation row is censored at render time. The underlying
 * `lastMessagePreview` field on the conversation row is unchanged, and
 * the unread-count badge is driven off the raw conversation row
 * regardless of the filter state.
 *
 * Hooks (`useConversations`, `useConversationsRealtime`,
 * `useProfanityFilter`) are mocked at module boundary so the test
 * exercises only the component's render logic, not the React Query /
 * Supabase plumbing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

const mockUseConversations = vi.fn();
const mockUseConversationsRealtime = vi.fn();
const mockUseProfanityFilter = vi.fn();

vi.mock('@/api/hooks', () => ({
  useConversations: (userId: string) => mockUseConversations(userId),
  useConversationsRealtime: (userId: string) => mockUseConversationsRealtime(userId),
}));

vi.mock('@/hooks/useProfanityFilter', () => ({
  useProfanityFilter: () => mockUseProfanityFilter(),
}));

import { ConversationList } from '../ConversationList';

const PROFANE_PREVIEW = 'this is a damn good game';
const CLEAN_PREVIEW = 'see you at league night';

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    title: 'Team A',
    conversationType: 'team',
    scopeType: 'team',
    lastMessageAt: '2026-05-12T10:00:00Z',
    lastMessagePreview: PROFANE_PREVIEW,
    unreadCount: 0,
    createdAt: '2026-05-01T10:00:00Z',
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
  mockUseConversations.mockReturnValue({ data: [makeConversation()], isLoading: false });
  mockUseConversationsRealtime.mockReturnValue(undefined);
});

describe('ConversationList preview — profanity filter ON', () => {
  beforeEach(() => {
    mockUseProfanityFilter.mockReturnValue({
      shouldFilter: true,
      canToggle: false,
      isLoading: false,
    });
  });

  it('censors profanity in the rendered preview snippet', () => {
    renderList();
    // Surrounding text survives; the profane word is gone (the package
    // replaces it with a fixed grawlix; we don't assert on the exact
    // substitution characters, only that the word itself is censored).
    expect(screen.getByText(/this is a .+ good game/i)).toBeInTheDocument();
    expect(screen.queryByText(PROFANE_PREVIEW)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bdamn\b/i)).not.toBeInTheDocument();
  });

  it('leaves clean previews unchanged', () => {
    mockUseConversations.mockReturnValue({
      data: [makeConversation({ lastMessagePreview: CLEAN_PREVIEW })],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText(CLEAN_PREVIEW)).toBeInTheDocument();
  });

  it('does not affect the unread-count badge — it counts raw rows', () => {
    mockUseConversations.mockReturnValue({
      data: [makeConversation({ unreadCount: 3 })],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('ConversationList preview — profanity filter OFF', () => {
  beforeEach(() => {
    mockUseProfanityFilter.mockReturnValue({
      shouldFilter: false,
      canToggle: true,
      isLoading: false,
    });
  });

  it('renders the preview raw', () => {
    renderList();
    expect(screen.getByText(PROFANE_PREVIEW)).toBeInTheDocument();
  });
});

describe('ConversationList preview — null preview path', () => {
  beforeEach(() => {
    mockUseProfanityFilter.mockReturnValue({
      shouldFilter: true,
      canToggle: false,
      isLoading: false,
    });
  });

  it('renders the "No messages yet" placeholder when preview is null', () => {
    mockUseConversations.mockReturnValue({
      data: [makeConversation({ lastMessagePreview: null })],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('renders the "No messages yet" placeholder when preview is empty string', () => {
    mockUseConversations.mockReturnValue({
      data: [makeConversation({ lastMessagePreview: '' })],
      isLoading: false,
    });
    renderList();
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });
});
