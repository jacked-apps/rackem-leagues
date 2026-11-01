/**
 * @fileoverview Persistent desktop sidebar for `lg+` viewports.
 *
 * Always visible on desktop, fixed to the left of page content. Its content is
 * the SAME as the phone drawer's — both render `NavIdentityHeader` (logo +
 * profile row) and `MemberNavSections` (My Match, Favorites, Non-league, Info,
 * Operator) — so the two menus can't drift. The only difference is the shell:
 * the sidebar is an `<aside>`, the drawer lives inside a Sheet.
 *
 * Signed-out visitors (on public pages that sit inside MemberLayout, like
 * Rules) see just the logo.
 */

import { useUser } from '@/context/useUser';
import { NavIdentityHeader } from './NavIdentityHeader';
import { MemberNavSections } from './MemberNavSections';

export function AppSidebar() {
  const { isLoggedIn } = useUser();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col border-r bg-background lg:flex"
      style={{ top: 'var(--env-banner-height, 0px)' }}
    >
      <NavIdentityHeader />
      <nav aria-label="Sidebar navigation" className="flex-1 overflow-y-auto p-4">
        {isLoggedIn ? <MemberNavSections /> : null}
      </nav>
    </aside>
  );
}
