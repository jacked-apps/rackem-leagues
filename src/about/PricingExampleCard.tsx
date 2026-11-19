/**
 * @fileoverview One worked example on the Pricing page: a league's setup,
 * what the platform costs, what the dues bring in, and the cost as a share of
 * the prize pool. Every number comes from `pricingMath.seasonPricing`, so the
 * examples can't drift from the price rule.
 *
 * The page shows two (Ed, 2026-11-19): a small league (3 players at $10 =
 * $30 per team per night) and a bigger, longer one (5 players = $50), so an
 * operator sees the fee stays tiny either way.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  dollars,
  EXAMPLE_DUES_PER_PLAYER_NIGHT,
  PRICE_PER_TEAM_WEEK,
  seasonPricing,
  SETUP_FEE,
} from '@/operator/application/pricingMath';

interface PricingExampleCardProps {
  /** Heading, e.g. "Example 1: 8-Team League". */
  title: string;
  teams: number;
  /** Regular-season weeks (the only ones billed). */
  weeks: number;
  /** Playoff weeks — shown as FREE, never billed. */
  playoffWeeks: number;
  /** Players paying dues on each team. */
  playersPerTeam: number;
}

export function PricingExampleCard({ title, teams, weeks, playoffWeeks, playersPerTeam }: PricingExampleCardProps) {
  const { cost, pool, weeklyDues, share, weekOneShare, paidByWeek } = seasonPricing(teams, weeks, playersPerTeam);
  const perTeamNight = playersPerTeam * EXAMPLE_DUES_PER_PLAYER_NIGHT;

  return (
    <Card className="mb-8 border-info/40 bg-info/10">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-card p-4 rounded">
          <h4 className="font-semibold mb-3">Season Setup:</h4>
          <ul className="space-y-1 text-foreground">
            <li>• {teams} teams</li>
            <li>• {weeks}-week regular season</li>
            <li>• {playoffWeeks}-week playoffs (FREE)</li>
            <li>• {playersPerTeam} players per team</li>
            <li>• {dollars(EXAMPLE_DUES_PER_PLAYER_NIGHT)} per player per night</li>
            <li>• {dollars(perTeamNight)} per team per night</li>
          </ul>
        </div>

        <div className="bg-card p-4 rounded">
          <h4 className="font-semibold mb-3">Your Platform Cost:</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Setup fee:</span>
              <span className="font-mono">{dollars(SETUP_FEE)}</span>
            </div>
            <div className="flex justify-between">
              <span>{teams} teams × {weeks} weeks × {dollars(PRICE_PER_TEAM_WEEK)}:</span>
              <span className="font-mono">{dollars(cost - SETUP_FEE)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-bold text-lg">
              <span>Total Season Cost:</span>
              <span className="font-mono text-primary">{dollars(cost)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded">
          <h4 className="font-semibold mb-3">What the Dues Bring In:</h4>
          <div className="space-y-2 text-foreground">
            <p><strong>Each week:</strong> {dollars(perTeamNight)} × {teams} teams = {dollars(weeklyDues)}</p>
            <p><strong>Whole season:</strong> {dollars(weeklyDues)} × {weeks} weeks = {dollars(pool)} prize pool</p>
            <p><strong>Platform cost:</strong> {dollars(cost)} ÷ {dollars(pool)} ≈ {share} of the prize pool</p>
            <p><strong>Or:</strong> {dollars(cost)} ÷ {dollars(weeklyDues)} ≈ {weekOneShare} of week 1 dues</p>
          </div>
        </div>

        <div className="bg-success/15 p-4 rounded border border-success/40">
          <p className="font-semibold text-success">
            💡 Result: Season paid in full from{' '}
            {paidByWeek === 1 ? 'week 1 dues' : `the first ${paidByWeek} weeks of dues`}!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
