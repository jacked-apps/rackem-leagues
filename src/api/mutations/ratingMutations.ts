/**
 * @fileoverview TS wrappers for the rating-mutation RPCs (Phase 6 Unit 6.1).
 *
 * These RPCs (defined in 20260429000005_rating_mutation_rpcs.sql) perform
 * a player-rating change AND insert a rating_edit_audit_log row in a
 * single PL/pgSQL transaction. R21 of the modular-league plan: every
 * rating change is recorded immutably to address BCA's #1 software
 * concern — sandbagging via silent rating manipulation.
 *
 * The RPCs are the ONLY allowed write path to either rating storage
 * (match_lineups handicaps + members.starting_handicap_*) AND the audit
 * log (RLS denies direct INSERT for authenticated and anon — the
 * SECURITY DEFINER RPCs are the sole insert path). Bare client UPDATEs
 * to those tables bypass auditing and are a bug — Unit 6.2 will sweep
 * the codebase to route every existing pathway through these wrappers.
 *
 * Each wrapper throws on RPC failure. The audit row is part of the
 * transaction, so a thrown error means *neither* the mutation nor the
 * audit landed — atomic by construction, not by sequencing.
 */

import { supabase } from '@/supabaseClient';

// ============================================================================
// set_match_lineup_rating — Fargo manual entry path (and similar)
// ============================================================================

export interface SetMatchLineupRatingArgs {
  /** match_lineups row whose slot we're editing. */
  matchLineupId: string;
  /** The player whose handicap is being set. Must be on the lineup. */
  memberId: string;
  /** New handicap value. The numeric range depends on the league's rating system. */
  ratingValue: number;
  /** Optional free-text reason captured in the audit row. */
  reason?: string | null;
}

/**
 * Atomically sets a player's per-match handicap on a lineup row AND
 * records an audit entry. Caller must be authenticated and on the
 * team's roster (active) or an org owner/admin.
 *
 * @returns the audit row id (for cross-reference with downstream UI)
 * @throws if the caller is unauthorized, the member is not on the
 *         lineup, or the underlying transaction fails
 */
export async function setMatchLineupRating(
  args: SetMatchLineupRatingArgs,
): Promise<string> {
  const { data, error } = await supabase.rpc('set_match_lineup_rating', {
    p_match_lineup_id: args.matchLineupId,
    p_member_id: args.memberId,
    p_rating_value: args.ratingValue,
    p_reason: args.reason ?? null,
  });

  if (error) {
    throw new Error(`setMatchLineupRating failed: ${error.message}`);
  }
  return data as string;
}

// ============================================================================
// recompute_member_rating — service-role only (BCA recompute path)
// ============================================================================

/** The persistent rating systems with member-level columns today. */
export type PersistentRatingSystem = 'points' | 'percentage';

/** Source of the recompute — drives audit row source field. */
export type RecomputeSource = 'manual' | 'computed' | 'api' | 'rescore';

export interface RecomputeMemberRatingArgs {
  memberId: string;
  ratingSystem: PersistentRatingSystem;
  newValue: number;
  source?: RecomputeSource;
}

/**
 * Atomically updates a member's persistent BCA handicap (3v3 or 5v5)
 * AND records an audit entry, but ONLY when the value is actually
 * changing. No-op (returns null) when the new value matches the old —
 * prevents audit-flooding on every post-match recompute that didn't
 * actually move the rating.
 *
 * Service-role only. Calling from an authenticated client session will
 * fail at the GRANT check; this wrapper exists for server-side scripts
 * and Edge Functions that hold the service-role key.
 *
 * @returns the audit row id when an update happened, null when no change
 * @throws if the rating system isn't persistent (only points/percentage),
 *         the source is invalid, or the underlying RPC fails
 */
export async function recomputeMemberRating(
  args: RecomputeMemberRatingArgs,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('recompute_member_rating', {
    p_member_id: args.memberId,
    p_rating_system: args.ratingSystem,
    p_new_value: args.newValue,
    p_source: args.source ?? 'computed',
  });

  if (error) {
    throw new Error(`recomputeMemberRating failed: ${error.message}`);
  }
  return (data as string | null) ?? null;
}

// ============================================================================
// vacate_and_rescore_audit_marker — LO marker for vacate-rescore flows
// ============================================================================

export interface VacateAndRescoreAuditMarkerArgs {
  /** The match being vacated and rescored. */
  matchId: string;
  /** Optional free-text — the audit row defaults to a generic reason if omitted. */
  reason?: string | null;
}

/**
 * Records a marker audit row noting that an LO has initiated a vacate-
 * rescore for a match. Subsequent recompute_member_rating calls in the
 * same flow correlate to this marker via the audit-log read UI's
 * timestamp + organization grouping. Caller must be authenticated and
 * an owner/admin of the match's organization.
 *
 * @returns the marker audit row id
 * @throws if the caller is unauthorized or the match cannot be resolved to an org
 */
export async function vacateAndRescoreAuditMarker(
  args: VacateAndRescoreAuditMarkerArgs,
): Promise<string> {
  const { data, error } = await supabase.rpc('vacate_and_rescore_audit_marker', {
    p_match_id: args.matchId,
    p_reason: args.reason ?? null,
  });

  if (error) {
    throw new Error(`vacateAndRescoreAuditMarker failed: ${error.message}`);
  }
  return data as string;
}
