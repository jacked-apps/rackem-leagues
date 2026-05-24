// @vitest-environment jsdom
/**
 * @fileoverview Unit tests for CreateTeamChatPrompt.
 *
 * Covers: invisibility when nothing is missing, one card per missing team,
 * click triggers createTeamChat() and fires onChatCreated.
 *
 * happy-dom mangles Content-Type on supabase-js writes (PostgREST 406);
 * jsdom is required for this file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const mockUseCaptainTeamsMissingChat = vi.fn();
const mockUseCurrentMember = vi.fn();
const mockCreateTeamChat = vi.fn();

vi.mock('@/api/hooks', () => ({
  useCaptainTeamsMissingChat: () => mockUseCaptainTeamsMissingChat(),
  useCurrentMember: () => mockUseCurrentMember(),
}));

vi.mock('@/api/mutations/autoConversations', () => ({
  createTeamChat: (...args: unknown[]) => mockCreateTeamChat(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CreateTeamChatPrompt } from '../CreateTeamChatPrompt';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCurrentMember.mockReturnValue({ data: { id: 'm1' } });
});

describe('CreateTeamChatPrompt', () => {
  it('renders nothing when no captained teams are missing a chat', () => {
    mockUseCaptainTeamsMissingChat.mockReturnValue({ data: [] });

    const { container } = renderWithProviders(<CreateTeamChatPrompt />);

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('create-team-chat-prompt')).toBeNull();
  });

  it('renders one card per missing team with the team name visible', () => {
    mockUseCaptainTeamsMissingChat.mockReturnValue({
      data: [
        { team_id: 't1', team_name: 'The Cue Crew', season_id: 's1' },
        { team_id: 't2', team_name: 'Side Pocket Sharks', season_id: 's1' },
      ],
    });

    renderWithProviders(<CreateTeamChatPrompt />);

    const cards = screen.getAllByTestId('create-team-chat-prompt');
    expect(cards).toHaveLength(2);
    expect(screen.getByText('The Cue Crew')).toBeInTheDocument();
    expect(screen.getByText('Side Pocket Sharks')).toBeInTheDocument();
  });

  it('calls createTeamChat and onChatCreated on button click', async () => {
    mockUseCaptainTeamsMissingChat.mockReturnValue({
      data: [{ team_id: 't1', team_name: 'The Cue Crew', season_id: 's1' }],
    });
    mockCreateTeamChat.mockResolvedValue({
      conversationId: 'conv-99',
      created: true,
    });
    const onChatCreated = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <CreateTeamChatPrompt onChatCreated={onChatCreated} />
    );

    await user.click(
      screen.getByRole('button', { name: /create team chat/i })
    );

    expect(mockCreateTeamChat).toHaveBeenCalledWith({
      seasonId: 's1',
      teamId: 't1',
    });
    expect(onChatCreated).toHaveBeenCalledWith('conv-99');
  });
});
