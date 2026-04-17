/**
 * @fileoverview Player Handicap Hooks (TanStack Query)
 *
 * Fetches player handicaps in parallel with per-match caching.
 * Uses the league's handicapType ('points' / 'percentage' / 'fargo' / 'none')
 * instead of the old teamFormat ('5_man' / '8_man').
 *
 * For Fargo: returns stale ratings from the last match (marked with stale flag)
 * or null if the player is unrated. The lineup page uses the stale flag to
 * show an asterisk (e.g., "491*") and render an editable input.
 */

import { useQueries } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { calculatePlayerHandicap, type HandicapResult } from '@/utils/calculatePlayerHandicap';

interface UsePlayerHandicapsParams {
  playerIds: string[];
  /** Which handicap system: 'points', 'percentage', 'fargo', 'none' */
  handicapType: string;
  /** Strength modifier: 'standard', 'reduced', 'none' */
  handicapVariant: string;
  gameType: 'eight_ball' | 'nine_ball' | 'ten_ball';
  leagueId?: string;
  gameLimit?: number;
  /** Scopes cache per-match so handicaps stay stable during a match session */
  matchId?: string;
}

const HANDICAP_STALE_TIME = Infinity;

/**
 * Fetch handicaps for multiple players in parallel.
 *
 * Returns a Map of playerId → HandicapResult. Each result has:
 *   - value: the handicap number (or null if unrated)
 *   - stale: true if the value came from a previous match (Fargo fallback)
 *
 * Missing entries (player not in map) = query still loading or errored.
 */
export function usePlayerHandicaps({
  playerIds,
  handicapType,
  handicapVariant,
  gameType,
  leagueId,
  gameLimit = 200,
  matchId,
}: UsePlayerHandicapsParams) {
  const queries = useQueries({
    queries: playerIds.map((playerId) => ({
      queryKey: [
        ...queryKeys.players.handicap(playerId),
        handicapType,
        handicapVariant,
        gameType,
        leagueId || 'none',
        gameLimit,
        matchId || 'no-match',
      ],
      queryFn: () =>
        calculatePlayerHandicap(
          playerId,
          handicapType as 'points' | 'percentage' | 'fargo' | 'skill_level' | 'none',
          handicapVariant as 'standard' | 'reduced' | 'none',
          gameType,
          leagueId,
          gameLimit,
        ),
      staleTime: HANDICAP_STALE_TIME,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  });

  const handicaps = new Map<string, HandicapResult>();
  queries.forEach((query, index) => {
    if (query.data) {
      handicaps.set(playerIds[index], query.data);
    }
  });

  const isLoading = queries.some((q) => q.isLoading);
  const errors = queries.filter((q) => q.error).map((q) => q.error);

  return {
    handicaps,
    isLoading,
    errors: errors.length > 0 ? errors : null,
  };
}
