/**
 * @fileoverview Match End Verification Component
 *
 * Replaces the scoreboard header area when all games are complete.
 * Shows match result and verification status for both teams.
 * Both teams must verify scores before auto-navigating to dashboard.
 *
 * Features:
 * - Match result summary (Home X - Y Away, Win/Tie status)
 * - Verification status indicators for both teams
 * - "Verify Scores" button (enabled only for user's team)
 * - Auto-navigate to dashboard when both teams verify
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMatchLineups, useMatchGames, useMatchWithLeagueSettings } from '@/api/hooks/useMatches';
import { useCreateMatchGames, useUpdateMatchGame, useUpdateMatch } from '@/api/hooks/useMatchMutations';
import { useUpdateMatchLineup } from '@/api/hooks';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { auditMatchScoringConsistency } from '@/api/queries/matches';
import { determineMatchResult, type MatchResultOutcome } from '@/utils/determineMatchResult';
import { buildWinCalcConfig, decideWinner } from '@/systems/win-calculator';
import { ManualTiebreakerDialog } from './ManualTiebreakerDialog';
import type { ManualTiebreakerSubmission } from './ManualTiebreakerDialog';
import {
  tiebreakerGameNumbers,
  tiebreakerGameToPosition,
  tiebreakerGameSpecs,
} from '@/utils/tiebreaker/gameNumbers';
import { computeGameCount } from '@/systems/team-geometry';
import { logger } from '@/utils/logger';

interface MatchEndVerificationProps {
  /** Match ID */
  matchId: string;
  /** Home team ID */
  homeTeamId: string;
  /** Away team ID */
  awayTeamId: string;
  /** Home team name */
  homeTeamName: string;
  /** Away team name */
  awayTeamName: string;
  /** Home team wins count */
  homeWins: number;
  /** Away team wins count */
  awayWins: number;
  /**
   * Home team win threshold. Nullable for points-mode matches with no
   * point target (e.g., Fargo 10-7 plays all games, totals decide).
   * The verifier is mode-aware internally and tolerates null here.
   */
  homeWinThreshold: number | null;
  /** Away team win threshold. See homeWinThreshold for null semantics. */
  awayWinThreshold: number | null;
  /** Home team tie threshold (null for formats without ties) */
  homeTieThreshold: number | null;
  /** Away team tie threshold (null for formats without ties) */
  awayTieThreshold: number | null;
  /** Member ID who verified for home team (null if not verified) */
  homeVerifiedBy: string | null;
  /** Member ID who verified for away team (null if not verified) */
  awayVerifiedBy: string | null;
  /** Is current user on home team? */
  isHomeTeam: boolean;
  /** Handler when user clicks verify */
  onVerify: () => void;
  /** Is verification in progress? */
  isVerifying?: boolean;
  /** Game type for tiebreaker games (eight_ball, nine_ball, ten_ball) */
  gameType: string;
}

// determineMatchResult extracted to src/utils/determineMatchResult.ts
// (Phase 0b characterization tests at
// src/utils/__tests__/determineMatchResult.characterization.test.ts).

/**
 * Match end verification component
 * Replaces header area when all games are complete
 */
