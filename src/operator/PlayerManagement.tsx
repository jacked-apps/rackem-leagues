/**
 * @fileoverview PlayerManagement Component
 *
 * Operator tool for viewing and managing player information and starting handicaps.
 * Allows operators to:
 * - View all players in their leagues
 * - See player details (leagues, teams, game counts)
 * - Set starting handicaps for players with limited game history
 * - Authorize new players via the AuthorizeNewPlayersCard component
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayerCombobox } from '@/components/PlayerCombobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { InfoButton } from '@/components/InfoButton';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import { TeamNameLink } from '@/components/TeamNameLink';
import { AuthorizeNewPlayersCard } from '@/components/operator/AuthorizeNewPlayersCard';
import { PendingInvitesList } from '@/components/operator/PendingInvitesList';
import { OrgPlaceholdersCard } from '@/operator/components/OrgPlaceholdersCard';
import { RecordDuesModal } from '@/components/RecordDuesModal';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Users, AlertCircle, Mail } from 'lucide-react';
import { useIsDeveloper } from '@/api/hooks/useUserProfile';
import { getAllLeagueOperators } from '@/api/queries/operators';
import { useOrganizationInvites } from '@/api/hooks/useOrganizationInvites';
import { logger } from '@/utils/logger';
import {
  fetchPlayerDetails,
  updatePlayerStartingHandicaps,
  isPlayerAuthorized,
} from '@/api/queries/players';
import { supabase } from '@/supabaseClient';

/**
 * PlayerManagement Component
 *
 * Main operator page for player management.
 * Displays player count, selection dropdown, and detailed player information.
 */
