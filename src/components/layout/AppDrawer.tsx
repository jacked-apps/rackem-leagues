/**
 * @fileoverview AppDrawer — content of the global hamburger drawer.
 *
 * Mounted inside the Sheet portal owned by `PageHeader` (mobile only — desktop
 * has the persistent `<AppSidebar>` and the hamburger is `lg:hidden`).
 *
 * It renders the SAME shared pieces as the sidebar (`NavIdentityHeader` +
 * `MemberNavSections`), with `inSheet` so every tap closes the drawer.
 *
 * Members only: PageHeader hides the hamburger for signed-out visitors (Ed,
 * 2026-11-01), so there's no signed-out list here any more. The header's
 * Sign in button is how a visitor gets in.
 *
 * Theme picker and Sign Out live on the Profile page, not here — they're
 * infrequent and shouldn't crowd the everyday menu.
 *
 * Lazy-mounted by PageHeader (`{open ? <AppDrawer/> : null}`) so the menu's
 * data hooks only fire when the user actually opens it.
 */

import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { NavIdentityHeader } from './NavIdentityHeader';
import { MemberNavSections } from './MemberNavSections';
import { displayNameOf } from './navHelpers';

interface AppDrawerProps {
  /** Whether the parent Sheet is open. */
  open: boolean;
  /** Setter for the parent Sheet's open state. */
  onOpenChange: (open: boolean) => void;
}

export function AppDrawer(_props: AppDrawerProps) {
  const { isLoggedIn } = useUser();
  const { member } = useUserProfile();

  return (
    <>
      {/* Accessible label for the Sheet — visually hidden because the logo
          and profile row carry the visible identity. */}
      <SheetHeader className="sr-only">
        <SheetTitle>Rack &lsquo;Em Leagues</SheetTitle>
        <SheetDescription>{displayNameOf(member)}</SheetDescription>
      </SheetHeader>

      <NavIdentityHeader inSheet />

      {/* Guard for the instant a session ends while the drawer is open. */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-4">
        {isLoggedIn ? <MemberNavSections inSheet /> : null}
      </nav>
    </>
  );
}
