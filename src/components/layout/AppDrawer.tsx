/**
 * @fileoverview AppDrawer — content of the global hamburger drawer.
 *
 * Mounted inside the Sheet portal owned by `PageHeader`. Renders three role-
 * aware branches based on auth state: logged-out, logged-in player, logged-in
 * operator. The drawer is the app's primary global navigation surface — the
 * dashboard remains the in-your-face home page; this drawer is a traveling
 * shortcut from any page to any root destination (and, for operators, to any
 * specific org's Dashboard / Create League / Reports).
 *
 * Key design notes (see docs/plans/2026-04-27-001-feat-global-header-nav-rework-plan.md):
 * - Stateless top-level component. Open/close state lives in PageHeader.
 * - Hooks fire only when the component is mounted, and PageHeader lazy-mounts
 *   AppDrawer only while the Sheet is open. So the drawer's data layer is
 *   dormant on every page where the user never opens the menu.
 * - Per-org Reports badges are owned by `OperatorOrgRow`, satisfying React's
 *   Rules of Hooks (hook count per render fixed by component shape).
 * - Drawer-internal `(N)` text suffixes for unread/pending counts. No dots
 *   or pills on the always-visible chrome.
 * - Operator section caps at 4 visible orgs (owners first, alphabetical staff
 *   next, "More on Dashboard →" overflow).
 */

import { Link } from 'react-router-dom';
import { LogOut, LogIn } from 'lucide-react';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { useUnreadMessageCount } from '@/api/hooks/useMessages';
import { OperatorOrgRow } from './OperatorOrgRow';

interface AppDrawerProps {
  /** Whether the parent Sheet is open. */
  open: boolean;
  /** Setter for the parent Sheet's open state. Used for actions like Sign Out
   *  that don't navigate via a Link (and therefore can't rely on SheetClose). */
  onOpenChange: (open: boolean) => void;
}

/** Cap on the number of operator orgs visible in the drawer. Realistic
 *  distribution: most LOs run 1; engaged LOs are staff on 1-3 others. */
const OPERATOR_ORG_CAP = 4;

/** Organization shape returned by useOrganizations — kept loose to tolerate
 *  the field set drifting (e.g., new role variants added later). */
interface OperatorOrg {
  id: string;
  organization_name?: string | null;
  position?: string | null;
}

/**
 * Sort orgs into "owned first, then staff alphabetical" and slice to the cap.
 * `position === 'owner'` → owned tier; everything else (`'admin'`, `'league_rep'`,
 * `null`, future variants) → staff tier.
 */
function pickVisibleOrgs(orgs: OperatorOrg[], cap: number): OperatorOrg[] {
  const owned = orgs
    .filter((o) => o.position === 'owner')
    .sort((a, b) => (a.organization_name ?? '').localeCompare(b.organization_name ?? ''));
  const staff = orgs
    .filter((o) => o.position !== 'owner')
    .sort((a, b) => (a.organization_name ?? '').localeCompare(b.organization_name ?? ''));

  return [...owned, ...staff].slice(0, cap);
}

export function AppDrawer({ onOpenChange }: AppDrawerProps) {
  const { isLoggedIn, logout } = useUser();
  const { member, canAccessLeagueOperatorFeatures } = useUserProfile();
  const isOperator = canAccessLeagueOperatorFeatures();

  const { organizations } = useOrganizations(member?.id);
  const { data: unreadCount = 0 } = useUnreadMessageCount(member?.id);

  // Brand text in the drawer header. Always rendered.
  const brandTitle = 'Rack ‘Em';

  // Identity line beneath the brand: full name when available, falls back to
  // email or a generic prompt.
  const identityLine = (() => {
    if (!isLoggedIn) return 'Not signed in';
    if (member?.first_name || member?.last_name) {
      return [member.first_name, member.last_name].filter(Boolean).join(' ');
    }
    return 'Signed in';
  })();

  const handleSignOut = () => {
    onOpenChange(false);
    logout();
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{brandTitle}</SheetTitle>
        <SheetDescription>{identityLine}</SheetDescription>
      </SheetHeader>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-4">
        {!isLoggedIn ? (
          <PublicSection />
        ) : (
          <>
            <PlayerSection unreadCount={unreadCount} />
            {isOperator ? <OperatorSection orgs={organizations as OperatorOrg[]} /> : null}
            <SignedInFooter onSignOut={handleSignOut} />
          </>
        )}
      </nav>
    </>
  );
}

/**
 * Logged-out: Home / About / Pricing / Rules / Sign in.
 * The Sign-in entry here is in addition to the right-slot Sign-in button in
 * PageHeader; the drawer item ensures the action is reachable even on routes
 * where the right slot is suppressed (none today, but future-proofing).
 */
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
            className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        </SheetClose>
      </li>
    </ul>
  );
}

/** Logged-in player roots: Dashboard / My Teams / Stats / Messages / Profile. */
function PlayerSection({ unreadCount }: { unreadCount: number }) {
  const messagesLabel = unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages';
  return (
    <ul className="space-y-1">
      <DrawerLink to="/dashboard" label="Dashboard" />
      <DrawerLink to="/my-teams" label="My Teams" />
      <DrawerLink to="/stats" label="Stats" />
      <DrawerLink to="/messages" label={messagesLabel} />
      <DrawerLink to="/profile" label="Profile" />
    </ul>
  );
}

/**
 * Operator section: caps at OPERATOR_ORG_CAP visible orgs. Single-org path
 * renders three flat links for the only org; multi-org renders a collapsible
 * group per org.
 */
function OperatorSection({ orgs }: { orgs: OperatorOrg[] }) {
  // While orgs are loading or empty, render nothing — keeps the drawer
  // skeleton-free and never crashes.
  if (!orgs || orgs.length === 0) return null;

  const visible = pickVisibleOrgs(orgs, OPERATOR_ORG_CAP);
  const hasOverflow = orgs.length > OPERATOR_ORG_CAP;
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
      {hasOverflow ? (
        <SheetClose asChild>
          <Link
            to="/dashboard"
            className="mt-2 flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            More on Dashboard →
          </Link>
        </SheetClose>
      ) : null}
    </div>
  );
}

/** Sign Out is a mutation, not a route. Calls onSignOut directly. */
function SignedInFooter({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="mt-6 border-t pt-4">
      <Button
        type="button"
        variant="ghost"
        loadingText="none"
        onClick={onSignOut}
        className="w-full justify-start gap-2 px-3 text-sm"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

/** Helper: a drawer link wrapped in SheetClose so it auto-closes on tap. */
function DrawerLink({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <SheetClose asChild>
        <Link
          to={to}
          className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm hover:bg-accent"
        >
          {label}
        </Link>
      </SheetClose>
    </li>
  );
}
