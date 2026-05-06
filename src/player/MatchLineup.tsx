/**
 * @fileoverview Match Lineup Page
 *
 * Mobile-first lineup selection page where players choose their lineup
 * before starting a match. Supports both 3v3 (3 players) and 5v5 (5 players)
 * formats. Shows player handicaps and calculates team total.
 *
 * Flow: Team Schedule → Score Match → Lineup Entry
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { MatchPhaseGuard } from '@/components/match/MatchPhaseGuard';
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
import { FargoStartPointsCard } from '@/components/lineup/FargoStartPointsCard';
import { PrepStatusBanner } from '@/components/lineup/PrepStatusBanner';
import { SubResolutionBanner } from '@/components/lineup/SubResolutionBanner';
import { useFargoStartPointsNegotiation } from '@/hooks/lineup/useFargoStartPointsNegotiation';
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
import {
  calculateSubstituteHandicap,
  isAnonSubSentinel,
  isDoubleDutySentinel,
  isAnySubSentinel,
  getAnonSubId,
  getDoubleDutySubId,
  lineupHasDoubleDuty,
  computePrepBlockedReason,
} from '@/utils/lineup';
import { useMatchRealtime } from '@/realtime/useMatchRealtime';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { shouldUseTeamBonus } from '@/utils/calculateHandicapThresholds';
import { logger } from '@/utils/logger';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';

// Synthetic dropdown values — parsed in handlePlayerChange to pick the right
// sentinel UUID. The sentinel itself encodes the sub type going forward.
const ANON_SUB_VALUE = '__anonymous_sub__';
const DOUBLE_DUTY_VALUE = '__double_duty__';

function MatchLineupBody() {
  const { matchId } = useParams<{ matchId: string }>();
  const queryClient = useQueryClient();
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

  // Boot non-team-members back to /my-teams. If a player gets removed
  // from a team's roster mid-match-night and then taps a match link
  // from a stale schedule view, we don't want to leave them on a
  // generic error card with a Go-Back button that could land them
  // back on /lineup → status='in_progress' → /score → error → loop.
  // /my-teams is the safe destination because it doesn't presume a
  // teamId; /team/:id/schedule would just throw the same membership
  // error from another angle.
  useEffect(() => {
    const msg = userTeamQuery.error?.message ?? '';
    if (msg.includes('not on either team')) {
      navigate('/my-teams', { replace: true });
    }
  }, [userTeamQuery.error, navigate]);

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

  // In-flight prep state. Drives the "Setting up match…" indicator
  // under the Lock/Unlock buttons (LineupActions.isPreparing) and
  // disables Unlock during the prep_match RPC window.
  const { isPreparingMatch, setIsPreparingMatch } = usePreparationStatus();

  // Resolved preferences — lazy-migrates legacy leagues on first access
  const leagueId = matchData?.league?.id;
  const { data: leaguePrefs } = useResolvedLeaguePrefs(leagueId);
  const handicapType = leaguePrefs?.handicap_type ?? 'points';
  const playerCount = leaguePrefs?.lineup_size ?? 3;
  // teamFormat is no longer used in lineup — all branching uses handicapType and lineupSize

  // Centralized lineup state management
  const lineup = useLineupState(playerCount);

  // Get update mutation for direct dropdown saves
  const updateLineupMutation = useUpdateMatchLineup();

  // Track which type of substitute was chosen: anonymous or double duty.
  // null = no sub in lineup. Once set, the other type is hidden from the dropdown.
  const [substituteType, setSubstituteType] = useState<'anonymous' | 'double_duty' | null>(null);

  // Manual Fargo rating entry — LO types in each player's current rating.
  // Keyed by position (1-5). Only used when handicapType === 'fargo'.
  const [manualHandicaps, setManualHandicaps] = useState<Record<number, string>>({});

  // Debounce per-position autosave so multiple keystrokes don't race. Without
  // this, typing "358" can fire three separate mutations (3, 35, 358) that
  // complete in any order — the final DB value depends on which network
  // response wins, and the wrong one often does.
  const handicapSaveTimersRef = useRef<Record<number, number>>({});

  const handleManualHandicapChange = (position: number, value: string) => {
    setManualHandicaps((prev) => ({ ...prev, [position]: value }));

    // Cancel any pending save for this position — only the latest typed
    // value should hit the DB.
    if (handicapSaveTimersRef.current[position] !== undefined) {
      window.clearTimeout(handicapSaveTimersRef.current[position]);
    }

    if (!lineup.lineupId || !matchId) return;
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;

    handicapSaveTimersRef.current[position] = window.setTimeout(() => {
      if (!lineup.lineupId || !matchId) return;
      updateLineupMutation.mutate({
        lineupId: lineup.lineupId,
        updates: { [`player${position}_handicap`]: parsed },
        matchId,
      });
    }, 300);
  };

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
  const useTeamBonus = shouldUseTeamBonus(handicapType);
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
    handicapType,
    manualFargoRatings: manualHandicaps,
  });

  // Build Fargo rating + double-duty slot inputs for validation.
  // Only used when handicapType='fargo'; cheap no-op for other systems.
  const { fargoRatingsBySlot, doubleDutySlots } = useMemo(() => {
    const ratings: Record<number, number | null | undefined> = {};
    const duty = new Set<number>();
    if (handicapType !== 'fargo') return { fargoRatingsBySlot: ratings, doubleDutySlots: duty };

    const slotPlayerIds = [
      lineup.player1Id,
      lineup.player2Id,
      lineup.player3Id,
      lineup.player4Id,
      lineup.player5Id,
    ];
    const slotHandicaps = [
      handicaps.player1Handicap,
      handicaps.player2Handicap,
      handicaps.player3Handicap,
      handicaps.player4Handicap,
      handicaps.player5Handicap,
    ];

    for (let slot = 1; slot <= playerCount; slot++) {
      const pid = slotPlayerIds[slot - 1];
      // Sentinel UUID itself encodes the type — no need to consult React state
      if (isDoubleDutySentinel(pid)) duty.add(slot);

      // Prefer the pending manual entry (user is typing); fall back to the persisted handicap
      const typed = manualHandicaps[slot];
      if (typed && typed.trim() !== '') {
        const parsed = Number.parseInt(typed, 10);
        ratings[slot] = Number.isFinite(parsed) ? parsed : null;
      } else {
        const persisted = slotHandicaps[slot - 1];
        ratings[slot] =
          typeof persisted === 'number' && Number.isFinite(persisted) && persisted > 0
            ? persisted
            : null;
      }
    }
    return { fargoRatingsBySlot: ratings, doubleDutySlots: duty };
  }, [
    handicapType,
    playerCount,
    lineup.player1Id,
    lineup.player2Id,
    lineup.player3Id,
    lineup.player4Id,
    lineup.player5Id,
    handicaps.player1Handicap,
    handicaps.player2Handicap,
    handicaps.player3Handicap,
    handicaps.player4Handicap,
    handicaps.player5Handicap,
    manualHandicaps,
  ]);

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
    handicapType,
    fargoRatingsBySlot,
    doubleDutySlots,
  });

  // Lineup persistence operations
  const { handleLockLineup, handleUnlockLineup } = useLineupPersistence({
    matchId,
    userTeamId: userTeamData?.team_id,
    memberId,
    lineupId: lineup.lineupId,
    opponentLocked: !!opponentLineup?.locked,
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

  // Build a row-shaped snapshot of MY lineup from component state so the
  // completeness gate reads the same shape as the persisted opponent row.
  const myLineupRow = useMemo(() => ({
    player1_id: lineup.player1Id || null,
    player1_handicap: handicaps.player1Handicap,
    player2_id: lineup.player2Id || null,
    player2_handicap: handicaps.player2Handicap,
    player3_id: lineup.player3Id || null,
    player3_handicap: handicaps.player3Handicap,
    player4_id: lineup.player4Id || null,
    player4_handicap: handicaps.player4Handicap,
    player5_id: lineup.player5Id || null,
    player5_handicap: handicaps.player5Handicap,
  }), [
    lineup.player1Id, lineup.player2Id, lineup.player3Id,
    lineup.player4Id, lineup.player5Id,
    handicaps.player1Handicap, handicaps.player2Handicap,
    handicaps.player3Handicap, handicaps.player4Handicap,
    handicaps.player5Handicap,
  ]);

  // Compute the discriminated match-prep blocker. null = ready for Step 3.
  // Fargo confirmations are now tracked in *_games_to_lose (captain's
  // system_player_number) rather than dedicated columns.
  const prepBlockedReason = useMemo(
    () => computePrepBlockedReason({
      myLineup: myLineupRow,
      opponentLineup: opponentLineup ?? null,
      lineupSize: playerCount,
      handicapType,
      winCondition: (leaguePrefs?.win_condition as 'games' | 'points' | undefined) ?? 'games',
      homeGamesToLose: matchData?.home_to_lose ?? null,
      awayGamesToLose: matchData?.away_to_lose ?? null,
      isHomeTeam,
    }),
    [
      myLineupRow,
      opponentLineup,
      playerCount,
      handicapType,
      matchData?.home_to_lose,
      matchData?.away_to_lose,
      isHomeTeam,
    ]
  );

  // Step 1 complete on BOTH sides — used by the Fargo hook to gate its
  // initial-proposal effect (so it doesn't fire against placeholder slots).
  const step1CompleteBothSides =
    prepBlockedReason === null ||
    prepBlockedReason?.kind === 'fargo_pending';

  // Fargo initial-write / propose effects only run when Step 1 is complete
  // on both sides AND both lineups are physically locked. Replaces the prior
  // `bothLineupsLocked` input so placeholder-contaminated ratings never leak
  // into the Fargo default computation.
  const bothLineupsReadyForFargo =
    lineup.lineupLocked &&
    !!opponentLineup?.locked &&
    step1CompleteBothSides;

  const { homeRatingsForFargo, awayRatingsForFargo } = useMemo(() => {
    const gatherFrom = (src: {
      p1?: number | null;
      p2?: number | null;
      p3?: number | null;
      p4?: number | null;
      p5?: number | null;
    }): number[] => {
      const out: number[] = [];
      const all = [src.p1, src.p2, src.p3, src.p4, src.p5];
      for (let i = 0; i < playerCount; i++) {
        const v = Number(all[i]);
        if (Number.isFinite(v) && v > 0) out.push(v);
      }
      return out;
    };

    const myRatings = gatherFrom({
      p1: handicaps.player1Handicap,
      p2: handicaps.player2Handicap,
      p3: handicaps.player3Handicap,
      p4: handicaps.player4Handicap,
      p5: handicaps.player5Handicap,
    });
    const oppRatings = gatherFrom({
      p1: opponentLineup?.player1_handicap,
      p2: opponentLineup?.player2_handicap,
      p3: opponentLineup?.player3_handicap,
      p4: opponentLineup?.player4_handicap,
      p5: opponentLineup?.player5_handicap,
    });

    return isHomeTeam
      ? { homeRatingsForFargo: myRatings, awayRatingsForFargo: oppRatings }
      : { homeRatingsForFargo: oppRatings, awayRatingsForFargo: myRatings };
  }, [
    isHomeTeam,
    playerCount,
    handicaps.player1Handicap,
    handicaps.player2Handicap,
    handicaps.player3Handicap,
    handicaps.player4Handicap,
    handicaps.player5Handicap,
    opponentLineup?.player1_handicap,
    opponentLineup?.player2_handicap,
    opponentLineup?.player3_handicap,
    opponentLineup?.player4_handicap,
    opponentLineup?.player5_handicap,
  ]);

  const fargoNegotiation = useFargoStartPointsNegotiation({
    matchId,
    memberPlayerNumber: member?.system_player_number ?? null,
    isHomeTeam,
    handicapType,
    bothLineupsReady: bothLineupsReadyForFargo,
    homeRatings: homeRatingsForFargo,
    awayRatings: awayRatingsForFargo,
    lineupSize: playerCount,
    homeGamesToTie: matchData?.home_to_tie ?? null,
    awayGamesToTie: matchData?.away_to_tie ?? null,
    homeGamesToLose: matchData?.home_to_lose ?? null,
    awayGamesToLose: matchData?.away_to_lose ?? null,
    systemOverrides: leaguePrefs?.system_overrides,
    refetchMatch: matchQuery.refetch,
  });

  // Match preparation and auto-navigation. For Fargo matches, gated on
  // both-captains-confirmed via the negotiation above.
  useMatchPreparation({
    lineupLocked: lineup.lineupLocked,
    opponentLineup,
    matchId,
    matchData,
    isHomeTeam,
    lineupSize: playerCount,
    handicapType,
    winCondition: (leaguePrefs?.win_condition as 'games' | 'points' | undefined) ?? 'games',
    mechanism: leaguePrefs?.mechanism,
    systemOverrides: leaguePrefs?.system_overrides,
    blockedReason: prepBlockedReason,
    gameGeneration: leaguePrefs?.game_generation,
    currentGamesCount: allGames.length,
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
    refetchLineups: lineupsQuery.refetch,
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

              // ALSO sync the manualHandicaps entry — when DD resolves via the
              // opposing captain's pick, the DB now has the resolved player's
              // handicap. The local manualHandicaps cache still has the old
              // value (e.g., what the captain typed for the previous player
              // in this slot). Reset it so the UI displays the correct number
              // without requiring a page refresh.
              const handicapField = `player${pos}_handicap` as keyof typeof myLineup;
              const dbHandicap = myLineup[handicapField] as number | null | undefined;
              if (typeof dbHandicap === 'number' && dbHandicap > 0) {
                setManualHandicaps((prev) => {
                  const newVal = String(dbHandicap);
                  if (prev[pos] === newVal) return prev;
                  return { ...prev, [pos]: newVal };
                });
              }
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

  // Fargo-only: hydrate manual rating entries from the persisted lineup so
  // refreshes / tab-returns preserve what the LO typed. Without this, the
  // HandicapCell inputs show empty after reload and the handicap hook would
  // compute zeros for positions that already have real values in the DB.
  useEffect(() => {
    if (handicapType !== 'fargo' || !lineupsQuery.data) return;
    const myLineup = isHomeTeam
      ? lineupsQuery.data.homeLineup
      : lineupsQuery.data.awayLineup;
    if (!myLineup) return;

    const stored: Record<number, string> = {};
    for (let pos = 1; pos <= playerCount; pos++) {
      const field = `player${pos}_handicap` as keyof typeof myLineup;
      const val = myLineup[field] as number | null | undefined;
      if (val !== null && val !== undefined && val > 0) {
        stored[pos] = String(val);
      }
    }

    // Merge with any in-memory edits the user is currently typing — only fill
    // in positions the user hasn't touched yet. Don't clobber a partial entry.
    setManualHandicaps((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [pos, val] of Object.entries(stored)) {
        if (next[Number(pos)] === undefined) {
          next[Number(pos)] = val;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [handicapType, lineupsQuery.data, isHomeTeam, playerCount]);

  // Unified real-time subscription for match, lineups, and games.
  // Watches all three tables throughout entire match flow (lineup + tiebreaker + scoring).
  //
  // Each handler invalidates the relevant cache entry rather than calling
  // refetch directly. See `useMatchScoring.ts` for rationale — same contract.
  // Wrapped in useCallback so identities stay stable across renders.
  const handleMatchInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.detail(matchId || '') });
  }, [queryClient, matchId]);
  const handleLineupInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId || '') });
  }, [queryClient, matchId]);
  const handleGamesInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.matches.games(matchId || '') });
  }, [queryClient, matchId]);

  useMatchRealtime(matchId, {
    onMatchUpdate: handleMatchInvalidate,
    onLineupUpdate: handleLineupInvalidate,
    onGamesUpdate: handleGamesInvalidate,
  });

  // 5v5 Substitute Modal State
  const [showOpponentSubModal, setShowOpponentSubModal] = useState(false);

  // Detect if opponent has substitute in their lineup (5v5 only)
  useEffect(() => {
    if (!opponentLineup || !matchData || isTiebreakerMode) {
      setShowOpponentSubModal(false);
      return;
    }

    // Check if opponent's lineup is locked and has a double-duty placeholder
    // (anonymous subs don't need opposing-captain action; DD subs do)
    if (!opponentLineup.locked) {
      setShowOpponentSubModal(false);
      return;
    }

    setShowOpponentSubModal(lineupHasDoubleDuty(opponentLineup, playerCount));
  }, [opponentLineup, matchData, isTiebreakerMode, playerCount]);

  // Handle opponent substitute choice — STRICT COPY semantics.
  //
  // Bypass React Query entirely and read the source lineup row DIRECTLY from
  // Supabase. Whatever's in the DB at that moment is what we copy into the
  // DD slot — no cache, no debounce timer, no closure value. After the write,
  // invalidate the lineups query so every observer (both clients) picks up
  // the new state immediately.
  const handleOpponentSubChoice = async (playerId: string, _modalHandicap: number, subPosition: number) => {
    if (!opponentLineup?.id || !matchId) return;

    try {
      // Direct DB read — bypass TanStack Query cache.
      const { data: freshLineup, error: readError } = await supabase
        .from('match_lineups')
        .select(
          'player1_id, player1_handicap, player2_id, player2_handicap, ' +
          'player3_id, player3_handicap, player4_id, player4_handicap, ' +
          'player5_id, player5_handicap'
        )
        .eq('id', opponentLineup.id)
        .single();

      if (readError || !freshLineup) {
        logger.error('handleOpponentSubChoice: failed to read fresh opponent lineup', {
          matchId,
          error: readError?.message,
        });
        toast.error('Could not load the opposing lineup. Please try again.');
        return;
      }

      // Find which slot the picked player is in.
      const freshRow = freshLineup as unknown as Record<string, unknown>;
      let sourceHandicap: number | null | undefined = undefined;
      for (let pos = 1; pos <= playerCount; pos++) {
        if (freshRow[`player${pos}_id`] === playerId) {
          sourceHandicap = freshRow[`player${pos}_handicap`] as number | null;
          break;
        }
      }
      if (sourceHandicap === undefined) {
        logger.error('handleOpponentSubChoice: picked player not in fresh opponent lineup', {
          matchId,
          playerId,
        });
        toast.error('That player is not in the opposing lineup anymore. Please pick again.');
        return;
      }

      updateLineupMutation.mutate({
        lineupId: opponentLineup.id,
        updates: {
          [`player${subPosition}_id`]: playerId,
          [`player${subPosition}_handicap`]: sourceHandicap,
        },
        matchId,
      }, {
        onSuccess: async () => {
          await lineupsQuery.refetch();
          setShowOpponentSubModal(false);
        },
        onError: (error) => {
          logger.error('Failed to update opponent lineup', {
            error: error instanceof Error ? error.message : String(error),
          });
        },
      });
    } catch (error) {
      logger.error('handleOpponentSubChoice failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Generic player change handler - works for any position (3 or 5 players)
  const handlePlayerChange = (position: number, rawPlayerId: string) => {
    if (!lineup.lineupId || !matchId) return;

    // Map synthetic dropdown values to the right sentinel UUID — the sentinel
    // itself encodes sub type, so both clients can discriminate from DB state.
    let playerId = rawPlayerId;
    if (rawPlayerId === ANON_SUB_VALUE) {
      playerId = getAnonSubId(isHomeTeam);
      setSubstituteType('anonymous');
    } else if (rawPlayerId === DOUBLE_DUTY_VALUE) {
      playerId = getDoubleDutySubId(isHomeTeam);
      setSubstituteType('double_duty');
    }

    // If replacing a sub slot with a real player, reset the React-side type flag
    const previousId = lineup.getPlayerId(position as 1 | 2 | 3 | 4 | 5);
    if (isAnySubSentinel(previousId) && !isAnySubSentinel(playerId)) {
      setSubstituteType(null);
    }

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

    // If clearing a sub slot, reset the substitute type
    const currentId = lineup.getPlayerId(position as 1 | 2 | 3 | 4 | 5);
    if (isAnySubSentinel(currentId)) {
      setSubstituteType(null);
    }

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
    const handicapsByPosition: Record<number, number | undefined> = {
      1: handicaps.player1Handicap,
      2: handicaps.player2Handicap,
      3: handicaps.player3Handicap,
      4: handicaps.player4Handicap,
      5: handicaps.player5Handicap,
    };
    return handicapsByPosition[position] ?? 0;
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
    // Synthetic dropdown entries
    if (playerId === ANON_SUB_VALUE) return 'Anonymous Sub';
    if (playerId === DOUBLE_DUTY_VALUE) return 'Double Duty';
    // Persisted sentinels self-describe via the UUID
    if (isDoubleDutySentinel(playerId)) return 'Double Duty';
    if (isAnonSubSentinel(playerId)) return 'Anonymous Sub';
    return 'Unknown';
  };

  // Helper to get opponent player display name (for substitute modal)
  const getOpponentPlayerDisplayName = (playerId: string): string => {
    const player = opponentPlayers.find((p) => p.id === playerId);
    if (player) {
      return player.nickname || `${player.first_name} ${player.last_name}`;
    }
    if (isAnySubSentinel(playerId)) return 'Sub';
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
      // Tiebreaker: Only original lineup players can be selected
      return Array.from({ length: playerCount }, (_, i) => {
        const key = `player${i + 1}_id` as keyof typeof myLineup;
        return myLineup[key];
      }).filter(Boolean) as string[];
    }

    // Normal mode: All roster players + sub options
    // TODO: check substitute_method preference to show one/both/neither
    const playerIds = players.map((p) => p.id);

    if (substituteType === null) {
      // No sub chosen yet — show both options
      return [...playerIds, ANON_SUB_VALUE, DOUBLE_DUTY_VALUE];
    }
    // A sub is already in the lineup — include the current sub's sentinel so
    // the Select can display the current selection, but don't offer a new sub
    const subId = substituteType === 'double_duty'
      ? getDoubleDutySubId(isHomeTeam)
      : getAnonSubId(isHomeTeam);
    return [...playerIds, subId];
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <Link
            to={`/team/${userTeamId}/schedule`}
            className="flex items-center gap-2 text-sm text-muted-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Schedule
          </Link>
          <div className="text-4xl font-semibold text-foreground">
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

            {/* Fargo manual entry banner */}
            {handicapType === 'fargo' && !isTiebreakerMode && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <strong>Automatic Fargo ratings coming soon</strong> — for now, enter each player&apos;s current rating manually.
              </div>
            )}

            {/* Player Selection Dropdowns */}
            <div className="pt-2">
              {/* Header Row */}
              <div className="flex gap-3 items-center pb-1 border-b">
                <div className="w-12 text-center">
                  <div className="text-xs font-medium text-muted-foreground">
                    Player
                  </div>
                </div>
                {/* Hide handicap column in tiebreaker mode */}
                {!isTiebreakerMode && (
                  <div className={`${handicapType === 'fargo' ? 'w-16' : 'w-12'} text-center`}>
                    <div className="text-xs font-medium text-muted-foreground">
                      {handicapType === 'fargo' ? 'Fargo' : 'H/C'}
                    </div>
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-xs font-medium text-muted-foreground">
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

                  // Is this slot a substitute (anon OR double-duty placeholder)?
                  const isSubstitute = isAnySubSentinel(playerId);

                  // Handler for substitute handicap change
                  const handleSubHandicapChange = (newSubHandicap: string) => {
                    if (!lineup.lineupId || !matchId) return;

                    // Update local state
                    lineup.setSubHandicap(newSubHandicap);

                    // Collect used player IDs (excluding current position)
                    const usedPlayerIds = Array.from({ length: playerCount }, (_, i) =>
                      lineup.getPlayerId((i + 1) as 1 | 2 | 3 | 4 | 5),
                    ).filter(Boolean);

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
                      hideHandicap={isTiebreakerMode}
                      isDoubleDuty={isSubstitute && substituteType === 'double_duty'}
                      manualHandicapValue={manualHandicaps[position]}
                      onManualHandicapChange={handicapType === 'fargo' ? handleManualHandicapChange : undefined}
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

            {/* My-side double-duty waiting state — hidden while the opponent-
                resolution modal is open (don't stack two sub-resolution affordances). */}
            <PrepStatusBanner
              show={
                !isTiebreakerMode &&
                !showOpponentSubModal &&
                prepBlockedReason?.kind === 'waiting_on_sub_resolution' &&
                prepBlockedReason?.lineupWithPlaceholder === 'mine'
              }
              locked={lineup.lineupLocked}
              opponentLabel={opponent?.team_name ?? 'the opposing captain'}
            />

            {/* Canceled-modal re-open affordance — when opponent has DD and I
                dismissed the modal without picking. */}
            <SubResolutionBanner
              show={
                !isTiebreakerMode &&
                !showOpponentSubModal &&
                prepBlockedReason?.kind === 'waiting_on_sub_resolution' &&
                prepBlockedReason?.lineupWithPlaceholder === 'opponent'
              }
              opponentLocked={!!opponentLineup?.locked}
              opponentTeamLabel={opponent?.team_name ?? 'the opposing team'}
              onChoose={() => setShowOpponentSubModal(true)}
            />

            {/* Fargo start-points negotiation — only after both lineups locked */}
            {fargoNegotiation.applicable && !fargoNegotiation.bothConfirmed && (
              <FargoStartPointsCard
                negotiation={fargoNegotiation}
                homeTeamName={matchData?.home_team?.team_name ?? 'Home'}
                awayTeamName={matchData?.away_team?.team_name ?? 'Away'}
                isHomeTeam={isHomeTeam}
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
              isPreparing={isPreparingMatch}
              // No manual Proceed button — useMatchPreparation auto-navigates
              // once both lineups are locked (and for Fargo, once start-points
              // are mutually confirmed). A manual button could navigate early,
              // before prep or negotiation completes, and leave the match in
              // a half-started state. Trust the auto-nav path.
            />
          </CardContent>
        </Card>
      </main>

      {/* Opponent Substitute Modal - 5v5 Only */}
      {opponentLineup && (
        <OpponentSubstituteModal
          isOpen={showOpponentSubModal}
          opponentLineup={opponentLineup}
          lineupSize={playerCount}
          getPlayerDisplayName={getOpponentPlayerDisplayName}
          onPlayerChosen={handleOpponentSubChoice}
          onClose={() => setShowOpponentSubModal(false)}
        />
      )}
    </div>
  );
}

/**
 * Public export. The route guard reads `matches.status` and dispatches
 * lineup vs scoring vs recovery; on a status flip it navigates the user
 * to the right surface. Children receive a compound `key` so cross-match
 * navigation and Hard Reset both fully remount this body.
 */
export function MatchLineup() {
  return (
    <MatchPhaseGuard>
      <MatchLineupBody />
    </MatchPhaseGuard>
  );
}
