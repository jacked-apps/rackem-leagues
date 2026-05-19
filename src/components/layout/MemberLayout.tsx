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
import { usePendingInvites } from '@/api/hooks';

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

  return (
    <>
      <PendingInvitesModal
        isOpen={showInvitesModal}
        onClose={() => setInvitesModalDismissed(true)}
        invites={pendingInvites}
      />

      <AppSidebar />
      <div className="pb-16 lg:pb-0 lg:ml-[var(--sidebar-width)]">
        <Outlet />
      </div>
      <BottomTabBar />
    </>
  );
}
