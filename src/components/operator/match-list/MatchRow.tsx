/**
 * @fileoverview Match Row Component for Match List Page
 *
 * Displays a single match row inside the week accordion.
 * Shows team names, score (if scored), and status.
 * Clicking navigates to the match data page.
 *
 * Status badges:
 * - Scheduled: Gray
 * - In Progress: Blue
 * - Awaiting Verification: Yellow (needs review)
 * - Complete: Green
 */

import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { MatchWithDetails } from '@/types';

interface MatchRowProps {
  /** Match data with team and venue details */
  match: MatchWithDetails;
  /** League ID for navigation */
  leagueId: string;
  /** Season ID for navigation */
  seasonId: string;
}

/**
 * Get status badge styling and text
 */
function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return {
        text: 'Complete',
        className: 'bg-green-100 text-green-700',
      };
    case 'in_progress':
      return {
        text: 'In Progress',
        className: 'bg-blue-100 text-blue-700',
      };
    case 'awaiting_verification':
      return {
        text: 'Needs Review',
        className: 'bg-yellow-100 text-yellow-700',
      };
    case 'scheduled':
    default:
      return {
        text: 'Scheduled',
        className: 'bg-gray-100 text-gray-600',
      };
  }
}

/**
 * Match Row Component
 *
 * Renders a clickable row for a single match.
 * Mobile-first design with compact layout.
 */
export function MatchRow({ match, leagueId, seasonId }: MatchRowProps) {
  const navigate = useNavigate();

  // Get team names (handle BYE matches)
  const homeTeamName = match.home_team?.team_name || 'BYE';
  const awayTeamName = match.away_team?.team_name || 'BYE';

  // Format score display
  const hasScore = match.home_games_won !== null && match.away_games_won !== null;
  const scoreDisplay = hasScore
    ? `${match.home_games_won}-${match.away_games_won}`
    : '- -';

  // Get status badge
  const statusBadge = getStatusBadge(match.status);

  /**
   * Navigate to match data page
   */
  const handleClick = () => {
    navigate(`/league/${leagueId}/season/${seasonId}/match/${match.id}`);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors text-left"
    >
      {/* Left side: Teams and score */}
      <div className="flex-1 min-w-0">
        {/* Teams */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-900 truncate">
            {homeTeamName}
          </span>
          <span className="text-gray-400">vs</span>
          <span className="font-medium text-gray-900 truncate">
            {awayTeamName}
          </span>
        </div>

        {/* Score (on own line for mobile) */}
        <div className="mt-1 flex items-center gap-3">
          <span className={`text-sm font-mono ${hasScore ? 'text-gray-700' : 'text-gray-400'}`}>
            {scoreDisplay}
          </span>

          {/* Status badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.className}`}>
            {statusBadge.text}
          </span>
        </div>
      </div>

      {/* Right side: Arrow */}
      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
    </button>
  );
}
