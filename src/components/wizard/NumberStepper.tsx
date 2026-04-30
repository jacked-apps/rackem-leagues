/**
 * @fileoverview NumberStepper — minus/value/plus control for numeric inputs
 *
 * Mobile-friendly stepper with large tap targets. Used for lineup size,
 * roster size, and similar numeric wizard inputs. Supports optional label
 * and InfoButton.
 *
 * Enforces min/max bounds. Disables − at min, + at max.
 */

import { Button } from '@/components/ui/button';
import { InfoButton } from '@/components/InfoButton';

interface NumberStepperProps {
  /** Current numeric value */
  value: number;

  /** Called when value changes via + or − */
  onChange: (value: number) => void;

  /** Minimum allowed value */
  min: number;

  /** Maximum allowed value */
  max: number;

  /** Step increment (default 1) */
  step?: number;

  /** Optional label displayed above the stepper */
  label?: string;

  /** Optional info button next to the label */
  labelInfoButton?: { title: string; content: React.ReactNode };
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  labelInfoButton,
}: NumberStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  const decrement = () => {
    if (!atMin) onChange(Math.max(min, value - step));
  };

  const increment = () => {
    if (!atMax) onChange(Math.min(max, value + step));
  };

  return (
    <div className="space-y-2">
      {(label || labelInfoButton) && (
        <div className="flex items-center justify-center gap-1">
          {label && <p className="font-medium text-foreground">{label}</p>}
          {labelInfoButton && (
            <InfoButton title={labelInfoButton.title} size="sm">
              {labelInfoButton.content}
            </InfoButton>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={decrement}
          disabled={atMin}
          className="w-12 h-12 text-xl"
        >
          −
        </Button>
        <span className="text-2xl font-semibold w-12 text-center">{value}</span>
        <Button
          variant="outline"
          onClick={increment}
          disabled={atMax}
          className="w-12 h-12 text-xl"
        >
          +
        </Button>
      </div>
    </div>
  );
}
