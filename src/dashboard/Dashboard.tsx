/**
 * @fileoverview Dashboard Component
 * Mobile-first dashboard with navigation to player features.
 *
 * Cache Reset Behavior:
 * When the Dashboard mounts, all cached data is marked as stale (but not refetched).
 * This ensures that when users navigate from Dashboard to other pages, they get fresh data.
 * This provides a natural "reset point" for the app's data cache.
 *
 * Pending Invites:
 * On mount, checks for any pending placeholder player invites for the current user.
 * If found, displays a modal allowing them to claim their player profile or dismiss.
 */
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '../context/useUser';
import { useUserProfile, usePendingInvites } from '@/api/hooks';
import { useOrganizations } from '@/api/hooks/useOrganizations';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { PendingInvitesModal } from '@/components/modals/PendingInvitesModal';
import { Users, MessageSquare, Trophy, Building2, Settings, Radio } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useUser();
  const { member, loading } = useUserProfile();
  const { organizations, loading: orgsLoading } = useOrganizations(member?.id);
  const { pendingInvites, hasPendingInvites, loading: invitesLoading } = usePendingInvites();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Track which org button is loading during navigation
  const [navigatingOrgId, setNavigatingOrgId] = useState<string | null>(null);
  // Track whether the pending invites modal has been dismissed this session
  const [invitesModalDismissed, setInvitesModalDismissed] = useState(false);
  // Show modal when invites are loaded and there are pending invites
  const showInvitesModal = !invitesLoading && hasPendingInvites && !invitesModalDismissed;

  /**
   * Mark all cached data as stale when Dashboard mounts.
   * This doesn't trigger any refetches - it just marks data as stale so that
   * when users navigate to other pages, those pages will fetch fresh data.
   * Excludes 'currentMember' and 'organizations' since we're using them on this page.
   */
  useEffect(() => {
    queryClient.invalidateQueries({
      // Mark all queries as stale
      predicate: (query) => {
        // Don't invalidate the queries we're actively using on Dashboard
        const key = query.queryKey[0];
        if (key === 'members' || key === 'organizations') return false;
        return true;
      },
      // Don't refetch - just mark as stale
      refetchType: 'none',
    });
  }, [queryClient]);

  if (loading || orgsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading your dashboard...</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Error: No member record found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pending Invites Modal - shown when user has unclaimed invites */}
      <PendingInvitesModal
        isOpen={showInvitesModal}
        onClose={() => setInvitesModalDismissed(true)}
        invites={pendingInvites}
      />

      <PageHeader
        backTo="/"
        backLabel="Home"
        title={`Welcome, ${member.first_name}!`}
        subtitle={user?.email}
      />

      {/* Main Content - Mobile First */}
      <main className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* PWA Install Prompt - only shows if app is installable */}
        <PWAInstallPrompt />

        {/* Quick Action Cards */}
        <div className="space-y-4">
          {/* My Teams */}
          <Link to="/my-teams">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-lg text-gray-900">My Teams</h2>
                    <p className="text-sm text-gray-600">View leagues, teams, and schedules</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Live Matches — peek at any match currently in progress in any
              league the player is on a team in. Cross-league view; scoping
              to team membership is enforced by the query. */}
          <Link to="/live">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <Radio className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-lg text-gray-900">Live Matches</h2>
                    <p className="text-sm text-gray-600">See what's happening in your leagues right now</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Messages */}
          <Link to="/messages">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-lg text-gray-900">Messages</h2>
                    <p className="text-sm text-gray-600">Chat with teammates and league</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Player Settings */}
          <Link to="/profile">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Settings className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-lg text-gray-900">Player Settings</h2>
                    <p className="text-sm text-gray-600">Manage your profile and preferences</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Tournaments (Coming Soon) */}
          <Card className="opacity-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Trophy className="h-6 w-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-lg text-gray-400">Tournaments</h2>
                  <p className="text-sm text-gray-400">Coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* League Operator Section - Multi-Org */}
        {(member.role === 'league_operator' || member.role === 'developer') && organizations.length > 0 && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg">Your Organizations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {organizations.map((org) => (
                <Button
                  key={org.id}
                  variant="outline"
                  className="w-full justify-between hover:bg-blue-100"
                  disabled={navigatingOrgId !== null}
                  onClick={() => {
                    setNavigatingOrgId(org.id);
                    navigate(`/operator-dashboard/${org.id}`);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">
                      {navigatingOrgId === org.id ? 'Loading...' : org.organization_name}
                    </span>
                  </div>
                  {navigatingOrgId !== org.id && (
                    <span className="text-xs px-2 py-1 bg-blue-100 rounded">
                      {org.position === 'owner' ? 'Owner' : 'Admin'}
                    </span>
                  )}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Become League Operator CTA - Only for regular players */}
        {member.role === 'player' && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Run Your Own League?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Become a league operator and manage pool leagues at your local venue
              </p>
              <Link to="/become-league-operator">
                <Button variant="outline" className="w-full">
                  Learn More
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};