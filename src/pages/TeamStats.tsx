/**
 * @fileoverview Team Stats Page
 *
 * Combined team and player stats grouped by team.
 * Shows team standings with player breakdown underneath each team.
 * Mobile-first design with responsive table.
 *
 * TODO: Make page more mobile friendly - table is too wide on mobile screens
 *
 * Layout:
 * - Team header rows: Bold, shows match-level stats
 * - Player detail rows: Indented, shows game-level stats with handicaps
 * - Substitutes: Aggregated as single row per team
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTeamStats } from '@/api/hooks/useTeamStats';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { usePlayerHandicaps } from '@/api/hooks/usePlayerHandicaps';
import { getLeagueBySeasonId } from '@/api/queries/leagues';
import { queryKeys } from '@/api/queryKeys';
import { StatsNavBar } from '@/components/StatsNavBar';
import { PageHeader } from '@/components/PageHeader';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { ArrowLeft } from 'lucide-react';

/**
 * Team Stats Component
 *
 * Displays hierarchical view with:
 *
 * Team Header Rows:
 * - Team Name | Match Wins | Match Losses | Points | Games Won
 *
 * Player Detail Rows (under each team):
 * - Player Name (indented) | Games Won | Games Lost | Matches Played | H.C.
 */
export function TeamStats() {
  const { seasonId, leagueId } = useParams<{ seasonId: string; leagueId: string }>();
  const navigate = useNavigate();
  const { data: member } = useCurrentMember();

  // Check if current user is a league operator
  const isOperator = member?.role === 'league_operator';

  // Fetch team stats with player breakdowns
  const { teams, isLoading: statsLoading, error: statsError } = useTeamStats(seasonId!);

  // Fetch league config for handicap calculation
  const {
    data: league,
    isLoading: leagueLoading,
    error: leagueError,
  } = useQuery({
    queryKey: queryKeys.seasons.detail(seasonId!),
    queryFn: () => getLeagueBySeasonId(seasonId!),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Resolved preferences — lazy-migrates legacy leagues on first access
  const { data: leaguePrefs } = useResolvedLeaguePrefs(leagueId);
  const handicapType = leaguePrefs?.handicap_type ?? 'points';

  // Extract all player IDs (excluding substitutes)
  const allPlayerIds = teams.flatMap(team =>
    team.players.filter(p => !p.isSubstitute).map(p => p.playerId)
  );

  // Calculate handicaps for all players
  const {
    handicaps,
    isLoading: handicapsLoading,
  } = usePlayerHandicaps({
    playerIds: allPlayerIds,
    handicapType,
    handicapVariant: league?.handicap_variant || 'standard',
    gameType: league?.game_type || 'eight_ball',
    leagueId,
    gameLimit: 200,
  });

  const isLoading = statsLoading || leagueLoading || (allPlayerIds.length > 0 && handicapsLoading);
  const error = statsError || leagueError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-card">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card>
            <CardContent className="py-8">
              <div className="text-center">Loading team stats...</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-card">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-red-600">
                Error loading team stats: {error.message}
              </div>
            </CardContent>
          </Card>
        </div>
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
        <StatsNavBar activePage="team-stats" />

        {/* Page Title */}
        <span className="text-2xl lg:text-4xl font-bold text-center mb-4 sm:mb-6">Team Stats</span>

        {/* Table - no card wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-center px-1 sm:px-4 py-2 w-[35px] sm:w-[60px] text-xs sm:text-sm">H/C</th>
                <th className="text-left px-1 sm:px-4 py-2 text-xs sm:text-sm">Team / Player</th>
                <th className="text-center px-1 sm:px-4 py-2 w-[30px] sm:w-[60px] text-xs sm:text-sm">W</th>
                <th className="text-center px-1 sm:px-4 py-2 w-[30px] sm:w-[60px] text-xs sm:text-sm">L</th>
                <th className="text-center px-1 sm:px-4 py-2 w-[40px] sm:w-[80px] text-xs sm:text-sm">M</th>
                <th className="text-center px-1 sm:px-4 py-2 w-[35px] sm:w-[70px] text-xs sm:text-sm">G</th>
                <th className="text-center px-1 sm:px-4 py-2 w-[35px] sm:w-[70px] text-xs sm:text-sm">Pts</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <>
                  {/* Team Header Row */}
                  <tr key={team.teamId} className="border-b bg-muted">
                    <td className="text-center px-1 sm:px-4 py-2 font-bold text-xs sm:text-base"></td>
                    <td className="px-1 sm:px-4 py-2 font-bold text-xs sm:text-base">{team.teamName}</td>
                    <td className="text-center px-1 sm:px-4 py-2 font-bold text-xs sm:text-base">{team.matchWins}</td>
                    <td className="text-center px-1 sm:px-4 py-2 font-bold text-xs sm:text-base">{team.matchLosses}</td>
                    <td className="text-center px-1 sm:px-4 py-2 font-bold text-xs sm:text-base">{team.matchWins + team.matchLosses}</td>
                    <td className="text-center px-1 sm:px-4 py-2 font-bold text-xs sm:text-base">{team.gamesWon}</td>
                    <td className="text-center px-1 sm:px-4 py-2 font-bold text-xs sm:text-base">{team.points}</td>
                  </tr>

                  {/* Player Detail Rows */}
                  {team.players.map((player) => {
                    const handicap = player.isSubstitute ? '' : (handicaps.get(player.playerId)?.value ?? '-');

                    return (
                      <tr key={`${team.teamId}-${player.playerId}`} className="border-b">
                        <td className="text-center px-1 sm:px-4 py-1 text-xs">{handicap}</td>
                        <td className="px-2 sm:px-6 py-1 text-xs text-foreground">{player.playerName}</td>
                        <td className="text-center px-1 sm:px-4 py-1 text-xs">{player.gamesWon}</td>
                        <td className="text-center px-1 sm:px-4 py-1 text-xs">{player.gamesLost}</td>
                        <td className="text-center px-1 sm:px-4 py-1 text-xs">{player.matchesPlayed}</td>
                        <td className="text-center px-1 sm:px-4 py-1 text-xs"></td>
                        <td className="text-center px-1 sm:px-4 py-1 text-xs"></td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
