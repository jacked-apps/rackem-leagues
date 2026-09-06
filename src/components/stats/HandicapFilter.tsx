/**
 * @fileoverview Opponent-handicap filter: a typed number, or a range.
 *
 * Not a dropdown. Handicaps span three systems with wildly different scales —
 * points runs −2 to +2, percentage 0 to 100, Fargo into the hundreds — so a
 * menu of every value a player has faced is hundreds of entries long and
 * useless to scroll. Typing the number you have in mind is faster than finding
 * it in a list, and it stays fast no matter how many distinct values exist.
 *
 * One number by default, because "what's my record against 2s" is the common
 * question. The Range checkbox opens a second box for "50 and over" and the
 * like, which is the less common one and shouldn't cost anything until asked
 * for.
 *
 * @see src/stats/gameFilters.ts
 */

import { useId, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface HandicapFilterProps {
  /** Lower end, inclusive. Null means unset. */
  min: number | null;
  /** Upper end, inclusive. Null means unset. */
  max: number | null;
  onChange: (next: { min: number | null; max: number | null }) => void;
  /** Lowest handicap present in the games currently in view, for the hint. */
  lowest: number | null;
  /** Highest handicap present in the games currently in view, for the hint. */
  highest: number | null;
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
 * @param lowest - Lowest handicap in view, shown as a hint.
 * @param highest - Highest handicap in view, shown as a hint.
 */
export function HandicapFilter({
  min,
  max,
  onChange,
  lowest,
  highest,
}: HandicapFilterProps) {
  // A saved exact value is one where both ends match, which is how an exact
  // match is expressed. Anything else already IS a range.
  const [isRange, setIsRange] = useState(
    () => min !== null && max !== null && min !== max
  );
  const rangeId = useId();

  /** Exact mode: one number pins both ends. */
  const setExact = (raw: string) => {
    const value = parse(raw);
    onChange({ min: value, max: value });
  };

  /**
   * Turning the range on keeps the number already typed as the lower end and
   * leaves the upper end open — so ticking it next to "50" reads immediately as
   * "50 and over", which is the reason someone reaches for it.
   *
   * Turning it off collapses to the lower end, since that is the number they
   * chose first. Silently clearing both would throw away their work.
   */
  const toggleRange = (on: boolean) => {
    setIsRange(on);
    if (on) onChange({ min, max: null });
    else onChange({ min, max: min });
  };

  const hint =
    lowest !== null && highest !== null && lowest !== highest
      ? `In view: ${lowest} to ${highest}`
      : null;

  return (
    <div className="min-w-[14rem] flex-1">
      <Label className="text-xs text-muted-foreground">Opponent handicap</Label>

      {isRange ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="From"
            aria-label="Opponent handicap from"
            value={display(min)}
            onChange={(e) => onChange({ min: parse(e.target.value), max })}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="To"
            aria-label="Opponent handicap to"
            value={display(max)}
            onChange={(e) => onChange({ min, max: parse(e.target.value) })}
          />
        </div>
      ) : (
        <Input
          type="number"
          inputMode="numeric"
          placeholder="Any"
          aria-label="Opponent handicap"
          value={display(min)}
          onChange={(e) => setExact(e.target.value)}
        />
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
        {/* Typing loses the discoverability a list gave, so say what is
            actually there — otherwise "against 2s" in a Fargo league returns
            nothing and looks broken rather than empty. */}
        {hint && <span className="text-xs text-muted-foreground">· {hint}</span>}
      </div>
    </div>
  );
}
