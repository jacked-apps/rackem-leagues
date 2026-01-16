/**
 * @fileoverview Match Data Page for League Operators
 *
 * Full match editing page where operators can view and modify all match data
 * including lineups, thresholds, games, and results. This is NOT the player
 * scoring page - it's a simpler, more direct editing interface for operators.
 *
 * Key Features:
 * - Match navigation bar for quick switching between week matches
 * - Lineups section with flexible player counts (3-6) and handicap systems
 * - Thresholds section with auto-generation for supported formats
 * - Games section with round robin generation or custom game creation
 * - Match result section with winner determination and points
 * - Batch save (no auto-save, no real-time)
 *
 * State Management:
 * - Uses useMatchEditorState hook for all page state (useReducer)
 * - UI-first approach: state is local until save
 * - Everything is editable - auto-calculated values can be overridden
 *
 * Route: /league/:leagueId/season/:seasonId/match/:matchId
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMatchById, useMatchLineups, useMatchGames, useMatchWithLeagueSettings } from '@/api/hooks/useMatches';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { parseLocalDate } from '@/utils/formatters';
import {
  MatchNavigationBar,
  LineupsSection,
  ThresholdsSection,
  GamesSection,
  MatchResultSection,
  useMatchEditorState,
  SetupOptions,
  type HandicapType,
  type SetupOptionsConfig,
  type RoundRobinType,
  type ThresholdMode,
} from '@/components/operator/match-editor';

/**
 * Determine the default handicap type from league settings
 */
function getDefaultHandicapType(leagueHandicapVariant?: string): HandicapType {
  if (leagueHandicapVariant === 'percentage') return 'percentage';
  if (leagueHandicapVariant === 'points' || leagueHandicapVariant === 'standard') return 'points';
  return 'custom';
}

/**
 * Get default lineup size from team format
 */
function getDefaultLineupSize(teamFormat?: '5_man' | '8_man'): number {
  // 5_man format = 3v3 matches, 8_man format = 5v5 matches
  return teamFormat === '8_man' ? 5 : 3;
}

/**
 * Match Data Page Component
 *
 * Orchestrates all match editing sections using the useMatchEditorState hook.
 * Data flows: Fetch → Initialize State → Edit → Batch Save
 */
