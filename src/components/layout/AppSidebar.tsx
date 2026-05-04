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
import { LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useUnreadMessageCount } from '@/api/hooks/useMessages';
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
  const { isLoggedIn, logout } = useUser();
  const { member, canAccessLeagueOperatorFeatures } = useUserProfile();
  const isOperator = canAccessLeagueOperatorFeatures();
  const { organizations } = useOrganizations(member?.id);
  const { data: unreadCount = 0 } = useUnreadMessageCount(member?.id);

  const identityLine = (() => {
    if (!isLoggedIn) return 'Not signed in';
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
      {/* Brand header */}
      <div className="border-b px-4 py-3">
        <div className="text-base font-semibold">Rack &lsquo;Em</div>
        <div className="text-xs text-muted-foreground">{identityLine}</div>
      </div>

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

      {/* Footer — theme toggle + sign out */}
      <div className="border-t p-4 space-y-3">
        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Theme
          </h3>
          <ThemeToggle />
        </div>
        {isLoggedIn ? (
          <Button
            type="button"
            variant="ghost"
            loadingText="none"
            onClick={logout}
            className="w-full justify-start gap-2 px-3 text-sm"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        ) : null}
      </div>
    </aside>
  );
}

function SidebarPlayerSection({ unreadCount }: { unreadCount: number }) {
  const messagesLabel = unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages';
  return (
    <ul className="space-y-1">
      <SidebarLink to="/my-match" label="My Match" />
      <SidebarLink to="/my-teams" label="My Teams" />
      <SidebarLink to="/stats" label="Stats" />
      <SidebarLink to="/rules" label="Rules" />
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
      {isSingleOrg ? (
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
      )}
    </div>
  );
}

/** Sidebar nav link with active state highlighting. */
function SidebarLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <li>
      <Link
        to={to}
        className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm hover:bg-accent ${
          isActive ? 'bg-accent font-medium' : ''
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
