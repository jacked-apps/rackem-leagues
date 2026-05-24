/**
 * @fileoverview Render tests for `MessageBubble`'s system-message variant.
 *
 * Unit 7 of the messaging Phase 1 plan: trigger-driven lines like
 * "Sally joined the team" should render in a centered/italic/muted
 * variant — no avatar, no sender link, no timestamp, no read receipt.
 * The same profanity filter applies defensively so a name like
 * "Mr. Sh!tstain joined the team" still gets cleaned for users with
 * the filter on.
 *
 * `useProfanityFilter` is mocked at module boundary so each test
 * controls the filter state directly.
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

describe('MessageBubble — system-message variant', () => {
  it('renders the system-message wrapper when isSystem is true', () => {
    renderWithProviders(
      <MessageBubble
        content="Sally joined the team"
        createdAt="2026-05-12T10:00:00Z"
        isEdited={false}
        isCurrentUser={false}
        recipientLastRead={null}
        isSystem
      />,
    );
    const node = screen.getByTestId('system-message');
    expect(node).toBeInTheDocument();
    expect(screen.getByText('Sally joined the team')).toBeInTheDocument();
  });

  it('applies italic + muted-foreground + centered styling', () => {
    renderWithProviders(
      <MessageBubble
        content="captain changed"
        createdAt="2026-05-12T10:00:00Z"
        isEdited={false}
        isCurrentUser={false}
        recipientLastRead={null}
        isSystem
      />,
    );
    const wrapper = screen.getByTestId('system-message');
    // Layout: centered horizontally.
    expect(wrapper.className).toMatch(/justify-center/);
    // Inner <p> has the visual signature (italic + muted + centered text).
    const paragraph = wrapper.querySelector('p');
    expect(paragraph?.className).toMatch(/italic/);
    expect(paragraph?.className).toMatch(/text-muted-foreground/);
    expect(paragraph?.className).toMatch(/text-center/);
  });

  it('does NOT render a sender name, avatar link, timestamp, or read receipt', () => {
    renderWithProviders(
      <MessageBubble
        content="Sally joined the team"
        createdAt="2026-05-12T10:00:00Z"
        isEdited
        isCurrentUser={false}
        // Senders are passed by MessageList for default bubbles; the
        // system variant should ignore them defensively if they leak in.
        senderName="Sally"
        senderId="member-abc"
        recipientLastRead="2026-05-12T11:00:00Z"
        isSystem
      />,
    );
    expect(screen.queryByText('Sally')).not.toBeInTheDocument();
    expect(screen.queryByText(/ago/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
    // The read-receipt icons (Check / CheckCheck) shouldn't render either.
    expect(screen.getByTestId('system-message').querySelector('svg')).toBeNull();
  });

  it('applies the profanity filter to system content when shouldFilter is true', () => {
    mockUseProfanityFilter.mockReturnValue({
      shouldFilter: true,
      canToggle: false,
      isLoading: false,
    });
    renderWithProviders(
      <MessageBubble
        content="Sally damn-it joined the team"
        createdAt="2026-05-12T10:00:00Z"
        isEdited={false}
        isCurrentUser={false}
        recipientLastRead={null}
        isSystem
      />,
    );
    // Profane token replaced (grawlix-agnostic — we only assert it's gone
    // and the surrounding text survives).
    expect(screen.queryByText(/\bdamn\b/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sally .+ joined the team/i)).toBeInTheDocument();
  });

  it('leaves system content raw when shouldFilter is false', () => {
    renderWithProviders(
      <MessageBubble
        content="Sally damn-it joined the team"
        createdAt="2026-05-12T10:00:00Z"
        isEdited={false}
        isCurrentUser={false}
        recipientLastRead={null}
        isSystem
      />,
    );
    expect(screen.getByText('Sally damn-it joined the team')).toBeInTheDocument();
  });
});

describe('MessageBubble — default variant unchanged when isSystem is false/omitted', () => {
  it('still renders the standard bubble with sender + timestamp when isSystem is omitted', () => {
    renderWithProviders(
      <MessageBubble
        content="hey"
        createdAt={new Date(Date.now() - 60_000).toISOString()}
        isEdited={false}
        isCurrentUser={false}
        senderName="Sally"
        senderId="member-abc"
        recipientLastRead={null}
      />,
    );
    expect(screen.queryByTestId('system-message')).not.toBeInTheDocument();
    expect(screen.getByText('hey')).toBeInTheDocument();
    expect(screen.getByText('Sally')).toBeInTheDocument();
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });
});
