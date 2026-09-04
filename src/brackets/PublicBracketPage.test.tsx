// @vitest-environment jsdom
/**
 * @fileoverview Tests for the public bracket share page (Unit 6).
 *
 * Renders a read-only tree for a valid token, shows the funnel-friendly ended
 * state for an unknown/closed token, and never exposes tappable slots (no
 * advance affordance on the public view). The share hook + realtime are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import type { BracketShareView } from '@/api/queries/brackets';

const mockUseBracketShare = vi.fn();

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useParams: () => ({ shareToken: 'tok-1' }),
}));

vi.mock('@/api/hooks/useBrackets', () => ({
  useBracketShare: () => mockUseBracketShare(),
}));

vi.mock('./useBracketRealtime', () => ({ useBracketRealtime: vi.fn() }));

import { PublicBracketPage } from './PublicBracketPage';

/** A found, live 2-player share view (Ann vs Bo, ready). */
function foundView(): BracketShareView {
  return {
    found: true,
    bracket: {
      id: 'b1',
      name: 'Friday 9-Ball',
      format: 'single_elimination',
      status: 'live',
      grand_final_reset: false,
    },
    participants: [
      { id: 'p1', display_name: 'Ann', seed: 1 },
      { id: 'p2', display_name: 'Bo', seed: 2 },
    ],
    matches: [
      {
        id: 'final',
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
      },
    ],
  };
}

beforeEach(() => vi.clearAllMocks());

describe('PublicBracketPage', () => {
  it('renders the bracket name + read-only tree for a valid token', () => {
    mockUseBracketShare.mockReturnValue({ data: foundView(), isLoading: false });
    renderWithProviders(<PublicBracketPage />);

    expect(screen.getByText('Friday 9-Ball')).toBeInTheDocument();
    expect(screen.getByText('Ann')).toBeInTheDocument();
    // Read-only: names are plain text, not pick buttons.
    expect(screen.queryByRole('button', { name: 'Ann' })).not.toBeInTheDocument();
  });

  it('shows the ended state + create CTA for an unknown/closed token', () => {
    mockUseBracketShare.mockReturnValue({
      data: { found: false, bracket: null, participants: [], matches: [] },
      isLoading: false,
    });
    renderWithProviders(<PublicBracketPage />);

    expect(screen.getByText(/this bracket has ended/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /create your own bracket/i })
    ).toBeInTheDocument();
  });

  it('shows a loading state while fetching', () => {
    mockUseBracketShare.mockReturnValue({ data: undefined, isLoading: true });
    renderWithProviders(<PublicBracketPage />);
    expect(screen.getByText(/loading bracket/i)).toBeInTheDocument();
  });
});
