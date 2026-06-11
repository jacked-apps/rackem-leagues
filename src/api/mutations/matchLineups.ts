/**
 * @fileoverview Match Lineup Mutation Functions
 *
 * Generic, reusable functions for match lineup operations.
 * These functions are wrapped by TanStack Query mutation hooks.
 *
 * Philosophy: Keep mutations generic and flexible.
 * Instead of many specific functions, provide generic updateMatchLineup()
 * that can update any field(s).
 *
 * Match lineups track which players from each team are playing in a specific match.
 * Supports both 3v3 and 5v5 formats with player positions and handicaps.
 *
 * @see api/hooks/useMatchLineupMutations.ts - Mutation hooks that wrap these functions
 */

import { supabase } from '@/supabaseClient';
import { composeMatchThresholds, type ThresholdPayload } from '@/utils/match/composeMatchThresholds';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { Lineup } from '@/types/match';

/**
 * Player in a lineup with position and handicap
 */
export interface LineupPlayer {
  position: number; // 1-indexed position (1-5 for 5v5, 1-3 for 3v3)
  playerId: string;
  handicap: number;
}

/**
 * Parameters for saving/updating a lineup
 */
export interface SaveLineupParams {
  matchId: string;
  teamId: string;
  players: LineupPlayer[];
  memberId: string; // User performing the action
  existingLineupId?: string; // If updating existing lineup
}

/**
 * Parameters for locking a lineup
 */
export interface LockLineupParams {
  lineupId: string;
  teamId: string;
  memberId: string; // User performing the action
}

/**
 * Parameters for unlocking a lineup
 */
export interface UnlockLineupParams {
  lineupId: string;
  teamId: string;
  memberId: string; // User performing the action
}

/**
 * Match lineup database record
 */
export interface MatchLineup {
  id: string;
  match_id: string;
  team_id: string;
  locked: boolean;
  player1_id?: string;
  player1_handicap?: number;
  player2_id?: string;
  player2_handicap?: number;
  player3_id?: string;
  player3_handicap?: number;
  player4_id?: string;
  player4_handicap?: number;
  player5_id?: string;
  player5_handicap?: number;
}

/**
 * Save or update a match lineup
 *
 * Creates a new lineup if existingLineupId is not provided, otherwise updates.
 * Verifies the user is a member of the team before allowing the operation.
 *
 * @param params - Lineup save parameters
 * @returns The saved/updated lineup
 * @throws Error if validation fails or database operation fails
 */
export async function saveMatchLineup(params: SaveLineupParams): Promise<MatchLineup> {
  // Verify user is on the team
  const { data: teamCheck, error: teamCheckError } = await supabase
    .from('team_players')
    .select('*')
    .eq('team_id', params.teamId)
    .eq('member_id', params.memberId)
    .single();

  if (teamCheckError || !teamCheck) {
    throw new Error('You are not a member of this team');
  }

  // Build lineup data object dynamically based on player count
  const lineupData: any = {
    match_id: params.matchId,
    team_id: params.teamId,
    locked: false,
  };

  // Add player data for each position
  params.players.forEach((player) => {
    lineupData[`player${player.position}_id`] = player.playerId;
    lineupData[`player${player.position}_handicap`] = player.handicap;
  });

  let result;

  if (params.existingLineupId) {
    // Update existing lineup
    result = await supabase
      .from('match_lineups')
      .update(lineupData)
      .eq('id', params.existingLineupId)
      .select()
      .single();
  } else {
    // Insert new lineup
    result = await supabase
      .from('match_lineups')
      .insert(lineupData)
      .select()
      .single();
  }

  if (result.error) {
    throw new Error(`Failed to save lineup: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Lock a match lineup
 *
 * Prevents further edits to the lineup. Verifies user is on the team.
 *
 * @param params - Lock parameters
 * @returns The locked lineup
 * @throws Error if validation fails or database operation fails
 */
export async function lockMatchLineup(params: LockLineupParams): Promise<MatchLineup> {
  // Verify user is on the team
  const { data: teamCheck, error: teamCheckError } = await supabase
    .from('team_players')
    .select('*')
    .eq('team_id', params.teamId)
    .eq('member_id', params.memberId)
    .single();

  if (teamCheckError || !teamCheck) {
    throw new Error('You are not a member of this team');
  }

  const { data, error } = await supabase
    .from('match_lineups')
    .update({ locked: true })
    .eq('id', params.lineupId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to lock lineup: ${error.message}`);
  }

  return data;
}

