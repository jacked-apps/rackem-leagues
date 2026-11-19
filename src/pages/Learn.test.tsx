/**
 * @fileoverview Learn page — a way out.
 *
 * `/learn` is public, and a signed-out visitor has no menu. Before this test
 * the page had no header and no back arrow, so a visitor who opened it from
 * Home was stuck (Ed, 2026-11-19). Rule: the page always has a back arrow;
 * a visitor goes back to Home, a member to My Teams (same as Become a League
 * Operator).
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';

// The header's drawer and org badge fetch data; neither matters here.
vi.mock('@/components/layout/AppDrawer', () => ({ AppDrawer: () => null }));
vi.mock('@/api/hooks/useOrganizations', () => ({ useOrganization: () => ({ data: null }) }));

import Learn from './Learn';

function renderLearn(isLoggedIn: boolean) {
  return renderWithProviders(<Learn />, {
    userContext: { isLoggedIn },
    initialRoute: '/learn',
  });
}

describe('Learn page', () => {
  it('a signed-out visitor gets a back arrow to Home', () => {
    renderLearn(false);
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });

  it('a signed-in member gets a back arrow to My Teams', () => {
    renderLearn(true);
    expect(screen.getByRole('link', { name: 'Back to My Teams' })).toHaveAttribute('href', '/my-teams');
  });

  it('still shows the Learn title and the glossary', () => {
    renderLearn(false);
    expect(screen.getByText('Learn')).toBeInTheDocument();
    expect(screen.getByLabelText(/search glossary/i)).toBeInTheDocument();
  });
});
