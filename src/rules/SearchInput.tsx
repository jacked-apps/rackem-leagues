/**
 * @fileoverview Sticky debounced search input for the rules page.
 *
 * Controlled externally (RulesPage owns the committed query state). Reports
 * keystrokes back via `onDraftChange` so the parent can render immediate
 * visual feedback, and reports the debounced value via `onDebouncedChange`
 * for the actual search run. Pressing `/` anywhere on the page focuses the
 * input unless the user is already typing in another input/textarea.
 */

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const INPUT_ID = 'rules-search-input';

type SearchInputProps = {
  /** Initial value on mount (usually empty). */
  initialValue?: string;
  /** Fires on every keystroke (no debounce) — useful for immediate UI state. */
  onDraftChange?: (value: string) => void;
  /** Fires after the user stops typing for `debounceMs`. */
  onDebouncedChange: (value: string) => void;
  /** Debounce delay. Defaults to 250 ms. */
  debounceMs?: number;
};

export function SearchInput({
  initialValue = '',
  onDraftChange,
  onDebouncedChange,
  debounceMs = 250,
}: SearchInputProps) {
  const [value, setValue] = useState(initialValue);

  // Debounce the committed value.
  useEffect(() => {
    const handle = window.setTimeout(() => onDebouncedChange(value), debounceMs);
    return () => window.clearTimeout(handle);
  }, [value, debounceMs, onDebouncedChange]);

  // "/" focuses the search input when no other input is focused. We look the
  // element up by id rather than holding a ref because shadcn's `Input` does
  // not forward refs in this project — changing that is out of scope here.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && /^(INPUT|TEXTAREA|SELECT)$/i.test(active.tagName)) return;
      if (active?.isContentEditable) return;
      event.preventDefault();
      document.getElementById(INPUT_ID)?.focus();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="sticky top-0 z-10 bg-background pb-3 pt-2">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={INPUT_ID}
          type="search"
          role="searchbox"
          placeholder="Search the rules"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onDraftChange?.(e.target.value);
          }}
          aria-label="Search the rules"
          className={cn(
            // Icon clearance on the left, stronger border, slightly taller.
            'pl-9 h-10 border-2 border-input focus-visible:border-ring',
          )}
        />
      </div>
    </div>
  );
}
