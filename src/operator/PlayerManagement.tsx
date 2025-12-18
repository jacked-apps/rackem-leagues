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
import { AuthorizeNewPlayersCard } from '@/components/operator/AuthorizeNewPlayersCard';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Users, DollarSign, AlertCircle } from 'lucide-react';
import { useIsDeveloper } from '@/api/hooks/useUserProfile';
import { getAllLeagueOperators } from '@/api/queries/operators';
import { logger } from '@/utils/logger';
import {
  fetchOperatorPlayerCount,
  fetchPlayerDetails,
  updatePlayerStartingHandicaps,
  markMembershipPaid,
  updateMembershipPaidDate,
  isPlayerAuthorized,
} from '@/api/queries/players';

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
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Use impersonated operator ID if developer has selected one, otherwise use orgId from URL
  const operatorId = impersonatedOperatorId || orgId;

  // Fetch all league operators (for developer impersonation)
  const { data: allOperators } = useQuery({
    queryKey: ['allLeagueOperators'],
    queryFn: getAllLeagueOperators,
    enabled: isDeveloper,
  });

  // Fetch player count - still needed for display
  const { data: playerCount = 0 } = useQuery({
    queryKey: ['operatorPlayerCount', operatorId, false],
    queryFn: () => fetchOperatorPlayerCount(operatorId!, false),
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

  // Check if player is authorized (has non-NULL starting handicaps)
  const playerIsAuthorized = playerDetails
    ? isPlayerAuthorized(playerDetails)
    : true;
  const isEstablishedPlayer = playerDetails
    ? playerDetails.gameCounts.total >= 15
    : false;

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

  // Mark membership as paid mutation
  const markMembershipPaidMutation = useMutation({
    mutationFn: (playerId: string) => markMembershipPaid(playerId),
    onSuccess: () => {
      // Invalidate player details query to refetch
      queryClient.invalidateQueries({
        queryKey: ['playerDetails', selectedPlayerId, operatorId],
      });
      toast.success('Membership marked as paid!');
    },
    onError: (error) => {
      logger.error('Error marking membership as paid', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to update membership status. Please try again.');
    },
  });

  // Reverse membership mutation
  const reverseMembershipMutation = useMutation({
    mutationFn: (playerId: string) => updateMembershipPaidDate(playerId, null),
    onSuccess: () => {
      // Invalidate player details query to refetch
      queryClient.invalidateQueries({
        queryKey: ['playerDetails', selectedPlayerId, operatorId],
      });
      toast.success('Membership reversed!');
    },
    onError: (error) => {
      logger.error('Error reversing membership', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to reverse membership. Please try again.');
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

  // Handle marking membership as paid
  const handleMarkMembershipPaid = async () => {
    if (!selectedPlayerId || !playerDetails) return;

    const confirmed = await confirm({
      title: 'Mark Membership as Paid',
      message: `Confirm that ${playerDetails.first_name} ${
        playerDetails.last_name
      } has paid their membership fee for ${new Date().getFullYear()}. Their membership will be valid through December 31, ${new Date().getFullYear()}. Do not accept payments for ${
        new Date().getFullYear() + 1
      } until next calendar year.`,
      confirmText: 'Confirm Payment',
      confirmVariant: 'default',
    });

    if (confirmed) {
      markMembershipPaidMutation.mutate(selectedPlayerId);
    }
  };

  // Handle reversing membership
  const handleReverseMembership = async () => {
    if (!playerDetails) return;

    const confirmed = await confirm({
      title: 'Reverse Membership Payment',
      message: `Confirm that ${playerDetails.first_name} ${
        playerDetails.last_name
      } has not paid the membership fees for ${new Date().getFullYear()}. This will mark their membership as unpaid.`,
      confirmText: 'Reverse Payment',
      confirmVariant: 'destructive',
    });

    if (confirmed) {
      reverseMembershipMutation.mutate(selectedPlayerId);
    }
  };

  // Get membership action based on payment status
  const getMembershipAction = () => {
    if (!playerDetails) return null;

    if (!playerDetails.membership_paid_date) {
      return {
        label: 'Received Membership Fee',
        icon: <DollarSign className="h-4 w-4 text-green-600" />,
        onClick: handleMarkMembershipPaid,
        className:
          'flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-100 transition-colors text-left text-green-600',
        buttonText: 'Received Membership Fee',
        buttonClassName: 'text-sm text-blue-600 hover:text-blue-800 underline',
      };
    } else {
      return {
        label: 'Reverse Membership',
        icon: <DollarSign className="h-4 w-4 text-red-600" />,
        onClick: handleReverseMembership,
        className:
          'flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-100 transition-colors text-left text-red-600',
        buttonText: 'Reverse Membership',
        buttonClassName: 'text-sm text-red-600 hover:text-red-800 underline',
      };
    }
  };

  const membershipAction = getMembershipAction();

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={`/operator-dashboard/${operatorId}`}
        backLabel="Back to Organization"
        title="Player Management"
        subtitle="View player information and manage starting handicaps"
      />

      <div className="container mx-auto px-0 lg:px-4 py-8 max-w-2xl space-y-6">
        {/* Developer Impersonation Dropdown */}
        {isDeveloper && allOperators && allOperators.length > 0 && (
          <Card className="rounded-none lg:rounded-xl bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="impersonate-operator"
                  className="text-sm font-semibold text-yellow-900"
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
        <Card className="rounded-none lg:rounded-xl">
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Player Count */}
              <div className="flex flex-col gap-3">
                {/* Player Count Display */}
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Players</p>
                    <p className="text-3xl font-bold">{playerCount}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Use filters in dropdown to refine search
                    </p>
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

        {/* Authorize New Players Card (handles its own state and modal) */}
        {operatorId && (
          <AuthorizeNewPlayersCard
            operatorId={operatorId}
            onSelectPlayer={setSelectedPlayerId}
          />
        )}

        {/* Player Details */}
        {selectedPlayerId && (
          <>
            {isLoadingDetails ? (
              <Card className="rounded-none lg:rounded-xl">
                <CardContent className="py-12 text-center text-gray-500">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          Name
                        </p>
                        <PlayerNameLink
                          playerId={playerDetails.id}
                          playerName={`${playerDetails.first_name} ${playerDetails.last_name}`}
                          className="font-medium"
                          customActions={
                            membershipAction ? [membershipAction] : []
                          }
                        />
                      </div>

                      {/* Nickname */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          Nickname
                        </p>
                        <p className="font-medium text-gray-900">
                          {playerDetails.nickname || '-'}
                        </p>
                      </div>

                      {/* Phone */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          Phone
                        </p>
                        <p className="font-medium text-gray-900">
                          {playerDetails.phone}
                        </p>
                      </div>

                      {/* Email */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          Email
                        </p>
                        <p className="font-medium text-gray-900 truncate">
                          {playerDetails.email}
                        </p>
                      </div>

                      {/* Role */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          Role
                        </p>
                        <p className="font-medium text-gray-900 capitalize">
                          {playerDetails.role}
                        </p>
                      </div>

                      {/* System Player # */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          System Player #
                        </p>
                        <p className="font-medium text-gray-900">
                          {playerDetails.system_player_number}
                        </p>
                      </div>

                      {/* BCA Member # */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          BCA Member #
                        </p>
                        <p className="font-medium text-gray-900">
                          {playerDetails.bca_member_number || '-'}
                        </p>
                      </div>

                      {/* Membership Paid Date */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">
                          Membership Paid
                        </p>
                        <p className="font-medium text-gray-900">
                          {playerDetails.membership_paid_date
                            ? new Date(
                                playerDetails.membership_paid_date
                              ).toLocaleDateString()
                            : '-'}
                        </p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 my-4"></div>

                    {/* Membership Actions */}
                    {membershipAction && (
                      <div className="flex justify-center gap-4">
                        <button
                          onClick={membershipAction.onClick}
                          className={membershipAction.buttonClassName}
                        >
                          {membershipAction.buttonText}
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Unauthorized Player Warning */}
                {!playerIsAuthorized && (
                  <Card className="rounded-none lg:rounded-xl border-amber-300 bg-amber-50">
                    <CardContent className="p-4 lg:p-6">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-amber-800">
                            Player Not Established
                          </p>
                          <p className="text-sm text-amber-700 mt-1">
                            {isEstablishedPlayer
                              ? 'This player has 15+ games and is established in the system. Set their starting handicaps below to authorize them.'
                              : `This player has ${playerDetails.gameCounts.total} of 15 games needed to be established in the system. Set their starting handicaps below to authorize them for use in a restricted league match.`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Teams */}
                <Card className="rounded-none lg:rounded-xl">
                  <CardHeader className="p-4 lg:p-6 pb-3">
                    <CardTitle>Teams ({playerDetails.teams.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0">
                    {playerDetails.teams.length === 0 ? (
                      <p className="text-sm text-gray-500">Not on any teams</p>
                    ) : (
                      <div className="space-y-3">
                        {playerDetails.teams.map((team) => (
                          <div
                            key={team.id}
                            className="p-3 bg-gray-50 rounded-md border border-gray-200"
                          >
                            {/* Season Name (contains all league info) */}
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-gray-600 uppercase">
                                {team.season_name}
                              </p>
                            </div>
                            {/* Team Name */}
                            <div>
                              <p className="font-medium text-gray-900">
                                {team.team_name}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Game History & Handicaps */}
                <Card className="rounded-none lg:rounded-xl">
                  <CardHeader className="p-4 lg:p-6 pb-3">
                    <CardTitle>Game History & Handicaps</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0 space-y-4">
                    {/* Total Games */}
                    <div className="p-3 bg-blue-50 rounded-md">
                      <p className="text-sm text-gray-600">Total Games</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {playerDetails.gameCounts.total}
                      </p>
                    </div>

                    {/* Game Type Counts with Handicaps */}
                    <div className="space-y-3">
                      {/* 8-Ball */}
                      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-medium text-gray-900">8-Ball</p>
                          <p className="text-sm text-gray-600">
                            {playerDetails.gameCounts.eight_ball} games
                          </p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">3v3:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.eight_ball_3v3}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">5v5:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.eight_ball_5v5}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 9-Ball */}
                      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-medium text-gray-900">9-Ball</p>
                          <p className="text-sm text-gray-600">
                            {playerDetails.gameCounts.nine_ball} games
                          </p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">3v3:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.nine_ball_3v3}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">5v5:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.nine_ball_5v5}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 10-Ball */}
                      <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-medium text-gray-900">10-Ball</p>
                          <p className="text-sm text-gray-600">
                            {playerDetails.gameCounts.ten_ball} games
                          </p>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">3v3:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.ten_ball_3v3}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">5v5:</span>{' '}
                            <span className="font-semibold">
                              {playerDetails.handicaps.ten_ball_5v5}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-gray-200 my-4"></div>

                    {/* Current Starting Handicaps Display */}
                    <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Current Starting Handicaps
                      </p>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">3v3:</span>{' '}
                          <span
                            className={`font-semibold ${
                              playerDetails.starting_handicap_3v3 === null
                                ? 'text-amber-600'
                                : ''
                            }`}
                          >
                            {playerDetails.starting_handicap_3v3 !== null
                              ? playerDetails.starting_handicap_3v3
                              : 'Not Set'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">5v5:</span>{' '}
                          <span
                            className={`font-semibold ${
                              playerDetails.starting_handicap_5v5 === null
                                ? 'text-amber-600'
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
                        onClick={() => setIsHandicapOpen(!isHandicapOpen)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
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
                            <span className="text-xs text-gray-500 ml-2">
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
                <CardContent className="py-12 text-center text-gray-500">
                  Failed to load player details
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {ConfirmDialogComponent}
    </div>
  );
};

export default PlayerManagement;
