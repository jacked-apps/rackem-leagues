/**
 * @fileoverview Integration test for `HouseRuleDetailPage` at
 * `/rules/house/:scope/:scopeId/:ruleId`. Covers the happy path (rule
 * renders with scope-name header + CSI backlink), the drawer (lists
 * siblings, current one highlighted), the unknown-rule fallback, and
 * the standalone attribution variant.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, userEvent, within } from '@/test/utils';

vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) },
}));

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

const useHouseRuleMock = vi.fn();
const useHouseRulesForScopeMock = vi.fn();
vi.mock('@/rules/useHouseRules', () => ({
  useHouseRule: (...args: unknown[]) => useHouseRuleMock(...args),
  useHouseRulesForScope: (...args: unknown[]) => useHouseRulesForScopeMock(...args),
  useHouseRulesForMemberships: () => ({ data: [], isLoading: false, isSuccess: true }),
}));

import HouseRuleDetailPage from '@/rules/HouseRuleDetailPage';
import type { HouseRule } from '@/rules/house-rules.types';

function baseRule(partial: Partial<HouseRule> = {}): HouseRule {
  return {
    id: 'rule-uuid-1',
    organization_id: null,
    league_id: 'league-uuid-1',
    scope_type: 'league',
    scope_name: "Ed's 8-Ball Mondays",
    parent_org_name: "Ed's Leagues",
    game: '8-ball',
    effect_type: 'override',
    related_rule_id: '8-ball:2-1',
    title: 'No slop',
    body: ['Every shot must be called. Slop counts as ball-in-hand.'],
    created_at: '',
    updated_at: '',
    updated_by: null,
    ...partial,
  };
}

function renderAt(url: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/rules/house/:scope/:scopeId/:ruleId" element={<HouseRuleDetailPage />} />
      <Route path="/rules/:game/:ruleId" element={<div data-testid="csi-detail">CSI detail</div>} />
      <Route path="/rules" element={<div data-testid="rules-landing">Rules landing</div>} />
    </Routes>,
    { initialRoute: url },
  );
}

describe('HouseRuleDetailPage', () => {
  beforeEach(() => {
    toastError.mockReset();
    useHouseRuleMock.mockReset();
    useHouseRulesForScopeMock.mockReset();
  });

  it('renders heading, body, scope header, and the CSI backlink for an override rule', () => {
    useHouseRuleMock.mockReturnValue({ data: baseRule(), isLoading: false, isError: false });
    useHouseRulesForScopeMock.mockReturnValue({ data: [baseRule()], isLoading: false });

    renderAt('/rules/house/league/league-uuid-1/rule-uuid-1');

    expect(screen.getByRole('heading', { level: 1, name: /no slop/i })).toBeInTheDocument();
    expect(screen.getByText(/every shot must be called/i)).toBeInTheDocument();
    const backlink = screen.getByRole('link', { name: /CSI Rule 2-1/i });
    expect(backlink).toHaveAttribute('href', '/rules/8-ball/2-1');
    expect(screen.getByRole('button', { name: /copy link to this rule/i })).toBeInTheDocument();
  });

  it('omits the CSI backlink for a standalone rule', () => {
    useHouseRuleMock.mockReturnValue({
      data: baseRule({ effect_type: 'standalone', related_rule_id: null, title: 'No jump cues' }),
      isLoading: false,
      isError: false,
    });
    useHouseRulesForScopeMock.mockReturnValue({ data: [], isLoading: false });

    renderAt('/rules/house/league/league-uuid-1/rule-uuid-1');

    expect(screen.queryByRole('link', { name: /CSI Rule/i })).not.toBeInTheDocument();
    expect(screen.getByText(/not tied to a specific CSI rule/i)).toBeInTheDocument();
  });

  it('drawer lists sibling rules with the current one highlighted', async () => {
    const current = baseRule({ id: 'rule-current', title: 'No slop' });
    const sibling = baseRule({ id: 'rule-sibling', title: 'No jump cues', related_rule_id: null, effect_type: 'standalone' });
    useHouseRuleMock.mockReturnValue({ data: current, isLoading: false, isError: false });
    useHouseRulesForScopeMock.mockReturnValue({ data: [current, sibling], isLoading: false });

    const user = userEvent.setup();
    renderAt('/rules/house/league/league-uuid-1/rule-current');

    await user.click(screen.getByRole('button', { name: /browse Ed's 8-Ball Mondays/i }));
    const nav = await screen.findByRole('navigation', { name: /house rules in Ed's 8-Ball Mondays/i });

    // Current rule highlighted (aria-current=page).
    const currentLink = within(nav).getByRole('link', { current: 'page' });
    expect(currentLink).toHaveTextContent('No slop');
    // Sibling visible and links to its own URL.
    expect(within(nav).getByRole('link', { name: /no jump cues/i })).toHaveAttribute(
      'href',
      '/rules/house/league/league-uuid-1/rule-sibling',
    );
  });

  it('unknown rule id redirects to /rules with a toast', async () => {
    useHouseRuleMock.mockReturnValue({ data: null, isLoading: false, isError: false });
    useHouseRulesForScopeMock.mockReturnValue({ data: [], isLoading: false });

    renderAt('/rules/house/league/league-uuid-1/does-not-exist');

    expect(await screen.findByTestId('rules-landing')).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/not found/i));
  });
});
