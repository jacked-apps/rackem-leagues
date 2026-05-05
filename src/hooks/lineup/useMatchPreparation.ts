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
import { computeFargoGamesWonThresholds } from '@/utils/handicap/fargoGamesWonThresholds';
import { generateGameOrder } from '@/utils/gameOrder';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { SystemOverrides } from '@/types/systemOverrides';
import { isDoubleDutySentinel, type PrepBlockedReason } from '@/utils/lineup';

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
  /**
   * Win-condition axis from the resolved preferences. Drives threshold
   * dispatch — Fargo + win_condition='games' + mechanism='extra_games'
   * routes through `computeFargoGamesWonThresholds`; Fargo +
   * win_condition='points' + mechanism='start_points' uses the existing
   * negotiation path. Phase 3 Unit 3.2 of the v2 plan. Defaults to
   * 'games' when omitted (matches the typical BCA-preset default).
   */
  winCondition?: 'games' | 'points';
  /**
   * Threshold-mechanism axis. Combined with `winCondition` to pick the
   * right threshold computation. 'extra_games' (BCA / Fargo-games-won),
   * 'start_points' (Fargo-points), 'race_length_adjustment' (BCAPL SL,
   * not yet wired here), 'none' (no handicap).
   */
  mechanism?: 'extra_games' | 'start_points' | 'race_length_adjustment' | 'none';
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
    winCondition,
    mechanism,
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
    // away whenever games exist for this match.
    //
    // We use `> 0` rather than `>= expectedGameCount` because prep_match is
    // atomic — either zero rows or the full set. If any rows exist, all of
    // them do. Using a strict equality risks missing the navigation if
    // home/away compute different expected counts (e.g. resolved-prefs
    // staleness on one side).
    if (typeof currentGamesCount === 'number' && currentGamesCount > 0) {
      if (!matchPreparedRef.current) {
        matchPreparedRef.current = true;
        if (awayToastIdRef.current !== null) {
          toast.dismiss(awayToastIdRef.current);
          awayToastIdRef.current = null;
        }
        setIsPreparingMatch?.(false);
        navigate(`/match/${matchId}/score`);
      }
      return;
    }
    // Touch expectedGameCount so eslint sees it as referenced; it's still
    // useful for future logic (e.g. tiebreaker count assertions).
    void expectedGameCount;

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
          // Always do a fresh refetch on each tick.
          await refetchGames?.();
          if (cancelled) return;
          if (awayRetryCountRef.current > MAX_RETRIES) {
            // Surface the toast and dismiss the overlay — but DO NOT cancel
            // the underlying realtime subscription. If games eventually
            // appear, the next currentGamesCount change re-runs this effect
            // and the synchronous short-circuit above navigates us
            // (auto-dismissing the toast).
            setIsPreparingMatch?.(false);
            if (awayToastIdRef.current === null) {
              awayToastIdRef.current = toast.error(
                "Match setup is taking longer than expected. Refresh if it doesn't appear soon.",
                { duration: Infinity }
              );
            }
            // Keep the timer alive so we can still pick up late realtime
            // events that lead to a successful navigation.
            scheduleNext();
            return;
          }
          scheduleNext();
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

        // Compute threshold payload per handicap system. Phase 3 Unit
        // 3.2: dispatches on (handicapType + winCondition + mechanism)
        // rather than just handicapType so a Fargo-rated league with
        // games-won win condition gets the right thresholds.
        let thresholdPayload: Record<string, number | null>;

        const isFargoStartPoints =
          handicapType === 'fargo' &&
          (mechanism === 'start_points' || winCondition === 'points');
        const isFargoGamesWon =
          handicapType === 'fargo' && !isFargoStartPoints;

        if (isFargoStartPoints) {
          // Fargo + points: by this point the negotiation has already
          // written the agreed start points to the weaker team's
          // *_to_tie column and stamped both *_to_lose with confirming
          // captain numbers (that's what gated us through
          // blockedReason). prep_match cleans up the negotiation pollution
          // here: per Ed 2026-05-04, the negotiation flow uses
          // home_to_lose / away_to_lose as scratch state for "this captain
          // confirmed" flags (storing the captain's player number); once
          // we're at prep_match both have confirmed and the scratch state
          // can clear out, leaving the match row with clean threshold-trio
          // semantics for points-mode: to_win = null (no match-level point
          // threshold for Fargo 10-7 — match plays all games to totals),
          // to_tie = start-credit (preserved), to_lose = null.
          //
          // The per-game race target (10 in standard Fargo 5v5) is a
          // calculator config concern — it lives on points_calculator_params
          // and feeds the scoring modal via calculator.scoringPopupFields().
          // It does NOT belong on home_to_win / away_to_win which are match-
          // state thresholds, not per-game config.
          thresholdPayload = {
            home_to_win: null,
            home_to_tie: matchData?.home_to_tie ?? null,
            home_to_lose: null,
            away_to_win: null,
            away_to_tie: matchData?.away_to_tie ?? null,
            away_to_lose: null,
          };
        } else if (isFargoGamesWon) {
          // Fargo + games-won: derive per-team games-to-win thresholds
          // from the lineup ratings using the canonical
          // T = 2^(rating/100) primitive. See
          // docs/research/fargo-games-won-threshold.md for the formula
          // and FargoRate HOT-chart calibration.
          const homeLineupForFargo = isHomeTeam ? myLineup : opponentLineup;
          const awayLineupForFargo = isHomeTeam ? opponentLineup : myLineup;
          const homeRatings = [1, 2, 3, 4, 5]
            .map((n) => (homeLineupForFargo as any)[`player${n}_handicap`])
            .filter((h): h is number => typeof h === 'number');
          const awayRatings = [1, 2, 3, 4, 5]
            .map((n) => (awayLineupForFargo as any)[`player${n}_handicap`])
            .filter((h): h is number => typeof h === 'number');

          const totalGames = generateGameOrder(lineupSize, useDoubleRoundRobin).length;
          const fargoThresholds = computeFargoGamesWonThresholds({
            homeRatings,
            awayRatings,
            totalGames,
          });

          thresholdPayload = {
            home_to_win: fargoThresholds.home.games_to_win,
            home_to_tie: fargoThresholds.home.games_to_tie,
            home_to_lose: fargoThresholds.home.games_to_lose,
            away_to_win: fargoThresholds.away.games_to_win,
            away_to_tie: fargoThresholds.away.games_to_tie,
            away_to_lose: fargoThresholds.away.games_to_lose,
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
            home_to_win: homeThresholds.games_to_win,
            home_to_tie: homeThresholds.games_to_tie,
            home_to_lose: homeThresholds.games_to_lose,
            away_to_win: awayThresholds.games_to_win,
            away_to_tie: awayThresholds.games_to_tie,
            away_to_lose: awayThresholds.games_to_lose,
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

        // Pre-insert guard: ONLY double-duty placeholders should be impossible
        // at this point — anonymous sub sentinels are legitimate final values
        // (the captain entered a handicap; we just don't know who the player
        // is). The Step 1 / blockedReason gate should already have prevented
        // any unresolved DD sentinel from reaching here.
        const hasDoubleDutyPlaceholder = gameRows.some(
          (r) => isDoubleDutySentinel(r.home_player_id) || isDoubleDutySentinel(r.away_player_id)
        );
        if (hasDoubleDutyPlaceholder) {
          logger.error('prep_match guard tripped: unresolved double-duty sentinel in gameRows', {
            matchId,
            sampleRow: gameRows.find(
              (r) => isDoubleDutySentinel(r.home_player_id) || isDoubleDutySentinel(r.away_player_id)
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
            // Seed initial running totals so the scoreboard shows correct
            // values from match start instead of waiting for the first game
            // to be scored. For points-mode this folds the start-credit
            // (from *_to_tie) into home_points_earned/away_points_earned;
            // for games-mode it writes 0/0 (the calculator's output for 0
            // games). Per Ed 2026-05-04: "the inital points show up at the
            // beginning ... in all the matches where points are counted."
            //
            // Fire-and-forget: the seed write is non-fatal (the next score
            // event will repopulate if it fails) and serial-awaiting it
            // here blocks navigation by ~2-4 Supabase round-trips. The
            // realtime subscription on the scoring page picks up the seed
            // when it lands.
            void (async () => {
              try {
                const { updateMatchRunningTotals } = await import(
                  '@/api/queries/matches'
                );
                await updateMatchRunningTotals(matchId);
              } catch (seedErr) {
                logger.warn('Failed to seed initial running totals at prep_match', {
                  matchId,
                  error: seedErr instanceof Error ? seedErr.message : String(seedErr),
                });
              }
            })();
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
