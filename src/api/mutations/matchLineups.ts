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
import { getHandicapThresholds } from '@/api/queries/handicaps';

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
 * Recalculate and update handicap thresholds for a match
 *
 * Called after a lineup change to update games_to_win, games_to_tie, games_to_lose
 * for both teams based on the new handicap totals.
 *
 * Simple approach: Sum lineup handicaps, compare to chart, update match.
 * Team bonus is already included in lineup handicaps from initial calculation.
 *
 * @param matchId - The match to recalculate thresholds for
 */
async function recalculateMatchThresholds(matchId: string): Promise<void> {
  // Fetch match with team IDs
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    console.error('Failed to fetch match for threshold recalculation:', matchError?.message);
    return;
  }

  // Fetch both lineups with their current handicaps
  const { data: lineups, error: lineupsError } = await supabase
    .from('match_lineups')
    .select('team_id, player1_handicap, player2_handicap, player3_handicap, player4_handicap, player5_handicap')
    .eq('match_id', matchId);

  if (lineupsError || !lineups || lineups.length !== 2) {
    console.error('Failed to fetch lineups for threshold recalculation:', lineupsError?.message);
    return;
  }

  const homeLineup = lineups.find(l => l.team_id === match.home_team_id);
  const awayLineup = lineups.find(l => l.team_id === match.away_team_id);

  if (!homeLineup || !awayLineup) {
    console.error('Could not identify home/away lineups');
    return;
  }

  // Derive handicapType from lineup data — if player4/5 are populated, it's percentage.
  // This is a fallback for mid-match recalculations. New matches get handicapType from prefs.
  const usesExtendedLineup = (homeLineup.player4_handicap !== null && homeLineup.player4_handicap !== 0) ||
                              (homeLineup.player5_handicap !== null && homeLineup.player5_handicap !== 0);
  const handicapType = usesExtendedLineup ? 'percentage' : 'points';

  // Calculate player handicap totals (sum all player handicaps)
  // Team bonus is already baked into the lineup handicaps from initial match preparation
  const homeHandicapTotal =
    (homeLineup.player1_handicap || 0) +
    (homeLineup.player2_handicap || 0) +
    (homeLineup.player3_handicap || 0) +
    (homeLineup.player4_handicap || 0) +
    (homeLineup.player5_handicap || 0);

  const awayHandicapTotal =
    (awayLineup.player1_handicap || 0) +
    (awayLineup.player2_handicap || 0) +
    (awayLineup.player3_handicap || 0) +
    (awayLineup.player4_handicap || 0) +
    (awayLineup.player5_handicap || 0);

  // Look up thresholds based on handicap difference
  const homeThresholds = getHandicapThresholds(homeHandicapTotal - awayHandicapTotal, handicapType);
  const awayThresholds = getHandicapThresholds(awayHandicapTotal - homeHandicapTotal, handicapType);

  // Update match with new thresholds
  const { error: updateError } = await supabase
    .from('matches')
    .update({
      home_to_win: homeThresholds.games_to_win,
      home_to_tie: homeThresholds.games_to_tie,
      home_to_lose: homeThresholds.games_to_lose,
      away_to_win: awayThresholds.games_to_win,
      away_to_tie: awayThresholds.games_to_tie,
      away_to_lose: awayThresholds.games_to_lose,
    })
    .eq('id', matchId);

  if (updateError) {
    console.error('Failed to update match thresholds:', updateError.message);
  }
}

/**
 * Approve a lineup change request
 *
 * Updates the lineup with the new player and clears the swap request fields.
 * Also updates all match_games where the old player was assigned to use the new player.
 * Recalculates handicap thresholds for both teams.
 *
 * IMPORTANT: Players can only be swapped if they have NOT played any games yet.
 * If the old player has any games with a winner_player_id, the swap is rejected.
 *
 * Should only be called by the opposing team.
 *
 * @param lineupId - The lineup with the pending swap request
 * @returns The updated lineup with the swap applied
 * @throws Error if player has played games, no pending request, or database operation fails
 */
