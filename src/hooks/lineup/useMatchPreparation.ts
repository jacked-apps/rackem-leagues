/**
 * @fileoverview Hook for match preparation and auto-navigation
 *
 * Handles the automatic match preparation when both lineups are locked.
 * Only the HOME team performs the preparation to avoid race conditions.
 * Creates game rows and calculates handicap thresholds.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { calculateHandicapThresholds } from '@/utils/calculateHandicapThresholds';
import { computeFargoGamesWonThresholds } from '@/utils/handicap/fargoGamesWonThresholds';
import { generateGameOrder } from '@/utils/gameOrder';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { MatchPhase } from '@/api/queries/matches';
import type { SystemOverrides } from '@/types/systemOverrides';
import { isDoubleDutySentinel, type PrepBlockedReason } from '@/utils/lineup';

export function usePreparationStatus() {
  const [isPreparingMatch, setIsPreparingMatch] = useState(false);
  return { isPreparingMatch, setIsPreparingMatch };
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
  refetchLineups?: () => Promise<any>;
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
  } = params;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const matchPreparedRef = useRef(false);

  /**
   * Prime the phase cache to 'in_progress' BEFORE navigating so
   * `MatchPhaseGuard` reads the fresh status when the scoring page
   * mounts. Without this, the guard reads its cached 'scheduled'
   * value and bounces the user back to /lineup until the realtime
   * tick lands ~100-500ms later. Synchronous cache write; no
   * await needed.
   */
  const primePhaseAsInProgress = (id: string) => {
    queryClient.setQueryData<MatchPhase | undefined>(
      [...queryKeys.matches.detail(id), 'phase'],
      (old) =>
        old
          ? { ...old, status: 'in_progress', started_at: old.started_at ?? new Date().toISOString() }
          : { id, status: 'in_progress', started_at: new Date().toISOString() }
    );
  };

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
        setIsPreparingMatch?.(false);
        // Prime the phase cache to 'in_progress' before navigating so
        // MatchPhaseGuard reads fresh status when the scoring page mounts.
        primePhaseAsInProgress(matchId);
        navigate(`/match/${matchId}/score`);
      }
      return;
    }
    // Touch expectedGameCount so eslint sees it as referenced; it's still
    // useful for future logic (e.g. tiebreaker count assertions).
    void expectedGameCount;

    // Away team: just signal "preparing" and let the canonical backstop
    // handle discovery. MatchPhaseGuard's 7-second poll on
    // matches.status (Defense 7) is the single dropped-realtime
    // recovery mechanism after this branch; the prior 3-retry/10s
    // fallback loop in this hook is gone — it duplicated the guard's
    // polling, fired a "longer than expected" toast that could appear
    // moments before the guard's auto-redirect (mixed signal), and
    // was an artifact of the pre-guard architecture. The synchronous
    // short-circuit above still fires the moment matchGamesQuery's
    // count flips > 0 via realtime, navigating cleanly.
    if (!isHomeTeam) {
      setIsPreparingMatch?.(true);
      return;
    }

    // Home team: transactional prep via prep_match RPC with 3-attempt retry.
    const prepareAndNavigate = async () => {
      if (!matchData || !opponentLineup) return;
      setIsPreparingMatch?.(true);

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
            // Latch the ref ONLY after a successful RPC. The previous
            // version set it before the first attempt, which combined
            // with the synchronous currentGamesCount > 0 short-circuit
            // could fire a spurious second navigate() if a realtime
            // tick landed while the RPC was in flight (REL-004).
            matchPreparedRef.current = true;
            // Seed initial running totals so the scoreboard shows correct
            // values from match start instead of waiting for the first game
            // to be scored. For points-mode this folds the start-credit
            // (from *_to_tie) into home_points_earned/away_points_earned;
            // for games-mode it writes 0/0 (the calculator's output for 0
            // games). Per Ed 2026-05-04: "the inital points show up at the
            // beginning ... in all the matches where points are counted."
            //
            // AWAITED (not fire-and-forget): per Ed, navigation to the scoring
            // screen must not race ahead of prep. The points must be written
            // before we leave the lineup screen so the scoring page opens on
            // complete data. A failed seed is still non-fatal (the next score
            // event repopulates) — we log and continue.
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
            // Drop the lineup-era cache for this match so the scoring page
            // mounts on FRESH data. prep_match just flipped status to
            // 'in_progress', froze the thresholds, and created the games — but
            // the query cache from the lineup screen still holds the stale
            // 'scheduled' match with zero games and null thresholds. Without
            // this invalidation the scoring screen renders that stale snapshot
            // and only a realtime tick (or a manual refresh) corrects it —
            // exactly the navigate-before-prep-settles race. Invalidating the
            // whole match subtree (detail + lineup + games) forces a fresh
            // fetch on mount. Awaited so navigation waits for prep to be fully
            // reflected before leaving the lineup screen.
            await queryClient.invalidateQueries({
              queryKey: queryKeys.matches.detail(matchId),
            });
            setIsPreparingMatch?.(false);
            // Prime the phase cache so MatchPhaseGuard reads the fresh
            // 'in_progress' status when the scoring page mounts (after the
            // invalidation above, so the prime isn't immediately discarded).
            primePhaseAsInProgress(matchId);
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
