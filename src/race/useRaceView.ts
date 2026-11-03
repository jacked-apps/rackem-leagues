/**
 * @fileoverview Assembles everything the race room renders from, so the room
 * itself derives nothing.
 *
 * The two seats are the point. A race's participants are members, but WHO they
 * are to the viewer — a nickname, a team-mate, an opponent — is the host's
 * business. This hook resolves names from `members` only as a fallback; a host
 * that already knows them (a league that has a lineup, a tournament that has
 * bracket seats) passes them in and no lookup happens.
 *
 * The two "which game" numbers encode the linear rule that the engine enforces,
 * so the room and the server agree without the room re-implementing anything:
 *   - a result goes only on the earliest game not yet settled
 *   - a wipe comes only off the last game with a result
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useRace, useRaceGames, useRaceConfirmations, useRaceRealtime } from './useRaceData';
import { isSettled, type RaceSeat, type RaceSide, type RaceView } from './types';

/** Names a host already knows, so the room does not look them up. */
export interface RaceNameOverrides {
  home?: string;
  away?: string;
}

/** Nickname first — it is what people are called at the table. */
function label(m: { nickname: string | null; first_name: string | null; last_name: string | null }) {
  return m.nickname || [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Player';
}

function useMemberNames(ids: string[], skip: boolean) {
  return useQuery({
    queryKey: [...queryKeys.members.all, 'race-labels', ...ids],
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('members')
        .select('id, nickname, first_name, last_name')
        .in('id', ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((m) => [m.id, label(m)]));
    },
    enabled: !skip && ids.length > 0,
    staleTime: 5 * 60 * 1000, // names do not change mid-race
  });
}

export function useRaceView(
  raceId: string | null | undefined,
  names?: RaceNameOverrides
): { view: RaceView | null; isLoading: boolean; error: unknown } {
  const raceQ = useRace(raceId);
  const gamesQ = useRaceGames(raceId);
  const confsQ = useRaceConfirmations(raceId);
  const { data: me } = useCurrentMember();
  useRaceRealtime(raceId);

  const race = raceQ.data ?? null;
  const bothNamesGiven = !!names?.home && !!names?.away;
  const namesQ = useMemberNames(
    race ? [race.home_member_id, race.away_member_id] : [],
    bothNamesGiven
  );

  const view = useMemo<RaceView | null>(() => {
    if (!race || !gamesQ.data || !confsQ.data) return null;

    const games = gamesQ.data;
    const lookup = namesQ.data ?? {};
    const seat = (side: RaceSide): RaceSeat => {
      const memberId = side === 'home' ? race.home_member_id : race.away_member_id;
      return {
        memberId,
        side,
        displayName: names?.[side] ?? lookup[memberId] ?? 'Player',
        goal: side === 'home' ? race.goal_home : race.goal_away,
      };
    };

    // Only settled games count. An entry one player has not agreed to is a
    // claim, not a score, and must never move the scoreboard.
    const settled = games.filter(isSettled);
    const homeWon = settled.filter((g) => g.winner_player_id === race.home_member_id).length;
    const awayWon = settled.filter((g) => g.winner_player_id === race.away_member_id).length;

    const unsettled = games.find((g) => !isSettled(g));
    const lastWithResult = [...games].reverse().find((g) => g.winner_player_id !== null);

    const mySide: RaceSide | null = !me
      ? null
      : me.id === race.home_member_id
        ? 'home'
        : me.id === race.away_member_id
          ? 'away'
          : null;

    return {
      race,
      home: seat('home'),
      away: seat('away'),
      games,
      confirmations: confsQ.data,
      mySide,
      homeWon,
      awayWon,
      activeGameNumber: race.status === 'in_play' ? (unsettled?.game_number ?? null) : null,
      vacatableGameNumber: lastWithResult?.game_number ?? null,
    };
  }, [race, gamesQ.data, confsQ.data, namesQ.data, names, me]);

  return {
    view,
    isLoading: raceQ.isLoading || gamesQ.isLoading || confsQ.isLoading,
    error: raceQ.error ?? gamesQ.error ?? confsQ.error,
  };
}
