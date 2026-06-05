/**
 * @fileoverview LO (League Operator) manual-scoring data layer.
 *
 * A thin, LO-authoritative set of mutations that let an operator record a match
 * that was played on paper, applying the SAME scoring as a live match. The LO
 * stands in for both teams, so these functions deliberately bypass the
 * team-membership gates in `matchLineups.ts` (the operator is on neither team)
 * and write both confirmation/verification slots themselves.
 *
 * This module (Unit 2) covers match SETUP:
 *  - `loSaveLineups`  — persist both lineups (gate-free upsert, locked).
 *  - `loSetupMatch`   — freeze + create games: guard `status='scheduled'`, build
 *                       the `prep_match` payload via `computeMatchPrepPayload`,
 *                       call the RPC, freeze `system_snapshot`, seed totals.
 *
 * Per-game scoring (`loScoreGame`) and completion (`loFinalizeMatch`) land in
 * Unit 3. Officiality stays on the two `match_games.confirmed_by_*` uuid columns
 * — this flow does NOT write `game_confirmations` (see the plan's Key Decisions).
 *
 * Authorization note: these mutations are role-gated at the route layer only
 * (`league_operator`); operator-owns-this-league enforcement is deferred to the
 * pre-launch auth/RLS pass (consistent with the rest of the operator surface).
 *
 * @see src/utils/match/computeMatchPrepPayload.ts — the payload builder (Unit 1)
 * @see src/hooks/lineup/useMatchPreparation.ts — the live two-captain equivalent
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Unit 2
 */

import { supabase } from '@/supabaseClient';
import {
  populateMatchSnapshotIfNeeded,
  updateMatchRunningTotals,
  auditMatchScoringConsistency,
} from '@/api/queries/matches';
import {
  computeMatchPrepPayload,
  type MatchPrepLineup,
} from '@/utils/match/computeMatchPrepPayload';
import { determineMatchResult } from '@/utils/determineMatchResult';
import type { LineupPlayer } from '@/api/mutations/matchLineups';
import type { SystemOverrides } from '@/types/systemOverrides';
import { logger } from '@/utils/logger';

/** Parameters for {@link loSaveLineups}. */
export interface LoSaveLineupsParams {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Home lineup — position + playerId + (possibly overridden) handicap per slot. */
  homePlayers: LineupPlayer[];
  /** Away lineup. */
  awayPlayers: LineupPlayer[];
  /** Home team standings modifier (bonus/penalty). Defaults to 0. */
  homeTeamModifier?: number;
}

/** Parameters for {@link loSetupMatch}. */
export interface LoSetupMatchParams {
  matchId: string;
  /** Needed to freeze `system_snapshot` from the league's resolved config. */
  leagueId: string;
  /** Players per team (3 or 5). */
  lineupSize: number;
  /** Resolved league handicap_type. */
  handicapType: string;
  /** Win-condition axis (drives Fargo threshold dispatch). */
  winCondition?: 'games' | 'points';
  /** Threshold-mechanism axis. */
  mechanism?: 'extra_games' | 'start_points' | 'race_length_adjustment' | 'none';
  /** `game_generation` preference. */
  gameGeneration?: string;
  /** Resolved per-league dial overrides. */
  systemOverrides?: SystemOverrides;
  /** League game_type for the created game rows. */
  gameType?: string;
}

/** Build a single `match_lineups` upsert row (locked) from a LineupPlayer list. */
function buildLineupRow(
  matchId: string,
  teamId: string,
  players: LineupPlayer[],
  homeTeamModifier: number,
  lockedAt: string
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    match_id: matchId,
    team_id: teamId,
    home_team_modifier: homeTeamModifier,
    locked: true,
    locked_at: lockedAt,
  };
  players.forEach((player) => {
    row[`player${player.position}_id`] = player.playerId;
    row[`player${player.position}_handicap`] = player.handicap;
  });
  return row;
}

/**
 * Persist both lineups for an LO-entered match, locked.
 *
 * Gate-free upsert on the `(match_id, team_id)` unique constraint — there is NO
 * `team_players` membership check (the operator is on neither team). Locking the
 * rows freezes the per-player handicaps the engine reads. Idempotent: re-saving
 * overwrites the same two rows.
 *
 * @throws if either upsert fails.
 */
