/**
 * @fileoverview OperatorWelcome Component
 * One-time congratulations page displayed when a user successfully completes
 * the league operator application and is upgraded from player to league_operator
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUserProfile } from '@/api/hooks';
import { useOrganizations } from '@/api/hooks/useOrganizations';

/**
 * OperatorWelcome Component
 *
 * Special congratulations page that:
 * - Celebrates the user's successful application
 * - Explains their new league operator privileges
 * - Provides next steps for setting up their first league
 * - Links to the operator dashboard
 *
 * This is a one-time page - users who are already league operators
 * will be redirected to the operator dashboard instead
 */
export const OperatorWelcome: React.FC = () => {
  // Get user's organization to build the correct dashboard link
  const { member } = useUserProfile();
  const { organizations, loading: orgsLoading } = useOrganizations(member?.id);

  // Get the first organization (the one just created)
  const primaryOrg = organizations[0];
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="mb-6">
              <span className="text-6xl">🎉</span>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Congratulations!
            </h1>
            <h2 className="text-2xl text-blue-600 font-semibold mb-4">
              You're Now a League Operator!
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Your application has been approved and you now have access to all league operator features.
              You can create leagues, manage tournaments, and grow the pool community in your area!
            </p>
          </div>

          {/* What's New Section */}
          <div className="mb-10">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              What You Can Do Now
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <div className="text-3xl mb-3">🏆</div>
                <h4 className="font-semibold text-gray-900 mb-2">Create Leagues</h4>
                <p className="text-sm text-gray-600">
                  Set up 8-ball, 9-ball, or custom tournaments at your favorite venues
                </p>
              </div>
              <div className="text-center p-6 bg-green-50 rounded-xl">
                <div className="text-3xl mb-3">👥</div>
                <h4 className="font-semibold text-gray-900 mb-2">Manage Players</h4>
                <p className="text-sm text-gray-600">
                  Handle registrations, track standings, and communicate with your league members
                </p>
              </div>
              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <div className="text-3xl mb-3">📊</div>
                <h4 className="font-semibold text-gray-900 mb-2">Track Results</h4>
                <p className="text-sm text-gray-600">
                  Record match results, generate reports, and maintain official BCA standings
                </p>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="mb-10 bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="text-xl font-bold text-amber-800 mb-4">
              🚀 Ready to Get Started?
            </h3>
            <div className="space-y-3 text-amber-800">
              <div className="flex items-start space-x-3">
                <span className="font-bold text-amber-600">1.</span>
                <span>Visit your new <strong>League Operator Dashboard</strong> to explore all features</span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="font-bold text-amber-600">2.</span>
                <span>Set up your first league using the <strong>League Creation Wizard</strong></span>
              </div>
              <div className="flex items-start space-x-3">
                <span className="font-bold text-amber-600">3.</span>
                <span>Contact venues and start recruiting players for your leagues</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {orgsLoading ? (
              <Button
                loadingText="none"
                disabled
                className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 text-lg font-semibold"
              >
                Loading...
              </Button>
            ) : primaryOrg ? (
              <Link to={`/operator-dashboard/${primaryOrg.id}`}>
                <Button
                  loadingText="none"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"
                >
                  Go to Operator Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/dashboard">
                <Button
                  loadingText="none"
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"
                >
                  Go to Dashboard
                </Button>
              </Link>
            )}
            <Link to="/dashboard">
              <Button
                variant="outline"
                className="w-full sm:w-auto px-8 py-3 text-lg border-gray-300"
              >
                Return to Main Dashboard
              </Button>
            </Link>
          </div>

          {/* Support Info */}
          <div className="mt-10 pt-8 border-t border-gray-200 text-center">
            <p className="text-gray-600 mb-4">
              Need help getting started? We're here to support you!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
              <a href="#" className="text-blue-600 hover:text-blue-800 font-medium">
                📧 Email Support
              </a>
              <a href="#" className="text-blue-600 hover:text-blue-800 font-medium">
                📞 Call (555) 123-POOL
              </a>
              <a href="#" className="text-blue-600 hover:text-blue-800 font-medium">
                📚 Operator Handbook
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default OperatorWelcome;
