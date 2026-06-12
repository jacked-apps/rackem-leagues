/**
 * @fileoverview OperatorOrgRow — per-organization entry in the Operator nav
 * section (shared by AppDrawer's OperatorSection + AppSidebar's
 * SidebarOperatorSection).
 *
 * For now each org exposes a single action: its **Dashboard**. (Create League
 * and Reports were removed from the nav per product decision — the pages still
 * exist and are reachable by route; nav entries may be added back later.)
 *
 * Two render modes:
 * - `flat` — single-org operator: a lone "Dashboard" link.
 * - `collapsible` — multi-org operator: the org name links directly to that
 *   org's Dashboard. With a single action there's no need for a disclosure
 *   widget, so the name itself is the link.
 */

import { Link } from 'react-router-dom';

interface OperatorOrgRowProps {
  /** Operator organization ID (used to build the org-scoped Dashboard route). */
  orgId: string;
  /** Display name for the organization. */
  orgName: string;
  /** Render mode: flat link (single-org) vs org-name link (multi-org). */
  mode: 'flat' | 'collapsible';
}

const ROW_CLASS =
  'flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10';

/** Renders the single org-scoped operator shortcut (Dashboard) for one org. */
export function OperatorOrgRow({ orgId, orgName, mode }: OperatorOrgRowProps) {
  const dashboardHref = `/operator-dashboard/${orgId}`;

  if (mode === 'flat') {
    return (
      <ul className="space-y-0.5">
        <li>
          <Link to={dashboardHref} className={ROW_CLASS}>
            Dashboard
          </Link>
        </li>
      </ul>
    );
  }

  // Multi-org: the org name itself links straight to its dashboard.
  return (
    <Link to={dashboardHref} className={`${ROW_CLASS} font-medium`}>
      <span className="flex-1 truncate">{orgName}</span>
    </Link>
  );
}
