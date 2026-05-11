/**
 * @fileoverview QuickStats Component
 * Displays quick statistics for operator dashboard
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QuickStatsProps {
  /** Number of active leagues */
  activeLeagues: number;
  /** Number of active teams (current season) */
  activeTeams?: number;
  /** Number of active players (current season) */
  activePlayers?: number;
  /** Number of active venues */
  activeVenues?: number;
  /** Total seasons completed (all time) */
  totalSeasons?: number;
  /** Total teams (all time) */
  totalTeams?: number;
  /** Total players (all time) */
  totalPlayers?: number;
}

/**
 * QuickStats Component
 *
 * Displays key metrics for the operator with two sections:
 * - Active Stats: Current activity (leagues, teams, players, venues)
 * - Historical Stats: All-time totals (seasons completed, total teams)
 */
export const QuickStats: React.FC<QuickStatsProps> = ({
  activeLeagues,
  activeTeams = 0,
  activePlayers = 0,
  activeVenues = 0,
  totalSeasons = 0,
  totalTeams = 0,
  totalPlayers = 0,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Stats</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Active Stats Section */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leagues</span>
              <span className="font-medium">{activeLeagues}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Teams</span>
              <span className="font-medium">{activeTeams}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Players</span>
              <span className="font-medium">{activePlayers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Venues</span>
              <span className="font-medium">{activeVenues}</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-6"></div>

        {/* Historical Stats Section */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Time</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seasons Completed</span>
              <span className="font-medium">{totalSeasons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Teams</span>
              <span className="font-medium">{totalTeams}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Players</span>
              <span className="font-medium">{totalPlayers}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
