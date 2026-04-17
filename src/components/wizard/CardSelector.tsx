/**
 * @fileoverview CardSelector — card-based radio selector for wizard steps
 *
 * Generic component that renders a group of selectable cards. Replaces
 * traditional radio buttons with large, mobile-friendly tap targets.
 *
 * Used for: game type, team format presets, handicap system, match format.
 * Supports: optional question label, label InfoButton, horizontal/vertical
 * layouts, per-option InfoButtons, and disabled "Coming soon" cards.
 *
 * See PLAN-wizard2.md → CardSelector API (v1)
 */

import { InfoButton } from '@/components/InfoButton';
import { SelectableCard, type SelectableCardOption } from './SelectableCard';

interface CardSelectorProps<T> {
  /** Optional question label displayed above the cards */
  label?: string;

  /** Optional info button next to the question label */
  labelInfoButton?: { title: string; content: React.ReactNode };

  /** The options to render as cards */
  options: SelectableCardOption<T>[];

  /** Currently selected value */
  value: T;

  /** Called when the user selects a card */
  onChange: (value: T) => void;

  /** Layout direction — horizontal grid or vertical stack */
  layout?: 'horizontal' | 'vertical';
}

export function CardSelector<T>({
  label,
  labelInfoButton,
  options,
  value,
  onChange,
  layout = 'vertical',
}: CardSelectorProps<T>) {
  return (
    <div className="space-y-3">
      {(label || labelInfoButton) && (
        <div className="flex items-center gap-1">
          {label && <p className="font-medium text-gray-900">{label}</p>}
          {labelInfoButton && (
            <InfoButton title={labelInfoButton.title} size="sm">
              {labelInfoButton.content}
            </InfoButton>
          )}
        </div>
      )}

      <div
        className={
          layout === 'horizontal'
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3'
            : 'flex flex-col gap-3'
        }
      >
        {options.map((option, i) => (
          <SelectableCard
            key={String(option.value) ?? i}
            option={option}
            isSelected={option.value === value}
            onSelect={onChange}
          />
        ))}
      </div>
    </div>
  );
}
