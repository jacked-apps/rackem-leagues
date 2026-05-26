/**
 * @fileoverview Score Match Page — live match scoring (all formats).
 *
 * Mobile-first scoring page for any league preset. Renders through the
 * unified scoreboard, which composes display from
 * `lineup_size × win_condition × points_calculator` rather than the
 * pre-Unit-7 3v3-vs-5v5-vs-Fargo dispatch.
 *
 * Flow: Lineup Entry → Score Match → (Tiebreaker if needed)
 *
 * Features:
 * - UnifiedScoreboard with calculator-driven display hints
 * - Real-time updates via useMatchRealtime
 * - Confirmation flow (both teams must agree)
 * - Break & Run (B&R), Golden Break (8BB), runout, foul tracking
 * - Match end detection with winner announcement
 */
//import { watchMatchAndGames } from '@/realtime/useMatchAndGamesRealtime';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCurrentMember } from '@/api/hooks';
import { InfoButton } from '@/components/InfoButton';
import { LineupChangeModal } from '@/components/scoring/LineupChangeModal';
import { LineupChangeRequestModal } from '@/components/scoring/LineupChangeRequestModal';
import {
  requestLineupChange,
  approveLineupChange,
  denyLineupChange,
} from '@/api/mutations/matchLineups';
import { usePlayerHandicaps } from '@/api/hooks/usePlayerHandicaps';
// getAllGames no longer needed - all game data comes from database
import { getCompletedGamesCount } from '@/types/match';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { useMatchScoringMutations } from '@/hooks/useMatchScoringMutations';
import { getPlayerStatsByPosition } from '@/hooks/usePlayerStatsByPosition';
import { ScoringDialog } from '@/components/scoring/ScoringDialog';
import { ConfirmationDialog } from '@/components/scoring/ConfirmationDialog';
import { EditGameDialog } from '@/components/scoring/EditGameDialog';
import { UnifiedScoreboard } from '@/components/scoring/UnifiedScoreboard';
import { TiebreakerScoreboard } from '@/components/scoring/TiebreakerScoreboard';
import { GamesList } from '@/components/scoring/GamesList';
import { DissentFlag } from '@/components/scoring/DissentFlag';
import { DisputeBanner } from '@/components/scoring/DisputeBanner';
import { DisputeDetailModal } from '@/components/scoring/DisputeDetailModal';
import {
  deriveDissents,
  type GameForDissent,
} from '@/utils/match/deriveDissents';
import {
  deriveDisputes,
  type GameForDispute,
} from '@/utils/match/deriveDisputes';
import { TableNumberBar } from '@/components/scoring/TableNumberBar';
import { ConnectionIndicator } from '@/components/match/ConnectionIndicator';
import {
  decidePendingAction,
  buildConfirmationItem,
  buildVacateConfirmationItem,
  buildPersonalConfirmContext,
} from '@/utils/match/pendingConfirmations';
import { queryKeys } from '@/api/queryKeys';
import { getTeamStats, getPlayerStats as getPlayerStatsUtil } from '@/types';
import { getCalculator } from '@/systems/calculators';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { MatchPhaseGuard } from '@/components/match/MatchPhaseGuard';

