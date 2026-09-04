// @vitest-environment jsdom
/**
 * @fileoverview Tests for the brackets index page (Unit 8).
 *
 * Empty state shows the first-run CTA; a populated list links into each
 * bracket with its status badge. The member + list hooks are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import type { BracketRow } from '@/api/queries/brackets';

const mockUseCurrentMember = vi.fn();
const mockUseBracketsByCreator = vi.fn();

vi.mock('@/api/hooks/useCurrentMember', () => ({
  useCurrentMember: () => mockUseCurrentMember(),
}));
vi.mock('@/api/hooks/useBrackets', () => ({
  useBracketsByCreator: () => mockUseBracketsByCreator(),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCurrentMember.mockReturnValue({ data: { id: 'm1' } });
});

describe('BracketsIndexPage', () => {
  it('shows the first-run CTA when the member has no brackets', () => {
    mockUseBracketsByCreator.mockReturnValue({ data: [], isLoading: false });
    renderWithProviders(<BracketsIndexPage />);

    expect(screen.getByText(/no brackets yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /create your first bracket/i })
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
});
