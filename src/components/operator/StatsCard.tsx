/**
 * @fileoverview Stats & Standings Card Component
 *
 * Card on the League Detail page with quick entries for the season's
 * operator-facing match tools: Standings (player/team stats) and Score a Match
 * (the manual score / verify / edit workflow). Only shown when an active
 * season exists.
 *
 * Replaced the old "Match Data" entry (a read-only MVP debug viewer) with
 * Score a Match — the real score/verify/edit surface. The MatchDataViewer page
 * + route still exist for dev inspection; they're just no longer linked here.
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SectionCard } from './SectionCard';
import { Trophy, SquarePen } from 'lucide-react';

interface StatsCardProps {
  leagueId: string;
  seasonId: string | null;
}

/**
 * Stats Card Component
 *
 * Quick entries to the season's Standings and the Score a Match workflow.
 * Only renders when an active season exists.
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
    <SectionCard title="Scoring">
      <div className="flex flex-wrap gap-2">
        {/* Standings */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/league/${leagueId}/season/${seasonId}/standings`)}
        >
          <Trophy className="h-4 w-4 text-blue-600" />
          Standings
        </Button>

        {/* Score a Match — manual score / verify / edit */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/league/${leagueId}/manual-scoring`)}
        >
          <SquarePen className="h-4 w-4 text-orange-600" />
          Score a Match
        </Button>
      </div>
    </SectionCard>
  );
}
