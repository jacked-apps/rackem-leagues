/**
 * @fileoverview Fargo start-points negotiation hook (Unit 11c)
 *
 * Before a Fargo match opens its scoring page, both captains must agree on
 * the start-points value for the weaker team. This app runs parallel to
 * BCA's official FargoRate calculator, and the captains defer to that
 * app's number when the two disagree — so we can't just auto-use our
 * computed default.
 *
 * State is stored on the `matches` row:
 *   - `fargo_start_points`: current proposed or agreed value
 *   - `fargo_start_points_confirmed_by_home`: home captain who last
 *     proposed or confirmed this value
 *   - `fargo_start_points_confirmed_by_away`: away captain mirror
 *
 * Rules:
 *   - Editing the value clears BOTH confirm columns and stamps only the
 *     editor's side. The opponent must re-confirm.
 *   - Once both confirm columns are non-null, the value is locked in and
 *     the consumer (useMatchPreparation) copies it to the weaker team's
 *     `home_games_to_win` / `away_games_to_win` and creates the game
 *     rows.
 *   - When the home client first observes both-lineups-locked on a Fargo
 *     match with `fargo_start_points` still NULL, it auto-writes the
 *     computed default and stamps the home confirm. This keeps the
 *     negotiation starting from a sensible proposal without requiring a
 *     manual kick-off click.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { fargo5v5 } from '@/systems/fargo5v5';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { SystemOverrides } from '@/types/systemOverrides';

interface FargoNegotiationParams {
  matchId: string | undefined;
  memberId: string | null;
  isHomeTeam: boolean;
  handicapType: string;
  /**
   * True iff both lineups are locked AND Step 1 (lineup completeness) passes
   * on both sides. Gates every side effect in this hook so the initial-
   * proposal write can't fire against placeholder-contaminated ratings.
   * Supersedes the old `bothLineupsReady` input from before Unit 3.
   */
  bothLineupsReady: boolean;
  /** Per-slot ratings from BOTH locked lineups. Must match lineupSize length each. */
  homeRatings: number[];
  awayRatings: number[];
  lineupSize: number;
  /** Current match row fields (re-read by parent query; this hook just reflects them). */
  fargoStartPoints: number | null;
  confirmedByHome: string | null;
  confirmedByAway: string | null;
  systemOverrides: SystemOverrides | undefined;
  /** Caller refetch so UI picks up the write immediately. */
  refetchMatch?: () => Promise<unknown>;
}

export type FargoNegotiationStatus =
  | 'not_applicable' // not a Fargo match, or lineups not both locked
  | 'pending_initial_write' // home client will auto-write default
  | 'awaiting_opponent_confirm' // I proposed/confirmed, opponent hasn't
  | 'awaiting_my_confirm' // opponent proposed, I haven't confirmed
  | 'both_confirmed'; // locked in — match prep runs

export interface FargoNegotiationState {
  applicable: boolean;
  status: FargoNegotiationStatus;
  /** Live computed default from ratings + overrides (unchanged by edits). */
  computedDefault: number | null;
  /** Current proposed/agreed value from the match row. */
  currentValue: number | null;
  /**
   * Which team is weaker (receives the start-points). 'even' means teams
   * are rating-matched and no start-points apply. null when ratings missing.
   */
  weakerTeam: 'home' | 'away' | 'even' | null;
  myConfirmed: boolean;
  opponentConfirmed: boolean;
  bothConfirmed: boolean;
  /** True if I can currently edit (applicable + not both-confirmed). */
  canEdit: boolean;
  /** Submit a new value — clears both confirms, stamps my side. */
  propose: (value: number) => Promise<void>;
  /** Accept the current value — stamps my side only. */
  confirm: () => Promise<void>;
}

