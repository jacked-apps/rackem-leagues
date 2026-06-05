/**
 * @fileoverview Persistent desktop sidebar for `lg+` viewports.
 *
 * Renders the same role-aware navigation as AppDrawer but without the
 * Sheet/drawer mechanics. Always visible on desktop, fixed-position to
 * the left of page content.
 *
 * Sections mirror AppDrawer:
 * - Brand header with identity line
 * - Player nav links
 * - Operator org section (caps at 4 orgs)
 * - Theme toggle
 * - Sign Out
 */

import { Link, useLocation } from 'react-router-dom';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useUnreadMessageCount } from '@/api/hooks/useMessages';
import { usePendingJoinRequestCount } from '@/api/hooks/usePendingJoinRequestCount';
import { OperatorOrgRow } from './OperatorOrgRow';

/** Cap on visible orgs — matches AppDrawer. */
const OPERATOR_ORG_CAP = 4;

interface OperatorOrg {
  id: string;
  organization_name?: string | null;
  position?: string | null;
}

function pickVisibleOrgs(orgs: OperatorOrg[], cap: number): OperatorOrg[] {
  const owned = orgs
    .filter((o) => o.position === 'owner')
    .sort((a, b) => (a.organization_name ?? '').localeCompare(b.organization_name ?? ''));
  const staff = orgs
    .filter((o) => o.position !== 'owner')
    .sort((a, b) => (a.organization_name ?? '').localeCompare(b.organization_name ?? ''));
  return [...owned, ...staff].slice(0, cap);
}

export function AppSidebar() {
  const { isLoggedIn } = useUser();
  const { member, canAccessLeagueOperatorFeatures } = useUserProfile();
  const isOperator = canAccessLeagueOperatorFeatures();
  const { organizations } = useOrganizations(member?.id);
  const { data: unreadCount = 0 } = useUnreadMessageCount(member?.id);

  const displayName = (() => {
    if (member?.first_name || member?.last_name) {
      return [member.first_name, member.last_name].filter(Boolean).join(' ');
    }
    return 'Signed in';
  })();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r bg-background lg:flex"
      style={{ top: 'var(--env-banner-height, 0px)' }}
    >
      {/* Brand header — logo swaps based on theme. Width-driven sizing so the
          wide wordmark fills most of the sidebar; height follows from the
          512×149 source aspect ratio. PNG instead of SVG because the SVGs
          still have whitespace-heavy 512×512 viewBoxes. */}
      <Link
        to={isLoggedIn ? '/my-teams' : '/'}
        aria-label="Rack 'Em Leagues — home"
        className="flex items-center justify-center border-b px-3 py-3 transition-opacity hover:opacity-80"
      >
        <img
          src="/logo-main.png"
          alt="Rack 'Em Leagues"
          className="block h-auto w-4/5 dark:hidden"
        />
        <img
          src="/logo-main-dark.png"
          alt="Rack 'Em Leagues"
          className="hidden h-auto w-4/5 dark:block"
        />
      </Link>

      {/* Profile row — avatar + name, clickable to /profile */}
      {isLoggedIn ? (
        <Link
          to="/profile"
          aria-label={`${displayName} — open profile`}
          className="flex items-center gap-3 border-b px-4 py-3 text-primary transition-colors hover:bg-primary/10"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary">
            {computeInitials(member?.first_name, member?.last_name)}
          </span>
          <span className="truncate text-sm font-medium">{displayName}</span>
        </Link>
      ) : null}

      {/* Nav content — scrollable */}
      <nav aria-label="Sidebar navigation" className="flex-1 overflow-y-auto p-4">
        {isLoggedIn ? (
          <>
            <SidebarPlayerSection unreadCount={unreadCount} />
            {isOperator ? (
              <SidebarOperatorSection orgs={organizations as OperatorOrg[]} />
            ) : null}
          </>
        ) : null}
      </nav>

    </aside>
  );
}


function SidebarPlayerSection({ unreadCount }: { unreadCount: number }) {
  const messagesLabel = unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages';
  // Doorbell: pending join requests for teams this user can approve.
  const joinRequestCount = usePendingJoinRequestCount();
  return (
    <ul className="space-y-1">
      <SidebarLink to="/my-match" label="My Match" />
      <SidebarLink to="/my-teams" label="My Teams" />
      {joinRequestCount > 0 && (
        <SidebarLink to="/my-teams" label={`Join requests (${joinRequestCount})`} />
      )}
      <SidebarLink to="/stats" label="Stats" />
      <SidebarLink to="/rules" label="Rules" />
      <SidebarLink to="/learn" label="Learn" />
      <SidebarLink to="/messages" label={messagesLabel} />
      <SidebarLink to="/profile" label="Profile" />
    </ul>
  );
}

function SidebarOperatorSection({ orgs }: { orgs: OperatorOrg[] }) {
  if (!orgs || orgs.length === 0) return null;
  const visible = pickVisibleOrgs(orgs, OPERATOR_ORG_CAP);
  const isSingleOrg = visible.length === 1;

  return (
    <div className="mt-6 border-t pt-4">
      <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Operator
      </h3>
      {visible.length > 0 &&
        (isSingleOrg ? (
          <OperatorOrgRow
            orgId={visible[0].id}
            orgName={visible[0].organization_name ?? ''}
            mode="flat"
          />
        ) : (
          <ul className="space-y-1">
            {visible.map((org) => (
              <li key={org.id}>
                <OperatorOrgRow
                  orgId={org.id}
                  orgName={org.organization_name ?? ''}
                  mode="collapsible"
                />
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

/** Two-letter initials from first + last; falls back to "?" when both are
 *  missing. Mirrors the helper in PageHeader.tsx. */
function computeInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim()?.charAt(0) ?? '';
  const last = lastName?.trim()?.charAt(0) ?? '';
  return (`${first}${last}`.toUpperCase()) || '?';
}

/** Sidebar nav link with active state highlighting. */
function SidebarLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <li>
      <Link
        to={to}
        className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10 ${
          isActive ? 'bg-primary/15 font-semibold' : ''
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
