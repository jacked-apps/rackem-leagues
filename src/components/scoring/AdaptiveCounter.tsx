/**
 * @fileoverview AdaptiveCounter — calculator-driven per-game value input
 *
 * Renders a per-side `kind: 'counter'` input declared by a calculator's
 * `scoringPopupFields()` spec. The current implementation ships grid mode
 * only, sized for ranges ≤ 8 (the existing Fargo 0-7 use case).
 *
 * Future modes (slider for ≤ 20, numeric input for > 20) are deferred until
 * a real calculator declares a wider range — see Branch A scope boundaries
 * in docs/plans/2026-05-05-001-feat-scoring-modal-plumbing-plan.md.
 *
 * Layout: 4-column grid that wraps to multiple rows. An 8-value range
 * renders as 4×2. Each button uses `flex-1 min-h-[44px]` so buttons fill
 * the modal width with comfortable thumb-tap height. A hard `min-w-[44px]`
 * is NOT used because 8 × 44 = 352px would overflow a 320px viewport.
 *
 * Visual states inherit from shadcn Button defaults — no custom hover,
 * focus, or active overrides. Selected = `variant='default'` (filled);
 * unselected = `variant='outline'`.
 *
 * Edge cases:
 *   - min === max → renders a fixed-points label, no buttons. A counter
 *     with no choice is not a counter; consumers should normally avoid
 *     this case by not declaring `kind: 'counter'` for fixed values.
 *   - range > 8 → throws in dev with a clear message so future calculator
 *     authors notice the missing slider/input mode rather than getting a
 *     silent overflow on mobile. (Production-ish: the throw surfaces as a
 *     React error boundary message; misconfiguration is loud, not silent.)
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export interface AdaptiveCounterProps {
  /** Inclusive lower bound for the counter. */
  min: number;
  /** Inclusive upper bound for the counter. */
  max: number;
  /** Display label rendered above the grid. */
  label: string;
  /** Currently selected value. `null` means unselected (no button highlighted). */
  value: number | null;
  /** Called when a button is tapped. */
  onChange: (value: number) => void;
  /** Disable interaction. Defaults to false. */
  disabled?: boolean;
}

/**
 * Calculator-driven per-game value input. Currently grid mode only; future
 * slider / numeric-input modes added when a calculator with a wider range
 * actually ships.
 */
export function AdaptiveCounter({
  min,
  max,
  label,
  value,
  onChange,
  disabled = false,
}: AdaptiveCounterProps) {
  const range = max - min + 1;

  // Degenerate counter: no choice to make. Render fixed-points label.
  if (min === max) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-normal">{label}</Label>
        <p className="text-base font-semibold">{min}</p>
      </div>
    );
  }

  // Out-of-scope range. Slider (≤ 20) and numeric input (> 20) are deferred.
  if (range > 8) {
    throw new Error(
      `AdaptiveCounter: range ${min}-${max} (${range} values) exceeds the grid mode's range. ` +
        `Slider and numeric-input modes are not yet implemented. ` +
        `Either restrict the calculator's range to ≤ 8 values or add the missing mode.`,
    );
  }

  // Build the value list — honors non-zero min.
  const values: number[] = [];
  for (let n = min; n <= max; n += 1) values.push(n);

  return (
    <div className="space-y-2 w-full">
      <Label className="text-sm font-normal text-center block">{label}</Label>
      <div
        className="grid w-full gap-2.5"
        style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
      >
        {values.map((n) => {
          const selected = value === n;
          return (
            <Button
              key={n}
              type="button"
              variant={selected ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onChange(n)}
              className="min-h-[44px] w-full px-[5px] text-xl font-semibold"
              loadingText="none"
            >
              {n}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
