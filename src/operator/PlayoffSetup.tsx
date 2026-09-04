/**
 * @fileoverview Playoff Review Page (`/playoffs`)
 *
 * The operator's end-of-season playoff surface. It deals only in **places**
 * (1st, 2nd, 3rd…) — never team names or standings. Its job is to set the
 * place-based rule (which place plays which place) so the app can pull the right
 * teams from the standings and fill the match records when the season ends.
 *
 * Three states (place-slots only):
 * - **no-playoffs** — no playoff week scheduled = this league doesn't run
 *   playoffs. A calm terminal message, not an error.
 * - **set-up** — playoff week exists, matchups not yet populated. Shows the
 *   place-rule (editable) + a status line. When the season completes, the
 *   matchups fill in automatically (one-shot); a manual override is available.
 * - **locked** — matchups populated (teams filled in). Read-only place-rule +
 *   "view matchups" + a deliberate Reset.
 *
 * The actual filled-in matchups (with real teams) live on the schedule, not here.
 *
 * @see docs/plans/2026-06-12-002-feat-playoff-review-page-plan.md
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { Trophy, AlertCircle, Check, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { InfoButton } from '@/components/InfoButton';
import { PlayoffTemplateSelector } from '@/components/playoff/PlayoffTemplateSelector';
import { PlayoffMatchRulesCard } from '@/components/playoff/PlayoffMatchRulesCard';
import { PlayoffSettingsCard } from '@/components/playoff/PlayoffSettingsCard';
import { PlayoffBracketPreviewCard } from '@/components/playoff/PlayoffBracketPreviewCard';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { parseLocalDate } from '@/utils/formatters';
import { useSeasonById, useLeagueById } from '@/api/hooks';
import { useTeamsBySeason } from '@/api/hooks/useTeams';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useSavePlayoffConfiguration } from '@/api/mutations/playoffConfigurations';
import {
  useResolvedPlayoffConfig,
  type PlayoffConfiguration,
} from '@/api/hooks/usePlayoffConfigurations';
import {
  usePlayoffSettingsReducer,
  calculateQualifyingTeams,
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
  arePlayoffMatchupsPopulated,
  resetPlayoffMatchups,
} from '@/utils/playoffGenerator';
import { logger } from '@/utils/logger';

type PlayoffState = 'loading' | 'no-playoffs' | 'set-up' | 'locked';

type PlayoffWeek = { id: string; scheduled_date: string; week_name: string };
type SeasonStatus = {
  isComplete: boolean;
  totalMatches: number;
  completedMatches: number;
  remainingMatches: number;
};

/**
 * PlayoffSetup — the review-first, place-only playoff page.
 */
