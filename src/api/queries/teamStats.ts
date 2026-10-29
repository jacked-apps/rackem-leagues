/**
 * @fileoverview Team Stats Query Functions
 *
 * Fetches combined team and player statistics for a season.
 * Shows hierarchical view: team standings with player breakdowns underneath.
 */

import { supabase } from '@/supabaseClient';
import { fetchSeasonStandings, type TeamStanding } from './standings';
import { fetchAllRows } from './fetchAllRows';

/**
 * Player stats for a specific team in a season
 */
export interface PlayerTeamStats {
  playerId: string;
  playerName: string;
  gamesWon: number;
  gamesLost: number;
  matchesPlayed: number; // Number of matches player was in lineup for
  isSubstitute: boolean; // True for substitute aggregated stats
}

/**
 * Team with player breakdown
 */
export interface TeamWithPlayerStats extends TeamStanding {
  players: PlayerTeamStats[];
}

/**
 * Fetch team stats with player breakdowns for a season
 *
 * Returns hierarchical data structure:
 * - Team-level standings (from standings query)
 * - Player-level stats for each team (games won/lost, matches played)
 * - Substitute stats aggregated as a single "Substitutes" entry per team
 *
 * Data sources:
 * - Team standings: matches table
 * - Player stats: match_games and lineups tables
 * - Excludes tiebreaker games (is_tiebreaker = false)
 * - Only includes completed/verified matches
 *
 * @param seasonId - Season's primary key ID
 * @returns Array of teams with player stats (in standings order)
 * @throws Error if database query fails
 *
 * @example
 * const teamStats = await fetchTeamStats('season-123');
 * teamStats.forEach(team => {
 *   console.log(`${team.teamName}: ${team.matchWins}W-${team.matchLosses}L`);
 *   team.players.forEach(p => {
 *     console.log(`  ${p.playerName}: ${p.gamesWon}W-${p.gamesLost}L`);
 *   });
 * });
 */
