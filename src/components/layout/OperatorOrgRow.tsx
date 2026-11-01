/**
 * @fileoverview OperatorOrgRow — per-organization entry in the Operator nav
 * section (rendered by the shared `OperatorSection`).
 *
 * Each operator org shows its **Dashboard** always, and **Reports (N)** only
 * while at least one report is pending — a doorbell, not a fixture. Hiding it
 * at 0 is safe because the Operator Dashboard already links to Reports.
 * Create League was removed from the nav (its page/route still exists).
 *
 * Owns `usePendingReportsCount(orgId)` for its org — extracting the hook into a
 * per-org component keeps the Rules of Hooks satisfied (a fixed hook count per
 * render regardless of how many orgs exist).
 *
 * Two render modes:
 * - `flat` — single-org operator: the links inline, no disclosure widget.
 * - `collapsible` — multi-org operator: a native <details>/<summary> with the
 *   org name as the header, collapsed by default and independent per org.
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePendingReportsCount } from '@/hooks/usePendingReportsCount';

interface OperatorOrgRowProps {
  /** Operator organization ID (used to build org-scoped routes). */
  orgId: string;
  /** Display name for the organization. */
  orgName: string;
  /** Render mode: flat links (single-org) vs collapsible group (multi-org). */
  mode: 'flat' | 'collapsible';
}

const LINK_CLASS =
  'flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10';

/**
 * Renders the org-scoped operator shortcuts (Dashboard, + Reports when pending).
 * Owns its own `usePendingReportsCount` so the hook count per render is fixed.
 */
export function OperatorOrgRow({ orgId, orgName, mode }: OperatorOrgRowProps) {
  const { count: pendingReports } = usePendingReportsCount(orgId);

  const links = (
    <ul className="space-y-0.5">
      <li>
        <Link to={`/operator-dashboard/${orgId}`} className={LINK_CLASS}>
          Dashboard
        </Link>
      </li>
      {pendingReports > 0 && (
        <li>
          <Link to={`/operator-reports/${orgId}`} className={LINK_CLASS}>
            {`Reports (${pendingReports})`}
          </Link>
        </li>
      )}
    </ul>
  );

  if (mode === 'flat') {
    return links;
  }

  return (
    <details className="group rounded-md">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        <span className="flex-1 truncate">{orgName}</span>
      </summary>
      <div className="ml-6 mt-0.5">{links}</div>
    </details>
  );
}