export const PlayoffSetup: React.FC = () => {
  const { leagueId, seasonId } = useParams<{ leagueId: string; seasonId: string }>();
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Reference data (names + team count). None of this renders team names in the
  // bracket — the count drives how many place-slots to show.
  const { data: season } = useSeasonById(seasonId);
  const { data: league } = useLeagueById(leagueId);
  const { data: teams } = useTeamsBySeason(seasonId);
  const orgId = league?.organization_id;
  const teamCount = teams?.length ?? 0;

  // Resolved playoff config (league → org → global). This is the inherited,
  // set-once setup; the page never re-asks for it.
  const { data: resolvedConfig } = useResolvedPlayoffConfig(leagueId);

  // Reducer drives the editable place-rule + format controls.
  const [settings, dispatch] = usePlayoffSettingsReducer();
  const saveConfigMutation = useSavePlayoffConfiguration();

  // Lifecycle signals (loaded on mount, re-derived after populate/reset).
  const [playoffWeek, setPlayoffWeek] = useState<PlayoffWeek | null>(null);
  const [seasonStatus, setSeasonStatus] = useState<SeasonStatus | null>(null);
  const [populated, setPopulated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // populate / reset in flight
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  const hasLoadedInitialConfig = useRef(false);
  const autoPopulateAttempted = useRef(false);

  // Load config into the reducer once (for the editable place-rule + format).
  useEffect(() => {
    if (hasLoadedInitialConfig.current || !resolvedConfig) return;
    hasLoadedInitialConfig.current = true;

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
    setConfigLoaded(true);
  }, [resolvedConfig, dispatch]);

  // Load the lifecycle signals on mount.
  useEffect(() => {
    async function load() {
      if (!seasonId) return;
      setLoading(true);
      try {
        const week = await getPlayoffWeek(seasonId);
        setPlayoffWeek(week);
        if (week) {
          setSeasonStatus(await checkRegularSeasonComplete(seasonId));
          setPopulated(await arePlayoffMatchupsPopulated(week.id));
        }
      } catch (err) {
        logger.error('Error loading playoff state', {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [seasonId]);

  // Derived state machine.
  const playoffState: PlayoffState = loading
    ? 'loading'
    : !playoffWeek
      ? 'no-playoffs'
      : populated
        ? 'locked'
        : 'set-up';

  // Block navigation only when there are genuine unsaved edits.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    settings.isModified && currentLocation.pathname !== nextLocation.pathname,
  );

  /**
   * Build the bracket on demand (honoring the SAVED configured style) and
   * populate the placeholder match records. Shared by auto + manual fill-in.
   * Gated on season-complete so it never seeds off partial standings.
   */
  async function runPopulate() {
    if (!seasonId || !playoffWeek || !resolvedConfig) return;
    if (!seasonStatus?.isComplete) return;

    setBusy(true);
    setError(null);
    try {
      const style = resolvedConfig.week_matchup_styles?.[0] as MatchupStyle | undefined;
      const result = await generatePlayoffBracket(seasonId, playoffWeek.id, style);
      if (!result.success || !result.bracket) {
        setError(result.error || 'Could not build the playoff bracket yet.');
        return;
      }
      const pop = await populatePlayoffMatches(result.bracket);
      if (!pop.success) {
        setError(pop.error || 'Could not set the playoff matchups.');
        return;
      }
      setPopulated(true); // re-derive in place → locked
    } finally {
      setBusy(false);
    }
  }

  // Interim auto-populate: fire once when the season is complete (no LO action).
  useEffect(() => {
    if (autoPopulateAttempted.current) return;
    if (playoffState !== 'set-up') return;
    if (!seasonStatus?.isComplete || !resolvedConfig || !playoffWeek) return;
    autoPopulateAttempted.current = true;
    void runPopulate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playoffState, seasonStatus, resolvedConfig, playoffWeek]);

  /** Deliberate redo: null the team IDs (rows preserved) → back to set-up. */
  async function handleReset() {
    if (!seasonId || !playoffWeek) return;
    const ok = await confirm({
      title: 'Reset playoff matchups?',
      message:
        'Teams can already see these matchups. Resetting clears them so they can be set again from the standings.',
      confirmText: 'Reset matchups',
      confirmVariant: 'destructive',
    });
    if (!ok) return;

    const result = await resetPlayoffMatchups(seasonId, playoffWeek.id);
    if (result.success) {
      setPopulated(false); // re-derive → set-up (auto stays disabled; use manual)
      setError(null);
    } else {
      setError(result.error || 'Could not reset the matchups.');
    }
  }

  // Format / place-rule editing handlers.
  const handleTemplateSelect = (template: PlayoffConfiguration) => {
    dispatch({ type: 'SET_SELECTED_TEMPLATE_ID', payload: template.id });
    dispatch({ type: 'LOAD_SETTINGS', payload: buildLoadSettingsPayload(template) });
  };
  const handleMatchupStyleChange = (weekIndex: number, style: MatchupStyle) => {
    dispatch({ type: 'SET_WEEK_MATCHUP_STYLE', payload: { weekIndex, style } });
  };
  const handleSave = () => {
    if (!leagueId || !settings.configName.trim()) return;
    saveConfigMutation.mutate(buildSavePayload('league', leagueId, settings), {
      onSuccess: (data) => {
        toast.success('Playoff setup saved');
        dispatch({ type: 'LOAD_SETTINGS', payload: buildPostSavePayload(data) });
      },
      onError: (err: Error) => {
        toast.error('Failed to save playoff setup');
        logger.error('Playoff config save error', { error: err.message });
      },
    });
  };

  const seasonName = season?.season_name || 'Season';
  const bracketSize = configLoaded ? calculateQualifyingTeams(teamCount, settings) : 0;
  const weekStyle = settings.weekMatchupStyles[0] ?? 'seeded';

  return (
    <div className="min-h-screen bg-muted">
      <UnsavedChangesDialog blocker={blocker} />

      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back to League"
        title={
          <span className="inline-flex items-center gap-2">
            Playoffs
            <InfoButton title="Playoffs">
              <p>
                Set how this season's playoffs work — which place plays which place.
                When the regular season ends, the app fills in the real matchups
                from the final standings using this setup.
              </p>
            </InfoButton>
          </span>
        }
        subtitle={seasonName}
      />

      <div className="container mx-auto px-4 max-w-4xl py-8 space-y-6">
        {error && (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="text-sm text-foreground">{error}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {playoffState === 'loading' && (
          <div className="text-center text-muted-foreground">Loading playoffs…</div>
        )}

        {/* No playoffs — settled terminal state, not an error. */}
        {playoffState === 'no-playoffs' && (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <Trophy className="h-8 w-8 text-muted-foreground mx-auto" />
              <div className="font-medium text-foreground">This league doesn't run playoffs</div>
              <div className="text-sm text-muted-foreground">
                There's no playoff week on the schedule for this season.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Locked — matchups are set. Read-only place-rule + view on the matchups page. */}
        {playoffState === 'locked' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="h-5 w-5 text-success" />
                Matchups are set
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground">
                The playoff matchups have been filled in from the final standings and
                are visible to teams. View them on the matchups page.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="default"
                  loadingText="none"
                  onClick={() => navigate(`/league/${leagueId}/season/${seasonId}/matchups`)}
                >
                  View matchups
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Reset matchups
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Set-up — editable place-rule + status + fill-in. */}
        {playoffState === 'set-up' && (
          <>
            <PlayoffMatchRulesCard />

            {/* Status line: when does it fill in? */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm">
                    {playoffWeek && (
                      <span className="font-medium text-foreground">
                        {playoffWeek.week_name}:{' '}
                        {parseLocalDate(playoffWeek.scheduled_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {'. '}
                      </span>
                    )}
                    {seasonStatus?.isComplete ? (
                      <span className="text-foreground">
                        Regular season complete — setting the matchups…
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Fills in automatically once all regular-season matches are complete
                        {seasonStatus
                          ? ` (${seasonStatus.completedMatches} of ${seasonStatus.totalMatches} played).`
                          : '.'}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* The place-rule (editable) — places only, never team names. */}
            {configLoaded && bracketSize >= 2 && (
              <PlayoffBracketPreviewCard
                weekNum={1}
                weekIndex={0}
                matchupStyle={weekStyle}
                bracketSize={bracketSize}
                totalTeams={teamCount}
                qualificationType={settings.qualificationType}
                qualifyingPercentage={settings.qualifyingPercentage}
                wildcardSpots={settings.wildcardSpots}
                onMatchupStyleChange={handleMatchupStyleChange}
              />
            )}

            {/* Manual fill-in override (gated on season-complete). */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={runPopulate}
                isLoading={busy}
                loadingText="Setting matchups…"
                disabled={busy || !seasonStatus?.isComplete}
              >
                {seasonStatus?.isComplete ? 'Set matchups now' : 'Available when the season ends'}
              </Button>
              {settings.isModified && (
                <Button
                  variant="outline"
                  onClick={handleSave}
                  isLoading={saveConfigMutation.isPending}
                  loadingText="Saving…"
                >
                  Save playoff setup
                </Button>
              )}
            </div>

            {/* Tucked-away format edit (collapsed by default). */}
            <Card>
              <Button
                variant="ghost"
                onClick={() => setIsEditOpen((v) => !v)}
                className="w-full flex items-center justify-between p-4 h-auto font-medium"
              >
                <span className="text-foreground">Edit playoff format</span>
                {isEditOpen ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>
              {isEditOpen && (
                <CardContent className="space-y-6 pt-0">
                  <PlayoffTemplateSelector
                    context="league"
                    organizationId={orgId}
                    leagueId={leagueId}
                    selectedTemplateId={settings.selectedTemplateId}
                    isModified={settings.isModified}
                    configName={settings.configName}
                    configDescription={settings.configDescription}
                    onTemplateSelect={handleTemplateSelect}
                    onNameChange={(name) => dispatch({ type: 'SET_CONFIG_NAME', payload: name })}
                    onDescriptionChange={(desc) =>
                      dispatch({ type: 'SET_CONFIG_DESCRIPTION', payload: desc })
                    }
                    onSave={handleSave}
                    isSaving={saveConfigMutation.isPending}
                  />
                  <PlayoffSettingsCard settings={settings} dispatch={dispatch} />
                </CardContent>
              )}
            </Card>
          </>
        )}
      </div>

      {ConfirmDialogComponent}
    </div>
  );
};

export default PlayoffSetup;
