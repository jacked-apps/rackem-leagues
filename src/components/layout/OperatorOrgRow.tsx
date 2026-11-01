/**
 * @fileoverview OperatorOrgRow — one organization's rows in the Operator
 * section of the menu (rendered by the shared `OperatorSection`).
 *
 * Two modes, both plain links (no folds):
 * - `flat` — single-org operator: a **Dashboard** row.
 * - `named` — multi-org operator: the **org name** is the row, and it goes
 *   straight to that org's dashboard (Ed, 2026-11-01: "tap your org to go to
 *   your dashboard"). It used to be a fold, but once Reports only shows when
 *   pending, opening it usually revealed one link — a wasted tap.
 *
 * Either way, **Reports (N)** appears under it only while at least one report
 * is pending — a doorbell, not a fixture. Hiding it at 0 is safe because the
 * Operator Dashboard already links to Reports.
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
  /** Display name for the organization (the row label in `named` mode). */
  orgName: string;
  /** `flat` = "Dashboard" row (one org); `named` = org-name row (several). */
  mode: 'flat' | 'named';
  /** True in the drawer, so taps close it. */
  inSheet?: boolean;
}

/**
 * Renders `<li>` rows; place inside a `<ul>`.
 *
 * @example <ul><OperatorOrgRow orgId="o1" orgName="Triple B" mode="named" /></ul>
 */
export function OperatorOrgRow({ orgId, orgName, mode, inSheet }: OperatorOrgRowProps) {
  const { count: pendingReports } = usePendingReportsCount(orgId);
  const reports =
    pendingReports > 0 ? (
      <NavRow to={`/operator-reports/${orgId}`} label={`Reports (${pendingReports})`} inSheet={inSheet} />
    ) : null;

  return (
    <>
      <NavRow
        to={`/operator-dashboard/${orgId}`}
        label={mode === 'flat' ? 'Dashboard' : orgName || 'Dashboard'}
        inSheet={inSheet}
      />
      {/* With several orgs, indent Reports so it reads as that org's. */}
      {reports && mode === 'named' ? (
        <li>
          <ul className="ml-4">{reports}</ul>
        </li>
      ) : (
        reports
      )}
    </>
  );
}
