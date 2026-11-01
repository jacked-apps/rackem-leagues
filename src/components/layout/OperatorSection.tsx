/**
 * @fileoverview OperatorSection — the "Operator" block at the bottom of the
 * signed-in menu (shared by sidebar + drawer; it used to be copy-pasted as
 * `SidebarOperatorSection` and `OperatorSection`).
 *
 * One org → a "Dashboard" row. Several → one row per org, named after it,
 * each going straight to that org's dashboard (owned orgs first, capped at
 * `OPERATOR_ORG_CAP`). Reports (N) appears under an org only while reports
 * are pending — see `OperatorOrgRow`.
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
  const visible = pickVisibleOrgs(orgs, OPERATOR_ORG_CAP);
  const mode = visible.length === 1 ? 'flat' : 'named';

  return (
    <div className="mt-4 border-t pt-4">
      <NavSectionHeading>Operator</NavSectionHeading>
      <ul className="space-y-1">
        {visible.map((org) => (
          <OperatorOrgRow
            key={org.id}
            orgId={org.id}
            orgName={org.organization_name ?? ''}
            mode={mode}
            inSheet={inSheet}
          />
        ))}
      </ul>
    </div>
  );
}
