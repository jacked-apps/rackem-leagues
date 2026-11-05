/**
 * @fileoverview Small pure helpers shared by the signed-in menu (sidebar +
 * drawer). They used to be copy-pasted into both `AppSidebar` and `AppDrawer`;
 * one copy here keeps the two menus from drifting.
 */

/** Cap on the operator orgs shown in the menu. */
export const OPERATOR_ORG_CAP = 4;

/** The slice of an organization row the menu needs. */
export interface OperatorOrg {
  id: string;
  organization_name?: string | null;
  position?: string | null;
}

const byName = (a: OperatorOrg, b: OperatorOrg) =>
  (a.organization_name ?? '').localeCompare(b.organization_name ?? '');

/**
 * Orgs to show, owned ones first (each half alphabetical), capped.
 *
 * @param orgs The user's organizations.
 * @param cap How many to keep.
 * @returns At most `cap` orgs, owned before staff.
 */
export function pickVisibleOrgs(orgs: OperatorOrg[], cap: number): OperatorOrg[] {
  const owned = orgs.filter((o) => o.position === 'owner').sort(byName);
  const staff = orgs.filter((o) => o.position !== 'owner').sort(byName);
  return [...owned, ...staff].slice(0, cap);
}

/**
 * Where the "Join requests (N)" doorbell leads.
 *
 * Operators answer join requests from the org-wide list on their Operator
 * Dashboard, so they go to their primary org (owned first, same order as the
 * Operator section) — a one-org LO lands exactly where their requests live.
 * Players and captains go to My Teams. ('/dashboard' only redirects to
 * /my-teams, so it's no use as an operator target.)
 *
 * @param isOperator Whether the user can access operator features.
 * @param orgs The user's organizations (may be empty while loading).
 * @returns The route for the doorbell link.
 */
export function resolveJoinRequestsTo(isOperator: boolean, orgs: OperatorOrg[]): string {
  if (isOperator && orgs?.length) {
    return `/operator-dashboard/${pickVisibleOrgs(orgs, 1)[0].id}`;
  }
  return '/my-teams';
}

/**
 * Two-letter initials from first + last name; "?" when both are missing.
 * Mirrors the helper in PageHeader.tsx.
 */
export function computeInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim()?.charAt(0) ?? '';
  const last = lastName?.trim()?.charAt(0) ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

/** "First Last", or "Signed in" when the profile has no name yet. */
export function displayNameOf(member?: { first_name?: string | null; last_name?: string | null } | null): string {
  const name = [member?.first_name, member?.last_name].filter(Boolean).join(' ');
  return name || 'Signed in';
}
