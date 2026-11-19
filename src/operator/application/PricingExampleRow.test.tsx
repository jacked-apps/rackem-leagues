/**
 * @fileoverview The pricing example's cost and prize-pool share.
 *
 * Expected numbers are worked out by hand from the price rule ($1 per team per
 * week + $10 setup) and the example dues (5 players × $10 a league night =
 * $50 per team per night into the prize pool), 16-week season:
 *   6 teams:  6×16×1+10 = $106;  6×16×50 = $4,800;  106/4800 = 2.21% → 2.2%
 *   8 teams:  8×16×1+10 = $138;  8×16×50 = $6,400;  138/6400 = 2.16% → 2.2%
 *  10 teams: 10×16×1+10 = $170; 10×16×50 = $8,000;  170/8000 = 2.13% → 2.1%
 */

import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { PricingExampleRow } from './PricingExampleRow';
import { seasonPricing } from './pricingMath';

describe('seasonPricing', () => {
  it.each([
    [6, 106, 4800, '2.2%'],
    [8, 138, 6400, '2.2%'],
    [10, 170, 8000, '2.1%'],
  ])('%i teams, 16 weeks → $%i of a $%i pool = %s', (teams, cost, pool, share) => {
    expect(seasonPricing(teams, 16)).toEqual({ cost, pool, share });
  });
});

describe('PricingExampleRow', () => {
  it('shows the cost and the share of the prize pool', () => {
    renderWithProviders(<PricingExampleRow teams={8} weeks={16} />);
    expect(screen.getByText('$138')).toBeInTheDocument();
    expect(screen.getByText('≈ 2.2% of prize pool')).toBeInTheDocument();
  });

  it('the info button shows the math', async () => {
    renderWithProviders(<PricingExampleRow teams={8} weeks={16} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /how we got 2\.2%/i }));
    // The example, one fact per line.
    expect(await screen.findByText('5 players per team')).toBeInTheDocument();
    expect(screen.getByText('$10 per player per night')).toBeInTheDocument();
    expect(screen.getByText('$50 per team per night')).toBeInTheDocument();
    expect(screen.getByText('into the prize pool')).toBeInTheDocument();
    expect(screen.getByText(/8 teams × 16 weeks × \$50 = \$6,400/)).toBeInTheDocument();
    expect(screen.getByText(/8 teams × 16 weeks × \$1 \+ \$10 setup = \$138/)).toBeInTheDocument();
  });
});
