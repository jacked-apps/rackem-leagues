// @vitest-environment jsdom
/**
 * @fileoverview Tests for the brackets index page (Unit 8).
 *
 * Two lists: tournaments you run, and tournaments you're playing in. The second
 * one exists because a player who joined by QR previously had no route back to
 * their tournament from inside the app. The member + list hooks are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import type { BracketRow, MyTournament } from '@/api/queries/brackets';

const mockUseCurrentMember = vi.fn();
const mockUseBracketsByCreator = vi.fn();
const mockUseMyTournaments = vi.fn();

vi.mock('@/api/hooks/useCurrentMember', () => ({
  useCurrentMember: () => mockUseCurrentMember(),
}));
vi.mock('@/api/hooks/useBrackets', () => ({
  useBracketsByCreator: () => mockUseBracketsByCreator(),
  useMyTournaments: () => mockUseMyTournaments(),
}));

import { BracketsIndexPage } from './BracketsIndexPage';

function bracket(over: Partial<BracketRow>): BracketRow {
  return {
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
    ...over,
  } as BracketRow;
}

/** A tournament the member is playing in but did not create. */
function joined(over: Partial<MyTournament> = {}): MyTournament {
  return {
    id: 'j1',
    name: 'Tuesday 8-Ball',
    status: 'setup',
    join_token: 'jt-1',
    created_at: '',
    entry_status: 'official',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCurrentMember.mockReturnValue({ data: { id: 'm1' } });
  mockUseBracketsByCreator.mockReturnValue({ data: [], isLoading: false });
  mockUseMyTournaments.mockReturnValue({ data: [], isLoading: false });
});

describe('BracketsIndexPage', () => {
  it('shows the first-run CTA when the member has no brackets', () => {
    mockUseBracketsByCreator.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<BracketsIndexPage />);

    expect(screen.getByText(/no tournaments yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /create your first tournament/i })
    ).toBeInTheDocument();
  });

  it('lists brackets with a link into each and a status badge', () => {
    mockUseBracketsByCreator.mockReturnValue({
      data: [bracket({ id: 'b1', name: 'Friday 9-Ball', status: 'live' })],
      isLoading: false,
    });
    renderWithProviders(<BracketsIndexPage />);

    const link = screen.getByRole('link', { name: /Friday 9-Ball/ });
    expect(link).toHaveAttribute('href', '/brackets/b1');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it("lists tournaments you're playing in, linking to your own view of them", () => {
    mockUseMyTournaments.mockReturnValue({ data: [joined()], isLoading: false });
    renderWithProviders(<BracketsIndexPage />);

    // The player's home is the join page, not the organizer's setup screen.
    expect(screen.getByRole('link', { name: /Tuesday 8-Ball/ })).toHaveAttribute(
      'href',
      '/brackets/join/jt-1'
    );
  });

  it('says when you are only waiting, since that is what you came back to check', () => {
    mockUseMyTournaments.mockReturnValue({
      data: [joined({ entry_status: 'hopper' })],
      isLoading: false,
    });
    renderWithProviders(<BracketsIndexPage />);

    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('separates the two lists only when there are both', () => {
    mockUseBracketsByCreator.mockReturnValue({ data: [bracket({})], isLoading: false });
    mockUseMyTournaments.mockReturnValue({ data: [joined()], isLoading: false });
    renderWithProviders(<BracketsIndexPage />);

    expect(screen.getByText(/you're playing in/i)).toBeInTheDocument();
    expect(screen.getByText(/you're running/i)).toBeInTheDocument();
  });

  it('does not head a single list with nothing to tell it from', () => {
    mockUseBracketsByCreator.mockReturnValue({ data: [bracket({})], isLoading: false });
    renderWithProviders(<BracketsIndexPage />);

    expect(screen.queryByText(/you're running/i)).toBeNull();
  });

  it('keeps the first-run pitch away from someone who is already playing', () => {
    // They have plenty here; they just didn't create any of it.
    mockUseMyTournaments.mockReturnValue({ data: [joined()], isLoading: false });
    renderWithProviders(<BracketsIndexPage />);

    expect(screen.queryByText(/no tournaments yet/i)).toBeNull();
  });
});
