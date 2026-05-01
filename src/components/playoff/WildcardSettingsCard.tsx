/**
 * @fileoverview Wildcard Settings Card Component
 *
 * A reusable card component for displaying and configuring wildcard playoff spots.
 * Wildcard spots replace the last N bracket positions with randomly selected teams
 * from those that didn't automatically qualify.
 *
 * Example: In a 5-team league with 4-team bracket and 1 wildcard:
 * - Top 3 teams auto-qualify
 * - 4th spot is randomly chosen between 4th and 5th place teams
 *
 * This component uses the playoff settings reducer for state management.
 */

import React, { useState } from 'react';
import { Pencil, ChevronUp, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JokerIcon } from '@/components/icons/JokerIcon';
import type {
  PlayoffSettingsState,
  PlayoffSettingsAction,
} from '@/hooks/playoff/usePlayoffSettingsReducer';

/**
 * Props for the WildcardSettingsCard component
 */
export interface WildcardSettingsCardProps {
  /** Current playoff settings state */
  settings: Pick<PlayoffSettingsState, 'wildcardSpots'>;
  /** Dispatch function for updating settings */
  dispatch: React.Dispatch<PlayoffSettingsAction>;
}

/**
 * WildcardSettingsCard Component
 *
 * Displays the current wildcard settings with a visual indicator and provides
 * collapsible editing controls. Matches the visual pattern of other settings cards.
 */
export const WildcardSettingsCard: React.FC<WildcardSettingsCardProps> = ({
  settings,
  dispatch,
}) => {
  // Local state for collapsible edit section
  const [showEdit, setShowEdit] = useState(false);

  const { wildcardSpots } = settings;

  // Determine circle display - show "OFF" or joker icon
  const circleDisplay = wildcardSpots === 0
    ? 'OFF'
    : <JokerIcon className="h-10 w-10" size={40} />;

  // Determine title text
  const titleText = wildcardSpots === 0
    ? 'No Wildcard Spots'
    : wildcardSpots === 1
      ? '1 Wildcard Spot'
      : `${wildcardSpots} Wildcard Spots`;

  // Description text explaining wildcard behavior
  const descriptionText = wildcardSpots === 0
    ? 'All playoff spots determined by standings'
    : `Last ${wildcardSpots} spot${wildcardSpots > 1 ? 's' : ''} randomly selected from remaining teams`;

  return (
    <div className="p-4 bg-amber-50 rounded-lg space-y-3">
      {/* Summary Row */}
      <div className="flex items-center gap-3">
        {/* Circle indicator */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-600 text-white font-bold text-sm">
          {circleDisplay}
        </div>

        {/* Description */}
        <div className="flex-1">
          <div className="font-medium text-amber-900">
            {titleText}
          </div>
          <div className="text-sm text-amber-700 mt-1">
            {descriptionText}
          </div>
        </div>

        {/* Edit Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowEdit(!showEdit)}
          className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
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
        <div className="pt-3 border-t border-amber-200 space-y-3">
          {/* Wildcard Spots Input */}
          <div className="flex items-center gap-2">
            <Shuffle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">Wildcard spots</span>
            <Input
              type="number"
              min={0}
              max={10}
              value={wildcardSpots}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch({ type: 'SET_WILDCARD_SPOTS', payload: parseInt(e.target.value) || 0 })
              }
              className="w-20 bg-card"
            />
            <span className="text-sm text-amber-700">(0 = disabled)</span>
          </div>

          {/* Explanation */}
          <div className="text-xs text-amber-600 bg-amber-100 p-2 rounded">
            Wildcard spots replace the last positions in the bracket. Teams that didn&apos;t
            automatically qualify compete for these spots through random selection.
          </div>
        </div>
      )}
    </div>
  );
};

export default WildcardSettingsCard;
