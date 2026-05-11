/**
 * @fileoverview Playoff Template Selector Component
 *
 * Displays a card with a dropdown to select from available playoff templates.
 * When a template is selected, shows the template's name and description.
 * When settings are modified from the template, shows editable name/description
 * fields and a save button.
 *
 * Supports two contexts:
 * 1. Organization level: Shows global templates + org's saved config
 * 2. League level: Shows global templates + org's config + league's saved config
 *
 * Used on:
 * - Organization Playoff Settings page
 * - League Playoff Settings page
 */

import React, { useMemo } from 'react';
import { Trophy, Save, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useGlobalPlayoffTemplates,
  usePlayoffConfigurations,
} from '@/api/hooks/usePlayoffConfigurations';
import type { PlayoffConfiguration } from '@/api/hooks/usePlayoffConfigurations';

/**
 * Context type for the template selector
 * - 'organization': Used on org settings page, shows global + org configs
 * - 'league': Used on league settings page, shows global + org + league configs
 */
export type TemplateSelectorContext = 'organization' | 'league';

/**
 * Props for PlayoffTemplateSelector component
 */
export interface PlayoffTemplateSelectorProps {
  /** Context determines which configs to fetch and display */
  context?: TemplateSelectorContext;
  /** Organization ID to fetch org-specific configs */
  organizationId: string | undefined;
  /** League ID to fetch league-specific configs (required when context is 'league') */
  leagueId?: string;
  /** Currently selected template ID */
  selectedTemplateId: string | undefined;
  /** Whether settings have been modified from the selected template */
  isModified: boolean;
  /** Current configuration name (for modified state) */
  configName: string;
  /** Current configuration description (for modified state) */
  configDescription: string;
  /** Callback when a template is selected */
  onTemplateSelect: (template: PlayoffConfiguration) => void;
  /** Callback when config name changes */
  onNameChange: (name: string) => void;
  /** Callback when config description changes */
  onDescriptionChange: (description: string) => void;
  /** Callback when save button is clicked (saves to current context level) */
  onSave: () => void;
  /** Callback when "Save to Both" button is clicked (league context only, saves to league AND org) */
  onSaveToBoth?: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
}

/**
 * PlayoffTemplateSelector Component
 *
 * Fetches playoff templates based on context and displays them in a grouped dropdown.
 * When unmodified, shows the template's name and description.
 * When modified, shows editable fields for custom name/description and a save button.
 *
 * Validates that custom names don't match global template names.
 */