export function MatchEndVerification({
  matchId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeWins,
  awayWins,
  homeWinThreshold,
  awayWinThreshold,
  homeTieThreshold,
  awayTieThreshold,
  homeVerifiedBy,
  awayVerifiedBy,
  isHomeTeam,
  onVerify,
  isVerifying = false,
  gameType,
}: MatchEndVerificationProps) {
  const navigate = useNavigate();
  const updateMatchMutation = useUpdateMatch();
  const createGamesMutation = useCreateMatchGames();
  const updateLineupMutation = useUpdateMatchLineup();
  const updateGameMutation = useUpdateMatchGame(matchId);

  // Fetch match data for fresh verification status
  const matchQuery = useMatchWithLeagueSettings(matchId);
  const match = matchQuery.data;

  // Resolved system configuration. Reads prefer the per-match
  // `system_snapshot` (frozen at first-scoring-event by
  // populateMatchSnapshotIfNeeded) so completion math matches what was
  // live during play, even if the LO edited preferences mid-match.
  // Live `useResolvedLeaguePrefs` is the fallback for matches whose
  // snapshot pre-dates Phase 2 Unit 2.2's writer expansion (legacy
  // shape may be missing fields) and matches still in `scheduled`
  // status (no scoring yet, snapshot not populated).
  //
  // Phase 5 Unit 5.5: this component no longer recomputes points
  // (no calculatePoints / calculateBCAPoints / calculateFargoMatchTotals).
  // The match row's `home_points_earned` / `away_points_earned` are
  // maintained per-game by the scoring mutations via
  // `updateMatchRunningTotals` and read directly here. The win-condition
  // axis (snapshot-resolved) decides whether the match outcome is
  // determined by games-won thresholds (BCA-style — tie band possible)
  // or by points totals (Fargo-style — never a true tie).
  const { data: leaguePrefs } = useResolvedLeaguePrefs(match?.league?.id);
  const snapshot = match?.system_snapshot;
  const lineupSize = snapshot?.lineup_size ?? leaguePrefs?.lineup_size ?? 3;
  const gameGeneration =
    snapshot?.game_generation ?? leaguePrefs?.game_generation ?? 'double_round_robin';
  const matchTotalGames = computeGameCount(lineupSize, gameGeneration);
  const winCondition: 'games' | 'points' =
    (snapshot?.win_condition as 'games' | 'points' | undefined) ??
    (leaguePrefs?.win_condition as 'games' | 'points' | undefined) ??
    'games';
  // Phase 4 Unit 4.4: when the league's tiebreaker_format is 'manual',
  // a tied match prompts the LO with ManualTiebreakerDialog instead of
  // auto-creating short-race tiebreaker games. Read from the snapshot
  // (frozen-at-first-score) so mid-match preference edits don't change
  // the in-flight match's tiebreaker behavior.
  const tiebreakerFormat: string =
    (snapshot?.tiebreaker_format as string | undefined) ?? 'accept_tie';

  // Fetch lineups to get lineup IDs for unlocking
  const lineupsQuery = useMatchLineups(matchId, homeTeamId, awayTeamId, false);
  const homeLineup = lineupsQuery.data?.homeLineup;
  const awayLineup = lineupsQuery.data?.awayLineup;

  // Fetch tiebreaker games (if this is a tiebreaker)
  const gamesQuery = useMatchGames(matchId);
  const tiebreakerGames = (gamesQuery.data || []).filter(g => g.is_tiebreaker);
  const isTiebreakerMode = tiebreakerGames.length > 0;

  const [isCompleting, setIsCompleting] = useState(false);
  const completionStartedRef = useRef(false);
  // Phase 4 Unit 4.4: manual-tiebreaker dialog state. Opens when a tie
  // is detected on a league with `tiebreaker_format = 'manual'`. The
  // LO picks the winner and the match completes immediately (no auto-
  // tiebreaker games, no lineup unlock).
  const [manualTbOpen, setManualTbOpen] = useState(false);
  const [manualTbSubmitting, setManualTbSubmitting] = useState(false);

  // For BCA systems we use thresholds to determine the result (may be a
  // tie triggering the tiebreaker flow). For Fargo matches we replace this
  // later with the cascade winner from fargo5v5.scoring.computeMatchResult
  // — Fargo 5v5 never produces a true tie.
  // Points-mode matches without an explicit point target have null win
  // thresholds; in that case bcaResult is meaningless and gets replaced
  // by the Fargo cascade later. Default to 'tie' to bypass the BCA
  // result-determination logic safely.
  const bcaResult: MatchResultOutcome =
    homeWinThreshold === null || awayWinThreshold === null
      ? 'tie'
      : determineMatchResult(
          homeWins,
          awayWins,
          homeWinThreshold,
          awayWinThreshold,
          homeTieThreshold,
          awayTieThreshold,
        );

  // Get fresh match data to access tiebreaker verification columns
  const freshMatch = matchQuery.data;

  // Use appropriate verification columns based on mode
  // Tiebreaker mode: use home_tiebreaker_verified_by / away_tiebreaker_verified_by
  // Regular mode: use home_team_verified_by / away_team_verified_by
  const homeVerifiedBy_actual = isTiebreakerMode
    ? (freshMatch?.home_tiebreaker_verified_by ?? null)
    : homeVerifiedBy;
  const awayVerifiedBy_actual = isTiebreakerMode
    ? (freshMatch?.away_tiebreaker_verified_by ?? null)
    : awayVerifiedBy;

  const homeVerified = homeVerifiedBy_actual !== null;
  const awayVerified = awayVerifiedBy_actual !== null;
  const bothVerified = homeVerified && awayVerified;

  // Reset completion ref if verifications are cleared
  if (!bothVerified && completionStartedRef.current) {
    completionStartedRef.current = false;
  }

  // Current user's team verification status
  const userTeamVerified = isHomeTeam ? homeVerified : awayVerified;

  // Phase 5 Unit 5.5: read running totals directly from the match row.
  // These are maintained per-game by the scoring mutations
  // (`updateMatchRunningTotals`) so they always reflect the current set
  // of confirmed games — no recompute here. Falls back to props when
  // the match row is still loading (transient render before the query
  // resolves) or when the columns are 0 because the running-totals
  // pipeline hasn't run yet on this match.
  const homePoints = match?.home_points_earned ?? 0;
  const awayPoints = match?.away_points_earned ?? 0;

  // Final result. Win-condition 'points' (Fargo-style) decides on points
  // totals — no tie possible. Win-condition 'games' (BCA-style) decides on
  // games-won thresholds and may produce 'tie' which triggers the
  // tiebreaker flow.
  // Legacy winner logic — retained as the fallback + divergence auditor
  // reference now that the modular judge is authoritative (Step B below).
  const legacyResult: 'home_win' | 'away_win' | 'tie' = winCondition === 'points'
    ? homePoints === awayPoints
      ? homeWins >= awayWins ? 'home_win' : 'away_win'
      : homePoints > awayPoints ? 'home_win' : 'away_win'
    : bcaResult;

  // --- Win Calculator cutover, Step B: the judge is AUTHORITATIVE ---
  // The modular judge now decides the recorded winner; the legacy logic above
  // is kept as a fallback + divergence auditor (compared at completion). The
  // parity gate proved they agree across shipped configs; the documented
  // divergences (both sides meeting target; a full points+games tie) are
  // unreachable in shipped odd-game formats. The judge call is wrapped so the
  // new path can never break the match-end screen — if it ever throws, we fall
  // back to the legacy result (scoring must not crash).
  let result: 'home_win' | 'away_win' | 'tie';
  let judgeFlags: ReadonlyArray<string>;
  try {
    const judge = decideWinner(
      {
        home_games: homeWins,
        away_games: awayWins,
        home_points: homePoints,
        away_points: awayPoints,
        home_games_target: homeWinThreshold,
        away_games_target: awayWinThreshold,
        home_points_target: null,
        away_points_target: null,
        edge: null,
      },
      buildWinCalcConfig(winCondition),
    );
    result =
      'winner' in judge.verdict
        ? judge.verdict.winner === 'home'
          ? 'home_win'
          : 'away_win'
        : 'tie';
    judgeFlags = judge.flags;
  } catch (err) {
    result = legacyResult;
    judgeFlags = [`win-calc judge threw — fell back to legacy: ${String(err)}`];
  }

  // Auto-complete match when both teams verify
  useEffect(() => {
    if (!bothVerified || isCompleting || completionStartedRef.current) return;
    // Item 15 guard: don't re-fire completion on a match that's already
    // completed. Without this, every time MatchEndVerification re-mounts
    // (refresh, navigation, realtime cycle) the completion useEffect ran
    // again — bothVerified stays true (verifications persist on the
    // match row), so completeTheMatch attempted to update_match +
    // create tiebreaker games, hitting a 409 on the games unique key
    // and logging "Failed to complete match" to app_logs. The DB
    // uniqueness caught it but the noise muddied real diagnostics.
    //
    // BUT: don't just bail — that strands a client on the end screen. In the
    // two-party completion race the loser sees the match flip to 'completed'
    // (via realtime) BEFORE its own completeTheMatch runs, so it would hit this
    // guard and never navigate, sitting forever on "✓ Both teams verified —
    // returning…". Skip the re-completion WRITE (idempotency) but still LEAVE the
    // page, exactly like the normal winner path does. A 'completed' status is
    // always a decisive winner (ties keep status 'in_progress'), so My Teams is
    // the correct destination.
    if (match?.status === 'completed') {
      navigate('/my-teams');
      return;
    }

    const completeTheMatch = async () => {
      completionStartedRef.current = true;
      setIsCompleting(true);

      try {
        // Step 1: Fetch fresh match data to see who verified FIRST
        const { data: freshMatch } = await matchQuery.refetch();

        if (!freshMatch) {
          throw new Error('Failed to fetch match verification status');
        }

        // Determine which team verified FIRST (their timestamp in DB came first)
        // The first verifier's device will handle database operations
        // Use appropriate verification columns based on mode
        const homeVerifiedFirst = isTiebreakerMode
          ? (freshMatch.home_tiebreaker_verified_by === homeVerifiedBy_actual)
          : (freshMatch.home_team_verified_by === homeVerifiedBy);
        const awayVerifiedFirst = isTiebreakerMode
          ? (freshMatch.away_tiebreaker_verified_by === awayVerifiedBy_actual)
          : (freshMatch.away_team_verified_by === awayVerifiedBy);
        const isFirstVerifier = (isHomeTeam && homeVerifiedFirst) || (!isHomeTeam && awayVerifiedFirst);

        // Step 2: Only FIRST verifier updates match and creates games
        if (isFirstVerifier) {

          // Calculate completion data
          const winnerTeamId =
            result === 'home_win' ? homeTeamId :
            result === 'away_win' ? awayTeamId :
            null; // tie

          // Win Calculator auditor (Step B): the judge is authoritative; the
          // legacy logic is the reference. Log any disagreement (and any flags)
          // at completion — observation only; the write above already uses the
          // judge. Runs once per completion (first verifier's device).
          if (result !== legacyResult) {
            logger.warn('[WinCalc] judge (authoritative) differs from legacy', {
              matchId,
              winCondition,
              judge: result,
              legacy: legacyResult,
              flags: judgeFlags,
              homeWins,
              awayWins,
              homePoints,
              awayPoints,
              homeWinThreshold,
              awayWinThreshold,
            });
          } else if (judgeFlags.length > 0) {
            logger.warn('[WinCalc] judge raised flags', {
              matchId,
              flags: judgeFlags,
            });
          }

          // Phase 5 Unit 5.5: completion just persists the outcome — running
          // totals (home_games_won / away_games_won / home_points_earned /
          // away_points_earned) are already correct on the match row
          // because the per-game scoring mutations maintained them via
          // updateMatchRunningTotals. The home_team_score / away_team_score
          // columns were dropped in Phase 2 Unit 2.1 (display reads totals
          // directly).
          const updates = isTiebreakerMode
            ? {
                // Tiebreaker: only update result and verification fields
                winner_team_id: winnerTeamId,
                match_result: result,
                results_confirmed_by_home: true,
                results_confirmed_by_away: true,
                completed_at: new Date().toISOString(),
                status: winnerTeamId ? 'completed' : 'in_progress',
              }
            : winCondition === 'points'
              ? {
                  // Points-condition match (Fargo-style) — always has a
                  // decisive winner; status goes straight to 'completed'.
                  winner_team_id: winnerTeamId,
                  match_result: result,
                  results_confirmed_by_home: true,
                  results_confirmed_by_away: true,
                  completed_at: new Date().toISOString(),
                  status: 'completed',
                }
              : {
                  // Games-condition match (BCA-style) — may be a tie that
                  // triggers tiebreaker; status stays 'in_progress' in
                  // that case so the tiebreaker flow can complete it.
                  winner_team_id: winnerTeamId,
                  match_result: result,
                  results_confirmed_by_home: true,
                  results_confirmed_by_away: true,
                  completed_at: new Date().toISOString(),
                  status: winnerTeamId ? 'completed' : 'in_progress',
                };

          await updateMatchMutation.mutateAsync({
            matchId,
            updates,
          });

          // Phase 5 Unit 5.6: post-completion scoring-consistency audit.
          // Fire-and-forget — recomputes the running totals from
          // match_games and logs to app_logs if they diverge from the
          // stored match-row values. Match record is NEVER auto-corrected
          // (player-witnessed scoreboard is the truth). Only runs when
          // the match is genuinely completing (winnerTeamId set), not
          // when transitioning into a tiebreaker.
          if (winnerTeamId) {
            void auditMatchScoringConsistency(matchId);
          }

          // Anti-sandbagging rule for tiebreaker: Override all game results with winning team
          if (isTiebreakerMode && winnerTeamId) {

            // Get the winning lineup
            const winningLineup = winnerTeamId === homeTeamId ? homeLineup : awayLineup;

            if (winningLineup) {
              // Tiebreaker game numbers start at matchTotalGames + 1.
              // For BCA 3v3 DRR (18 regular games) that's 19, 20, 21.
              // Sourced via tiebreakerGameNumbers/tiebreakerGameToPosition so
              // future lineup geometries (4v4 etc.) compute their own ranges.
              for (const gameNumber of tiebreakerGameNumbers(matchTotalGames)) {
                // 0-indexed position from the helper; lineup fields are 1-indexed
                const position = tiebreakerGameToPosition(matchTotalGames, gameNumber) + 1;
                const game = tiebreakerGames.find(g => g.game_number === gameNumber);

                if (!game) {
                  logger.error('Tiebreaker game not found', { gameNumber });
                  continue;
                }

                const winningPlayerId = winningLineup[`player${position}_id` as keyof typeof winningLineup];

                await updateGameMutation.mutateAsync({
                  gameId: game.id,
                  updates: {
                    winner_team_id: winnerTeamId,
                    winner_player_id: winningPlayerId,
                    confirmed_by_home: homeVerifiedBy,
                    confirmed_by_away: awayVerifiedBy,
                  },
                });
              }
            }
          }

          // Handle tie result - create tiebreaker games
          // Phase 4 Unit 4.4: skip auto-tiebreaker creation when the
          // league uses manual mode. The dialog rendered below handles
          // the LO prompt + match completion directly.
          if (result === 'tie' && tiebreakerFormat === 'manual') {
            setManualTbOpen(true);
            // Reset isCompleting so the dialog can take over without
            // the "completing match" banner being stuck on screen.
            setIsCompleting(false);
            completionStartedRef.current = false;
            return;
          }

          if (result === 'tie') {

            // Item 15 follow-up guard: skip tiebreaker-game creation if
            // they already exist. Without this, every time the tie
            // useEffect re-fires (re-mount, navigation back into a
            // tied-but-unresolved match, realtime cycle) the
            // createGamesMutation re-runs and 409s on the
            // (match_id, game_number) unique key. The DB catches the
            // duplicate, but the noisy "Failed to complete match" log
            // muddies real diagnostics. Cheap O(1) check on already-
            // loaded gamesQuery data.
            if (tiebreakerGames.length > 0) {
              // Tiebreaker games are already created — nothing to do.
              // The downstream poll-and-navigate block (Step 3) will
              // still fire and route the captains to the lineup page.
            } else {
              // Tiebreaker games numbered matchTotalGames+1, +2, +3 — for
              // BCA 3v3 DRR that's games 19/20/21. Specs are computed via
              // tiebreakerGameSpecs so future lineup geometries get the
              // right numbers + alternating actions automatically.
              await createGamesMutation.mutateAsync({
                games: tiebreakerGameSpecs(matchTotalGames).map((spec) => ({
                  match_id: matchId,
                  game_number: spec.game_number,
                  home_action: spec.home_action,
                  away_action: spec.away_action,
                  is_tiebreaker: true,
                  game_type: gameType,
                })),
              });
            }

            // Unlock both lineups
            if (homeLineup?.id) {
              await updateLineupMutation.mutateAsync({
                lineupId: homeLineup.id,
                updates: { locked: false, locked_at: null },
                matchId,
              });
            }
            if (awayLineup?.id) {
              await updateLineupMutation.mutateAsync({
                lineupId: awayLineup.id,
                updates: { locked: false, locked_at: null },
                matchId,
              });
            }

            // Wait for database writes to complete and propagate
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        // Step 3: ALL devices (first verifier and second verifier) MUST verify data before navigating
        if (result === 'tie') {
          // STEP 3A: Poll for tiebreaker games to exist
          let gamesReady = false;
          let attempts = 0;
          const maxAttempts = 20; // 20 attempts = 10 seconds max

          while (!gamesReady && attempts < maxAttempts) {
            const { data: checkGames } = await gamesQuery.refetch();
            const tiebreakerGamesCount = (checkGames || []).filter(g => g.is_tiebreaker).length;

            if (tiebreakerGamesCount >= 3) {
              gamesReady = true;
            } else {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          if (!gamesReady) {
            throw new Error('Timeout waiting for tiebreaker games to be created');
          }

          // STEP 3B: Poll for both lineups to be unlocked
          let lineupsUnlocked = false;
          attempts = 0;

          while (!lineupsUnlocked && attempts < maxAttempts) {
            const { data: checkLineups } = await lineupsQuery.refetch();

            if (checkLineups?.homeLineup &&
                checkLineups?.awayLineup &&
                !checkLineups.homeLineup.locked &&
                !checkLineups.awayLineup.locked) {
              lineupsUnlocked = true;
            } else {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          if (!lineupsUnlocked) {
            throw new Error('Timeout waiting for lineups to be unlocked');
          }

          // STEP 3C: Final cache propagation delay
          await new Promise(resolve => setTimeout(resolve, 500));

          // Navigate to lineup page
          setIsCompleting(false); // Reset completing state before navigation
          navigate(`/match/${matchId}/lineup`);
        } else {
          // Match has a winner - navigate to My Teams
          navigate('/my-teams');
        }
      } catch (error) {
        logger.error('Failed to complete match', { error: error instanceof Error ? error.message : String(error) });
        setIsCompleting(false);
        // Stay on page to allow retry
      }
    };

    completeTheMatch();
  }, [bothVerified, isCompleting, matchId, homeTeamId, awayTeamId, homeWins, awayWins, homePoints, awayPoints, result, updateMatchMutation, createGamesMutation, gameType, navigate, homeVerifiedBy, awayVerifiedBy, isTiebreakerMode, tiebreakerGames, homeLineup, awayLineup, updateGameMutation, updateLineupMutation, matchTotalGames]);

  return (
    <div className="bg-muted border-b-2 border-border">
      <div className="px-4 py-3">
        {/* Match Result Header */}
        <div className="text-center mb-3">
          <div className="text-sm font-semibold text-muted-foreground">
            Match Complete
          </div>
          {result === 'home_win' && (
            <div className="text-lg font-bold text-blue-600 mt-1">
              Home Team Wins!
            </div>
          )}
          {result === 'away_win' && (
            <div className="text-lg font-bold text-orange-600 mt-1">
              Away Team Wins!
            </div>
          )}
        </div>

        {/* Score Table */}
        <div className="bg-card rounded-lg shadow-sm mb-3 overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs font-semibold bg-muted px-3 py-2 border-b">
            <div>Team</div>
            <div className="text-center w-16">Score</div>
            <div className="text-center w-16">Points</div>
            <div className="w-12"></div>
          </div>

          {/* Home Team Row */}
          <div
            className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 border-b ${
              result === 'home_win' ? 'bg-blue-50' : ''
            }`}
          >
            <div
              className={`truncate ${
                result === 'home_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {homeTeamName}
            </div>
            <div
              className={`text-center w-16 ${
                result === 'home_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {homeWins}
            </div>
            <div
              className={`text-center w-16 ${
                result === 'home_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {homePoints}
            </div>
            <div className="w-12 text-center">
              {result === 'home_win' && <span className="text-xl">🏆</span>}
            </div>
          </div>

          {/* Away Team Row */}
          <div
            className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 ${
              result === 'away_win' ? 'bg-orange-50' : ''
            }`}
          >
            <div
              className={`truncate ${
                result === 'away_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {awayTeamName}
            </div>
            <div
              className={`text-center w-16 ${
                result === 'away_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {awayWins}
            </div>
            <div
              className={`text-center w-16 ${
                result === 'away_win'
                  ? 'text-lg font-bold text-blue-600'
                  : 'font-medium'
              }`}
            >
              {awayPoints}
            </div>
            <div className="w-12 text-center">
              {result === 'away_win' && <span className="text-xl">🏆</span>}
            </div>
          </div>

          {/* Tie Message (if applicable) */}
          {result === 'tie' && (
            <div className="bg-accent px-3 py-2 text-center">
              <span className="text-sm font-bold text-accent-foreground">
                TIEBREAKER REQUIRED
              </span>
            </div>
          )}
        </div>

        {/* Verification Status */}
        {!bothVerified && (
          <div className="space-y-3 w-full">
            {/* Status Flags Row */}
            <div className="flex items-center justify-around text-sm w-full">
              <div
                className={`font-medium ${
                  homeVerified ? 'text-success' : 'text-muted-foreground'
                }`}
              >
                Home: {homeVerified ? '✅ Verified' : '⏳ Waiting'}
              </div>
              <div
                className={`font-medium ${
                  awayVerified ? 'text-success' : 'text-muted-foreground'
                }`}
              >
                Away: {awayVerified ? '✅ Verified' : '⏳ Waiting'}
              </div>
            </div>

            {/* Verify Button Row */}
            <div className="text-center">
              <Button
                onClick={onVerify}
                disabled={userTeamVerified || isVerifying}
                size="default"
                className="w-full max-w-xs"
                isLoading={isVerifying}
                loadingText="Verifying..."
              >
                {isVerifying
                  ? 'Verifying...'
                  : userTeamVerified
                  ? '✓ You Have Verified'
                  : 'Verify Scores'}
              </Button>
            </div>
          </div>
        )}

        {/* Both Verified Message */}
        {bothVerified && (
          <div className="text-center text-sm font-medium text-success">
            {isCompleting
              ? result === 'tie'
                ? '✓ Both teams verified - Setting up tiebreaker...'
                : '✓ Both teams verified - Completing match...'
              : '✓ Both teams verified - Returning to My Teams...'
            }
          </div>
        )}
      </div>

      {/* Phase 4 Unit 4.4: manual-tiebreaker LO prompt. Mounted at the
          component root so it can render over the score table. Only
          opens when the league uses manual mode AND the match has
          tied. Submission writes the LO-chosen winner directly. */}
      <ManualTiebreakerDialog
        open={manualTbOpen}
        onCancel={() => setManualTbOpen(false)}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        isSubmitting={manualTbSubmitting}
        onSubmit={async (submission: ManualTiebreakerSubmission) => {
          setManualTbSubmitting(true);
          try {
            const winnerTeamId =
              submission.winnerTeam === 'home' ? homeTeamId : awayTeamId;
            await updateMatchMutation.mutateAsync({
              matchId,
              updates: {
                winner_team_id: winnerTeamId,
                match_result:
                  submission.winnerTeam === 'home' ? 'home_win' : 'away_win',
                results_confirmed_by_home: true,
                results_confirmed_by_away: true,
                completed_at: new Date().toISOString(),
                status: 'completed',
              },
            });
            // Phase 5 Unit 5.6 audit also fires here — manual completion
            // is a real match-completion event.
            void auditMatchScoringConsistency(matchId);
            setManualTbOpen(false);
            navigate('/dashboard');
          } catch (error) {
            logger.error('Failed to record manual tiebreaker', {
              error: error instanceof Error ? error.message : String(error),
              matchId,
            });
          } finally {
            setManualTbSubmitting(false);
          }
        }}
      />
    </div>
  );
}
