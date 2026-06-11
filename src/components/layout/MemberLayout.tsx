/**
 * @fileoverview Shared layout for authenticated member and operator pages.
 *
 * Renders the persistent navigation surfaces that wrap all authenticated
 * page content:
 * - Desktop (`lg+`): persistent left sidebar
 * - Mobile (`<lg`): fixed bottom tab bar
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

      <AppSidebar />
      {/* Mobile bottom padding must CLEAR the fixed bottom tab bar (4rem,
          `--tab-bar-height`) with breathing room — `pb-16` (exactly 4rem) left
          zero gap, so page action buttons (Save / Continue / etc.) at the
          bottom of a page sat flush against or under the bar. `pb-24` (6rem)
          gives ~2rem clearance app-wide. Desktop uses the sidebar, no bar. */}
      <div className="pb-24 lg:pb-0 lg:ml-[var(--sidebar-width)]">
        <Outlet />
      </div>
      <BottomTabBar />
    </>
  );
}