/**
 * Unlock a match lineup
 *
 * Allows edits to the lineup again. Verifies user is on the team.
 *
 * @param params - Unlock parameters
 * @returns The unlocked lineup
 * @throws Error if validation fails or database operation fails
 */
export async function unlockMatchLineup(params: UnlockLineupParams): Promise<MatchLineup> {
  // Verify user is on the team
  const { data: teamCheck, error: teamCheckError } = await supabase
    .from('team_players')
    .select('*')
    .eq('team_id', params.teamId)
    .eq('member_id', params.memberId)
    .single();

  if (teamCheckError || !teamCheck) {
    throw new Error('You are not a member of this team');
  }

  const { data, error } = await supabase
    .from('match_lineups')
    .update({ locked: false })
    .eq('id', params.lineupId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to unlock lineup: ${error.message}`);
  }

  return data;
}

/**
 * Parameters for creating an empty lineup
 */
export interface CreateEmptyLineupParams {
  matchId: string;
  teamId: string;
}

/**
 * Create an empty match lineup
 *
 * Creates a placeholder lineup record with no players selected.
 * Used when user first enters the lineup page to establish the record.
 * Handles race conditions - if lineup already exists, returns existing one.
 *
 * @param params - Match and team IDs
 * @returns The created or existing lineup
 * @throws Error if database operation fails
 *
 * @example
 * const lineup = await createEmptyLineup({ matchId: '123', teamId: 'team-456' });
 */
export async function createEmptyLineup(params: CreateEmptyLineupParams): Promise<MatchLineup> {
  // Try to insert empty lineup
  const { data, error } = await supabase
    .from('match_lineups')
    .insert({
      match_id: params.matchId,
      team_id: params.teamId,
      player1_id: null,
      player1_handicap: 0,
      player2_id: null,
      player2_handicap: 0,
      player3_id: null,
      player3_handicap: 0,
      home_team_modifier: 0,
      locked: false,
      locked_at: null,
    })
    .select()
    .single();

  // If unique constraint violation (race condition - another user just created it)
  if (error && error.code === '23505') {
    // Fetch the existing lineup
    const { data: existingLineup, error: fetchError } = await supabase
      .from('match_lineups')
      .select('*')
      .eq('match_id', params.matchId)
      .eq('team_id', params.teamId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch existing lineup: ${fetchError.message}`);
    }

    return existingLineup;
  }

  if (error) {
    throw new Error(`Failed to create lineup: ${error.message}`);
  }

  return data;
}

/**
 * Generic match lineup update parameters
 */
export interface UpdateMatchLineupParams {
  lineupId: string;
  updates: Record<string, any>; // Any lineup field(s) to update
  teamId?: string; // Optional - if provided, verifies user is on team
  memberId?: string; // Optional - required if teamId provided
}

/**
 * Update any field(s) on a match lineup
 *
 * Generic mutation that can update any lineup field(s).
 * Use this for all lineup updates instead of creating specific mutations.
 * Optionally verifies user is on the team before updating.
 *
 * @param params - Lineup ID and fields to update
 * @returns The updated lineup
 * @throws Error if validation fails or database operation fails
 *
 * @example
 * // Update locked status
 * await updateMatchLineup({
 *   lineupId: '123',
 *   updates: { locked: true }
 * });
 *
 * @example
 * // Update with team verification
 * await updateMatchLineup({
 *   lineupId: '123',
 *   updates: { locked: true },
 *   teamId: 'team-456',
 *   memberId: 'member-789'
 * });
 *
 * @example
 * // Update multiple fields
 * await updateMatchLineup({
 *   lineupId: '123',
 *   updates: {
 *     locked: true,
 *     locked_at: new Date().toISOString(),
 *     player1_id: 'player-456'
 *   }
 * });
 */
