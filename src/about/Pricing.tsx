/**
 * @fileoverview Pricing Page
 *
 * Comprehensive pricing breakdown for league operators.
 * Explains the no-upfront-cost model with detailed examples.
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';

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
              <h3 className="text-lg font-semibold mb-2 text-blue-600">Per Season Setup</h3>
              <p className="text-3xl font-bold">$10</p>
              <p className="text-sm text-muted-foreground mt-1">One-time per season</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2 text-blue-600">Weekly Platform Fee</h3>
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
                <h4 className="font-semibold">Pay Anytime Before Week 5</h4>
                <p className="text-foreground">Pay upfront, or wait until you've collected enough dues—your choice. Week 5 won't function until the season is paid.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-World Example */}
      <Card className="mb-8 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-2xl">Real Example: 8-Team League</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-card p-4 rounded">
            <h4 className="font-semibold mb-3">Season Setup:</h4>
            <ul className="space-y-1 text-foreground">
              <li>• 8 teams</li>
              <li>• 16-week regular season</li>
              <li>• 2-week playoffs (FREE)</li>
              <li>• $30 per team per week dues</li>
            </ul>
          </div>

          <div className="bg-card p-4 rounded">
            <h4 className="font-semibold mb-3">Your Platform Cost:</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Setup fee:</span>
                <span className="font-mono">$10</span>
              </div>
              <div className="flex justify-between">
                <span>8 teams × 16 weeks × $1:</span>
                <span className="font-mono">$128</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold text-lg">
                <span>Total Season Cost:</span>
                <span className="font-mono text-blue-600">$138</span>
              </div>
            </div>
          </div>

          <div className="bg-card p-4 rounded">
            <h4 className="font-semibold mb-3">No Out-of-Pocket Expenses:</h4>
            <p className="text-sm text-muted-foreground mb-1">Most leagues charge $10 per player per night to participate.</p>
            <p className="text-sm text-muted-foreground mb-3">Teams have a minimum of 3 players per week.</p>
            <div className="space-y-2 text-foreground">
              <p><strong>Week 1:</strong> Collect $30 × 8 teams = $240</p>
              <p className="text-sm pl-4">→ Platform cost: $138</p>
            </div>
          </div>

          <div className="bg-green-100 p-4 rounded border border-green-300">
            <p className="font-semibold text-green-800">
              💡 Result: Season paid in full from less than one week of your collected dues!
            </p>
          </div>
        </CardContent>
      </Card>

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