export async function loSaveLineups(params: LoSaveLineupsParams): Promise<void> {
  const {
    matchId,
    homeTeamId,
    awayTeamId,
    homePlayers,
    awayPlayers,
    homeTeamModifier = 0,
  } = params;

  const lockedAt = new Date().toISOString();

  const sides: Array<{ teamId: string; players: LineupPlayer[]; modifier: number }> = [
    { teamId: homeTeamId, players: homePlayers, modifier: homeTeamModifier },
    { teamId: awayTeamId, players: awayPlayers, modifier: 0 },
  ];

  for (const side of sides) {
    const row = buildLineupRow(matchId, side.teamId, side.players, side.modifier, lockedAt);
    const { error } = await supabase
      .from('match_lineups')
      .upsert(row, { onConflict: 'match_id,team_id' });
    if (error) {
      throw new Error(`Failed to save LO lineup for team ${side.teamId}: ${error.message}`);
    }
  }
}

/** Map a stored `match_lineups` row to the {@link MatchPrepLineup} shape. */
function rowToPrepLineup(row: Record<string, unknown>): MatchPrepLineup {
  const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
  const id = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  return {
    player1_id: id(row.player1_id),
    player1_handicap: num(row.player1_handicap),
    player2_id: id(row.player2_id),
    player2_handicap: num(row.player2_handicap),
    player3_id: id(row.player3_id),
    player3_handicap: num(row.player3_handicap),
    player4_id: id(row.player4_id),
    player4_handicap: num(row.player4_handicap),
    player5_id: id(row.player5_id),
    player5_handicap: num(row.player5_handicap),
  };
}

/**
 * Freeze + create games for an LO-entered match — the "Setup Match" action.
 *
 * Steps:
 *  1. Read the match; **R11 guard**: refuse unless `status = 'scheduled'` (no RPC
 *     on an already-started/finished match — also the `prep_match` backstop).
 *  2. Read the two saved (locked) lineups; map to home/away.
 *  3. Build the `prep_match` payload via `computeMatchPrepPayload` (Unit 1).
 *  4. Call `prep_match` (writes thresholds + game rows, flips status to in_progress).
 *  5. **Freeze `system_snapshot`** — the LO flow has no live first-scoring event,
 *     so freeze it here; without it the completion audit self-disables and the
 *     finalize math would run off live (possibly drifted) config.
 *  6. Seed running totals so the scoreboard opens on correct values (start-credit).
 *
 * Steps 5–6 are best-effort (their internals already swallow errors); a failure
 * there does not undo the created games.
 *
 * @throws if the match is ineligible, a lineup is missing, or `prep_match` fails.
 */
