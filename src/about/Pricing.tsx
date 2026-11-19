/**
 * @fileoverview Pricing Page
 *
 * Comprehensive pricing breakdown for league operators.
 * Explains the no-upfront-cost model with two worked examples
 * (`PricingExampleCard`), each showing the fee as a share of the prize pool.
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { PricingExampleCard } from './PricingExampleCard';

export const Pricing: React.FC = () => {
  return (
    <div>
      <PageHeader
        backTo="/"
        backLabel="Back to Home"
        hideBack={false}
        title="Simple, Transparent Pricing"
        subtitle="No surprise fees. Pay from your league dues."
      />

      <div className="max-w-4xl mx-auto p-6">

      {/* Pricing Model Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">Platform Fee Structure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Per Season Setup</h3>
              <p className="text-3xl font-bold">$10</p>
              <p className="text-sm text-muted-foreground mt-1">One-time per season</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-primary">Weekly Platform Fee</h3>
              <p className="text-3xl font-bold">$1</p>
              <p className="text-sm text-muted-foreground mt-1">Per team, per week (regular season only)</p>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold mb-2">What's Included:</h4>
            <ul className="space-y-1 text-foreground">
              <li>✓ Complete league management dashboard</li>
              <li>✓ Live scoring and standings</li>
              <li>✓ Automatic handicap calculations</li>
              <li>✓ In-app messaging system</li>
              <li>✓ Smart scheduling with conflict detection</li>
              <li>✓ Player and team management</li>
              <li>✓ Playoff weeks are FREE</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Payment Terms */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">How Payment Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start">
              <span className="text-2xl mr-3">1️⃣</span>
              <div>
                <h4 className="font-semibold">Create Your League (Free)</h4>
                <p className="text-foreground">Set up your league, add teams, configure settings—no charge to get started.</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-2xl mr-3">2️⃣</span>
              <div>
                <h4 className="font-semibold">Credit Card Required (Not Charged)</h4>
                <p className="text-foreground">We keep a card on file for the season fee, but you control when to pay.</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-2xl mr-3">3️⃣</span>
              <div>
                <h4 className="font-semibold">4-Week Grace Period</h4>
                <p className="text-foreground">Run weeks 1-4 completely free. Use this time to collect dues from your teams.</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-2xl mr-3">4️⃣</span>
              <div>
                <h4 className="font-semibold">Week 1 Dues Usually Cover It</h4>
                <p className="text-foreground">In most leagues, the first week of dues covers the entire season's fee. See the examples below.</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-2xl mr-3">5️⃣</span>
              <div>
                <h4 className="font-semibold">Pay Anytime Before Week 5</h4>
                <p className="text-foreground">Pay upfront, or wait until you've collected enough dues—your choice. Week 5 won't function until the season is paid.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worked examples — every number computed from the price rule
          (pricingMath), so they can't drift. A small league and a bigger,
          longer one (Ed, 2026-11-19). */}
      <PricingExampleCard
        title="Example 1: 8-Team League"
        teams={8}
        weeks={16}
        playoffWeeks={2}
        playersPerTeam={3}
      />
      <PricingExampleCard
        title="Example 2: 10-Team League, Longer Season"
        teams={10}
        weeks={20}
        playoffWeeks={2}
        playersPerTeam={5}
      />

      {/* FAQ */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">Common Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-1">Are playoff weeks included?</h4>
            <p className="text-foreground">
              Playoff weeks are completely FREE! You only pay for the regular season weeks.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Can I pay the season fee upfront?</h4>
            <p className="text-foreground">
              Absolutely! You can pay anytime during the first 4 weeks. Some operators prefer to pay immediately,
              others wait to collect dues first. Completely your choice.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Is there a minimum or maximum number of teams?</h4>
            <p className="text-foreground">
              Yes, 4 is the minimum number of teams. Our system can handle scheduling up to 40 teams for each season. Pricing remains the same: $1 per team per week + $10 setup.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Do you handle collecting dues from teams?</h4>
            <p className="text-foreground">
              No. This app is completely free for all of your players to use. These are considered private cash leagues—operators
              completely control the dues and prize pools for payouts and administration fees. We only provide tools to help you
              organize and calculate them. You collect dues from your teams however you normally would (cash, Venmo, etc.), and we
              only charge you for the platform via your credit card on file.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">What happens if I don't pay by week 5?</h4>
            <p className="text-foreground">
              Week 5 won't function for that league until the season fee is paid. You can pay anytime during weeks 1-4
              to avoid any interruption.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-1">What if a team drops mid-season?</h4>
            <p className="text-foreground">
              It's not often teams drop mid-season, but it happens. Continuing the season fairly is never really possible when it does.
              We try to help you fill/replace the team with players in our system local to you, but other than that there is not much
              this program (or any program) can do. Luckily, the price of the entire season has been collected and more, or if earlier
              than 4 weeks, the season can just be deleted and restarted.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Ready to Start Your League?</h2>
        <p className="text-foreground">No upfront costs. No hidden fees. Just professional league management.</p>
        <div className="flex gap-4 justify-center">
          <Link to="/become-league-operator">
            <Button size="lg" loadingText="none">
              Become an Operator
            </Button>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
};
