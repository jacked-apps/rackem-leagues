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
} from '@/api/queries/matches';
import {
  computeMatchPrepPayload,
  type MatchPrepLineup,
} from '@/utils/match/computeMatchPrepPayload';
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
