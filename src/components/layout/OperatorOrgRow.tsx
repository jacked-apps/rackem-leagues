/**
 * @fileoverview OperatorOrgRow — one organization's rows in the Operator
 * section of the menu (rendered by the shared `OperatorSection`).
 *
 * The **org name** is the row, and it goes straight to that org's dashboard
 * — for one org or several (Ed, 2026-11-01: "pressing the name of the org
 * should bring you to the dashboard of that org"). The section then reads as
 * the list of your organizations, with no "Dashboard Dashboard Dashboard".
 *
 * **Reports (N)** sits indented under its org's name, and only while at least
 * one report is pending — a doorbell, not a fixture. Hiding it at 0 is safe
 * because the Operator Dashboard already links to Reports.
 *
 * Rows go through `NavRow`, so in the drawer every tap closes it (even when
 * you're already on that page) and the current page is highlighted, the same
 * as every other menu row.
 *
 * Owns `usePendingReportsCount(orgId)` for its org — a per-org component keeps
 * the Rules of Hooks satisfied (a fixed hook count however many orgs exist).
 */

import { usePendingReportsCount } from '@/hooks/usePendingReportsCount';
import { NavRow } from './NavRow';

interface OperatorOrgRowProps {
  /** Operator organization ID (used to build org-scoped routes). */
  orgId: string;
  /** Display name for the organization — the row's label. */
  orgName: string;
  /** True in the drawer, so taps close it. */
  inSheet?: boolean;
}

/**
 * Renders `<li>` rows; place inside a `<ul>`.
 *
 * @example <ul><OperatorOrgRow orgId="o1" orgName="Triple B Pool" /></ul>
 */
export function OperatorOrgRow({ orgId, orgName, inSheet }: OperatorOrgRowProps) {
  const { count: pendingReports } = usePendingReportsCount(orgId);

  return (
    <>
      {/* "Dashboard" only if an org somehow has no name, so the row is never blank. */}
      <NavRow to={`/operator-dashboard/${orgId}`} label={orgName || 'Dashboard'} inSheet={inSheet} />
      {pendingReports > 0 ? (
        <li>
          {/* Indented so it reads as this org's reports. */}
          <ul className="ml-4">
            <NavRow to={`/operator-reports/${orgId}`} label={`Reports (${pendingReports})`} inSheet={inSheet} />
          </ul>
        </li>
      ) : null}
    </>
  );
}