function ScoreMatchBody() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: member } = useCurrentMember();
  const memberId = member?.id;

  // Auto-confirm setting (bypass confirmation modal)
  const [autoConfirm, setAutoConfirm] = useState(false);

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);

  // Many-eyes Amendment G: which disputed game (if any) is open in the
  // detail modal. `null` = modal closed.
  const [disputeDetailGameId, setDisputeDetailGameId] = useState<string | null>(null);

  // Ref to store mutations for use in real-time subscription
  // Holds the latest `mutations` object returned by useMatchScoringMutations
  // so the realtime subscription's confirmOpponentScore callback can call
  // it without having `mutations` itself in the callback's closure (which
  // would force the realtime channel to re-subscribe on every render).
  // Type is the return shape of useMatchScoringMutations — using
  // ReturnType keeps the ref aligned automatically if the hook's return
  // changes shape.
  const mutationsRef = useRef<ReturnType<typeof useMatchScoringMutations> | null>(null);

  // Games this device has already acted on (confirmed/denied/auto-confirmed)
  // but whose server state hasn't propagated back yet. confirmOpponentScore
  // waits ~500ms before invalidating, so without this guard the state-derived
  // scan below would re-pop a modal the scorer just resolved. Cleared per game
  // once the data shows it no longer needs my confirmation (server caught up).
  const handledConfirmations = useRef<Set<number>>(new Set());

  // Scoring modal state — declared up here (rather than next to the other
  // local UI state below) so Amendment H can pass it through useMatchScoring
  // into useMatchRealtime's gameUpdateOptions. The realtime handler reads it
  // to suppress the confirm-opponent prompt while the user's own initiator
  // modal is open for the same game.
  const [scoringGame, setScoringGame] = useState<{
    gameNumber: number;
    winnerTeamId: string;
    winnerPlayerId: string;
    winnerPlayerName: string;
    winnerWasScheduledBreaker: boolean;
  } | null>(null);

  // Use central scoring hook (replaces all manual data fetching)
  const {
    match,
    homeLineup,
    awayLineup,
    gameResults,
    gameConfirmations,
    homeThresholds,
    awayThresholds,
    homeTeamRoster,
    awayTeamRoster,
    userTeamId,
    isHomeTeam,
    goldenBreakCountsAsWin,
    gameType,
    getPlayerDisplayName: getPlayerDisplayNameFromHook,
    confirmationQueue,
    addToConfirmationQueue: addToConfirmationQueueFromHook,
    removeFromConfirmationQueue,
    myVacateRequests,
    players,
    connectionHealth,
    loading,
    error,
  } = useMatchScoring({
    matchId,
    memberId,
    matchType: '3v3',
    autoConfirm,
    // Amendment H: forward the open-initiator state so the realtime handler
    // can suppress confirm-opponent queue entries for that game while the
    // user is mid-fill (the user's submit will trigger Amendment D's
    // race-handling — a stacked confirm modal would be redundant + UX-broken).
    // Narrow to just the gameNumber the realtime handler reads.
    scoringGame: scoringGame ? { gameNumber: scoringGame.gameNumber } : null,
  });

  // Get user's team roster from the hook (already fetched for both teams)
  const teamRoster = isHomeTeam ? homeTeamRoster : awayTeamRoster;

  // Get the user's lineup (home or away based on isHomeTeam)
  const userLineup = isHomeTeam ? homeLineup : awayLineup;
  const opponentLineup = isHomeTeam ? awayLineup : homeLineup;

  // Resolved preferences — lazy-migrates legacy leagues on first access
  const { data: leaguePrefs } = useResolvedLeaguePrefs(match?.league?.id);
  const handicapType = leaguePrefs?.handicap_type ?? 'points';

  // Resolve the active points calculator name with live-prefs fallback.
  // Mirrors src/components/scoring/UnifiedScoreboard.tsx:614-617. The snapshot
  // is captured lazily at the first scoring event (PR #98), so on game 1 it's
  // null — falling back to the live league preference avoids hiding calculator-
  // aware modal sections (LIST_FOR_ED #23). Uses `!== undefined` (not `??`) so
  // a deliberately-null snapshot value (a league opting out of points tracking)
  // is preserved.
  const snapshotPointsCalculator = (
    match?.system_snapshot as { points_calculator?: string | null } | null
  )?.points_calculator;
  const resolvedPointsCalculator =
    snapshotPointsCalculator !== undefined
      ? snapshotPointsCalculator
      : (leaguePrefs?.points_calculator ?? null);

  // Resolve the active calculator's params with the same snapshot-vs-live
  // fallback. The calculator's scoringPopupFields(params) reads these to
  // produce the per-side input spec. Empty params (`{}`) cause the
  // calculator to use its defaults — the modal does not interpret params.
  const snapshotPointsCalculatorParams = (
    match?.system_snapshot as { points_calculator_params?: Record<string, unknown> | null } | null
  )?.points_calculator_params;
  const resolvedPointsCalculatorParams =
    snapshotPointsCalculatorParams !== undefined
      ? snapshotPointsCalculatorParams
      : (leaguePrefs?.points_calculator_params as Record<string, unknown> | null | undefined) ?? null;

  // Get handicaps for roster players (for lineup change requests)
  const rosterPlayerIds = teamRoster.map((tp: any) => tp.member_id).filter(Boolean);
  const { handicaps: rosterHandicaps } = usePlayerHandicaps({
    playerIds: rosterPlayerIds,
    handicapType,
    handicapVariant: match?.league?.handicap_variant || 'standard',
    gameType: gameType,
    leagueId: match?.league?.id,
    matchId: matchId, // Per-match cache scoping - same handicaps as lineup page
  });

  // Lineup change mutations
  const requestLineupChangeMutation = useMutation({
    mutationFn: requestLineupChange,
    onSuccess: () => {
      toast.success('Lineup change request sent to opponent');
      setLineupChangeData(null);
      // Invalidate lineup queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId!) });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to request lineup change');
    },
  });

  const approveLineupChangeMutation = useMutation({
    mutationFn: approveLineupChange,
    onSuccess: () => {
      toast.success('Lineup change approved');
      // Invalidate lineup queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId!) });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to approve lineup change');
    },
  });

  const denyLineupChangeMutation = useMutation({
    mutationFn: denyLineupChange,
    onSuccess: () => {
      toast.info('Lineup change denied');
      // Invalidate lineup queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.matches.lineup(matchId!) });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to deny lineup change');
    },
  });

  // (scoringGame state lives above useMatchScoring so Amendment H can thread
  // it into the realtime handler — see declaration near the top of the body.)
  const [breakAndRun, setBreakAndRun] = useState(false);
  const [goldenBreak, setGoldenBreak] = useState(false);
  // Unit 11b: configurable scoring fields. All default false/null; Fargo
  // matches require `loserValue` before submit (0 is a valid pick).
  const [breakFouled, setBreakFouled] = useState(false);
  const [winByForfeit, setWinByForfeit] = useState(false);
  const [runout, setRunout] = useState(false);
  const [loserValue, setLoserValue] = useState<number | null>(null);
  const [winnerValue, setWinnerValue] = useState<number | null>(null);

  // Opponent confirmation modal state
  const [confirmationGame, setConfirmationGame] = useState<{
    gameNumber: number;
    winnerPlayerName: string;
    breakAndRun: boolean;
    goldenBreak: boolean;
    breakFouled: boolean;
    runout: boolean;
    winByForfeit: boolean;
    winnerValue: number | null;
    loserValue: number | null;
    isVacateRequest?: boolean; // True if this is a request to vacate (undo) the game
  } | null>(null);

  // Edit game modal state
  const [editingGame, setEditingGame] = useState<{
    gameNumber: number;
    currentWinnerName: string;
  } | null>(null);

  // Lineup change modal state
  const [lineupChangeData, setLineupChangeData] = useState<{
    playerId: string;
    playerName: string;
    position: number;
  } | null>(null);

  // Process confirmation queue when modal closes or queue changes
  useEffect(() => {
    // Only process queue when modal is closed
    if (!confirmationGame && confirmationQueue.length > 0) {
      // console.log(
      //   'Modal closed, processing queue. Queue length:',
      //   confirmationQueue.length
      // );
      const nextConfirmation = confirmationQueue[0];
      //console.log('Showing game', nextConfirmation.gameNumber, 'from queue');

      // Add delay to allow Dialog component to clean up properly
      // This prevents the grey screen overlay issue
      setTimeout(() => {
        setConfirmationGame(nextConfirmation);
        removeFromConfirmationQueue(); // Remove first item from queue
      }, 1000);
    }
  }, [confirmationGame, confirmationQueue, removeFromConfirmationQueue]); // Watch both - but queue updates won't replace modal


  // Detect when all games are complete (works for any format: 3, 18, 25, etc.)
  // Total games = count of games in database
  //
  // The `totalGames > 0` guard is load-bearing: without it, an empty
  // gameResults map (initial render before games load) makes
  // `0 === 0 === true`, and the prevRef below initializes to true.
  // When games subsequently arrive, the effect sees a complete→incomplete
  // transition and spuriously CLEARS home_team_verified_by /
  // away_team_verified_by on the matches row. This was a pre-existing
  // bug that the deletion of the wait-for-prep loop made more reachable
  // — ScoreMatchBody now renders before games load instead of spinning.
  const totalGames = gameResults.size;
  const completedGames = getCompletedGamesCount(gameResults);
  const allGamesComplete = totalGames > 0 && completedGames === totalGames;

  // Debug: Log team identification and verification status
  // useEffect(() => {
  //   console.log('Match data updated with verification columns:', {
  //     matchId: match?.id,
  //     homeVerifiedBy: (match as any)?.home_team_verified_by,
  //     awayVerifiedBy: (match as any)?.away_team_verified_by,
  //   });
  // }, [match]);

  // Track previous allGamesComplete state to detect changes
  const prevAllGamesCompleteRef = useRef(allGamesComplete);

  // Save thresholds and handle verification when match completes/uncompletes
  // Note: gameResults is intentionally excluded - we only want this to trigger on completion state changes,
  // not on every game update. The gameResults check is a secondary validation for tiebreaker detection.
  useEffect(() => {
    const wasComplete = prevAllGamesCompleteRef.current;
    const isComplete = allGamesComplete;

    // If changed from incomplete to complete, save thresholds to database
    if (!wasComplete && isComplete && matchId && homeThresholds && awayThresholds) {
      supabase
        .from('matches')
        .update({
          home_to_win: homeThresholds.games_to_win,
          home_to_tie: homeThresholds.games_to_tie,
          away_to_win: awayThresholds.games_to_win,
          away_to_tie: awayThresholds.games_to_tie,
        })
        .eq('id', matchId)
        .then(({ error }) => {
          if (error) {
            logger.error('Error saving thresholds', { error: error.message });
          }
        });
    }

    // If changed from complete to incomplete, clear verification
    // BUT: Don't clear if tiebreaker games exist (this is the tiebreaker flow, not a vacate)
    if (wasComplete && !isComplete && matchId) {
      // Check if there are tiebreaker games
      const tiebreakerGames = Array.from(gameResults.values()).filter(g => g.is_tiebreaker);
      const hasTiebreakerGames = tiebreakerGames.length > 0;

      if (!hasTiebreakerGames) {
        supabase
          .from('matches')
          .update({
            home_team_verified_by: null,
            away_team_verified_by: null,
          })
          .eq('id', matchId)
          .then(({ error }) => {
            if (error) {
              logger.error('Error clearing verification status', { error: error.message });
            }
          });
      }
    }

    // Update ref for next comparison
    prevAllGamesCompleteRef.current = isComplete;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGamesComplete, matchId, homeThresholds, awayThresholds]);

  /**
   * Handle verify button click
   * Updates the appropriate verification column based on user's team
   * Uses optimistic update and refetch to update UI immediately
   */
  const handleVerify = async () => {
    if (!matchId || !memberId || isHomeTeam === null) {
      return;
    }

    setIsVerifying(true);

    try {
      // Detect if this is a tiebreaker by checking for tiebreaker games
      const tiebreakerGames = Array.from(gameResults.values()).filter(g => g.is_tiebreaker);
      const isTiebreakerMode = tiebreakerGames.length > 0;

      // Use appropriate verification column based on mode
      const updateField = isTiebreakerMode
        ? (isHomeTeam ? 'home_tiebreaker_verified_by' : 'away_tiebreaker_verified_by')
        : (isHomeTeam ? 'home_team_verified_by' : 'away_team_verified_by');

      // Optimistically update the UI immediately
      const queryKey = [...queryKeys.matches.detail(matchId), 'leagueSettings'];

      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          [updateField]: memberId,
        };
      });

      // Update database
      const { error } = await supabase
        .from('matches')
        .update({ [updateField]: memberId })
        .eq('id', matchId);

      if (error) throw error;

      // Don't refetch - realtime subscription will handle it for all users
      // This prevents race condition where refetch gets stale data
    } catch (err: any) {
      logger.error('Error verifying scores', { error: err instanceof Error ? err.message : String(err) });
      toast.error(`Failed to verify scores: ${err.message}`);
      // Rollback optimistic update on error
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.matches.detail(matchId), 'leagueSettings'],
      });
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Get display name for a player (nickname or first name)
   * Uses function from useMatchScoring hook
   */
  const getPlayerDisplayName = getPlayerDisplayNameFromHook;

  /**
   * Resolve the loser's display name for the currently-open scoring modal.
   * The modal opens with a winner already selected; the loser is whichever
   * player on that game's row is NOT the winner. Used by the scoring modal
   * to surface attribution disclosure ("Recorded as [Loser Name]") on
   * loss-cause events like Win-by-forfeit.
   *
   * Returns null when scoringGame is null (modal closed), the game record
   * isn't loaded yet, or the loser's player_id is unavailable. Modal
   * gracefully omits the attribution text in those cases.
   */
  const loserPlayerName = (() => {
    if (!scoringGame) return null;
    const game = gameResults.get(scoringGame.gameNumber);
    if (!game) return null;
    const loserPlayerId =
      scoringGame.winnerPlayerId === game.home_player_id
        ? game.away_player_id
        : game.home_player_id;
    return loserPlayerId ? getPlayerDisplayName(loserPlayerId) : null;
  })();

  /**
   * Get player stats (wins/losses) for a specific player and position
   * For 5v5: Filters by position to handle double duty players correctly
   * For 3v3: Position parameter ignored (uses getPlayerStatsUtil)
   *
   * @param playerId - Player's member ID
   * @param position - Lineup position (1-5) for 5v5
   * @param playerIsHomeTeam - Whether this specific player is on home team (true) or away team (false)
   */
  const getPlayerStats = (playerId: string, position?: number, playerIsHomeTeam?: boolean) => {
    // For 5v5 with position specified, use position-aware function
    if (position !== undefined && leaguePrefs?.lineup_size === 5 && playerIsHomeTeam !== undefined) {
      return getPlayerStatsByPosition(playerId, position, playerIsHomeTeam, gameResults);
    }
    // For 3v3 or no position specified, use original util
    return getPlayerStatsUtil(playerId, gameResults);
  };

  /**
   * Add to confirmation queue (from useMatchScoring hook)
   */
  const addToConfirmationQueue = addToConfirmationQueueFromHook;

  // Stabilize the match shape passed to mutations + downstream realtime
  // hooks. Phase 5 Unit 5.5 introduced per-game writes to the matches
  // row (running-totals updates), which makes matchQuery refetch on
  // every confirmation. Without this memo, every refetch produces a
  // new `match` object identity → callback identities change → the
  // realtime hook resubscribes → same event re-fires → flashing loop.
  // The mutations hook only needs id + home_team_id + away_team_id;
  // memoize on those primitives so identity is stable across refetches
  // that don't change them.
  const stableMatchForMutations = useMemo(
    () =>
      match
        ? {
            id: match.id,
            home_team_id: match.home_team_id,
            away_team_id: match.away_team_id,
          }
        : null,
    [match?.id, match?.home_team_id, match?.away_team_id],
  );

  // Use mutations hook for all database operations
  const mutations = useMatchScoringMutations({
    match: stableMatchForMutations,
    leagueId: match?.league?.id ?? null,
    gameResults,
    homeLineup,
    awayLineup,
    userTeamId,
    memberId: memberId || null,
    // gameType,
    autoConfirm,
    addToConfirmationQueue,
    getPlayerDisplayName,
  });

  // Store mutations in ref for use in real-time subscription callback
  mutationsRef.current = mutations;

  // Many-eyes Unit 4: pre-derive the per-person prompt context from
  // gameConfirmations + my memberId. The scan reads it via a cheap Set/Map
  // lookup per game (one pass over confirmations here, O(1) per game below).
  // Staleness is in the SAFE direction: a stale confirmations cache only
  // causes RE-prompts (the append's no-exact-dup guard absorbs them) — it
  // can never LOSE a prompt, preserving Layer-1's "delay possible, loss
  // impossible" guarantee on the data-derived handoff.
  const personalCtx = useMemo(
    () => buildPersonalConfirmContext(gameConfirmations, memberId ?? null),
    [gameConfirmations, memberId]
  );

  // Many-eyes Unit 5: per-game dissents (a vouch differs from the official
  // result). Pure derivation over the games + confirmations; the helper
  // already scopes confirms to those newer than the latest 'vacate' marker
  // so a vacate-and-rescore can't falsely flag pre-rescore agreers.
  const dissents = useMemo(() => {
    const gamesForDissent: GameForDissent[] = Array.from(gameResults.values()).map(
      (g) => ({
        game_id: g.id,
        game_number: g.game_number,
        hasWinner: !!g.winner_player_id,
        winner_team_id: g.winner_team_id,
        winner_player_id: g.winner_player_id,
        break_and_run: g.break_and_run,
        golden_break: g.golden_break,
        break_fouled: g.break_fouled,
        runout: g.runout,
        win_by_forfeit: g.win_by_forfeit,
        winner_value: g.winner_value,
        loser_value: g.loser_value,
      })
    );
    return deriveDissents(gamesForDissent, gameConfirmations);
  }, [gameResults, gameConfirmations]);

  // Show each flag only to the dissenter's TEAM (per brainstorm R8). My side is
  // 'home' when my team id matches the match's home team. A dissent surfaces if
  // any of its dissenters share my side.
  const visibleDissents = useMemo(() => {
    if (!match || !userTeamId) return [];
    const mySide: 'home' | 'away' =
      userTeamId === match.home_team_id ? 'home' : 'away';
    return dissents.filter((d) => d.dissenters.some((diss) => diss.side === mySide));
  }, [dissents, userTeamId, match]);

  // Many-eyes Amendment F: cleared games where two initiators disagreed.
  // Shown to EVERYONE (not filtered by side) — the integrity risk is high
  // enough that all devices should see it, not just the dissenter's team.
  const disputes = useMemo(() => {
    const gamesForDispute: GameForDispute[] = Array.from(gameResults.values()).map(
      (g) => ({
        game_id: g.id,
        game_number: g.game_number,
        hasWinner: !!g.winner_player_id,
      })
    );
    return deriveDisputes(gamesForDispute, gameConfirmations);
  }, [gameResults, gameConfirmations]);

  // ── State-derived confirmation + vacate handoff ─────────────────────────
  // Neither prompt may depend on catching a live realtime message. On every
  // games change (initial load, realtime tick, catch-up refetch, or the
  // degraded polling fallback), scan for games that need MY action and surface
  // the right prompt — so a dropped/missed event (StrictMode remount, socket
  // blip, refresh) can delay the prompt by a few seconds but can never lose it.
  // Two kinds of pending action, both derived from the row:
  //   • the opponent scored a game I haven't (PERSONALLY) confirmed → confirm prompt
  //     (Phase 2 per-person: each confirming-side member is prompted until
  //     they personally vouch, so several can tap to confirm — many-eyes)
  //   • the opponent asked to vacate (undo) a game                  → vacate prompt
  // Realtime stays the fast path; this is the self-healing backstop. Deduped
  // against the queue, the open modal, the game I'm editing, my own in-flight
  // vacate requests, and games I just acted on (handledConfirmations).
  useEffect(() => {
    if (!userTeamId || !match) return;
    gameResults.forEach((game) => {
      const action = decidePendingAction(
        game,
        userTeamId,
        match.home_team_id,
        autoConfirm,
        personalCtx
      );
      if (action === 'none') {
        // Server caught up (confirmed/vacated/denied) — re-arm for next time.
        handledConfirmations.current.delete(game.game_number);
        return;
      }
      if (confirmationGame?.gameNumber === game.game_number) return; // showing
      if (confirmationQueue.some((c) => c.gameNumber === game.game_number)) return; // queued
      if (editingGame?.gameNumber === game.game_number) return; // I'm editing it
      // Amendment H: my own initiator modal is open for this game — my submit
      // will trigger Amendment D's race-handling, so don't stack a confirm prompt.
      if (scoringGame?.gameNumber === game.game_number) return;
      if (myVacateRequests.current.has(game.game_number)) return; // my own action
      if (handledConfirmations.current.has(game.game_number)) return; // just acted

      if (action === 'vacate') {
        // Vacating is destructive — always a human decision, never auto.
        addToConfirmationQueueFromHook(buildVacateConfirmationItem(game, players));
      } else if (action === 'autoconfirm') {
        // The single auto-confirm site (the realtime fast-path defers to here).
        // Mark handled BEFORE the async write so a refetch in the propagation
        // window can't re-fire it; clear it back out if the write fails so the
        // game re-arms instead of silently sticking unconfirmed.
        const gameNumber = game.game_number;
        handledConfirmations.current.add(gameNumber);
        void mutationsRef.current
          ?.confirmOpponentScore(gameNumber)
          .then((ok) => {
            if (!ok) handledConfirmations.current.delete(gameNumber);
          });
      } else {
        addToConfirmationQueueFromHook(buildConfirmationItem(game, players));
      }
    });
    // myVacateRequests / handledConfirmations / mutationsRef are refs (stable).
  }, [
    gameResults,
    userTeamId,
    match,
    confirmationGame,
    confirmationQueue,
    editingGame,
    scoringGame,
    autoConfirm,
    players,
    personalCtx,
    addToConfirmationQueueFromHook,
  ]);

  /**
   * Handle player button click to score a game
   * Delegates to mutations hook
   */
  const handlePlayerClick = (
    gameNumber: number,
    playerId: string,
    playerName: string,
    teamId: string
  ) => {
    mutations.handlePlayerClick(
      gameNumber,
      playerId,
      playerName,
      teamId,
      (game) => {
        setScoringGame(game);
        setBreakAndRun(false);
        setGoldenBreak(false);
      },
      (gameNumber) => mutations.confirmOpponentScore(gameNumber)
    );
  };

  /**
   * Handle swap player action from scoreboard.
   * Opens modal to select replacement player and request lineup change.
   * Only available for players who haven't played any games yet (0 wins, 0 losses).
   *
   * @param playerId - The player ID to swap out
   * @param position - The lineup position (1-5) of the player
   */
  const handleSwapPlayer = (playerId: string, position: number) => {
    // Get the player name for display
    const playerName = getPlayerDisplayName(playerId);
    setLineupChangeData({ playerId, playerName, position });
  };

  /**
   * Handle lineup change request submission
   * Sends request to opponent for approval
   */
  const handleLineupChangeRequest = async (newPlayerId: string) => {
    if (!userLineup || !lineupChangeData) return;

    // Get the new player's handicap from the cached handicaps (calculated via usePlayerHandicaps)
    // This uses TanStack Query caching - likely already calculated from lineup page
    const newPlayerHandicap = rosterHandicaps.get(newPlayerId)?.value ?? 0;

    requestLineupChangeMutation.mutate({
      lineupId: userLineup.id,
      position: lineupChangeData.position,
      newPlayerId,
      newPlayerHandicap,
    });
  };

  /**
   * Handle approving opponent's lineup change request
   */
  const handleApproveLineupChange = () => {
    if (!opponentLineup) return;
    approveLineupChangeMutation.mutate(opponentLineup.id);
  };

  /**
   * Handle denying opponent's lineup change request
   */
  const handleDenyLineupChange = () => {
    if (!opponentLineup) return;
    denyLineupChangeMutation.mutate(opponentLineup.id);
  };

  // Early returns for loading/error states.
  // Match-prepared readiness is handled upstream by MatchPhaseGuard
  // (see src/components/match/MatchPhaseGuard.tsx). The guard only
  // renders this body when matches.status='in_progress', so the prior
  // 10-retry waiting loop here was redundant once the guard wired in
  // and is now removed.
  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-foreground">
            Loading match...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // The "lineups must be locked" branch that used to navigate back to
    // /match/:id/lineup from here was deleted: the route guard
    // (MatchPhaseGuard) is now the authoritative redirect mechanism, and
    // calling navigate() during render is a React anti-pattern that
    // could create an oscillating /score↔/lineup loop if matches.status
    // happens to be 'in_progress' while a lineup is unlocked. Surface
    // any error here as the regular error card; the guard handles
    // routing on the next mount.
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600 mb-2">
                Error
              </div>
              <div className="text-foreground mb-4">{error}</div>
              <Button loadingText="none" onClick={() => navigate(-1)}>Go Back</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Match-prepared data is guaranteed by MatchPhaseGuard before this
  // body renders. If a downstream query genuinely fails (network, RLS,
  // server error), the guard's MatchTransitionRecovery surface fires
  // — not a bespoke error card here.
  //
  // The narrowing return below mostly satisfies TypeScript: with the
  // guard upstream, none of these should be null in practice. If they
  // somehow are, render a brief loading spinner so the body doesn't
  // attempt to deref nulls. This is a fallback, not a normal path.
  if (!match || !homeLineup || !awayLineup || !homeThresholds || !awayThresholds) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  // Filter games based on mode (normal vs tiebreaker)
  // Only switch to tiebreaker mode when ALL conditions are met:
  // 1. Match result is 'tie'
  // 2. Both lineups are locked (players selected)
  // 3. Tiebreaker games exist
  // This ensures MatchEndVerification stays mounted during tie verification
  const tiebreakerGamesExist = Array.from(gameResults.values()).some(g => g.is_tiebreaker);
  const bothLineupsLocked = homeLineup?.locked && awayLineup?.locked;
  const isTiebreakerMode = match.match_result === 'tie' && bothLineupsLocked && tiebreakerGamesExist;
  const filteredGameResults = isTiebreakerMode
    ? new Map(
        Array.from(gameResults.entries()).filter(([gameNumber]) =>
          gameNumber >= 19 && gameNumber <= 21
        )
      )
    : gameResults;

  // Lineup size and win condition come from the resolved preferences.
  // Per Unit 5 of the unified-scoreboard plan, the dispatch never branches
  // on `lineup_size === 5` or `handicap_type === 'fargo'` — those would
  // re-introduce the n×m matrix the modular system kills. The unified
  // scoreboard renders for any lineup_size + win_condition + calculator
  // combination, including off-preset combos.
  const lineupSize = leaguePrefs?.lineup_size ?? 5;
  const winCondition = leaguePrefs?.win_condition ?? 'games';

  // Team stats (wins / losses) for the scoreboard. Wins read from match-row
  // running totals; losses are derived (no _games_lost column on match).
  const homeStats = getTeamStats(match.home_team_id, filteredGameResults);
  const awayStats = getTeamStats(match.away_team_id, filteredGameResults);

  // Per-player points closure — passed to UnifiedScoreboard ONLY when the
  // active calculator is per-game (e.g. accumulated_per_game). For aggregate
  // calculators the closure is unused; the player drawer hides the per-player
  // P column entirely. Per Ed's framing during review: "if each player earns
  // points then show points; if it's team-based then don't show it."
  const calculatorName = match.system_snapshot?.points_calculator;
  const activeCalculator = calculatorName ? getCalculator(calculatorName) : null;
  const isPerGameCalculator = activeCalculator?.kind === 'per_game';
  const fargoOverrides =
    match.system_snapshot?.overrides ?? leaguePrefs?.system_overrides ?? {};
  const fargoWinnerPoints =
    typeof fargoOverrides.winner_points === 'number'
      ? fargoOverrides.winner_points
      : 10;
  const getPlayerPoints = (
    playerId: string,
    position: number,
    playerIsHomeTeam: boolean,
  ): number => {
    let total = 0;
    for (const game of filteredGameResults.values()) {
      if (!game.winner_team_id) continue;
      const positionField = playerIsHomeTeam ? game.home_position : game.away_position;
      const idField = playerIsHomeTeam ? game.home_player_id : game.away_player_id;
      if (idField !== playerId) continue;
      if (positionField !== position) continue;
      const teamId = playerIsHomeTeam ? match.home_team_id : match.away_team_id;
      if (game.winner_team_id === teamId) {
        total += fargoWinnerPoints;
      } else if (game.loser_value !== null && game.loser_value !== undefined) {
        total += game.loser_value;
      }
    }
    return total;
  };

  return (
    <div className="h-screen flex flex-col bg-muted">
      {/* Header with back button, team name, and auto-confirm */}
      <div className="bg-card border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/my-teams')}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            My Teams
          </Button>
          {/* Team Name */}
          <div className="text-lg font-semibold text-foreground">
            {isHomeTeam ? match.home_team?.team_name : match.away_team?.team_name}
          </div>
          <div className="flex items-center gap-2">
            {/* Calm connection indicator — renders nothing while healthy, a
                quiet "catching up" pill while degraded, one calm note on a
                sustained outage. Active scorer only (this is the scoring page). */}
            <ConnectionIndicator health={connectionHealth} />
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="w-3 h-3"
              />
              Auto-Confirm
            </label>
            <InfoButton title="Auto-Confirm Opponent Selections" className="relative">
              <p className="text-sm">
                By enabling this your opponents game result selections will automatically be confirmed for your team. Your team is still responsible for ensuring the scoring is accurate. This option simply removes the need to confirm each game individually.
              </p>
            </InfoButton>
          </div>
        </div>
      </div>

      {/* Table Number Bar — clickable to change. Hosts the scoring-tips info
          button on the LEFT (mirrors the spectator "Live" link on the right
          for visual balance) and the spectator link on the right when we
          have a league ID. */}
      <TableNumberBar
        matchId={matchId!}
        tableNumber={match.assigned_table_number}
        spectatorLeagueId={match.league?.id ?? null}
        leftSlot={
          <InfoButton title="Scoring Tips">
            <p className="text-sm mb-2">
              <strong>Player Stats:</strong> Tap either team name to view individual player
              stats for the lineup. Tap again to close.
            </p>
            <p className="text-sm mb-2">
              <strong>Thresholds:</strong> The win/tie/lose thresholds appear inside the player
              drawer alongside the team rows.
            </p>
            <p className="text-sm">
              <strong>Calculator hints:</strong> Markers like "Milestone bonus" come from the
              league's points calculator. They appear only when the calculator declares them.
            </p>
          </InfoButton>
        }
      />

      {/* Scoreboard — Fixed at top.
          Unit 5 of the unified-scoreboard plan collapsed the prior 4-branch
          ternary (3v3 / 5v5 / 10-7 / tiebreaker) into a single dispatch:
          tiebreaker stays separate (different game-set semantics), all
          regular play flows through UnifiedScoreboard which adapts via
          win_condition + points_calculator + lineup_size from the snapshot. */}
      {isTiebreakerMode ? (
        <TiebreakerScoreboard
          match={{
            ...match,
            home_team_verified_by: (match as any).home_team_verified_by ?? null,
            away_team_verified_by: (match as any).away_team_verified_by ?? null,
          }}
          gameResults={filteredGameResults}
          isHomeTeam={isHomeTeam ?? false}
          onVerify={handleVerify}
          isVerifying={isVerifying}
          gameType={gameType}
        />
      ) : (
        <UnifiedScoreboard
          match={{
            ...match,
            home_team_verified_by: (match as any).home_team_verified_by ?? null,
            away_team_verified_by: (match as any).away_team_verified_by ?? null,
          }}
          homeLineup={homeLineup}
          awayLineup={awayLineup}
          homeThresholds={homeThresholds}
          awayThresholds={awayThresholds}
          homeLosses={homeStats.losses}
          awayLosses={awayStats.losses}
          allGamesComplete={allGamesComplete}
          isHomeTeam={isHomeTeam ?? false}
          onVerify={handleVerify}
          isVerifying={isVerifying}
          gameType={gameType}
          winCondition={winCondition}
          lineupSize={lineupSize}
          pointsCalculator={leaguePrefs?.points_calculator ?? null}
          getPlayerDisplayName={getPlayerDisplayName}
          getPlayerStats={getPlayerStats}
          onSwapPlayer={handleSwapPlayer}
          // Per-player points only for per-game calculators (e.g.
          // accumulated_per_game for Fargo 10-7). Aggregate calculators
          // (linear_above_threshold, accumulate_with_milestone_jumps)
          // get undefined here, hiding the P column entirely.
          getPlayerPoints={isPerGameCalculator ? getPlayerPoints : undefined}
        />
      )}

      {/* Many-eyes Layer-2 / Amendment F + G: persistent dispute banner +
          tap-to-see-conflicts detail modal. Auto-cleared games (two initiators
          disagreed via Amendment D) surface here — loud, visible to everyone,
          ordered above dissent flags because the integrity risk is higher.
          Tapping a row opens the side-by-side detail modal (Amendment G).
          Re-scoring happens via the normal player-tap flow in the games list
          (the modal is informational; no Re-score button by design). */}
      <DisputeBanner
        disputes={disputes}
        onDisputeClick={setDisputeDetailGameId}
      />
      <DisputeDetailModal
        dispute={
          disputeDetailGameId
            ? disputes.find((d) => d.game_id === disputeDetailGameId) ?? null
            : null
        }
        onOpenChange={(open) => {
          if (!open) setDisputeDetailGameId(null);
        }}
        getPlayerDisplayName={getPlayerDisplayName}
      />

      {/* Many-eyes Layer-2 / Unit 5: team-visible dissent flag.
          One flag per game with a differing vouch from my side; calm
          conversation prompt — never blocks scoring, never auto-changes
          a result. Correction path is the existing vacate-and-rescore. */}
      {visibleDissents.length > 0 && (
        <div className="mb-3 space-y-2">
          {visibleDissents.map((d) => {
            // The recorded (official) result the flag asks people to verify
            // comes from the match_games row — same source the rest of the
            // scoring UI shows.
            const official = gameResults.get(d.game_number);
            if (!official || !official.winner_player_id) return null;
            return (
              <DissentFlag
                key={d.game_id}
                gameNumber={d.game_number}
                recordedResult={{
                  winner_team_id: official.winner_team_id,
                  winner_player_id: official.winner_player_id,
                  break_and_run: official.break_and_run,
                  golden_break: official.golden_break,
                  break_fouled: official.break_fouled,
                  runout: official.runout,
                  win_by_forfeit: official.win_by_forfeit,
                  winner_value: official.winner_value,
                  loser_value: official.loser_value,
                }}
                winnerPlayerName={getPlayerDisplayName(official.winner_player_id)}
                agreeingConfirmerNames={d.agreeingConfirmers.map((a) =>
                  getPlayerDisplayName(a.confirmer_id)
                )}
                disagreeingConfirmerNames={d.dissenters.map((diss) =>
                  getPlayerDisplayName(diss.confirmer_id)
                )}
              />
            );
          })}
        </div>
      )}

      {/* Game list section - ALL data from database */}
      <GamesList
        gameResults={filteredGameResults}
        getPlayerDisplayName={getPlayerDisplayName}
        onGameClick={handlePlayerClick}
        onVacateClick={(gameNumber, winnerName) => {
          setEditingGame({
            gameNumber,
            currentWinnerName: winnerName,
          });
        }}
        onVacateRequestClick={(gameNumber, winnerName) => {
          // When opponent clicks "Vacate Request" button, open confirmation dialog.
          // Forward every scored field so the dialog can show the full detail.
          const game = gameResults.get(gameNumber);
          if (game) {
            setConfirmationGame({
              gameNumber,
              winnerPlayerName: winnerName,
              breakAndRun: game.break_and_run,
              goldenBreak: game.golden_break,
              breakFouled: game.break_fouled,
              runout: game.runout,
              winByForfeit: game.win_by_forfeit,
              winnerValue: game.winner_value,
              loserValue: game.loser_value,
              isVacateRequest: true,
            });
          }
        }}
        homeTeamId={match.home_team_id}
        awayTeamId={match.away_team_id}
        totalGames={filteredGameResults.size}
        isHomeTeam={isHomeTeam}
      />

      {/* Win Confirmation Modal */}
      <ScoringDialog
        open={scoringGame !== null}
        game={scoringGame}
        breakAndRun={breakAndRun}
        goldenBreak={goldenBreak}
        goldenBreakCountsAsWin={goldenBreakCountsAsWin}
        gameType={gameType}
        handicapType={handicapType}
        pointsCalculator={resolvedPointsCalculator}
        pointsCalculatorParams={resolvedPointsCalculatorParams}
        breakFouled={breakFouled}
        winByForfeit={winByForfeit}
        runout={runout}
        loserValue={loserValue}
        winnerValue={winnerValue}
        loserPlayerName={loserPlayerName}
        onBreakAndRunChange={(checked) => {
          setBreakAndRun(checked);
          if (checked) setGoldenBreak(false);
        }}
        onGoldenBreakChange={(checked) => {
          setGoldenBreak(checked);
          if (checked) setBreakAndRun(false);
        }}
        onBreakFouledChange={setBreakFouled}
        onWinByForfeitChange={setWinByForfeit}
        onRunoutChange={setRunout}
        onLoserValueChange={setLoserValue}
        onWinnerValueChange={setWinnerValue}
        onCancel={() => {
          setScoringGame(null);
          setBreakAndRun(false);
          setGoldenBreak(false);
          setBreakFouled(false);
          setWinByForfeit(false);
          setRunout(false);
          setLoserValue(null);
          setWinnerValue(null);
        }}
        onConfirm={() => {
          if (scoringGame) {
            mutations.handleConfirmScore(
              scoringGame,
              breakAndRun,
              goldenBreak,
              () => {
                setScoringGame(null);
                setBreakAndRun(false);
                setGoldenBreak(false);
                setBreakFouled(false);
                setWinByForfeit(false);
                setRunout(false);
                setLoserValue(null);
                setWinnerValue(null);
              },
              { breakFouled, runout, winByForfeit, winnerValue, loserValue }
            );
          }
        }}
      />

      {/* Opponent Confirmation Modal */}
      <ConfirmationDialog
        open={confirmationGame !== null}
        game={confirmationGame}
        gameType={gameType}
        onConfirm={(gameNumber, isVacateRequest) => {
          // Mark handled so the state-derived scan doesn't re-pop this game
          // during the ~500ms before the write propagates back; clear it again
          // if the write fails so the prompt re-arms instead of sticking.
          handledConfirmations.current.add(gameNumber);
          void mutations
            .confirmOpponentScore(gameNumber, isVacateRequest)
            .then((ok) => {
              if (!ok) handledConfirmations.current.delete(gameNumber);
            });
        }}
        onDeny={(gameNumber, isVacateRequest) => {
          handledConfirmations.current.add(gameNumber);
          void mutations
            .denyOpponentScore(gameNumber, isVacateRequest)
            .then((ok) => {
              if (!ok) handledConfirmations.current.delete(gameNumber);
            });
        }}
        onClose={() => setConfirmationGame(null)}
      />

      {/* Vacate Winner Modal */}
      <EditGameDialog
        open={editingGame !== null}
        game={
          editingGame
            ? {
                gameNumber: editingGame.gameNumber,
                winnerPlayerName: editingGame.currentWinnerName,
                gameId: gameResults.get(editingGame.gameNumber)?.id || '',
              }
            : null
        }
        myVacateRequests={myVacateRequests.current}
        onVacate={async (gameNumber, gameId) => {
          try {
            // Track that I initiated this vacate request (to suppress my own confirmation modal)
            myVacateRequests.current.add(gameNumber);

            // Vacate request: Set vacate_requested_by flag
            // This preserves original confirmations while indicating vacate request
            const { error } = await supabase
              .from('match_games')
              .update({
                vacate_requested_by: isHomeTeam ? 'home' : 'away',
              })
              .eq('id', gameId);

            if (error) throw error;

            // Force refetch to update UI immediately (real-time subscription suppresses own updates)
            queryClient.invalidateQueries({ queryKey: queryKeys.matches.games(matchId || '') });
          } catch (err: any) {
            logger.error('Error requesting reset', { error: err instanceof Error ? err.message : String(err) });
            toast.error(`Failed to request reset: ${err.message}`);
          }
        }}
        onClose={() => setEditingGame(null)}
      />

      {/* Lineup Change Request Modal - for selecting replacement player */}
      {userLineup && (
        <LineupChangeModal
          isOpen={lineupChangeData !== null}
          currentPlayer={lineupChangeData ? {
            id: lineupChangeData.playerId,
            name: lineupChangeData.playerName,
            position: lineupChangeData.position,
          } : { id: '', name: '', position: 0 }}
          lineup={userLineup}
          teamRoster={teamRoster}
          onSubmit={handleLineupChangeRequest}
          onCancel={() => setLineupChangeData(null)}
          isSubmitting={requestLineupChangeMutation.isPending}
        />
      )}

      {/* Lineup Change Approval Modal - shown when opponent requests a change */}
      <LineupChangeRequestModal
        isOpen={!!(opponentLineup?.swap_position)}
        requestingTeamName={isHomeTeam ? (match.away_team?.team_name || 'Opponent') : (match.home_team?.team_name || 'Opponent')}
        position={opponentLineup?.swap_position || 0}
        oldPlayerName={opponentLineup?.swap_position
          ? getPlayerDisplayName((opponentLineup as any)[`player${opponentLineup.swap_position}_id`])
          : ''}
        newPlayerName={opponentLineup?.swap_new_player_id
          ? getPlayerDisplayName(opponentLineup.swap_new_player_id)
          : ''}
        onApprove={handleApproveLineupChange}
        onDeny={handleDenyLineupChange}
        isProcessing={approveLineupChangeMutation.isPending || denyLineupChangeMutation.isPending}
      />

    </div>
  );
}

/**
 * Public export. The route guard reads `matches.status` and dispatches
 * lineup vs scoring vs recovery; on a status flip it navigates the user
 * to the right surface. Children receive a compound `key` so cross-match
 * navigation and Hard Reset both fully remount this body.
 */
export function ScoreMatch() {
  return (
    <MatchPhaseGuard>
      <ScoreMatchBody />
    </MatchPhaseGuard>
  );
}