export async function loSetupMatch(params: LoSetupMatchParams): Promise<void> {
  const { matchId, leagueId } = params;

  // 1. Read match + R11 eligibility guard.
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, status, home_team_id, away_team_id, season_id')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) {
    throw new Error(`Failed to read match: ${matchErr?.message ?? 'not found'}`);
  }
  if (match.status !== 'scheduled') {
    throw new Error(
      `Match is not eligible for manual setup (status: ${match.status}). ` +
        'Only scheduled matches can be set up.'
    );
  }

  // 2. Read both saved lineups; identify home/away by team id.
  const { data: lineups, error: lineupsErr } = await supabase
    .from('match_lineups')
    .select(
      'team_id, player1_id, player1_handicap, player2_id, player2_handicap, ' +
        'player3_id, player3_handicap, player4_id, player4_handicap, ' +
        'player5_id, player5_handicap'
    )
    .eq('match_id', matchId);
  if (lineupsErr) {
    throw new Error(`Failed to read lineups: ${lineupsErr.message}`);
  }
  const rows = (lineups ?? []) as unknown as Array<Record<string, unknown>>;
  const homeRow = rows.find((l) => l.team_id === match.home_team_id);
  const awayRow = rows.find((l) => l.team_id === match.away_team_id);
  if (!homeRow || !awayRow) {
    throw new Error('Both lineups must be saved before setup.');
  }

  // 3. Build the prep payload from the frozen lineups + league config.
  const payload = await computeMatchPrepPayload({
    homeLineup: rowToPrepLineup(homeRow),
    awayLineup: rowToPrepLineup(awayRow),
    lineupSize: params.lineupSize,
    gameGeneration: params.gameGeneration,
    handicapType: params.handicapType,
    winCondition: params.winCondition,
    mechanism: params.mechanism,
    systemOverrides: params.systemOverrides,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    seasonId: match.season_id,
    gameType: params.gameType,
  });

  // 4. Transactional prep: thresholds + game rows, status → in_progress.
  const { error: rpcErr } = await supabase.rpc('prep_match', {
    p_match_id: matchId,
    p_thresholds: payload.thresholds,
    p_game_rows: payload.gameRows,
  });
  if (rpcErr) {
    throw new Error(`prep_match failed: ${rpcErr.message}`);
  }

  // 5. Freeze the system snapshot (best-effort; keeps the completion audit alive).
  try {
    await populateMatchSnapshotIfNeeded(matchId, leagueId);
  } catch (err) {
    logger.warn('loSetupMatch: snapshot freeze failed (non-fatal)', {
      matchId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 6. Seed running totals so the scoreboard opens on correct values (best-effort).
  try {
    await updateMatchRunningTotals(matchId);
  } catch (err) {
    logger.warn('loSetupMatch: seed running totals failed (non-fatal)', {
      matchId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** The per-game result an operator enters (mirrors the live `gameData` extras). */
export interface LoGameResult {
  winnerTeamId: string;
  winnerPlayerId: string;
  breakAndRun?: boolean;
  goldenBreak?: boolean;
  breakFouled?: boolean;
  runout?: boolean;
  winByForfeit?: boolean;
  winnerValue?: number | null;
  loserValue?: number | null;
}

/** Parameters for {@link loScoreGame}. */
export interface LoScoreGameParams {
  matchId: string;
  /** The pre-created `match_games` row id (from `prep_match`). */
  gameId: string;
  /** The operating LO's `members.id` — written into BOTH confirmation slots. */
  loMemberId: string;
  result: LoGameResult;
}

/** Parameters for {@link loFinalizeMatch}. */
export interface LoFinalizeMatchParams {
  matchId: string;
  /** The operating LO's `members.id` — written into BOTH verification slots. */
  loMemberId: string;
  /** Win-condition axis (frozen at setup); decides points-vs-games completion. */
  winCondition: 'games' | 'points';
}

/**
 * Score (or re-score) one game in an LO-entered match.
 *
 * The operator is both confirming parties, so this fills BOTH
 * `confirmed_by_home` AND `confirmed_by_away` with the LO's member id in one
 * UPDATE — that's what makes the game count in `updateMatchRunningTotals` (which
 * counts only games with both slots set). It does NOT go through the live
 * `handlePlayerClick`/Amendment-D race path (no second scorer to race) and does
 * NOT write `game_confirmations` (single-operator paper entry isn't a live
 * witness; see the plan's Key Decisions). Re-scoring (R9) is the same UPDATE.
 *
 * @throws if the match isn't in progress, or the game UPDATE fails.
 */
export async function loScoreGame(params: LoScoreGameParams): Promise<void> {
  const { matchId, gameId, loMemberId, result } = params;

  // Guard: only score games on a prepared, not-yet-completed match.
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('status')
    .eq('id', matchId)
    .single();
  if (matchErr || !match) {
    throw new Error(`Failed to read match: ${matchErr?.message ?? 'not found'}`);
  }
  const status = (match as unknown as { status: string }).status;
  if (status !== 'in_progress') {
    throw new Error(
      `Cannot score a game on a match with status '${status}'. ` +
        'The match must be set up and not yet finalized.'
    );
  }

  const { error: updateErr } = await supabase
    .from('match_games')
    .update({
      winner_team_id: result.winnerTeamId,
      winner_player_id: result.winnerPlayerId,
      break_and_run: result.breakAndRun ?? false,
      golden_break: result.goldenBreak ?? false,
      break_fouled: result.breakFouled ?? false,
      runout: result.runout ?? false,
      win_by_forfeit: result.winByForfeit ?? false,
      winner_value: result.winnerValue ?? null,
      loser_value: result.loserValue ?? null,
      // LO is both parties — fill both slots so the game counts.
      confirmed_by_home: loMemberId,
      confirmed_by_away: loMemberId,
    })
    .eq('id', gameId);
  if (updateErr) {
    throw new Error(`Failed to score game: ${updateErr.message}`);
  }

  await updateMatchRunningTotals(matchId);
}

/**
 * Finalize an LO-entered match — the "Finalize Match" action.
 *
 * Mirrors `MatchEndVerification`'s completion writes for a single operator:
 *  1. Refresh running totals, then read the match row.
 *  2. Guard: match must be `in_progress` and every (non-tiebreaker) game scored.
 *  3. Compute the result the same way the live completion does — points
 *     comparison for points-mode, `determineMatchResult` for games-mode.
 *  4. **Games-mode tie → BLOCK** (leave the match untouched): the LO has no
 *     second device to play a tiebreaker, so mirroring the live auto-tiebreaker
 *     path would strand the match. Tiebreaker reproduction is deferred.
 *  5. Write completion: BOTH `*_team_verified_by` = LO id, `winner_team_id`,
 *     `match_result`, `results_confirmed_by_*`, `completed_at`, `status='completed'`.
 *  6. Fire the post-completion consistency audit (the live flow's safety net —
 *     matters more here with no second party to catch a fat-fingered score).
 *
 * @returns the decided winner (team id + 'home_win' | 'away_win').
 * @throws if the match isn't in progress, games are unscored, or it's a tie.
 */
export async function loFinalizeMatch(
  params: LoFinalizeMatchParams
): Promise<{ winnerTeamId: string; result: 'home_win' | 'away_win' }> {
  const { matchId, loMemberId, winCondition } = params;

  // 1. Recompute totals from confirmed games, then read the fresh match row.
  await updateMatchRunningTotals(matchId);
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select(
      'status, home_team_id, away_team_id, home_points_earned, away_points_earned, ' +
        'home_games_won, away_games_won, home_to_win, away_to_win, home_to_tie, away_to_tie'
    )
    .eq('id', matchId)
    .single();
  if (matchErr || !match) {
    throw new Error(`Failed to read match: ${matchErr?.message ?? 'not found'}`);
  }
  const m = match as unknown as {
    status: string;
    home_team_id: string;
    away_team_id: string;
    home_points_earned: number | null;
    away_points_earned: number | null;
    home_games_won: number | null;
    away_games_won: number | null;
    home_to_win: number | null;
    away_to_win: number | null;
    home_to_tie: number | null;
    away_to_tie: number | null;
  };
  if (m.status !== 'in_progress') {
    throw new Error(
      `Cannot finalize a match with status '${m.status}'. It must be set up and not already completed.`
    );
  }

  // 2. Every regular game must be scored + both-confirmed before finalize.
  const { data: games, error: gamesErr } = await supabase
    .from('match_games')
    .select('winner_player_id, confirmed_by_home, confirmed_by_away, is_tiebreaker')
    .eq('match_id', matchId);
  if (gamesErr) {
    throw new Error(`Failed to read games: ${gamesErr.message}`);
  }
  const gameRows = (games ?? []) as unknown as Array<Record<string, unknown>>;
  const regularGames = gameRows.filter((g) => g.is_tiebreaker !== true);
  const unscored = regularGames.filter(
    (g) => !g.winner_player_id || !g.confirmed_by_home || !g.confirmed_by_away
  ).length;
  if (regularGames.length === 0 || unscored > 0) {
    throw new Error(`${unscored || regularGames.length} game(s) are not yet scored.`);
  }

  // 3. Decide the result — same logic as MatchEndVerification.
  const homePoints = m.home_points_earned ?? 0;
  const awayPoints = m.away_points_earned ?? 0;
  const homeWins = m.home_games_won ?? 0;
  const awayWins = m.away_games_won ?? 0;

  let result: 'home_win' | 'away_win' | 'tie';
  if (winCondition === 'points') {
    // Points-mode never ties — equal points break to games-won, then to home.
    result =
      homePoints === awayPoints
        ? homeWins >= awayWins
          ? 'home_win'
          : 'away_win'
        : homePoints > awayPoints
          ? 'home_win'
          : 'away_win';
  } else {
    result =
      m.home_to_win === null || m.away_to_win === null
        ? 'tie'
        : determineMatchResult(
            homeWins,
            awayWins,
            m.home_to_win,
            m.away_to_win,
            m.home_to_tie,
            m.away_to_tie
          );
  }

  // 4. Games-mode tie → block (v1 does not reproduce tiebreakers).
  if (result === 'tie') {
    throw new Error(
      'This match is a tie that would require a tiebreaker — not supported in manual scoring v1. ' +
        'The match has been left unchanged.'
    );
  }

  const winnerTeamId = result === 'home_win' ? m.home_team_id : m.away_team_id;

  // 5. Completion write — both verification slots filled by the LO.
  const { error: completeErr } = await supabase
    .from('matches')
    .update({
      home_team_verified_by: loMemberId,
      away_team_verified_by: loMemberId,
      winner_team_id: winnerTeamId,
      match_result: result,
      results_confirmed_by_home: true,
      results_confirmed_by_away: true,
      completed_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', matchId);
  if (completeErr) {
    throw new Error(`Failed to finalize match: ${completeErr.message}`);
  }

  // 6. Post-completion consistency audit (fire-and-forget, as the live flow does).
  void auditMatchScoringConsistency(matchId);

  return { winnerTeamId, result };
}
