/**
 * @fileoverview Player Selection Row Component
 *
 * Renders a single row for selecting a player in a lineup.
 * Includes position number, handicap display, player dropdown, optional substitute
 * handicap selector, and clear button.
 *
 * Used in both regular lineup and tiebreaker lineup pages.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { formatHandicap } from '@/utils/lineup';
interface PlayerSelectionRowProps {
  /** Position number (1-5) */
  position: number;

  /** Currently selected player ID (or empty string) */
  playerId: string;

  /** Calculated handicap for this position */
  handicap: number;

  /** Is the lineup locked? */
  locked: boolean;

  /** Handicap system: 'points', 'percentage', 'fargo', 'none' */
  handicapType: string;

  /** Array of available player IDs for selection */
  availablePlayerIds: string[];

  /** Array of other selected player IDs (to disable in dropdown) */
  otherPlayerIds: string[];

  /** Function to get display name for a player ID */
  getPlayerDisplayName: (playerId: string) => string;

  /** Handler when player selection changes */
  onPlayerChange: (position: number, playerId: string) => void;

  /** Handler when clear button is clicked */
  onClearPlayer: (position: number) => void;

  /** Is this a substitute player? */
  isSubstitute: boolean;

  /** Current substitute handicap value (only used if isSubstitute) */
  subHandicap?: string;

  /** Handler when substitute handicap changes */
  onSubHandicapChange?: (newHandicap: string) => void;

  /** Show substitute handicap selector? (only shown in normal mode, not tiebreaker) */
  showSubHandicapSelector?: boolean;

  /** Hide handicap display? (used in tiebreaker mode) */
  hideHandicap?: boolean;

  /** Manual handicap entry value (Fargo — LO types the rating) */
  manualHandicapValue?: string;

  /** Called when manual handicap value changes */
  onManualHandicapChange?: (position: number, value: string) => void;
}

/**
 * Single row for player selection in lineup
 *
 * Displays position number, handicap, player dropdown, and optional clear button.
 * In normal mode, shows substitute handicap selector when a substitute is selected.
 */
export function PlayerSelectionRow({
  position,
  playerId,
  handicap,
  locked,
  handicapType,
  availablePlayerIds,
  otherPlayerIds,
  getPlayerDisplayName,
  onPlayerChange,
  onClearPlayer,
  isSubstitute,
  subHandicap = '',
  onSubHandicapChange,
  showSubHandicapSelector = false,
  hideHandicap = false,
  manualHandicapValue,
  onManualHandicapChange,
}: PlayerSelectionRowProps) {
  const isManualEntry = handicapType === 'fargo' && onManualHandicapChange;

  return (
    <div className="flex gap-2 items-center">
      {/* Position Number */}
      <div className="w-12 text-center">
        <div className="text-sm font-semibold text-gray-700">{position}</div>
      </div>

      {/* Handicap Display — editable input for Fargo, read-only for others */}
      {!hideHandicap && (
        isManualEntry ? (
          <div className="w-16">
            <Input
              type="number"
              min={100}
              max={850}
              value={manualHandicapValue ?? ''}
              onChange={(e) => onManualHandicapChange(position, e.target.value)}
              disabled={locked || !playerId}
              placeholder="—"
              className="text-center text-sm font-semibold h-8 px-1"
            />
          </div>
        ) : (
          <div className="w-12 text-center">
            <div className="text-sm font-semibold text-blue-600">
              {playerId ? formatHandicap(handicap, handicapType === 'percentage') : '-'}
            </div>
          </div>
        )
      )}

      {/* Player Dropdown */}
      <div className="flex-1">
        <Select
          value={playerId}
          onValueChange={(id) => onPlayerChange(position, id)}
          disabled={locked}
        >
          <SelectTrigger className="min-w-[120px]">
            <SelectValue placeholder={`Select Player ${position}`} />
          </SelectTrigger>
          <SelectContent>
            {availablePlayerIds.map((playerOptionId) => (
              <SelectItem
                key={playerOptionId}
                value={playerOptionId}
                disabled={otherPlayerIds.includes(playerOptionId)}
              >
                {getPlayerDisplayName(playerOptionId)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Substitute Handicap Selector (only shown when substitute is selected) */}
      {showSubHandicapSelector && isSubstitute && onSubHandicapChange && (
        <div className="w-24">
          <Select
            value={subHandicap}
            onValueChange={onSubHandicapChange}
            disabled={locked}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sub H/C" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">+2</SelectItem>
              <SelectItem value="1">+1</SelectItem>
              <SelectItem value="0">0</SelectItem>
              <SelectItem value="-1">-1</SelectItem>
              <SelectItem value="-2">-2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Clear Button (only shown when player is selected and not locked) */}
      {playerId && !locked && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onClearPlayer(position)}
          className="h-8 w-8 flex-shrink-0"
          title={`Clear player ${position}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
