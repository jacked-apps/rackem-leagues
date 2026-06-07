/**
 * @fileoverview SectionCard — the shared shell for league-detail section cards.
 *
 * Teams, Schedule, League Overview, Stats (and future sections) all share the
 * same anatomy: a titled card with optional right-aligned header actions and a
 * body that's either loading, empty, or content. Before this component each
 * card hand-rolled that shell with slightly different wrappers, header markup,
 * and loading/empty states. SectionCard makes them look and behave identically
 * by building on the shadcn `Card` primitives (the project's card standard,
 * already used by StatsCard).
 *
 * Usage:
 *   <SectionCard title="Teams" actions={<Button>Manage Teams</Button>}>
 *     {loading ? <SectionCardLoading /> : rows.length === 0
 *       ? <SectionCardEmpty icon="👥" message="No teams yet" action={...} />
 *       : <table>…</table>}
 *   </SectionCard>
 *
 * The component owns ONLY the chrome (card + header + content padding). Each
 * card keeps its own body — including which loading/empty/content branch to
 * render — so behavior is unchanged while the look converges.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from '@/components/ui/card';

export interface SectionCardProps {
  /** Section heading (left of the header row). */
  readonly title: React.ReactNode;
  /** Optional right-aligned header actions (shadcn Buttons, InfoButton, etc.). */
  readonly actions?: React.ReactNode;
  /** Card body — content, or one of the state helpers below. */
  readonly children: React.ReactNode;
  /** Extra classes merged onto the Card wrapper. */
  readonly className?: string;
}

/**
 * Titled section card with an optional actions slot. The actions render in the
 * shadcn `CardAction` slot, which positions them top-right of the header.
 */
export function SectionCard({ title, actions, children, className }: SectionCardProps) {
  return (
    <Card className={cn('mb-6', className)}>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        {actions && (
          <CardAction className="flex items-center gap-2">{actions}</CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Uniform loading body for a SectionCard. */
export function SectionCardLoading({ message = 'Loading…' }: { readonly message?: string }) {
  return (
    <div className="py-8 text-center text-muted-foreground">{message}</div>
  );
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
    <div className="py-8 text-center">
      {icon && <div className="mb-3 text-4xl">{icon}</div>}
      <p className="mb-4 text-muted-foreground">{message}</p>
      {action && <div className="inline-flex items-center gap-2">{action}</div>}
    </div>
  );
}
