/**
 * @fileoverview SelectableCard — a single card in a CardSelector group
 *
 * Renders a tappable card with selected/unselected/disabled states.
 * Supports optional description and per-card InfoButton.
 * Shows a toast when a disabled card is tapped.
 *
 * Designed for large touch targets on mobile.
 */

import { toast } from 'sonner';
import { InfoButton } from '@/components/InfoButton';
import { GlossaryInfoButton } from '@/components/GlossaryInfoButton';
import type { GlossarySlug } from '@/glossary';

/** `infoButton` accepts two shapes: a glossary slug (preferred for any term
 *  that has a glossary entry) or inline `{ title, content }` for one-off
 *  page-specific guidance. Same "?" pill renders either way. */
type InfoButtonProp =
  | { slug: GlossarySlug }
  | { title: string; content: React.ReactNode };

export interface SelectableCardOption<T> {
  value: T;
  title: string;
  description?: string;
  disabled?: boolean;
  disabledMessage?: string;
  infoButton?: InfoButtonProp;
}

interface SelectableCardProps<T> {
  option: SelectableCardOption<T>;
  isSelected: boolean;
  onSelect: (value: T) => void;
}

export function SelectableCard<T>({
  option,
  isSelected,
  onSelect,
}: SelectableCardProps<T>) {
  const handleClick = () => {
    if (option.disabled) {
      if (option.disabledMessage) toast.info(option.disabledMessage);
      return;
    }
    onSelect(option.value);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        'w-full text-left rounded-lg border-2 p-4 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-ring',
        option.disabled
          ? 'opacity-50 cursor-not-allowed border-border bg-muted'
          : isSelected
            ? 'border-info bg-info/10 shadow-sm'
            : 'border-border bg-card hover:border-border hover:shadow-sm',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{option.title}</p>
          {option.description && (
            <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
          )}
          {option.disabled && option.disabledMessage && (
            <p className="text-xs text-muted-foreground mt-1 italic">{option.disabledMessage}</p>
          )}
        </div>
        {option.infoButton && (
          'slug' in option.infoButton ? (
            <GlossaryInfoButton
              slug={option.infoButton.slug}
              size="sm"
              align="right"
            />
          ) : (
            <InfoButton
              title={option.infoButton.title}
              size="sm"
              align="right"
            >
              {option.infoButton.content}
            </InfoButton>
          )
        )}
      </div>
    </button>
  );
}
