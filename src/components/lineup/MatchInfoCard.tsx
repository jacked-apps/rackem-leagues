/**
 * @fileoverview Match Information Card Component
 *
 * Displays match details including date, opponent, home/away status, and venue.
 * Reusable across different lineup pages (regular match, tiebreaker, 5v5).
 */

import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { TeamNameLink } from '@/components/TeamNameLink';
import { parseLocalDate } from '@/utils/formatters';
import { VenueWithMaps } from '@/components/VenueWithMaps';

interface MatchInfoCardProps {
  scheduledDate?: string;
  opponent: {
    id: string;
    name: string;
  } | null;
  isHomeTeam: boolean;
  /** Scheduled venue ID (home team's default venue) */
  venueId?: string | null;
  /** Actual venue ID if different from scheduled (overflow) */
  actualVenueId?: string | null;
  /** Assigned table number at the venue */
  assignedTableNumber?: number | null;
}

/**
 * Match information display card
 *
 * Shows match date, opponent, home/away status, and venue in a compact format.
 * Uses actual_venue if set (overflow), otherwise scheduled_venue.
 */
export function MatchInfoCard({
  scheduledDate,
  opponent,
  isHomeTeam,
  venueId,
  actualVenueId,
  assignedTableNumber,
}: MatchInfoCardProps) {
  // Use actual venue if set (overflow), otherwise scheduled venue
  const displayVenueId = actualVenueId || venueId;
  const isOverflow = !!actualVenueId;
  return (
    <Card>
      <CardContent className="px-4 py-0 space-y-1">
        {/* Date */}
        {scheduledDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {parseLocalDate(scheduledDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}

        {/* Matchup */}
        <div className="text-lg font-semibold text-foreground">
          vs{' '}
          {opponent ? (
            <TeamNameLink teamId={opponent.id} teamName={opponent.name} />
          ) : (
            'BYE'
          )}
        </div>

        {/* Home/Away & Venue on same line */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium">
            {isHomeTeam ? 'Home Game' : 'Away Game'}
          </span>
          {displayVenueId && (
            <>
              <span>@</span>
              <VenueWithMaps venueId={displayVenueId} className="text-sm" />
              {assignedTableNumber && (
                <span className="font-medium text-blue-700">
                  Table {assignedTableNumber}
                </span>
              )}
              {isOverflow && (
                <span className="text-xs text-orange-600 font-medium">(overflow)</span>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
