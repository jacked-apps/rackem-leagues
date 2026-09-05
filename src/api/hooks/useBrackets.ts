/**
 * @fileoverview TanStack Query hooks for the tournament bracket tool (Unit 3).
 *
 * Thin wrappers over queries/mutations/brackets — read hooks for the organizer
 * detail view and the public share view, plus mutation hooks that invalidate
 * the relevant cache keys. Realtime (Unit 5/6) invalidates these same keys, so
 * a missed event only delays; the data is always re-derivable from the fetch.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getBracket, getBracketShare, getBracketsByCreator } from '../queries/brackets';
import {
  createBracket,
  setParticipants,
  startBracket,
  chargeForStart,
  setEntryFeePaid,
  advanceWinner,
  setMatchInProgress,
  reopenMatch,
  closeBracket,
  type CreateBracketParams,
  type NewParticipant,
} from '../mutations/brackets';
import type { BracketFormat, SeedingMode } from '@/types/bracket';

/** Organizer's full bracket view (bracket + participants + matches). */
export function useBracket(bracketId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.brackets.detail(bracketId ?? ''),
    queryFn: () => getBracket(bracketId!),
    enabled: !!bracketId,
    // Live during play; realtime pushes invalidations, this is the fallback.
    staleTime: 0,
  });
}

/**
 * Public, read-only share view for a share token (no auth).
 *
 * Realtime (useBracketRealtime) is the fast path, but postgres_changes delivery
 * to the anon role is unproven for this app, so a live bracket also polls every
 * ~15s as a fallback — data-derived state makes both safe (a missed event only
 * delays). Polling stops once the bracket is complete/closed.
 */
export function useBracketShare(shareToken: string | undefined) {
  return useQuery({
    queryKey: queryKeys.brackets.share(shareToken ?? ''),
    queryFn: () => getBracketShare(shareToken!),
    enabled: !!shareToken,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.bracket?.status === 'live' ? 15_000 : false,
  });
}

/** The current member's own brackets (for the index page). */
export function useBracketsByCreator(memberId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.brackets.byCreator(memberId ?? ''),
    queryFn: () => getBracketsByCreator(memberId!),
    enabled: !!memberId,
  });
}

/** Create a bracket (setup status). */
export function useCreateBracket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateBracketParams) => createBracket(params),
    onSuccess: (bracket) => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.byCreator(bracket.created_by) });
    },
  });
}

/** Set participants (seed-order resolved by mode). */
export function useSetParticipants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      bracketId: string;
      participants: NewParticipant[];
      seedingMode: SeedingMode;
    }) => setParticipants(vars.bracketId, vars.participants, vars.seedingMode),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(vars.bracketId) });
    },
  });
}

/** Generate the tree and go live. */
export function useStartBracket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      bracketId: string;
      format: BracketFormat;
      grandFinalReset: boolean;
      participantCount: number;
    }) =>
      startBracket(vars.bracketId, vars.format, vars.grandFinalReset, vars.participantCount),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(vars.bracketId) });
    },
  });
}

/** Record a match winner (guarded advance). */
/** Charge-at-checkout seam (A3): record the paid tournament's ($0 mock) charge at Start. */
export function useChargeForStart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { bracketId: string; amountCents: number }) =>
      chargeForStart(vars.bracketId, vars.amountCents),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(vars.bracketId) });
    },
  });
}

/** Entry-fee tracker: toggle a player's paid/unpaid flag; invalidate the bracket. */
export function useSetEntryFeePaid(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { participantId: string; paid: boolean }) =>
      setEntryFeePaid(vars.participantId, bracketId, vars.paid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(bracketId) });
    },
  });
}

export function useAdvanceWinner(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { matchId: string; winnerParticipantId: string }) =>
      advanceWinner(vars.matchId, vars.winnerParticipantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(bracketId) });
    },
  });
}

/** Toggle a ready match's "playing now" flag (organizer aid). */
export function useSetMatchInProgress(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { matchId: string; inProgress: boolean }) =>
      setMatchInProgress(vars.matchId, vars.inProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(bracketId) });
    },
  });
}

/** Reopen a decided match (undo). */
export function useReopenMatch(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: string) => reopenMatch(matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(bracketId) });
    },
  });
}

/** Close a bracket (tombstone). */
export function useCloseBracket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bracketId: string) => closeBracket(bracketId),
    onSuccess: (_data, bracketId) => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(bracketId) });
      qc.invalidateQueries({ queryKey: queryKeys.brackets.all });
    },
  });
}
