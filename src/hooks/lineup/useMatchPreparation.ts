/**
 * @fileoverview Hook for match preparation and auto-navigation
 *
 * Handles the automatic match preparation when both lineups are locked.
 * Only the HOME team performs the preparation to avoid race conditions.
 * Creates game rows and calculates handicap thresholds.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { calculateHandicapThresholds } from '@/utils/calculateHandicapThresholds';
import { generateGameOrder } from '@/utils/gameOrder';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { SystemOverrides } from '@/types/systemOverrides';
import { isAnySubSentinel, type PrepBlockedReason } from '@/utils/lineup';

export function usePreparationStatus() {
  const [isPreparingMatch, setIsPreparingMatch] = useState(false);
  const [preparationMessage, setPreparationMessage] = useState('');
  return { isPreparingMatch, setIsPreparingMatch, preparationMessage, setPreparationMessage };
}

interface MatchPreparationParams {
  lineupLocked: boolean;
  opponentLineup: any;
  matchId: string | undefined;
  matchData: any;
  isHomeTeam: boolean;
  lineupSize: number;
  handicapType: string;
  /** Resolved per-league dial overrides. Used by Fargo threshold compute. */
  systemOverrides?: SystemOverrides;
  /**
   * Discriminated reason for blocking match preparation. When non-null, the
   * effect short-circuits — the UI renders the corresponding waiting state.
   * Supersedes the prior `fargoNegotiationBlocking` flag and covers all
   * blocking conditions (Step 1 completeness, sub resolution, Fargo).
   */
  blockedReason?: PrepBlockedReason;
  /**
   * game_generation preference from useResolvedLeaguePrefs. Drives
   * expectedGameCount for both the home team's insert count and the away
   * team's realtime wait condition. Defaults to 'double_round_robin' if
   * omitted — matches the historical 3v3 behavior.
   */
  gameGeneration?: string;
  /**
   * Cached length of matchGamesQuery.data at render time. The home-team
   * idempotency short-circuit reads this synchronously before firing any
   * side effects, so browser-back re-entry after successful prep skips
   * the overlay entirely and redirects to scoring.
   */
  currentGamesCount?: number;
  player1Id: string;
  player2Id: string;
  player3Id: string;
  player1Handicap: number;
  player2Handicap: number;
  player3Handicap: number;
  player4Id?: string; // 5v5 only
  player5Id?: string; // 5v5 only
  player4Handicap?: number; // 5v5 only
  player5Handicap?: number; // 5v5 only
  setIsPreparingMatch?: (preparing: boolean) => void;
  setPreparationMessage?: (message: string) => void;
  refetchLineups?: () => Promise<any>;
  refetchGames?: () => Promise<any>;
}