export const PlayerManagement: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const isDeveloper = useIsDeveloper();
  const queryClient = useQueryClient();

  const [impersonatedOperatorId, setImpersonatedOperatorId] =
    useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [handicap3v3, setHandicap3v3] = useState<string>('0');
  const [handicap5v5, setHandicap5v5] = useState<string>('40');
  const [isHandicapOpen, setIsHandicapOpen] = useState<boolean>(false);
  const [showDuesModal, setShowDuesModal] = useState<boolean>(false);
  const { ConfirmDialogComponent } = useConfirmDialog();

  // Use impersonated operator ID if developer has selected one, otherwise use orgId from URL
  const operatorId = impersonatedOperatorId || orgId;

  // Fetch organization invites
  const {
    pendingInvites,
    pendingCount,
    expiredCount,
    claimedCount,
    loading: invitesLoading,
    cancelInvite,
    isCancelling,
  } = useOrganizationInvites(operatorId);

  // Fetch all league operators (for developer impersonation)
  const { data: allOperators } = useQuery({
    queryKey: ['allLeagueOperators'],
    queryFn: getAllLeagueOperators,
    enabled: isDeveloper,
  });

  // Fetch player stats using RPC
  const { data: playerStats } = useQuery({
    queryKey: ['operatorPlayerStats', operatorId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_operator_player_stats', {
        p_org_id: operatorId,
      });
      if (error) throw error;
      return data as {
        total_players: number;
        active_players: number;
        placeholders: number;
        identified_placeholders: number;
      };
    },
    enabled: !!operatorId,
  });

  // PlayerCombobox now handles player fetching internally based on filter selection

  // Fetch selected player details
  const { data: playerDetailsData, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['playerDetails', selectedPlayerId, operatorId],
    queryFn: () => fetchPlayerDetails(selectedPlayerId, operatorId!),
    enabled: !!selectedPlayerId && !!operatorId,
  });

  const playerDetails = playerDetailsData?.data;

  /**
   * Authorization vs Established:
   * - AUTHORIZED: Player has starting handicaps set by an operator (manual approval for restricted leagues)
   * - ESTABLISHED: Player has 15+ games played (system can calculate handicap automatically)
   * - If ESTABLISHED, player is automatically AUTHORIZED (no manual approval needed)
   *
   * The warning card only shows for players who are NEITHER established NOR have starting handicaps set.
   */
  const isEstablishedPlayer = playerDetails
    ? playerDetails.gameCounts.total >= 15
    : false;

  const playerIsAuthorized = playerDetails
    ? isPlayerAuthorized(playerDetails) || isEstablishedPlayer
    : true;

  // Update starting handicaps mutation
  const updateHandicapsMutation = useMutation({
    mutationFn: ({
      playerId,
      h3v3,
      h5v5,
    }: {
      playerId: string;
      h3v3: number;
      h5v5: number;
    }) => updatePlayerStartingHandicaps(playerId, h3v3, h5v5),
    onSuccess: () => {
      // Invalidate player details query to refetch
      queryClient.invalidateQueries({
        queryKey: ['playerDetails', selectedPlayerId, operatorId],
      });
      // Invalidate unauthorized players list (player is now authorized)
      queryClient.invalidateQueries({
        queryKey: ['unauthorizedPlayers', operatorId],
      });
      toast.success('Starting handicaps updated successfully!');
      // Close the collapsible section
      setIsHandicapOpen(false);
    },
    onError: (error) => {
      logger.error('Error updating handicaps', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to update starting handicaps. Please try again.');
    },
  });

  // Update form fields when player details load
  useEffect(() => {
    if (playerDetails) {
      setHandicap3v3(String(playerDetails.starting_handicap_3v3 ?? 0));
      setHandicap5v5(String(playerDetails.starting_handicap_5v5 ?? 40));
    }
  }, [playerDetails]);

  // Handle save
  const handleSave = () => {
    if (!selectedPlayerId) return;

    const h3v3 = parseFloat(handicap3v3);
    const h5v5 = parseFloat(handicap5v5);

    // Validate ranges
    if (isNaN(h3v3) || h3v3 < -2 || h3v3 > 2) {
      toast.error('Starting Handicap (3v3) must be between -2 and 2');
      return;
    }

    if (isNaN(h5v5) || h5v5 < 0 || h5v5 > 100) {
      toast.error('Starting Handicap (5v5) must be between 0 and 100');
      return;
    }

    updateHandicapsMutation.mutate({
      playerId: selectedPlayerId,
      h3v3,
      h5v5,
    });
  };

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={`/operator-dashboard/${operatorId}`}
        backLabel="Back to Organization"
        title="Player Management"
        subtitle="View player information and manage starting handicaps"
      />

      <div className="container mx-auto px-0 lg:px-4 py-8 max-w-2xl space-y-6">
        {/* Developer Impersonation Dropdown */}
        {isDeveloper && allOperators && allOperators.length > 0 && (
          <Card className="rounded-none lg:rounded-xl bg-warning/10 border-warning/40">
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="impersonate-operator"
                  className="text-sm font-semibold text-warning"
                >
                  Developer Mode: Impersonate Operator
                </Label>
                <Select
                  value={impersonatedOperatorId}
                  onValueChange={setImpersonatedOperatorId}
                >
                  <SelectTrigger id="impersonate-operator">
                    <SelectValue placeholder="Select an operator to impersonate..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Use My Own Account</SelectItem>
                    {allOperators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.organization_name} ({op.first_name} {op.last_name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Player Count & Selection Card */}
        <Card className="rounded-none lg:rounded-xl relative">
          <div className="absolute top-3 right-3">
            <InfoButton title="Player Statistics" align="right">
              <div className="space-y-2">
                <p><strong>Active Players:</strong> Players currently on teams in active or upcoming seasons.</p>
                <p><strong>Total:</strong> All players who have ever been on a team in your organization.</p>
                <p><strong>Alias:</strong> Placeholder players created by captains or operators who have not yet registered an account.</p>
                <p><strong>ID'd:</strong> Alias players who have an email address on file and can receive an invite to register.</p>
              </div>
            </InfoButton>
          </div>
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Player Stats */}
              <div className="flex items-center gap-6">
                {/* Main stat: Active Players */}
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-success/15 rounded-lg">
                    <Users className="h-8 w-8 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Players</p>
                    <p className="text-3xl font-bold">{playerStats?.active_players ?? '-'}</p>
                  </div>
                </div>

                {/* Secondary stats */}
                <div className="border-l pl-6 grid grid-cols-3 gap-x-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{playerStats?.total_players ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Alias</p>
                    <p className="text-xl font-bold text-warning">{playerStats?.placeholders ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ID'd</p>
                    <p className="text-xl font-bold text-info">{playerStats?.identified_placeholders ?? '-'}</p>
                  </div>
                </div>
              </div>

              {/* Player Selection */}
              <div className="flex-1 flex flex-col justify-center">
                <Label htmlFor="player-select" className="mb-2">
                  Select Player
                </Label>
                <PlayerCombobox
                  filters={{ myOrg: operatorId, active: operatorId }}
                  defaultFilter="myOrg"
                  value={selectedPlayerId}
                  onValueChange={setSelectedPlayerId}
                  placeholder="Search for a player..."
                  showClear={true}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Player Details */}
        {selectedPlayerId && (
          <>
            {isLoadingDetails ? (
              <Card className="rounded-none lg:rounded-xl">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Loading player details...
                </CardContent>
              </Card>
            ) : playerDetails ? (
              <>
                {/* Player Information */}
                <Card className="rounded-none lg:rounded-xl">
                  <CardHeader className="p-4 lg:p-6 pb-3">
                    <CardTitle>Player Information</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0">
                    <div className="grid grid-cols-1 min-[320px]:grid-cols-2 gap-x-2 gap-y-3">
                      {/* Status - indicates if player is registered or an alias (spans full width) */}
                      <div className="col-span-full">
                        <p className="text-xs text-muted-foreground uppercase mb-1">
                          Status
                        </p>
                        <p className={`font-medium ${
                          playerDetails.user_id
                            ? 'text-success'
                            : playerDetails.email
                              ? 'text-warning'
                              : 'text-muted-foreground'
                        }`}>
                          {playerDetails.user_id
                            ? 'Registered'
                            : playerDetails.email
                              ? "Alias (ID'd)"
                              : 'Alias'}
                        </p>
                      </div>

                      {/* Name */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">
                          Name
                        </p>
                        <PlayerNameLink
                          playerId={playerDetails.id}
                          playerName={`${playerDetails.first_name} ${playerDetails.last_name}`}
                          className="font-medium"
                        />
                      </div>

                      {/* Nickname */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">
                          Nickname
                        </p>
                        <p className="font-medium text-foreground">
                          {playerDetails.nickname || '-'}
                        </p>
                      </div>

                      {/* Phone */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">
                          Phone
                        </p>
                        <p className="font-medium text-foreground">
                          {playerDetails.phone}
                        </p>
                      </div>

                      {/* Email */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">
                          Email
                        </p>
                        <p className="font-medium text-foreground break-all">
                          {playerDetails.email || '-'}
                        </p>
                      </div>

                      {/* Role */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">
                          Role
                        </p>
                        <p className="font-medium text-foreground capitalize">
                          {playerDetails.role}
                        </p>
                      </div>

                      {/* System Player # */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">
                          System Player #
                        </p>
                        <p className="font-medium text-foreground">
                          {playerDetails.system_player_number}
                        </p>
                      </div>

                      {/* BCA Member # */}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase mb-1">
                          BCA Member #
                        </p>
                        <p className="font-medium text-foreground">
                          {playerDetails.bca_member_number || '-'}
                        </p>
                      </div>

                      {/* Membership Status
                          BCA charges an annual membership fee. Players pay once per calendar year
                          (Jan 1 - Dec 31). We only accept payment for the current year, not future years.

                          Statuses:
                          - "Never Paid" = no membership_paid_date exists
                          - "Paid 2025" = paid date is in current year (active member)
                          - "Expired 2024" = paid date is from previous year (needs renewal)

                          Click to open the dues recording modal.
                      */}
                      <div>
                        <button
                          onClick={() => setShowDuesModal(true)}
                          className="text-left w-full hover:bg-muted -m-2 p-2 rounded transition-colors"
                        >
                          <p className="text-xs text-primary uppercase mb-1">
                            Membership Status
                          </p>
                          <p className={`font-medium ${
                            !playerDetails.membership_paid_date
                              ? 'text-muted-foreground'
                              : new Date(playerDetails.membership_paid_date).getFullYear() === new Date().getFullYear()
                                ? 'text-success'
                                : 'text-warning'
                          }`}>
                            {!playerDetails.membership_paid_date
                              ? 'Never Paid'
                              : new Date(playerDetails.membership_paid_date).getFullYear() === new Date().getFullYear()
                                ? `Paid ${new Date(playerDetails.membership_paid_date).getFullYear()}`
                                : `Expired ${new Date(playerDetails.membership_paid_date).getFullYear()}`
                            }
                          </p>
                        </button>
                      </div>
                    </div>

                  </CardContent>
                </Card>

                {/* Teams */}
                <Card className="rounded-none lg:rounded-xl">
                  <CardHeader className="p-4 lg:p-6 pb-3">
                    <CardTitle>Teams ({playerDetails.teams.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0">
                    {playerDetails.teams.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Not on any teams</p>
                    ) : (
                      <div className="space-y-3">
                        {playerDetails.teams.map((team) => (
                          <div
                            key={team.id}
                            className="p-3 bg-muted rounded-md border border-border"
                          >
                            {/* Season Name (contains all league info) */}
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">
                                {team.season_name}
                              </p>
                            </div>
                            {/* Team Name */}
                            <div>
                              <TeamNameLink
                                teamId={team.id}
                                teamName={team.team_name}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Unauthorized Player Warning - only show for players who need manual authorization */}
                {!playerIsAuthorized && (
                  <Card className="rounded-none lg:rounded-xl border-warning/40 bg-warning/10">
                    <CardContent className="p-4 lg:p-6">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-warning">
                            Player Not Authorized
                          </p>
                          <p className="text-sm text-foreground mt-1">
                            This player has {playerDetails.gameCounts.total} of 15 games needed to be established in the system. Set their starting handicaps below to authorize them for use in a restricted league match.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Game History & Handicaps */}
                <Card className="rounded-none lg:rounded-xl">
                  <CardHeader className="p-4 lg:p-6 pb-3">
                    <CardTitle>Game History & Handicaps</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0 space-y-4">
                    {/* Total Games */}
                    <div className="p-3 bg-info/10 rounded-md">
                      <p className="text-sm text-muted-foreground">Total Games</p>
                      <p className="text-2xl font-bold text-info">
                        {playerDetails.gameCounts.total}
                      </p>
                    </div>

                    {/* Game Type Counts with Handicaps */}
                    <div className="space-y-3">
                      {/* 8-Ball */}
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-medium text-foreground">8-Ball</p>
                          <p className="text-sm text-muted-foreground">
                            {playerDetails.gameCounts.eight_ball} games
                          </p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Points:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.eight_ball_points}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pct:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.eight_ball_percentage}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 9-Ball */}
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-medium text-foreground">9-Ball</p>
                          <p className="text-sm text-muted-foreground">
                            {playerDetails.gameCounts.nine_ball} games
                          </p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Points:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.nine_ball_points}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pct:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.nine_ball_percentage}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 10-Ball */}
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-medium text-foreground">10-Ball</p>
                          <p className="text-sm text-muted-foreground">
                            {playerDetails.gameCounts.ten_ball} games
                          </p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Points:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.ten_ball_points}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pct:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.ten_ball_percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border my-4"></div>

                    {/* Current Starting Handicaps Display */}
                    <div className="p-3 bg-muted rounded-md border border-border">
                      <p className="text-sm font-medium text-foreground mb-2">
                        Current Starting Handicaps
                      </p>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Points:</span>{' '}
                          <span
                            className={`font-semibold ${
                              playerDetails.starting_handicap_3v3 === null
                                ? 'text-warning'
                                : ''
                            }`}
                          >
                            {playerDetails.starting_handicap_3v3 !== null
                              ? playerDetails.starting_handicap_3v3
                              : 'Not Set'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pct:</span>{' '}
                          <span
                            className={`font-semibold ${
                              playerDetails.starting_handicap_5v5 === null
                                ? 'text-warning'
                                : ''
                            }`}
                          >
                            {playerDetails.starting_handicap_5v5 !== null
                              ? `${playerDetails.starting_handicap_5v5}%`
                              : 'Not Set'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Toggle Link for Starting Handicaps */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setIsHandicapOpen(!isHandicapOpen)}
                        className="text-primary hover:text-primary/80 font-medium transition-colors"
                      >
                        {isHandicapOpen
                          ? 'Hide Form'
                          : 'Set Starting Handicaps'}
                      </button>
                      <InfoButton title="Starting Handicaps">
                        <p>
                          Starting handicaps are used when a player has fewer
                          than 15 games in a league. This allows known players
                          to start with an appropriate handicap instead of the
                          default.
                        </p>
                      </InfoButton>
                    </div>

                    {/* Collapsible Content */}
                    {(isHandicapOpen || !playerIsAuthorized) && (
                      <div className="mt-4 space-y-4">
                        {/* 3v3 Handicap */}
                        <div>
                          <Label htmlFor="handicap3v3">
                            Starting Handicap (3v3)
                          </Label>
                          <Select
                            value={handicap3v3}
                            onValueChange={setHandicap3v3}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select handicap" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="-2">-2</SelectItem>
                              <SelectItem value="-1">-1</SelectItem>
                              <SelectItem value="0">0</SelectItem>
                              <SelectItem value="1">+1</SelectItem>
                              <SelectItem value="2">+2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 5v5 Handicap */}
                        <div>
                          <Label htmlFor="handicap5v5">
                            Starting Handicap (5v5)
                            <span className="text-xs text-muted-foreground ml-2">
                              (Range: 0 to 100)
                            </span>
                          </Label>
                          <Input
                            id="handicap5v5"
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={handicap5v5}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>
                            ) => setHandicap5v5(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        {/* Save Button */}
                        <Button
                          loadingText="Saving..."
                          isLoading={updateHandicapsMutation.isPending}
                          onClick={handleSave}
                          disabled={updateHandicapsMutation.isPending}
                          className="w-full"
                        >
                          Save Starting Handicaps
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="rounded-none lg:rounded-xl">
                <CardContent className="py-12 text-center text-muted-foreground">
                  Failed to load player details
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Authorize New Players Card (handles its own state and modal) */}
        {operatorId && (
          <AuthorizeNewPlayersCard
            operatorId={operatorId}
            onSelectPlayer={setSelectedPlayerId}
          />
        )}

        {/* Organization Invites Card */}
        {operatorId && (
          <Card className="rounded-none lg:rounded-xl">
            <CardHeader className="p-4 lg:p-6 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-info/15 rounded-lg">
                    <Mail className="h-5 w-5 text-info" />
                  </div>
                  <CardTitle>Invites</CardTitle>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-info">{pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">{expiredCount}</p>
                    <p className="text-xs text-muted-foreground">Expired</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{claimedCount}</p>
                    <p className="text-xs text-muted-foreground">Claimed</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 pt-0">
              {invitesLoading ? (
                <p className="text-sm text-muted-foreground">Loading invites...</p>
              ) : (
                <PendingInvitesList
                  invites={pendingInvites}
                  onCancelInvite={cancelInvite}
                  isCancelling={isCancelling}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Placeholders (Phase E — LO merge surface). Listed here so LOs
            can scan every placeholder in their org without leaving the
            existing Player Management page. */}
        {operatorId && <OrgPlaceholdersCard organizationId={operatorId} />}
      </div>

      {ConfirmDialogComponent}

      {/* Record Dues Modal */}
      {selectedPlayerId && playerDetails && (
        <RecordDuesModal
          open={showDuesModal}
          onOpenChange={setShowDuesModal}
          playerId={selectedPlayerId}
          playerName={`${playerDetails.first_name} ${playerDetails.last_name}`}
          hasPaid={!!playerDetails.membership_paid_date && new Date(playerDetails.membership_paid_date).getFullYear() === new Date().getFullYear()}
        />
      )}
    </div>
  );
};

export default PlayerManagement;
