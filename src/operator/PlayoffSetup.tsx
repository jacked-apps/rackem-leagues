/**
 * @fileoverview Playoff Setup Page
 *
 * Allows operators to configure and approve playoff brackets for a season.
 * Shows the current playoff configuration with ability to modify settings,
 * displays the generated bracket based on standings, and allows
 * operators to approve and create the playoff matches.
 *
 * Features:
 * - View/modify playoff configuration (template, settings, bracket style)
 * - Preview bracket for each playoff week
 * - Generate bracket from current standings
 * - Create playoff matches when ready
 *
 * Flow:
 * 1. Load resolved playoff configuration for the league
 * 2. Check if regular season is complete
 * 3. Generate bracket from standings using configuration
 * 4. Allow operator to adjust settings
 * 5. On approval, create playoff matches in database
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { Trophy, AlertCircle, Check, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { InfoButton } from '@/components/InfoButton';
import { PlayoffTemplateSelector } from '@/components/playoff/PlayoffTemplateSelector';
import { PlayoffMatchRulesCard } from '@/components/playoff/PlayoffMatchRulesCard';
import { PlayoffBracketCard } from '@/components/playoff/PlayoffBracketCard';
import { PlayoffSettingsCard } from '@/components/playoff/PlayoffSettingsCard';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { parseLocalDate } from '@/utils/formatters';
import { useSeasonById, useLeagueById } from '@/api/hooks';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useSavePlayoffConfiguration } from '@/api/mutations/playoffConfigurations';
import {
  useResolvedPlayoffConfig,
  usePlayoffConfigurations,
  type PlayoffConfiguration,
} from '@/api/hooks/usePlayoffConfigurations';
import {
  usePlayoffSettingsReducer,
  buildLoadSettingsPayload,
  buildSavePayload,
  buildPostSavePayload,
} from '@/hooks/playoff/usePlayoffSettingsReducer';
import type { MatchupStyle } from '@/hooks/playoff/usePlayoffSettingsReducer';
import {
  generatePlayoffBracket,
  getPlayoffWeek,
  checkRegularSeasonComplete,
  populatePlayoffMatches,
  clearPlayoffMatches,
} from '@/utils/playoffGenerator';
import type { PlayoffBracket, SeededTeam, ExcludedTeam } from '@/types/playoff';
import { logger } from '@/utils/logger';


/**
 * Standings table showing all seeded teams
 */
