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
    <SectionCard title="Stats & Standings">
      <div className="flex flex-wrap gap-4">
        {/* Standings */}
        <Button
          variant="outline"
          className="h-auto flex-col items-start p-4 hover:bg-blue-50 hover:border-blue-300"
          onClick={() => navigate(`/league/${leagueId}/season/${seasonId}/standings`)}
        >
          <Trophy className="h-5 w-5 mb-2 text-blue-600" />
          <div className="text-left">
            <div className="font-semibold text-foreground">Standings</div>
            <div className="text-sm text-muted-foreground">Team + player stats</div>
          </div>
        </Button>

        {/* Score a Match — manual score / verify / edit */}
        <Button
          variant="outline"
          className="h-auto flex-col items-start p-4 hover:bg-orange-50 hover:border-orange-300"
          onClick={() => navigate(`/league/${leagueId}/manual-scoring`)}
        >
          <SquarePen className="h-5 w-5 mb-2 text-orange-600" />
          <div className="text-left">
            <div className="font-semibold text-foreground">Score a Match</div>
            <div className="text-sm text-muted-foreground">Enter, verify, or edit scores</div>
          </div>
        </Button>
      </div>
    </SectionCard>
  );
}
