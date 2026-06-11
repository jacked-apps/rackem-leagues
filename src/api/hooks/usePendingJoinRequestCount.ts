/**
 * @fileoverview The doorbell count — pending join requests for the approver.
 *
 * Derived from the same feed the approve surface uses
 * (`useTeamJoinRequests`), so the count and the list share one cached read and
 * one de-duplicated, captain-OR-staff scope — no separate query. Returns 0 for
 * a non-approver / signed-out user, so callers can render the doorbell only
 * when it's > 0.
 *
 * See docs/plans/2026-05-29-001-feat-onboarding-cascade-plan.md (Unit 6).
 */

import { useTeamJoinRequests } from './useTeamJoinRequests';

/** Count of pending join requests across every team the caller can approve. */
export function usePendingJoinRequestCount(): number {
  const { data } = useTeamJoinRequests();
  return data?.length ?? 0;
}
