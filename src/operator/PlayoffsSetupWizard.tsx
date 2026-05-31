/**
 * @fileoverview Playoffs Setup Wizard Page
 *
 * Inserted between Team Management and Schedule Setup in the season creation flow.
 * Allows operators to confirm or customize their playoff configuration before
 * the schedule is generated.
 *
 * This step is important because:
 * 1. We now know the actual team count (teams were just created)
 * 2. The playoff config determines how many playoff matches to create
 * 3. Asking now prevents having to regenerate matches later
 *
 * The page:
 * - Shows the current team count
 * - Pre-loads the resolved playoff config (league → org → global)
 * - Allows customization if needed
 * - Saves the config to the league level
 * - Navigates to Schedule Setup on continue
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { InfoButton } from '@/components/InfoButton';
import { PlayoffTemplateSelector } from '@/components/playoff/PlayoffTemplateSelector';
import { PlayoffMatchRulesCard } from '@/components/playoff/PlayoffMatchRulesCard';
import { PlayoffBracketPreviewCard } from '@/components/playoff/PlayoffBracketPreviewCard';
import { PlayoffSettingsCard } from '@/components/playoff/PlayoffSettingsCard';
import { useSavePlayoffConfiguration } from '@/api/mutations/playoffConfigurations';
import {
  useResolvedPlayoffConfig,
  usePlayoffConfigurations,
  type PlayoffConfiguration,
} from '@/api/hooks/usePlayoffConfigurations';
import { useTeamsBySeason } from '@/api/hooks/useTeams';
import { useLeagueById } from '@/api/hooks';
import {
  usePlayoffSettingsReducer,
  calculateQualifyingTeams,
  buildLoadSettingsPayload,
  buildSavePayload,
  buildPostSavePayload,
} from '@/hooks/playoff/usePlayoffSettingsReducer';
import type { MatchupStyle } from '@/hooks/playoff/usePlayoffSettingsReducer';
import { syncPlayoffWeeks } from '@/utils/scheduleUtils';

/**
 * PlayoffsSetupWizard Component
 *
 * Wizard step for confirming playoff configuration before schedule generation.
 * Pre-loads the resolved config and allows customization.
 */
