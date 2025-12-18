/**
 * @fileoverview OperatorDashboard Component
 * Main dashboard for league operators with access to all operator-specific features
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUserProfile, useOrganization } from '@/api/hooks';
import { DashboardCard } from '@/components/operator/DashboardCard';
import { ActiveLeagues } from '@/components/operator/ActiveLeagues';
import { QuickStatsCard } from '@/components/operator/QuickStatsCard';
import { OrganizationStaffCard } from '@/components/operator/OrganizationStaffCard';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Settings, BookOpen, Video, MessageCircle, Phone, Flag } from 'lucide-react';
import { usePendingReportsCount } from '@/hooks/usePendingReportsCount';

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

  // Fetch organization data
  const { organization, loading: orgLoading } = useOrganization(orgId!);

  if (orgLoading || !organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading organization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo="/dashboard"
        backLabel="Back to Player Dashboard"
        title={`${organization.organization_name} Dashboard`}
        subtitle={`Welcome back, ${member?.first_name}! Manage your leagues and grow the pool community.`}
      />
      <div className="container mx-auto px-4 max-w-7xl py-8">
        {/* Main Grid - All content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Row 1 - Quick Actions */}
          <DashboardCard
            icon={<MessageSquare className="h-6 w-6" />}
            iconColor="text-purple-600"
            title="Messaging"
            description="Send messages and announcements"
            buttonText="Open Messages"
            linkTo="/messages"
          />

          <DashboardCard
            icon={<Users className="h-6 w-6" />}
            iconColor="text-green-600"
            title="Manage Players"
            description="View registrations and player stats"
            buttonText="View Players"
            linkTo={`/manage-players/${organization.id}`}
          />

          <DashboardCard
            icon={<Flag className="h-6 w-6" />}
            iconColor="text-red-600"
            title="Reports Management"
            description="Review and manage user reports"
            buttonText="View Reports"
            linkTo={`/operator-reports/${orgId}`}
            badgeCount={pendingReportsCount}
          />

          {/* Row 2 - Active Leagues (2 cols) and Sidebar (1 col) */}
          <div className="lg:col-span-2">
            <ActiveLeagues operatorId={organization.id} />
          </div>

          <div className="space-y-6">
            {/* Organization Settings */}
            <DashboardCard
              icon={<Settings className="h-6 w-6" />}
              iconColor="text-indigo-600"
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
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-blue-900">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <Link to="#" className="flex items-center gap-2 text-blue-700 hover:text-blue-900">
                    <BookOpen className="h-4 w-4" />
                    Operator Handbook
                  </Link>
                  <Link to="#" className="flex items-center gap-2 text-blue-700 hover:text-blue-900">
                    <Video className="h-4 w-4" />
                    Video Tutorials
                  </Link>
                  <Link to="#" className="flex items-center gap-2 text-blue-700 hover:text-blue-900">
                    <MessageCircle className="h-4 w-4" />
                    Community Forum
                  </Link>
                  <Link to="#" className="flex items-center gap-2 text-blue-700 hover:text-blue-900">
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