export function useFargoStartPointsNegotiation(
  params: FargoNegotiationParams
): FargoNegotiationState {
  const {
    matchId,
    memberId,
    isHomeTeam,
    handicapType,
    bothLineupsReady,
    homeRatings,
    awayRatings,
    lineupSize,
    fargoStartPoints,
    confirmedByHome,
    confirmedByAway,
    systemOverrides,
    refetchMatch,
  } = params;

  const applicable =
    handicapType === 'fargo' && bothLineupsReady;

  // Compute the default from the locked lineup ratings. Only valid when all
  // slots have a rating.
  const computation = useMemo(() => {
    if (!applicable) return null;
    if (homeRatings.length !== lineupSize) return null;
    if (awayRatings.length !== lineupSize) return null;
    if (fargo5v5.threshold.mode !== 'start_points') return null;
    try {
      return fargo5v5.threshold.compute(
        homeRatings,
        awayRatings,
        systemOverrides ?? {}
      );
    } catch (err) {
      logger.error('Fargo start-points compute failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }, [applicable, homeRatings, awayRatings, lineupSize, systemOverrides]);

  const computedDefault = computation?.startPointsForWeakerTeam ?? null;
  const weakerTeam = computation?.weakerTeam ?? null;

  const myConfirmed = isHomeTeam ? !!confirmedByHome : !!confirmedByAway;
  const opponentConfirmed = isHomeTeam
    ? !!confirmedByAway
    : !!confirmedByHome;
  const bothConfirmed = !!confirmedByHome && !!confirmedByAway;

  // Derive status from the persisted state.
  const status: FargoNegotiationStatus = useMemo(() => {
    if (!applicable) return 'not_applicable';
    if (bothConfirmed) return 'both_confirmed';
    if (fargoStartPoints === null) return 'pending_initial_write';
    if (myConfirmed && !opponentConfirmed) return 'awaiting_opponent_confirm';
    if (!myConfirmed && opponentConfirmed) return 'awaiting_my_confirm';
    // Neither confirmed but value is set — shouldn't happen under normal flow
    // (write always stamps at least one side) but treat as "needs my confirm"
    // so the UI gives the user a clear action.
    return 'awaiting_my_confirm';
  }, [applicable, bothConfirmed, fargoStartPoints, myConfirmed, opponentConfirmed]);

  // Home client performs the initial proposal write. Guarded by a ref so we
  // don't double-write under StrictMode / re-renders. Idempotent: skipped if
  // fargo_start_points is already set.
  const initialWriteFiredRef = useRef(false);
  useEffect(() => {
    if (!applicable) return;
    if (!isHomeTeam) return;
    if (!matchId || !memberId) return;
    if (fargoStartPoints !== null) return;
    if (computedDefault === null) return;
    if (initialWriteFiredRef.current) return;

    initialWriteFiredRef.current = true;

    const writeInitial = async () => {
      const { error } = await supabase
        .from('matches')
        .update({
          fargo_start_points: computedDefault,
          fargo_start_points_confirmed_by_home: memberId,
          fargo_start_points_confirmed_by_away: null,
        })
        .eq('id', matchId)
        .is('fargo_start_points', null); // race guard: only write if still null

      if (error) {
        logger.error('Failed to write initial Fargo start-points proposal', {
          matchId,
          error: error.message,
        });
        initialWriteFiredRef.current = false;
        return;
      }
      await refetchMatch?.();
    };
    void writeInitial();
  }, [
    applicable,
    isHomeTeam,
    matchId,
    memberId,
    fargoStartPoints,
    computedDefault,
    refetchMatch,
  ]);

  const propose = useCallback(
    async (value: number) => {
      if (!matchId || !memberId) return;
      if (!Number.isInteger(value) || value < 0) {
        toast.error('Start points must be a non-negative whole number.');
        return;
      }

      // Editing clears BOTH confirms and stamps only the editor's side. The
      // opponent must re-confirm.
      const updates = isHomeTeam
        ? {
            fargo_start_points: value,
            fargo_start_points_confirmed_by_home: memberId,
            fargo_start_points_confirmed_by_away: null,
          }
        : {
            fargo_start_points: value,
            fargo_start_points_confirmed_by_home: null,
            fargo_start_points_confirmed_by_away: memberId,
          };

      const { error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', matchId);

      if (error) {
        logger.error('Failed to propose Fargo start-points value', {
          matchId,
          error: error.message,
        });
        toast.error('Failed to save start points. Please try again.');
        return;
      }
      await refetchMatch?.();
    },
    [matchId, memberId, isHomeTeam, refetchMatch]
  );

  const confirm = useCallback(async () => {
    if (!matchId || !memberId) return;

    // Stamp only my side — leave value and opponent confirm untouched.
    const updates = isHomeTeam
      ? { fargo_start_points_confirmed_by_home: memberId }
      : { fargo_start_points_confirmed_by_away: memberId };

    const { error } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', matchId);

    if (error) {
      logger.error('Failed to confirm Fargo start-points value', {
        matchId,
        error: error.message,
      });
      toast.error('Failed to confirm start points. Please try again.');
      return;
    }
    await refetchMatch?.();
  }, [matchId, memberId, isHomeTeam, refetchMatch]);

  return {
    applicable,
    status,
    computedDefault,
    currentValue: fargoStartPoints,
    weakerTeam,
    myConfirmed,
    opponentConfirmed,
    bothConfirmed,
    canEdit: applicable && !bothConfirmed,
    propose,
    confirm,
  };
}