export async function updateMatchLineup(params: UpdateMatchLineupParams): Promise<MatchLineup> {
  // Optional team verification
  if (params.teamId && params.memberId) {
    const { data: teamCheck, error: teamCheckError } = await supabase
      .from('team_players')
      .select('*')
      .eq('team_id', params.teamId)
      .eq('member_id', params.memberId)
      .single();

    if (teamCheckError || !teamCheck) {
      throw new Error('You are not a member of this team');
    }
  }

  const { data, error } = await supabase
    .from('match_lineups')
    .update(params.updates)
    .eq('id', params.lineupId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update lineup: ${error.message}`);
  }

  return data;
}

/**
 * Parameters for requesting a lineup change
 */
export interface RequestLineupChangeParams {
  lineupId: string;
  position: number;
  newPlayerId: string;
  newPlayerHandicap: number;
  /** Scorekeeper who opened the request (audit only — never authorization). */
  memberId: string;
}

/**
 * Parameters for resolving (approving / denying) a pending swap request.
 * memberId is recorded in the resolution audit; it does NOT authorize the
 * action (any scorekeeper on the match may resolve — gating lives in the UI).
 */
export interface ResolveLineupChangeParams {
  lineupId: string;
  memberId: string;
}

/**
 * Request a lineup change (swap player)
 *
 * Initiates a lineup change request that requires opponent approval.
 * Only allowed if there's no pending swap request on this lineup.
 * The old player is derived from the lineup's player{position}_id field.
 *
 * @param params - Swap request parameters
 * @returns The updated lineup with pending swap request
 * @throws Error if there's already a pending request or database operation fails
 */
export async function requestLineupChange(params: RequestLineupChangeParams): Promise<MatchLineup> {
  // Check if there's already a pending swap request (swap_position being non-null)
  const { data: lineup, error: fetchError } = await supabase
    .from('match_lineups')
    .select('swap_position')
    .eq('id', params.lineupId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to check lineup: ${fetchError.message}`);
  }

  if (lineup?.swap_position) {
    throw new Error('There is already a pending lineup change request. Please wait for it to be resolved.');
  }

  // Create the swap request
  // Note: swap_new_player_name is not stored - the name is looked up from team roster at display time
  const { data, error } = await supabase
    .from('match_lineups')
    .update({
      swap_position: params.position,
      swap_new_player_id: params.newPlayerId,
      swap_new_player_handicap: params.newPlayerHandicap,
      swap_requested_at: new Date().toISOString(),
      swap_requested_by_member_id: params.memberId,
    })
    .eq('id', params.lineupId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to request lineup change: ${error.message}`);
  }

  return data;
}

/**
 * Approve a pending lineup swap request — the full recalibration path.
 *
 * Resolves the swap atomically and re-derives the match numbers so already
 * scored games are re-tallied against the new handicap bands:
 *   1. Fresh-read the lineup (never trust stale cache for atomic work).
 *   2. Resolve the match's system config + build the POST-swap lineups.
 *   3. composeMatchThresholds — system-agnostic threshold recompute.
 *   4. swap_player_in_lineup RPC — atomic apply + cascade + thresholds + audit.
 *   5. updateMatchRunningTotals — the re-derivation the old code skipped.
 *
 * Any scorekeeper on the match may approve (gating lives in the UI, not here);
 * the RPC re-checks the data-integrity guards regardless of who calls.
 *
 * @param params - { lineupId, memberId } — memberId is audit-only
 * @returns The updated lineup with the swap applied
 * @throws Error if no pending request, the RPC's guards reject, or a read fails
 */
export async function approveLineupChange(
  params: ResolveLineupChangeParams,
): Promise<MatchLineup> {
  const { lineupId, memberId } = params;

  // 1. Fresh-read the pending request + the swapping player at its position.
  const { data: lineup, error: fetchError } = await supabase
    .from('match_lineups')
    .select(
      'match_id, swap_position, swap_new_player_id, swap_new_player_handicap, ' +
        'player1_id, player2_id, player3_id, player4_id, player5_id',
    )
    .eq('id', lineupId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch lineup: ${fetchError.message}`);
  }
  if (!lineup?.swap_position) {
    throw new Error('No pending lineup change request to approve.');
  }

  const matchId = lineup.match_id as string;
  const position = lineup.swap_position as number;
  const newPlayerId = lineup.swap_new_player_id as string | null;
  const newHandicap = lineup.swap_new_player_handicap as number | null;
  const oldPlayerId = lineup[`player${position}_id` as keyof typeof lineup] as string | null;

  // 2. Match context + recompute inputs.
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select(
      'home_team_id, away_team_id, season_id, system_snapshot, ' +
        'home_to_win, home_to_tie, home_to_lose, away_to_win, away_to_tie, away_to_lose',
    )
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    throw new Error(`Failed to fetch match: ${matchError?.message ?? 'not found'}`);
  }

  // 3. System-agnostic threshold recompute for the POST-swap lineup state.
  const thresholds = await composeThresholdsForApproval({
    matchId,
    match,
    lineupId,
    position,
    newPlayerId,
    newHandicap,
  });

  // 4. Atomic apply + cascade + thresholds + audit (one transaction).
  const resolution = {
    kind: 'approved' as const,
    by_member_id: memberId,
    resolved_at: new Date().toISOString(),
    position,
    old_player_id: oldPlayerId,
    new_player_id: newPlayerId,
  };
  const { error: rpcError } = await supabase.rpc('swap_player_in_lineup', {
    p_lineup_id: lineupId,
    p_thresholds: thresholds,
    p_resolution: resolution,
  });
  if (rpcError) {
    throw new Error(rpcError.message);
  }

  // 5. Re-derive running totals so confirmed games are re-scored against the
  //    new bands — the step the previous implementation was missing.
  const { updateMatchRunningTotals } = await import('@/api/queries/matches');
  await updateMatchRunningTotals(matchId);

  const { data: updated, error: rereadError } = await supabase
    .from('match_lineups')
    .select('*')
    .eq('id', lineupId)
    .single();
  if (rereadError || !updated) {
    throw new Error(`Swap applied but re-read failed: ${rereadError?.message ?? 'no row'}`);
  }
  return updated;
}