export const PlayoffsSetupWizard: React.FC = () => {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  // Use the reducer for all playoff settings state
  const [settings, dispatch] = usePlayoffSettingsReducer();

  // Track if we've loaded the initial config to prevent re-loading
  const hasLoadedInitialConfig = useRef(false);

  // Fetch league to get organization ID
  const { data: league } = useLeagueById(leagueId);
  const orgId = league?.organization_id;

  // Fetch teams for this season to get the actual count
  const { data: teams, isLoading: teamsLoading } = useTeamsBySeason(seasonId);
  const teamCount = teams?.length ?? 0;

  // Fetch the resolved playoff config (inheritance: league → org → global)
  const { data: resolvedConfig, isLoading: configLoading } = useResolvedPlayoffConfig(leagueId);

  // Fetch league-specific configurations (to check if one already exists)
  const { data: leagueConfigs } = usePlayoffConfigurations('league', leagueId);

  // Mutation for saving configurations
  const saveConfigMutation = useSavePlayoffConfiguration();

  // Load the resolved config on mount (only once)
  useEffect(() => {
    if (hasLoadedInitialConfig.current) return;
    if (!resolvedConfig) return;

    hasLoadedInitialConfig.current = true;

    // Set the selected template ID based on where the config came from
    dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: resolvedConfig.config_id });

    // Load the settings from the resolved config
    // Use nullish coalescing to convert database null values to default numbers
    dispatch({
      type: 'LOAD_SETTINGS',
      payload: {
        qualificationType: resolvedConfig.qualification_type,
        fixedTeamCount: resolvedConfig.fixed_team_count ?? 4,
        qualifyingPercentage: resolvedConfig.qualifying_percentage ?? 50,
        percentageMin: resolvedConfig.percentage_min ?? 4,
        percentageMax: resolvedConfig.percentage_max,
        playoffWeeks: resolvedConfig.playoff_weeks,
        weekMatchupStyles: resolvedConfig.week_matchup_styles as MatchupStyle[],
        wildcardSpots: resolvedConfig.wildcard_spots,
        paymentMethod: resolvedConfig.payment_method,
        configName: resolvedConfig.name,
        configDescription: resolvedConfig.description ?? '',
      },
    });
  }, [resolvedConfig, dispatch]);

  // Update the example team count to match actual teams
  useEffect(() => {
    if (teamCount > 0) {
      dispatch({ type: 'SET_EXAMPLE_TEAM_COUNT', payload: teamCount });
    }
  }, [teamCount, dispatch]);

  // Destructure for convenience
  const {
    exampleTeamCount,
    playoffWeeks,
    wildcardSpots,
    weekMatchupStyles,
    isModified,
    configName,
    configDescription,
  } = settings;

  // Calculate bracket size based on qualification settings and actual team count
  const bracketSize = calculateQualifyingTeams(teamCount || exampleTeamCount, settings);

  /**
   * Handle saving the configuration to the database (league level only)
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
   * Handle saving the configuration to both league AND organization levels
   * Useful when the org doesn't have a default set yet
   */
  const handleSaveToBoth = async () => {
    if (!leagueId || !orgId || !settings.configName.trim()) return;

    // Save to league first
    const leaguePayload = buildSavePayload('league', leagueId, settings);

    saveConfigMutation.mutate(leaguePayload, {
      onSuccess: (leagueData) => {
        // Now save to organization
        const orgPayload = buildSavePayload('organization', orgId, settings);

        saveConfigMutation.mutate(orgPayload, {
          onSuccess: () => {
            toast.success('Saved as league and organization default!');
            dispatch({ type: 'LOAD_SETTINGS', payload: buildPostSavePayload(leagueData) });
          },
          onError: (error: Error) => {
            // League saved but org failed
            toast.error('Saved to league but failed to save organization default');
            console.error('Org save error:', error);
            dispatch({ type: 'LOAD_SETTINGS', payload: buildPostSavePayload(leagueData) });
          },
        });
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
   * Sync playoff weeks in the database and then navigate
   * This ensures season_weeks has the correct number of playoff weeks
   */
  const syncAndNavigate = async () => {
    if (!seasonId) {
      navigate(`/league/${leagueId}/season/${seasonId}/schedule-setup`);
      return;
    }

    // Sync playoff weeks in the database to match the configuration
    const syncResult = await syncPlayoffWeeks(seasonId, playoffWeeks);

    if (!syncResult.success) {
      toast.error('Failed to sync playoff weeks');
      console.error('Sync error:', syncResult.error);
      setIsNavigating(false);
      return;
    }

    if (syncResult.weeksAdded > 0) {
      toast.success(`Added ${syncResult.weeksAdded} playoff week${syncResult.weeksAdded > 1 ? 's' : ''}`);
    }

    navigate(`/league/${leagueId}/season/${seasonId}/schedule-setup`);
  };

  /**
   * Handle continue to schedule setup
   * If settings were modified but not saved, save them first
   * Then sync playoff weeks and navigate
   */
  const handleContinue = async () => {
    setIsNavigating(true);

    // If modified, save first
    if (isModified && leagueId && configName.trim()) {
      const payload = buildSavePayload('league', leagueId, settings);

      saveConfigMutation.mutate(payload, {
        onSuccess: async () => {
          await syncAndNavigate();
        },
        onError: (error: Error) => {
          toast.error('Failed to save configuration');
          console.error('Save error:', error);
          setIsNavigating(false);
        },
      });
    } else {
      // Not modified, just sync and continue
      await syncAndNavigate();
    }
  };

  /**
   * Handle skip (use default without changes)
   * Still need to sync playoff weeks based on the resolved config
   */
  const handleSkip = async () => {
    setIsNavigating(true);
    await syncAndNavigate();
  };

  // Loading state
  if (teamsLoading || configLoading) {
    return (
      <div className="min-h-screen bg-muted">
        <PageHeader
          backTo={`/league/${leagueId}/manage-teams?seasonId=${seasonId}`}
          backLabel="Back to Teams"
          title="Playoff Setup"
          subtitle="Loading..."
        />
        <div className="container mx-auto px-4 max-w-4xl py-8">
          <div className="text-center text-muted-foreground">Loading playoff configuration...</div>
        </div>
      </div>
    );
  }

  // Determine if there's already a league-specific config
  const hasLeagueConfig = (leagueConfigs?.length ?? 0) > 0;

  // Get the source of the current config for display
  const configSource = resolvedConfig?.config_source === 'league'
    ? 'League'
    : resolvedConfig?.config_source === 'organization'
      ? 'Organization Default'
      : 'Global Template';

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={`/league/${leagueId}/manage-teams?seasonId=${seasonId}`}
        backLabel="Back to Teams"
        title={
          <span className="inline-flex items-center gap-2">
            Playoff Setup
            <InfoButton title="Playoff Configuration">
              <p>
                Configure how playoffs will work for this league. The settings here
                determine bracket size, seeding rules, and matchup styles.
              </p>
              <p className="mt-2">
                You can use your organization's default or customize for this league.
              </p>
            </InfoButton>
          </span>
        }
        subtitle="Step 3 of 4: Configure Playoffs"
      >
        <div className="hidden lg:flex gap-2 mt-4">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isNavigating}
            loadingText="Loading..."
          >
            {isNavigating ? 'Loading...' : 'Skip'}
          </Button>
          <Button
            onClick={handleContinue}
            disabled={isNavigating}
            loadingText="Saving..."
          >
            {isNavigating ? 'Loading...' : 'Continue to Schedule →'}
          </Button>
        </div>
      </PageHeader>

      <div className="container mx-auto px-4 max-w-4xl py-8 space-y-6">
        {/* Team Count Info Card */}
        <Card className="border-info/40 bg-info/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-info" />
              <div>
                <div className="font-semibold text-info">
                  {teamCount} Teams in this Season
                </div>
                <div className="text-sm text-foreground">
                  {bracketSize} teams will qualify for playoffs based on current settings
                  {bracketSize < teamCount && ` (${teamCount - bracketSize} eliminated)`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Config Source */}
        {!hasLeagueConfig && resolvedConfig && (
          <Card className="border-warning/40 bg-warning/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-warning" />
                <div>
                  <div className="font-semibold text-warning">
                    Using {configSource}: {resolvedConfig.name}
                  </div>
                  <div className="text-sm text-foreground">
                    You can customize these settings for this league or continue with the default.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Playoff Rules - at the top for visibility */}
        <PlayoffMatchRulesCard />

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
          onSaveToBoth={handleSaveToBoth}
          isSaving={saveConfigMutation.isPending}
        />

        {/* Playoff Settings */}
        <PlayoffSettingsCard settings={settings} dispatch={dispatch} />

        {/* Example Brackets - dynamically generated for each playoff week */}
        {Array.from({ length: playoffWeeks }, (_, weekIndex) => (
          <PlayoffBracketPreviewCard
            key={weekIndex}
            weekNum={weekIndex + 1}
            weekIndex={weekIndex}
            matchupStyle={weekMatchupStyles[weekIndex] || 'seeded'}
            bracketSize={bracketSize}
            totalTeams={teamCount || exampleTeamCount}
            qualificationType={settings.qualificationType}
            qualifyingPercentage={settings.qualifyingPercentage}
            wildcardSpots={wildcardSpots}
            onMatchupStyleChange={handleMatchupStyleChange}
          />
        ))}

        {/* Mobile Action Buttons */}
        <div className="lg:hidden flex flex-col gap-3">
          <Button
            className="w-full"
            size="lg"
            onClick={handleContinue}
            disabled={isNavigating}
            loadingText="Saving..."
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            {isNavigating ? 'Loading...' : 'Continue to Schedule'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleSkip}
            disabled={isNavigating}
            loadingText="Loading..."
          >
            {isNavigating ? 'Loading...' : 'Skip (Use Default)'}
          </Button>
        </div>

        {/* Desktop Action Buttons */}
        <div className="hidden lg:flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/league/${leagueId}/manage-teams?seasonId=${seasonId}`)}
            loadingText="none"
          >
            Back to Teams
          </Button>
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isNavigating}
            loadingText="Loading..."
          >
            Skip (Use Default)
          </Button>
          <Button
            onClick={handleContinue}
            disabled={isNavigating}
            loadingText="Saving..."
          >
            {isNavigating ? 'Saving...' : 'Continue to Schedule →'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlayoffsSetupWizard;