export default function MatchDataPage() {
  const { leagueId, seasonId, matchId } = useParams<{
    leagueId: string;
    seasonId: string;
    matchId: string;
  }>();

  // Fetch match details with league settings
  const { data: match, isLoading: isMatchLoading, error: matchError } = useMatchById(matchId);
  const { data: matchWithSettings, isLoading: isSettingsLoading } = useMatchWithLeagueSettings(matchId);

  // Fetch lineups (don't require locked - operators can edit unlocked)
  const { data: lineups, isLoading: isLineupsLoading } = useMatchLineups(
    matchId,
    match?.home_team_id,
    match?.away_team_id,
    false // Don't require locked
  );

  // Fetch games
  const { data: games = [], isLoading: isGamesLoading } = useMatchGames(matchId);

  // Combined loading state
  const isLoading = isMatchLoading || isSettingsLoading || isLineupsLoading || isGamesLoading;

  // Get team names (fallback if loading)
  const homeTeamName = match?.home_team?.team_name || 'Home Team';
  const awayTeamName = match?.away_team?.team_name || 'Away Team';
  const matchTitle = match ? `${homeTeamName} vs ${awayTeamName}` : 'Loading...';

  // Initialize the editor state hook
  // Note: We initialize with defaults first, then sync from fetched data
  const { state, actions, computed } = useMatchEditorState({
    matchId: matchId || '',
    homeTeamId: match?.home_team_id || '',
    awayTeamId: match?.away_team_id || '',
    homeTeamName,
    awayTeamName,
    defaultLineupSize: getDefaultLineupSize(matchWithSettings?.league?.team_format),
    defaultHandicapType: getDefaultHandicapType(matchWithSettings?.league?.handicap_variant),
    existingThresholds: {
      homeWin: match?.home_games_to_win ?? null,
      homeTie: match?.home_games_to_tie ?? null,
      awayWin: match?.away_games_to_win ?? null,
      awayTie: match?.away_games_to_tie ?? null,
    },
  });

  // Threshold mode state (team/player/off) - will be saved to DB later
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>('team');
  const [savedSetupOptions, setSavedSetupOptions] = useState<boolean>(false);
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  /**
   * Map editor gameGeneration to SetupOptions roundRobinType
   */
  const mapGameGenerationToRoundRobin = (gen: string): RoundRobinType => {
    switch (gen) {
      case 'double_rr': return 'double';
      case 'single_rr': return 'single';
      case 'manual': return 'custom';
      default: return 'double';
    }
  };

  /**
   * Map SetupOptions roundRobinType to editor gameGeneration
   */
  const mapRoundRobinToGameGeneration = (rr: RoundRobinType): 'double_rr' | 'single_rr' | 'manual' => {
    switch (rr) {
      case 'double': return 'double_rr';
      case 'single': return 'single_rr';
      case 'custom': return 'manual';
      default: return 'double_rr';
    }
  };

  /**
   * Derive SetupOptionsConfig from editor state
   */
  const setupConfig: SetupOptionsConfig = useMemo(() => ({
    lineupSize: state.formatConfig.lineupSize,
    handicapType: state.formatConfig.handicapType === 'custom' ? 'points' : state.formatConfig.handicapType,
    thresholdMode: thresholdMode,
    roundRobinType: mapGameGenerationToRoundRobin(state.formatConfig.gameGeneration),
  }), [state.formatConfig.lineupSize, state.formatConfig.handicapType, state.formatConfig.gameGeneration, thresholdMode]);

  /**
   * Handle SetupOptions changes - sync back to editor state
   */
  const handleSetupChange = useCallback((newConfig: SetupOptionsConfig) => {
    // Update lineup size if changed
    if (newConfig.lineupSize !== state.formatConfig.lineupSize) {
      actions.setLineupSize(newConfig.lineupSize);
    }

    // Update handicap type if changed
    if (newConfig.handicapType !== state.formatConfig.handicapType) {
      actions.setHandicapType(newConfig.handicapType);
    }

    // Update game generation if round robin type changed
    const newGameGen = mapRoundRobinToGameGeneration(newConfig.roundRobinType);
    if (newGameGen !== state.formatConfig.gameGeneration) {
      actions.setGameGeneration(newGameGen);
    }

    // Update threshold mode (local state for now)
    if (newConfig.thresholdMode !== thresholdMode) {
      setThresholdMode(newConfig.thresholdMode);
    }
  }, [state.formatConfig, actions, thresholdMode]);

  /**
   * Handle saving setup options (mock for now - will save to DB later)
   */
  const handleSaveSetup = useCallback(async () => {
    setIsSavingSetup(true);
    try {
      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 300));
      setSavedSetupOptions(true);

      if (import.meta.env.DEV) {
        console.log('Saved setup options:', setupConfig);
      }
    } catch (error) {
      console.error('Failed to save setup options:', error);
    } finally {
      setIsSavingSetup(false);
    }
  }, [setupConfig]);

  // Sync existing thresholds when match data loads
  useEffect(() => {
    if (match && !state.isDirty) {
      const existingThresholds = {
        homeWin: match.home_games_to_win ?? null,
        homeTie: match.home_games_to_tie ?? null,
        awayWin: match.away_games_to_win ?? null,
        awayTie: match.away_games_to_tie ?? null,
      };

      // Only update if thresholds are different
      if (
        existingThresholds.homeWin !== state.thresholds.homeWin ||
        existingThresholds.homeTie !== state.thresholds.homeTie ||
        existingThresholds.awayWin !== state.thresholds.awayWin ||
        existingThresholds.awayTie !== state.thresholds.awayTie
      ) {
        actions.setThresholds(existingThresholds);
        actions.markClean(); // Don't mark as dirty from initial sync
      }
    }
  }, [match, state.isDirty, state.thresholds, actions]);

  // Restore saved state from localStorage on mount (for mock save persistence)
  useEffect(() => {
    if (!matchId || state.isDirty) return;

    const storageKey = `match_editor_${matchId}`;
    const savedData = localStorage.getItem(storageKey);

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);

        // Restore lineups if they have players
        if (parsed.homeLineup?.players?.length > 0) {
          actions.setLineupSize(parsed.formatConfig.lineupSize);
          actions.setHandicapType(parsed.formatConfig.handicapType);

          // Restore individual player data
          parsed.homeLineup.players.forEach((player: any) => {
            if (player.playerId) {
              actions.setPlayer('home', player.position, player.playerId, player.playerName);
              actions.setPlayerHandicap('home', player.position, player.handicap);
            }
          });
          parsed.awayLineup.players.forEach((player: any) => {
            if (player.playerId) {
              actions.setPlayer('away', player.position, player.playerId, player.playerName);
              actions.setPlayerHandicap('away', player.position, player.handicap);
            }
          });
        }

        // Restore thresholds
        if (parsed.thresholds) {
          actions.setThresholds(parsed.thresholds);
        }

        // Restore games
        if (parsed.games?.length > 0) {
          actions.addGames(parsed.games);
        }

        // Restore result
        if (parsed.result) {
          actions.setResult(parsed.result);
        }

        // Mark clean since this is restoration, not user edits
        actions.markClean();

        if (import.meta.env.DEV) {
          console.log('Restored match data from localStorage:', storageKey, parsed);
        }
      } catch (error) {
        console.warn('Failed to restore match data from localStorage:', error);
      }
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // Format date for display
  const formattedDate = match?.season_week?.scheduled_date
    ? parseLocalDate(match.season_week.scheduled_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  // Get status display
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'completed':
        return { text: 'Completed', className: 'bg-green-100 text-green-700' };
      case 'in_progress':
        return { text: 'In Progress', className: 'bg-blue-100 text-blue-700' };
      case 'awaiting_verification':
        return { text: 'Awaiting Verification', className: 'bg-yellow-100 text-yellow-700' };
      default:
        return { text: 'Scheduled', className: 'bg-gray-100 text-gray-600' };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={`/league/${leagueId}/season/${seasonId}/match-list`}
          backLabel="Back to Match List"
          title="Loading..."
        />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-gray-600">Loading match data...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (matchError || !match) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader
          backTo={`/league/${leagueId}/season/${seasonId}/match-list`}
          backLabel="Back to Match List"
          title="Error"
        />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-red-600">
                {matchError ? `Error loading match: ${(matchError as Error).message}` : 'Match not found'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const status = getStatusDisplay(match.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <PageHeader
        backTo={`/league/${leagueId}/season/${seasonId}/match-list`}
        backLabel="Back to Match List"
        title={matchTitle}
        subtitle={`${match.season_week?.week_name || 'Week'} • ${formattedDate}`}
      >
        <span className={`inline-block text-sm px-3 py-1 rounded-full mt-2 ${status.className}`}>
          {status.text}
        </span>
      </PageHeader>

      <div className="container mx-auto px-4 py-4 max-w-4xl space-y-4">
        {/* Match Navigation Bar */}
        {match.season_week_id && leagueId && seasonId && (
          <Card>
            <CardContent className="py-2">
              <MatchNavigationBar
                seasonWeekId={match.season_week_id}
                currentMatchId={matchId!}
                leagueId={leagueId}
                seasonId={seasonId}
                hasUnsavedChanges={state.isDirty}
              />
            </CardContent>
          </Card>
        )}

        {/* Setup Options - unified settings for lineup size, handicap type, etc. */}
        <SetupOptions
          config={setupConfig}
          onChange={handleSetupChange}
          onSave={handleSaveSetup}
          isSaving={isSavingSetup}
          hasSavedOptions={savedSetupOptions}
          defaultExpanded={!savedSetupOptions}
        />

        {/* Lineups Section */}
        <LineupsSection
          homeTeamId={match.home_team_id || ''}
          awayTeamId={match.away_team_id || ''}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          matchId={matchId}
          homeLineup={lineups?.homeLineup}
          awayLineup={lineups?.awayLineup}
          leagueSettings={matchWithSettings?.league}
          editorState={state}
          editorActions={actions}
        />

        {/* Thresholds Section */}
        <ThresholdsSection
          leagueId={leagueId}
          homeThresholds={{
            win: state.thresholds.homeWin,
            tie: state.thresholds.homeTie,
          }}
          awayThresholds={{
            win: state.thresholds.awayWin,
            tie: state.thresholds.awayTie,
          }}
          leagueSettings={matchWithSettings?.league}
          playerCount={state.formatConfig.lineupSize}
          editorState={state}
          editorActions={actions}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
        />

        {/* Games Section */}
        <GamesSection
          matchId={matchId!}
          games={games}
          homeLineup={lineups?.homeLineup}
          awayLineup={lineups?.awayLineup}
          homeTeamId={match.home_team_id || ''}
          awayTeamId={match.away_team_id || ''}
          editorState={state}
          editorActions={actions}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
        />

        {/* Match Result Section */}
        <MatchResultSection
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          editorState={state}
          editorActions={actions}
        />

        {/* Debug: Show current state (development only) */}
        {import.meta.env.DEV && (
          <Card className="bg-gray-100 border-dashed">
            <CardContent className="py-4">
              <details>
                <summary className="cursor-pointer text-sm text-gray-500 font-medium">
                  Debug: Editor State
                </summary>
                <pre className="mt-2 text-xs overflow-auto max-h-60 bg-white p-2 rounded">
                  {JSON.stringify({
                    formatConfig: state.formatConfig,
                    thresholds: state.thresholds,
                    result: state.result,
                    gamesCount: state.games.length,
                    isDirty: state.isDirty,
                    computed,
                  }, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
