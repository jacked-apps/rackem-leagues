/**
 * @fileoverview SignInFirstLink — a visitor is told why before being sent to
 * sign in, and sign-in brings them back to where they were headed.
 *
 * Rules (Ed, 2026-11-19):
 *   - Signed in: a plain link to the page.
 *   - Signed out: tapping opens "Sign in first" with the reason; it does NOT
 *     navigate on its own.
 *   - The dialog's Sign in carries ?redirect=<page>, so login returns there.
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { Button } from '@/components/ui/button';
import { SignInFirstLink } from './SignInFirstLink';

const REASON = 'You need an account to apply.';

function renderLink(isLoggedIn: boolean) {
  return renderWithProviders(
    <SignInFirstLink to="/league-operator-application" reason={REASON}>
      <Button>Start Application</Button>
    </SignInFirstLink>,
    { userContext: { isLoggedIn }, initialRoute: '/become-league-operator' },
  );
}

describe('SignInFirstLink', () => {
  it('signed in: a plain link straight to the page, no dialog', async () => {
    renderLink(true);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/league-operator-application');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start Application' }));
    expect(screen.queryByText('Sign in first')).not.toBeInTheDocument();
  });

  it('signed out: tapping explains why instead of navigating', async () => {
    renderLink(false);
    // No link to the members-only page is on screen before the tap.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start Application' }));
    expect(screen.getByText('Sign in first')).toBeInTheDocument();
    expect(screen.getByText(REASON)).toBeInTheDocument();
  });

  it('signed out: Sign in returns to the page afterwards; Create account is offered', async () => {
    renderLink(false);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start Application' }));
    expect(screen.getByRole('link', { name: 'Sign in' }))
      .toHaveAttribute('href', '/login?redirect=%2Fleague-operator-application');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
  });
});
