/**
 * @fileoverview Integration test for the `/rules` landing page.
 *
 * Verifies the shell page renders the right content from the cleaned
 * rulebook data, that the filter-chip game picker behaves correctly
 * (main games visible, "More games" disclosure, "All games"), and that
 * the localStorage-backed "remember last game" behavior works.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

// PageHeader internally uses TanStack Query via useOrganization, which is not
// wired into the shared test helper. Stub it to a simple landmark so these
// tests exercise RulesPage's own behavior, not the shared header.
vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));

import RulesPage from '@/rules/RulesPage';

const LAST_GAME_KEY = 'rackem:rules:lastGame';

describe('RulesPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the page header, search input, main game chips, and default TOC', () => {
    renderWithProviders(<RulesPage />);

    expect(screen.getByRole('heading', { name: 'Official Rules' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search the rules/i })).toBeInTheDocument();

    for (const name of ['General Rules', '8-Ball', '9-Ball', '10-Ball', 'All games']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    // Default game is 8-Ball — its first rule's heading is "The Game".
    expect(screen.getAllByText('The Game').length).toBeGreaterThan(0);

    // The "More games" disclosure chip is there but the secondary row is hidden.
    expect(screen.getByRole('button', { name: /more games/i })).toHaveAttribute('aria-expanded', 'false');
    // One Pocket lives behind the disclosure, so it isn't rendered yet.
    expect(screen.queryByRole('button', { name: 'One Pocket' })).not.toBeInTheDocument();
  });

  it('switches content when a different game chip is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('button', { name: '9-Ball' }));

    expect(screen.getByRole('button', { name: '9-Ball' })).toHaveAttribute('aria-pressed', 'true');
    // 9-Ball has a rule with heading "Push-out After the Break" — the
    // default 8-Ball section does not. Its appearance confirms the swap.
    expect(screen.getByText('Push-out After the Break')).toBeInTheDocument();
  });

  it('persists the last-selected chip to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('button', { name: '10-Ball' }));

    expect(window.localStorage.getItem(LAST_GAME_KEY)).toBe('10-ball');
  });

  it('falls back to the default game when localStorage holds an unknown slug', () => {
    window.localStorage.setItem(LAST_GAME_KEY, 'ghost-pool');
    renderWithProviders(<RulesPage />);

    // Default game (8-Ball) is selected.
    expect(screen.getByRole('button', { name: '8-Ball' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('expands the "More games" row, reveals other games, and auto-expands if an "other" game is active on mount', async () => {
    const user = userEvent.setup();

    // First: cold-start with a main game — "More games" starts collapsed.
    const { unmount } = renderWithProviders(<RulesPage />);
    expect(screen.queryByRole('button', { name: 'One Pocket' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /more games/i }));
    expect(screen.getByRole('button', { name: 'One Pocket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bank Pool' })).toBeInTheDocument();
    unmount();

    // Second: if localStorage points at an "other" game, the row is open from mount.
    window.localStorage.setItem(LAST_GAME_KEY, 'one-pocket');
    renderWithProviders(<RulesPage />);
    expect(screen.getByRole('button', { name: 'One Pocket' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /more games/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders the All games accordion when the "All games" chip is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('button', { name: 'All games' }));

    // Accordion triggers include the rule count in their label, which is
    // how we distinguish them from the identically-named filter chips.
    expect(screen.getByRole('button', { name: /General Rules\s*\(46\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scotch Doubles\s*\(4\)/ })).toBeInTheDocument();
  });

  it('pressing "/" focuses the search input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);
    const input = screen.getByRole('searchbox', { name: /search the rules/i });

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

  it('swaps the TOC for search results when the user types a matching query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.type(screen.getByRole('searchbox', { name: /search the rules/i }), 'stalemate');
    // Wait for debounce (250 ms in SearchInput).
    await new Promise((resolve) => setTimeout(resolve, 300));

    // A search-results list rendered. At least one result card links to a
    // rule whose heading or body contains "stalemate".
    const resultsList = await screen.findByRole('list', { name: /search results for stalemate/i });
    expect(resultsList).toBeInTheDocument();
  });

  it('renders the zero-results state with both Clear buttons when a game filter is active', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.type(screen.getByRole('searchbox', { name: /search the rules/i }), 'xyzzy-not-a-word');
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await screen.findByText(/No rules match "xyzzy-not-a-word" in 8-Ball/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('renders only the Clear search button in zero-results when "All games" is active', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('button', { name: 'All games' }));
    await user.type(screen.getByRole('searchbox', { name: /search the rules/i }), 'xyzzy-not-a-word');
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await screen.findByText(/No rules match "xyzzy-not-a-word"\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('"Clear search" resets the input and restores the TOC', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    const input = screen.getByRole('searchbox', { name: /search the rules/i });
    await user.type(input, 'xyzzy-not-a-word');
    await new Promise((resolve) => setTimeout(resolve, 300));

    await user.click(await screen.findByRole('button', { name: 'Clear search' }));

    // The SearchInput is remounted via key; its value is empty.
    expect(
      (screen.getByRole('searchbox', { name: /search the rules/i }) as HTMLInputElement).value,
    ).toBe('');
    // The TOC is back (8-Ball default shows "The Game").
    expect(screen.getAllByText('The Game').length).toBeGreaterThan(0);
  });

  it('"Clear filter" switches to All games so the query can hit every rule', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.type(screen.getByRole('searchbox', { name: /search the rules/i }), 'xyzzy-not-a-word');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await screen.findByRole('button', { name: 'Clear filter' });

    await user.click(screen.getByRole('button', { name: 'Clear filter' }));

    // "All games" chip is now active.
    expect(screen.getByRole('button', { name: 'All games' })).toHaveAttribute('aria-pressed', 'true');
  });
});
