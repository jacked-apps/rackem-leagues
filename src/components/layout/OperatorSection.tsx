/**
 * @fileoverview OperatorSection — the "Operator" block at the bottom of the
 * signed-in menu (shared by sidebar + drawer; it used to be copy-pasted as
 * `SidebarOperatorSection` and `OperatorSection`).
 *
 * A list of the operator's organizations, one row each, named after the org
 * and going straight to its dashboard (owned orgs first, capped at
 * `OPERATOR_ORG_CAP`). Reports (N) appears indented under an org only while
 * reports are pending — see `OperatorOrgRow`.
 *
 * @example What an operator with two orgs sees:
 *   OPERATOR
 *   Triple B Pool
 *     Reports (2)
 *   Riverside League
 */

import { OperatorOrgRow } from './OperatorOrgRow';
import { NavSectionHeading } from './NavSectionHeading';
import { OPERATOR_ORG_CAP, pickVisibleOrgs, type OperatorOrg } from './navHelpers';

/**
 * @param orgs The operator's organizations; renders nothing when empty.
 * @param inSheet True in the drawer, so taps close it.
 */
export function OperatorSection({ orgs, inSheet }: { orgs: OperatorOrg[]; inSheet?: boolean }) {
  if (!orgs || orgs.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <NavSectionHeading>Operator</NavSectionHeading>
      <ul className="space-y-1">
        {pickVisibleOrgs(orgs, OPERATOR_ORG_CAP).map((org) => (
          <OperatorOrgRow
            key={org.id}
            orgId={org.id}
            orgName={org.organization_name ?? ''}
            inSheet={inSheet}
          />
        ))}
      </ul>
    </div>
  );
}
