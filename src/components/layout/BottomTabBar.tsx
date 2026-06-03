/**
 * @fileoverview Fixed bottom tab bar for mobile navigation.
 *
 * Renders 4 tabs for all authenticated users (My Teams, Live, Messages,
 * Profile) and a 5th "Manage" tab for operators. Hidden on desktop (`lg+`)
 * where the persistent sidebar takes over.
 *
 * The tab bar is hidden on pages that have their own fixed bottom action
 * bars (TeamManagement, SeasonScheduleManager) to avoid overlap.
 */

import { Link, useLocation, useParams } from 'react-router-dom';
import { Users, Radio, MessageSquare, Settings, Building2 } from 'lucide-react';
import { useIsOperator } from '@/api/hooks/useUserProfile';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useUnreadMessageCount } from '@/api/hooks/useMessages';
import { usePendingJoinRequestCount } from '@/api/hooks/usePendingJoinRequestCount';
import { useUserProfile } from '@/api/hooks/useUserProfile';

/** Routes where the tab bar is hidden because the page has its own fixed
 *  bottom action bar (Save/Cancel). */
const HIDDEN_TAB_ROUTES = [
  /^\/league\/[^/]+\/manage-teams$/,
  /^\/league\/[^/]+\/season\/[^/]+\/manage-schedule$/,
];

interface TabItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  /** Route patterns that activate this tab. */
  activePatterns: RegExp[];
  /** Optional badge count. */
  badge?: number;
}

/**
 * Determine the primary org for the Manage tab — owner orgs first, then
 * alphabetical. Falls back to the first org in the list.
 */
function getPrimaryOrgId(
  organizations: Array<{ id: string; position?: string | null; organization_name?: string | null }>,
): string | null {
  if (organizations.length === 0) return null;

  const owned = organizations
    .filter((o) => o.position === 'owner')
    .sort((a, b) => (a.organization_name ?? '').localeCompare(b.organization_name ?? ''));
  const staff = organizations
    .filter((o) => o.position !== 'owner')
    .sort((a, b) => (a.organization_name ?? '').localeCompare(b.organization_name ?? ''));

  return [...owned, ...staff][0]?.id ?? null;
}

/** Operator route patterns that activate the Manage tab. */
const MANAGE_PATTERNS = [
  /^\/operator-/,
  /^\/league\//,
  /^\/venues\//,
  /^\/manage-/,
  /^\/create-league\//,
  /^\/league-rules\//,
];

export function BottomTabBar() {
  const location = useLocation();
  const params = useParams();
  const isOperator = useIsOperator();
  const { member } = useUserProfile();
  const { organizations } = useOrganizations(member?.id);
  const { data: unreadCount = 0 } = useUnreadMessageCount(member?.id);
  const joinRequestCount = usePendingJoinRequestCount();

  // Hide on routes with fixed bottom action bars
  const shouldHide = HIDDEN_TAB_ROUTES.some((pattern) => pattern.test(location.pathname));
  if (shouldHide) return null;

  // Determine the org to navigate to for the Manage tab.
  // Prefer the current route's orgId if we're already on an operator page,
  // otherwise fall back to the user's primary org.
  const currentOrgId = params.orgId ?? null;
  const primaryOrgId = getPrimaryOrgId(organizations);
  const manageOrgId = currentOrgId ?? primaryOrgId;

  const playerTabs: TabItem[] = [
    {
      label: 'My Teams',
      icon: Users,
      to: '/my-teams',
      activePatterns: [/^\/my-teams/, /^\/team\//],
      // Doorbell: pending join requests the user can approve (act-now nudge on
      // the destination tab, cleared when the queue empties).
      badge: joinRequestCount > 0 ? joinRequestCount : undefined,
    },
    {
      label: 'Live',
      icon: Radio,
      to: '/live',
      activePatterns: [/^\/live/, /^\/league\/[^/]+\/live/],
    },
    {
      label: 'Messages',
      icon: MessageSquare,
      to: '/messages',
      activePatterns: [/^\/messages/],
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      label: 'Profile',
      icon: Settings,
      to: '/profile',
      activePatterns: [/^\/profile/],
    },
  ];

  const tabs: TabItem[] = isOperator && manageOrgId
    ? [
        ...playerTabs,
        {
          label: 'Manage',
          icon: Building2,
          to: `/operator-dashboard/${manageOrgId}`,
          activePatterns: MANAGE_PATTERNS,
          // Doorbell for the LO: join requests are handled on the operator
          // dashboard, so surface the count on the tab that lands there too.
          badge: joinRequestCount > 0 ? joinRequestCount : undefined,
        },
      ]
    : playerTabs;

  return (
    <nav
      aria-label="Tab navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background lg:hidden"
      style={{ height: 'var(--tab-bar-height, 4rem)' }}
    >
      <div className="flex h-full items-stretch">
        {tabs.map((tab) => {
          const isActive = tab.activePatterns.some((p) => p.test(location.pathname));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.label}
              to={tab.to}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs text-primary transition-colors ${
                isActive ? 'font-semibold' : 'opacity-60'
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {tab.badge ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                ) : null}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
