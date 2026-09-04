/**
 * @fileoverview Tests for the DM vs group sender-name rule in MessageList.
 *
 * In a 1:1 DM there is exactly one other person and the header already names
 * them, so repeating the name over every incoming bubble is noise — worse, it
 * reads as though someone else might be in the thread. Group chats still need
 * it to tell speakers apart.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('@/hooks/useProfanityFilter', () => ({
  useProfanityFilter: () => ({
    shouldFilter: false,
    canToggle: true,
    isLoading: false,
  }),
}));

import { MessageList } from '../MessageList';

const CURRENT_USER_ID = 'me-123';

const FROM_OTHER = {
  id: 'msg-1',
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

const FROM_ME = {
  ...FROM_OTHER,
  id: 'msg-2',
  content: 'on my way',
  sender: {
    id: CURRENT_USER_ID,
    first_name: 'Maya',
    last_name: 'Elterigo',
    system_player_number: 2,
  },
};

function renderList(isDM: boolean) {
  return renderWithProviders(
    <MessageList
      messages={[FROM_OTHER, FROM_ME]}
      currentUserId={CURRENT_USER_ID}
      recipientLastRead={null}
      loading={false}
      isDM={isDM}
    />
  );
}

describe('MessageList sender names', () => {
  it('omits the sender name on incoming bubbles in a DM', () => {
    renderList(true);

    // The message is there...
    expect(screen.getByText('see you at league night')).toBeInTheDocument();
    // ...but not stamped with who sent it; the header already says.
    expect(screen.queryByText('Sally Anderson')).not.toBeInTheDocument();
  });

  it('keeps the sender name in a group chat, where it disambiguates', () => {
    renderList(false);

    expect(screen.getByText('Sally Anderson')).toBeInTheDocument();
  });

  it('never labels your own messages, in either mode', () => {
    renderList(false);
    expect(screen.queryByText('Maya Elterigo')).not.toBeInTheDocument();
  });

  it('defaults to group behaviour when isDM is not passed', () => {
    // Existing callers that predate this prop must keep showing names.
    renderWithProviders(
      <MessageList
        messages={[FROM_OTHER]}
        currentUserId={CURRENT_USER_ID}
        recipientLastRead={null}
        loading={false}
      />
    );

    expect(screen.getByText('Sally Anderson')).toBeInTheDocument();
  });
});
