/**
 * @fileoverview Tiebreaker Lineup Hook
 *
 * Runs the lineup page's tiebreak mode against the TIEBREAK RECORD
 * (match_tiebreaker_lineups) — Unit 3 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md.
 *
 * Ed's rules, which this hook exists to keep:
 * - Same players who played the match, only the order changes. The page's
 *   normal dropdowns are reused; their list is the match lineup (see
 *   tiebreakPicks.ts), and double duty is counted, never deduped.
 * - Handicaps are COPIED from the match lineup — never looked up or recalculated.
 * - Anyone on the team may set it, not just the captain (no role checks here).
 *
 * Nothing here writes match_lineups. Previously this hook also pushed picks
 * into the match lineup's on-screen state, which a match-lineup lock could then
 * have written back — that path is gone.
 */

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/api/queryKeys';
import type { MatchTiebreaker, TiebreakerLineupRow } from '@/api/queries/tiebreakers';
import {
  setTiebreakSlot,
  lockTiebreakLineup,
  unlockTiebreakLineup,
} from '@/api/mutations/tiebreakerLineups';
import { tiebreakChoices } from '@/utils/tiebreaker/tiebreakPicks';
import type { Tables } from '@/types/database.types';
import { logger } from '@/utils/logger';

type SlotKey = `player${1 | 2 | 3 | 4 | 5}`;

interface TiebreakerLineupParams {
  matchId: string | undefined;
  isHomeTeam: boolean;
  /** This side's tiebreak lineup row (undefined while the record loads). */
  myTiebreakLineup: TiebreakerLineupRow | undefined;
  /** Slots in the tiebreaker — the record's players_per_side. */
  slotCount: number;
  /** This side's MATCH lineup: the only source of players and handicaps. */
  myMatchLineup: Tables<'match_lineups'> | null | undefined;
  /** Slot ids of the match lineup (lineupSlotIds) — double duty kept twice. */
  matchLineupIds: string[];
  /** The match's tiebreak game rows; the lock copies the order onto them. */
  tiebreakGames: { id: string; game_number: number }[];
}

/**
 * Hook to manage a side's tiebreak order on the lineup page.
 *
 * @param params - See TiebreakerLineupParams
 * @returns Getters and handlers the lineup page wires into its existing controls
 */
export function useTiebreakerLineup(params: TiebreakerLineupParams) {
  const { matchId, isHomeTeam, myTiebreakLineup, slotCount, myMatchLineup, matchLineupIds, tiebreakGames } =
    params;
  const queryClient = useQueryClient();
  const recordKey = queryKeys.matches.tiebreaker(matchId || '');

  /** Player id in a tiebreak position ('' when empty or still loading). */
  const getTiebreakerPlayerIdByPosition = (position: number): string =>
    (myTiebreakLineup?.[`player${position}_id` as `${SlotKey}_id`] as string | null) ?? '';

  const picks = Array.from({ length: slotCount }, (_, i) => getTiebreakerPlayerIdByPosition(i + 1));

  /** Dropdown options for one position (counts double duty). */
  const getTiebreakerChoices = (position: number) => tiebreakChoices(matchLineupIds, picks, position);

  /** The handicap a player carried in the match lineup — copied, never computed. */
  const handicapFromMatchLineup = (playerId: string): number | null => {
    for (let slot = 1; slot <= 5; slot++) {
      if (myMatchLineup?.[`player${slot}_id` as `${SlotKey}_id`] === playerId) {
        return (myMatchLineup[`player${slot}_handicap` as `${SlotKey}_handicap`] as number | null) ?? null;
      }
    }
    return null;
  };

  /**
   * Write one slot: optimistic cache update so the dropdown responds at once,
   * then the database, then a refetch to settle on the truth.
   */
  const writeSlot = async (position: number, playerId: string | null) => {
    if (!myTiebreakLineup) return;
    const handicap = playerId ? handicapFromMatchLineup(playerId) : null;
    queryClient.setQueryData<MatchTiebreaker | null>(recordKey, (old) =>
      old
        ? {
            ...old,
            match_tiebreaker_lineups: old.match_tiebreaker_lineups.map((l) =>
              l.id === myTiebreakLineup.id
                ? { ...l, [`player${position}_id`]: playerId, [`player${position}_handicap`]: handicap }
                : l,
            ),
          }
        : old,
    );
    try {
      await setTiebreakSlot(myTiebreakLineup.id, position, playerId, handicap);
    } catch (error) {
      logger.error('Failed to save tiebreak pick', { matchId, position, error: String(error) });
      toast.error('Could not save that pick — please try again.');
    } finally {
      void queryClient.invalidateQueries({ queryKey: recordKey });
    }
  };

  const handleTiebreakerPlayerChange = (position: number, playerId: string) => {
    void writeSlot(position, playerId);
  };

  const handleClearTiebreakerPlayer = (position: number) => {
    void writeSlot(position, null);
  };

  /** Lock this side's order (copies it onto the tiebreak games first). */
  const handleLockTiebreak = async () => {
    if (!myTiebreakLineup || picks.some((id) => !id)) return;
    try {
      await lockTiebreakLineup({ lineupId: myTiebreakLineup.id, isHomeTeam, order: picks, games: tiebreakGames });
    } catch (error) {
      logger.error('Failed to lock tiebreak lineup', { matchId, error: String(error) });
      toast.error('Could not lock the tiebreaker lineup — please try again.');
    } finally {
      void queryClient.invalidateQueries({ queryKey: recordKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.matches.games(matchId || '') });
    }
  };

  /** Unlock this side's order so it can be changed. */
  const handleUnlockTiebreak = async () => {
    if (!myTiebreakLineup) return;
    try {
      await unlockTiebreakLineup(myTiebreakLineup.id);
    } catch (error) {
      logger.error('Failed to unlock tiebreak lineup', { matchId, error: String(error) });
      toast.error('Could not unlock the tiebreaker lineup — please try again.');
    } finally {
      void queryClient.invalidateQueries({ queryKey: recordKey });
    }
  };

  return {
    getTiebreakerPlayerIdByPosition,
    getTiebreakerChoices,
    handleTiebreakerPlayerChange,
    handleClearTiebreakerPlayer,
    handleLockTiebreak,
    handleUnlockTiebreak,
    tiebreakLocked: !!myTiebreakLineup?.locked,
  };
}
