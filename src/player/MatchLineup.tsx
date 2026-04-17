/**
 * @fileoverview Match Lineup Page
 *
 * Mobile-first lineup selection page where players choose their lineup
 * before starting a match. Supports both 3v3 (3 players) and 5v5 (5 players)
 * formats. Shows player handicaps and calculates team total.
 *
 * Flow: Team Schedule → Score Match → Lineup Entry
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users } from 'lucide-react';
import {
  useCurrentMember,
  useMatchWithLeagueSettings,
  useMatchLineups,
  useUserTeamInMatch,
  useTeamDetails,
  useUpdateMatchLineup,
  useMatchGames,
} from '@/api/hooks';
import { useUpdateMatchGame } from '@/api/hooks/useMatchMutations';
import { usePlayerHandicaps } from '@/api/hooks/usePlayerHandicaps';
import type { Player } from '@/types/match';
import { MatchInfoCard } from '@/components/lineup/MatchInfoCard';
import { PlayerRoster } from '@/components/PlayerRoster';
import { LineupActions } from '@/components/lineup/LineupActions';
import { HandicapSummary } from '@/components/lineup/HandicapSummary';
import { DuplicateNicknameWarning } from '@/components/lineup/DuplicateNicknameWarning';
import { PlayerSelectionRow } from '@/components/lineup/PlayerSelectionRow';
import { OpponentSubstituteModal } from '@/components/lineup/OpponentSubstituteModal';
import { useQueryStates } from '@/hooks/useQueryStates';
import {
  useLineupState,
  useHandicapCalculations,
  useLineupValidation,
  useLineupPersistence,
  useMatchPreparation,
  useOpponentStatus,
  useTiebreakerLineup,
} from '@/hooks/lineup';
import { usePreparationStatus } from '@/hooks/lineup/useMatchPreparation';
import { calculateSubstituteHandicap } from '@/utils/lineup';
import { useMatchRealtime } from '@/realtime/useMatchRealtime';
import { Loader2 } from 'lucide-react';
import { getPlayerCount } from '@/utils/lineup/getPlayerCount';
import { shouldUseTeamBonus } from '@/utils/calculateHandicapThresholds';
import { logger } from '@/utils/logger';

// Special substitute member IDs
const SUB_HOME_ID = '00000000-0000-0000-0000-000000000001';
const SUB_AWAY_ID = '00000000-0000-0000-0000-000000000002';

export function MatchLineup() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  // TanStack Query: Get current member data
  const memberQuery = useCurrentMember();
  const member = memberQuery.data;
  const memberId = member?.id;

  // TanStack Query: Get match data with league settings
  const matchQuery = useMatchWithLeagueSettings(matchId);
  const matchData = matchQuery.data;

  // TanStack Query: Get lineups (both home and away)
  // Lineups are auto-created by database trigger, so they always exist (may be unlocked)
  const lineupsQuery = useMatchLineups(
    matchId,
    matchData?.home_team_id,
    matchData?.away_team_id,
    false // requireLocked: false - lineups exist but may not be locked yet
  );

  // TanStack Query: Determine which team user is on
  const userTeamQuery = useUserTeamInMatch(
    memberId,
    matchData?.home_team_id,
    matchData?.away_team_id
  );
  const userTeamData = userTeamQuery.data;

  // Derive team info early for next query
  const userTeamId = userTeamData?.team_id;

  // TanStack Query: Get team roster with member details
  const teamDetailsQuery = useTeamDetails(userTeamId);

  // TanStack Query: Get opponent team roster (needed for 5v5 substitute modal)
  const opponentTeamId = userTeamData?.isHomeTeam ? matchData?.away_team_id : matchData?.home_team_id;
  const opponentTeamDetailsQuery = useTeamDetails(opponentTeamId);

  // Unified query state handling - consolidates loading/error checks
  const { renderState } = useQueryStates([
    { query: memberQuery, name: 'member' },
    { query: matchQuery, name: 'match' },
    { query: lineupsQuery, name: 'lineups' }, // Auto-created by DB trigger
    { query: userTeamQuery, name: 'user team' },
    { query: teamDetailsQuery, name: 'team details' },
    { query: opponentTeamDetailsQuery, name: 'opponent team details' },
  ]);

  // Note: Mutation hooks (useUpdateMatch, useUpdateMatchLineup) are now used inside hooks

  // Preparation status for loading screen
  const {
    isPreparingMatch,
    setIsPreparingMatch,
    preparationMessage,
    setPreparationMessage,
  } = usePreparationStatus();

  // Determine player count from team format (3 for 3v3, 5 for 5v5)
  // TODO: read lineup_size from resolved prefs instead of deriving from team_format
  const teamFormat = (matchData?.league?.team_format || '5_man') as '5_man' | '8_man';
  const playerCount = getPlayerCount(teamFormat);

  // Fetch resolved preferences to get the actual handicap_type for this league
  const leagueId = matchData?.league?.id;
  const { data: resolvedPrefs } = useQuery({
    queryKey: ['resolved-league-preferences', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resolved_league_preferences')
        .select('handicap_type')
        .eq('league_id', leagueId!)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!leagueId,
  });
  const handicapType = resolvedPrefs?.handicap_type ?? 'points';

  // Centralized lineup state management
  const lineup = useLineupState(playerCount);

  // Get update mutation for direct dropdown saves
  const updateLineupMutation = useUpdateMatchLineup();

  // Fetch all match games (for tiebreaker mode)
  const matchGamesQuery = useMatchGames(matchId);
  const allGames = matchGamesQuery.data || [];

  // Get update game mutation (for tiebreaker mode)
  const updateGameMutation = useUpdateMatchGame(matchId || '');

  // Extract players from team details query
  const playersWithoutHandicaps: Omit<Player, 'handicap'>[] =
    teamDetailsQuery.data?.team_players?.map((tp: any) => ({
      id: tp.members.id,
      nickname: tp.members.nickname,
      first_name: tp.members.first_name,
      last_name: tp.members.last_name,
    })) || [];

  // Get calculated handicaps for all roster players
  // Uses matchId for per-match caching - handicaps are calculated once per match and cached forever
  const { handicaps: playerHandicaps } = usePlayerHandicaps({
    playerIds: playersWithoutHandicaps.map(p => p.id),
    handicapType,
    handicapVariant: (matchData?.league?.handicap_variant || 'standard') as 'standard' | 'reduced' | 'none',
    gameType: matchData?.league?.game_type as 'eight_ball' | 'nine_ball' | 'ten_ball',
    leagueId: matchData?.league?.id,
    gameLimit: 200,
    matchId: matchId, // Per-match cache scoping
  });

  // Merge players with their calculated handicaps
  const players: Player[] = playersWithoutHandicaps.map(p => ({
    ...p,
    handicap: playerHandicaps.get(p.id)?.value ?? 0,
  }));

  // Extract opponent players from opponent team details query
  const opponentPlayersWithoutHandicaps: Omit<Player, 'handicap'>[] =
    opponentTeamDetailsQuery.data?.team_players?.map((tp: any) => ({
      id: tp.members.id,
      nickname: tp.members.nickname,
      first_name: tp.members.first_name,
      last_name: tp.members.last_name,
    })) || [];

  // Get calculated handicaps for opponent roster players
  // Uses matchId for per-match caching - handicaps are calculated once per match and cached forever
  const { handicaps: opponentPlayerHandicaps } = usePlayerHandicaps({
    playerIds: opponentPlayersWithoutHandicaps.map(p => p.id),
    handicapType,
    handicapVariant: (matchData?.league?.handicap_variant || 'standard') as 'standard' | 'reduced' | 'none',
    gameType: matchData?.league?.game_type as 'eight_ball' | 'nine_ball' | 'ten_ball',
    leagueId: matchData?.league?.id,
    gameLimit: 200,
    matchId: matchId, // Per-match cache scoping
  });

  // Merge opponent players with their calculated handicaps
  const opponentPlayers: Player[] = opponentPlayersWithoutHandicaps.map(p => ({
    ...p,
    handicap: opponentPlayerHandicaps.get(p.id)?.value ?? 0,
  }));

  // Team handicap bonus (only for 3v3, only for home team)
  // 5v5 does not use team bonus - it's disabled by default
  const useTeamBonus = shouldUseTeamBonus(teamFormat);
  const [teamHandicap, setTeamHandicap] = useState<number>(0);

  // Calculate team handicap bonus based on season standings
  useEffect(() => {
    if (!matchData?.home_team_id || !matchData?.away_team_id || !matchData?.season_id || !useTeamBonus) {
      setTeamHandicap(0);
      return;
    }

    const fetchTeamHandicap = async () => {
      const { calculateTeamHandicap } = await import('@/utils/handicapCalculations');

      // Use team_handicap_variant if set, otherwise fall back to main handicap_variant
      // This gives operators fine-grained control: they can override team bonus separately if needed
      const teamHandicapVariant = (
        matchData?.league?.team_handicap_variant ||
        matchData?.league?.handicap_variant ||
        'standard'
      ) as 'standard' | 'reduced' | 'none';

      const bonus = await calculateTeamHandicap(
        matchData.home_team_id,
        matchData.away_team_id,
        matchData.season_id,
        teamHandicapVariant
      );

      setTeamHandicap(bonus);
    };

    void fetchTeamHandicap();
  }, [matchData?.home_team_id, matchData?.away_team_id, matchData?.season_id, matchData?.league?.team_handicap_variant, matchData?.league?.handicap_variant, useTeamBonus]);

  // Derive values (safe to use optional chaining since hooks are called)
  const isHomeTeam = userTeamData?.isHomeTeam || false;

  // Get opponent lineup from query (updates in real-time)
  const opponentLineup = isHomeTeam
    ? lineupsQuery.data?.awayLineup
    : lineupsQuery.data?.homeLineup;

  // Detect tiebreaker mode
  const isTiebreakerMode = matchData?.match_result === 'tie';

  // Tiebreaker lineup management (for best-of-3 games 19-21)
  const {
    getTiebreakerPlayerIdByPosition,
    handleTiebreakerPlayerChange,
    handleClearTiebreakerPlayer,
  } = useTiebreakerLineup({
    allGames,
    isHomeTeam,
    matchId,
    setPlayer1Id: lineup.setPlayer1Id,
    setPlayer2Id: lineup.setPlayer2Id,
    setPlayer3Id: lineup.setPlayer3Id,
    updateGameMutation: updateGameMutation,
  });

  // In tiebreaker mode, use game records for validation; otherwise use lineup state
  const validationPlayer1Id = isTiebreakerMode ? getTiebreakerPlayerIdByPosition(1) : lineup.player1Id;
  const validationPlayer2Id = isTiebreakerMode ? getTiebreakerPlayerIdByPosition(2) : lineup.player2Id;
  const validationPlayer3Id = isTiebreakerMode ? getTiebreakerPlayerIdByPosition(3) : lineup.player3Id;

  // Handicap calculations
  const handicaps = useHandicapCalculations({
    player1Id: lineup.player1Id,
    player2Id: lineup.player2Id,
    player3Id: lineup.player3Id,
    player4Id: lineup.player4Id,
    player5Id: lineup.player5Id,
    playerCount,
    subHandicap: lineup.subHandicap,
    testMode: lineup.testMode,
    testHandicaps: lineup.testHandicaps,
    players,
    teamHandicap,
    isHomeTeam,
    teamFormat,
  });

  // Lineup validation
  const validation = useLineupValidation({
    player1Id: validationPlayer1Id,
    player2Id: validationPlayer2Id,
    player3Id: validationPlayer3Id,
    player4Id: lineup.player4Id,
    player5Id: lineup.player5Id,
    playerCount,
    subHandicap: lineup.subHandicap,
    players,
    isTiebreakerMode,
    teamFormat,
  });

  // Lineup persistence operations
  const { handleLockLineup, handleUnlockLineup } = useLineupPersistence({
    matchId,
    userTeamId: userTeamData?.team_id,
    memberId,
    lineupId: lineup.lineupId,
    player1Id: lineup.player1Id,
    player2Id: lineup.player2Id,
    player3Id: lineup.player3Id,
    player4Id: lineup.player4Id,
    player5Id: lineup.player5Id,
    player1Handicap: handicaps.player1Handicap,
    player2Handicap: handicaps.player2Handicap,
    player3Handicap: handicaps.player3Handicap,
    player4Handicap: handicaps.player4Handicap,
    player5Handicap: handicaps.player5Handicap,
    playerCount,
    teamHandicap,
    isComplete: validation.isComplete,
    hasDuplicates: validation.hasDuplicates,
    onLineupIdChange: lineup.setLineupId,
    onLockedChange: lineup.setLineupLocked,
    matchData,
    refetchLineups: lineupsQuery.refetch,
  });

  // Note: Lineups are now auto-created by database trigger when match is inserted
  // See migration: 20251115000000_auto_create_match_lineups.sql

  // Match preparation and auto-navigation
  useMatchPreparation({
    lineupLocked: lineup.lineupLocked,
    opponentLineup,
    matchId,
    matchData,
    isHomeTeam,
    teamFormat,
    player1Id: lineup.player1Id,
    player2Id: lineup.player2Id,
    player3Id: lineup.player3Id,
    player1Handicap: handicaps.player1Handicap,
    player2Handicap: handicaps.player2Handicap,
    player3Handicap: handicaps.player3Handicap,
    // 5v5 support (backward compatible - undefined for 3v3)
    player4Id: lineup.player4Id,
    player5Id: lineup.player5Id,
    player4Handicap: handicaps.player4Handicap,
    player5Handicap: handicaps.player5Handicap,
    setIsPreparingMatch,
    setPreparationMessage,
    refetchLineups: lineupsQuery.refetch,
    refetchGames: matchGamesQuery.refetch,
  });

  // Load lineup ID and data from database (auto-created by trigger)
  // This is critical - without the lineup ID, we can't update the lineup
  // Syncs lineup state when database data changes (including real-time updates)
  useEffect(() => {
    if (lineupsQuery.data && userTeamData) {
      const myLineup = isHomeTeam
        ? lineupsQuery.data.homeLineup
        : lineupsQuery.data.awayLineup;

      if (myLineup) {
        // Always update lineup ID (needed for mutations)
        lineup.setLineupId(myLineup.id);

        // Sync player IDs from database when lineup is locked
        // This ensures opponent's double duty choice updates the UI
        if (myLineup.locked) {
          for (let pos = 1; pos <= playerCount; pos++) {
            const playerIdField = `player${pos}_id` as keyof typeof myLineup;
            const dbPlayerId = myLineup[playerIdField] as string | undefined;
            const currentPlayerId = lineup.getPlayerId(pos as 1 | 2 | 3 | 4 | 5);

            // Update if database has different player (e.g., opponent chose double duty)
            if (dbPlayerId && dbPlayerId !== currentPlayerId) {
              lineup.setPlayerId(pos as 1 | 2 | 3 | 4 | 5, dbPlayerId);
            }
          }
        } else {
          // When unlocked, always sync from database (including nulls from duplicate removal)
          for (let pos = 1; pos <= playerCount; pos++) {
            const playerIdField = `player${pos}_id` as keyof typeof myLineup;
            const dbPlayerId = myLineup[playerIdField] as string | undefined;
            const currentPlayerId = lineup.getPlayerId(pos as 1 | 2 | 3 | 4 | 5);

            // Always sync - this handles duplicate removal where DB has null
            if (dbPlayerId !== currentPlayerId) {
              lineup.setPlayerId(pos as 1 | 2 | 3 | 4 | 5, dbPlayerId || '');
            }
          }
        }

        // Always sync locked state from database (source of truth)
        lineup.setLineupLocked(!!myLineup.locked);
      }
    }
    // Include lineupsQuery.data to sync when database updates (real-time)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineupsQuery.data, userTeamData, isHomeTeam]);

  // Unified real-time subscription for match, lineups, and games
  // Watches all three tables throughout entire match flow (lineup + tiebreaker + scoring)
  useMatchRealtime(matchId, {
    onMatchUpdate: () => matchQuery.refetch(),
    onLineupUpdate: () => lineupsQuery.refetch(),
    onGamesUpdate: () => matchGamesQuery.refetch(),
  });

  // 5v5 Substitute Modal State
  const [showOpponentSubModal, setShowOpponentSubModal] = useState(false);

  // Detect if opponent has substitute in their lineup (5v5 only)
  useEffect(() => {
    if (!opponentLineup || !matchData || isTiebreakerMode) {
      setShowOpponentSubModal(false);
      return;
    }

    const is5v5 = (matchData.league?.team_format || '5_man') === '8_man';
    if (!is5v5) {
      setShowOpponentSubModal(false);
      return;
    }

    // Check if opponent's lineup is locked and has a substitute
    if (!opponentLineup.locked) {
      setShowOpponentSubModal(false);
      return;
    }

    // Check all 5 positions for SUB_HOME_ID or SUB_AWAY_ID
    const hasSubstitute = [
      opponentLineup.player1_id,
      opponentLineup.player2_id,
      opponentLineup.player3_id,
      opponentLineup.player4_id,
      opponentLineup.player5_id,
    ].some(id => id === SUB_HOME_ID || id === SUB_AWAY_ID);

    setShowOpponentSubModal(hasSubstitute);
  }, [opponentLineup, matchData, isTiebreakerMode]);

  // Handle opponent substitute choice
  const handleOpponentSubChoice = (playerId: string, handicap: number, subPosition: number) => {
    if (!opponentLineup?.id || !matchId) return;

    // Update opponent's lineup - replace SUB with chosen player
    updateLineupMutation.mutate({
      lineupId: opponentLineup.id,
      updates: {
        [`player${subPosition}_id`]: playerId,
        [`player${subPosition}_handicap`]: handicap,
      },
      matchId,
    }, {
      onSuccess: async () => {
        // Manually refetch lineups to ensure UI updates immediately
        await lineupsQuery.refetch();
        setShowOpponentSubModal(false);
      },
      onError: (error) => {
        logger.error('Failed to update opponent lineup', { error: error instanceof Error ? error.message : String(error) });
      },
    });
  };

  // Generic player change handler - works for any position (3 or 5 players)
  const handlePlayerChange = (position: number, playerId: string) => {
    if (!lineup.lineupId || !matchId) return;

    // Update local state using generic setter
    lineup.setPlayerId(position as 1 | 2 | 3 | 4 | 5, playerId);

    // Get the NEW player's handicap (respects test mode and test handicap overrides)
    const handicap = handicaps.getPlayerHandicap(playerId);

    const updatePayload = {
      lineupId: lineup.lineupId,
      updates: {
        [`player${position}_id`]: playerId,
        [`player${position}_handicap`]: handicap,
      },
      matchId,
    };

    // Update database
    updateLineupMutation.mutate(updatePayload, {
      onSuccess: () => {},
      onError: (error) => {
        logger.error('Database update failed', { error: error instanceof Error ? error.message : String(error) });
      },
    });
  };

  // Clear player handler - remove player from lineup position
  const handleClearPlayer = (position: number) => {
    if (!lineup.lineupId || !matchId) return;

    // Clear local state using generic setter
    lineup.setPlayerId(position as 1 | 2 | 3 | 4 | 5, '');

    // Clear in database
    updateLineupMutation.mutate({
      lineupId: lineup.lineupId,
      updates: {
        [`player${position}_id`]: null,
        [`player${position}_handicap`]: 0,
      },
      matchId,
    });
  };

  // Helper functions to get player data by position (for mapping)
  const getPlayerIdByPosition = (position: number): string => {
    return lineup.getPlayerId(position as 1 | 2 | 3 | 4 | 5);
  };

  const getHandicapByPosition = (position: number): number => {
    switch (position) {
      case 1: return handicaps.player1Handicap;
      case 2: return handicaps.player2Handicap;
      case 3: return handicaps.player3Handicap;
      case 4: return handicaps.player4Handicap || 0;
      case 5: return handicaps.player5Handicap || 0;
      default: return 0;
    }
  };

  const getOtherPlayerIds = (position: number): string[] => {
    const allPlayers = Array.from({ length: playerCount }, (_, i) =>
      lineup.getPlayerId((i + 1) as 1 | 2 | 3 | 4 | 5)
    );
    return allPlayers.filter((_, index) => index + 1 !== position);
  };

  // Get opponent status using custom hook (must be called before any early returns)
  const {
    opponentTeam: opponent,
    status: opponentStatus,
    selectionStatus: opponentSelectionStatus,
  } = useOpponentStatus({
    matchData,
    isHomeTeam,
    opponentLineup,
    isTiebreakerMode,
    allGames,
    playerCount, // Pass player count for 5v5 support
  });

  // Early return for loading/error states - consolidated into single check
  // NOTE: All hooks must be called ABOVE this line to satisfy Rules of Hooks
  if (renderState) return renderState;

  // After renderState check, all data is guaranteed to be defined
  // TypeScript doesn't infer this, so we assert non-null
  const match = matchData!;

  // Get my lineup (for tiebreaker mode player source)
  const myLineup = isHomeTeam
    ? lineupsQuery.data?.homeLineup
    : lineupsQuery.data?.awayLineup;

  // Helper to get player display name
  const getPlayerDisplayName = (playerId: string): string => {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      return player.nickname || `${player.first_name} ${player.last_name}`;
    }
    // For substitutes
    if (playerId === SUB_HOME_ID) return 'Sub (Home)';
    if (playerId === SUB_AWAY_ID) return 'Sub (Away)';
    return 'Unknown';
  };

  // Helper to get opponent player display name (for 5v5 substitute modal)
  const getOpponentPlayerDisplayName = (playerId: string): string => {
    const player = opponentPlayers.find((p) => p.id === playerId);
    if (player) {
      return player.nickname || `${player.first_name} ${player.last_name}`;
    }
    // For substitutes
    if (playerId === SUB_HOME_ID) return 'Sub (Home)';
    if (playerId === SUB_AWAY_ID) return 'Sub (Away)';
    return 'Unknown';
  };

  /**
   * Get available player IDs for dropdown selection
   *
   * In tiebreaker mode: Only players from the original locked lineup
   * In normal mode: All roster players + substitute option
   */
  const getAvailablePlayerIds = (): string[] => {
    if (isTiebreakerMode && myLineup) {
      // Tiebreaker: Only original 3 players can be selected
      return [
        myLineup.player1_id,
        myLineup.player2_id,
        myLineup.player3_id,
      ].filter(Boolean) as string[];
    }

    // Normal mode: All roster players + substitute
    return [
      ...players.map((p) => p.id),
      isHomeTeam ? SUB_HOME_ID : SUB_AWAY_ID,
    ];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <Link
            to={`/team/${userTeamId}/schedule`}
            className="flex items-center gap-2 text-sm text-gray-600 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Schedule
          </Link>
          <div className="text-4xl font-semibold text-gray-900">
            Lineup Entry
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Match Info Card */}
        <MatchInfoCard
          scheduledDate={match.scheduled_date}
          opponent={
            opponent ? { id: opponent.id, name: opponent.team_name } : null
          }
          isHomeTeam={isHomeTeam || false}
          venueId={match.scheduled_venue?.id || null}
          actualVenueId={match.actual_venue?.id || null}
          assignedTableNumber={match.assigned_table_number}
        />

        {/* Lineup Selection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {isTiebreakerMode
                ? 'Select Your Tiebreaker Lineup'
                : 'Select Your Lineup'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Available Players List */}
            <PlayerRoster
              playerIds={
                isTiebreakerMode && myLineup
                  ? [
                      myLineup.player1_id,
                      myLineup.player2_id,
                      myLineup.player3_id,
                    ].filter(Boolean)
                  : players.map((p) => p.id)
              }
              handicapType={handicapType}
              handicapVariant={
                (matchData?.league?.handicap_variant || 'standard') as
                  | 'standard'
                  | 'reduced'
                  | 'none'
              }
              gameType={
                matchData?.league?.game_type as
                  | 'eight_ball'
                  | 'nine_ball'
                  | 'ten_ball'
              }
              leagueId={matchData?.league?.id}
              hidePlayerNumber
              hideHandicap={isTiebreakerMode}
              captainId={teamDetailsQuery.data?.captain_id}
            />

            {/* Player Selection Dropdowns */}
            <div className="pt-2">
              {/* Header Row */}
              <div className="flex gap-3 items-center pb-1 border-b">
                <div className="w-12 text-center">
                  <div className="text-xs font-medium text-gray-500">
                    Player
                  </div>
                </div>
                {/* Hide handicap column in tiebreaker mode */}
                {!isTiebreakerMode && (
                  <div className="w-12 text-center">
                    <div className="text-xs font-medium text-gray-500">H/C</div>
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-500">
                    Player Name
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-2">
                {/* Map over positions dynamically based on player count */}
                {Array.from({ length: playerCount }, (_, i) => i + 1).map((position) => {
                  // In tiebreaker mode, get player from game record; otherwise from lineup
                  const playerId = isTiebreakerMode
                    ? getTiebreakerPlayerIdByPosition(position)
                    : getPlayerIdByPosition(position);
                  const handicap = getHandicapByPosition(position);

                  // Get other selected player IDs (to disable them in dropdown)
                  const otherPlayerIds = isTiebreakerMode
                    ? // Tiebreaker mode: get from game records
                      [1, 2, 3]
                        .filter((p) => p !== position)
                        .map((p) =>
                          getTiebreakerPlayerIdByPosition(p as 1 | 2 | 3)
                        )
                        .filter(Boolean)
                    : // Normal mode: get from lineup state
                      getOtherPlayerIds(position);

                  // Choose appropriate handlers based on mode
                  const onPlayerChange = isTiebreakerMode
                    ? handleTiebreakerPlayerChange
                    : handlePlayerChange;
                  const onClearPlayer = isTiebreakerMode
                    ? handleClearTiebreakerPlayer
                    : handleClearPlayer;

                  // Is this a substitute player?
                  const isSubstitute = playerId === SUB_HOME_ID || playerId === SUB_AWAY_ID;

                  // Handler for substitute handicap change
                  const handleSubHandicapChange = (newSubHandicap: string) => {
                    if (!lineup.lineupId || !matchId) return;

                    // Update local state
                    lineup.setSubHandicap(newSubHandicap);

                    // Collect used player IDs (excluding current position)
                    const usedPlayerIds = [
                      lineup.player1Id,
                      lineup.player2Id,
                      lineup.player3Id,
                    ].filter(Boolean);

                    // Calculate substitute handicap using utility function
                    const calculatedHandicap = calculateSubstituteHandicap(
                      usedPlayerIds,
                      players,
                      parseFloat(newSubHandicap)
                    );

                    // Update database with new handicap
                    updateLineupMutation.mutate({
                      lineupId: lineup.lineupId,
                      updates: {
                        [`player${position}_id`]: playerId,
                        [`player${position}_handicap`]: calculatedHandicap,
                      },
                      matchId,
                    });
                  };

                  return (
                    <PlayerSelectionRow
                      key={position}
                      position={position}
                      playerId={playerId}
                      handicap={handicap}
                      locked={lineup.lineupLocked}
                      handicapType={handicapType}
                      availablePlayerIds={getAvailablePlayerIds()}
                      otherPlayerIds={otherPlayerIds}
                      getPlayerDisplayName={getPlayerDisplayName}
                      onPlayerChange={onPlayerChange}
                      onClearPlayer={onClearPlayer}
                      isSubstitute={isSubstitute}
                      subHandicap={lineup.subHandicap}
                      onSubHandicapChange={handleSubHandicapChange}
                      showSubHandicapSelector={!isTiebreakerMode && teamFormat !== '8_man'}
                      hideHandicap={isTiebreakerMode}
                    />
                  );
                })}
              </div>
            </div>

            {/* Team Handicap Display - Only show in normal mode, not tiebreaker */}
            {/* For 5v5, team bonus is always 0 (disabled by shouldUseTeamBonus) */}
            {!isTiebreakerMode && (
              <HandicapSummary
                playerTotal={handicaps.playerTotal}
                teamHandicap={useTeamBonus ? teamHandicap : 0}
                teamTotal={handicaps.teamTotal}
                isHomeTeam={isHomeTeam}
                handicapType={handicapType}
              />
            )}

            {/* Duplicate Nickname Error - Only show in normal mode, not tiebreaker */}
            {!isTiebreakerMode && (
              <DuplicateNicknameWarning
                show={validation.isComplete && validation.hasDuplicates}
              />
            )}

            {/* Lock/Unlock and Status */}
            <LineupActions
              locked={lineup.lineupLocked}
              opponentStatus={opponentStatus}
              opponentStatusText={opponentSelectionStatus}
              canLock={validation.canLock}
              canUnlock={opponentStatus !== 'ready'}
              onLock={handleLockLineup}
              onUnlock={handleUnlockLineup}
              onProceed={() => {
                // TODO: Before navigating to score page, insert all 18 game rows into match_games table
                navigate(`/match/${matchId}/score`);
              }}
            />
          </CardContent>
        </Card>
      </main>

      {/* Loading Overlay - Show while preparing match */}
      {isPreparingMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Preparing Match</h2>
            <p className="text-gray-600">{preparationMessage}</p>
          </div>
        </div>
      )}

      {/* Opponent Substitute Modal - 5v5 Only */}
      {opponentLineup && (
        <OpponentSubstituteModal
          isOpen={showOpponentSubModal}
          opponentLineup={opponentLineup}
          getPlayerDisplayName={getOpponentPlayerDisplayName}
          onPlayerChosen={handleOpponentSubChoice}
          onClose={() => setShowOpponentSubModal(false)}
          subHomeId={SUB_HOME_ID}
          subAwayId={SUB_AWAY_ID}
        />
      )}
    </div>
  );
}
