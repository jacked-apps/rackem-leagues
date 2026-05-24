/**
 * @fileoverview Tests for MessageList's Unit 8 inline-outgoing branch.
 *
 * Covers the rendering side of the iMessage/WhatsApp pattern: outgoing
 * (optimistic) messages render at the bottom of the thread alongside
 * confirmed messages. Pending ones look like normal user bubbles.
 * Failed ones use the destructive failed-variant bubble with a Retry
 * button whose click invokes `onRetryOutgoing(clientId, content)`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

vi.mock('@/hooks/useProfanityFilter', () => ({
  useProfanityFilter: () => ({
    shouldFilter: false,
    canToggle: true,
    isLoading: false,
  }),
}));

import { MessageList } from '../MessageList';
import type { OutgoingMessage } from '../useOutgoingMessages';

const CURRENT_USER_ID = 'me-123';

const SAMPLE_CONFIRMED = {
  id: 'msg-confirmed-1',
  content: 'see you at league night',
  created_at: '2026-05-12T10:00:00Z',
  edited_at: null,
  is_edited: false,
  is_system: false,
  sender: {
    id: 'other-456',
    first_name: 'Sally',
    last_name: 'Anderson',
    system_player_number: 1,
  },
};

function makeOutgoing(overrides: Partial<OutgoingMessage> = {}): OutgoingMessage {
  return {
    clientId: 'client-1',
    content: 'hello',
    status: 'sending',
    createdAt: '2026-05-12T10:05:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageList — outgoing pending entries render as normal user bubbles', () => {
  it('renders a pending outgoing message below the confirmed messages', () => {
    renderWithProviders(
      <MessageList
        messages={[SAMPLE_CONFIRMED]}
        currentUserId={CURRENT_USER_ID}
        recipientLastRead={null}
        loading={false}
        outgoingMessages={[makeOutgoing({ content: 'on my way' })]}
      />,
    );
    expect(screen.getByText('see you at league night')).toBeInTheDocument();
    expect(screen.getByText('on my way')).toBeInTheDocument();
    // Pending sends do NOT render as failed.
    expect(screen.queryByTestId('failed-message')).not.toBeInTheDocument();
  });

  it('still shows pending outgoing messages when there are no confirmed messages', () => {
    renderWithProviders(
      <MessageList
        messages={[]}
        currentUserId={CURRENT_USER_ID}
        recipientLastRead={null}
        loading={false}
        outgoingMessages={[makeOutgoing({ content: 'first one' })]}
      />,
    );
    expect(screen.getByText('first one')).toBeInTheDocument();
    // Empty state should NOT be shown when there are outgoing entries.
    expect(screen.queryByText(/no messages yet/i)).not.toBeInTheDocument();
  });

  it('still shows the empty state when there are zero confirmed AND zero outgoing', () => {
    renderWithProviders(
      <MessageList
        messages={[]}
        currentUserId={CURRENT_USER_ID}
        recipientLastRead={null}
        loading={false}
        outgoingMessages={[]}
      />,
    );
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });
});

describe('MessageList — failed outgoing entries render the destructive variant with Retry', () => {
  it('renders a failed outgoing message as the failed-variant bubble with error + Retry', () => {
    renderWithProviders(
      <MessageList
        messages={[]}
        currentUserId={CURRENT_USER_ID}
        recipientLastRead={null}
        loading={false}
        outgoingMessages={[
          makeOutgoing({
            content: 'bring eggs',
            status: 'failed',
            errorMessage: 'Network error: offline',
          }),
        ]}
        onRetryOutgoing={vi.fn()}
      />,
    );
    const bubble = screen.getByTestId('failed-message');
    expect(bubble).toBeInTheDocument();
    expect(bubble.textContent).toContain('bring eggs');
    expect(screen.getByTestId('failed-message-error').textContent).toContain(
      'Network error: offline',
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('clicking Retry invokes onRetryOutgoing with the entry clientId + content', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(
      <MessageList
        messages={[]}
        currentUserId={CURRENT_USER_ID}
        recipientLastRead={null}
        loading={false}
        outgoingMessages={[
          makeOutgoing({
            clientId: 'outgoing-abc',
            content: 'bring bacon',
            status: 'failed',
            errorMessage: 'boom',
          }),
        ]}
        onRetryOutgoing={onRetry}
      />,
    );
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith('outgoing-abc', 'bring bacon');
  });

  it('renders multiple failed outgoing bubbles independently — eggs AND bacon', () => {
    renderWithProviders(
      <MessageList
        messages={[]}
        currentUserId={CURRENT_USER_ID}
        recipientLastRead={null}
        loading={false}
        outgoingMessages={[
          makeOutgoing({ clientId: 'a', content: 'bring eggs', status: 'failed', errorMessage: 'offline' }),
          makeOutgoing({ clientId: 'b', content: 'bring bacon', status: 'failed', errorMessage: 'offline' }),
        ]}
        onRetryOutgoing={vi.fn()}
      />,
    );
    const bubbles = screen.getAllByTestId('failed-message');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0].textContent).toContain('bring eggs');
    expect(bubbles[1].textContent).toContain('bring bacon');
    expect(screen.getAllByRole('button', { name: /retry/i })).toHaveLength(2);
  });

  it('renders a mix of pending and failed outgoing in order', () => {
    renderWithProviders(
      <MessageList
        messages={[]}
        currentUserId={CURRENT_USER_ID}
        recipientLastRead={null}
        loading={false}
        outgoingMessages={[
          makeOutgoing({ clientId: 'a', content: 'eggs failed', status: 'failed', errorMessage: 'x' }),
          makeOutgoing({ clientId: 'b', content: 'bacon sending', status: 'sending' }),
        ]}
        onRetryOutgoing={vi.fn()}
      />,
    );
    expect(screen.getByText('eggs failed')).toBeInTheDocument();
    expect(screen.getByText('bacon sending')).toBeInTheDocument();
    expect(screen.getByTestId('failed-message').textContent).toContain('eggs failed');
    // Pending one is NOT in a failed-message container.
    expect(screen.getAllByTestId('failed-message')).toHaveLength(1);
  });
});
