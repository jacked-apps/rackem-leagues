/**
 * @fileoverview Standings Page
 *
 * Team rankings showing wins/losses/points/games for a season.
 * Mobile-first design with responsive table.
 *
 * TODO: Make page more mobile friendly - table is too wide on mobile screens
 *
 * Data shown:
 * - Rank (based on match wins → points → games)
 * - Team Name
 * - Wins (match wins, not individual games)
 * - Losses (match losses)
 * - Points (total points earned from all matches)
 * - Games (total individual games won)
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Lock, Trophy, Award } from 'lucide-react';
import { useStandings } from '@/api/hooks/useStandings';
import { StatsNavBar } from '@/components/StatsNavBar';
import { PageHeader } from '@/components/PageHeader';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { useSeasonLockedPayouts } from '@/api/hooks/useSeasonLockedPayouts';

/**
 * Standings Component
 *
 * Displays team rankings with match records and statistics.
 * Only shows data from completed matches in the season.
 */
export function Standings() {
  const { seasonId, leagueId } = useParams<{ seasonId: string; leagueId: string }>();
  const navigate = useNavigate();

  // Fetch standings data
  const { standings, isLoading, error } = useStandings(seasonId || '');
  const { data: member } = useCurrentMember();
  const { data: lockedPayouts } = useSeasonLockedPayouts(seasonId || undefined);

  // Build a place → amount lookup so we can map rank-by-index to prize
  const prizeByPlace = new Map<number, number>(
    (lockedPayouts?.team_payouts ?? []).map((p) => [p.place, p.amount]),
  );

  // Check if current user is a league operator
  const isOperator = member?.role === 'league_operator';

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
            <p className="text-sm text-muted-foreground">Loading team standings...</p>
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
            <CardTitle>Standings</CardTitle>
            <p className="text-sm text-red-600">Failed to load standings</p>
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

  // No teams found
  if (standings.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
            <p className="text-sm text-muted-foreground">Team standings</p>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No standings available for this season yet.
              <br />
              <span className="text-sm">Standings will appear here after matches are completed.</span>
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
        <StatsNavBar activePage="standings" />

        {/* Page Title */}
        <span className="text-2xl lg:text-4xl font-bold text-center mb-4 sm:mb-6">Standings</span>

        {/* Locked payouts banner */}
        {lockedPayouts && (
          <div className="mb-4 flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-md p-3">
            <Lock className="h-4 w-4 text-green-700 dark:text-green-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-green-900 dark:text-green-100">
                Official prize payouts
              </div>
              <div className="text-xs text-green-800 dark:text-green-200">
                Final prize pool ${lockedPayouts.final_prize_pool.toFixed(2)} — locked on{' '}
                {new Date(lockedPayouts.locked_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {/* Table - no card wrapper */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px] sm:w-[50px] px-1 sm:px-4 text-center text-xs sm:text-sm">#</TableHead>
                <TableHead className="px-1 sm:px-4 text-xs sm:text-sm">Team</TableHead>
                <TableHead className="w-[30px] sm:w-[50px] px-1 sm:px-4 text-center text-xs sm:text-sm">W</TableHead>
                <TableHead className="w-[30px] sm:w-[50px] px-1 sm:px-4 text-center text-xs sm:text-sm">L</TableHead>
                <TableHead className="w-[35px] sm:w-[60px] px-1 sm:px-4 text-center text-xs sm:text-sm">Pts</TableHead>
                <TableHead className="w-[40px] sm:w-[60px] px-1 sm:px-4 text-center text-xs sm:text-sm">Gms</TableHead>
                {lockedPayouts && (
                  <TableHead className="w-[80px] px-1 sm:px-4 text-center text-xs sm:text-sm">Prize</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((team, index) => {
                const rank = index + 1;
                const prize = prizeByPlace.get(rank);
                return (
                  <TableRow key={team.teamId}>
                    <TableCell className="font-medium px-1 sm:px-4 text-center text-xs sm:text-base">{rank}</TableCell>
                    <TableCell className="px-1 sm:px-4 text-xs sm:text-base">{team.teamName}</TableCell>
                    <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base">{team.matchWins}</TableCell>
                    <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base">{team.matchLosses}</TableCell>
                    <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base">
                      {team.points > 0 ? `+${team.points}` : team.points}
                    </TableCell>
                    <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base">{team.gamesWon}</TableCell>
                    {lockedPayouts && (
                      <TableCell className="text-center px-1 sm:px-4 text-xs sm:text-base font-semibold text-green-700 dark:text-green-400">
                        {prize ? `$${prize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Individual awards */}
        {lockedPayouts && lockedPayouts.individual_awards.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-purple-600" />
                Individual Awards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lockedPayouts.individual_awards.map((award) => (
                  <div
                    key={award.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">{award.label}</span>
                      {award.lo_funded && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                          LO-funded
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-green-700 dark:text-green-400">
                      ${award.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
