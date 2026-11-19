/**
 * @fileoverview One row of the "Example: 16-Week Season" pricing box on
 * Become a League Operator: the season's cost, plus what that is as a share
 * of the prize pool, with an InfoButton showing the math.
 *
 * Why the share: "$138" on its own reads like a lot; next to a $6,400 prize
 * pool it's about 2%. Showing it that way makes the real size of the fee
 * clear (Ed, 2026-11-19).
 *
 * The math lives in `pricingMath.ts` (regular-season weeks only; playoff
 * weeks are free):
 *   cost       = teams × weeks × $1 + $10 setup
 *   prize pool = teams × weeks × $50 (the example dues each team puts in)
 *   share      = cost ÷ prize pool, shown to one decimal
 */

import { InfoButton } from '@/components/InfoButton';
import {
  dollars,
  EXAMPLE_DUES_PER_PLAYER_NIGHT,
  EXAMPLE_PLAYERS_PER_TEAM,
  EXAMPLE_POOL_PER_TEAM_WEEK,
  PRICE_PER_TEAM_WEEK,
  seasonPricing,
  SETUP_FEE,
} from './pricingMath';

interface PricingExampleRowProps {
  /** Teams in the example league. */
  teams: number;
  /** Regular-season weeks (the box shows a 16-week season). */
  weeks: number;
  /** Drop the bottom divider on the last row. */
  last?: boolean;
}

export function PricingExampleRow({ teams, weeks, last = false }: PricingExampleRowProps) {
  const { cost, pool, share } = seasonPricing(teams, weeks);

  return (
    <div className={`flex justify-between items-start gap-4 py-2 ${last ? '' : 'border-b border-border'}`}>
      <span>{teams} teams × {weeks} weeks + {dollars(SETUP_FEE)}:</span>
      <div className="text-right">
        <div className="font-semibold text-lg">{dollars(cost)}</div>
        <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
          <span>≈ {share} of prize pool</span>
          <InfoButton title={`How we got ${share}`} size="sm" align="right">
            <p>
              Example: {EXAMPLE_PLAYERS_PER_TEAM} players on each team, each player pays{' '}
              {dollars(EXAMPLE_DUES_PER_PLAYER_NIGHT)} per league night. That's{' '}
              {dollars(EXAMPLE_POOL_PER_TEAM_WEEK)} per team per night into the prize pool.
            </p>
            <p className="mt-2">
              Prize pool: {teams} teams × {weeks} weeks × {dollars(EXAMPLE_POOL_PER_TEAM_WEEK)} = {dollars(pool)}
            </p>
            <p>
              Our price: {teams} teams × {weeks} weeks × {dollars(PRICE_PER_TEAM_WEEK)} + {dollars(SETUP_FEE)} setup = {dollars(cost)}
            </p>
            <p className="mt-2">
              {dollars(cost)} ÷ {dollars(pool)} ≈ {share}. Playoff weeks are free, so they add nothing.
            </p>
          </InfoButton>
        </div>
      </div>
    </div>
  );
}