export function useMatchPreparation(params: MatchPreparationParams) {
  const {
    lineupLocked,
    opponentLineup,
    matchId,
    matchData,
    isHomeTeam,
    lineupSize,
    handicapType,
    blockedReason,
    gameGeneration,
    currentGamesCount,
    player1Id,
    player2Id,
    player3Id,
    player1Handicap,
    player2Handicap,
    player3Handicap,
    player4Id,
    player5Id,
    player4Handicap,
    player5Handicap,
    setIsPreparingMatch,
    setPreparationMessage,
    refetchGames,
  } = params;

  const navigate = useNavigate();
  const matchPreparedRef = useRef(false);
  const awayRetryCountRef = useRef(0);
  const awayToastIdRef = useRef<string | number | null>(null);

  // Auto-navigate to scoring when both lineups are locked and the gate is clear.
  // Only HOME team runs the transactional prep_match RPC; AWAY team waits on
  // realtime row visibility (see Unit 5 below) and navigates when games appear.
  useEffect(() => {
    // Gate: blockedReason covers completeness + sub resolution + Fargo consensus.
    if (blockedReason !== null && blockedReason !== undefined) return;
    if (!lineupLocked || !opponentLineup?.locked) return;
    if (matchPreparedRef.current) return;
    if (!matchId) return;

    // Compute expectedGameCount from prefs — deterministic from lineupSize
    // + gameGeneration. No hardcoded 18/25.
    const useDoubleRoundRobin = (gameGeneration ?? 'double_round_robin') === 'double_round_robin';
    const expectedGameCount = generateGameOrder(lineupSize, useDoubleRoundRobin).length;

    // Synchronous idempotency / ready short-circuit. Fires for both home and
    // away: if games already exist at the expected count (or above, e.g.
    // tiebreaker rows 19-21), navigate immediately. No overlay flash on
    // re-entry, AND this is the knowledge-driven away-team navigation — we
    // only advance when we can OBSERVE that games exist, never on a timeout.
    if (typeof currentGamesCount === 'number' && currentGamesCount >= expectedGameCount) {
      if (!matchPreparedRef.current) {
        matchPreparedRef.current = true;
        // Clear any pending retry-exhausted toast so it doesn't linger post-navigation
        if (awayToastIdRef.current !== null) {
          toast.dismiss(awayToastIdRef.current);
          awayToastIdRef.current = null;
        }
        setIsPreparingMatch?.(false);
        navigate(`/match/${matchId}/score`);
      }
      return;
    }

    // Away team: watch for games to appear via realtime. The effect re-runs
    // every time currentGamesCount changes (realtime triggers matchGamesQuery
    // refetch → prop update → re-run). When count crosses expectedGameCount,
    // the short-circuit above fires and we navigate. While waiting, show
    // the overlay and run a 10s fallback loop that refetches on each tick —
    // NEVER navigates speculatively. After 3 fruitless refetches, surface
    // a persistent toast and dismiss the overlay.
    if (!isHomeTeam) {
      setIsPreparingMatch?.(true);
      setPreparationMessage?.('Waiting for match to be set up...');

      const MAX_RETRIES = 3;
      const FALLBACK_MS = 10_000;
      let cancelled = false;
      let pendingTimer: number | null = null;

      const scheduleNext = () => {
        if (cancelled) return;
        pendingTimer = window.setTimeout(async () => {
          if (cancelled) return;
          awayRetryCountRef.current += 1;
          if (awayRetryCountRef.current > MAX_RETRIES) {
            setIsPreparingMatch?.(false);
            const tid = toast.error(
              "Match setup didn't complete. Contact the opposing captain or try again.",
              { duration: Infinity }
            );
            awayToastIdRef.current = tid;
            return;
          }
          await refetchGames?.();
          // If refetch produced new rows, the prop change re-runs this effect
          // and the cleanup below cancels us. Otherwise, schedule another tick.
          if (!cancelled) scheduleNext();
        }, FALLBACK_MS);
      };
      scheduleNext();

      return () => {
        cancelled = true;
        if (pendingTimer !== null) window.clearTimeout(pendingTimer);
      };
    }

    // Home team: transactional prep via prep_match RPC with 3-attempt retry.
    const prepareAndNavigate = async () => {
      if (!matchData || !opponentLineup) return;
      matchPreparedRef.current = true;
      setIsPreparingMatch?.(true);
      setPreparationMessage?.('Setting up the match...');

      try {
        // Snapshot MY lineup from the latest props — caller has already
        // re-read lineups via the blockedReason gate, so state is fresh.
        const myLineup: Record<string, unknown> = {
          player1_id: player1Id || null,
          player1_handicap: player1Handicap,
          player2_id: player2Id || null,
          player2_handicap: player2Handicap,
          player3_id: player3Id || null,
          player3_handicap: player3Handicap,
        };
        if (lineupSize >= 4) {
          myLineup.player4_id = player4Id || null;
          myLineup.player4_handicap = player4Handicap ?? 0;
        }
        if (lineupSize >= 5) {
          myLineup.player5_id = player5Id || null;
          myLineup.player5_handicap = player5Handicap ?? 0;
        }

        // Compute threshold payload per handicap system.
        let thresholdPayload: Record<string, number | null>;
        if (handicapType === 'fargo') {
          // Fargo: by this point the negotiation has already written the agreed
          // start points to the weaker team's *_games_to_tie and stamped both
          // *_games_to_lose with confirming captain numbers (that's what gated
          // us through blockedReason). prep_match only needs to fill in the
          // race target on *_games_to_win; we leave to_tie / to_lose untouched.
          //
          // TODO: pull race target from prefs once Fargo race-to-N becomes
          // configurable. 10 is the standard Fargo 5v5 race today.
          const FARGO_RACE_TARGET = 10;
          thresholdPayload = {
            home_games_to_win: FARGO_RACE_TARGET,
            home_games_to_tie: matchData?.home_games_to_tie ?? null,
            home_games_to_lose: matchData?.home_games_to_lose ?? null,
            away_games_to_win: FARGO_RACE_TARGET,
            away_games_to_tie: matchData?.away_games_to_tie ?? null,
            away_games_to_lose: matchData?.away_games_to_lose ?? null,
          };
        } else {
          const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
            myLineup as any,
            opponentLineup,
            matchData.home_team_id,
            matchData.away_team_id,
            matchData.season_id,
            handicapType
          );
          thresholdPayload = {
            home_games_to_win: homeThresholds.games_to_win,
            home_games_to_tie: homeThresholds.games_to_tie,
            home_games_to_lose: homeThresholds.games_to_lose,
            away_games_to_win: awayThresholds.games_to_win,
            away_games_to_tie: awayThresholds.games_to_tie,
            away_games_to_lose: awayThresholds.games_to_lose,
          };
        }

        // Build game rows from fresh lineup data. Do NOT use stale component props.
        const allGames = generateGameOrder(lineupSize, useDoubleRoundRobin);
        const homeLineup = isHomeTeam ? myLineup : opponentLineup;
        const awayLineup = isHomeTeam ? opponentLineup : myLineup;
        const gameRows = allGames.map((game) => ({
          game_number: game.gameNumber,
          game_type: matchData?.league?.game_type || 'eight_ball',
          home_player_id: (homeLineup as any)[`player${game.homePlayerPosition}_id`],
          away_player_id: (awayLineup as any)[`player${game.awayPlayerPosition}_id`],
          home_position: game.homePlayerPosition,
          away_position: game.awayPlayerPosition,
          home_action: game.homeAction,
          away_action: game.awayAction,
        }));

        // Pre-insert placeholder guard: the Step 1 gate should have prevented
        // any sub sentinel from reaching this path. If one does, it's a
        // latent bug — surface it loudly rather than silently corrupting data.
        const hasPlaceholder = gameRows.some(
          (r) => isAnySubSentinel(r.home_player_id) || isAnySubSentinel(r.away_player_id)
        );
        if (hasPlaceholder) {
          logger.error('prep_match guard tripped: sentinel UUID in gameRows', {
            matchId,
            sampleRow: gameRows.find(
              (r) => isAnySubSentinel(r.home_player_id) || isAnySubSentinel(r.away_player_id)
            ),
          });
          toast.error('Match setup hit an unexpected state — please report this. Returning to lineup.');
          setIsPreparingMatch?.(false);
          matchPreparedRef.current = false;
          return;
        }

        // Call the transactional RPC with 3-attempt exponential backoff.
        // Each attempt is atomic — failures leave zero partial state.
        const MAX_ATTEMPTS = 3;
        let rpcError: string | null = null;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          if (attempt > 0) {
            const backoffMs = 300 * Math.pow(2, attempt - 1); // 300, 600, 1200
            await new Promise((r) => setTimeout(r, backoffMs));
          }
          const { error } = await supabase.rpc('prep_match', {
            p_match_id: matchId,
            p_thresholds: thresholdPayload,
            p_game_rows: gameRows,
          });
          if (!error) {
            setIsPreparingMatch?.(false);
            navigate(`/match/${matchId}/score`);
            return;
          }
          rpcError = error.message;
          logger.error('prep_match attempt failed', { matchId, attempt, error: rpcError });
        }

        // All retries exhausted.
        logger.error('prep_match failed after all retries', { matchId, error: rpcError });
        toast.error('Match setup failed — please try again.');
        setIsPreparingMatch?.(false);
        matchPreparedRef.current = false;
      } catch (error: any) {
        logger.error('Error preparing match', {
          error: error instanceof Error ? error.message : String(error),
          matchId,
          isHomeTeam,
        });
        toast.error(`Failed to prepare match: ${error.message ?? 'unknown error'}`);
        setIsPreparingMatch?.(false);
        matchPreparedRef.current = false;
      }
    };

    prepareAndNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    blockedReason,
    lineupLocked,
    opponentLineup,
    matchId,
    currentGamesCount,
  ]);
}
