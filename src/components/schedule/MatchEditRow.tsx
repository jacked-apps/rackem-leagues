/**
 * @fileoverview Match Edit Row Component
 *
 * Single row in the week editor showing one match with team and venue dropdowns.
 * Displays match number, home/away team selects, and venue select.
 *
 * Single responsibility: Render the edit controls for one match.
 * Parent component (WeekEditorView) handles the actual state updates.
 */

import React from 'react';
import { TeamSelect, type TeamOption } from './TeamSelect';
import { VenueSelect, type VenueOption } from './VenueSelect';
import { Label } from '@/components/ui/label';

/**
 * Props for MatchEditRow component
 */
interface MatchEditRowProps {
  /** Match number for display (1, 2, 3...) */
  matchNumber: number;
  /** Current home team ID */
  homeTeamId: string | null;
  /** Current away team ID */
  awayTeamId: string | null;
  /** Current venue ID */
  venueId: string | null;
  /** Whether this row is editable */
  isEditable: boolean;
  /** All teams available for selection */
  teams: TeamOption[];
  /** All venues available for selection */
  venues: VenueOption[];
  /** Callback when home team changes */
  onHomeTeamChange: (teamId: string | null) => void;
  /** Callback when away team changes */
  onAwayTeamChange: (teamId: string | null) => void;
  /** Callback when venue changes */
  onVenueChange: (venueId: string | null) => void;
}

/**
 * Match Edit Row Component
 *
 * Displays one match's edit controls: home team dropdown, away team dropdown,
 * and venue dropdown. Shows match number for context.
 *
 * Non-editable matches (already started/completed) show disabled dropdowns.
 *
 * @example
 * <MatchEditRow
 *   matchNumber={1}
 *   homeTeamId={match.homeTeamId}
 *   awayTeamId={match.awayTeamId}
 *   venueId={match.venueId}
 *   isEditable={match.isEditable}
 *   teams={allTeams}
 *   venues={leagueVenues}
 *   onHomeTeamChange={(id) => handleTeamChange(match.matchId, 'home', id)}
 *   onAwayTeamChange={(id) => handleTeamChange(match.matchId, 'away', id)}
 *   onVenueChange={(id) => handleVenueChange(match.matchId, id)}
 * />
 */
export const MatchEditRow: React.FC<MatchEditRowProps> = ({
  matchNumber,
  homeTeamId,
  awayTeamId,
  venueId,
  isEditable,
  teams,
  venues,
  onHomeTeamChange,
  onAwayTeamChange,
  onVenueChange,
}) => {
  return (
    <div
      className={`grid grid-cols-12 gap-3 items-center p-3 rounded-lg border ${
        isEditable
          ? 'border-gray-200 bg-white'
          : 'border-gray-100 bg-gray-50'
      }`}
    >
      {/* Match number */}
      <div className="col-span-1">
        <span className="text-sm font-medium text-gray-500">
          #{matchNumber}
        </span>
      </div>

      {/* Home team */}
      <div className="col-span-3">
        <Label className="sr-only">Home Team</Label>
        <TeamSelect
          value={homeTeamId}
          onChange={onHomeTeamChange}
          teams={teams}
          disabled={!isEditable}
          placeholder="Home team"
          label={`Match ${matchNumber} Home Team`}
        />
      </div>

      {/* VS separator */}
      <div className="col-span-1 text-center">
        <span className="text-sm font-medium text-gray-400">vs</span>
      </div>

      {/* Away team */}
      <div className="col-span-3">
        <Label className="sr-only">Away Team</Label>
        <TeamSelect
          value={awayTeamId}
          onChange={onAwayTeamChange}
          teams={teams}
          disabled={!isEditable}
          placeholder="Away team"
          label={`Match ${matchNumber} Away Team`}
        />
      </div>

      {/* Venue */}
      <div className="col-span-4">
        <Label className="sr-only">Venue</Label>
        <VenueSelect
          value={venueId}
          onChange={onVenueChange}
          venues={venues}
          disabled={!isEditable}
          placeholder="Select venue"
          label={`Match ${matchNumber} Venue`}
        />
      </div>

      {/* Non-editable indicator */}
      {!isEditable && (
        <div className="col-span-12 mt-1">
          <span className="text-xs text-amber-600">
            This match cannot be edited (already started or completed)
          </span>
        </div>
      )}
    </div>
  );
};
