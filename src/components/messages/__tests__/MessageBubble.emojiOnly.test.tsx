/**
 * @fileoverview Tests for the Unit 13 "giant emoji" render branch in
 * `MessageBubble`. Pins the rule: ≤3 trimmed emojis → large unbubbled
 * render with `data-testid="emoji-only-message"`. Anything else falls
 * through to the default bubble.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

const mockUseProfanityFilter = vi.fn();

vi.mock('@/hooks/useProfanityFilter', () => ({
  useProfanityFilter: () => mockUseProfanityFilter(),
}));

import { MessageBubble } from '../MessageBubble';

beforeEach(() => {
  mockUseProfanityFilter.mockReturnValue({
    shouldFilter: false,
    canToggle: true,
    isLoading: false,
  });
});

describe('MessageBubble — emoji-only render branch', () => {
  it('renders a single emoji as the giant variant', () => {
    renderWithProviders(
      <MessageBubble
        content="👍"
        createdAt={new Date(Date.now() - 60_000).toISOString()}
        isEdited={false}
        isCurrentUser
        recipientLastRead={null}
      />,
    );
    expect(screen.getByTestId('emoji-only-message')).toBeInTheDocument();
    expect(screen.getByText('👍')).toBeInTheDocument();
  });

  it('renders up to 3 emojis as the giant variant', () => {
    renderWithProviders(
      <MessageBubble
        content="🎉🎉🎉"
        createdAt={new Date(Date.now() - 60_000).toISOString()}
        isEdited={false}
        isCurrentUser
        recipientLastRead={null}
      />,
    );
    expect(screen.getByTestId('emoji-only-message')).toBeInTheDocument();
  });

  it('falls through to default bubble for 4+ emojis', () => {
    renderWithProviders(
      <MessageBubble
        content="🎉🎉🎉🎉"
        createdAt={new Date(Date.now() - 60_000).toISOString()}
        isEdited={false}
        isCurrentUser
        recipientLastRead={null}
      />,
    );
    expect(screen.queryByTestId('emoji-only-message')).not.toBeInTheDocument();
  });

  it('falls through to default bubble for mixed text + emoji', () => {
    renderWithProviders(
      <MessageBubble
        content="hi 👍"
        createdAt={new Date(Date.now() - 60_000).toISOString()}
        isEdited={false}
        isCurrentUser
        recipientLastRead={null}
      />,
    );
    expect(screen.queryByTestId('emoji-only-message')).not.toBeInTheDocument();
    expect(screen.getByText('hi 👍')).toBeInTheDocument();
  });

  it('system messages take precedence over emoji-only (renders system variant)', () => {
    renderWithProviders(
      <MessageBubble
        content="👍"
        createdAt={new Date(Date.now() - 60_000).toISOString()}
        isEdited={false}
        isCurrentUser={false}
        recipientLastRead={null}
        isSystem
      />,
    );
    expect(screen.getByTestId('system-message')).toBeInTheDocument();
    expect(screen.queryByTestId('emoji-only-message')).not.toBeInTheDocument();
  });

  it('failed messages take precedence over emoji-only (renders failed variant)', () => {
    renderWithProviders(
      <MessageBubble
        content="👍"
        createdAt={new Date(Date.now() - 60_000).toISOString()}
        isEdited={false}
        isCurrentUser
        recipientLastRead={null}
        failed
        errorMessage="boom"
        onRetry={() => {}}
      />,
    );
    expect(screen.getByTestId('failed-message')).toBeInTheDocument();
    expect(screen.queryByTestId('emoji-only-message')).not.toBeInTheDocument();
  });

  it('shows sender name link for non-current-user emoji-only messages', () => {
    renderWithProviders(
      <MessageBubble
        content="🎉"
        createdAt={new Date(Date.now() - 60_000).toISOString()}
        isEdited={false}
        isCurrentUser={false}
        senderName="Sally"
        senderId="member-abc"
        recipientLastRead={null}
      />,
    );
    expect(screen.getByTestId('emoji-only-message')).toBeInTheDocument();
    expect(screen.getByText('Sally')).toBeInTheDocument();
  });
});
