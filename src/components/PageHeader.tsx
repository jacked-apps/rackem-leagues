/**
 * @fileoverview Reusable Page Header — the global sticky header on every page.
 *
 * The slim ~48px sticky bar hosts:
 * - Hamburger trigger (left) — opens the global navigation drawer.
 * - Back arrow (immediately right of hamburger, conditional on `backTo` or
 *   `onBackClick`). Mobile: icon only. Desktop ≥1024px (`lg:`): icon + label.
 * - Title (flex-1, truncates with ellipsis).
 * - Identity slot (right) — avatar/initials linking to `/profile` when logged
 *   in, "Sign in" button when logged out, suppressed on auth-flow routes.
 *
 * Below the sticky bar (NOT sticky) the component renders the page's
 * `subtitle`, optional organization badge (driven by `organizationId`), and
 * any decorative `children`. These scroll with page content — moving them
 * out of the sticky chrome reclaims roughly 80–90px of vertical space on
 * every page compared to the previous PageHeader anatomy.
 *
 * The hamburger triggers a shadcn `Sheet` whose contents are the global
 * `<AppDrawer>`. The drawer is **lazy-mounted** (`{open ? <AppDrawer/> : null}`)
 * so the drawer's data hooks (`useOrganizations`, `useUnreadMessageCount`,
 * `usePendingReportsCount`) only fire on the page where the user actually
 * opens the menu — page navigations on closed-drawer pages don't refetch
 * any of that data.
 *
 * Sticky stacking with `EnvironmentBanner`: the header's `top` offset reads
 * `var(--env-banner-height, 0px)` — the banner publishes its rendered height
 * to that variable via `ResizeObserver` (see `EnvironmentBanner.tsx`), so the
 * header always sits flush below the banner on dev/staging and at top:0 on
 * production where the banner never renders.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Building2, LogIn, Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { AppDrawer } from '@/components/layout/AppDrawer';
import { useOrganization } from '@/api/hooks/useOrganizations';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';

/** Routes where the right-slot Sign-in button is suppressed (rendering it
 *  would be redundant on the login page or contextually wrong on the other
 *  auth-flow pages). The hamburger menu itself remains available. */
const AUTH_FLOW_ROUTES: readonly string[] = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm',
  '/claim-player',
];

interface PageHeaderProps {
  /** Path to navigate back to (renders an anchor when set). */
  backTo?: string;
  /** Text for the back link. On mobile it's used as the back button's
   *  `aria-label`; on desktop ≥1024px it's also rendered as the visible
   *  label next to the arrow. */
  backLabel?: string;
  /** Optional click handler that overrides `backTo` Link behavior — useful
   *  for pages that need to intercept back (e.g., unsaved-changes prompts). */
  onBackClick?: () => void;
  /** Force-hide the back button even when `backTo`/`onBackClick` is set. */
  hideBack?: boolean;
  /** Main page title — string or JSX (e.g., title with embedded InfoButton). */
  title: React.ReactNode;
  /** Optional subtitle rendered below the sticky bar (scrolls with content). */
  subtitle?: string;
  /** Optional organization ID — when provided, an org badge renders below
   *  the sticky bar with the organization name. */
  organizationId?: string;
  /** Optional children rendered below the sticky bar (scrolls with content).
   *  Use for decorative content like InfoButton, format chips, hints. Pages
   *  with primary save/cancel action pairs render those in their own fixed
   *  bottom action bar instead. */
  children?: React.ReactNode;
}

/**
 * Reusable page header with global hamburger drawer.
 *
 * @example
 * <PageHeader
 *   backTo="/my-teams"
 *   backLabel="Back to My Teams"
 *   title="Team Schedule"
 *   subtitle="Mondays"
 *   organizationId="org-uuid"
 * />
 */
