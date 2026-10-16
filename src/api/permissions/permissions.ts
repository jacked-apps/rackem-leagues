/**
 * @fileoverview The one place the app asks "may this member do X, and where?"
 *
 * Phase 1 of the designations / organization-permissions work
 * (docs/brainstorms/2026-09-16-member-designations-requirements.md).
 *
 * This module is the check layer required by O1/O2: callers ask what someone
 * *may do*, never what they *are*. Named roles (owner / admin / league_rep) are
 * bundles of permissions sitting behind this check, so adding, splitting, or
 * renaming a role later changes only the bundle contents in this file — never a
 * single calling site (O2, the highest-leverage property of the whole design).
 *
 * It is deliberately PURE (no React, no Supabase, no clock): given a member's
 * grants it computes an answer. That keeps it exhaustively unit-testable and
 * lets slice 5 mirror the same bundle table into a plpgsql helper for RLS (A5),
 * so the rules are written once rather than duplicated in SQL and TypeScript.
 *
 * IMPORTANT: this layer answers questions for UI affordances and for the
 * server-side write paths that call it. A cached answer in a browser is never
 * the authority (A7) — every gated *write* is re-checked server-side.
 */

/**
 * The named staff levels an organization grants today. Stored in
 * `organization_staff.position` as plain text, so a new level is data, not a
 * schema migration. O9 formalizes exactly these three at launch.
 */
export type StaffPosition = 'owner' | 'admin' | 'league_rep';

/**
 * The set of things a member may be permitted to do. This list is intentionally
 * small in Phase 1 — it captures only the distinctions the app actually makes
 * today (M7: behaviorally identical). The granular split of "admin" into
 * narrower powers is a later product decision that O1/O2 make cheap: it adds
 * entries here and to the bundles below, and touches no calling code.
 */
export type PermissionAction =
  /** See the operator area at all (nav, dashboard, operator pages). */
  | 'access_operator_features'
  /** Add / remove / re-scope organization staff. */
  | 'manage_staff'
  /** View or change the card on file and anything billing-adjacent. */
  | 'access_payments'
  /** Delete the entire organization. Primary-owner only. */
  | 'delete_organization'
  /** Hand the primary-owner seat to another member. Primary-owner only. */
  | 'transfer_ownership';

/**
 * Where a question is being asked. `orgId` is always required — permissions live
 * inside an organization. `leagueId` narrows the question to one league; omit it
 * (or pass null) to ask an org-wide question.
 */
export interface PermissionScope {
  orgId: string;
  leagueId?: string | null;
}

/**
 * One row of a member's authority: they hold `position` in `organizationId`,
 * scoped either org-wide (`leagueId === null`) or to a single league.
 * This is a direct, live projection of an `organization_staff` row (A3) — never
 * a mirrored/derived record.
 */
export interface StaffGrant {
  organizationId: string;
  position: StaffPosition;
  leagueId: string | null;
}

/**
 * What each named level is allowed to do. This table IS the role definition —
 * the whole point of O2 is that product changes to "what an admin can do" happen
 * here and nowhere else.
 *
 * - owner  — the primary owner: every permission, including the three that no
 *            other bundle contains (delete, transfer, payments). Modeled as an
 *            ordinary bundle holding everything, not an `isOwner()` escape hatch
 *            (O8), so it is visible to auditing.
 * - admin  — everything operational; NOT deletion, transfer, or billing (O9).
 * - league_rep — scoped staff: operator access, optionally limited to one league
 *            via the grant's `leagueId`. A subset today; the natural place the
 *            granular list will grow.
 */
export const POSITION_PERMISSIONS: Record<StaffPosition, readonly PermissionAction[]> = {
  owner: [
    'access_operator_features',
    'manage_staff',
    'access_payments',
    'delete_organization',
    'transfer_ownership',
  ],
  admin: ['access_operator_features', 'manage_staff'],
  league_rep: ['access_operator_features'],
} as const;

/**
 * Does a single grant apply to the scope being asked about?
 *
 * A grant applies when it is in the right organization AND either it is org-wide
 * (no league scope) or its league matches the league in the question. An org-wide
 * grant answers league-specific questions too — that is what "empty scope means
 * every league" (O3) means in practice.
 */
function grantAppliesToScope(grant: StaffGrant, scope: PermissionScope): boolean {
  if (grant.organizationId !== scope.orgId) return false;
  // Org-wide grant satisfies any league within the org.
  if (grant.leagueId === null) return true;
  // League-scoped grant satisfies only its own league.
  return grant.leagueId === scope.leagueId;
}

/** The inputs every check needs: the member's grants and whether they hold the master key. */
export interface PermissionContext {
  grants: readonly StaffGrant[];
  /**
   * The developer master key (D7): satisfies every check by definition. In
   * Phase 1 this is still driven by `members.role === 'developer'`; slice 4 moves
   * it to the designations store. It is the single carve-out to normal checking.
   */
  isDeveloper: boolean;
}

/**
 * The one check every caller uses (O1/A1): may this member perform `action`
 * within `scope`?
 *
 * Grants are additive and the most permissive wins (O10): a member who is
 * org-wide staff AND league-scoped staff holds the union, never the
 * intersection. We therefore return true as soon as ANY applicable grant's
 * bundle contains the action.
 */
export function can(
  ctx: PermissionContext,
  action: PermissionAction,
  scope: PermissionScope
): boolean {
  if (ctx.isDeveloper) return true; // master key (D7)

  return ctx.grants.some(
    (grant) =>
      grantAppliesToScope(grant, scope) &&
      POSITION_PERMISSIONS[grant.position].includes(action)
  );
}

/**
 * The coarse "is this member an operator at all?" gate — true if they are a
 * developer or hold any staff grant anywhere. This resolves operator access
 * LIVE from grants (A3), replacing the old `members.role === 'league_operator'`
 * flag that had to be hand-synced when staffing changed.
 */
export function hasOperatorAccess(ctx: PermissionContext): boolean {
  return ctx.isDeveloper || ctx.grants.length > 0;
}
