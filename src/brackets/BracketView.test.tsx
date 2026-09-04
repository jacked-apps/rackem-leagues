// @vitest-environment jsdom
/**
 * @fileoverview Tests for the organizer bracket view (Unit 5).
 *
 * Renders a live tree, confirms tap-to-advance (tap slot → confirm dialog →
 * advanceWinner called with the right ids), shows the champion banner when
 * complete, and treats a non-live bracket as read-only (no tappable slots). The
 * data + mutation hooks and realtime are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/utils';
import type { BracketDetail } from '@/api/queries/brackets';

const mockUseBracket = vi.fn();
const mockAdvance = vi.fn();
const mockClose = vi.fn();

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useParams: () => ({ bracketId: 'b1' }),
}));

vi.mock('@/api/hooks/useBrackets', () => ({
  useBracket: () => mockUseBracket(),
  useAdvanceWinner: () => ({ mutateAsync: mockAdvance }),
  useCloseBracket: () => ({ mutateAsync: mockClose }),
}));

vi.mock('./useBracketRealtime', () => ({ useBracketRealtime: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { BracketView } from './BracketView';

/** A 2-player live bracket: one ready final, Ann (p1) vs Bo (p2). */
function liveDetail(): BracketDetail {
  return {
    bracket: {
      id: 'b1',
      name: 'Friday 9-Ball',
      format: 'single_elimination',
      status: 'live',
      seeding_mode: 'seeded',
      grand_final_reset: false,
      share_token: 'tok',
      created_by: 'm1',
      last_activity_at: '',
      created_at: '',
    } as BracketDetail['bracket'],
    participants: [
      { id: 'p1', bracket_id: 'b1', display_name: 'Ann', seed: 1, member_id: null, created_at: '' },
      { id: 'p2', bracket_id: 'b1', display_name: 'Bo', seed: 2, member_id: null, created_at: '' },
    ],
    matches: [
      {
        id: 'final',
        bracket_id: 'b1',
        round: 1,
        side: 'winners',
        slot: 0,
        home_participant_id: 'p1',
        away_participant_id: 'p2',
        winner_participant_id: null,
        next_match_id: null,
        next_match_slot: null,
        loser_next_match_id: null,
        loser_next_match_slot: null,
        status: 'ready',
        is_reset_match: false,
        created_at: '',
      } as BracketDetail['matches'][number],
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAdvance.mockResolvedValue(true);
});

describe('BracketView', () => {
  it('tap-to-advance: pick a slot → confirm → advanceWinner with the right ids', async () => {
    const user = userEvent.setup();
    mockUseBracket.mockReturnValue({ data: liveDetail(), isLoading: false, isError: false });

    renderWithProviders(<BracketView />);

    // Tap Ann's slot.
    await user.click(screen.getByRole('button', { name: 'Ann' }));
    // Confirm dialog appears.
    expect(screen.getByText('Advance Ann?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Advance' }));

    expect(mockAdvance).toHaveBeenCalledWith({
      matchId: 'final',
      winnerParticipantId: 'p1',
    });
  });

  it('shows the champion banner + close action when complete', () => {
    const detail = liveDetail();
    detail.bracket.status = 'complete';
    detail.matches[0].status = 'complete';
    detail.matches[0].winner_participant_id = 'p1';
    mockUseBracket.mockReturnValue({ data: detail, isLoading: false, isError: false });

    renderWithProviders(<BracketView />);

    expect(screen.getByText(/Ann wins/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close bracket/i })).toBeInTheDocument();
  });

  it('close requires confirmation before calling closeBracket', async () => {
    const user = userEvent.setup();
    const detail = liveDetail();
    detail.bracket.status = 'complete';
    detail.matches[0].status = 'complete';
    detail.matches[0].winner_participant_id = 'p1';
    mockUseBracket.mockReturnValue({ data: detail, isLoading: false, isError: false });
    mockClose.mockResolvedValue(undefined);

    renderWithProviders(<BracketView />);

    // The header button just opens the confirm — no close yet.
    await user.click(screen.getByRole('button', { name: /close bracket/i }));
    expect(mockClose).not.toHaveBeenCalled();
    expect(screen.getByText(/close this bracket\?/i)).toBeInTheDocument();

    // Confirm inside the dialog fires the mutation.
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /close bracket/i }));
    expect(mockClose).toHaveBeenCalledWith('b1');
  });

  it('a completed (non-live) bracket renders read-only — no tappable slot', () => {
    const detail = liveDetail();
    detail.bracket.status = 'complete';
    detail.matches[0].status = 'complete';
    detail.matches[0].winner_participant_id = 'p1';
    mockUseBracket.mockReturnValue({ data: detail, isLoading: false, isError: false });

    renderWithProviders(<BracketView />);

    // Names render as text, not as pick buttons.
    expect(screen.queryByRole('button', { name: 'Ann' })).not.toBeInTheDocument();
  });

  it('renders a not-found state on error', () => {
    mockUseBracket.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<BracketView />);
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });
});
