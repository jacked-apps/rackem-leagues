/**
 * @fileoverview Venue Card Component
 *
 * Displays venue information in a card format with edit capability.
 * Shows venue details, table counts, and capacity information.
 */
import React from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Venue } from '@/types/venue';

interface VenueCardProps {
  /** Venue data to display */
  venue: Venue;
  /** Called when user clicks edit button */
  onEdit: (venue: Venue) => void;
}

/**
 * VenueCard Component
 *
 * Displays a venue in a card format with:
 * - Venue name and address
 * - Table counts (bar-box and regulation)
 * - Capacity information (travel vs in-house)
 * - Edit button for modifications
 */
export const VenueCard: React.FC<VenueCardProps> = ({ venue, onEdit }) => {
  return (
    <div className="bg-card rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow relative">
      <Button
        onClick={() => onEdit(venue)}
        className="absolute top-4 right-4"
        aria-label="Edit venue"
        size="default"
        loadingText="none"
      >
        <Pencil className="h-5 w-5" />
      </Button>

      <h3 className="text-xl font-semibold text-foreground mb-2 pr-10">
        {venue.name}
      </h3>

      <div className="text-sm text-muted-foreground space-y-1 mb-4">
        <p>{venue.street_address}</p>
        <p>{venue.city}, {venue.state} {venue.zip_code}</p>
        <p>{venue.phone}</p>
      </div>

      <div className="border-t border-border pt-4 mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Bar-Box Tables:</span>
          <span className="font-semibold text-foreground">{venue.bar_box_tables}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">Regulation Tables:</span>
          <span className="font-semibold text-foreground">{venue.regulation_tables}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-100">
          <span className="text-muted-foreground">Total Tables:</span>
          <span className="font-bold text-blue-600">{venue.total_tables}</span>
        </div>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        Capacity: {venue.total_tables} teams travel or {venue.total_tables * 2} teams in-house
      </div>
    </div>
  );
};
