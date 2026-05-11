/**
 * @fileoverview Integration test for `RuleDetailPage` at
 * `/rules/:game/:ruleId`. Covers the happy path (known rule renders
 * heading + body + Copy-link + drawer trigger), the drawer interaction
 * (Sheet opens, shows siblings, current rule highlighted), and the two
 * unknown-ID fallback paths (R9c).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, screen, userEvent, within } from '@/test/utils';

// Same reasons as RulesPage.test: stub PageHeader (TanStack Query-dependent).
vi.mock('@/components/PageHeader', () => ({
  PageHeader: ({ title }: { title: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));

// Capture toasts so we can assert R9c emits the not-found message.
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import RuleDetailPage from '@/rules/RuleDetailPage';

function renderAtRuleUrl(url: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/rules/:game/:ruleId" element={<RuleDetailPage />} />
      <Route path="/rules" element={<div data-testid="rules-landing">Rules landing</div>} />
    </Routes>,
    { initialRoute: url },
  );
}

describe('RuleDetailPage', () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it('renders the rule heading and every body paragraph for a known rule', () => {
    renderAtRuleUrl('/rules/9-ball/3-1');

    // Heading: rule 3-1 in 9-Ball is "The Game".
    expect(screen.getByRole('heading', { level: 1, name: 'The Game' })).toBeInTheDocument();
    // Subtitle shows game + rule id.
    expect(screen.getByText(/9-Ball · Rule 3-1/)).toBeInTheDocument();
    // Body content includes a distinctive phrase from rule 3-1.
    expect(screen.getByText(/nine object balls numbered 1 through 9/)).toBeInTheDocument();
  });

  it('shows the Copy-link button and the drawer trigger', () => {
    renderAtRuleUrl('/rules/9-ball/3-1');

    expect(screen.getByRole('button', { name: /copy link to this rule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse 9-ball/i })).toBeInTheDocument();
  });

  it('opens the drawer with every rule in the current game, marking the current one', async () => {
    const user = userEvent.setup();
    renderAtRuleUrl('/rules/9-ball/3-1');

    await user.click(screen.getByRole('button', { name: /browse 9-ball/i }));

    // The drawer (Radix Dialog content) takes role=dialog.
    const dialog = await screen.findByRole('dialog');
    const current = within(dialog).getByRole('link', { current: 'page' });
    expect(current).toHaveTextContent('3-1');
    expect(current).toHaveTextContent('The Game');
    // A non-current sibling is also rendered (e.g., 3-7 Stalemate).
    expect(within(dialog).getByText('Stalemate')).toBeInTheDocument();
  });

  it('redirects to /rules with a toast when the ruleId is unknown', async () => {
    renderAtRuleUrl('/rules/9-ball/9-99');

    // Effect runs on mount; wait for the redirect.
    await screen.findByTestId('rules-landing');
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/9-99 not found/i));
  });

  it('redirects to /rules with a toast when the game slug is unknown', async () => {
    renderAtRuleUrl('/rules/ghost-pool/3-1');

    await screen.findByTestId('rules-landing');
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/3-1 not found/i));
  });
});
