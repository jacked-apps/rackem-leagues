/**
 * @fileoverview Stats & Standings Card Component
 *
 * Card component for League Detail page providing links to all stats pages.
 * Shows quick access to Standings, Top Shooters, Team Stats, and Match Data Viewer.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Database } from 'lucide-react';

interface StatsCardProps {
  leagueId: string;
  seasonId: string | null;
}

/**
 * Stats Card Component
 *
 * Displays navigation links to all stats and standings pages.
 * Only shown when an active season exists.
 *
 * @param leagueId - League's primary key ID
 * @param seasonId - Active season's primary key ID (null if no active season)
 */
export function StatsCard({ leagueId, seasonId }: StatsCardProps) {
  const navigate = useNavigate();

  // Don't show if no active season
  if (!seasonId) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Stats & Standings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          {/* Stats & Standings */}
          <Button
            variant="outline"
            className="h-auto flex-col items-start p-4 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => navigate(`/league/${leagueId}/season/${seasonId}/standings`)}
          >
            <Trophy className="h-5 w-5 mb-2 text-blue-600" />
            <div className="text-left">
              <div className="font-semibold text-gray-900">Stats & Standings</div>
              <div className="text-sm text-gray-600">All statistics</div>
            </div>
          </Button>

          {/* Match Data / Match List */}
          <Button
            variant="outline"
            className="h-auto flex-col items-start p-4 hover:bg-orange-50 hover:border-orange-300"
            onClick={() => navigate(`/league/${leagueId}/season/${seasonId}/match-list`)}
          >
            <Database className="h-5 w-5 mb-2 text-orange-600" />
            <div className="text-left">
              <div className="font-semibold text-gray-900">Match Data</div>
              <div className="text-sm text-gray-600">Verify entries</div>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
