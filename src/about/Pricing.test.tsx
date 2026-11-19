/**
 * @fileoverview Pricing page — the payment steps and the two worked examples.
 *
 * Expected numbers worked out by hand ($1 per team per week + $10 setup;
 * $10 per player per night; all dues into the prize pool):
 *   Example 1 — 8 teams, 16 weeks, 3 players ($30 a team a night):
 *     cost 8×16×1 = $128 + $10 = $138; dues $30×8 = $240 a week;
 *     pool $240×16 = $3,840; 138/3840 = 3.59% → 3.6%; week 1 ($240 ≥ $138).
 *   Example 2 — 10 teams, 20 weeks, 5 players ($50 a team a night):
 *     cost 10×20×1 = $200 + $10 = $210; dues $50×10 = $500 a week;
 *     pool $500×20 = $10,000; 210/10000 = 2.1%; week 1 ($500 ≥ $210).
 * Payment steps (Ed, 2026-11-19): "Week 1 Dues Usually Cover It" is step 4,
 * "Pay Anytime Before Week 5" is step 5.
 */

import { describe, it, expect } from 'vitest';
import { within } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/utils';
import { Pricing } from './Pricing';
import { PricingExampleCard } from './PricingExampleCard';

describe('Pricing page — How Payment Works', () => {
  it('week-1 dues is step 4 and pay-before-week-5 is step 5', () => {
    renderWithProviders(<Pricing />, { userContext: { isLoggedIn: false } });
    const steps = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    const four = steps.indexOf('Week 1 Dues Usually Cover It');
    expect(four).toBeGreaterThan(-1);
    expect(steps[four - 1]).toBe('4-Week Grace Period');
    expect(steps[four + 1]).toBe('Pay Anytime Before Week 5');
  });

  it('shows both examples', () => {
    renderWithProviders(<Pricing />, { userContext: { isLoggedIn: false } });
    expect(screen.getByText('Example 1: 8-Team League')).toBeInTheDocument();
    expect(screen.getByText('Example 2: 10-Team League, Longer Season')).toBeInTheDocument();
  });
});

describe('PricingExampleCard', () => {
  it('Example 1: 3 players, $30 a team, $138 is ≈ 3.6% of a $3,840 pool', () => {
    renderWithProviders(
      <PricingExampleCard title="Example 1" teams={8} weeks={16} playoffWeeks={2} playersPerTeam={3} />,
    );
    expect(screen.getByText('• 3 players per team')).toBeInTheDocument();
    expect(screen.getByText('• $10 per player per night')).toBeInTheDocument();
    expect(screen.getByText('• $30 per team per night')).toBeInTheDocument();
    expect(screen.getByText('$128')).toBeInTheDocument();
    expect(screen.getByText('$138')).toBeInTheDocument();
    const dues = screen.getByText('What the Dues Bring In:').parentElement as HTMLElement;
    expect(within(dues).getByText(/\$30 × 8 teams = \$240/)).toBeInTheDocument();
    expect(within(dues).getByText(/\$240 × 16 weeks = \$3,840 prize pool/)).toBeInTheDocument();
    expect(within(dues).getByText(/\$138 ÷ \$3,840 ≈ 3\.6% of the prize pool/)).toBeInTheDocument();
    expect(screen.getByText(/Season paid in full from week 1 dues/)).toBeInTheDocument();
  });

  it('Example 2: 5 players, 20 weeks, $210 is ≈ 2.1% of a $10,000 pool', () => {
    renderWithProviders(
      <PricingExampleCard title="Example 2" teams={10} weeks={20} playoffWeeks={2} playersPerTeam={5} />,
    );
    expect(screen.getByText('• $50 per team per night')).toBeInTheDocument();
    expect(screen.getByText('$210')).toBeInTheDocument();
    expect(screen.getByText(/\$500 × 20 weeks = \$10,000 prize pool/)).toBeInTheDocument();
    expect(screen.getByText(/\$210 ÷ \$10,000 ≈ 2\.1% of the prize pool/)).toBeInTheDocument();
    expect(screen.getByText(/Season paid in full from week 1 dues/)).toBeInTheDocument();
  });

  it('says how many weeks when one week of dues is not enough', () => {
    // 1 team, 52 weeks, 3 players: cost $62 against $30 a week → week 3.
    renderWithProviders(
      <PricingExampleCard title="Edge" teams={1} weeks={52} playoffWeeks={0} playersPerTeam={3} />,
    );
    expect(screen.getByText(/Season paid in full from the first 3 weeks of dues/)).toBeInTheDocument();
  });
});