export function PageHeader({
  backTo,
  backLabel,
  onBackClick,
  hideBack = false,
  title,
  subtitle,
  organizationId,
  children,
}: PageHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { organization } = useOrganization(organizationId);

  // Belt-and-suspenders: close the drawer on any path change. SheetClose
  // already handles taps on drawer Links, but a programmatic redirect or
  // unusual nav pattern could leave it open otherwise.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const showBack = !hideBack && (backTo || onBackClick);

  return (
    <>
      <header
        className="sticky z-30 flex h-12 items-center gap-2 border-b bg-white px-3"
        style={{ top: 'var(--env-banner-height, 0px)' }}
      >
        {showBack ? <BackAffordance backTo={backTo} backLabel={backLabel} onBackClick={onBackClick} /> : null}

        <h1 className="flex-1 truncate text-lg font-semibold text-gray-900">{title}</h1>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Open menu"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-accent"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right">
            {drawerOpen ? (
              <AppDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
            ) : null}
          </SheetContent>
        </Sheet>
      </header>

      <SubHeader
        organization={organization}
        subtitle={subtitle}
        pathname={location.pathname}
      >
        {children}
      </SubHeader>
    </>
  );
}

/**
 * Sub-header rendered below the sticky bar — scrolls with content. Hosts
 * the org badge, subtitle, decorative children, and the identity slot
 * (avatar / Sign-in) on the right. Renders nothing when there is nothing
 * to show (e.g., a no-subtitle page on an auth-flow route).
 */
function SubHeader({
  organization,
  subtitle,
  pathname,
  children,
}: {
  organization: { organization_name?: string | null } | null | undefined;
  subtitle?: string;
  pathname: string;
  children?: React.ReactNode;
}) {
  const isAuthFlowRoute = AUTH_FLOW_ROUTES.includes(pathname);
  const showIdentity = !isAuthFlowRoute;
  const hasContent = Boolean(organization || subtitle || children || showIdentity);

  if (!hasContent) return null;

  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-3">
      <div className="min-w-0 flex-1">
        {organization ? (
          <div className="mb-1 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">
              {organization.organization_name}
            </span>
          </div>
        ) : null}
        {subtitle ? <p className="text-sm text-gray-600">{subtitle}</p> : null}
        {children}
      </div>
      {showIdentity ? <IdentitySlot pathname={pathname} /> : null}
    </div>
  );
}

/**
 * Back affordance. Mobile: icon only with `aria-label` from `backLabel`.
 * Desktop ≥1024px: icon + visible label text. Falls back to icon-only when
 * `onBackClick` is the only handler (no static destination string to render).
 */
function BackAffordance({
  backTo,
  backLabel,
  onBackClick,
}: {
  backTo?: string;
  backLabel?: string;
  onBackClick?: () => void;
}) {
  const ariaLabel = backLabel ?? 'Back';
  const labelOnDesktop = backTo && backLabel ? backLabel : null;

  const className = 'flex h-10 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-gray-600 hover:bg-accent';

  if (onBackClick) {
    return (
      <button type="button" aria-label={ariaLabel} onClick={onBackClick} className={className}>
        <ArrowLeft className="h-4 w-4" />
        {labelOnDesktop ? (
          <span className="hidden lg:inline">{labelOnDesktop}</span>
        ) : null}
      </button>
    );
  }

  return (
    <Link to={backTo!} aria-label={ariaLabel} className={className}>
      <ArrowLeft className="h-4 w-4" />
      {labelOnDesktop ? (
        <span className="hidden lg:inline">{labelOnDesktop}</span>
      ) : null}
    </Link>
  );
}

/**
 * Identity slot: avatar/initials linking to /profile when logged in,
 * "Sign in" button when logged out. Suppressed on auth-flow routes.
 */
function IdentitySlot({ pathname }: { pathname: string }) {
  const { isLoggedIn } = useUser();
  const { member } = useUserProfile();

  if (AUTH_FLOW_ROUTES.includes(pathname)) {
    return null;
  }

  if (!isLoggedIn) {
    return (
      <Link
        to="/login"
        aria-label="Sign in"
        className="flex h-10 shrink-0 items-center gap-1 rounded-md border px-3 text-sm hover:bg-accent"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  const initials = computeInitials(member?.first_name, member?.last_name);
  const displayName = [member?.first_name, member?.last_name].filter(Boolean).join(' ') || 'Profile';

  return (
    <Link
      to="/profile"
      aria-label={`${displayName} — open profile`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-accent"
    >
      {initials}
    </Link>
  );
}

/** Two-letter initials from first + last; falls back to "?" when both are
 *  missing. Defensive against null/undefined/empty strings. */
function computeInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim()?.charAt(0) ?? '';
  const last = lastName?.trim()?.charAt(0) ?? '';
  const combined = `${first}${last}`.toUpperCase();
  return combined || '?';
}

