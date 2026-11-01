/**
 * @fileoverview OperatorSection — the "Operator" block at the bottom of the
 * signed-in menu (shared by sidebar + drawer; it used to be copy-pasted as
 * `SidebarOperatorSection` and `OperatorSection`).
 *
 * One org → its links inline. Several → one collapsible group per org, owned
 * orgs first, capped at `OPERATOR_ORG_CAP`. The per-org links (Dashboard, and
 * Reports only when something is pending) live in `OperatorOrgRow`.
 */

import { OperatorOrgRow } from './OperatorOrgRow';
import { NavSectionHeading } from './NavSectionHeading';
import { OPERATOR_ORG_CAP, pickVisibleOrgs, type OperatorOrg } from './navHelpers';

/** @param orgs The operator's organizations; renders nothing when empty. */
export function OperatorSection({ orgs }: { orgs: OperatorOrg[] }) {
  if (!orgs || orgs.length === 0) return null;
  const visible = pickVisibleOrgs(orgs, OPERATOR_ORG_CAP);

  return (
    <div className="mt-4 border-t pt-4">
      <NavSectionHeading>Operator</NavSectionHeading>
      {visible.length === 1 ? (
        <OperatorOrgRow orgId={visible[0].id} orgName={visible[0].organization_name ?? ''} mode="flat" />
      ) : (
        <ul className="space-y-1">
          {visible.map((org) => (
            <li key={org.id}>
              <OperatorOrgRow orgId={org.id} orgName={org.organization_name ?? ''} mode="collapsible" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
