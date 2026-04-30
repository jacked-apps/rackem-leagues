/**
 * @fileoverview Team Select Component
 *
 * Reusable dropdown for selecting a team within the schedule editor.
 * Shows all teams in the season and handles the selection.
 *
 * Single responsibility: Render a team dropdown and call onChange when selected.
 * The parent component handles swap logic.
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
 * Minimal team info needed for the dropdown
 */
export interface TeamOption {
  /** Team ID */
  id: string;
  /** Team name for display */
  teamName: string;
}

/**
 * Props for TeamSelect component
 */
interface TeamSelectProps {
  /** Currently selected team ID (null for BYE) */
  value: string | null;
  /** Callback when team is selected */
  onChange: (teamId: string | null) => void;
  /** All available teams */
  teams: TeamOption[];
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Placeholder text when no value */
  placeholder?: string;
  /** Label for accessibility */
  label?: string;
  /** Whether to show BYE option (only for seasons with odd team count) */
  showByeOption?: boolean;
}

/**
 * Team Select Component
 *
 * Dropdown for selecting a team. Used in schedule editor for
 * selecting home/away teams in each match row.
 *
 * @example
 * <TeamSelect
 *   value={match.homeTeamId}
 *   onChange={(teamId) => handleTeamChange(match.id, 'home', teamId)}
 *   teams={allTeams}
 *   label="Home Team"
 * />
 */
export const TeamSelect: React.FC<TeamSelectProps> = ({
  value,
  onChange,
  teams,
  disabled = false,
  placeholder = 'Select team',
  label,
  showByeOption = false,
}) => {
  // Handle the select change
  const handleValueChange = (newValue: string) => {
    // Special case: "BYE" represents null
    if (newValue === '__BYE__') {
      onChange(null);
    } else {
      onChange(newValue);
    }
  };

  // Get display value - map null to BYE
  const displayValue = value === null ? '__BYE__' : value;

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
        {/* BYE option - only shown for seasons with odd team count */}
        {showByeOption && (
          <SelectItem value="__BYE__">
            <span className="text-muted-foreground italic">BYE</span>
          </SelectItem>
        )}

        {/* Team options */}
        {teams.map((team) => (
          <SelectItem key={team.id} value={team.id}>
            {team.teamName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
