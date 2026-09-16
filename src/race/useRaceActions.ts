/**
 * @fileoverview The four things a player can do to a race, as mutations.
 *
 * Every one is an RPC. The race tables are SELECT-only for the browser, so
 * there is no direct-write path to drift from — the rules about when a game may
 * be entered, when one may be wiped, and when the next game appears all live in
 * one place, and this file is a thin caller.
 *
 * Each RPC answers with `{ ok, reason }` rather than throwing, because most
 * refusals are ordinary situations rather than faults: the other phone got
 * there first, the game is already agreed, the race already started. The room
 * shows those as words, not as errors.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/api/queryKeys';
import { logger } from '@/utils/logger';

/** What every race RPC answers with. */
interface RpcResult {
  ok: boolean;
  reason?: string;
  [key: string]: unknown;
}

/** Refusals a player can act on, in words rather than codes. */
const REASONS: Record<string, string> = {
  not_in_race: "You're not one of the players in this race.",
  not_last_game: 'Only the last game played can be reversed — work back one game at a time.',
  not_next_game: 'That game is already agreed. Reverse back to it to change it.',
  nothing_to_confirm: 'There is no result on that game yet.',
  race_not_live: 'This race is not running.',
  winner_not_in_race: 'That player is not in this race.',
  no_such_game: 'That game does not exist.',
  no_such_race: 'That race does not exist.',
  not_authenticated: 'You need to be signed in.',
  not_a_player: 'You can only set up a race you are playing in.',
  same_player: 'Pick two different players.',
  bad_goal: 'Each player needs a target of at least 1.',
  bad_break_rule: 'Pick alternate break or winner breaks.',
  bad_game_type: 'Pick a game type.',
  bad_side: 'Pick who breaks first.',
};

function describe(reason?: string): string {
  return (reason && REASONS[reason]) || 'That did not go through — try again.';
}

/**
 * Wraps the shared plumbing every race action needs: call the RPC, surface a
 * refusal as a sentence, and refetch the race so both phones re-derive from
 * rows rather than from what this phone thinks just happened.
 */
function useRaceMutation<TArgs>(
  raceId: string,
  fn: string,
  buildParams: (args: TArgs) => Record<string, unknown>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: TArgs): Promise<RpcResult> => {
      const { data, error } = await supabase.rpc(
        fn as never,
        buildParams(args) as never
      );
      if (error) throw error;
      return data as unknown as RpcResult;
    },
    onSuccess: (result) => {
      if (!result?.ok) {
        toast.error(describe(result?.reason));
        logger.warn('[race] action refused', { fn, reason: result?.reason });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.races.detail(raceId) });
    },
    onError: (error: Error) => {
      logger.error('[race] action failed', { fn, error: error.message });
      toast.error('Could not reach the server. Check your connection and try again.');
      queryClient.invalidateQueries({ queryKey: queryKeys.races.detail(raceId) });
    },
  });
}

/** The result a player enters for a game. Mirrors the league's fields exactly. */
export interface RaceGameResult {
  gameNumber: number;
  winnerPlayerId: string;
  breakAndRun?: boolean;
  goldenBreak?: boolean;
  /** The game ended on an early 8 — an ending, not a feat. 8-ball only. */
  earlyEight?: boolean;
  breakFouled?: boolean;
  runout?: boolean;
  winByForfeit?: boolean;
  winnerValue?: number | null;
  loserValue?: number | null;
}

export function useRaceActions(raceId: string) {
  const start = useRaceMutation<{ firstBreakerSide: 'home' | 'away' }>(
    raceId,
    'start_race',
    ({ firstBreakerSide }) => ({ p_race_id: raceId, p_first_breaker_side: firstBreakerSide })
  );

  const record = useRaceMutation<RaceGameResult>(raceId, 'record_race_game', (r) => ({
    p_race_id: raceId,
    p_game_number: r.gameNumber,
    p_winner_player_id: r.winnerPlayerId,
    p_break_and_run: r.breakAndRun ?? false,
    p_golden_break: r.goldenBreak ?? false,
    p_early_eight: r.earlyEight ?? false,
    p_break_fouled: r.breakFouled ?? false,
    p_runout: r.runout ?? false,
    p_win_by_forfeit: r.winByForfeit ?? false,
    p_winner_value: r.winnerValue ?? null,
    p_loser_value: r.loserValue ?? null,
  }));

  const confirm = useRaceMutation<{ gameNumber: number }>(
    raceId,
    'confirm_race_game',
    ({ gameNumber }) => ({ p_race_id: raceId, p_game_number: gameNumber })
  );

  const vacate = useRaceMutation<{ gameNumber: number }>(
    raceId,
    'vacate_race_game',
    ({ gameNumber }) => ({ p_race_id: raceId, p_game_number: gameNumber })
  );

  return { start, record, confirm, vacate };
}

/** Settings a race is born with. Both targets are chosen, not derived. */
export interface NewRace {
  homeMemberId: string;
  awayMemberId: string;
  goalHome: number;
  goalAway: number;
  breakRule: 'alternate' | 'winner_breaks';
  gameType: 'eight_ball' | 'nine_ball' | 'ten_ball';
}

/**
 * Set up a race. Separate from `useRaceActions` because there is no race yet —
 * this is the seam a host calls once it knows who is playing.
 */
export function useCreateRace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (r: NewRace): Promise<RpcResult> => {
      const { data, error } = await supabase.rpc('create_race', {
        p_home_member_id: r.homeMemberId,
        p_away_member_id: r.awayMemberId,
        p_goal_home: r.goalHome,
        p_goal_away: r.goalAway,
        p_break_rule: r.breakRule,
        p_game_type: r.gameType,
      });
      if (error) throw error;
      return data as unknown as RpcResult;
    },
    onSuccess: (result) => {
      if (!result?.ok) toast.error(describe(result?.reason));
      queryClient.invalidateQueries({ queryKey: queryKeys.races.all });
    },
    onError: (error: Error) => {
      logger.error('[race] create failed', { error: error.message });
      toast.error('Could not set up the race. Check your connection and try again.');
    },
  });
}
