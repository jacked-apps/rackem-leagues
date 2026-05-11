/**
 * @fileoverview Venue Select Component
 *
 * Reusable dropdown for selecting a venue within the schedule editor.
 * Shows all venues allowed for the league.
 *
 * Single responsibility: Render a venue dropdown and call onChange when selected.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Minimal venue info needed for the dropdown
 */
export interface VenueOption {
  /** Venue ID */
  id: string;
  /** Venue name for display */
  name: string;
  /** City for additional context */
  city?: string;
  /** State for additional context */
  state?: string;
}

/**
 * Props for VenueSelect component
 */
interface VenueSelectProps {
  /** Currently selected venue ID (null for no venue) */
  value: string | null;
  /** Callback when venue is selected */
  onChange: (venueId: string | null) => void;
  /** All available venues */
  venues: VenueOption[];
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Placeholder text when no value */
  placeholder?: string;
  /** Label for accessibility */
  label?: string;
}

/**
 * Venue Select Component
 *
 * Dropdown for selecting a venue. Used in schedule editor for
 * selecting where each match is played.
 *
 * @example
 * <VenueSelect
 *   value={match.venueId}
 *   onChange={(venueId) => handleVenueChange(match.id, venueId)}
 *   venues={leagueVenues}
 *   label="Match Venue"
 * />
 */
export const VenueSelect: React.FC<VenueSelectProps> = ({
  value,
  onChange,
  venues,
  disabled = false,
  placeholder = 'Select venue',
  label,
}) => {
  // Handle the select change
  const handleValueChange = (newValue: string) => {
    // Special case: "NONE" represents null
    if (newValue === '__NONE__') {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  // Get display value - map null to NONE
  const displayValue = value === null ? '__NONE__' : value;

  return (
    <Select
      value={displayValue}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        className="w-full"
        aria-label={label}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {/* No venue option */}
        <SelectItem value="__NONE__">
          <span className="text-muted-foreground italic">No venue</span>
        </SelectItem>

        {/* Venue options */}
        {venues.map((venue) => (
          <SelectItem key={venue.id} value={venue.id}>
            <div className="flex flex-col">
              <span>{venue.name}</span>
              {(venue.city || venue.state) && (
                <span className="text-xs text-muted-foreground">
                  {[venue.city, venue.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
