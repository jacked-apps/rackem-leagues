/**
 * @fileoverview OperatorOrgRow — per-organization sub-component for the
 * AppDrawer's Operator section.
 *
 * Each operator org gets one instance of this component, which owns the
 * `usePendingReportsCount(orgId)` hook for that org. Extracting the hook
 * into a per-org component keeps the React Rules of Hooks satisfied — the
 * number of hook calls per render of any given component is fixed by the
 * component shape, not by the number of orgs.
 *
 * Two render modes:
 * - `flat` — used when the operator has exactly one org. Renders the three
 *   links (Dashboard / Create League / Reports) inline with no disclosure
 *   widget.
 * - `collapsible` — used when the operator has multiple orgs. Renders a
 *   native <details>/<summary> disclosure with the org name as the header,
 *   collapsed by default. Independent of any other org's open state.
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

/**
 * Renders the three org-scoped operator shortcuts for one organization.
 * Owns its own `usePendingReportsCount` so the hook count per render is fixed.
 */
export function OperatorOrgRow({ orgId, orgName, mode }: OperatorOrgRowProps) {
  const { count: pendingReports } = usePendingReportsCount(orgId);

  const reportsLabel = pendingReports > 0 ? `Reports (${pendingReports})` : 'Reports';

  const links = (
    <ul className="space-y-0.5">
      <li>
        <Link
          to={`/operator-dashboard/${orgId}`}
          className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          Dashboard
        </Link>
      </li>
      <li>
        <Link
          to={`/create-league/${orgId}`}
          className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          Create League
        </Link>
      </li>
      <li>
        <Link
          to={`/operator-reports/${orgId}`}
          className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          {reportsLabel}
        </Link>
      </li>
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
