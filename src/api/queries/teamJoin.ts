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
  /** Whether the team has any unclaimed placeholder (drives Replace + Add guard). */
  has_open_placeholders: boolean;
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

/** An unclaimed placeholder spot offered in the Replace picker. */
export interface ClaimablePlaceholder {
  member_id: string;
  display_name: string;
  /** True when this placeholder carries a match record (merge is then weighty). */
  has_stats: boolean;
}

/**
 * Load a team's unclaimed placeholders (+ record flag) for the Replace picker.
 * Captain/org-staff gated server-side; a non-approver gets an empty list.
 *
 * @param teamId - the team whose placeholders to offer.
 * @throws on an unexpected RPC/network error.
 */
export async function getTeamPlaceholdersForClaim(
  teamId: string
): Promise<ClaimablePlaceholder[]> {
  const { data, error } = await supabase.rpc('get_team_placeholders_for_claim', {
    p_team_id: teamId,
  });
  if (error) throw error;
  return (data as unknown as ClaimablePlaceholder[]) ?? [];
}

/** An approved-but-unacknowledged join the caller should be told about. */
export interface ApprovedJoinRequest {
  request_id: string;
  team_id: string;
  team_name: string;
  league_name: string | null;
}

/**
 * The caller's approved-but-unacknowledged join requests (the "you're in" feed).
 * @throws on an unexpected RPC/network error.
 */
export async function getMyApprovedJoinRequests(): Promise<ApprovedJoinRequest[]> {
  const { data, error } = await supabase.rpc('get_my_approved_join_requests');
  if (error) throw error;
  return (data as unknown as ApprovedJoinRequest[]) ?? [];
}

/**
 * Mark an approved join request acknowledged so the "you're in" popup shows once.
 * @param requestId - the caller's own approved request.
 * @throws on an unexpected RPC/network error.
 */
export async function acknowledgeJoinRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('acknowledge_join_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

/** Read a team's current join token (for building its /join/:token share link). */
export async function getTeamJoinToken(teamId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('join_token')
    .eq('id', teamId)
    .single();
  if (error) throw error;
  return data?.join_token ?? null;
}

/** Regenerate a team's join token (leak rotation); returns the new token. */
export async function rotateTeamJoinToken(teamId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('rotate_team_join_token', {
    p_team_id: teamId,
  });
  if (error) throw error;
  const result = data as unknown as { ok: boolean; join_token?: string };
  return result?.ok ? result.join_token ?? null : null;
}

/** One team row in the LO's "onboard my captains" list (league-scoped). */
export interface LeagueOnboardingTeam {
  team_id: string;
  team_name: string;
  captain_name: string;
  join_token: string;
}

/**
 * Teams in a league whose captain is not yet registered, with captain name +
 * join link, for the LO's temporary "onboard my captains" list. Self-clears as
 * captains register (the RPC filters on a placeholder captain) and excludes bye
 * teams. Org-staff gated server-side.
 */
export async function getLeagueTeamsForOnboarding(
  leagueId: string
): Promise<LeagueOnboardingTeam[]> {
  const { data, error } = await supabase.rpc('get_league_teams_for_onboarding', {
    p_league_id: leagueId,
  });
  if (error) throw error;
  return (data as unknown as LeagueOnboardingTeam[]) ?? [];
}
