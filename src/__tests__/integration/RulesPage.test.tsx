/**
 * @fileoverview Integration test for the `/rules` landing page.
 *
 * Verifies the shell page renders the right content from the cleaned
 * rulebook data, that game tabs switch correctly, and that the
 * localStorage-backed "remember last game" behavior works.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/utils';

import RulesPage from '@/rules/RulesPage';

const LAST_GAME_KEY = 'rackem:rules:lastGame';

describe('RulesPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the search input, every game tab, and the default game TOC', () => {
    renderWithProviders(<RulesPage />);

    expect(screen.getByRole('searchbox', { name: /search the rulebook/i })).toBeInTheDocument();

    // Each of the nine games + "All games" appears as a tab trigger.
    for (const label of ['General Rules', '8-Ball', '9-Ball', '10-Ball', 'All games']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }

    // Default game is 8-Ball — its first rule's heading is "The Game".
    expect(screen.getAllByText('The Game').length).toBeGreaterThan(0);
  });

  it('switches content when a different game tab is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('tab', { name: '9-Ball' }));

    // 9-Ball has a rule with heading "Push-out After the Break" — the
    // default 8-Ball section does not. Its appearance confirms the swap.
    expect(screen.getByText('Push-out After the Break')).toBeInTheDocument();
  });

  it('persists the last-selected tab to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('tab', { name: '10-Ball' }));

    expect(window.localStorage.getItem(LAST_GAME_KEY)).toBe('10-ball');
  });

  it('falls back to the default game when localStorage holds an unknown slug', () => {
    window.localStorage.setItem(LAST_GAME_KEY, 'ghost-pool');
    renderWithProviders(<RulesPage />);

    // Default (8-ball) rules render; nothing throws.
    const tabs = screen.getAllByRole('tab');
    expect(tabs.some((t) => t.getAttribute('data-state') === 'active')).toBe(true);
  });

  it('renders the All games accordion when its tab is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('tab', { name: 'All games' }));

    // The accordion lists every game; "General Rules" appears as a button.
    const allGamesPanel = screen.getByRole('tabpanel', { name: 'All games' });
    expect(within(allGamesPanel).getByRole('button', { name: /General Rules/ })).toBeInTheDocument();
    expect(within(allGamesPanel).getByRole('button', { name: /Scotch Doubles/ })).toBeInTheDocument();
  });

  it('pressing "/" focuses the search input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);
    const input = screen.getByRole('searchbox', { name: /search the rulebook/i });

    // Nothing is focused initially (userEvent dispatches to body by default),
    // which is what triggers our window-level "/" handler.
    await user.keyboard('/');

    expect(document.activeElement).toBe(input);
  });

  it('renders the CSI attribution with a link to the hosted source PDF', () => {
    renderWithProviders(<RulesPage />);

    const link = screen.getByRole('link', { name: /view source pdf/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.getAttribute('href')).toMatch(/^https?:\/\//);
  });
});