export async function approveLineupChange(lineupId: string): Promise<MatchLineup> {
  // Fetch the pending swap request AND the old player ID at that position, plus match_id and team_id
  const { data: lineup, error: fetchError } = await supabase
    .from('match_lineups')
    .select('match_id, team_id, swap_position, swap_new_player_id, swap_new_player_handicap, player1_id, player2_id, player3_id, player4_id, player5_id')
    .eq('id', lineupId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch lineup: ${fetchError.message}`);
  }

  if (!lineup?.swap_position) {
    throw new Error('No pending lineup change request to approve.');
  }

  // Get the old player ID from the lineup at the swap position
  const oldPlayerId = lineup[`player${lineup.swap_position}_id` as keyof typeof lineup] as string | null;

  // Check if the old player has played any games (has winner_player_id set)
  // Players can only be swapped if they haven't played yet
  if (oldPlayerId) {
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('home_team_id, away_team_id')
      .eq('id', lineup.match_id)
      .single();

    if (matchError) {
      throw new Error(`Failed to fetch match: ${matchError.message}`);
    }

    const isHomeTeam = match.home_team_id === lineup.team_id;
    const playerField = isHomeTeam ? 'home_player_id' : 'away_player_id';

    // Check if the old player has any completed games (winner_player_id is set)
    const { data: completedGames, error: gamesCheckError } = await supabase
      .from('match_games')
      .select('id, game_number')
      .eq('match_id', lineup.match_id)
      .eq(playerField, oldPlayerId)
      .not('winner_player_id', 'is', null);

    if (gamesCheckError) {
      throw new Error(`Failed to check player games: ${gamesCheckError.message}`);
    }

    if (completedGames && completedGames.length > 0) {
      throw new Error('Cannot swap this player - they have already played games in this match.');
    }
  }

  // Build the update to apply the swap and clear request fields
  const positionField = `player${lineup.swap_position}_id`;
  const handicapField = `player${lineup.swap_position}_handicap`;

  const { data, error } = await supabase
    .from('match_lineups')
    .update({
      [positionField]: lineup.swap_new_player_id,
      [handicapField]: lineup.swap_new_player_handicap,
      // Clear swap request fields
      swap_position: null,
      swap_new_player_id: null,
      swap_new_player_handicap: null,
      swap_requested_at: null,
    })
    .eq('id', lineupId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to approve lineup change: ${error.message}`);
  }

  // Update all match_games where the old player was assigned (only unplayed games)
  // Since we verified above that the player has no completed games, all their games are unplayed
  if (oldPlayerId && lineup.swap_new_player_id) {
    const { data: match } = await supabase
      .from('matches')
      .select('home_team_id')
      .eq('id', lineup.match_id)
      .single();

    if (match) {
      const isHomeTeam = match.home_team_id === lineup.team_id;
      const playerField = isHomeTeam ? 'home_player_id' : 'away_player_id';

      // Update all games in this match where the old player was assigned
      const { error: gamesError } = await supabase
        .from('match_games')
        .update({ [playerField]: lineup.swap_new_player_id })
        .eq('match_id', lineup.match_id)
        .eq(playerField, oldPlayerId);

      if (gamesError) {
        console.error('Failed to update match games with new player:', gamesError.message);
      }
    }
  }

  // Recalculate handicap thresholds since a player's handicap has changed
  // This affects games_to_win, games_to_tie, games_to_lose for both teams
  await recalculateMatchThresholds(lineup.match_id);

  return data;
}

/**
 * Deny a lineup change request
 *
 * Clears the swap request fields without making any player changes.
 * Should only be called by the opposing team.
 *
 * @param lineupId - The lineup with the pending swap request
 * @returns The updated lineup with swap request cleared
 * @throws Error if no pending request or database operation fails
 */
export async function denyLineupChange(lineupId: string): Promise<MatchLineup> {
  // Verify there's a pending request (swap_position being non-null)
  const { data: lineup, error: fetchError } = await supabase
    .from('match_lineups')
    .select('swap_position')
    .eq('id', lineupId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch lineup: ${fetchError.message}`);
  }

  if (!lineup?.swap_position) {
    throw new Error('No pending lineup change request to deny.');
  }

  // Clear all swap request fields
  const { data, error } = await supabase
    .from('match_lineups')
    .update({
      swap_position: null,
      swap_new_player_id: null,
      swap_new_player_handicap: null,
      swap_requested_at: null,
    })
    .eq('id', lineupId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to deny lineup change: ${error.message}`);
  }

  return data;
}
