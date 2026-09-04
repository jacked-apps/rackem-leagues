/**
 * @fileoverview Pins the Messages page's URL ⇄ selected-conversation contract.
 *
 * This is not a cosmetic detail. `src/sw.ts` decides whether to suppress a push
 * by asking whether any open window is already viewing that conversation, and
 * the only signal it has is the window's path — `isViewingConversation()` matches
 * `/messages/:id`. So if opening a thread doesn't put its id in the URL, the
 * service worker cannot tell what's on screen and buzzes you for the exact
 * conversation you're reading.
 *
 * That's the bug these tests exist to prevent coming back: selection used to
 * live purely in React state, leaving the address at `/messages`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { isViewingConversation } from '@/utils/push/notificationPayload';

const CONV_A = '11111111-1111-4111-8111-111111111111';
const CONV_B = '22222222-2222-4222-8222-222222222222';

vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: React.ReactNode }) => <div>{title}</div>,
}));
vi.mock('@/components/messages/MessagesEmptyState', () => ({
  MessagesEmptyState: () => <div>empty</div>,
}));
vi.mock('@/components/messages/CreateTeamChatPrompt', () => ({
  CreateTeamChatPrompt: () => null,
}));
vi.mock('@/components/messages/NewMessageModal', () => ({ NewMessageModal: () => null }));
vi.mock('@/components/messages/AnnouncementModal', () => ({ AnnouncementModal: () => null }));
vi.mock('@/components/messages/MessageSettingsModal', () => ({ MessageSettingsModal: () => null }));
vi.mock('@/components/onboarding/ProfanityOnboardingModal', () => ({
  ProfanityOnboardingModal: () => null,
}));
vi.mock('@/components/messages/PushOnboardingPrompt', () => ({
  PushOnboardingPrompt: () => null,
}));

// Conversation list: just enough to click a thread open.
vi.mock('@/components/messages/ConversationList', () => ({
  ConversationList: ({
    onSelectConversation,
  }: {
    onSelectConversation: (id: string) => void;
  }) => (
    <div>
      <button onClick={() => onSelectConversation(CONV_A)}>open A</button>
      <button onClick={() => onSelectConversation(CONV_B)}>open B</button>
    </div>
  ),
}));

// Message view: exposes its Back so we can assert closing clears the URL.
vi.mock('@/components/messages/MessageView', () => ({
  MessageView: ({ conversationId, onBack }: { conversationId: string; onBack: () => void }) => (
    <div>
      <span>viewing {conversationId}</span>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

vi.mock('@/api/hooks', () => ({
  useCurrentMember: () => ({
    data: { id: 'me', first_name: 'Maya', user_id: 'u1', profanity_onboarding_completed_at: '2026-01-01', push_enabled: true },
  }),
  useUserProfile: () => ({ canAccessLeagueOperatorFeatures: () => false }),
  useIsCaptain: () => ({ data: false }),
  useConversations: () => ({
    data: [{ id: CONV_A }, { id: CONV_B }],
    isLoading: false,
  }),
  useCreateOrOpenConversation: () => ({ mutateAsync: vi.fn() }),
  useCreateGroupConversation: () => ({ mutateAsync: vi.fn() }),
  useCreateLeagueAnnouncement: () => ({ mutateAsync: vi.fn() }),
  useCreateOrganizationAnnouncement: () => ({ mutateAsync: vi.fn() }),
}));

import { Messages } from '../Messages';

/** Renders the current path so assertions can read it. */
function PathSpy() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderMessages(initialPath = '/messages') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PathSpy />
      <Routes>
        <Route path="/messages" element={<Messages />} />
        <Route path="/messages/:conversationId" element={<Messages />} />
      </Routes>
    </MemoryRouter>
  );
}

const path = () => screen.getByTestId('path').textContent ?? '';

beforeEach(() => vi.clearAllMocks());

describe('Messages URL ⇄ selection sync (push suppression depends on this)', () => {
  it('puts the conversation id in the URL when opened from the list', () => {
    renderMessages();
    expect(path()).toBe('/messages');

    fireEvent.click(screen.getByText('open A'));

    expect(screen.getByText(`viewing ${CONV_A}`)).toBeInTheDocument();
    expect(path()).toBe(`/messages/${CONV_A}`);
  });

  it('the resulting URL is one the service worker recognises as "viewing"', () => {
    renderMessages();
    fireEvent.click(screen.getByText('open A'));

    // The actual contract: sw.ts calls this with the window URL. If this is
    // false, a message in the open thread will buzz the phone.
    expect(isViewingConversation(`https://app.example${path()}`, CONV_A)).toBe(true);
    // ...and it must not claim we're viewing some other thread.
    expect(isViewingConversation(`https://app.example${path()}`, CONV_B)).toBe(false);
  });

  it('switching threads moves the URL to the new one', () => {
    renderMessages();
    fireEvent.click(screen.getByText('open A'));
    fireEvent.click(screen.getByText('back'));
    fireEvent.click(screen.getByText('open B'));

    expect(path()).toBe(`/messages/${CONV_B}`);
    expect(isViewingConversation(`https://app.example${path()}`, CONV_B)).toBe(true);
  });

  it('closing the thread drops the id, so pushes resume', () => {
    renderMessages();
    fireEvent.click(screen.getByText('open A'));
    fireEvent.click(screen.getByText('back'));

    expect(path()).toBe('/messages');
    expect(isViewingConversation(`https://app.example${path()}`, CONV_A)).toBe(false);
  });

  it('a cold load on a deep link still opens that thread', () => {
    renderMessages(`/messages/${CONV_A}`);

    expect(screen.getByText(`viewing ${CONV_A}`)).toBeInTheDocument();
    expect(path()).toBe(`/messages/${CONV_A}`);
  });
});
