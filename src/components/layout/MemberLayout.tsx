/**
 * @fileoverview Shared layout for authenticated member and operator pages.
 *
 * Renders the persistent navigation surfaces that wrap all authenticated
 * page content:
 * - Desktop (`lg+`): persistent left sidebar
 * - Mobile (`<lg`): fixed bottom tab bar
 * Both are shown to signed-in members only; public pages inside this layout
 * render full-width with no menu for signed-out visitors.
 *
 * Also hosts global member features that were previously on the Dashboard:
 * - Pending invites modal (checks for unclaimed player invites on mount)
 *
 * Individual pages still render their own `<PageHeader>` with page-specific
 * props (title, backTo, subtitle, etc.). This layout does NOT own the header
 * — it only owns the sidebar and tab bar flanking the `<Outlet/>`.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';
import { AppSidebar } from './AppSidebar';
import { PendingInvitesModal } from '@/components/modals/PendingInvitesModal';
import { ApprovedJoinModal } from '@/components/modals/ApprovedJoinModal';
import { usePendingInvites } from '@/api/hooks';
import { useUser } from '@/context/useUser';
import {
  useApprovedJoinRequests,
  useAcknowledgeJoinRequest,
} from '@/api/hooks/useApprovedJoinRequests';

/**
 * Shared layout wrapper for all authenticated (member + operator) routes.
 *
 * Mobile: bottom padding clears the fixed tab bar.
 * Desktop: left margin clears the fixed sidebar.
 */
export function MemberLayout() {
  const { pendingInvites, hasPendingInvites, loading: invitesLoading } = usePendingInvites();
  const [invitesModalDismissed, setInvitesModalDismissed] = useState(false);
  const showInvitesModal = !invitesLoading && hasPendingInvites && !invitesModalDismissed;

  // Onboarding cascade: tell a joiner the moment they're approved (even if they
  // closed the tab) and route them to their team. One at a time.
  const { data: approvedJoins } = useApprovedJoinRequests();
  const acknowledge = useAcknowledgeJoinRequest();
  const nextApproved = approvedJoins?.[0] ?? null;

  // The menu is for members. Public pages also sit in this layout (Home,
  // Rules, What's New…) so members keep their menu there, but a signed-out
  // visitor would only see an empty sidebar and tabs that bounce to sign-in,
  // so they get neither (Ed, 2026-11-01). While the session is still being
  // checked we keep the nav, so a signed-in member's page doesn't jump
  // sideways on every refresh.
  const { isLoggedIn, loading: authLoading } = useUser();
  const showNav = isLoggedIn || authLoading;

  return (
    <>
      <PendingInvitesModal
        isOpen={showInvitesModal}
        onClose={() => setInvitesModalDismissed(true)}
        invites={pendingInvites}
      />

      <ApprovedJoinModal
        request={nextApproved}
        onAcknowledge={(id) => acknowledge.mutate(id)}
      />

      {showNav ? <AppSidebar /> : null}
      {/* Mobile bottom padding must CLEAR the fixed bottom tab bar (4rem,
          `--tab-bar-height`) with breathing room — `pb-16` (exactly 4rem) left
          zero gap, so page action buttons (Save / Continue / etc.) at the
          bottom of a page sat flush against or under the bar. `pb-24` (6rem)
          gives ~2rem clearance app-wide. Desktop uses the sidebar, no bar.
          Signed-out visitors get neither, so the page uses the full width. */}
      <div className={showNav ? 'pb-24 lg:pb-0 lg:ml-[var(--sidebar-width)]' : undefined}>
        <Outlet />
      </div>
      {showNav ? <BottomTabBar /> : null}
    </>
  );
}