function StandingsTable({ teams }: { teams: SeededTeam[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted">
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Seed</th>
            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Team</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">W</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">L</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Pts</th>
            <th className="text-center py-2 px-3 font-medium text-muted-foreground">Games</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.teamId} className="border-b hover:bg-muted">
              <td className="py-2 px-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-foreground font-semibold text-xs">
                  {team.seed}
                </span>
              </td>
              <td className="py-2 px-3 font-medium text-foreground">{team.teamName}</td>
              <td className="py-2 px-3 text-center text-success font-medium">{team.matchWins}</td>
              <td className="py-2 px-3 text-center text-destructive font-medium">{team.matchLosses}</td>
              <td className="py-2 px-3 text-center text-foreground">{team.points}</td>
              <td className="py-2 px-3 text-center text-foreground">{team.gamesWon}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Excluded teams notice (for odd team counts)
 */
function ExcludedTeamsNotice({ teams }: { teams: ExcludedTeam[] }) {
  if (teams.length === 0) return null;

  return (
    <div className="bg-warning/10 border border-warning/40 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
        <div>
          <div className="font-medium text-warning">Team Not In Playoffs</div>
          <div className="text-sm text-foreground mt-1">
            {teams.map((team) => (
              <div key={team.teamId}>
                <span className="font-medium">{team.teamName}</span>
                {' - '}
                {team.reason === 'last_place'
                  ? 'Last place with odd number of teams'
                  : 'Below playoff cutoff'}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * PlayoffSetup Page Component
 */
export const PlayoffSetup: React.FC = () => {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Season and league data
  const { data: season, isLoading: seasonLoading } = useSeasonById(seasonId);
  const { data: league, isLoading: leagueLoading } = useLeagueById(leagueId);

  // Get the organization ID from the league
  const orgId = league?.organization_id;

  // Fetch resolved playoff configuration for this league
  const { data: resolvedConfig, isLoading: configLoading } = useResolvedPlayoffConfig(leagueId);

  // Fetch league's existing configuration (if any) for saving
  const { data: _leagueConfigs } = usePlayoffConfigurations('league', leagueId);

  // Use the reducer for all playoff settings state
  const [settings, dispatch] = usePlayoffSettingsReducer();

  // Track if we've loaded the initial config to prevent re-loading
  const hasLoadedInitialConfig = useRef(false);

  // Mutation for saving configurations
  const saveConfigMutation = useSavePlayoffConfiguration();

  // Local state for bracket generation
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bracket, setBracket] = useState<PlayoffBracket | null>(null);
  const [playoffWeek, setPlayoffWeek] = useState<{
    id: string;
    scheduled_date: string;
    week_name: string;
  } | null>(null);
  const [seasonStatus, setSeasonStatus] = useState<{
    isComplete: boolean;
    totalMatches: number;
    completedMatches: number;
    remainingMatches: number;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [matchesExist, setMatchesExist] = useState(false);

  // Load the resolved config into the settings reducer
  useEffect(() => {
    if (hasLoadedInitialConfig.current) return;
    if (!resolvedConfig) return;

    hasLoadedInitialConfig.current = true;

    // Build a PlayoffConfiguration-like object from the resolved config
    const configToLoad = {
      id: resolvedConfig.config_id,
      name: resolvedConfig.name,
      description: resolvedConfig.description,
      qualification_type: resolvedConfig.qualification_type,
      fixed_team_count: resolvedConfig.fixed_team_count,
      qualifying_percentage: resolvedConfig.qualifying_percentage,
      percentage_min: resolvedConfig.percentage_min,
      percentage_max: resolvedConfig.percentage_max,
      playoff_weeks: resolvedConfig.playoff_weeks,
      week_matchup_styles: resolvedConfig.week_matchup_styles,
      wildcard_spots: resolvedConfig.wildcard_spots,
      payment_method: resolvedConfig.payment_method,
    };

    dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: resolvedConfig.config_id });
    dispatch({ type: 'LOAD_SETTINGS', payload: buildLoadSettingsPayload(configToLoad as PlayoffConfiguration) });
  }, [resolvedConfig, dispatch]);

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    settings.isModified && currentLocation.pathname !== nextLocation.pathname
  );

  /**
   * Load playoff data on mount
   */
  useEffect(() => {
    async function loadPlayoffData() {
      if (!seasonId) return;

      setLoading(true);
      setError(null);

      try {
        // Get playoff week
        const week = await getPlayoffWeek(seasonId);
        if (!week) {
          setError('No playoff week found for this season. Please add a playoff week in the season schedule.');
          setLoading(false);
          return;
        }
        setPlayoffWeek(week);

        // Check if regular season is complete
        const status = await checkRegularSeasonComplete(seasonId);
        setSeasonStatus(status);

        // Generate bracket from standings
        const result = await generatePlayoffBracket(seasonId, week.id);

        if (!result.success || !result.bracket) {
          setError(result.error || 'Failed to generate playoff bracket');
          setLoading(false);
          return;
        }

        setBracket(result.bracket);

        // Check if matches already exist
        // (This is handled inside createPlayoffMatches, but we check here for UI state)
        setMatchesExist(false); // Will be set if creation fails due to existing matches

      } catch (err) {
        logger.error('Error loading playoff data', {
          error: err instanceof Error ? err.message : String(err),
        });
        setError('Failed to load playoff data');
      } finally {
        setLoading(false);
      }
    }

    loadPlayoffData();
  }, [seasonId]);

  // Destructure settings for convenience
  const {
    playoffWeeks,
    weekMatchupStyles,
    isModified,
    configName,
    configDescription,
  } = settings;

  /**
   * Handle saving the configuration to the database
   */
  const handleSave = () => {
    if (!leagueId || !settings.configName.trim()) return;

    const payload = buildSavePayload('league', leagueId, settings);

    saveConfigMutation.mutate(payload, {
      onSuccess: (data) => {
        toast.success('Playoff configuration saved!');
        dispatch({ type: 'LOAD_SETTINGS', payload: buildPostSavePayload(data) });
      },
      onError: (error: Error) => {
        toast.error('Failed to save configuration');
        console.error('Save error:', error);
      },
    });
  };

  /**
   * Handle template selection from dropdown
   */
  const handleTemplateSelect = (template: PlayoffConfiguration) => {
    dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: template.id });
    dispatch({ type: 'LOAD_SETTINGS', payload: buildLoadSettingsPayload(template) });
  };

  /**
   * Handle matchup style change for a specific week
   */
  const handleMatchupStyleChange = (weekIndex: number, style: MatchupStyle) => {
    dispatch({
      type: 'SET_WEEK_MATCHUP_STYLE',
      payload: { weekIndex, style },
    });
  };

  /**
   * Handle populating playoff matches with teams from standings
   *
   * Updates existing placeholder matches (created during schedule generation)
   * with the actual team IDs based on the bracket seeding.
   */
  const handleCreateMatches = async () => {
    if (!bracket) return;

    const confirmed = await confirm({
      title: 'Set Playoff Matchups?',
      message: `This will assign ${bracket.matchups.length} teams to playoff matches based on the current standings. Teams will be able to see their playoff matchups immediately.`,
      confirmText: 'Set Matchups',
      confirmVariant: 'default',
    });

    if (!confirmed) return;

    setCreating(true);

    const result = await populatePlayoffMatches(bracket);

    if (result.success) {
      // Navigate to schedule page to see the matches
      navigate(`/league/${leagueId}/season/${seasonId}/schedule`);
    } else {
      if (result.error?.includes('No placeholder matches')) {
        setMatchesExist(true);
      }
      setError(result.error || 'Failed to populate playoff matches');
    }

    setCreating(false);
  };

  /**
   * Handle clearing existing playoff matches
   */
  const handleClearMatches = async () => {
    if (!seasonId || !playoffWeek) return;

    const confirmed = await confirm({
      title: 'Clear Playoff Matches?',
      message: 'This will delete all existing playoff matches. You can then regenerate them with updated standings.',
      confirmText: 'Clear Matches',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    const result = await clearPlayoffMatches(seasonId, playoffWeek.id);

    if (result.success) {
      setMatchesExist(false);
      setError(null);
    } else {
      setError(result.error || 'Failed to clear matches');
    }
  };

  // Loading state
  if (loading || seasonLoading || leagueLoading || configLoading) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center text-muted-foreground">Loading playoff data...</div>
        </div>
      </div>
    );
  }

  const seasonName = season?.season_name || 'Season';

  return (
    <div className="min-h-screen bg-muted">
      {/* Unsaved changes warning dialog */}
      <UnsavedChangesDialog blocker={blocker} />

      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back to League"
        title={
          <span className="inline-flex items-center gap-2">
            Playoff Setup
            <InfoButton title="Playoff Setup">
              <p>
                Configure your playoff settings, preview the bracket, and create
                playoff matches when the regular season is complete.
              </p>
            </InfoButton>
          </span>
        }
        subtitle={seasonName}
      />

      <div className="container mx-auto px-4 max-w-4xl py-8 space-y-6">
        {/* Error Display */}
        {error && (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <div className="font-medium text-destructive">Error</div>
                  <div className="text-sm text-foreground mt-1">{error}</div>
                  {matchesExist && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearMatches}
                      className="mt-3"
                    >
                      Clear Existing Matches
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Playoff Rules - at the top for visibility */}
        <PlayoffMatchRulesCard />

        {/* Season Status Card - includes playoff week info */}
        {seasonStatus && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Season Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Playoff Week Date */}
              {playoffWeek && (
                <div className="flex items-center gap-2 text-highlight">
                  <Trophy className="h-5 w-5" />
                  <span className="font-medium">{playoffWeek.week_name}:</span>
                  <span>
                    {parseLocalDate(playoffWeek.scheduled_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {/* Regular Season Progress */}
              <div className="flex items-center gap-4">
                {seasonStatus.isComplete ? (
                  <div className="flex items-center gap-2 text-success">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">Regular Season Complete</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-warning">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Regular Season In Progress</span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  {seasonStatus.completedMatches} of {seasonStatus.totalMatches} matches completed
                  {seasonStatus.remainingMatches > 0 && (
                    <span className="ml-1">
                      ({seasonStatus.remainingMatches} remaining)
                    </span>
                  )}
                </div>
              </div>

              {!seasonStatus.isComplete && (
                <p className="text-sm text-foreground bg-warning/10 border border-warning/40 p-3 rounded-lg">
                  You can configure playoff settings now, but playoff matches cannot be created until all regular season matches are complete.
                  The bracket preview below is based on current standings and will update as more matches are played.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Playoff Template Selector */}
        <PlayoffTemplateSelector
          context="league"
          organizationId={orgId}
          leagueId={leagueId}
          selectedTemplateId={settings.selectedTemplateId}
          isModified={isModified}
          configName={configName}
          configDescription={configDescription}
          onTemplateSelect={handleTemplateSelect}
          onNameChange={(name) => dispatch({ type: 'SET_CONFIG_NAME', payload: name })}
          onDescriptionChange={(desc) => dispatch({ type: 'SET_CONFIG_DESCRIPTION', payload: desc })}
          onSave={handleSave}
          isSaving={saveConfigMutation.isPending}
        />

        {/* Playoff Settings */}
        <PlayoffSettingsCard settings={settings} dispatch={dispatch} />

        {/* Bracket Cards - one for each playoff week using actual team data */}
        {bracket && (
          <>
            {/* Excluded Teams Notice */}
            <ExcludedTeamsNotice teams={bracket.excludedTeams} />

            {/* Bracket cards for each playoff week */}
            {Array.from({ length: playoffWeeks }, (_, weekIndex) => (
              <PlayoffBracketCard
                key={weekIndex}
                weekNum={weekIndex + 1}
                weekIndex={weekIndex}
                matchupStyle={weekMatchupStyles[weekIndex] || 'seeded'}
                seededTeams={bracket.seededTeams}
                bracketSize={bracket.bracketSize}
                isSeasonComplete={seasonStatus?.isComplete ?? false}
                onMatchupStyleChange={handleMatchupStyleChange}
              />
            ))}

            {/* Standings - shows "Current" while season in progress, "Final" when complete */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {seasonStatus?.isComplete ? 'Final Standings' : 'Current Standings'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StandingsTable teams={bracket.seededTeams} />
              </CardContent>
            </Card>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/league/${leagueId}`)}
          >
            Cancel
          </Button>
          {bracket && (
            <Button
              loadingText="Setting Matchups..."
              isLoading={creating}
              onClick={handleCreateMatches}
              disabled={creating || !seasonStatus?.isComplete}
              className="bg-highlight text-highlight-foreground hover:bg-highlight/90"
            >
              {!seasonStatus?.isComplete
                  ? 'Complete Regular Season First'
                  : 'Approve & Set Matchups'
              }
            </Button>
          )}
        </div>
      </div>

      {ConfirmDialogComponent}
    </div>
  );
};

export default PlayoffSetup;
