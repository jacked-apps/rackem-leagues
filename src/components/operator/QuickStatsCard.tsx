/**
 * @fileoverview Smart QuickStats Card Component
 *
 * Self-contained stats card that fetches its own data.
 * Displays operator dashboard statistics with automatic data fetching and caching.
 * Uses a single RPC call to efficiently fetch all 7 stats at once.
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOperatorStats } from '@/api/hooks';

interface QuickStatsCardProps {
  /** Operator ID to fetch stats for */
  operatorId: string | null | undefined;
}

/**
 * QuickStatsCard Component
 *
 * Fetches and displays operator statistics in a single database call:
 * - Active leagues count
 * - Total teams count
 * - Total players count
 * - Total venues count
 * - Completed seasons count
 * - Completed matches count
 * - Total games played count
 *
 * All data is fetched via a single Postgres RPC function with automatic caching.
 *
 * @example
 * <QuickStatsCard operatorId={operatorId} />
 */
export const QuickStatsCard: React.FC<QuickStatsCardProps> = ({ operatorId }) => {
  // Fetch all stats in one call using RPC function
  const { data: stats } = useOperatorStats(operatorId);

  // Extract stats with defaults
  const leagueCount = stats?.leagues ?? 0;
  const teamCount = stats?.teams ?? 0;
  const playerCount = stats?.players ?? 0;
  const venueCount = stats?.venues ?? 0;
  const completedSeasonCount = stats?.seasons_completed ?? 0;
  const completedMatchCount = stats?.matches_completed ?? 0;
  const gamesPlayedCount = stats?.games_played ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Stats</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Active Stats Section */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Active
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leagues</span>
              <span className="font-medium">{leagueCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Teams</span>
              <span className="font-medium">{teamCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Players</span>
              <span className="font-medium">{playerCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Venues</span>
              <span className="font-medium">{venueCount}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-6"></div>

        {/* Historical Stats Section */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            All Time
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seasons Completed</span>
              <span className="font-medium">{completedSeasonCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Matches</span>
              <span className="font-medium">{completedMatchCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Games</span>
              <span className="font-medium">{gamesPlayedCount}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
