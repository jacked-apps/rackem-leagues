/**
 * @fileoverview Match Card Component
 *
 * Displays a single match with teams, venue, and table information.
 * Reusable component following single responsibility principle.
 */

import React from 'react';
import { MapPin } from 'lucide-react';
import type { Team, Venue } from '@/types';

type TeamForMatchCard = Pick<Team, 'id' | 'team_name' | 'captain_id'>;
type VenueForMatchCard = Pick<Venue, 'id' | 'name' | 'city' | 'state'> & { street_address?: string };

interface MatchCardData {
  id: string;
  home_team?: TeamForMatchCard | null;
  away_team?: TeamForMatchCard | null;
  scheduled_venue?: VenueForMatchCard | null;
  scheduled_venue_id?: string | null;
}

interface MatchCardProps {
  match: MatchCardData;
  tableNumber?: number;
}

/**
 * MatchCard Component
 *
 * Displays match information including teams, venue, and table number.
 * Handles null/undefined values gracefully.
 *
 * @param match - Match data with team and venue details
 * @param tableNumber - Optional venue-specific table number
 */
export const MatchCard: React.FC<MatchCardProps> = ({ match, tableNumber }) => {
  return (
    <div className="border border-border rounded-lg p-4 hover:bg-muted transition-colors">
      <div className="flex items-center justify-between">
        {/* Teams */}
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="text-right flex-1">
              <span className="font-semibold text-foreground">
                {match.home_team?.team_name || 'BYE'}
              </span>
              <span className="text-xs text-muted-foreground ml-2">(Home)</span>
            </div>
            <div className="text-xl font-bold text-muted-foreground">vs</div>
            <div className="text-left flex-1">
              <span className="font-semibold text-foreground">
                {match.away_team?.team_name || 'BYE'}
              </span>
              <span className="text-xs text-muted-foreground ml-2">(Away)</span>
            </div>
          </div>
        </div>

        {/* Venue */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
          <MapPin className="h-4 w-4" />
          {match.scheduled_venue ? (
            <div>
              <div className="font-medium">{match.scheduled_venue.name}</div>
              {match.scheduled_venue.city && match.scheduled_venue.state && (
                <div className="text-xs">
                  {match.scheduled_venue.city}, {match.scheduled_venue.state}
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground italic">Venue TBD</div>
          )}
        </div>

        {/* Table Number - only show if venue exists and table number provided */}
        {match.scheduled_venue && tableNumber && (
          <div className="ml-6 text-right">
            <div className="text-xs text-muted-foreground">Table</div>
            <div className="text-lg font-semibold text-foreground">
              {tableNumber}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
