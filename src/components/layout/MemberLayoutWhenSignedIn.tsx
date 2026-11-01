/**
 * @fileoverview Layout for PUBLIC pages that members also reach from the nav.
 *
 * Some pages are public on purpose (What's New: someone deciding whether to
 * sign up can see a record of steady work), but the member sidebar and drawer
 * link to them too. Rendered bare, a member who taps that link lands on a page
 * with no sidebar or tab bar — the door is in the nav, the room has none.
 *
 * So: a signed-in member gets the full `MemberLayout` (sidebar + tab bar);
 * anyone else gets the page alone, exactly as before. While the profile is
 * still loading the page renders bare, then the nav appears — no spinner, so
 * a signed-out visitor never waits on a check that doesn't apply to them.
 */

import { Outlet } from 'react-router-dom';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks';
import { MemberLayout } from './MemberLayout';

/**
 * Route layout: `MemberLayout` for a signed-in member, a plain `<Outlet/>`
 * otherwise. Use as the `element` of a route group holding public pages.
 *
 * @example
 * { element: <MemberLayoutWhenSignedIn />, children: [{ path: 'whats-new', element: <WhatsNewPage /> }] }
 */
export function MemberLayoutWhenSignedIn() {
  const { user } = useUser();
  const { member } = useUserProfile();

  // Both checks: the nav links to member pages, which need a member record —
  // a signed-in account that hasn't finished its profile isn't a member yet.
  return user && member ? <MemberLayout /> : <Outlet />;
}
