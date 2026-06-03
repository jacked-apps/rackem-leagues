/**
 * @fileoverview Write operations for the onboarding cold-start cascade.
 *
 * Currently the joiner-side submit. Approver-side writes (Add/Replace/Decline)
 * land in Unit 4 via the `approve-join-request` edge function.
 *
 * `submitJoinRequest` calls the `request_team_join` RPC — the ONLY path that
 * creates a join request. The RPC derives the requester from the JWT and the
 * team from the token server-side, so the client passes only the token (and an
 * optional placeholder spot to claim). The returned `reason` drives the page's
 * state copy.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 3).
 */

import { supabase } from '@/supabaseClient';

/** The friendly outcome codes returned by `request_team_join`. */
export type JoinRequestReason =
  | 'submitted' // request filed, now pending
  | 'already_pending' // caller already has a pending request here
  | 'already_approved' // caller already approved (effectively on the team)
  | 'already_member' // caller is already on this team's roster
  | 'full' // self-add but the roster is full (claim a spot instead)
  | 'spot_taken' // someone else has a pending claim on that placeholder
  | 'invalid_claim' // claimed spot isn't an open placeholder on this team
  | 'invalid_token' // unknown/expired join token
  | 'no_member' // caller hasn't completed their profile yet
  | 'not_authenticated'; // caller isn't signed in

/** Result of a join-request submit. */
export interface JoinRequestResult {
  ok: boolean;
  reason: JoinRequestReason;
  /** Present when a request exists/was created. */
  status?: 'pending' | 'approved';
  /** The request row id, when one was created or already exists. */
  request_id?: string;
}

/**
 * File a join request for the team behind `token`.
 *
 * @param token - the team's `join_token` from the shared link.
 * @param claimedMemberId - optional placeholder spot to claim (Replace path);
 *   omit for a plain self-add.
 * @returns the `{ ok, reason, status }` outcome.
 * @throws only on an unexpected RPC/network error (guard states come back as
 *   `{ ok:false, reason }`, not throws).
 */
export async function submitJoinRequest(
  token: string,
  claimedMemberId?: string | null
): Promise<JoinRequestResult> {
  const { data, error } = await supabase.rpc('request_team_join', {
    p_token: token,
    p_claimed_member_id: claimedMemberId ?? undefined,
  });

  if (error) throw error;
  return data as unknown as JoinRequestResult;
}
