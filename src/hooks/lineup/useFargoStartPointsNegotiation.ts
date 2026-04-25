/**
 * @fileoverview Fargo start-points negotiation hook
 *
 * Before a Fargo match opens its scoring page, both captains must agree on
 * the start-points value for the weaker team. This app runs parallel to
 * BCA's official FargoRate calculator — captains defer to that app's number
 * if the two disagree, so the value must be editable.
 *
 * Storage: existing threshold columns on the matches row, no new schema:
 *   - weakerTeam's `*_games_to_tie` = current proposed/agreed start points
 *     (the head-start the weaker team needs to "tie" the stronger team's
 *     expected output).
 *   - `home_games_to_lose` = home captain's `system_player_number` when
 *     they confirm (NULL = not confirmed).
 *   - `away_games_to_lose` = away captain's `system_player_number` when
 *     they confirm.
 *
 * Rules:
 *   - Editing the value clears BOTH `*_games_to_lose` columns and stamps
 *     only the editor's side. The opponent must re-confirm.
 *   - Once both `*_games_to_lose` columns are non-null, prep_match fires.
 *   - Home client auto-writes the computed default + stamps its own confirm
 *     when both lineups become ready, so negotiation starts from a
 *     sensible proposal without a manual kick-off click.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/supabaseClient';
import { fargo5v5 } from '@/systems/fargo5v5';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import type { SystemOverrides } from '@/types/systemOverrides';

interface FargoNegotiationParams {
  matchId: string | undefined;
  /** Current member's system_player_number — written to *_games_to_lose on confirm. */
  memberPlayerNumber: number | null;
  isHomeTeam: boolean;
  handicapType: string;
  bothLineupsReady: boolean;
  homeRatings: number[];
  awayRatings: number[];
  lineupSize: number;
  /** Current threshold values from the matches row (caller refetches; we just reflect). */
  homeGamesToTie: number | null;
  awayGamesToTie: number | null;
  homeGamesToLose: number | null;
  awayGamesToLose: number | null;
  systemOverrides: SystemOverrides | undefined;
  refetchMatch?: () => Promise<unknown>;
}

export type FargoNegotiationStatus =
  | 'not_applicable'
  | 'pending_initial_write'
  | 'awaiting_opponent_confirm'
  | 'awaiting_my_confirm'
  | 'both_confirmed';

export interface FargoNegotiationState {
  applicable: boolean;
  status: FargoNegotiationStatus;
  computedDefault: number | null;
  /** Current proposed/agreed value — read from weaker team's _games_to_tie. */
  currentValue: number | null;
  weakerTeam: 'home' | 'away' | 'even' | null;
  myConfirmed: boolean;
  opponentConfirmed: boolean;
  bothConfirmed: boolean;
  canEdit: boolean;
  propose: (value: number) => Promise<void>;
  confirm: () => Promise<void>;
}

