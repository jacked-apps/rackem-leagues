/**
 * @fileoverview Match Card Component
 *
 * Displays a single match with team names, venue, and status.
 * Reusable component for schedule views, team schedules, and weekly matchups.
 */

import React from 'react';
import { MapPin, Calendar } from 'lucide-react';
import type { MatchWithDetails } from '@/types';

interface MatchCardProps {
  /** Match data with team and venue details */
  match: MatchWithDetails;
  /** Optional: Show week information */
  showWeek?: boolean;
  /** Optional: Highlight a specific team */
  highlightTeamId?: string;
}

/**
 * MatchCard Component
 *
 * Displays a match in a card format showing:
 * - Home team vs Away team
 * - Venue (scheduled or actual)
 * - Week/date information (optional)
 * - Match status
 * - Score (if completed)
 *
 * @example
 * <MatchCard
 *   match={matchData}
 *   showWeek={true}
 *   highlightTeamId={currentTeamId}
 * />
 */
export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  showWeek = false,
  highlightTeamId,
}) => {
  const homeTeam = match.home_team;
  const awayTeam = match.away_team;
  const venue = match.actual_venue_id
    ? match.actual_venue
    : match.scheduled_venue;

  const isBye = !homeTeam || !awayTeam;

  // Status badge styling
  const statusColors = {
    scheduled: 'bg-muted text-foreground',
    updating: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    awaiting_verification: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    forfeited: 'bg-red-100 text-red-700',
    postponed: 'bg-yellow-100 text-yellow-700',
  };

  const statusColor = statusColors[match.status] || statusColors.scheduled;

  return (
    <div className="border border-border rounded-lg p-4 hover:border-border transition-colors">
      {/* Week Info (optional) */}
      {showWeek && match.season_week && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Calendar className="h-3 w-3" />
          <span>{match.season_week.week_name}</span>
          <span className="text-muted-foreground">•</span>
          <span>
            {new Date(match.season_week.scheduled_date).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Match Info */}
      {isBye ? (
        <div className="text-center py-4">
          <p className="text-muted-foreground text-sm">
            {homeTeam?.team_name || awayTeam?.team_name} has a BYE week
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Teams */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p
                className={`font-semibold ${
                  highlightTeamId === homeTeam?.id
                    ? 'text-blue-600'
                    : 'text-foreground'
                }`}
              >
                {homeTeam?.team_name || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">Home</p>
            </div>

            <div className="px-4">
              {match.status === 'completed' ? (
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {match.home_games_won} - {match.away_games_won}
                  </p>
                </div>
              ) : (
                <div className="text-muted-foreground text-2xl font-light">vs</div>
              )}
            </div>

            <div className="flex-1 text-right">
              <p
                className={`font-semibold ${
                  highlightTeamId === awayTeam?.id
                    ? 'text-blue-600'
                    : 'text-foreground'
                }`}
              >
                {awayTeam?.team_name || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">Away</p>
            </div>
          </div>

          {/* Venue */}
          {venue && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-gray-100">
              <MapPin className="h-4 w-4" />
              <span>{venue.name}</span>
              {match.actual_venue_id && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                  Venue Changed
                </span>
              )}
            </div>
          )}

          {/* Status Badge */}
          <div className="flex justify-end">
            <span
              className={`text-xs px-2 py-1 rounded ${statusColor}`}
            >
              {match.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
