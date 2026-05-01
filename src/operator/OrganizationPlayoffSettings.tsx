/**
 * @fileoverview Organization Playoff Settings Page
 *
 * Allows operators to configure default playoff settings for their organization.
 * Shows a generic bracket template that will be used as the default for all leagues.
 * Individual leagues can override these settings.
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
 * OrganizationPlayoffSettings Page Component
 */
export const OrganizationPlayoffSettings: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  // Use the reducer for all playoff settings state
  const [settings, dispatch] = usePlayoffSettingsReducer();

  // Track if we've loaded the initial config to prevent re-loading
  const hasLoadedInitialConfig = useRef(false);

  // Fetch organization's existing configuration (if any)
  const { data: orgConfigs } = usePlayoffConfigurations('organization', orgId);

  // Load the org's existing config on mount (only once)
  useEffect(() => {
    if (hasLoadedInitialConfig.current) return;
    if (!orgConfigs || orgConfigs.length === 0) return;

    // Org has an existing config - load it
    const existingConfig = orgConfigs[0];
    hasLoadedInitialConfig.current = true;

    dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: existingConfig.id });
    dispatch({ type: 'LOAD_SETTINGS', payload: buildLoadSettingsPayload(existingConfig) });
  }, [orgConfigs, dispatch]);

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
   * Creates a new organization-level playoff configuration
   */
  const handleSave = () => {
    if (!orgId || !settings.configName.trim()) return;

    const payload = buildSavePayload('organization', orgId, settings);

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
        backTo={`/operator-settings/${orgId}`}
        backLabel="Back to Settings"
        title={
          <span className="inline-flex items-center gap-2">
            Playoff Settings
            <InfoButton title="Organization Default Settings">
              <p>
                These settings will be used as the default for all leagues in your organization.
                Individual leagues can override these settings if needed.
              </p>
            </InfoButton>
          </span>
        }
        subtitle="Organization Default Configuration"
      />

      <div className="container mx-auto px-4 max-w-4xl py-8 space-y-6">
        {/* Playoff Rules - at the top for visibility */}
        <PlayoffMatchRulesCard />

        {/* Playoff Template Selector */}
        <PlayoffTemplateSelector
          organizationId={orgId}
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
            onClick={() => navigate(`/operator-settings/${orgId}`)}
          >
            Back to Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationPlayoffSettings;
