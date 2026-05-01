/**
 * @fileoverview Playoff Seeding Card Component
 *
 * Displays an example seeding table showing how teams are ranked
 * and which qualify for playoffs based on current settings.
 *
 * Wraps the PlayoffStandingsTable with consistent card styling
 * and explanatory text about the seeding criteria.
 *
 * Used on:
 * - Organization Playoff Settings page
 * - League Playoff Settings page (future)
 */

import React from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayoffStandingsTable } from '@/components/playoff/PlayoffStandingsTable';

/**
 * Props for PlayoffSeedingCard component
 */
export interface PlayoffSeedingCardProps {
  /** Total number of teams to display */
  teamCount: number;
  /** Number of teams that qualify (bracket size) */
  bracketSize: number;
  /** Number of wildcard spots */
  wildcardSpots: number;
}

/**
 * PlayoffSeedingCard Component
 *
 * Renders a card showing:
 * - Header with team count
 * - Seeding criteria explanation
 * - Standings table with qualification indicators
 *
 * @example
 * <PlayoffSeedingCard
 *   teamCount={10}
 *   bracketSize={8}
 *   wildcardSpots={2}
 * />
 */
export const PlayoffSeedingCard: React.FC<PlayoffSeedingCardProps> = ({
  teamCount,
  bracketSize,
  wildcardSpots,
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Example Seeding ({teamCount} Teams)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Teams are seeded by: Match Wins → Points → Games Won
        </p>
        <PlayoffStandingsTable
          teamCount={teamCount}
          bracketSize={bracketSize}
          wildcardSpots={wildcardSpots}
        />
      </CardContent>
    </Card>
  );
};

export default PlayoffSeedingCard;
