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
import { Link, Unlink } from 'lucide-react';
import { TeamSelect, type TeamOption } from './TeamSelect';
import { VenueSelect, type VenueOption } from './VenueSelect';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  /** Whether venue is manually overridden (not linked to home team) */
  venueOverride: boolean;
  /** Assigned table number (null for auto) */
  tableNumber: number | null;
  /** Whether this row is editable */
  isEditable: boolean;
  /** All teams available for selection */
  teams: TeamOption[];
  /** All venues available for selection */
  venues: VenueOption[];
  /** Whether to show BYE option in team dropdowns (only for odd team count) */
  showByeOption: boolean;
  /** Callback when home team changes */
  onHomeTeamChange: (teamId: string | null) => void;
  /** Callback when away team changes */
  onAwayTeamChange: (teamId: string | null) => void;
  /** Callback when venue changes */
  onVenueChange: (venueId: string | null) => void;
  /** Callback to toggle venue override */
  onVenueOverrideToggle: () => void;
  /** Callback when table number changes */
  onTableNumberChange: (tableNumber: number | null) => void;
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
  venueOverride,
  tableNumber,
  isEditable,
  teams,
  venues,
  showByeOption,
  onHomeTeamChange,
  onAwayTeamChange,
  onVenueChange,
  onVenueOverrideToggle,
  onTableNumberChange,
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
          showByeOption={showByeOption}
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
          showByeOption={showByeOption}
        />
      </div>

      {/* Venue with link/unlink toggle */}
      <div className="col-span-3 flex items-center gap-1">
        <div className="flex-1">
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
        {/* Link/Unlink toggle - shows whether venue follows home team
            Link icon (blue) = venue auto-updates with home team
            Unlink icon (orange) = venue is manually overridden */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`p-2 h-9 w-9 ${venueOverride ? 'text-orange-600' : 'text-blue-600'}`}
          onClick={onVenueOverrideToggle}
          disabled={!isEditable}
          title={venueOverride
            ? 'Venue is manually set. Click to link to home team.'
            : 'Venue follows home team. Click to manually override.'}
        >
          {venueOverride ? (
            <Unlink className="h-4 w-4" />
          ) : (
            <Link className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Table number */}
      <div className="col-span-1">
        <Label className="sr-only">Table</Label>
        <Input
          type="number"
          min="1"
          value={tableNumber ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onTableNumberChange(val === '' ? null : parseInt(val, 10));
          }}
          disabled={!isEditable}
          placeholder="#"
          className="w-full text-center"
          aria-label={`Match ${matchNumber} Table Number`}
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