export function useFargoStartPointsNegotiation(
  params: FargoNegotiationParams
): FargoNegotiationState {
  const {
    matchId,
    memberPlayerNumber,
    isHomeTeam,
    handicapType,
    bothLineupsReady,
    homeRatings,
    awayRatings,
    lineupSize,
    homeGamesToTie,
    awayGamesToTie,
    homeGamesToLose,
    awayGamesToLose,
    systemOverrides,
    refetchMatch,
  } = params;

  const applicable = handicapType === 'fargo' && bothLineupsReady;

  // Compute the default from locked lineup ratings.
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

  // Read the current proposed value from the weaker team's _games_to_tie.
  const currentValue: number | null = useMemo(() => {
    if (weakerTeam === 'home') return homeGamesToTie;
    if (weakerTeam === 'away') return awayGamesToTie;
    return null;
  }, [weakerTeam, homeGamesToTie, awayGamesToTie]);

  const myConfirmed = isHomeTeam ? homeGamesToLose !== null : awayGamesToLose !== null;
  const opponentConfirmed = isHomeTeam
    ? awayGamesToLose !== null
    : homeGamesToLose !== null;
  const bothConfirmed = homeGamesToLose !== null && awayGamesToLose !== null;

  const status: FargoNegotiationStatus = useMemo(() => {
    if (!applicable) return 'not_applicable';
    if (bothConfirmed) return 'both_confirmed';
    if (currentValue === null) return 'pending_initial_write';
    if (myConfirmed && !opponentConfirmed) return 'awaiting_opponent_confirm';
    if (!myConfirmed && opponentConfirmed) return 'awaiting_my_confirm';
    return 'awaiting_my_confirm';
  }, [applicable, bothConfirmed, currentValue, myConfirmed, opponentConfirmed]);

  // Home client writes the initial proposal once both lineups are ready and
  // no value has been written yet. Idempotent; protected by both a client ref
  // (StrictMode double-fire) and a server-side race guard on the UPDATE.
  const initialWriteFiredRef = useRef(false);

  // Reset the ref when readiness drops so a re-lock cycle can re-propose.
  useEffect(() => {
    if (!bothLineupsReady) initialWriteFiredRef.current = false;
  }, [bothLineupsReady]);

  useEffect(() => {
    if (!applicable) return;
    if (!isHomeTeam) return;
    if (!matchId || memberPlayerNumber === null) return;
    if (currentValue !== null) return;
    if (computedDefault === null) return;
    if (weakerTeam === null || weakerTeam === 'even') return;
    if (initialWriteFiredRef.current) return;

    initialWriteFiredRef.current = true;

    const writeInitial = async () => {
      const updates: Record<string, number | null> = {
        home_games_to_lose: null,
        away_games_to_lose: null,
      };
      if (weakerTeam === 'home') {
        updates.home_games_to_tie = computedDefault;
        updates.away_games_to_tie = 0;
        updates.home_games_to_lose = memberPlayerNumber;
      } else {
        updates.away_games_to_tie = computedDefault;
        updates.home_games_to_tie = 0;
        updates.away_games_to_lose = memberPlayerNumber;
      }

      // Race guard: only write if the weaker team's tie column is still null.
      const weakerTieColumn =
        weakerTeam === 'home' ? 'home_games_to_tie' : 'away_games_to_tie';

      const { error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', matchId)
        .is(weakerTieColumn, null);

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
    memberPlayerNumber,
    currentValue,
    computedDefault,
    weakerTeam,
    refetchMatch,
  ]);

  const propose = useCallback(
    async (value: number) => {
      if (!matchId || memberPlayerNumber === null) return;
      if (!Number.isInteger(value) || value < 0) {
        toast.error('Start points must be a non-negative whole number.');
        return;
      }
      if (weakerTeam === null || weakerTeam === 'even') return;

      // Editing clears BOTH confirms and stamps only the editor's side.
      const updates: Record<string, number | null> = {
        home_games_to_lose: null,
        away_games_to_lose: null,
      };
      if (weakerTeam === 'home') {
        updates.home_games_to_tie = value;
      } else {
        updates.away_games_to_tie = value;
      }
      if (isHomeTeam) {
        updates.home_games_to_lose = memberPlayerNumber;
      } else {
        updates.away_games_to_lose = memberPlayerNumber;
      }

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
    [matchId, memberPlayerNumber, isHomeTeam, weakerTeam, refetchMatch]
  );

  const confirm = useCallback(async () => {
    if (!matchId || memberPlayerNumber === null) return;

    const updates = isHomeTeam
      ? { home_games_to_lose: memberPlayerNumber }
      : { away_games_to_lose: memberPlayerNumber };

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
  }, [matchId, memberPlayerNumber, isHomeTeam, refetchMatch]);

  return {
    applicable,
    status,
    computedDefault,
    currentValue,
    weakerTeam,
    myConfirmed,
    opponentConfirmed,
    bothConfirmed,
    canEdit: applicable && !bothConfirmed,
    propose,
    confirm,
  };
}
