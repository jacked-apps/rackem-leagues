/**
 * @fileoverview The menu's foldable groups ("Extras", "Info").
 *
 * - `NavFolds` wraps the groups and owns which one is open. Only ONE can be
 *   open at a time (opening Info closes Extras), and both start closed.
 * - Both close again as soon as the player goes to another page. On a phone
 *   the drawer remounts each time it opens anyway; on desktop the sidebar
 *   stays mounted, so the open fold is tied to the page it was opened on.
 *   Ed's call (2026-11-01): open a fold, use it to navigate, and the menu is
 *   tidy again on the next page. (Folds used to remember their state per
 *   device; that was dropped for this.)
 * - `NavFold` is one group: a heading button plus its rows.
 *
 * Built on the shadcn Accordion (`type="single"` gives one-at-a-time).
 */

import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

/**
 * Holds the folds; one open at most, reset on every page change.
 *
 * The open fold is stored WITH the page it was opened on, and only counts
 * while that's still the current page — so navigating closes it without an
 * effect that would flash the old state for a frame.
 *
 * @param children `NavFold`s.
 */
export function NavFolds({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [opened, setOpened] = useState<{ path: string; fold: string }>({ path: '', fold: '' });
  const value = opened.path === pathname ? opened.fold : '';

  return (
    <Accordion
      type="single"
      collapsible
      value={value}
      onValueChange={(fold) => setOpened({ path: pathname, fold })}
    >
      {children}
    </Accordion>
  );
}

interface NavFoldProps {
  /** Stable id, unique among the folds. */
  id: string;
  /** Heading text, including any "(New)" marker. */
  title: string;
  /** The fold's rows. */
  children: ReactNode;
}

/**
 * @example
 * <NavFolds>
 *   <NavFold id="info" title={hasNew ? 'Info (New)' : 'Info'}>…rows…</NavFold>
 * </NavFolds>
 */
export function NavFold({ id, title, children }: NavFoldProps) {
  return (
    <AccordionItem value={id} className="border-b-0">
      {/* Same small uppercase look as the menu's other section headings. */}
      <AccordionTrigger className="min-h-11 items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:no-underline">
        {title}
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        <ul className="space-y-1">{children}</ul>
      </AccordionContent>
    </AccordionItem>
  );
}
