/**
 * @fileoverview OperatorDashboard Component
 * Main dashboard for league operators with access to all operator-specific features
 */
import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUserProfile, useOrganization } from '@/api/hooks';
import { DashboardCard } from '@/components/operator/DashboardCard';
import { ActiveLeagues } from '@/components/operator/ActiveLeagues';
import { QuickStatsCard } from '@/components/operator/QuickStatsCard';
import { OrganizationStaffCard } from '@/components/operator/OrganizationStaffCard';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Settings, BookOpen, Video, MessageCircle, Phone, Flag, Wrench } from 'lucide-react';
import { usePendingReportsCount } from '@/hooks/usePendingReportsCount';
import { JoinRequestList } from '@/onboarding/components/JoinRequestList';

/**
 * OperatorDashboard Component
 *
 * Central hub for league operators that provides:
 * - Quick access to league management tools
 * - Overview of active leagues and upcoming events
 * - Statistics and performance metrics
 * - Links to create new leagues and manage existing ones
 *
 * This dashboard is only accessible to users with 'league_operator' role
 *
 * TODO: TanStack Query Caching Issue
 * When creating a new league, the ActiveLeagues component doesn't show the new league
 * until page refresh due to TanStack Query cache. Need to add refetchOnMount or
 * invalidate queries after league creation to show newly created leagues immediately.
 * This affects the league list display - stale cache shows old data.
 */
export const OperatorDashboard: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { member } = useUserProfile();
  const { count: pendingReportsCount } = usePendingReportsCount(orgId);

  // Closes LIST_FOR_ED #8 — React Router doesn't reset window scroll
  // on navigation, so coming from a scrolled-down page (e.g. a long
  // player-management list) would land the user partway down the
  // OperatorDashboard. Force scroll-to-top on mount. No global
  // <ScrollToTop> handler because some pages (wizards, scroll-anchor
  // navigation) intentionally manage their own scroll state.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [orgId]);

  // Fetch organization data
  const { organization, loading: orgLoading } = useOrganization(orgId!);

  if (orgLoading || !organization) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <p>Loading organization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo="/my-teams"
        backLabel="Back to My Teams"
        title={`${organization.organization_name} Dashboard`}
        subtitle={`Welcome back, ${member?.first_name}! Manage your leagues and grow the pool community.`}
      />
      <div className="container mx-auto px-4 max-w-7xl py-8">
        {/* Onboarding cascade: pending join requests across every team in this
            org. Stays visible (with an empty state) so the operator can always
            see the surface, even when nothing is pending. */}
        <div className="mb-6">
          <JoinRequestList
            title="Join requests"
            emptyHint="No pending join requests right now. When someone taps a team invite link and asks to join, they'll appear here for you to approve."
          />
        </div>

        {/* Main Grid - All content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Row 1 - Quick Actions */}
          <DashboardCard
            icon={<MessageSquare className="h-6 w-6" />}
            iconColor="text-highlight"
            title="Messaging"
            description="Send messages and announcements"
            buttonText="Open Messages"
            linkTo="/messages"
          />

          <DashboardCard
            icon={<Users className="h-6 w-6" />}
            iconColor="text-success"
            title="Manage Players"
            description="View registrations and player stats"
            buttonText="View Players"
            linkTo={`/manage-players/${organization.id}`}
          />

          <DashboardCard
            icon={<Flag className="h-6 w-6" />}
            iconColor="text-destructive"
            title="Reports Management"
            description="Review and manage user reports"
            buttonText="View Reports"
            linkTo={`/operator-reports/${orgId}`}
            badgeCount={pendingReportsCount}
          />

          <DashboardCard
            icon={<Wrench className="h-6 w-6" />}
            iconColor="text-primary"
            title="Scoring Workshop"
            description="Build pieces of a Scoring System — one room per module"
            buttonText="Open Workshop"
            linkTo="/operator/scoring-workshop"
          />

          {/* Row 2 - Active Leagues (2 cols) and Sidebar (1 col) */}
          <div className="lg:col-span-2">
            <ActiveLeagues operatorId={organization.id} />
          </div>

          <div className="space-y-6">
            {/* Organization Settings */}
            <DashboardCard
              icon={<Settings className="h-6 w-6" />}
              iconColor="text-primary"
              title="Organization Settings"
              description="Edit your contact info and address"
              buttonText="Manage Organization"
              linkTo={`/operator-settings/${orgId}`}
            />

            {/* Quick Stats */}
            <QuickStatsCard operatorId={organization.id} />

            {/* Organization Staff */}
            <OrganizationStaffCard
              organizationId={organization.id}
              currentMemberId={member?.id || ''}
            />

            {/* Help & Resources */}
            <Card className="bg-info/10 border-info/40">
              <CardHeader>
                <CardTitle className="text-lg text-info">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <Link to="/learn" className="flex items-center gap-2 text-info hover:text-info/80 transition-colors">
                    <BookOpen className="h-4 w-4" />
                    Operator Handbook
                  </Link>
                  <Link to="#" className="flex items-center gap-2 text-info hover:text-info/80 transition-colors">
                    <Video className="h-4 w-4" />
                    Video Tutorials
                  </Link>
                  <Link to="#" className="flex items-center gap-2 text-info hover:text-info/80 transition-colors">
                    <MessageCircle className="h-4 w-4" />
                    Community Forum
                  </Link>
                  <Link to="#" className="flex items-center gap-2 text-info hover:text-info/80 transition-colors">
                    <Phone className="h-4 w-4" />
                    Contact Support
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperatorDashboard;
