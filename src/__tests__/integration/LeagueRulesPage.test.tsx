/**
 * @fileoverview Integration test for the repurposed LeagueRules page
 * at `/league-rules/:orgId`. Exercises the HouseRulesList add-flow and
 * the delete-with-undo toast action.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));

const toastCalls: Array<{ kind: string; args: unknown[] }> = [];
vi.mock('sonner', () => ({
  toast: Object.assign(
    (...args: unknown[]) => toastCalls.push({ kind: 'default', args }),
    {
      success: (...args: unknown[]) => toastCalls.push({ kind: 'success', args }),
      error: (...args: unknown[]) => toastCalls.push({ kind: 'error', args }),
    },
  ),
}));

const useHouseRulesForScopeMock = vi.fn();
vi.mock('@/rules/useHouseRules', () => ({
  useHouseRule: () => ({ data: null, isLoading: false, isError: false }),
  useHouseRulesForMemberships: () => ({ data: [], isLoading: false, isSuccess: true }),
  useHouseRulesForScope: (...args: unknown[]) => useHouseRulesForScopeMock(...args),
}));

const createHouseRuleMock = vi.fn();
const deleteHouseRuleMock = vi.fn();
const reinsertHouseRuleMock = vi.fn();
vi.mock('@/api/mutations/houseRules', () => ({
  createHouseRule: (...args: unknown[]) => createHouseRuleMock(...args),
  deleteHouseRule: (...args: unknown[]) => deleteHouseRuleMock(...args),
  reinsertHouseRule: (...args: unknown[]) => reinsertHouseRuleMock(...args),
  updateHouseRule: vi.fn(),
}));

import LeagueRules from '@/operator/LeagueRules';
import type { HouseRule } from '@/rules/house-rules.types';

function rule(partial: Partial<HouseRule> = {}): HouseRule {
  return {
    id: 'r-1',
    organization_id: 'org-1',
    league_id: null,
    scope_type: 'organization',
    scope_name: 'Ed',
    parent_org_name: 'Ed',
    game: '8-ball',
    effect_type: 'standalone',
    related_rule_id: null,
    title: 'No jump cues',
    body: ['Jump cues are not allowed.'],
    created_at: '',
    updated_at: '',
    updated_by: null,
    ...partial,
  };
}

function renderAt(orgId: string, rules: HouseRule[]) {
  useHouseRulesForScopeMock.mockReturnValue({ data: rules, isLoading: false });
  return renderWithProviders(
    <Routes>
      <Route path="/league-rules/:orgId" element={<LeagueRules />} />
    </Routes>,
    { initialRoute: `/league-rules/${orgId}` },
  );
}

describe('LeagueRules page', () => {
  beforeEach(() => {
    toastCalls.length = 0;
    useHouseRulesForScopeMock.mockReset();
    createHouseRuleMock.mockReset();
    deleteHouseRuleMock.mockReset();
    reinsertHouseRuleMock.mockReset();
  });

  it('renders the header, intro, official-rulebook link, and existing rules', () => {
    renderAt('org-1', [rule()]);

    expect(screen.getByRole('heading', { level: 1, name: /house rules/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view the official rulebook/i })).toHaveAttribute('href', '/rules');
    expect(screen.getByText('No jump cues')).toBeInTheDocument();
  });

  it('opens the form when Add is clicked and closes on Cancel', async () => {
    const user = userEvent.setup();
    renderAt('org-1', []);

    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(screen.getByRole('form', { name: /add house rule/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('form', { name: /add house rule/i })).not.toBeInTheDocument();
  });

  it('delete confirmation calls deleteHouseRule and queues an Undo toast', async () => {
    deleteHouseRuleMock.mockResolvedValue(undefined);
    const existing = rule({ id: 'r-keep', title: 'Keeper' });
    const user = userEvent.setup();
    renderAt('org-1', [existing]);

    await user.click(screen.getByRole('button', { name: /delete Keeper/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(deleteHouseRuleMock.mock.calls[0][0]).toBe('r-keep');
    // Wait for the mutation's promise to resolve + the inline onSuccess to fire.
    await new Promise((r) => setTimeout(r, 10));
    const toastInvocation = toastCalls.find((c) => c.args[0] === 'House rule deleted.');
    expect(toastInvocation).toBeTruthy();
    // Invoke the Undo action the toast registered.
    const action = (toastInvocation?.args[1] as { action?: { onClick: () => void } } | undefined)?.action;
    expect(action).toBeTruthy();
    reinsertHouseRuleMock.mockResolvedValue(existing);
    action?.onClick();
    expect(reinsertHouseRuleMock.mock.calls[0][0]).toEqual(existing);
  });
});
