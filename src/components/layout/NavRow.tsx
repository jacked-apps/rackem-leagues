/**
 * @fileoverview One link row in the signed-in menu, shared by the desktop
 * sidebar and the phone drawer (it replaces the old `SidebarLink` and
 * `DrawerLink`, which were identical apart from the drawer's SheetClose).
 *
 * Also exports `MaybeSheetClose`: in the drawer (`inSheet`), a tap must close
 * the drawer, so the child is wrapped in `SheetClose`; the sidebar never closes.
 */

import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SheetClose } from '@/components/ui/sheet';

/**
 * Wrap a single clickable element in `SheetClose` when it lives in the drawer.
 *
 * @param inSheet True inside the drawer's Sheet; false/omitted in the sidebar.
 * @param children Exactly one element (a Link) — SheetClose uses `asChild`.
 */
export function MaybeSheetClose({ inSheet, children }: { inSheet?: boolean; children: ReactElement }) {
  return inSheet ? <SheetClose asChild>{children}</SheetClose> : children;
}

/**
 * A menu link with the active-page highlight. Home (`/`) only matches itself;
 * other paths also match their sub-pages (`/rules/8-ball/3` lights Rules).
 *
 * @param to Route to open.
 * @param label Visible text, including any "(N)" / "(New)" marker.
 * @param inSheet True in the drawer, so a tap closes it.
 */
export function NavRow({ to, label, inSheet }: { to: string; label: string; inSheet?: boolean }) {
  const { pathname } = useLocation();
  const isActive = pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));

  return (
    <li>
      <MaybeSheetClose inSheet={inSheet}>
        <Link
          to={to}
          aria-current={isActive ? 'page' : undefined}
          className={`flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-primary transition-colors hover:bg-primary/10 ${
            isActive ? 'bg-primary/15 font-semibold' : ''
          }`}
        >
          {label}
        </Link>
      </MaybeSheetClose>
    </li>
  );
}
