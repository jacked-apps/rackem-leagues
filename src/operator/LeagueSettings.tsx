/**
 * @fileoverview League Settings Page
 *
 * Settings page for individual league preferences.
 * Allows operators to override organization defaults for this specific league.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import type { League } from '@/types/league';
import { parseLocalDate } from '@/utils/formatters';
import { buildLeagueTitle, getTimeOfYear } from '@/utils/leagueUtils';
import { PageHeader } from '@/components/PageHeader';
import { PreferencesCard } from '@/components/operator/PreferencesCard';
import { ScoringPreviewCard } from './ScoringPreviewCard';
import { DashboardCard } from '@/components/operator/DashboardCard';
import { Building2 } from 'lucide-react';
import { LeagueHouseRulesSection } from '@/rules/LeagueHouseRulesSection';
import { logger } from '@/utils/logger';

/**
 * League Settings Component
 * Displays PreferencesCard for league-specific settings
 */
export const LeagueSettings: React.FC = () => {
  const navigate = useNavigate();
  const { leagueId } = useParams<{ leagueId: string }>();

  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch league data
  useEffect(() => {
    const fetchLeague = async () => {
      if (!leagueId) {
        setError('No league ID provided');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .single();

        if (fetchError) throw fetchError;
        setLeague(data);
      } catch (err) {
        logger.error('Error fetching league', { error: err instanceof Error ? err.message : String(err) });
        setError('Failed to load league details');
      } finally {
        setLoading(false);
      }
    };

    fetchLeague();
  }, [leagueId]);

  /**
   * Generate display name for league
   */
  const getLeagueName = (league: League): string => {
    const startDate = parseLocalDate(league.league_start_date);
    const season = getTimeOfYear(startDate);
    const year = startDate.getFullYear();

    return buildLeagueTitle({
      gameType: league.game_type,
      dayOfWeek: league.day_of_week,
      division: league.division,
      season,
      year
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center text-muted-foreground">Loading league settings...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !league) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-card rounded-xl shadow-sm p-6">
            <h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>
            <p className="text-foreground mb-4">{error || 'League not found'}</p>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={`/league/${league.id}`}
        backLabel="Back to League"
        title="League Settings"
        subtitle={getLeagueName(league)}
      />
      <div className="container mx-auto px-4 max-w-6xl py-8">
        <div className="grid md:grid-cols-2 gap-6">
          <PreferencesCard
            entityType="league"
            entityId={league.id}
          />

          <ScoringPreviewCard target={{ scope: 'league', leagueId: league.id }} />

          <DashboardCard
            icon={<Building2 className="h-6 w-6" />}
            iconColor="text-blue-600"
            title="Venue Management"
            description="Assign venues and set table limits for this league"
            buttonText="Manage Venues"
            linkTo={`/venues/${league.organization_id}?leagueId=${league.id}`}
          />

          <LeagueHouseRulesSection leagueId={league.id} />
        </div>
      </div>
    </div>
  );
};

export default LeagueSettings;
