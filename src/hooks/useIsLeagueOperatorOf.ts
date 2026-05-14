/**
 * @fileoverview Per-scope LO authorization helpers.
 *
 * Phase 2 of the scoring event registry adds an LO-only "Edit" entry
 * point on the scoring modal (inline during a live match) and on the
 * operator office preview card. Both need to know whether the current
 * user is the LO of a specific scope — not just "an operator somewhere,"
 * but "an operator of THIS league" or "THIS organization."
 *
 * Composition: `useIsOperator()` is the global-role check
 * (member.role === 'league_operator' || 'developer'). `useOperatorIdValue()`
 * returns the current member's `organization_id`. These hooks combine the
 * two with a league-row fetch (for the league-scoped variant) so the UI
 * can gate "Edit" buttons defensively.
 *
 * Defense-in-depth note: these are UI hooks. The actual write authorization
 * is enforced by `can_write_preferences` (Phase 2 schema migration). A
 * non-LO who bypasses the UI gate via DevTools still gets rejected at the
 * RLS layer.
 *
 * @see docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 4)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { useIsOperator } from '@/api/hooks/useUserProfile';
import { useOperatorIdValue } from '@/api/hooks/useOperatorId';

/**
 * Returns the league's `organization_id` (cached via TanStack Query so the
 * same lookup across multiple consumers de-duplicates).
 */
function useLeagueOrgId(leagueId: string | null | undefined) {
  return useQuery({
    queryKey: ['league-organization-id', leagueId],
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('organization_id')
        .eq('id', leagueId!)
        .single();
      if (error) throw new Error(error.message);
      return data?.organization_id ?? null;
    },
  });
}

/**
 * True when the current user is an operator (role-wise) AND their
 * organization owns the given league. False during the league-row load
 * (treat as "not authorized yet" — UI gates render closed until the
 * answer is known).
 */
export function useIsLeagueOperatorOf(leagueId: string | null | undefined): boolean {
  const isOperator = useIsOperator();
  const currentUserOrgId = useOperatorIdValue();
  const { data: leagueOrgId } = useLeagueOrgId(leagueId);

  if (!isOperator) return false;
  if (!leagueId) return false;
  if (!currentUserOrgId) return false;
  if (!leagueOrgId) return false; // still loading or unknown — fail closed
  return currentUserOrgId === leagueOrgId;
}

/**
 * True when the current user is an operator (role-wise) AND the given
 * organization is the one their member row is staffed at. No extra fetch —
 * `useOperatorIdValue` already exposes the staffed org id from the user's
 * cached profile data.
 */
export function useIsOrganizationOperatorOf(
  orgId: string | null | undefined,
): boolean {
  const isOperator = useIsOperator();
  const currentUserOrgId = useOperatorIdValue();

  if (!isOperator) return false;
  if (!orgId) return false;
  if (!currentUserOrgId) return false;
  return currentUserOrgId === orgId;
}
