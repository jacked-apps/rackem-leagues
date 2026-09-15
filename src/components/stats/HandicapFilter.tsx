/**
 * @fileoverview Opponent-handicap filter: pick one, or type a range.
 *
 * Two modes, because the two questions want different controls.
 *
 * "What's my record against 2s" is a pick from what exists, so it is a
 * dropdown — the list is already narrowed by the other filters, so choosing
 * Fargo first leaves a sane number of entries, and seeing the real values
 * beats guessing at them.
 *
 * "50 and over" is not a pick at all; the number wanted may be one nobody has,
 * and an open upper end is not in any list. So Range swaps to two typed boxes.
 *
 * @see src/stats/gameFilters.ts
 */

import { useId, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FilterOption } from '@/stats/filterOptions';

/** Sentinel for "no handicap filter" — a SelectItem cannot hold an empty value. */
const ANY = '__any__';

interface HandicapFilterProps {
  /** Lower end, inclusive. Null means unset. */
  min: number | null;
  /** Upper end, inclusive. Null means unset. */
  max: number | null;
  onChange: (next: { min: number | null; max: number | null }) => void;
  /** Handicaps present under the other filters, ascending, with counts. */
  options: FilterOption<number>[];
}

/** "" and nonsense both mean "no constraint" rather than zero. */
function parse(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Empty rather than "null" in the box. */
function display(value: number | null): string {
  return value === null ? '' : String(value);
}

/**
 * The opponent-handicap control.
 *
 * @param min - Current lower end.
 * @param max - Current upper end.
 * @param onChange - Receives both ends together; they are one filter.
 * @param options - Handicaps available given the other filters.
 */
export function HandicapFilter({ min, max, onChange, options }: HandicapFilterProps) {
  // Both ends equal is how an exact match is expressed; anything else already
  // IS a range, so reopen in the mode that matches the saved filter.
  const [isRange, setIsRange] = useState(
    () => min !== null && max !== null && min !== max
  );
  const rangeId = useId();

  /**
   * Turning the range on keeps the number already chosen as the lower end and
   * leaves the top open — so switching to Range with "50" selected reads at
   * once as "50 and over", which is why someone reaches for it.
   *
   * Turning it off collapses to the lower end, since that is the number chosen
   * first. Clearing both would throw away their work.
   */
  const toggleRange = (on: boolean) => {
    setIsRange(on);
    if (on) onChange({ min, max: null });
    else onChange({ min, max: min });
  };

  const lowest = options[0]?.value ?? null;
  const highest = options[options.length - 1]?.value ?? null;
  const hint =
    lowest !== null && highest !== null && lowest !== highest
      ? `In view: ${lowest} to ${highest}`
      : null;

  return (
    <div className="min-w-0 flex-1 sm:min-w-[12rem]">
      <Label className="text-xs text-muted-foreground">Opponent handicap</Label>

      {/* Range mode uses flex-nowrap with min-w-0 boxes: the two ends of one
          range must stay on a single line and shrink together. Stacked, they
          read as two unrelated fields rather than one span. */}
      {isRange ? (
        <div className="flex flex-nowrap items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            className="min-w-0 flex-1"
            placeholder="From"
            aria-label="Opponent handicap from"
            value={display(min)}
            onChange={(e) => onChange({ min: parse(e.target.value), max })}
          />
          <span className="shrink-0 text-sm text-muted-foreground">to</span>
          <Input
            type="number"
            inputMode="numeric"
            className="min-w-0 flex-1"
            placeholder="To"
            aria-label="Opponent handicap to"
            value={display(max)}
            onChange={(e) => onChange({ min, max: parse(e.target.value) })}
          />
        </div>
      ) : (
        <Select
          value={min === null ? ANY : String(min)}
          onValueChange={(raw) => {
            // One pick sets both ends — that is what "exactly this" means.
            const value = raw === ANY ? null : Number(raw);
            onChange({ min: value, max: value });
          }}
        >
          <SelectTrigger aria-label="Opponent handicap">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label} ({option.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="mt-1 flex items-center gap-2">
        <Checkbox
          id={rangeId}
          checked={isRange}
          onCheckedChange={(checked) => toggleRange(checked === true)}
        />
        <Label
          htmlFor={rangeId}
          className="cursor-pointer text-xs font-normal text-muted-foreground"
        >
          Range
        </Label>
        {/* Only useful while typing — the dropdown already shows what exists. */}
        {isRange && hint && (
          <span className="text-xs text-muted-foreground">· {hint}</span>
        )}
      </div>
    </div>
  );
}
