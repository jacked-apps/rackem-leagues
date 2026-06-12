/**
 * @fileoverview AppDrawer — content of the global hamburger drawer.
 *
 * Mounted inside the Sheet portal owned by `PageHeader` (mobile only — desktop
 * has the persistent `<AppSidebar>` and the hamburger is `lg:hidden`).
 *
 * Visually mirrors `<AppSidebar>`: logo header, profile row (when logged in),
 * Simonis-blue nav links with active-state highlight. Public visitors get a
 * minimal Home / About / Pricing / Rules / Sign-in list since the mobile
 * drawer is the only nav surface on small viewports for public pages.
 *
 * Theme picker and Sign Out live on the Profile page (Player Settings) — not
 * the drawer — because they're infrequent actions and shouldn't crowd the
 * everyday nav surface.
 *
 * Lazy-mounted by PageHeader (`{open ? <AppDrawer/> : null}`) so the drawer's
 * data hooks (`useOrganizations`, `useUnreadMessageCount`, per-org Reports
 * counts) only fire when the user actually opens the menu.
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogIn, Radio } from 'lucide-react';
import {
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useUnreadMessageCount } from '@/api/hooks/useMessages';
import { usePendingJoinRequestCount } from '@/api/hooks/usePendingJoinRequestCount';
import { useCaptainReupPrompt } from '@/hooks/useCaptainReupPrompt';
import { useMyMatchSurfaces, type MyMatchDrawerItem } from '@/api/hooks/useMyMatchSurfaces';
import { OperatorOrgRow } from './OperatorOrgRow';

interface AppDrawerProps {
  /** Whether the parent Sheet is open. */
  open: boolean;
  /** Setter for the parent Sheet's open state. */
  onOpenChange: (open: boolean) => void;
}

/** Cap on the number of operator orgs visible in the drawer — matches AppSidebar. */
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

/**
 * Resolve where the "Join requests (N)" doorbell should lead.
 *
 * Operators manage incoming join requests from the org-wide list on their
 * Operator Dashboard, so they route there — to their primary org (owned orgs
 * first, matching `pickVisibleOrgs` ordering). The one-org LO, which is the
 * common case, lands precisely on the surface that shows their requests.
 * Everyone else (players, captains) keeps the My Teams route.
 *
 * @param isOperator Whether the user can access operator features.
 * @param orgs The user's organizations (may be empty while loading).
 * @returns The route the doorbell link should point at.
 */
function resolveJoinRequestsTo(isOperator: boolean, orgs: OperatorOrg[]): string {
  if (isOperator && orgs?.length) {
    return `/operator-dashboard/${pickVisibleOrgs(orgs, 1)[0].id}`;
  }
  return '/my-teams';
}

export function AppDrawer(_props: AppDrawerProps) {
  const { isLoggedIn } = useUser();
  const { member, canAccessLeagueOperatorFeatures } = useUserProfile();
  const isOperator = canAccessLeagueOperatorFeatures();
  const { organizations } = useOrganizations(member?.id);
  const { data: unreadCount = 0 } = useUnreadMessageCount(member?.id);
  const { drawerItems: myMatchItems, isHydrating: myMatchHydrating } =
    useMyMatchSurfaces(member?.id);

  // Doorbell target: operators answer the join-request door from their
  // operator surface (the org-wide list on the Operator Dashboard), not the
  // player's My Teams page. We send them to their *primary* org — owned orgs
  // first via the same ordering the Operator section uses — so a one-org LO
  // (the common case) lands exactly where their requests live. Non-operators
  // keep the player route. ('/dashboard' is only a redirect to /my-teams, so
  // it's no use as a multi-org target — the primary org's dashboard is.)
  const joinRequestsTo = resolveJoinRequestsTo(isOperator, organizations as OperatorOrg[]);

  const displayName = (() => {
    if (member?.first_name || member?.last_name) {
      return [member.first_name, member.last_name].filter(Boolean).join(' ');
    }
    return 'Signed in';
  })();

  return (
    <>
      {/* Accessible label for the Sheet — visually hidden because the logo
          image and profile row carry the visible identity. */}
      <SheetHeader className="sr-only">
        <SheetTitle>Rack &lsquo;Em Leagues</SheetTitle>
        <SheetDescription>{isLoggedIn ? displayName : 'Not signed in'}</SheetDescription>
      </SheetHeader>

      {/* Brand header — same logo treatment as AppSidebar (width-driven, 80%,
          theme-swapped). Closes the drawer on tap via SheetClose. */}
      <SheetClose asChild>
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
      </SheetClose>

      {/* Profile row — mirrors AppSidebar */}
      {isLoggedIn ? (
        <SheetClose asChild>
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
        </SheetClose>
      ) : null}

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-4">
        {!isLoggedIn ? (
          <PublicSection />
        ) : (
          <>
            {/* My Match sits at the TOP — it's the most-used action, and this
                matches the desktop sidebar's placement. */}
            <MyMatchSection items={myMatchItems} isHydrating={myMatchHydrating} />
            <PlayerSection unreadCount={unreadCount} joinRequestsTo={joinRequestsTo} />
            {isOperator ? <OperatorSection orgs={organizations as OperatorOrg[]} /> : null}
          </>
        )}
      </nav>
    </>
  );
}

