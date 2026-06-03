/**
 * @fileoverview Read queries for the onboarding cold-start cascade.
 *
 * Wraps the `get_team_join_view` RPC (Unit 2) that resolves a per-team
 * `join_token` into the public-safe payload the `/join/:token` page renders
 * before the joiner signs in. The RPC is the authorization boundary (RLS is
 * off until launch) and returns NAMES ONLY — no contact info ever reaches the
 * client through this path.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 2).
 */

import { supabase } from '@/supabaseClient';

/** One roster position on the team the link points at. */
export interface TeamJoinSpot {
  /** The member backing this spot (placeholder or registered). */
  member_id: string;
  /** Display label — nickname if set, else first+last (no contact info). */
  display_name: string;
  /** True when this is an unclaimed placeholder a joiner can claim. */
  is_open: boolean;
}

/**
 * The shape returned by `get_team_join_view`. When `found` is false the token
 * was unknown/invalid and every other field is absent — the page shows an
 * invalid-link state.
 */
export interface TeamJoinView {
  found: boolean;
  team_id: string | null;
  team_name: string | null;
  league_name: string | null;
  roster_size: number | null;
  spots: TeamJoinSpot[];
  /**
   * The signed-in caller's existing request status on this team, if any —
   * 'pending' (already waiting) or 'approved' (already in). Null for an
   * anonymous reader or someone with no request yet.
   */
  viewer_request_status: 'pending' | 'approved' | null;
}

/** Empty/invalid view, used when the token resolves to nothing. */
const NOT_FOUND: TeamJoinView = {
  found: false,
  team_id: null,
  team_name: null,
  league_name: null,
  roster_size: null,
  spots: [],
  viewer_request_status: null,
};

/**
 * Resolve a team join token to its public join view.
 *
 * @param token - the team's `join_token` (from the shared link / QR).
 * @returns the team + spots + viewer state, or a `found:false` view.
 * @throws if the RPC itself errors (network / unexpected DB error).
 */
export async function getTeamJoinView(token: string): Promise<TeamJoinView> {
  const { data, error } = await supabase.rpc('get_team_join_view', {
    p_token: token,
  });

  if (error) throw error;
  if (!data) return NOT_FOUND;

  // The RPC returns jsonb; merge over the not-found base so missing keys are
  // always well-defined for callers.
  return { ...NOT_FOUND, ...(data as unknown as TeamJoinView) };
}

/** One pending request in an approver's feed. */
export interface ApproverJoinRequest {
  request_id: string;
  team_id: string;
  team_name: string;
  league_name: string | null;
  requester_member_id: string | null;
  requester_name: string;
  /** The placeholder spot being claimed, if this was a claim request. */
  claimed_member_id: string | null;
  claimed_name: string | null;
  created_at: string;
}

/**
 * Load every pending join request across the teams the caller can approve
 * (teams they captain OR teams in an org they staff), de-duplicated.
 *
 * @returns the pending requests, newest-last; empty for a non-approver.
 * @throws on an unexpected RPC/network error.
 */
export async function getJoinRequestsForApprover(): Promise<ApproverJoinRequest[]> {
  const { data, error } = await supabase.rpc('get_join_requests_for_approver');
  if (error) throw error;
  return (data as unknown as ApproverJoinRequest[]) ?? [];
}