export const PlayoffTemplateSelector: React.FC<PlayoffTemplateSelectorProps> = ({
  context = 'organization',
  organizationId,
  leagueId,
  selectedTemplateId,
  isModified,
  configName,
  configDescription,
  onTemplateSelect,
  onNameChange,
  onDescriptionChange,
  onSave,
  onSaveToBoth,
  isSaving = false,
}) => {
  // Fetch global templates
  const { data: globalTemplates, isLoading: isLoadingGlobal } = useGlobalPlayoffTemplates();

  // Fetch organization-specific configurations
  const { data: orgConfigs, isLoading: isLoadingOrg } = usePlayoffConfigurations(
    'organization',
    organizationId
  );

  // Fetch league-specific configurations (only when in league context)
  const { data: leagueConfigs, isLoading: isLoadingLeague } = usePlayoffConfigurations(
    'league',
    context === 'league' ? leagueId : undefined
  );

  const isLoading = isLoadingGlobal || isLoadingOrg || (context === 'league' && isLoadingLeague);

  // Combine all templates for lookup
  const allTemplates = useMemo(() => {
    const all: PlayoffConfiguration[] = [];
    if (globalTemplates) all.push(...globalTemplates);
    if (orgConfigs) all.push(...orgConfigs);
    if (context === 'league' && leagueConfigs) all.push(...leagueConfigs);
    return all;
  }, [globalTemplates, orgConfigs, leagueConfigs, context]);

  // Find the currently selected template
  const selectedTemplate = allTemplates.find((t) => t.id === selectedTemplateId);

  // Determine the source of the selected template for display in the title
  const templateSource = useMemo(() => {
    if (!selectedTemplate) return null;
    // Check if it's an org config (show "Organization Default" in league context)
    if (context === 'league' && orgConfigs?.some((t) => t.id === selectedTemplate.id)) {
      return 'Organization Default';
    }
    // Check if it's a league config
    if (leagueConfigs?.some((t) => t.id === selectedTemplate.id)) {
      return 'League Configuration';
    }
    // Global templates don't need a source label
    return null;
  }, [selectedTemplate, orgConfigs, leagueConfigs, context]);

  // Check if the selected template is a global template (not already saved as org/league config)
  const isGlobalTemplateSelected = useMemo(() => {
    if (!selectedTemplate) return false;
    return globalTemplates?.some((t) => t.id === selectedTemplate.id) ?? false;
  }, [selectedTemplate, globalTemplates]);

  // Check if there's already a saved config for this entity (org or league)
  const hasSavedConfig = useMemo(() => {
    if (context === 'organization') {
      return (orgConfigs?.length ?? 0) > 0;
    }
    // For league context, check if league has its own config
    return (leagueConfigs?.length ?? 0) > 0;
  }, [context, orgConfigs, leagueConfigs]);

  // Check if organization has a saved config (for "Save to Both" option in league context)
  const hasOrgConfig = useMemo(() => {
    return (orgConfigs?.length ?? 0) > 0;
  }, [orgConfigs]);

  // Show "Save to Both" option in league context when org has no saved config
  const canSaveToBoth = context === 'league' && !hasOrgConfig && onSaveToBoth;

  // Show "Set as Default" when a global template is selected and it's not already the saved default
  const canSetAsDefault = isGlobalTemplateSelected && !isModified;

  // Check if the current name matches a global template name (case-insensitive)
  const nameMatchesGlobalTemplate = useMemo(() => {
    if (!configName.trim() || !globalTemplates) return false;
    const normalizedName = configName.trim().toLowerCase();
    return globalTemplates.some(
      (t) => t.name.toLowerCase() === normalizedName
    );
  }, [configName, globalTemplates]);

  // Handle template selection
  const handleSelect = (templateId: string) => {
    const template = allTemplates.find((t) => t.id === templateId);
    if (template) {
      onTemplateSelect(template);
    }
  };

  // Determine what to show as the title (include source if applicable)
  const displayTitle = isModified
    ? 'Custom Configuration'
    : selectedTemplate?.name
      ? templateSource
        ? `${selectedTemplate.name} (${templateSource})`
        : selectedTemplate.name
      : 'Select Playoff Format';

  // Determine if save is disabled
  const isSaveDisabled =
    !configName.trim() ||
    isSaving ||
    nameMatchesGlobalTemplate;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-purple-600" />
            {displayTitle}
          </CardTitle>
          <Select
            value={isModified ? '' : (selectedTemplateId ?? '')}
            onValueChange={handleSelect}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={isLoading ? 'Loading...' : (isModified ? 'Custom...' : 'Select template')} />
            </SelectTrigger>
            <SelectContent>
              {/* Global Templates Group */}
              <SelectGroup>
                <SelectLabel>Templates</SelectLabel>
                {globalTemplates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectGroup>

              {/* Organization Configs Group (if any exist) */}
              {orgConfigs && orgConfigs.length > 0 && (
                <SelectGroup>
                  <SelectLabel>
                    {context === 'league' ? 'Organization Default' : 'Your Configurations'}
                  </SelectLabel>
                  {orgConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}

              {/* League Configs Group (only in league context, if any exist) */}
              {context === 'league' && leagueConfigs && leagueConfigs.length > 0 && (
                <SelectGroup>
                  <SelectLabel>League Configuration</SelectLabel>
                  {leagueConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isModified ? (
          // Modified state: show editable name/description and save button
          <>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              {context === 'league'
                ? 'Settings have been modified. Enter a name and save to create this league\'s custom configuration.'
                : 'Settings have been modified. Enter a name and save to create your organization\'s custom configuration.'}
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="config-name">Configuration Name *</Label>
                <Input
                  id="config-name"
                  value={configName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
                  placeholder="e.g., My League Playoffs"
                  maxLength={100}
                  className={nameMatchesGlobalTemplate ? 'border-red-500' : ''}
                />
                {nameMatchesGlobalTemplate && (
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>This name is reserved. Please choose a different name.</span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="config-description">Description (optional)</Label>
                <Textarea
                  id="config-description"
                  value={configDescription}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  placeholder="Describe your playoff configuration..."
                  rows={3}
                  maxLength={500}
                />
              </div>
              <Button
                onClick={onSave}
                disabled={isSaveDisabled}
                className="w-full"
                isLoading={isSaving}
                loadingText="Saving..."
              >
                <Save className="h-4 w-4 mr-2" />
                {context === 'league'
                  ? 'Save as League Configuration'
                  : 'Save as Organization Default'}
              </Button>
              {/* Show "Save to Both" option when in league context and org has no default */}
              {canSaveToBoth && (
                <Button
                  onClick={onSaveToBoth}
                  disabled={isSaveDisabled}
                  variant="outline"
                  className="w-full"
                  isLoading={isSaving}
                  loadingText="Saving..."
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as League + Organization Default
                </Button>
              )}
            </div>
          </>
        ) : (
          // Unmodified state: show template description and optional "Set as Default" button
          <>
            {selectedTemplate?.description ? (
              <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Select a playoff format to see its description.
              </p>
            )}
            {/* Show "Set as Default" button when a global template is selected */}
            {canSetAsDefault && (
              <>
                <Button
                  onClick={onSave}
                  disabled={isSaving}
                  className="w-full mt-4"
                  variant="outline"
                  isLoading={isSaving}
                  loadingText="Saving..."
                >
                  <Save className="h-4 w-4 mr-2" />
                  {context === 'league'
                    ? 'Set as League Default'
                    : hasSavedConfig
                      ? 'Change Organization Default'
                      : 'Set as Organization Default'}
                </Button>
                {/* Show "Save to Both" option when in league context and org has no default */}
                {canSaveToBoth && (
                  <Button
                    onClick={onSaveToBoth}
                    disabled={isSaving}
                    variant="ghost"
                    className="w-full mt-2"
                    isLoading={isSaving}
                    loadingText="Saving..."
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Set as League + Organization Default
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayoffTemplateSelector;
