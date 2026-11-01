/**
 * @fileoverview AppDrawer — content of the global hamburger drawer.
 *
 * Mounted inside the Sheet portal owned by `PageHeader` (mobile only — desktop
 * has the persistent `<AppSidebar>` and the hamburger is `lg:hidden`).
 *
 * Signed in, it renders the SAME shared pieces as the sidebar
 * (`NavIdentityHeader` + `MemberNavSections`), with `inSheet` so every tap
 * closes the drawer. Signed out, it shows a minimal Home / About / Pricing /
 * Rules / Sign in list, since the drawer is the only nav on small screens.
 *
 * Theme picker and Sign Out live on the Profile page, not here — they're
 * infrequent and shouldn't crowd the everyday menu.
 *
 * Lazy-mounted by PageHeader (`{open ? <AppDrawer/> : null}`) so the menu's
 * data hooks only fire when the user actually opens it.
 */

import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { SheetClose, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { NavIdentityHeader } from './NavIdentityHeader';
import { MemberNavSections } from './MemberNavSections';
import { NavRow } from './NavRow';
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
        <SheetDescription>{isLoggedIn ? displayNameOf(member) : 'Not signed in'}</SheetDescription>
      </SheetHeader>

      <NavIdentityHeader inSheet />

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-4">
        {isLoggedIn ? <MemberNavSections inSheet /> : <PublicSection />}
      </nav>
    </>
  );
}

/** Signed out: Home / About / Pricing / Rules / Sign in. */
function PublicSection() {
  return (
    <ul className="space-y-1">
      <NavRow to="/" label="Home" inSheet />
      <NavRow to="/about" label="About" inSheet />
      <NavRow to="/pricing" label="Pricing" inSheet />
      <NavRow to="/rules" label="Rules" inSheet />
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