/**
 * Resolve the post-swap threshold payload for an approval. Reads the match's
 * resolved system config (frozen snapshot, or live prefs as a legacy
 * fallback), builds the POST-swap home/away lineups, and runs the
 * system-agnostic composer. If the config can't be resolved (rare legacy
 * match) the current thresholds are kept unchanged so the swap still applies.
 */
async function composeThresholdsForApproval(args: {
  matchId: string;
  match: Record<string, unknown>;
  lineupId: string;
  position: number;
  newPlayerId: string | null;
  newHandicap: number | null;
}): Promise<ThresholdPayload> {
  const { matchId, match, lineupId, position, newPlayerId, newHandicap } = args;

  // Prefer the frozen snapshot; populate from live prefs if a legacy match
  // never got one.
  let prefs = (match.system_snapshot ?? null) as ResolvedSystemConfig | null;
  if (!prefs) {
    const { data: season } = await supabase
      .from('seasons')
      .select('league_id')
      .eq('id', match.season_id as string)
      .single();
    if (season?.league_id) {
      const { populateMatchSnapshotIfNeeded } = await import('@/api/queries/matches');
      await populateMatchSnapshotIfNeeded(matchId, season.league_id);
      const { data: reread } = await supabase
        .from('matches')
        .select('system_snapshot')
        .eq('id', matchId)
        .single();
      prefs = (reread?.system_snapshot ?? null) as ResolvedSystemConfig | null;
    }
  }

  // No resolved config — can't recompute safely; keep current thresholds.
  if (!prefs) {
    console.warn('[approveLineupChange] no resolved system config — thresholds unchanged');
    return {
      home_to_win: (match.home_to_win ?? null) as number | null,
      home_to_tie: (match.home_to_tie ?? null) as number | null,
      home_to_lose: (match.home_to_lose ?? null) as number | null,
      away_to_win: (match.away_to_win ?? null) as number | null,
      away_to_tie: (match.away_to_tie ?? null) as number | null,
      away_to_lose: (match.away_to_lose ?? null) as number | null,
    };
  }

  // Build POST-swap lineups: apply the new player's handicap at its position on
  // the swapping lineup; leave the opponent untouched.
  const { data: lineups, error } = await supabase
    .from('match_lineups')
    .select(
      'id, team_id, player1_id, player1_handicap, player2_id, player2_handicap, ' +
        'player3_id, player3_handicap, player4_id, player4_handicap, player5_id, player5_handicap',
    )
    .eq('match_id', matchId);
  if (error || !lineups) {
    throw new Error(`Failed to read lineups for recompute: ${error?.message ?? 'none'}`);
  }

  const applyPostSwap = (l: Record<string, unknown>): Lineup => {
    const next: Record<string, unknown> = { ...l };
    if (l.id === lineupId) {
      next[`player${position}_id`] = newPlayerId;
      next[`player${position}_handicap`] = newHandicap;
    }
    return next as unknown as Lineup;
  };

  const homeRow = lineups.find((l) => l.team_id === match.home_team_id);
  const awayRow = lineups.find((l) => l.team_id === match.away_team_id);
  if (!homeRow || !awayRow) {
    throw new Error('Could not identify home/away lineups for recompute');
  }

  return composeMatchThresholds({
    prefs,
    homeLineup: applyPostSwap(homeRow),
    awayLineup: applyPostSwap(awayRow),
    homeTeamId: match.home_team_id as string,
    awayTeamId: match.away_team_id as string,
    seasonId: match.season_id as string,
  });
}

