/**
 * @fileoverview League Operator Landing Page
 * Informational page explaining benefits and requirements of becoming a league operator
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';

/**
 * League Operator Landing Page Component
 *
 * This page explains:
 * - Benefits of becoming a league operator
 * - Pricing model ($1 per team per week)
 * - Requirements and responsibilities
 * - Next steps to apply
 *
 * Features:
 * - Clear value proposition
 * - Pricing calculator example
 * - Call-to-action to start application
 */
export const BecomeLeagueOperator: React.FC = () => {
  // Scroll to top on mount (fixes issue where page loads in middle)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Page Header */}
      <PageHeader
        backTo="/dashboard"
        backLabel="Back to Dashboard"
        title="Become a League Operator"
        subtitle="Start running your own pool leagues and earn revenue"
      >
        <div className="mt-4">
          <Link to="/league-operator-application">
            <Button loadingText="none" size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
              Start Application
            </Button>
          </Link>
        </div>
      </PageHeader>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {/* Value Proposition */}
          <div className="bg-card rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Why Become a League Operator?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="font-semibold text-green-800 mb-4 text-lg">Benefits</h3>
                <ul className="space-y-2 text-green-700">
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    Increase patronage to your pool venue
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    Earn revenue from your leagues
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    Professional league management tools
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    Automated scheduling and scoring
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    Player registration and tracking
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    Easy team and season management
                  </li>
                </ul>
              </div>
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-semibold text-blue-800 mb-4 text-lg">Perfect For</h3>
                <ul className="space-y-2 text-blue-700">
                  <li>• Pool hall owners</li>
                  <li>• Bar managers</li>
                  <li>• Experienced league players</li>
                  <li>• Community organizers</li>
                  <li>• Anyone passionate about pool</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Pricing Model */}
          <div className="bg-card rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Simple, Fair Pricing
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 text-center">
                  <div className="text-sm text-blue-200 mb-1">only</div>
                  <div className="text-4xl font-bold mb-2">$1</div>
                  <div className="text-blue-100">per team, per week</div>
                  <div className="text-xs text-blue-200 mt-2">+ $10 setup per season</div>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-muted rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-4">Example: 16-Week Season</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span>6 teams × 16 weeks + $10:</span>
                      <span className="font-semibold text-lg">$106</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span>8 teams × 16 weeks + $10:</span>
                      <span className="font-semibold text-lg">$138</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span>10 teams × 16 weeks + $10:</span>
                      <span className="font-semibold text-lg">$170</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                    <p className="mb-2">✓ 4-week grace period to collect dues</p>
                    <p className="mb-2">✓ Payment due before week 5</p>
                    <p>✓ Playoff weeks are FREE</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <Link to="/pricing" className="text-blue-600 hover:text-blue-800 font-medium text-lg">
                View detailed pricing breakdown with examples →
              </Link>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-card rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              What You'll Need
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-muted rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4 text-lg">Business Information</h3>
                <ul className="space-y-2 text-foreground">
                  <li>• Pool hall/bar details</li>
                  <li>• Business address and hours</li>
                  <li>• Number of available tables</li>
                  <li>• Contact information</li>
                </ul>
              </div>
              <div className="bg-muted rounded-lg p-6">
                <h3 className="font-semibold text-foreground mb-4 text-lg">Payment Setup</h3>
                <ul className="space-y-2 text-foreground">
                  <li>• Valid credit card</li>
                  <li>• Billing address</li>
                  <li>• League operator agreement</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Final Call to Action */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-blue-100 mb-6 text-lg">
              Complete our simple application and start running your first league within days.
            </p>
            <Link to="/league-operator-application">
              <Button loadingText="none" size="lg" className="bg-card text-blue-600 hover:bg-muted px-8">
                Start Application
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};