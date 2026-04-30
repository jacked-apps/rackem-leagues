/**
 * @fileoverview League Playoff Settings Page
 *
 * Allows operators to configure playoff settings for a specific league.
 * Can inherit from the organization's default or create a custom configuration.
 * This is where operators will eventually create actual playoff matchups.
 *
 * Uses usePlayoffSettingsReducer for centralized state management.
 * State is organized for easy database persistence.
 */

import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { toast } from 'sonner';
import { useSavePlayoffConfiguration } from '@/api/mutations/playoffConfigurations';
import {
  usePlayoffConfigurations,
  type PlayoffConfiguration,
} from '@/api/hooks/usePlayoffConfigurations';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { InfoButton } from '@/components/InfoButton';
import { PlayoffTemplateSelector } from '@/components/playoff/PlayoffTemplateSelector';
import { PlayoffMatchRulesCard } from '@/components/playoff/PlayoffMatchRulesCard';
import { PlayoffBracketPreviewCard } from '@/components/playoff/PlayoffBracketPreviewCard';
import { PlayoffSeedingCard } from '@/components/playoff/PlayoffSeedingCard';
import { PlayoffSettingsCard } from '@/components/playoff/PlayoffSettingsCard';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import {
  usePlayoffSettingsReducer,
  calculateQualifyingTeams,
  buildLoadSettingsPayload,
  buildSavePayload,
  buildPostSavePayload,
} from '@/hooks/playoff/usePlayoffSettingsReducer';
import type { MatchupStyle } from '@/hooks/playoff/usePlayoffSettingsReducer';

/**
 * LeaguePlayoffSettings Page Component
 */
export const LeaguePlayoffSettings: React.FC = () => {
  const { leagueId, orgId } = useParams<{ leagueId: string; orgId: string }>();
  const navigate = useNavigate();

  // Use the reducer for all playoff settings state
  const [settings, dispatch] = usePlayoffSettingsReducer();

  // Track if we've loaded the initial config to prevent re-loading
  const hasLoadedInitialConfig = useRef(false);

  // Fetch league's existing configuration (if any)
  const { data: leagueConfigs } = usePlayoffConfigurations('league', leagueId);

  // Fetch organization's configuration as fallback
  const { data: orgConfigs } = usePlayoffConfigurations('organization', orgId);

  // Load the league's existing config on mount, or fall back to org config
  useEffect(() => {
    if (hasLoadedInitialConfig.current) return;

    // First priority: league's own config
    if (leagueConfigs && leagueConfigs.length > 0) {
      const existingConfig = leagueConfigs[0];
      hasLoadedInitialConfig.current = true;

      dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: existingConfig.id });
      dispatch({ type: 'LOAD_SETTINGS', payload: buildLoadSettingsPayload(existingConfig) });
      return;
    }

    // Second priority: organization's config (as starting point)
    if (orgConfigs && orgConfigs.length > 0) {
      const orgConfig = orgConfigs[0];
      hasLoadedInitialConfig.current = true;

      // Load org config but don't set it as selected (league doesn't have its own yet)
      dispatch({ type: 'LOAD_SETTINGS', payload: buildLoadSettingsPayload(orgConfig) });
      return;
    }
  }, [leagueConfigs, orgConfigs, dispatch]);

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    settings.isModified && currentLocation.pathname !== nextLocation.pathname
  );

  // Mutation for saving configurations (handles both create and update)
  const saveConfigMutation = useSavePlayoffConfiguration();

  // Destructure for convenience (only values used directly in this component)
  const {
    exampleTeamCount,
    playoffWeeks,
    wildcardSpots,
    weekMatchupStyles,
    isModified,
    configName,
    configDescription,
  } = settings;

  /**
   * Handle saving the configuration to the database
   * Creates a new league-level playoff configuration
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

  // Calculate bracket size based on qualification settings
  const bracketSize = calculateQualifyingTeams(exampleTeamCount, settings);

  /**
   * Handle matchup style change for a specific week
   */
  const handleMatchupStyleChange = (weekIndex: number, style: MatchupStyle) => {
    dispatch({
      type: 'SET_WEEK_MATCHUP_STYLE',
      payload: { weekIndex, style },
    });
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Unsaved changes warning dialog */}
      <UnsavedChangesDialog blocker={blocker} />

      <PageHeader
        backTo={`/operator/league/${leagueId}`}
        backLabel="Back to League"
        title={
          <span className="inline-flex items-center gap-2">
            Playoff Settings
            <InfoButton title="League Playoff Settings">
              <p>
                Configure playoff settings for this specific league.
                You can use the organization default or create a custom configuration.
              </p>
            </InfoButton>
          </span>
        }
        subtitle="League Configuration"
      />

      <div className="container mx-auto px-4 max-w-4xl py-8 space-y-6">
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
            totalTeams={exampleTeamCount}
            qualificationType={settings.qualificationType}
            qualifyingPercentage={settings.qualifyingPercentage}
            wildcardSpots={wildcardSpots}
            onMatchupStyleChange={handleMatchupStyleChange}
          />
        ))}

        {/* Example Standings */}
        <PlayoffSeedingCard
          teamCount={exampleTeamCount}
          bracketSize={bracketSize}
          wildcardSpots={wildcardSpots}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/operator/league/${leagueId}`)}
          >
            Back to League
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeaguePlayoffSettings;
