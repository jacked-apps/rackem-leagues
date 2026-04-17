/**
 * @fileoverview Player Handicap Calculator
 *
 * Calculates a player's handicap based on the league's handicap type:
 *   - 'points': Integer handicap (-2 to +2 standard, -1 to +1 reduced)
 *     calculated from (wins - losses) / weeks_played.
 *   - 'percentage': Win percentage (0-100% standard, 0-50% reduced)
 *     calculated from wins / games_played.
 *   - 'fargo': Three-step fallback chain:
 *       1. FargoRate API lookup (TODO — not yet integrated)
 *       2. Last match played → reads the stored handicap from match_lineups.
 *          Returned with `stale: true` so the UI can mark it (e.g., "491*").
 *       3. No data → returns null (display "Unrated" or manual entry).
 *   - 'none': No handicapping. Returns null.
 */

import { fetchPlayerGameHistory } from '@/api/queries/matchGames';
import { supabase } from '@/supabaseClient';
import { logger } from '@/utils/logger';

/** Handicap calculation method — from preferences.handicap_type */
type HandicapType = 'points' | 'percentage' | 'fargo' | 'skill_level' | 'none';

/** Handicap variant/strength — from preferences.handicap_variant */
type HandicapVariant = 'standard' | 'reduced' | 'none';

/** Result from calculatePlayerHandicap */
export interface HandicapResult {
  /** The handicap value, or null if no data available */
  value: number | null;
  /** True if the value is stale (e.g., from a previous match, not live API) */
  stale: boolean;
}

/**
 * Calculate a player's handicap based on the league's handicap type.
 *
 * @returns HandicapResult with the value and a stale flag.
 *   - points/percentage: value is always a number, stale is always false.
 *   - fargo: value from API (fresh) or last match (stale) or null (unrated).
 *   - none: value is null.
 */
export async function calculatePlayerHandicap(
  playerId: string,
  handicapType: HandicapType,
  handicapVariant: HandicapVariant,
  gameType: 'eight_ball' | 'nine_ball' | 'ten_ball',
  leagueId?: string,
  gameLimit: number = 200,
): Promise<HandicapResult> {
  // No handicapping — nothing to show.
  if (handicapType === 'none') return { value: null, stale: false };

  // Fargo: three-step fallback chain.
  if (handicapType === 'fargo') return calculateFargoHandicap(playerId);

  // Handle 'none' variant within a calculated system — return the system's default.
  if (handicapVariant === 'none') {
    return { value: handicapType === 'points' ? 0 : 40, stale: false };
  }

  try {
    const games = await fetchPlayerGameHistory(playerId, gameType, leagueId, gameLimit);

    // Not enough history — fall back to the player's starting handicap.
    if (!games || games.length < 15) {
      const { data: player, error } = await supabase
        .from('members')
        .select('starting_handicap_3v3, starting_handicap_5v5')
        .eq('id', playerId)
        .single();

      if (error) {
        logger.error('Error fetching player starting handicap', { error: error.message });
        return { value: handicapType === 'points' ? 0 : 40, stale: false };
      }

      if (handicapType === 'points') {
        return { value: player?.starting_handicap_3v3 ?? 0, stale: false };
      }
      return { value: player?.starting_handicap_5v5 ?? 40, stale: false };
    }

    const wins = games.filter((g) => g.winner_player_id === playerId).length;
    const gamesPlayed = games.length;

    if (handicapType === 'points') {
      const weeksPlayed = gamesPlayed / 6;
      const rawHandicap = (wins - (gamesPlayed - wins)) / weeksPlayed;
      return { value: roundToPointsHandicap(rawHandicap, handicapVariant), stale: false };
    }

    // 'percentage'
    const winPercentage = (wins / gamesPlayed) * 100;
    return { value: convertToPercentageHandicap(winPercentage, handicapVariant), stale: false };
  } catch (error) {
    logger.error('Error calculating player handicap', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { value: handicapType === 'points' ? 0 : 40, stale: false };
  }
}

/**
 * Fargo handicap: three-step fallback.
 *   1. FargoRate API (TODO — returns null until integrated)
 *   2. Last match's stored handicap from match_lineups (stale)
 *   3. No data (null)
 */
async function calculateFargoHandicap(playerId: string): Promise<HandicapResult> {
  // Step 1: FargoRate API lookup.
  // TODO: Implement when API access is available. For now, always falls through.
  const apiRating = await fetchFargoFromApi(playerId);
  if (apiRating !== null) return { value: apiRating, stale: false };

  // Step 2: Last match played — find the most recent lineup that includes
  // this player and read the stored handicap from whichever slot they were in.
  try {
    const { data: lineups, error } = await supabase
      .from('match_lineups')
      .select(`
        player1_id, player1_handicap,
        player2_id, player2_handicap,
        player3_id, player3_handicap,
        player4_id, player4_handicap,
        player5_id, player5_handicap,
        matches!inner(scheduled_date, status)
      `)
      .or(
        `player1_id.eq.${playerId},player2_id.eq.${playerId},player3_id.eq.${playerId},player4_id.eq.${playerId},player5_id.eq.${playerId}`,
      )
      .eq('locked', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !lineups || lineups.length === 0) {
      return { value: null, stale: false }; // Step 3: no data
    }

    const lineup = lineups[0];
    // Find which slot this player was in and return that handicap
    for (let i = 1; i <= 5; i++) {
      const idKey = `player${i}_id` as keyof typeof lineup;
      const hcKey = `player${i}_handicap` as keyof typeof lineup;
      if (lineup[idKey] === playerId && lineup[hcKey] != null) {
        return { value: Number(lineup[hcKey]), stale: true };
      }
    }

    return { value: null, stale: false }; // Step 3: player found in lineup but no handicap stored
  } catch (error) {
    logger.error('Error fetching last Fargo rating from match_lineups', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { value: null, stale: false }; // Step 3: error → no data
  }
}

/**
 * TODO: FargoRate API integration.
 * When API access is available, this function will fetch the player's
 * current Fargo rating. For now, always returns null (falls through to
 * step 2: last match lookup).
 */
async function fetchFargoFromApi(_playerId: string): Promise<number | null> {
  // TODO: Implement FargoRate API call here.
  // Expected: fetch from fargorate.com API using player's linked Fargo ID.
  // Return the rating (e.g., 491) or null if lookup fails.
  return null;
}

/**
 * Round raw handicap to valid points-system integer.
 * Standard: -2 to +2. Reduced: -1 to +1.
 */
function roundToPointsHandicap(raw: number, variant: HandicapVariant): number {
  const rounded = Math.round(raw);
  const cap = variant === 'standard' ? 2 : 1;
  return Math.max(-cap, Math.min(cap, rounded));
}

/**
 * Convert win percentage to percentage-system handicap.
 * Standard: 0-100%. Reduced: 0-50%.
 */
function convertToPercentageHandicap(winPct: number, variant: HandicapVariant): number {
  if (variant === 'standard') {
    return Math.max(0, Math.min(100, Math.round(winPct)));
  }
  return Math.max(0, Math.min(50, Math.round(winPct / 2)));
}
