/**
 * @fileoverview SectionCard — the shared shell for league-detail section cards.
 *
 * Teams, Schedule, League Overview, Stats (and future sections) all share the
 * same anatomy: a titled card with optional right-aligned header actions and a
 * body that's either loading, empty, or content. Before this component each
 * card hand-rolled that shell with slightly different wrappers, header markup,
 * and loading/empty states. SectionCard makes them look and behave identically
 * by building on the shadcn `Card` primitives (the project's card standard).
 *
 * Two ergonomics on top of the chrome:
 *   - **Tight padding.** The shadcn defaults (py-6 / gap-6 / px-6) bloat a
 *     stack of cards; SectionCard trims them so the page reads denser.
 *   - **Collapsible.** Opt in with `collapsible` to let a card show just its
 *     header (title + subtitle + actions) and expand on click. Keeps a long
 *     page scannable — e.g. Teams collapses to "Teams · 6 teams" until opened.
 *
 * Usage:
 *   <SectionCard title="Teams" subtitle="6 teams" collapsible defaultOpen={false}
 *     actions={<Button>Manage Teams</Button>}>
 *     {loading ? <SectionCardLoading /> : <table>…</table>}
 *   </SectionCard>
 */

import * as React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from '@/components/ui/card';

export interface SectionCardProps {
  /** Section heading (left of the header row). */
  readonly title: React.ReactNode;
  /** Optional sub-line under the title (e.g. a count summary). */
  readonly subtitle?: React.ReactNode;
  /** Optional right-aligned header actions (shadcn Buttons, InfoButton, etc.). */
  readonly actions?: React.ReactNode;
  /** Card body — content, or one of the state helpers below. */
  readonly children: React.ReactNode;
  /** When true, the header toggles the body open/closed. */
  readonly collapsible?: boolean;
  /** Initial open state for a collapsible card (default open). */
  readonly defaultOpen?: boolean;
  /** Extra classes merged onto the Card wrapper. */
  readonly className?: string;
}

/**
 * Titled section card with an optional actions slot and optional collapse.
 * Padding is trimmed from the shadcn defaults to keep a card stack compact.
 */
export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const showBody = !collapsible || open;

  return (
    <Card className={cn('mb-4 gap-2 py-3', className)}>
      <CardHeader
        className={cn('px-4', collapsible && 'cursor-pointer select-none')}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <CardTitle className="flex items-center gap-2 text-lg">
          {collapsible &&
            (open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ))}
          {title}
        </CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
        {actions && (
          // Stop clicks on the actions from toggling the collapse.
          <CardAction
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </CardAction>
        )}
      </CardHeader>
      {showBody && <CardContent className="px-4">{children}</CardContent>}
    </Card>
  );
}

/** Uniform loading body for a SectionCard. */
export function SectionCardLoading({ message = 'Loading…' }: { readonly message?: string }) {
  return <div className="py-6 text-center text-muted-foreground">{message}</div>;
}

/** Uniform empty-state body: an icon/emoji, a message, and an optional action. */
export function SectionCardEmpty({
  icon,
  message,
  action,
}: {
  readonly icon?: React.ReactNode;
  readonly message: string;
  readonly action?: React.ReactNode;
}) {
  return (
    <div className="py-6 text-center">
      {icon && <div className="mb-2 text-3xl">{icon}</div>}
      <p className="mb-3 text-muted-foreground">{message}</p>
      {action && <div className="inline-flex items-center gap-2">{action}</div>}
    </div>
  );
}
