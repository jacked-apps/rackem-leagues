/**
 * @fileoverview Feats of Excellence Page
 *
 * Displays special achievement rankings for a season:
 * - Break & Runs
 * - Golden Breaks
 * - Flawless Nights
 *
 * TODO: Make page more mobile friendly - tables are too wide on mobile screens
 *
 * Mobile-first responsive design with three separate ranking tables.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InfoButton } from '@/components/InfoButton';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import { useFeatsStats } from '@/api/hooks/useFeatsStats';
import { StatsNavBar } from '@/components/StatsNavBar';
import { PageHeader } from '@/components/PageHeader';
import { useCurrentMember } from '@/api/hooks/useCurrentMember';
import { ArrowLeft } from 'lucide-react';

/**
 * Feats of Excellence Component
 *
 * Displays three rankings:
 * 1. Break & Runs - Players with most break and runs
 * 2. Golden Breaks - Players with most golden breaks
 * 3. Flawless Nights - Matches where player won every game
 *
 * Format: Rank | Player Name | Count
 * Only shows players with at least 1 of each feat
 */
export function FeatsOfExcellence() {
  const { seasonId, leagueId } = useParams<{ seasonId: string; leagueId: string }>();
  const navigate = useNavigate();
  const { data: member } = useCurrentMember();

  // Check if current user is a league operator
  const isOperator = member?.role === 'league_operator';

  const { feats, isLoading, error } = useFeatsStats(seasonId!);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card>
            <CardContent className="py-8">
              <div className="text-center">Loading feats...</div>
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
              <div className="text-center text-destructive">
                Error loading feats: {error.message}
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
      <div className="container mx-auto px-4 py-4 lg:pt-4 max-w-7xl">
        {/* Stats Navigation */}
        <StatsNavBar activePage="feats" />

        {/* Page Title */}
        <span className="text-2xl lg:text-4xl font-bold text-center mb-4 sm:mb-6">Feats of Excellence</span>

        {/* Three Rankings */}
        <div className="space-y-8">
          {/* Break & Runs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Break & Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {feats?.breakAndRuns && feats.breakAndRuns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-center px-1 sm:px-4 py-2 w-[30px] sm:w-[60px] text-xs sm:text-sm">#</th>
                        <th className="text-left px-1 sm:px-4 py-2 text-xs sm:text-sm">Player</th>
                        <th className="text-center px-1 sm:px-4 py-2 w-[45px] sm:w-[80px] text-xs sm:text-sm">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feats.breakAndRuns.map((player, index) => (
                        <tr key={player.playerId} className="border-b">
                          <td className="text-center px-1 sm:px-4 py-2 text-xs sm:text-base">{index + 1}</td>
                          <td className="px-1 sm:px-4 py-2 text-xs sm:text-base">
                            <PlayerNameLink playerId={player.playerId} playerName={player.playerName} />
                          </td>
                          <td className="text-center px-1 sm:px-4 py-2 font-semibold text-xs sm:text-base">{player.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No break & runs recorded this season
                </div>
              )}
            </CardContent>
          </Card>

          {/* Golden Breaks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Golden Breaks</CardTitle>
            </CardHeader>
            <CardContent>
              {feats?.goldenBreaks && feats.goldenBreaks.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-center px-1 sm:px-4 py-2 w-[30px] sm:w-[60px] text-xs sm:text-sm">#</th>
                        <th className="text-left px-1 sm:px-4 py-2 text-xs sm:text-sm">Player</th>
                        <th className="text-center px-1 sm:px-4 py-2 w-[45px] sm:w-[80px] text-xs sm:text-sm">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feats.goldenBreaks.map((player, index) => (
                        <tr key={player.playerId} className="border-b">
                          <td className="text-center px-1 sm:px-4 py-2 text-xs sm:text-base">{index + 1}</td>
                          <td className="px-1 sm:px-4 py-2 text-xs sm:text-base">
                            <PlayerNameLink playerId={player.playerId} playerName={player.playerName} />
                          </td>
                          <td className="text-center px-1 sm:px-4 py-2 font-semibold text-xs sm:text-base">{player.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No golden breaks recorded this season
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flawless Matches */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                Flawless Matches
                <InfoButton title="Flawless Matches">
                  A flawless match is achieved when a player wins every game they played in that match. Only regular games count - tiebreaker games are excluded.
                </InfoButton>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feats?.flawlessNights && feats.flawlessNights.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-center px-1 sm:px-4 py-2 w-[30px] sm:w-[60px] text-xs sm:text-sm">#</th>
                        <th className="text-left px-1 sm:px-4 py-2 text-xs sm:text-sm">Player</th>
                        <th className="text-center px-1 sm:px-4 py-2 w-[45px] sm:w-[80px] text-xs sm:text-sm">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feats.flawlessNights.map((player, index) => (
                        <tr key={player.playerId} className="border-b">
                          <td className="text-center px-1 sm:px-4 py-2 text-xs sm:text-base">{index + 1}</td>
                          <td className="px-1 sm:px-4 py-2 text-xs sm:text-base">
                            <PlayerNameLink playerId={player.playerId} playerName={player.playerName} />
                          </td>
                          <td className="text-center px-1 sm:px-4 py-2 font-semibold text-xs sm:text-base">{player.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No flawless matches recorded this season
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
 )
}
