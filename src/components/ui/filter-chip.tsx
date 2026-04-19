/**
 * @fileoverview FilterChip — a small pill-shaped toggle button used for
 * exclusive-choice filters (pick one of N). Matches the inline filter-chip
 * pattern introduced in `MemberSearchCombobox` so filter UIs feel the same
 * across the app. Extracted here so new consumers do not have to re-copy
 * the styling.
 *
 * Usage:
 *     <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
 *       All
 *     </FilterChip>
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type FilterChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Whether this chip represents the currently-selected value. */
  active?: boolean;
};

export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(
  function FilterChip({ active = false, className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={active}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          active
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground hover:bg-muted/80',
          className,
        )}
        {...props}
      />
    );
  },
);
