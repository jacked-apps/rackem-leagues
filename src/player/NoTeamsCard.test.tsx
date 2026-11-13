/**
 * @fileoverview Tests for NoTeamsCard — My Teams' empty state must give a
 * member with no team a next step (how to get on a team, and the way to Home),
 * not just "you're not on any teams".
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/utils';
import { NoTeamsCard } from './NoTeamsCard';

describe('NoTeamsCard', () => {
  it('says how a player gets onto a team', () => {
    renderWithProviders(<NoTeamsCard />, { initialRoute: '/my-teams' });
    expect(screen.getByText("You're not on any teams yet")).toBeInTheDocument();
    expect(screen.getByText(/captain can add you/i)).toBeInTheDocument();
  });

  it('sends the member to the Home page for more options', () => {
    renderWithProviders(<NoTeamsCard />, { initialRoute: '/my-teams' });
    fireEvent.click(screen.getByRole('button', { name: /more options on the home page/i }));
    expect(window.location.pathname).toBe('/');
  });
});
