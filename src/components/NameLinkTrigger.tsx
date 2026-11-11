/**
 * @fileoverview NameLinkTrigger — the tappable name shared by
 * `PlayerNameLink` and `TeamNameLink`.
 *
 * Both components open a popover when a name is tapped; this is the name
 * itself, so player and team names look and behave the same everywhere
 * (info colour, slight fade + underline on hover, room for an inline badge).
 *
 * It is a plain `<button>` on purpose rather than the shadcn `Button`: the
 * name sits inline in text, tables and rosters, and `Button`'s height and
 * padding would push those rows around. It forwards its ref and props so it
 * works as a Radix `PopoverTrigger asChild` child.
 *
 * @example
 * <PopoverTrigger asChild>
 *   <NameLinkTrigger className="text-sm">{teamName}</NameLinkTrigger>
 * </PopoverTrigger>
 */

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const NameLinkTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'text-info hover:text-info/80 hover:underline cursor-pointer font-medium transition-colors inline-flex items-center gap-1.5',
      className
    )}
    {...props}
  />
));
NameLinkTrigger.displayName = 'NameLinkTrigger';
