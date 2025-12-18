/**
 * @fileoverview Schedule Creation Wizard (PLACEHOLDER)
 *
 * Multi-step wizard for creating league schedules.
 * Handles season length, tournament conflicts (BCA/APA nationals), and schedule generation.
 *
 * This wizard is called after League Creation Wizard completes.
 * It takes a leagueId and league start date, then builds the complete season schedule.
 */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';

interface ScheduleCreationWizardProps {
  leagueId?: string;
}

/**
 * Schedule Creation Wizard Component
 *
 * FLOW:
 * 1. Season Length Selection (12-20 weeks or custom)
 * 2. Custom Season Length (conditional - if custom selected)
 * 3. BCA Nationals dates (found dates, ignore, or custom entry)
 * 4. BCA Custom Dates (conditional - if custom selected)
 * 5. APA Nationals Start Date
 * 6. APA Nationals End Date
 * 7. Review schedule and generate
 *
 * FUTURE FEATURES:
 * - Holiday break management
 * - Week-by-week calendar view
 * - Playoff scheduling
 * - Export to calendar
 */
export const ScheduleCreationWizard: React.FC<ScheduleCreationWizardProps> = ({ leagueId: propLeagueId }) => {
  const navigate = useNavigate();
  const { leagueId: paramLeagueId } = useParams<{ leagueId: string }>();
  const leagueId = propLeagueId || paramLeagueId;

  useEffect(() => {
    if (!leagueId) {
      logger.error('No league ID provided to Schedule Creation Wizard');
      // Redirect to main dashboard where user can select their organization
      navigate('/dashboard');
    }
  }, [leagueId, navigate]);

  // TODO: Fetch league data to get start date
  // TODO: Set up wizard state management (similar to useLeagueWizard)
  // TODO: Implement step navigation
  // TODO: Add tournament search integration
  // TODO: Calculate end date based on season length + holidays
  // TODO: Generate week-by-week schedule
  // TODO: Save schedule to database

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Create League Schedule
          </h1>
          <p className="text-gray-600 mt-2">
            PLACEHOLDER - Schedule wizard coming soon
          </p>
        </div>

        {/* Placeholder Content */}
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Schedule Creation Steps (To Be Implemented)
            </h2>

            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Season Length Selection (12-20 weeks or custom)</li>
              <li>Custom Season Length (if custom selected)</li>
              <li>BCA Nationals Tournament Dates</li>
              <li>APA Nationals Tournament Dates</li>
              <li>Calculate end date and playoff windows</li>
              <li>Review and generate schedule</li>
            </ol>

            <div className="mt-6 p-4 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>League ID:</strong> {leagueId || 'Not provided'}
              </p>
              <p className="text-sm text-blue-800 mt-2">
                This wizard will use all the BCA/APA nationals logic and tournament search
                functionality from the original League Creation Wizard.
              </p>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => {
                  toast.info('Schedule wizard not yet implemented. Coming soon!');
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled
              >
                Start Schedule Creation (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
