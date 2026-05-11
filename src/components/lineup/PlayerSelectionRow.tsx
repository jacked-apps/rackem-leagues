/**
 * @fileoverview Player Selection Row Component
 *
 * Single row in the lineup: position number, handicap cell, player dropdown,
 * clear button, and substitute info tooltip. Delegates handicap rendering
 * to HandicapCell and substitute explanations to SubstituteInfo.
 */

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { HandicapCell } from './HandicapCell';
import { SubstituteInfo } from './SubstituteInfo';

interface PlayerSelectionRowProps {
  position: number;
  playerId: string;
  handicap: number;
  locked: boolean;
  handicapType: string;
  availablePlayerIds: string[];
  otherPlayerIds: string[];
  getPlayerDisplayName: (playerId: string) => string;
  onPlayerChange: (position: number, playerId: string) => void;
  onClearPlayer: (position: number) => void;
  isSubstitute: boolean;
  subHandicap?: string;
  onSubHandicapChange?: (newHandicap: string) => void;
  hideHandicap?: boolean;
  manualHandicapValue?: string;
  onManualHandicapChange?: (position: number, value: string) => void;
  isDoubleDuty?: boolean;
}

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
  hideHandicap = false,
  manualHandicapValue,
  onManualHandicapChange,
  isDoubleDuty = false,
}: PlayerSelectionRowProps) {
  const isAnonSub = isSubstitute && !isDoubleDuty;

  return (
    <div className="flex gap-2 items-center">
      <div className="w-12 text-center">
        <div className="text-sm font-semibold text-foreground">{position}</div>
      </div>

      {!hideHandicap && (
        <HandicapCell
          playerId={playerId}
          handicap={handicap}
          handicapType={handicapType}
          locked={locked}
          position={position}
          isDoubleDuty={isDoubleDuty}
          isAnonSub={isAnonSub}
          subHandicap={subHandicap}
          onSubHandicapChange={onSubHandicapChange}
          manualHandicapValue={manualHandicapValue}
          onManualHandicapChange={onManualHandicapChange}
        />
      )}

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

      <SubstituteInfo isSubstitute={isSubstitute} isDoubleDuty={isDoubleDuty} />
    </div>
  );
}