/**
 * Deny a pending lineup swap request.
 *
 * Clears the swap_* request columns without touching the lineup, and stamps
 * swap_last_resolution with the denial so the initiator's client can show a
 * resolution toast / audit. Any scorekeeper on the match may deny.
 *
 * @param params - { lineupId, memberId } — memberId is audit-only
 * @returns The updated lineup with the swap request cleared
 * @throws Error if no pending request or the database operation fails
 */
export async function denyLineupChange(
  params: ResolveLineupChangeParams,
): Promise<MatchLineup> {
  const { lineupId, memberId } = params;

  const { data: lineup, error: fetchError } = await supabase
    .from('match_lineups')
    .select(
      'swap_position, swap_new_player_id, player1_id, player2_id, player3_id, player4_id, player5_id',
    )
    .eq('id', lineupId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch lineup: ${fetchError.message}`);
  }
  if (!lineup?.swap_position) {
    throw new Error('No pending lineup change request to deny.');
  }

  const position = lineup.swap_position as number;
  const oldPlayerId = lineup[`player${position}_id` as keyof typeof lineup] as string | null;

  const resolution = {
    kind: 'denied' as const,
    by_member_id: memberId,
    resolved_at: new Date().toISOString(),
    position,
    old_player_id: oldPlayerId,
    new_player_id: lineup.swap_new_player_id,
  };

  const { data, error } = await supabase
    .from('match_lineups')
    .update({
      swap_position: null,
      swap_new_player_id: null,
      swap_new_player_handicap: null,
      swap_requested_at: null,
      swap_requested_by_member_id: null,
      swap_last_resolution: resolution,
    })
    .eq('id', lineupId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to deny lineup change: ${error.message}`);
  }
  return data;
}
