/**
 * @fileoverview Authorize New Players Card Component
 *
 * Displays a list of unauthorized players (those with NULL starting handicaps)
 * and allows operators to set their starting handicaps via a modal.
 *
 * Features:
 * - Button-triggered check for established players (15+ games)
 * - Shows game count for each unauthorized player
 * - Modal for setting 3v3 and 5v5 starting handicaps
 * - Collapsible card to save space when not needed
 * - Optimistic removal when handicap is set (no refetch needed)
 *
 * Performance optimizations:
 * - Uses count queries instead of fetching all game records
 * - Runs all player checks in parallel when button is clicked
 * - No useEffect - uses TanStack Query patterns throughout
 * - Only fetches game counts once per page visit
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertCircle, UserCheck, ChevronDown, ChevronUp, Loader2, Eye, Search } from 'lucide-react';
import { InfoButton } from '@/components/InfoButton';
import { logger } from '@/utils/logger';
import {
  fetchOperatorPlayers,
  updatePlayerStartingHandicaps,
  batchAutoAuthorizeEstablishedPlayers,
  fetchPlayerTotalGameCount,
} from '@/api/queries/players';

interface AuthorizeNewPlayersCardProps {
  /** The operator/organization ID to fetch players for */
  operatorId: string;
  /** Optional callback when a player is selected for viewing */
  onSelectPlayer?: (playerId: string) => void;
}

/** Player with game count for display */
interface PlayerWithGameCount {
  id: string;
  first_name: string;
  last_name: string;
  system_player_number: number | null;
  bca_member_number: string | null;
  gameCount: number;
}

/**
 * AuthorizeNewPlayersCard Component
 *
 * A collapsible card that shows unauthorized players and allows
 * operators to set their starting handicaps.
 *
 * Uses TanStack Query throughout - no useEffect needed.
 * Auto-authorize is button-triggered, not automatic on mount.
 */
