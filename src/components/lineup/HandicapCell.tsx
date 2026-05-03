/**
 * @fileoverview HandicapCell — renders the correct handicap input/display
 * for a lineup position based on context (handicap type, sub type, etc.)
 */

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatHandicap } from '@/utils/lineup';

interface HandicapCellProps {
  playerId: string;
  handicap: number;
  handicapType: string;
  locked: boolean;
  position: number;
  isDoubleDuty: boolean;
  isAnonSub: boolean;
  subHandicap: string;
  onSubHandicapChange?: (value: string) => void;
  manualHandicapValue?: string;
  onManualHandicapChange?: (position: number, value: string) => void;
}

export function HandicapCell({
  playerId,
  handicap,
  handicapType,
  locked,
  position,
  isDoubleDuty,
  isAnonSub,
  subHandicap,
  onSubHandicapChange,
  manualHandicapValue,
  onManualHandicapChange,
}: HandicapCellProps) {
  // Double duty — opponent picks, handicap unknown
  if (isDoubleDuty) {
    return (
      <div className="w-16 text-center">
        <div className="text-sm font-semibold text-muted-foreground">TBD</div>
      </div>
    );
  }

  // Anonymous sub — type-appropriate input
  if (isAnonSub && onSubHandicapChange) {
    if (handicapType === 'points') {
      return (
        <div className="w-16">
          <Select value={subHandicap} onValueChange={onSubHandicapChange} disabled={locked}>
            <SelectTrigger className="h-8 px-1 text-sm">
              <SelectValue placeholder="H/C" />
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
      );
    }
    return (
      <div className="w-16">
        <Input
          type="number"
          min={handicapType === 'fargo' ? 100 : 0}
          max={handicapType === 'fargo' ? 850 : 100}
          value={subHandicap}
          onChange={(e) => onSubHandicapChange(e.target.value)}
          disabled={locked}
          placeholder={handicapType === 'fargo' ? '—' : '%'}
          className="text-center text-sm font-semibold h-8 px-1"
        />
      </div>
    );
  }

  // Fargo regular player — manual rating entry
  if (handicapType === 'fargo' && onManualHandicapChange) {
    return (
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
    );
  }

  // Calculated handicap (points / percentage) — read-only
  return (
    <div className="w-16 text-center">
      <div className="text-sm font-semibold text-blue-600">
        {playerId ? formatHandicap(handicap, handicapType === 'percentage') : '-'}
      </div>
    </div>
  );
}