/** Logged-out: Home / About / Pricing / Rules / Sign in. */
function PublicSection() {
  return (
    <ul className="space-y-1">
      <DrawerLink to="/" label="Home" />
      <DrawerLink to="/about" label="About" />
      <DrawerLink to="/pricing" label="Pricing" />
      <DrawerLink to="/rules" label="Rules" />
      <li className="pt-2">
        <SheetClose asChild>
          <Link
            to="/login"
            className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        </SheetClose>
      </li>
    </ul>
  );
}

/** Mirrors SidebarPlayerSection. */
function PlayerSection({
  unreadCount,
  joinRequestsTo,
}: {
  unreadCount: number;
  /** Where the doorbell leads — operator surface for LOs, My Teams otherwise. */
  joinRequestsTo: string;
}) {
  const messagesLabel = unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages';
  // Doorbell: pending join requests for teams this user can approve. The link
  // appears only while requests are waiting and clears when handled.
  const joinRequestCount = usePendingJoinRequestCount();
  // Captain re-up entry — shown only when the current user has open
  // re-up forms (last-3-weeks window + no submitted answer yet). Same
  // hook the syncer-modal uses, so the link appears the moment a
  // qualifying team exists and disappears the moment it's answered.
  const { data: reupTeams = [] } = useCaptainReupPrompt();
  const reupLabel =
    reupTeams.length > 1
      ? `Season Re-Up (${reupTeams.length})`
      : 'Season Re-Up';
  return (
    <ul className="space-y-1">
      <DrawerLink to="/my-teams" label="My Teams" />
      {joinRequestCount > 0 && (
        <DrawerLink to={joinRequestsTo} label={`Join requests (${joinRequestCount})`} />
      )}
      {reupTeams.length > 0 && <DrawerLink to="/reup" label={reupLabel} />}
      <DrawerLink to="/stats" label="Stats" />
      <DrawerLink to="/rules" label="Rules" />
      <DrawerLink to="/learn" label="Learn" />
      <DrawerLink to="/messages" label={messagesLabel} />
      <DrawerLink to="/profile" label="Profile" />
    </ul>
  );
}

