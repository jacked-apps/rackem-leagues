/**
 * @fileoverview Step indicator for the create-bracket flow — orientation across
 * the three steps (Details → Players → Review). Presentational; matches the app's
 * shadcn theme tokens.
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CreateStep } from '../useCreateBracketForm';

const STEPS: { key: CreateStep; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'participants', label: 'Players' },
  { key: 'review', label: 'Review' },
];

export function CreateStepper({ current }: { current: CreateStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Progress">
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  active && 'bg-primary text-primary-foreground',
                  done && 'bg-primary/15 text-primary',
                  !active && !done && 'bg-muted text-muted-foreground'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm',
                  active ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="h-px flex-1 bg-border" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