export const AuthorizeNewPlayersCard: React.FC<AuthorizeNewPlayersCardProps> = ({
  operatorId,
  onSelectPlayer,
}) => {
  const queryClient = useQueryClient();

  // UI State
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalPlayer, setModalPlayer] = useState<{ id: string; name: string } | null>(null);
  const [modalHandicap3v3, setModalHandicap3v3] = useState<string>('0');
  const [modalHandicap5v5, setModalHandicap5v5] = useState<string>('40');

  // Local state to track players (for optimistic removal)
  const [localPlayers, setLocalPlayers] = useState<PlayerWithGameCount[]>([]);
  const [hasLoadedGameCounts, setHasLoadedGameCounts] = useState<boolean>(false);

  // Fetch unauthorized players (NULL starting handicaps)
  const { data: unauthorizedPlayersData, isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['unauthorizedPlayers', operatorId],
    queryFn: () => fetchOperatorPlayers(operatorId, { unauthorizedOnly: true }),
    enabled: !!operatorId,
  });

  const unauthorizedPlayers = unauthorizedPlayersData?.data || [];

  // Fetch game counts for all unauthorized players (runs once per page visit)
  const { isLoading: isLoadingGameCounts, refetch: fetchGameCounts } = useQuery({
    queryKey: ['unauthorizedPlayersGameCounts', operatorId],
    queryFn: async () => {
      // Fetch game counts in parallel for all players
      const playersWithCounts = await Promise.all(
        unauthorizedPlayers.map(async (player) => ({
          id: player.id,
          first_name: player.first_name,
          last_name: player.last_name,
          system_player_number: player.system_player_number,
          bca_member_number: player.bca_member_number,
          gameCount: await fetchPlayerTotalGameCount(player.id),
        }))
      );

      setLocalPlayers(playersWithCounts);
      setHasLoadedGameCounts(true);
      return playersWithCounts;
    },
    // Only enable after we have the unauthorized players list
    enabled: false, // Manual trigger only
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Auto-authorize mutation (button-triggered)
  const autoAuthorizeMutation = useMutation({
    mutationFn: async () => {
      const playerIds = localPlayers.map((p) => p.id);
      return batchAutoAuthorizeEstablishedPlayers(playerIds);
    },
    onSuccess: (results) => {
      const authorizedCount = results.filter((r) => r.result.authorized).length;

      if (authorizedCount > 0) {
        // Log details for each authorized player
        results
          .filter((r) => r.result.authorized)
          .forEach((r) => {
            const player = localPlayers.find((p) => p.id === r.playerId);
            logger.info('Auto-authorized player', {
              playerId: r.playerId,
              name: player ? `${player.first_name} ${player.last_name}` : 'Unknown',
              totalGames: r.result.totalGames,
              handicap3v3: r.result.handicap3v3,
              handicap5v5: r.result.handicap5v5,
            });
          });

        // Remove authorized players from local list (optimistic)
        const authorizedIds = new Set(
          results.filter((r) => r.result.authorized).map((r) => r.playerId)
        );
        setLocalPlayers((prev) => prev.filter((p) => !authorizedIds.has(p.id)));

        toast.success(
          `Auto-authorized ${authorizedCount} established player${authorizedCount !== 1 ? 's' : ''}`
        );
      } else {
        toast.info('No players with 15+ games found to auto-authorize');
      }

      // Also refresh the main query cache for consistency
      queryClient.invalidateQueries({ queryKey: ['unauthorizedPlayers', operatorId] });
    },
    onError: (error) => {
      logger.error('Error auto-authorizing players', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to auto-authorize players. Please try again.');
    },
  });

  // Trigger loading game counts when we have unauthorized players and haven't loaded yet
  const handleLoadGameCounts = async () => {
    if (unauthorizedPlayers.length > 0 && !hasLoadedGameCounts) {
      await fetchGameCounts();
    }
  };

  // Check for established players button handler
  const handleCheckEstablished = () => {
    if (localPlayers.length > 0) {
      autoAuthorizeMutation.mutate();
    }
  };

  const isLoading = isLoadingPlayers;

  // Update starting handicaps mutation with optimistic removal
  const updateHandicapsMutation = useMutation({
    mutationFn: ({ playerId, h3v3, h5v5 }: { playerId: string; h3v3: number; h5v5: number }) =>
      updatePlayerStartingHandicaps(playerId, h3v3, h5v5),
    onSuccess: (_, variables) => {
      // Optimistically remove the player from local list (no refetch needed)
      setLocalPlayers((prev) => prev.filter((p) => p.id !== variables.playerId));
      toast.success('Starting handicaps set successfully!');
      // Update main query cache for consistency (won't trigger re-render since we use local state)
      queryClient.invalidateQueries({ queryKey: ['unauthorizedPlayers', operatorId] });
    },
    onError: (error) => {
      logger.error('Error updating handicaps', {
        error: error instanceof Error ? error.message : String(error),
      });
      toast.error('Failed to set starting handicaps. Please try again.');
    },
  });

  // Open modal to set handicap for a player
  const handleOpenModal = (player: { id: string; first_name: string; last_name: string }) => {
    setModalPlayer({ id: player.id, name: `${player.first_name} ${player.last_name}` });
    setModalHandicap3v3('0');
    setModalHandicap5v5('40');
    setIsModalOpen(true);
  };

  // Handle saving from the modal
  const handleModalSave = () => {
    if (!modalPlayer) return;

    const h3v3 = parseFloat(modalHandicap3v3);
    const h5v5 = parseFloat(modalHandicap5v5);

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
      playerId: modalPlayer.id,
      h3v3,
      h5v5,
    });

    setIsModalOpen(false);
    setModalPlayer(null);
  };

  // Close modal handler
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalPlayer(null);
  };

  // Determine which player list to show (local if loaded, otherwise show count from query)
  const displayPlayers = hasLoadedGameCounts ? localPlayers : [];
  const playerCount = hasLoadedGameCounts ? localPlayers.length : unauthorizedPlayers.length;

  return (
    <>
      <Card className="rounded-none lg:rounded-xl">
        <CardHeader className="p-4 lg:p-6 pb-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(!isOpen);
              }
            }}
            className="flex items-center justify-between w-full text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Authorize New Players</CardTitle>
                  <div onClick={(e) => e.stopPropagation()}>
                    <InfoButton title="Player Authorization">
                      <p>
                        Players become "established" after playing 15 games in the system, at which
                        point their handicap is calculated automatically.
                      </p>
                      <p className="mt-2">
                        For new players with fewer than 15 games, you can set their starting
                        handicaps here to authorize them for use in leagues that restrict lineups to
                        established or authorized players only.
                      </p>
                      <p className="mt-2">
                        Click "Load Players" to see game counts, then "Check for Established" to
                        auto-authorize any players with 15+ games.
                      </p>
                    </InfoButton>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isLoading
                    ? 'Loading...'
                    : `${playerCount} player${playerCount !== 1 ? 's' : ''} need authorization`}
                </p>
              </div>
            </div>
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {isOpen && (
          <CardContent className="p-4 lg:p-6 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="text-sm">Loading...</p>
              </div>
            ) : unauthorizedPlayers.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-success">
                <UserCheck className="h-5 w-5" />
                <p className="text-sm font-medium">All players are authorized!</p>
              </div>
            ) : !hasLoadedGameCounts ? (
              // Initial state - show button to load game counts
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {unauthorizedPlayers.length} player{unauthorizedPlayers.length !== 1 ? 's' : ''}{' '}
                  need authorization. Load player details to see game counts and set handicaps.
                </p>
                <Button
                  loadingText="Loading game counts..."
                  isLoading={isLoadingGameCounts}
                  onClick={handleLoadGameCounts}
                  disabled={isLoadingGameCounts}
                  className="w-full"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Load Players
                </Button>
              </div>
            ) : displayPlayers.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-4 text-success">
                <UserCheck className="h-5 w-5" />
                <p className="text-sm font-medium">All players are authorized!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleCheckEstablished}
                    disabled={autoAuthorizeMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    {autoAuthorizeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Check for Established (15+ games)
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Set starting handicaps for players below, or use "Check for Established" to
                  auto-authorize any players with 15+ games.
                </p>

                {/* Player list with game counts */}
                {displayPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted border-border"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {player.first_name} {player.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{player.system_player_number?.toString().padStart(5, '0')}
                        {player.bca_member_number && ` • BCA: ${player.bca_member_number}`}
                        <span
                          className={`ml-2 ${player.gameCount >= 15 ? 'text-success font-medium' : ''}`}
                        >
                          • {player.gameCount} game{player.gameCount !== 1 ? 's' : ''}
                          {player.gameCount >= 15 && ' ✓'}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {onSelectPlayer && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onSelectPlayer(player.id);
                            setIsOpen(false);
                          }}
                          title="View player details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button loadingText="none" size="sm" onClick={() => handleOpenModal(player)}>
                        Set H/C
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Set Starting Handicap Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Starting Handicaps</DialogTitle>
            <DialogDescription>
              {modalPlayer
                ? `Authorize ${modalPlayer.name} by setting their starting handicaps.`
                : 'Set starting handicaps for this player.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 3v3 Handicap */}
            <div>
              <Label htmlFor="modal-handicap3v3">Starting Handicap (3v3)</Label>
              <Select value={modalHandicap3v3} onValueChange={setModalHandicap3v3}>
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
              <Label htmlFor="modal-handicap5v5">
                Starting Handicap (5v5)
                <span className="text-xs text-muted-foreground ml-2">(0 to 100)</span>
              </Label>
              <Input
                id="modal-handicap5v5"
                type="number"
                step="1"
                min="0"
                max="100"
                value={modalHandicap5v5}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModalHandicap5v5(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button loadingText="Saving..." isLoading={updateHandicapsMutation.isPending} onClick={handleModalSave} disabled={updateHandicapsMutation.isPending}>
              Set Handicaps
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AuthorizeNewPlayersCard;
