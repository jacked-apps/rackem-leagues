/**
 * @fileoverview usePermissions — the React entry point to the check layer.
 *
 * Wires the current member's live staff grants (from organization_staff, A3)
 * into the pure `can(...)` rules, and exposes a single question to components:
 * "may the signed-in member do X, and where?"
 *
 * This drives UI AFFORDANCES ONLY — showing, hiding, warning (A6). It is a
 * cached, potentially-stale copy and is never the authority (A7): every gated
 * write is re-checked on the server. Read it to decide what to render, not to
 * decide what is allowed to happen.
 *
 * @example
 * const { can, hasOperatorAccess, loading } = usePermissions();
 * if (can('manage_staff', { orgId })) {
 *   // show the "Add staff" button
 * }
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getMemberStaffGrants } from '../queries/permissions';
import { STALE_TIME } from '../client';
import { useUserProfile } from './useUserProfile';
import {
  can as canPure,
  hasOperatorAccess as hasOperatorAccessPure,
  type PermissionAction,
  type PermissionScope,
  type StaffGrant,
} from '../permissions/permissions';

interface UsePermissionsResult {
  /** May the signed-in member perform `action` within `scope`? */
  can: (action: PermissionAction, scope: PermissionScope) => boolean;
  /** Coarse gate: is the member an operator anywhere (or a developer)? */
  hasOperatorAccess: () => boolean;
  /** The member's raw grants, for callers that need to enumerate them. */
  grants: StaffGrant[];
  /** True while the profile or grants are still loading. */
  loading: boolean;
}

/**
 * Hook giving the current member's permission checks.
 *
 * Grants are fetched separately from the profile for now; folding them into the
 * profile query to save a round trip (A6) is a later optimization that would
 * touch the Member type, so it is intentionally deferred.
 */
export function usePermissions(): UsePermissionsResult {
  const { member, loading: profileLoading, canAccessDeveloperFeatures } = useUserProfile();

  // The developer master key (D7) — resolved from the designations store by the
  // profile hook, not members.role.
  const isDeveloper = canAccessDeveloperFeatures();

  const grantsQuery = useQuery({
    queryKey: queryKeys.permissions.grants(member?.id || ''),
    queryFn: () => getMemberStaffGrants(member!.id),
    enabled: !!member?.id,
    staleTime: STALE_TIME.MEMBER,
    refetchOnWindowFocus: false,
  });

  const grants = grantsQuery.data ?? [];
  const ctx = { grants, isDeveloper };

  return {
    can: (action, scope) => canPure(ctx, action, scope),
    hasOperatorAccess: () => hasOperatorAccessPure(ctx),
    grants,
    loading: profileLoading || (!!member?.id && grantsQuery.isLoading),
  };
}