export async function fetchTeamStats(seasonId: string): Promise<TeamWithPlayerStats[]> {
  // Step 1: Get team standings (match-level data)
  const standings = await fetchSeasonStandings(seasonId);

  if (standings.length === 0) {
    return [];
  }

  const teamIds = standings.map(s => s.teamId);

  // Step 2: Fetch all team rosters (all players on each team)
  const { data: teamPlayers, error: teamPlayersError } = await supabase
    .from('team_players')
    .select(`
      team_id,
      member_id,
      members!inner(id, first_name, last_name)
    `)
    .in('team_id', teamIds)
    .eq('status', 'active');

  if (teamPlayersError) {
    throw new Error(`Failed to fetch team rosters: ${teamPlayersError.message}`);
  }

  // Build initial roster map with all players (zeroed stats)
  const teamRosterMap = new Map<string, Map<string, PlayerTeamStats>>();
  teamIds.forEach(teamId => {
    teamRosterMap.set(teamId, new Map());
  });

  // Add "Substitutes" placeholder for each team
  teamIds.forEach(teamId => {
    const playerMap = teamRosterMap.get(teamId);
    if (playerMap) {
      playerMap.set('SUBSTITUTES', {
        playerId: 'SUBSTITUTES',
        playerName: 'Substitutes',
        gamesWon: 0,
        gamesLost: 0,
        matchesPlayed: 0,
        isSubstitute: true,
      });
    }
  });

  // Populate roster with all team players (zero stats initially)
  teamPlayers?.forEach((tp) => {
    const playerMap = teamRosterMap.get(tp.team_id);
    if (playerMap && tp.members) {
      playerMap.set(tp.member_id, {
        playerId: tp.member_id,
        playerName: `${tp.members.first_name} ${tp.members.last_name}`,
        gamesWon: 0,
        gamesLost: 0,
        matchesPlayed: 0,
        isSubstitute: false,
      });
    }
  });

  // Step 3: Fetch completed matches for this season
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id')
    .eq('season_id', seasonId)
    .in('status', ['completed', 'verified']);

  if (matchesError) {
    throw new Error(`Failed to fetch matches: ${matchesError.message}`);
  }

  const matchIds = matches?.map(m => m.id) || [];

  if (matchIds.length === 0) {
    // No completed matches, return roster with zero stats
    return standings.map(standing => {
      const playerMap = teamRosterMap.get(standing.teamId) || new Map();
      const players: PlayerTeamStats[] = Array.from(playerMap.values());
      return {
        ...standing,
        players,
      };
    });
  }

  // Step 4: Fetch all match_lineups for these completed matches.
  //
  // Paged like the games below: two lineup rows per match means a long season
  // approaches PostgREST's 1000-row cap too, and a truncated lineup list would
  // understate `matchesPlayed` without any error surfacing.
  const lineups = await fetchAllRows<{
    match_id: string;
    team_id: string | null;
    player1_id: string | null;
    player2_id: string | null;
    player3_id: string | null;
    player4_id: string | null;
    player5_id: string | null;
  }>(
    (from, to) =>
      supabase
        .from('match_lineups')
        .select(`
      match_id,
      team_id,
      player1_id,
      player2_id,
      player3_id,
      player4_id,
      player5_id
    `, { count: 'exact' })
        .in('match_id', matchIds)
        .order('id')
        .range(from, to),
    { label: 'team stats lineups' }
  );

  // Step 5: Fetch game stats for all players (excluding tiebreakers).
  //
  // Paged via fetchAllRows — past the 1000-row cap this came back truncated and
  // understated every player's wins and losses on the team page. `.order('id')`
  // is required for stable paging.
  const games = await fetchAllRows<{
    match_id: string;
    home_player_id: string | null;
    away_player_id: string | null;
    winner_player_id: string | null;
    is_tiebreaker: boolean;
  }>(
    (from, to) =>
      supabase
        .from('match_games')
        .select(`
      match_id,
      home_player_id,
      away_player_id,
      winner_player_id,
      is_tiebreaker
    `, { count: 'exact' })
        .in('match_id', matchIds)
        .eq('is_tiebreaker', false)
        .not('winner_player_id', 'is', null)
        .order('id')
        .range(from, to),
    { label: 'team stats games' }
  );

  // Step 6: Update player stats from lineups and games (using roster as base)
  // Count matches played per player per team
  lineups?.forEach(lineup => {
    const teamId = lineup.team_id;
    if (!teamId) return;

    const playerMap = teamRosterMap.get(teamId);
    if (!playerMap) return;

    // Helper to increment matches played
    const incrementMatches = (playerId: string | null) => {
      if (!playerId) return;

      const stats = playerMap.get(playerId);
      if (stats) {
        stats.matchesPlayed++;
      }
    };

    // Count all players in lineup (player1-5 for match_lineups table)
    incrementMatches(lineup.player1_id);
    incrementMatches(lineup.player2_id);
    incrementMatches(lineup.player3_id);
    incrementMatches(lineup.player4_id);
    incrementMatches(lineup.player5_id);
  });

  // Count games won/lost per player
  games?.forEach(game => {
    const winnerId = game.winner_player_id;
    const homeId = game.home_player_id;
    const awayId = game.away_player_id;
    const loserId = winnerId === homeId ? awayId : homeId;

    // Find which team each player belongs to
    const findPlayerTeam = (playerId: string): string | null => {
      for (const [teamId, playerMap] of teamRosterMap.entries()) {
        if (playerMap.has(playerId)) return teamId;
      }
      return null;
    };

    // Increment wins for winner
    if (winnerId) {
      const teamId = findPlayerTeam(winnerId);
      if (teamId) {
        const playerMap = teamRosterMap.get(teamId);
        const stats = playerMap?.get(winnerId);
        if (stats) {
          stats.gamesWon++;
        } else {
          // Player not on roster - must be substitute
          const subStats = playerMap?.get('SUBSTITUTES');
          if (subStats) {
            subStats.gamesWon++;
          }
        }
      }
    }

    // Increment losses for loser
    if (loserId) {
      const teamId = findPlayerTeam(loserId);
      if (teamId) {
        const playerMap = teamRosterMap.get(teamId);
        const stats = playerMap?.get(loserId);
        if (stats) {
          stats.gamesLost++;
        } else {
          // Player not on roster - must be substitute
          const subStats = playerMap?.get('SUBSTITUTES');
          if (subStats) {
            subStats.gamesLost++;
          }
        }
      }
    }
  });

  // Step 7: Return results with roster data (substitutes at bottom)
  const result: TeamWithPlayerStats[] = standings.map(standing => {
    const playerMap = teamRosterMap.get(standing.teamId) || new Map();
    const allPlayers: PlayerTeamStats[] = Array.from(playerMap.values());

    // Separate regular players from substitutes
    const regularPlayers = allPlayers.filter(p => !p.isSubstitute);
    const substitutes = allPlayers.filter(p => p.isSubstitute);

    // Put substitutes at the bottom
    const players = [...regularPlayers, ...substitutes];

    return {
      ...standing,
      players,
    };
  });

  return result;
}
