/**
 * @fileoverview Integration tests for the Unit-3A additions to /rules:
 * the House-rules filter chip, the scope picker Sheet, and merged CSI +
 * house-rule search results.
 *
 * We mock the data-layer hooks so these tests exercise RulesPage's own
 * behavior without hitting Supabase. The mocks cover every membership
 * shape the chip defaulting logic cares about (0 leagues, 1 league, 2+
 * leagues) and let individual tests override per-scenario.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));

// Silence telemetry — the POSTs to rules_page_events aren't under test here.
vi.mock('@/rules/useRulesEvents', () => ({
  rulesEvents: {
    logPageOpen: vi.fn(),
    logSearch: vi.fn(),
    logDeepLinkOpen: vi.fn(),
    logHouseFilterActivated: vi.fn(),
    logDifferencesOnlyActivated: vi.fn(),
    logHouseRuleOpened: vi.fn(),
    logScopeChanged: vi.fn(),
  },
}));

const activeLeagueMock = vi.fn();
vi.mock('@/rules/useActiveLeague', () => ({
  useActiveLeague: () => activeLeagueMock(),
}));

const myMembershipsMock = vi.fn();
vi.mock('@/rules/useMyMemberships', () => ({
  useMyMemberships: () => myMembershipsMock(),
}));

const houseForMembershipsMock = vi.fn();
const houseForScopeMock = vi.fn();
vi.mock('@/rules/useHouseRules', () => ({
  useHouseRulesForMemberships: () => houseForMembershipsMock(),
  useHouseRulesForScope: () => houseForScopeMock(),
}));

import RulesPage from '@/rules/RulesPage';
import type { HouseRule } from '@/rules/house-rules.types';

const ED_LEAGUE = {
  id: 'league-ed',
  displayName: "Ed's 8-Ball Mondays",
  organizationId: 'org-ed',
  organizationName: "Ed's Leagues",
};
const JACKS_LEAGUE = {
  id: 'league-jack',
  displayName: "Jack's 9-Ball Fridays",
  organizationId: 'org-jack',
  organizationName: "Jack's Hall",
};

function houseRule(partial: Partial<HouseRule>): HouseRule {
  return {
    id: 'hr-1',
    organization_id: null,
    league_id: ED_LEAGUE.id,
    scope_type: 'league',
    scope_name: "Ed's 8-Ball Mondays",
    parent_org_name: "Ed's Leagues",
    game: '8-ball',
    effect_type: 'standalone',
    related_rule_id: null,
    title: 'No jump cues',
    body: ['Jump cues are prohibited in all Ed matches.'],
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    updated_by: null,
    ...partial,
  };
}

describe('RulesPage — House rules filter (Unit 3A)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Pre-dismiss the discovery nudge — each test opts in explicitly.
    window.localStorage.setItem('rackem:rules:houseFilterNudgeDismissed', '1');
    vi.clearAllMocks();

    // Default: logged-in user, member of one league. Chip toggle → selection.
    activeLeagueMock.mockReturnValue({
      activeLeague: { id: ED_LEAGUE.id, displayName: ED_LEAGUE.displayName, organizationName: ED_LEAGUE.organizationName },
      setActiveLeague: vi.fn(),
      clear: vi.fn(),
    });
    myMembershipsMock.mockReturnValue({
      data: { organizations: [{ id: ED_LEAGUE.organizationId, name: ED_LEAGUE.organizationName }], leagues: [ED_LEAGUE] },
      isLoading: false,
      isSuccess: true,
    });
    houseForMembershipsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
    houseForScopeMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
  });

  it('renders the House rules chip in the meta-chip row', () => {
    renderWithProviders(<RulesPage />);
    const chip = screen.getByRole('button', { name: /house rules/i });
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking the chip activates it with the active-league label', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('button', { name: /^house rules$/i }));

    const activated = screen.getByRole('button', { name: /house rules · Ed's 8-Ball Mondays/i });
    expect(activated).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking an already-active chip toggles it off', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    const chip = screen.getByRole('button', { name: /^house rules$/i });
    await user.click(chip);
    await user.click(screen.getByRole('button', { name: /house rules · Ed/i }));

    expect(screen.getByRole('button', { name: /^house rules$/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('opens the scope picker when no active league is set', async () => {
    activeLeagueMock.mockReturnValue({ activeLeague: null, setActiveLeague: vi.fn(), clear: vi.fn() });
    myMembershipsMock.mockReturnValue({
      data: {
        organizations: [
          { id: ED_LEAGUE.organizationId, name: ED_LEAGUE.organizationName },
          { id: JACKS_LEAGUE.organizationId, name: JACKS_LEAGUE.organizationName },
        ],
        leagues: [ED_LEAGUE, JACKS_LEAGUE],
      },
      isLoading: false,
      isSuccess: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('button', { name: /^house rules$/i }));

    expect(await screen.findByRole('heading', { name: /which league/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all my leagues/i })).toBeInTheDocument();
  });

  it('picker lists memberships and selecting one updates the chip label', async () => {
    activeLeagueMock.mockReturnValue({ activeLeague: null, setActiveLeague: vi.fn(), clear: vi.fn() });
    myMembershipsMock.mockReturnValue({
      data: { organizations: [], leagues: [ED_LEAGUE, JACKS_LEAGUE] },
      isLoading: false,
      isSuccess: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('button', { name: /^house rules$/i }));
    await user.click(await screen.findByRole('button', { name: /Jack's 9-Ball Fridays/i }));

    // Chip label truncates names > 20 chars (labelFor in RulesPage).
    expect(screen.getByRole('button', { name: /house rules · Jack's 9-Ball Frid/i })).toBeInTheDocument();
  });

  it('picker shows the empty state when the user has no memberships', async () => {
    activeLeagueMock.mockReturnValue({ activeLeague: null, setActiveLeague: vi.fn(), clear: vi.fn() });
    myMembershipsMock.mockReturnValue({
      data: { organizations: [], leagues: [] },
      isLoading: false,
      isSuccess: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    await user.click(screen.getByRole('button', { name: /^house rules$/i }));

    expect(await screen.findByText(/not in a league yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /all my leagues/i })).not.toBeInTheDocument();
  });

  it('merges house-rule matches into the search results with scope badges', async () => {
    houseForMembershipsMock.mockReturnValue({
      data: [houseRule({ title: 'No jump cues', body: ['Jump cues are prohibited in all Ed matches.'] })],
      isLoading: false,
      isSuccess: true,
    });

    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);

    // Activate the chip so house rules are visible.
    await user.click(screen.getByRole('button', { name: /^house rules$/i }));
    // Search the overlapping term.
    await user.type(screen.getByRole('searchbox', { name: /search the rules/i }), 'jump');
    await new Promise((r) => setTimeout(r, 300));

    const list = await screen.findByRole('list', { name: /search results for jump/i });
    // CSI-first, house-second per R16 — both render. House badge is prefixed "House · {scope}".
    expect(list).toHaveTextContent('No jump cues');
    expect(list).toHaveTextContent("House · Ed's 8-Ball Mondays");
  });
});

describe('RulesPage — TOC interleave + differences-only (Unit 3B)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('rackem:rules:houseFilterNudgeDismissed', '1');
    vi.clearAllMocks();

    activeLeagueMock.mockReturnValue({
      activeLeague: { id: ED_LEAGUE.id, displayName: ED_LEAGUE.displayName, organizationName: ED_LEAGUE.organizationName },
      setActiveLeague: vi.fn(),
      clear: vi.fn(),
    });
    myMembershipsMock.mockReturnValue({
      data: { organizations: [], leagues: [ED_LEAGUE] },
      isLoading: false,
      isSuccess: true,
    });
    houseForScopeMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
  });

  it('shows a standalone house rule under "League-specific additions"', async () => {
    houseForMembershipsMock.mockReturnValue({
      data: [houseRule({ id: 'std-1', effect_type: 'standalone', related_rule_id: null, title: 'No jump cues' })],
      isLoading: false,
      isSuccess: true,
    });
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);
    await user.click(screen.getByRole('button', { name: /^house rules$/i }));

    const additions = screen.getByRole('region', { name: /league-specific additions/i });
    expect(additions).toHaveTextContent('No jump cues');
  });

  it('shows the differences-only toggle only when a single scope is active', async () => {
    houseForMembershipsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);
    expect(screen.queryByLabelText(/show only house-rule differences/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^house rules$/i }));
    expect(screen.getByLabelText(/show only house-rule differences/i)).toBeInTheDocument();
  });

  it('renders the empty state when differences-only is on with zero house rules', async () => {
    houseForMembershipsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
    const user = userEvent.setup();
    renderWithProviders(<RulesPage />);
    await user.click(screen.getByRole('button', { name: /^house rules$/i }));
    await user.click(screen.getByLabelText(/show only house-rule differences/i));

    expect(screen.getByText(/uses the standard CSI rules/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /view the full rulebook/i }));
    expect(screen.queryByText(/uses the standard CSI rules/i)).not.toBeInTheDocument();
  });
});

describe('RulesPage — discovery nudge (Unit 3B)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();

    activeLeagueMock.mockReturnValue({
      activeLeague: { id: ED_LEAGUE.id, displayName: ED_LEAGUE.displayName, organizationName: ED_LEAGUE.organizationName },
      setActiveLeague: vi.fn(),
      clear: vi.fn(),
    });
    myMembershipsMock.mockReturnValue({
      data: { organizations: [], leagues: [ED_LEAGUE] },
      isLoading: false,
      isSuccess: true,
    });
    houseForMembershipsMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
    houseForScopeMock.mockReturnValue({ data: [], isLoading: false, isSuccess: true });
  });

  it('shows the nudge for a logged-in member who hasn\'t dismissed it', () => {
    renderWithProviders(<RulesPage />);
    expect(screen.getByText(/your league may have house rules/i)).toBeInTheDocument();
  });

  it('does not show the nudge when the user has no memberships', () => {
    myMembershipsMock.mockReturnValue({
      data: { organizations: [], leagues: [] },
      isLoading: false,
      isSuccess: true,
    });
    renderWithProviders(<RulesPage />);
    expect(screen.queryByText(/your league may have house rules/i)).not.toBeInTheDocument();
  });

  it('dismissing the nudge persists across reload', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<RulesPage />);
    await user.click(screen.getByRole('button', { name: /dismiss house rules tip/i }));
    expect(screen.queryByText(/your league may have house rules/i)).not.toBeInTheDocument();

    unmount();
    renderWithProviders(<RulesPage />);
    expect(screen.queryByText(/your league may have house rules/i)).not.toBeInTheDocument();
  });
});
