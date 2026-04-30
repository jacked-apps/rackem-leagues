/**
 * @fileoverview Top Shooters Page
 *
 * Individual player rankings showing wins/losses/handicaps for a season.
 * Mobile-first design with responsive table.
 *
 * TODO: Make page more mobile friendly - table is too wide on mobile screens
 *
 * Data shown:
 * - Rank (based on most wins, win% as tiebreaker)
 * - Player Name
 * - Wins (individual games won in season, excluding tiebreakers)
 * - Losses (individual games lost in season, excluding tiebreakers)
 * - Win % (calculated percentage)
 * - Handicap (calculated from last 200 games across all seasons)
 *
 * TODO: For 8-man format, add "Beginning %" column showing player's win%
 * from their first match of the season. This would show handicap growth/change
 * throughout the season. Need to:
 * 1. Query for each player's first match in the season (by date)
 * 2. Calculate their win% from just that first match
 * 3. Display as "Beginning %" column (or similar) next to current Win %
 * 4. Could show delta/change (e.g., "+5.2%" or "-3.1%") to highlight improvement
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import { useTopShooters } from '@/api/hooks/useTopShooters';
import { StatsNavBar } from '@/components/StatsNavBar';
import { PageHeader } from '@/components/PageHeader';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { PlayerNameLink } from '@/components/PlayerNameLink';

/**
 * Top Shooters Component
 *
 * Displays player rankings with game statistics and calculated handicaps.
 * Only shows games from the current season (excludes tiebreakers).
 * Handicaps are calculated using the main handicap calculator function.
 */
export function TopShooters() {
  const { seasonId, leagueId } = useParams<{ seasonId: string; leagueId: string }>();
  const navigate = useNavigate();
  const { data: member } = useCurrentMember();

  // Check if current user is a league operator
  const isOperator = member?.role === 'league_operator';

  // Fetch player stats with handicaps
  const { players, isLoading, error, teamFormat } = useTopShooters(
    seasonId || ''
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle>Top Shooter</CardTitle>
            <p className="text-sm text-muted-foreground">
              Loading player statistics...
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle>Top Shooter</CardTitle>
            <p className="text-sm text-red-600">
              Failed to load player statistics
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-red-500">
              Error: {error.message}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No players found
  if (players.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle>Top Shooter</CardTitle>
            <p className="text-sm text-muted-foreground">Individual player rankings</p>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No player statistics available for this season yet.
              <br />
              <span className="text-sm">
                Games will appear here after matches are completed and verified.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        hideBack
        title="Stats & Standings"
      >
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            className="w-full"
            size="lg"
            onClick={() => navigate(`/my-teams`)}
            loadingText="none"
          >
            <ArrowLeft className="h-4 w-4" />
            My Teams
          </Button>
          {isOperator && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate(`/league/${leagueId}`)}
              loadingText="none"
            >
              <ArrowLeft className="h-4 w-4" />
              League Dashboard
            </Button>
          )}
        </div>
      </PageHeader>
      <div className="container mx-auto px-4 pb-4 lg:pt-4 max-w-7xl">
        {/* Stats Navigation */}
        <StatsNavBar activePage="top-shooters" />

        {/* Page Title */}
        <span className="text-2xl lg:text-4xl font-bold text-center mb-4 sm:mb-6">Top Shooters</span>

        {/* Table - no card wrapper */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px] sm:w-[50px] px-1 sm:px-4 text-center text-xs sm:text-sm">#</TableHead>
                <TableHead className="w-[35px] sm:w-[50px] px-1 sm:px-4 text-center text-xs sm:text-sm">H/C</TableHead>
                <TableHead className="px-1 sm:px-4 text-xs sm:text-sm">Player</TableHead>
                <TableHead className="w-[30px] sm:w-[50px] px-1 sm:px-4 text-center text-xs sm:text-sm">W</TableHead>
                <TableHead className="w-[30px] sm:w-[50px] px-1 sm:px-4 text-center text-xs sm:text-sm">L</TableHead>
                {teamFormat === '5_man' && (
                  <TableHead className="w-[35px] sm:w-[60px] px-1 sm:px-4 text-center text-xs sm:text-sm">Pts</TableHead>
                )}
                <TableHead className="w-[45px] sm:w-[70px] px-1 sm:px-4 text-center text-xs sm:text-sm">Win%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player, index) => {
                const rank = index + 1;
                const points = player.gamesWon - player.gamesLost;
                return (
                  <TableRow key={player.playerId}>
                    <TableCell className="font-medium px-1 sm:px-4 text-center text-xs sm:text-base">{rank}</TableCell>
                    <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base">
                      {player.handicap > 0 ? `+${player.handicap}` : player.handicap}
                    </TableCell>
                    <TableCell className="px-1 sm:px-4 text-xs sm:text-base">
                      <PlayerNameLink playerId={player.playerId} playerName={player.playerName} />
                    </TableCell>
                    <TableCell className="font-medium px-1 sm:px-4 text-center text-xs sm:text-base">{player.gamesWon}</TableCell>
                    <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base">{player.gamesLost}</TableCell>
                    {teamFormat === '5_man' && (
                      <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base">
                        {points > 0 ? `+${points}` : points}
                      </TableCell>
                    )}
                    <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base">
                      {player.winPercentage.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
