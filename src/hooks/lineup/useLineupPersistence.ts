/**
 * @fileoverview Hook for lineup save/lock/unlock operations
 *
 * Handles all database operations for saving and locking lineups.
 * Manages the interaction between match_lineups and matches tables.
 *
 * NOTE: Lineups are auto-created by database trigger when matches are created.
 * This hook only UPDATES existing lineups, never inserts new ones.
 */

import { supabase } from '@/supabaseClient';
import { useUpdateMatch, useUpdateMatchLineup } from '@/api/hooks';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { computeLineupCompleteness } from '@/utils/lineup';

interface LineupPersistenceParams {
  matchId: string | undefined;
  userTeamId: string | undefined;
  memberId: string | undefined;
  lineupId: string | null;
  player1Id: string;
  player2Id: string;
  player3Id: string;
  player4Id?: string; // Optional for 5v5
  player5Id?: string; // Optional for 5v5
  player1Handicap: number;
  player2Handicap: number;
  player3Handicap: number;
  player4Handicap?: number; // Optional for 5v5
  player5Handicap?: number; // Optional for 5v5
  playerCount?: number; // Defaults to 3 for backward compatibility
  teamHandicap: number;
  isComplete: boolean;
  hasDuplicates: boolean;
  onLineupIdChange: (id: string) => void;
  onLockedChange: (locked: boolean) => void;
  matchData?: any;
  refetchLineups?: () => void; // Optional refetch function for lineup updates
}

export function useLineupPersistence(params: LineupPersistenceParams) {
  const {
    matchId,
    userTeamId,
    memberId,
    lineupId,
    player1Id,
    player2Id,
    player3Id,
    player4Id = '',
    player5Id = '',
    player1Handicap,
    player2Handicap,
    player3Handicap,
    player4Handicap = 0,
    player5Handicap = 0,
    playerCount = 3,
    teamHandicap,
    isComplete,
    hasDuplicates,
    onLineupIdChange,
    onLockedChange,
    matchData,
    refetchLineups,
  } = params;

  const updateLineupMutation = useUpdateMatchLineup();
  const updateMatchMutation = useUpdateMatch();

  /**
   * Handle lock lineup - Save to database and lock
   */
  const handleLockLineup = async () => {
    if (!isComplete) {
      // Derive a precise reason from the completeness function rather than
      // hardcoding "3 players" — works for any lineup_size, any handicap system.
      const row = {
        player1_id: player1Id,
        player1_handicap: player1Handicap,
        player2_id: player2Id,
        player2_handicap: player2Handicap,
        player3_id: player3Id,
        player3_handicap: player3Handicap,
        player4_id: player4Id,
        player4_handicap: player4Handicap,
        player5_id: player5Id,
        player5_handicap: player5Handicap,
      };
      const result = computeLineupCompleteness(row, playerCount);
      const message = result.reasons[0] ?? `Please complete all ${playerCount} lineup slots before locking`;
      toast.error(message);
      return;
    }

    if (hasDuplicates) {
      toast.error(
        'Two or more players in your lineup have the same nickname. Please have at least one of them go to their profile page to change their nickname so they will be identifiable during scoring.'
      );
      return;
    }

    if (!matchId || !userTeamId) {
      toast.error('Error: Missing match or team information');
      return;
    }

    try {
      // Verify user is on the team
      const { data: teamCheck, error: teamCheckError } = await supabase
        .from('team_players')
        .select('*')
        .eq('team_id', userTeamId)
        .eq('member_id', memberId)
        .single();

      if (teamCheckError || !teamCheck) {
        throw new Error('You are not a member of this team');
      }

      // Prepare lineup data (keep substitute IDs, don't convert to null)
      const lineupData: any = {
        match_id: matchId,
        team_id: userTeamId,
        player1_id: player1Id,
        player1_handicap: player1Handicap,
        player2_id: player2Id,
        player2_handicap: player2Handicap,
        player3_id: player3Id,
        player3_handicap: player3Handicap,
        home_team_modifier: teamHandicap, // Team modifier from standings (currently 0)
        locked: true,
        locked_at: new Date().toISOString(), // Timestamp when lineup was locked
      };

      // Add player4/5 based on actual lineup size
      if (playerCount >= 4) {
        lineupData.player4_id = player4Id || null;
        lineupData.player4_handicap = player4Handicap;
      }
      if (playerCount >= 5) {
        lineupData.player5_id = player5Id || null;
        lineupData.player5_handicap = player5Handicap;
      }

      // Lineups are auto-created by DB trigger - we should ONLY update, never insert
      if (!lineupId) {
        throw new Error('Lineup ID is missing. Lineups should be auto-created by the database trigger when the match is created.');
      }

      // Update existing lineup
      const result = await updateLineupMutation.mutateAsync({
        lineupId: lineupId,
        updates: lineupData,
        matchId,
      });

      // Update local state
      onLineupIdChange(result.id);
      onLockedChange(true);

      // Save lineup ID to matches table
      const isHomeTeam = userTeamId === matchData?.home_team_id;
      const lineupField = isHomeTeam ? 'home_lineup_id' : 'away_lineup_id';

      // Check if opponent lineup is already locked
      const opponentLineupField = isHomeTeam
        ? 'away_lineup_id'
        : 'home_lineup_id';
      const opponentLineupLocked = matchData?.[opponentLineupField] != null;

      // If both lineups are now locked, set started_at timestamp
      const matchUpdateData: any = { [lineupField]: result.id };
      if (opponentLineupLocked && !matchData?.started_at) {
        matchUpdateData.started_at = new Date().toISOString();
      }

      try {
        await updateMatchMutation.mutateAsync({
          matchId,
          updates: matchUpdateData,
        });
      } catch (matchUpdateError: any) {
        logger.error('Error updating match with lineup ID', {
          error: matchUpdateError instanceof Error ? matchUpdateError.message : String(matchUpdateError),
          matchId
        });
        // Don't throw - lineup is still locked, just log the error
      }
    } catch (err: any) {
      logger.error('Error saving lineup', {
        error: err instanceof Error ? err.message : String(err),
        matchId,
        lineupId
      });
      toast.error(`Failed to save lineup: ${err.message || 'Unknown error'}`);
    }
  };

  /**
   * Handle unlock lineup - Only allowed if opponent hasn't locked yet
   *
   * Removes any duplicate players (both occurrences set to null).
   * This handles the 5v5 double duty case where opponent chose a player to appear twice.
   */
  const handleUnlockLineup = async () => {
    if (!lineupId || !matchId) {
      toast.error('Error: No lineup to unlock');
      return;
    }

    try {
      const updates: any = { locked: false, locked_at: null };

      // Check for duplicate players across all positions (works for both 3v3 and 5v5)
      const playerIds = [player1Id, player2Id, player3Id, player4Id, player5Id];
      const playerIdCounts = new Map<string, number[]>();

      // Count occurrences of each player ID and track positions
      playerIds.forEach((id, index) => {
        if (id) {
          const positions = playerIdCounts.get(id) || [];
          positions.push(index + 1);
          playerIdCounts.set(id, positions);
        }
      });

      // Find duplicates (player appearing in 2+ positions) and remove ALL occurrences
      for (const [, positions] of playerIdCounts.entries()) {
        if (positions.length > 1) {
          // Set both positions to null (ID) and 0 (handicap - can't be null due to DB constraint)
          positions.forEach((pos) => {
            updates[`player${pos}_id`] = null;
            updates[`player${pos}_handicap`] = 0;
          });
        }
      }

      await updateLineupMutation.mutateAsync({
        lineupId: lineupId,
        updates,
        matchId,
      });

      onLockedChange(false);

      // Refetch lineups to sync UI with duplicate removals
      if (refetchLineups) {
        refetchLineups();
      }
    } catch (err: any) {
      logger.error('Error unlocking lineup', {
        error: err instanceof Error ? err.message : String(err),
        lineupId,
        matchId
      });
      toast.error('Failed to unlock lineup. Please try again.');
    }
  };

  /**
   * Auto-save lineup selections (without locking)
   * Called when player selections change in the dropdowns
   */
  const autoSaveLineup = async () => {
    if (!lineupId || !matchId) {
      return;
    }

    try {
      const lineupData = {
        player1_id: player1Id || null,
        player2_id: player2Id || null,
        player3_id: player3Id || null,
        player1_handicap: player1Handicap,
        player2_handicap: player2Handicap,
        player3_handicap: player3Handicap,
        // Don't update locked status or home_team_modifier
      };

      await updateLineupMutation.mutateAsync({
        lineupId: lineupId,
        updates: lineupData,
        matchId,
      });

    } catch (err: any) {
      logger.error('Auto-save error', {
        error: err instanceof Error ? err.message : String(err),
        matchId,
        lineupId
      });
      // Don't alert user - auto-save failures shouldn't be intrusive
    }
  };

  return {
    handleLockLineup,
    handleUnlockLineup,
    autoSaveLineup,
  };
}
