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
import {
  getBracket,
  getBracketShare,
  getBracketsByCreator,
  getBracketHopper,
  getBracketRoster,
  getBracketPlayerView,
} from '../queries/brackets';
import {
  createBracket,
  setParticipants,
  startBracket,
  chargeForStart,
  setEntryFeePaid,
  joinHopper,
  addSelfAsWalkup,
  addWalkupToHopper,
  addRegisteredToHopper,
  admitHopperEntry,
  setHopperPaidStatus,
  ejectHopperEntry,
  finalizeHopper,
  updateBracketSettings,
  forgetRosterEntry,
  advanceWinner,
  setMatchInProgress,
  reopenMatch,
  closeBracket,
  type BracketSettings,
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
/** Self-add: the caller joins a tournament's hopper via its join_token (QR/link). */
export function useJoinHopper() {
  return useMutation({
    mutationFn: (vars: { joinToken: string; via?: 'link' | 'qr' }) =>
      joinHopper(vars.joinToken, vars.via),
  });
}

/**
 * The organizer's hopper for a bracket — every candidate and every official
 * entry in one list (the view splits them by `status`).
 *
 * staleTime 0 because players self-add live during setup; realtime pushes the
 * invalidation and this fetch is the fallback.
 */
export function useBracketHopper(bracketId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.brackets.hopper(bracketId ?? ''),
    queryFn: () => getBracketHopper(bracketId!),
    enabled: !!bracketId,
    staleTime: 0,
  });
}

/**
 * The organizer's past players who are NOT yet in this bracket's hopper — the
 * one-tap add source at the bottom of the hopper screen. Every hopper mutation
 * invalidates this too, since adding a past player must remove them from it.
 */
export function useBracketRoster(bracketId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.brackets.roster(bracketId ?? ''),
    queryFn: () => getBracketRoster(bracketId!),
    enabled: !!bracketId,
    staleTime: 0,
  });
}

/**
 * Anonymous self-add from the tournament page. Invalidates the player view so
 * the name appears in the waiting list immediately, without waiting for the
 * realtime event to make the round trip.
 */
export function useAddSelfAsWalkup(joinToken: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => addSelfAsWalkup(joinToken, displayName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.playerView(joinToken) });
    },
  });
}

/**
 * A player's live view of a tournament, from its join token.
 *
 * staleTime 0 and realtime on the hopper: the entire point is watching the room
 * fill up while you stand in it. Anon-safe — a walk-up has no session.
 */
export function useBracketPlayerView(joinToken: string | undefined) {
  return useQuery({
    queryKey: queryKeys.brackets.playerView(joinToken ?? ''),
    queryFn: () => getBracketPlayerView(joinToken!),
    enabled: !!joinToken,
    staleTime: 0,
  });
}

/**
 * Shared invalidation for every hopper write.
 *
 * Both keys always refresh together: the three on-screen groups are derived from
 * these two reads, and a player moving between groups changes both at once (an
 * admitted past player leaves the roster list and joins the official list). The
 * bracket detail refreshes too because admissions drive the eventual seed count.
 */
function useHopperInvalidation(bracketId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.brackets.hopper(bracketId) });
    qc.invalidateQueries({ queryKey: queryKeys.brackets.roster(bracketId) });
    qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(bracketId) });
  };
}

/** Organizer adds a walk-up (a typed name, no account) to the hopper. */
export function useAddWalkupToHopper(bracketId: string) {
  const invalidate = useHopperInvalidation(bracketId);
  return useMutation({
    mutationFn: (displayName: string) => addWalkupToHopper(bracketId, displayName),
    onSuccess: invalidate,
  });
}

/** Organizer adds a registered player (from search or the past-players list). */
export function useAddRegisteredToHopper(bracketId: string) {
  const invalidate = useHopperInvalidation(bracketId);
  return useMutation({
    mutationFn: (vars: { memberId: string; displayName: string }) =>
      addRegisteredToHopper(bracketId, vars.memberId, vars.displayName),
    onSuccess: invalidate,
  });
}

/** Admit a candidate to the official list, flagged paid or unpaid. */
export function useAdmitHopperEntry(bracketId: string) {
  const invalidate = useHopperInvalidation(bracketId);
  return useMutation({
    mutationFn: (vars: { entryId: string; paidStatus: 'paid' | 'unpaid' }) =>
      admitHopperEntry(vars.entryId, bracketId, vars.paidStatus),
    onSuccess: invalidate,
  });
}

/** Flip an already-official entry's paid flag (they paid after being added). */
export function useSetHopperPaidStatus(bracketId: string) {
  const invalidate = useHopperInvalidation(bracketId);
  return useMutation({
    mutationFn: (vars: { entryId: string; paidStatus: 'paid' | 'unpaid' }) =>
      setHopperPaidStatus(vars.entryId, bracketId, vars.paidStatus),
    onSuccess: invalidate,
  });
}

/** Remove an entry from the hopper entirely. The sticky roster is untouched. */
export function useEjectHopperEntry(bracketId: string) {
  const invalidate = useHopperInvalidation(bracketId);
  return useMutation({
    mutationFn: (entryId: string) => ejectHopperEntry(entryId, bracketId),
    onSuccess: invalidate,
  });
}

/**
 * Housekeeping on the organizer's remembered past players — one person at a
 * time. Invalidates the same pair as every other hopper write, since forgetting
 * someone changes what the past-players group offers.
 */
export function useForgetRosterEntry(bracketId: string) {
  const invalidate = useHopperInvalidation(bracketId);
  return useMutation({
    mutationFn: (target: { memberId?: string | null; displayName?: string | null }) =>
      forgetRosterEntry(target),
    onSuccess: invalidate,
  });
}

/** Edit a tournament's name, game and format while it is still in setup. */
export function useUpdateBracketSettings(bracketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: BracketSettings) => updateBracketSettings(bracketId, settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brackets.detail(bracketId) });
      qc.invalidateQueries({ queryKey: queryKeys.brackets.all });
    },
  });
}

/**
 * Convert the official hopper list into seeded participants at Start. Returns
 * the player count, which the caller feeds to the bracket generator.
 *
 * No cache invalidation here: this is always immediately followed by
 * startBracket, and the caller invalidates once the bracket is actually live —
 * refreshing in between would briefly render a setup screen against
 * half-converted state.
 */
export function useFinalizeHopper(bracketId: string) {
  return useMutation({
    mutationFn: (includeWaiting: boolean) => finalizeHopper(bracketId, includeWaiting),
  });
}

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
