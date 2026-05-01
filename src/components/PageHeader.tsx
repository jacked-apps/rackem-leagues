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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  // Rendered pixel width of the back button (icon + label + padding).
  // BackAffordance measures itself via ResizeObserver and reports here.
  // SubHeader consumes it on desktop to indent so subtitle/org-badge
  // align under where the title actually starts in the sticky bar —
  // works automatically for any back-label length, no per-page tuning.
  const [backWidth, setBackWidth] = useState(0);
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
        className="sticky z-30 flex h-12 items-center gap-2 border-b bg-background px-3 lg:gap-4"
        style={{ top: 'var(--env-banner-height, 0px)' }}
      >
        {showBack ? (
          <BackAffordance
            backTo={backTo}
            backLabel={backLabel}
            onBackClick={onBackClick}
            onMeasure={setBackWidth}
          />
        ) : null}

        <h1 className="flex-1 truncate text-lg font-semibold text-foreground lg:text-3xl">{title}</h1>

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
        hasBack={Boolean(showBack)}
        backWidth={backWidth}
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
  hasBack,
  backWidth,
  children,
}: {
  organization: { organization_name?: string | null } | null | undefined;
  subtitle?: string;
  pathname: string;
  hasBack: boolean;
  /** Rendered pixel width of the back affordance, measured by BackAffordance.
   *  Used on desktop to compute the sub-header's left indent so subtitle and
   *  org-badge align under the title's actual start position. Zero when
   *  there is no back button. */
  backWidth: number;
  children?: React.ReactNode;
}) {
  const isAuthFlowRoute = AUTH_FLOW_ROUTES.includes(pathname);
  const showIdentity = !isAuthFlowRoute;
  const hasContent = Boolean(organization || subtitle || children || showIdentity);

  if (!hasContent) return null;

  // Title's left position in the sticky bar = header's px-3 (12px) +
  // back-button width + gap-4 (16px on desktop). To align the sub-header
  // content with the title, the sub-header needs that same left padding
  // on desktop. Mobile keeps its plain px-4 padding — the alignment isn't
  // worth the eye effort on a small screen.
  const desktopIndentPx = hasBack && backWidth > 0 ? 12 + backWidth + 16 : null;
  const indentStyle = desktopIndentPx
    ? ({ '--ph-sub-indent': `${desktopIndentPx}px` } as React.CSSProperties)
    : undefined;
  const desktopIndentClass = hasBack
    ? 'lg:pl-[var(--ph-sub-indent,6rem)]'
    : 'lg:pl-3';

  return (
    <div
      className={`flex items-start justify-between gap-3 px-4 pt-3 ${desktopIndentClass}`}
      style={indentStyle}
    >
      <div className="min-w-0 flex-1">
        {organization ? (
          <div className="mb-1 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600 lg:h-5 lg:w-5" />
            <span className="text-sm font-medium text-blue-600 lg:text-base">
              {organization.organization_name}
            </span>
          </div>
        ) : null}
        {subtitle ? (
          <p className="text-sm text-muted-foreground lg:text-lg">{subtitle}</p>
        ) : null}
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
 *
 * Reports its rendered width to the parent via `onMeasure` so the sub-header
 * can indent to align with where the title actually starts in the sticky bar
 * — works automatically across any back-label length, no per-page tuning.
 */
function BackAffordance({
  backTo,
  backLabel,
  onBackClick,
  onMeasure,
}: {
  backTo?: string;
  backLabel?: string;
  onBackClick?: () => void;
  onMeasure: (width: number) => void;
}) {
  const ariaLabel = backLabel ?? 'Back';
  const labelOnDesktop = backTo && backLabel ? backLabel : null;

  // Measure the back affordance and re-measure whenever it resizes (label
  // changes, viewport crosses the lg breakpoint and the label shows/hides,
  // font load, etc.). useLayoutEffect runs synchronously before paint so
  // the parent's setState happens in the same paint cycle — no flicker.
  const elRef = useRef<HTMLElement | null>(null);
  const setRef = useCallback((node: HTMLElement | null) => {
    elRef.current = node;
  }, []);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const measure = () => onMeasure(Math.ceil(el.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onMeasure, backLabel, backTo]);

  // self-start pins the back button to the top of the (centered) header
  // flex row so the cap-height of the back-button text aligns with the
  // cap-height of the (larger) title. The 40px tap target is preserved;
  // it just sits in the upper portion of the bar instead of centered.
  const className = 'flex h-10 shrink-0 items-center gap-1 self-start rounded-md px-2 text-sm text-muted-foreground hover:bg-accent';

  if (onBackClick) {
    return (
      <button
        ref={setRef as React.RefCallback<HTMLButtonElement>}
        type="button"
        aria-label={ariaLabel}
        onClick={onBackClick}
        className={className}
      >
        <ArrowLeft className="h-4 w-4" />
        {labelOnDesktop ? (
          <span className="hidden lg:inline">{labelOnDesktop}</span>
        ) : null}
      </button>
    );
  }

  return (
    <Link
      ref={setRef as React.RefCallback<HTMLAnchorElement>}
      to={backTo!}
      aria-label={ariaLabel}
      className={className}
    >
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
 *
 * The avatar acts as a toggle — tapping it from anywhere goes to /profile,
 * tapping it again while on /profile goes back to where the user came from.
 * Saves a navigation step when peeking at profile mid-task.
 */
function IdentitySlot({ pathname }: { pathname: string }) {
  const { isLoggedIn } = useUser();
  const { member } = useUserProfile();
  const navigate = useNavigate();

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
  const onProfile = pathname === '/profile';
  const avatarClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-foreground hover:bg-accent';

  // On the profile page, the avatar becomes a "back" button that takes the
  // user back to wherever they came from (open/close toggle behavior).
  if (onProfile) {
    return (
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Close profile and go back"
        className={avatarClass}
      >
        {initials}
      </button>
    );
  }

  // Anywhere else, the avatar is a Link to /profile (preserves keyboard,
  // right-click open-in-new-tab, screen-reader "link" semantics).
  return (
    <Link
      to="/profile"
      aria-label={`${displayName} — open profile`}
      className={avatarClass}
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

