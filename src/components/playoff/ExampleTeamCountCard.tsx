/**
 * @fileoverview Example Team Count Card Component
 *
 * A reusable card component for selecting the number of teams to use
 * in the playoff bracket preview. This is a UI-only setting that allows
 * operators to see how their playoff configuration would look with
 * different league sizes.
 *
 * This component uses the playoff settings reducer for state management.
 */

import React, { useState } from 'react';
import { Pencil, ChevronUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  PlayoffSettingsState,
  PlayoffSettingsAction,
} from '@/hooks/playoff/usePlayoffSettingsReducer';

/**
 * Props for the ExampleTeamCountCard component
 */
export interface ExampleTeamCountCardProps {
  /** Current playoff settings state */
  settings: Pick<PlayoffSettingsState, 'exampleTeamCount'>;
  /** Dispatch function for updating settings */
  dispatch: React.Dispatch<PlayoffSettingsAction>;
}

/**
 * ExampleTeamCountCard Component
 *
 * Displays the current example team count with a visual indicator and provides
 * collapsible editing controls. Matches the visual pattern of other settings cards.
 */
export const ExampleTeamCountCard: React.FC<ExampleTeamCountCardProps> = ({
  settings,
  dispatch,
}) => {
  // Local state for collapsible edit section
  const [showEdit, setShowEdit] = useState(false);

  const { exampleTeamCount } = settings;

  // Available team count options (4-40, matching schedule generator capability)
  const teamCountOptions = Array.from({ length: 37 }, (_, i) => i + 4);

  return (
    <div className="p-4 bg-blue-50 rounded-lg space-y-3">
      {/* Summary Row */}
      <div className="flex items-center gap-3">
        {/* Circle indicator with team count */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-lg">
          {exampleTeamCount}
        </div>

        {/* Description */}
        <div className="flex-1">
          <div className="font-medium text-blue-900">
            Showing Example of {exampleTeamCount} Teams
          </div>
          <div className="text-sm text-blue-700 mt-1">
            Preview how playoffs would work with this league size
          </div>
        </div>

        {/* Edit Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowEdit(!showEdit)}
          className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
        >
          {showEdit ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <Pencil className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Collapsible Edit Section */}
      {showEdit && (
        <div className="pt-3 border-t border-blue-200 space-y-3">
          {/* Team Count Selector */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Number of teams</span>
            <Select
              value={exampleTeamCount.toString()}
              onValueChange={(value) =>
                dispatch({ type: 'SET_EXAMPLE_TEAM_COUNT', payload: parseInt(value, 10) })
              }
            >
              <SelectTrigger className="w-[140px] bg-card">
                <SelectValue placeholder="Select teams" />
              </SelectTrigger>
              <SelectContent>
                {teamCountOptions.map((count) => (
                  <SelectItem key={count} value={count.toString()}>
                    {count} Teams
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Explanation */}
          <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
            Change this to see how your playoff settings would apply to leagues of different sizes.
            This is for preview only and does not affect actual league settings.
          </div>
        </div>
      )}
    </div>
  );
};

export default ExampleTeamCountCard;
