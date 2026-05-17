/**
 * @fileoverview Tests for the "Unread messages" divider in
 * MessageList. Pins the contract that the divider appears above the
 * first message whose created_at is strictly newer than the
 * unreadAnchorAt snapshot, and is omitted entirely when there's
 * nothing to mark.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/utils';

vi.mock('@/hooks/useProfanityFilter', () => ({
  useProfanityFilter: () => ({
    shouldFilter: false,
    canToggle: true,
    isLoading: false,
  }),
}));

import { MessageList, type Message } from '../MessageList';

function makeMessage(id: string, createdAt: string, content = 'msg'): Message {
  return {
    id,
    content,
    created_at: createdAt,
    edited_at: null,
    is_edited: false,
    is_system: false,
    sender: {
      id: 'other-user',
      first_name: 'Jack',
      last_name: 'Smith',
      system_player_number: 1,
    },
  };
}

describe('MessageList — unread divider', () => {
  it('renders the divider above the first message newer than the anchor', () => {
    const messages = [
      makeMessage('m1', '2026-05-15T10:00:00Z', 'old 1'),
      makeMessage('m2', '2026-05-15T11:00:00Z', 'old 2'),
      makeMessage('m3', '2026-05-15T13:00:00Z', 'new 1'),
      makeMessage('m4', '2026-05-15T14:00:00Z', 'new 2'),
    ];
    renderWithProviders(
      <MessageList
        messages={messages}
        currentUserId="me"
        recipientLastRead={null}
        unreadAnchorAt="2026-05-15T12:00:00Z"
        loading={false}
      />,
    );

    const divider = screen.getByTestId('unread-divider');
    expect(divider).toBeInTheDocument();
    expect(within(divider).getByText('Unread messages')).toBeInTheDocument();
    // Only one divider should render (above the first newer message).
    expect(screen.getAllByTestId('unread-divider')).toHaveLength(1);
  });

  it('renders NO divider when the anchor is null (first-time open)', () => {
    const messages = [
      makeMessage('m1', '2026-05-15T10:00:00Z'),
      makeMessage('m2', '2026-05-15T11:00:00Z'),
    ];
    renderWithProviders(
      <MessageList
        messages={messages}
        currentUserId="me"
        recipientLastRead={null}
        unreadAnchorAt={null}
        loading={false}
      />,
    );
    expect(screen.queryByTestId('unread-divider')).not.toBeInTheDocument();
  });

  it('renders NO divider when every message is at or before the anchor', () => {
    const messages = [
      makeMessage('m1', '2026-05-15T10:00:00Z'),
      makeMessage('m2', '2026-05-15T11:00:00Z'),
    ];
    renderWithProviders(
      <MessageList
        messages={messages}
        currentUserId="me"
        recipientLastRead={null}
        // Anchor strictly after both messages → no message is newer
        unreadAnchorAt="2026-05-15T12:00:00Z"
        loading={false}
      />,
    );
    expect(screen.queryByTestId('unread-divider')).not.toBeInTheDocument();
  });

  it('renders the divider at the very top when ALL messages are newer than the anchor', () => {
    const messages = [
      makeMessage('m1', '2026-05-15T13:00:00Z', 'new 1'),
      makeMessage('m2', '2026-05-15T14:00:00Z', 'new 2'),
    ];
    renderWithProviders(
      <MessageList
        messages={messages}
        currentUserId="me"
        recipientLastRead={null}
        unreadAnchorAt="2026-05-15T12:00:00Z"
        loading={false}
      />,
    );
    expect(screen.getByTestId('unread-divider')).toBeInTheDocument();
  });
});
