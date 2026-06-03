/**
 * @fileoverview HandicapCell — renders the correct handicap input/display
 * for a lineup position based on the system's handicapEntry dials.
 *
 * Per the UI modularity audit at
 * `docs/brainstorms/2026-06-03-ui-modularity-audit-requirements.md`:
 * this component used to peek at `handicapType` six times to choose
 * widget kind, min/max bounds, placeholder, and display format. It
 * now reads all six from the system module's `handicapEntry` config.
 *
 * Adding a new handicap system means writing its `HandicapEntryModule`
 * config — no edits to this file.
 */

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getHandicapSystem, type HandicapType } from '@/systems/handicap-systems';

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
  // Resolve the system module from the handicapType string. The module
  // exposes a `handicapEntry` field with all the dials this component
  // needs: widget kind, range/enum, placeholder, display format, source.
  const system = getHandicapSystem(handicapType as HandicapType);
  const entry = system.handicapEntry;

  // Double duty — opponent picks, handicap unknown. System-agnostic.
  if (isDoubleDuty) {
    return (
      <div className="w-16 text-center">
        <div className="text-sm font-semibold text-muted-foreground">TBD</div>
      </div>
    );
  }

  // Anonymous sub — captain enters this slot's handicap. Widget kind
  // and bounds come from the system's entry dials.
  if (isAnonSub && onSubHandicapChange) {
    if (entry.inputKind === 'select' && entry.enumValues) {
      return (
        <div className="w-16">
          <Select value={subHandicap} onValueChange={onSubHandicapChange} disabled={locked}>
            <SelectTrigger className="h-8 px-1 text-sm">
              <SelectValue placeholder={entry.placeholderText || entry.columnHeader} />
            </SelectTrigger>
            <SelectContent>
              {entry.enumValues.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <div className="w-16">
        <Input
          type="number"
          min={entry.range?.min}
          max={entry.range?.max}
          step={entry.range?.integer ? 1 : undefined}
          value={subHandicap}
          onChange={(e) => onSubHandicapChange(e.target.value)}
          disabled={locked}
          placeholder={entry.placeholderText}
          className="text-center text-sm font-semibold h-8 px-1"
        />
      </div>
    );
  }

  // Regular player with manual entry — captain types the rating. Today
  // this fires for FargoRate (source 'manual'). Future API-backed Fargo
  // (source 'api') would render a different branch, not this one.
  if (entry.source === 'manual' && onManualHandicapChange) {
    return (
      <div className="w-16">
        <Input
          type="number"
          min={entry.range?.min}
          max={entry.range?.max}
          step={entry.range?.integer ? 1 : undefined}
          value={manualHandicapValue ?? ''}
          onChange={(e) => onManualHandicapChange(position, e.target.value)}
          disabled={locked || !playerId}
          placeholder={entry.placeholderText}
          className="text-center text-sm font-semibold h-8 px-1"
        />
      </div>
    );
  }

  // Read-only display — derived handicap (points / percentage today).
  return (
    <div className="w-16 text-center">
      <div className="text-sm font-semibold text-blue-600">
        {playerId ? entry.displayFormat(handicap) : '-'}
      </div>
    </div>
  );
}
