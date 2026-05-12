/**
 * @fileoverview Preferences Card Component
 *
 * Reusable component for managing preferences at both organization and league levels.
 * - Organization level: NULL = use system defaults
 * - League level: NULL = use organization defaults
 *
 * The component adapts its display text and behavior based on entityType.
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import type { Preferences } from '@/types/preferences';
import type { HandicapVariant } from '@/types/league';
import { SYSTEM_DEFAULTS } from '@/types/preferences';
import { logger } from '@/utils/logger';

// Import section components
import {
  HandicapSettingsSection,
  RosterSettingsSection,
  PlayerAuthorizationSection,
  ContentModerationSection,
} from './preferences';

interface PreferencesCardProps {
  /** Type of entity: 'organization' or 'league' */
  entityType: 'organization' | 'league';
  /** ID of the organization or league */
  entityId: string;
  /** Callback when preferences are updated */
  onUpdate?: () => void;
}

/**
 * Preferences Card Component
 * Allows operators to set preferences for organization or league
 */
export const PreferencesCard: React.FC<PreferencesCardProps> = ({
  entityType,
  entityId,
  onUpdate,
}) => {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<'handicap' | 'roster' | 'authorization' | 'moderation' | null>(null);

  // Local edit state
  const [handicapVariant, setHandicapVariant] = useState<HandicapVariant | 'default'>('default');
  const [teamHandicapVariant, setTeamHandicapVariant] = useState<HandicapVariant | 'default'>('default');
  const [gameHistoryLimit, setGameHistoryLimit] = useState<number>(200);
  const [maxRosterSize, setMaxRosterSize] = useState<string>('');
  const [useOrgDefaultMaxRoster, setUseOrgDefaultMaxRoster] = useState<boolean>(false);
  // Golden Break setting moved to the scoring modal's edit mode 2026-05-12.
  const [allowUnauthorizedPlayers, setAllowUnauthorizedPlayers] = useState<boolean>(true);
  const [profanityFilterEnabled, setProfanityFilterEnabled] = useState<boolean>(false);
  const [isUsingOrgDefault, setIsUsingOrgDefault] = useState(false);
  const [isUsingOrgDefaultModeration, setIsUsingOrgDefaultModeration] = useState(false);

  const isLeague = entityType === 'league';
  const cardTitle = isLeague ? 'League Preferences' : 'Organization Preferences';
  const cardSubtitle = isLeague
    ? 'Override organization defaults for this league'
    : 'Default settings for all your leagues';

  // Fetch preferences on mount
  useEffect(() => {
    fetchPreferences();
  }, [entityId, entityType]);

  const fetchPreferences = async () => {
    setLoading(true);
    setError(null);

    // Fetch entity preferences
    const { data, error: fetchError } = await supabase
      .from('preferences')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .single();

    if (fetchError) {
      // If no preference record exists, create one with default values
      if (fetchError.code === 'PGRST116') {
        const { data: newPrefs, error: insertError } = await supabase
          .from('preferences')
          .insert({
            entity_type: entityType,
            entity_id: entityId,
          })
          .select()
          .single();

        if (insertError) {
          setError('Failed to create preferences record');
          logger.error('Error creating preferences', { error: insertError.message });
        } else if (newPrefs) {
          setPreferences(newPrefs as Preferences);
          syncLocalState(newPrefs as Preferences);
        }
      } else {
        setError('Failed to load preferences');
        logger.error('Error fetching preferences', { error: fetchError.message });
      }
    } else if (data) {
      setPreferences(data as Preferences);
      syncLocalState(data as Preferences);
    }

    setLoading(false);
  };

  // Sync local edit state with fetched preferences
  const syncLocalState = (prefs: Preferences) => {
    setHandicapVariant(prefs.handicap_variant || 'default');
    setTeamHandicapVariant(prefs.team_handicap_variant || 'default');
    setGameHistoryLimit(prefs.game_history_limit ?? SYSTEM_DEFAULTS.game_history_limit);
    // Roster: null at league level means "inherit org default". Store as
    // empty string in the input when inheriting so the placeholder shows.
    const rosterRaw = (prefs as any).max_roster_size;
    setMaxRosterSize(rosterRaw == null ? '' : String(rosterRaw));
    setUseOrgDefaultMaxRoster(rosterRaw == null);
    setAllowUnauthorizedPlayers(prefs.allow_unauthorized_players ?? SYSTEM_DEFAULTS.allow_unauthorized_players);
    setProfanityFilterEnabled(prefs.profanity_filter_enabled ?? SYSTEM_DEFAULTS.profanity_filter_enabled);
    setIsUsingOrgDefault(prefs.allow_unauthorized_players === null);
    setIsUsingOrgDefaultModeration(prefs.profanity_filter_enabled === null);
  };

  // Start editing a section
  const startEditing = (section: 'handicap' | 'roster' | 'authorization' | 'moderation') => {
    if (preferences) {
      syncLocalState(preferences);
    }
    setEditingSection(section);
  };

  // Cancel editing
  const cancelEditing = () => {
    if (preferences) {
      syncLocalState(preferences);
    }
    setEditingSection(null);
  };

  // Save handicap settings
  const saveHandicap = async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('preferences')
      .update({
        handicap_variant: handicapVariant === 'default' ? null : handicapVariant,
        team_handicap_variant: teamHandicapVariant === 'default' ? null : teamHandicapVariant,
        game_history_limit: gameHistoryLimit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', preferences.id);

    if (updateError) {
      setError('Failed to update handicap settings');
      logger.error('Error updating preferences', { error: updateError.message });
    } else {
      setEditingSection(null);
      await fetchPreferences();
      onUpdate?.();
    }

    setSaving(false);
  };

  // Save roster settings (max_roster_size). League level can choose to
  // inherit the org default by setting the value to null.
  const saveRoster = async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);

    let nextValue: number | null;
    if (isLeague && useOrgDefaultMaxRoster) {
      nextValue = null;
    } else {
      const parsed = parseInt(maxRosterSize, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
        setError('Max Roster Size must be a whole number between 1 and 20');
        setSaving(false);
        return;
      }
      nextValue = parsed;
    }

    const { error: updateError } = await supabase
      .from('preferences')
      .update({
        max_roster_size: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', preferences.id);

    if (updateError) {
      setError('Failed to update roster settings');
      logger.error('Error updating preferences', { error: updateError.message });
    } else {
      setEditingSection(null);
      await fetchPreferences();
      onUpdate?.();
    }

    setSaving(false);
  };

  // saveRules removed 2026-05-12 — the only rules field this saved
  // (golden_break_counts_as_win) was deprecated in favor of
  // enabled_events.golden_break, configured via the scoring modal's
  // edit mode.

  // Save authorization settings
  const saveAuthorization = async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('preferences')
      .update({
        allow_unauthorized_players: isUsingOrgDefault ? null : allowUnauthorizedPlayers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', preferences.id);

    if (updateError) {
      setError('Failed to update authorization settings');
      logger.error('Error updating preferences', { error: updateError.message });
    } else {
      setEditingSection(null);
      await fetchPreferences();
      onUpdate?.();
    }

    setSaving(false);
  };

  // Save content moderation settings
  const saveModeration = async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('preferences')
      .update({
        profanity_filter_enabled: isUsingOrgDefaultModeration ? null : profanityFilterEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', preferences.id);

    if (updateError) {
      setError('Failed to update content moderation settings');
      logger.error('Error updating preferences', { error: updateError.message });
    } else {
      setEditingSection(null);
      await fetchPreferences();
      onUpdate?.();
    }

    setSaving(false);
  };

  // Get display value - simple: show value or "Not set"
  const getDisplayValue = (value: string | null): string => {
    if (value === null) return 'Not set';
    if (value === 'standard') return 'Standard';
    if (value === 'reduced') return 'Reduced';
    if (value === 'none') return 'None';
    return String(value);
  };

  // Display helper for max_roster_size. At league level, null means "use
  // org default" (which we can't resolve here without another fetch, so we
  // just label it as such). At org level, null means "system default".
  const getRosterDisplay = (value: number | null | undefined): string => {
    if (value == null) {
      return isLeague ? 'Organization default' : 'Not set';
    }
    return `${value} players`;
  };

  const getLineupDisplay = (value: number | null | undefined): string => {
    if (value == null) return 'Not set';
    return `${value} per match`;
  };

  // getGoldenBreakDisplay removed 2026-05-12 — see saveRules note above.

  // Get authorization display value
  const getAuthorizationDisplay = (value: boolean | null): string => {
    if (value === null) return 'Not set';
    return value
      ? 'New players can be used without authorization'
      : 'Players must be authorized to be used in lineups';
  };

  // Get profanity filter display value
  const getProfanityFilterDisplay = (value: boolean | null): string => {
    if (value === null) return 'Not set';
    return value
      ? 'Team names may not contain profanity'
      : 'Team names may contain profanity';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-indigo-600" />
            <CardTitle>{cardTitle}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading preferences...</p>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-indigo-600" />
            <CardTitle>{cardTitle}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            {error || 'No preferences found. Please contact support.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-indigo-600" />
          <div className="flex-1">
            <CardTitle>{cardTitle}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{cardSubtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Roster Settings Section — lets LOs edit max_roster_size at both
            levels. At league level also shows the tier-1-locked lineup_size
            as a read-only reference. Replaces the older FormatSettingsSection
            which only offered a hardcoded 5-man / 8-man dropdown. */}
        <RosterSettingsSection
          isLeague={isLeague}
          isEditing={editingSection === 'roster'}
          saving={saving}
          maxRosterSize={maxRosterSize}
          useOrgDefaultMaxRoster={useOrgDefaultMaxRoster}
          maxRosterSizeDisplay={getRosterDisplay((preferences as any).max_roster_size)}
          lineupSizeDisplay={
            isLeague ? getLineupDisplay((preferences as any).lineup_size) : undefined
          }
          onMaxRosterSizeChange={setMaxRosterSize}
          onUseOrgDefaultChange={setUseOrgDefaultMaxRoster}
          onStartEditing={() => startEditing('roster')}
          onSave={saveRoster}
          onCancel={cancelEditing}
        />

        {/* Handicap Settings Section */}
        <HandicapSettingsSection
          isLeague={isLeague}
          isEditing={editingSection === 'handicap'}
          saving={saving}
          handicapVariant={handicapVariant}
          teamHandicapVariant={teamHandicapVariant}
          gameHistoryLimit={gameHistoryLimit}
          playerHandicapDisplay={getDisplayValue(preferences.handicap_variant)}
          teamHandicapDisplay={getDisplayValue(preferences.team_handicap_variant)}
          gameHistoryDisplay={preferences.game_history_limit ? `${preferences.game_history_limit} games` : 'Not set'}
          onHandicapVariantChange={setHandicapVariant}
          onTeamHandicapVariantChange={setTeamHandicapVariant}
          onGameHistoryLimitChange={setGameHistoryLimit}
          onStartEditing={() => startEditing('handicap')}
          onSave={saveHandicap}
          onCancel={cancelEditing}
        />

        {/* Match Rules section removed 2026-05-12 — its only content was
            the Golden Break picker, now exclusively configured via the
            scoring modal's edit mode (see ScoringPreviewCard on this page). */}

        {/* Player Authorization Section */}
        <PlayerAuthorizationSection
          isLeague={isLeague}
          isEditing={editingSection === 'authorization'}
          saving={saving}
          allowUnauthorizedPlayers={allowUnauthorizedPlayers}
          isUsingOrgDefault={isUsingOrgDefault}
          authorizationDisplay={getAuthorizationDisplay(preferences.allow_unauthorized_players)}
          onAuthorizationChange={(value) => {
            setAllowUnauthorizedPlayers(value);
            setIsUsingOrgDefault(false);
          }}
          onUseOrgDefault={isLeague ? () => {
            setIsUsingOrgDefault(true);
            setAllowUnauthorizedPlayers(true);
          } : undefined}
          onStartEditing={() => startEditing('authorization')}
          onSave={saveAuthorization}
          onCancel={cancelEditing}
        />

        {/* Content Moderation Section */}
        <ContentModerationSection
          isLeague={isLeague}
          isEditing={editingSection === 'moderation'}
          saving={saving}
          profanityFilterEnabled={profanityFilterEnabled}
          isUsingOrgDefault={isUsingOrgDefaultModeration}
          profanityFilterDisplay={getProfanityFilterDisplay(preferences.profanity_filter_enabled)}
          onProfanityFilterChange={(value) => {
            setProfanityFilterEnabled(value);
            setIsUsingOrgDefaultModeration(false);
          }}
          onUseOrgDefault={isLeague ? () => {
            setIsUsingOrgDefaultModeration(true);
            setProfanityFilterEnabled(false);
          } : undefined}
          onStartEditing={() => startEditing('moderation')}
          onSave={saveModeration}
          onCancel={cancelEditing}
        />

        {!isLeague && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> These are organization-level defaults. Individual leagues can override these settings.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
