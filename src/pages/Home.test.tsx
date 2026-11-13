/**
 * @fileoverview Tests for the Home page's live doors: "Run Your Own League"
 * shows to everyone (the Become a League Operator page is public), and a
 * signed-in member's big button goes straight to My Teams.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { Home } from './Home';

describe('Home', () => {
  it('shows a signed-out visitor the Run Your Own League card', () => {
    renderWithProviders(<Home />, { userContext: { isLoggedIn: false, user: null } });
    const card = screen.getByText('Run Your Own League').closest('a');
    expect(card).toHaveAttribute('href', '/become-league-operator');
    expect(screen.queryByText('Go to My Teams')).not.toBeInTheDocument();
  });

  it('gives a signed-in member a button to My Teams', () => {
    renderWithProviders(<Home />);
    expect(screen.getByText('Go to My Teams').closest('a')).toHaveAttribute('href', '/my-teams');
    expect(screen.getByText('Run Your Own League')).toBeInTheDocument();
  });
});
