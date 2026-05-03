/**
 * @fileoverview Venue List Item Component
 *
 * Displays a venue with checkbox for assignment and limit button.
 * Used in league venue assignment lists.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import type { Venue } from '@/types/venue';

interface VenueListItemProps {
  /** The venue to display */
  venue: Venue;
  /** Whether the venue is assigned */
  isAssigned: boolean;
  /** Whether the toggle action is in progress */
  isToggling: boolean;
  /** Max home teams capacity for this venue */
  capacity?: number;
  /** Number of teams currently using this as home venue */
  teamsAtVenue?: number;
  /** Called when checkbox is toggled */
  onToggle: () => void;
  /** Called when limit button is clicked */
  onLimitClick: () => void;
}

/**
 * VenueListItem Component
 *
 * Renders a single venue in an assignment list with:
 * - Checkbox for toggling assignment
 * - Venue name
 * - Team capacity count (if assigned)
 * - Limit button (if assigned)
 *
 * @example
 * <VenueListItem
 *   venue={venue}
 *   isAssigned={true}
 *   isToggling={false}
 *   capacity={3}
 *   teamsAtVenue={2}
 *   onToggle={handleToggle}
 *   onLimitClick={handleLimit}
 * />
 */
export const VenueListItem: React.FC<VenueListItemProps> = ({
  venue,
  isAssigned,
  isToggling,
  capacity,
  teamsAtVenue,
  onToggle,
  onLimitClick,
}) => {
  // Check if venue is at capacity
  const isAtCapacity = capacity !== undefined && teamsAtVenue !== undefined && teamsAtVenue >= capacity && capacity > 0;

  return (
    <div className="flex items-center gap-3 p-2 hover:bg-muted rounded">
      <input
        type="checkbox"
        checked={isAssigned}
        onChange={onToggle}
        disabled={isToggling}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {venue.name}
        </p>
      </div>
      {isAssigned && (
        <>
          {capacity !== undefined && teamsAtVenue !== undefined && (
            <span className={`text-xs ${isAtCapacity ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>
              {teamsAtVenue}/{capacity} teams
            </span>
          )}
          <Button size="sm" variant="outline" onClick={onLimitClick}>
            Limit
          </Button>
        </>
      )}
    </div>
  );
};