/** Mirrors SidebarOperatorSection. */
function OperatorSection({ orgs }: { orgs: OperatorOrg[] }) {
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

/**
 * "My Match" drawer section — sits at the top of the nav. Instead of listing
 * every match at once, it shows small **filter chips** with counts ("Live 1",
 * "Makeup 2"); tapping a chip reveals that group's list. This keeps the drawer
 * glanceable: you read the counts without the rows always eating the space.
 *
 * Defaults: when there's a live/tonight match, the Live list auto-opens (you
 * see your match immediately); otherwise everything stays collapsed to just
 * chips, so a long makeup list never dumps itself. One list shows at a time.
 *
 * Data comes from the shared `useMyMatchSurfaces` hook. While still hydrating
 * (and no items yet) the header renders alone — a stable layout target.
 *
 * Future scope: a third "Future"/"Upcoming" chip can slot in here once the
 * detection query is extended; deliberately omitted for now.
 */
function MyMatchSection({ items, isHydrating }: { items: MyMatchDrawerItem[]; isHydrating: boolean }) {
  const liveItems = items.filter((i) => i.group === 'live');
  const makeupItems = items.filter((i) => i.group === 'makeup');

  // Radio behavior: exactly one group is always selected (no "off" state).
  // `explicit` is the user's pick; it falls back to the default (Live first,
  // else whatever's present) when null or when the picked group has emptied.
  const [explicit, setExplicit] = useState<'live' | 'makeup' | null>(null);

  if (!isHydrating && items.length === 0) return null;

  const isPresent = (g: 'live' | 'makeup') =>
    g === 'live' ? liveItems.length > 0 : makeupItems.length > 0;
  const defaultSel: 'live' | 'makeup' | null =
    liveItems.length > 0 ? 'live' : makeupItems.length > 0 ? 'makeup' : null;
  const open = explicit && isPresent(explicit) ? explicit : defaultSel;

  return (
    <div className="mb-4 border-b pb-4">
      {/* "My Match" stays left; the chip pair is grouped and centered in the
          remaining space. Both chips always render — a 0-count one is dimmed
          and disabled (Live stays put even on a no-live night). */}
      <div className="flex items-center px-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          My Match
        </h3>
        {items.length > 0 ? (
          <div className="flex flex-1 items-center justify-center gap-1.5">
            <MyMatchChip
              kind="live"
              label="Live"
              count={liveItems.length}
              active={open === 'live'}
              disabled={liveItems.length === 0}
              onClick={() => setExplicit('live')}
            />
            <MyMatchChip
              kind="makeup"
              label="Makeup"
              count={makeupItems.length}
              active={open === 'makeup'}
              disabled={makeupItems.length === 0}
              onClick={() => setExplicit('makeup')}
            />
          </div>
        ) : null}
      </div>

      {open === 'live' ? <MyMatchList items={liveItems} /> : null}
      {open === 'makeup' ? <MyMatchList items={makeupItems} /> : null}
    </div>
  );
}

/**
 * A small, slim filter chip. Radio-style: selecting it shows its group's list;
 * one chip is always selected. On phones (`< sm`) it collapses to an icon to
 * save room — the Radio "live" glyph for Live, an "MU" circle for Makeup — and
 * from `sm` up it shows the text label. A 0-count chip is disabled.
 */
function MyMatchChip({
  kind,
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  kind: 'live' | 'makeup';
  label: string;
  count: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const icon =
    kind === 'live' ? (
      <Radio className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <span
        aria-hidden="true"
        className="flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-bold leading-none"
      >
        MU
      </span>
    );

  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      loadingText="none"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      // Accessible name stays text-based even when only the icon shows on phones.
      aria-label={count > 0 ? `${label} ${count}` : label}
      className="h-6 gap-1 rounded-full px-2.5 text-[11px]"
    >
      <span className="flex items-center sm:hidden">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {count > 0 ? <span className="tabular-nums opacity-70">{count}</span> : null}
    </Button>
  );
}

/** The revealed list of match rows for the open chip. */
function MyMatchList({ items }: { items: MyMatchDrawerItem[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item) => (
        <li key={item.matchId}>
          <MyMatchRow item={item} />
        </li>
      ))}
    </ul>
  );
}

/** One match row — "My Team · vs Opponent · {Live | Today | Makeup (date)}".
 *  Tapping routes to the match's lineup page and closes the drawer. */
function MyMatchRow({ item }: { item: MyMatchDrawerItem }) {
  return (
    <SheetClose asChild>
      <Link
        to={item.destinationPath}
        className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10"
      >
        <span className="truncate font-medium">{item.teamName}</span>
        <span className="truncate text-muted-foreground">vs {item.opponentName}</span>
        <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
          {item.label}
        </span>
      </Link>
    </SheetClose>
  );
}

/** Two-letter initials from first + last; falls back to "?" — mirrors the
 *  helper in AppSidebar.tsx. */
function computeInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim()?.charAt(0) ?? '';
  const last = lastName?.trim()?.charAt(0) ?? '';
  return (`${first}${last}`.toUpperCase()) || '?';
}

/** Drawer nav link — visually identical to SidebarLink in AppSidebar.tsx
 *  (Simonis-blue text, hover tint, active-state highlight). Wrapped in
 *  SheetClose so taps auto-close the drawer. */
function DrawerLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <li>
      <SheetClose asChild>
        <Link
          to={to}
          className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10 ${
            isActive ? 'bg-primary/15 font-semibold' : ''
          }`}
        >
          {label}
        </Link>
      </SheetClose>
    </li>
  );
}
